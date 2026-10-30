import type { Register } from 'claude-code'
import { EXAMPLE_MODEL } from './example.ts'
import { fieldReference } from './fields.ts'
import { render, sealState } from './render.ts'
import { check, MAX_SOURCE_BYTES, type Analysis, type Issue, type ReadResult } from './spec.ts'
import { basename, dirname, isAbsPath, isInside, joinPath } from './text.ts'

// /stockflow is a skill (a skill starts a model turn; a hook-answered command does not). Its
// skill.prompt hook replaces the skill's text with the method and the review lens briefs, read from
// ../prompt.md between their markers, plus the field reference and worked example generated from the
// checker's own tables. The check and render tools and /stockflow-check run the same pure core.
//
// Every file is read through Claude Code's own Read tool and the page is written through its Write
// tool ($.tool.call), so the person's rules, permission mode, PreToolUse hooks and dialogs decide each
// read and write exactly as they would for the model's own calls. The plugin keeps no copy of that
// logic: it only adds its own limits (the page stays in the model's folder, never over a file
// stockflow did not write).

const SKILL = 'stockflow:stockflow'
const CHECK = 'mcp__stockflow__check'
const RENDER = 'mcp__stockflow__render'

/** The text between <!-- name:start --> and <!-- name:end -->, or null. Tolerates CRLF and spacing. */
export function section(md: string, name: string): string | null {
  const re = new RegExp(`<!--\\s*${name}:start\\s*-->\\r?\\n([\\s\\S]*?)<!--\\s*${name}:end\\s*-->`)
  const m = re.exec(md)
  const body = m?.[1].trim()
  return body ? body : null
}

/** The person's request: everything between SKILL.md's first <request> and its last </request>, every line kept. */
export function requestOf(text: string): string {
  const a = text.indexOf('<request>')
  const b = text.lastIndexOf('</request>')
  return a >= 0 && b > a ? text.slice(a + '<request>'.length, b).trim() : ''
}

/** A path as typed after a command: one pair of surrounding quotes is not part of it. */
export function argPath(args: string): string {
  const t = args.trim()
  return t.length >= 2 && /^(["']).*\1$/.test(t) ? t.slice(1, -1).trim() : t
}

/** Bytes of UTF-8, which is what lands on disk. */
export function utf8Bytes(s: string): number {
  let n = 0
  for (const ch of s) { const c = ch.codePointAt(0)!; n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4 }
  return n
}

const LENSES = [
  { name: 'facts-reviewer', tools: ['Read', 'Grep', 'Glob'], description: 'stockflow review lens: checks every label, number, quote, mechanism, loop story and the answer of a stockflow model against its sources. Read-only.' },
  { name: 'sd-reviewer', tools: ['Read', 'Grep', 'Glob', CHECK], description: 'stockflow review lens: checks a stockflow model against system-dynamics rules (stocks, flows, links, polarity, loops, boundary). Read-only.' },
  { name: 'reader-reviewer', tools: ['Read'], description: 'stockflow review lens: a cold reader who sees only the rendered page (screenshots or its reader view) and lists every mark or sentence they cannot decode. Read-only.' },
] as const

/** What registration returned this session: the names the engine gave, not the names we asked for. */
type Registered = { tools: Record<string, string>; agents: string[] }

function header(reg: Registered): string {
  const check = reg.tools.check
  const rend = reg.tools.render
  const tools = check === CHECK && rend === RENDER
    ? `Tools: \`${CHECK}\` { path, reader_view? } checks a model file (quotes against files, notation, every feedback loop and its type, numbers, units, boundary); with reader_view: true and no errors it also returns the page's plain-text reader view. \`${RENDER}\` { path, out? } writes the page once the check has no errors (a file write the person may be asked to approve), and returns the reader view and any layout warnings. If either is not in your tool list, load it with ToolSearch ("stockflow"). Where the method says "run the check", call \`${CHECK}\`; where it says "render", call \`${RENDER}\`.`
    : `The stockflow tools did not register as expected (got ${check ?? 'nothing'} and ${rend ?? 'nothing'}). Tell the person, and use the "In the paste form" substitutions.`
  const agents = reg.agents.length
    ? `Review agents (read-only): ${reg.agents.map(a => `\`${a}\``).join(', ')}. ${reg.agents.length < LENSES.length ? 'For a lens without an agent, brief a general subagent with that lens\'s brief below.' : 'Their briefs are below, so you know what each checks.'} Give the cold reader the reader view text (or screenshots), never the model or the HTML.`
    : 'No review agents registered: brief a general subagent with each lens brief below, or do each lens yourself as a separate pass.'
  return ['# stockflow in this session', '', tools, agents, 'The person can re-check and re-render a hand-edited model with /stockflow-check <model.json>.'].join('\n')
}

/** What a tool call through the engine came back with. */
type Outcome = { deny?: string; isError?: boolean; text?: string; result?: unknown }

/** Everything a hook needs from the host, as closures bound inside that hook. */
type Host = {
  cwd: string
  /** What the path leads to and its size, or undefined when it leads nowhere. */
  kind: (p: string) => Promise<{ kind: string; size: number } | undefined>
  /** Where the path lands, or undefined when it leads nowhere. */
  real: (p: string) => Promise<string | undefined>
  /** Whether the directory entry itself is a symbolic link (dangling ones included). */
  isLink: (p: string) => Promise<boolean>
  exists: (p: string) => Promise<boolean>
  /** Claude Code's Read tool: the person's rules, mode, hooks and dialog decide. */
  readTool: (input: { file_path: string; offset: number; limit: number }) => Promise<Outcome>
  /** Claude Code's Write tool: the person's rules, mode, hooks and dialog decide. */
  writeTool: (file_path: string, content: string) => Promise<Outcome>
  /** The engine's verdict for a call (rules and mode; this query runs no PreToolUse hook). */
  verdict: (tool: string, input: Record<string, unknown>) => Promise<{ decision: string; rule?: string; reason?: string }>
  /** Whether the session has the tool at all: the person's settings can remove one outright. */
  hasTool: (name: string) => Promise<boolean>
  /** A question in the engine's own dialog; rejects when dismissed or when no one can be asked. */
  ask: (question: string, options: string[]) => Promise<string>
}

const absPath = (cwd: string, p: string): string => (isAbsPath(p) ? joinPath('', p) : joinPath(cwd, p))
/** The engine's own words, as one sentence: tags removed, a full stop at the end. */
const clean = (t: unknown): string => { const s = String(t ?? '').replace(/<\/?tool_use_error>/g, '').trim() || 'no reason given'; return /[.!?]$/.test(s) ? s : `${s}.` }

/** The most lines one Read call asks for: the Read tool's own default. */
const MAX_PAGE = 2000
/** A page is sized to this share of the Read tool's token cap, so a slightly denser page still fits. */
const FILL = 0.8
/**
 * A stop for a Read tool that never reaches the end (a file that grows as it is read). A file within
 * MAX_SOURCE_BYTES has at most one line per byte, so full pages read it in MAX_SOURCE_BYTES / MAX_PAGE
 * calls; the rest is room for refused pages and the smaller pages after them. That room is sized for the
 * Read tool's default cap: with CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS lowered (to 5,000, say), a file near
 * 2 MB of long lines in pairs between runs of short ones can need more, and is stopped here.
 */
const MAX_CALLS = 4 * Math.ceil(MAX_SOURCE_BYTES / MAX_PAGE)
/** What a file is read for: it decides what to do when the Read tool cannot give its lines. */
type Use = 'source' | 'model' | 'page'

/**
 * The paging rule (readFile follows it; this is its one statement). The Read tool's refusals of a page as
 * too large are known only by their words (they have no other form), so a refusal is paged past only when
 * its first sentence (firstSaid) matches SIZE_REFUSAL:
 * - the token cap's, "File content (N tokens) exceeds maximum allowed tokens (M)…", counts the page, and the
 *   next page is sized from that count (COUNT);
 * - the byte cap's on the lines one call selects (CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS × 128 bytes),
 *   "…more than a read can return. Use a smaller limit…", and any other match with no count, quarter it;
 * - any other refusal fails at once, in the tool's own words. That includes a size refusal reworded past
 *   SIZE_REFUSAL: a correct model citing a large file is then refused (E02), not paged.
 * A refusal before the file's length is known is followed by a read of one line, which gives it; the page
 * after that is sized from the count (or, with none, quartered).
 * A refused page of one line cannot shrink, so it fails as a line too long (or, by readFile's probe of the
 * next line, as a file the tool will not read in parts). A page that fits is kept, and grows (at most
 * twofold, never past MAX_PAGE) when the last count says the bigger page fits; after a quartering it grows
 * twofold again, staying below the refused size only while it would overlap the refused lines. A file
 * readsAs names is never paged: any refusal of it is about the file.
 */
const SIZE_REFUSAL = /exceeds maximum allowed|more than a read can return|use a smaller limit/i
const COUNT = /\((\d+) tokens\) exceeds maximum allowed tokens \((\d+)\)/i
/**
 * A refusal of a file readsAs names whose first sentence says only that it is too large to read whole (by
 * size, tokens, pages or the model's limits) or that its page count is unknown, which notText already
 * answers; its remedies (the pages parameter, jq, resizing) are not ones a citation can use. Known by words
 * alone, like SIZE_REFUSAL: a refusal in other words is told after notText by its first sentence only, so
 * the tool's remedy is never the advice.
 */
const WHOLE_REFUSAL = /exceeds|too (large|long|many)|larger than|not supported with this model|pages parameter|page count is unknown/i
/** The tool's first sentence (or first line): what is wrong, without the remedy it goes on to give. */
const firstSentence = (why: string): string => /^.*?[.!?](?=\s|$)/.exec(why)?.[0] ?? `${why.split('\n')[0].trim()}.`
/**
 * The one value a refusal is classed and told by: its first sentence, found with the file's path masked so
 * a ". " in the path does not end it. `words` (the path left out) is what SIZE_REFUSAL, WHOLE_REFUSAL and
 * COUNT read; `told` (the path put back) is what is said. Only stockflow's spelling of the path is masked:
 * other text the tool quotes (a working folder, a file's first bytes, the path spelled another way) is not
 * removed, and decides the class when it falls in the first sentence.
 */
function firstSaid(why: string, p: string): { words: string; told: string } {
  const first = firstSentence(why.split(p).join('\u0000'))
  return { words: first.split('\u0000').join(''), told: first.split('\u0000').join(p) }
}

/**
 * What the Read tool reads a file as when not as lines, decided as the tool decides it: from the path's
 * extension alone, in any case, before it reads anything and whatever offset and limit say. So a refusal of
 * such a file is about the file, never about a line. (The tool also sniffs a file with no extension for an
 * image; that one is known only from what the tool returns.)
 */
function readsAs(p: string): 'notebook' | 'pdf' | 'image' | undefined {
  const ext = /^.+\.([^.]+)$/.exec(basename(p))?.[1].toLowerCase()
  if (ext === 'ipynb') return 'notebook'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp') return 'image'
  return undefined
}

/** The Read tool reads whole lines, so a line over its per-call cap cannot be read at all. */
function tooLong(p: string, use: Use): string {
  const why = `a line in ${p} is too long for Claude Code's Read tool, which reads whole lines`
  if (use === 'source') return `${why}; cite a line-broken extract made with a tool (for JSON: a pretty-printed copy) and record the command in "from".`
  if (use === 'model') return `${why}; write the model file with line breaks (indented JSON).`
  return `${why}.`
}

/** The Read tool refused every part of the file alike, so it does not read this file in parts: say so in its words (firstSaid's `told`). */
function notPaged(p: string, told: string, use: Use): string {
  const said = `the Read tool would not read part of ${p} (${told.replace(/\.$/, '')})`
  return use === 'source' ? `${said}; cite a text extract made with a tool and record the command in "from".` : `${said}.`
}

/** What the Read tool reads a file as instead of lines (whether it returned it or refused it), and what to cite instead. */
function notText(p: string, type: unknown, use: Use): string {
  const other = `the Read tool reads ${p} as ${typeof type === 'string' ? `"${type}"` : 'something'}, not as lines of text`
  if (use !== 'source') return `${other}.`
  // a quote is cited by line number, which a notebook's cells do not have and an extract does
  if (type === 'notebook') return `${p} is a Jupyter notebook. stockflow cites lines and a notebook has cells, so cite a text extract (for example: jupyter nbconvert --to script ${p}) and record the command in "from".`
  if (type === 'pdf' || type === 'parts') return `${p} is a PDF; the Read tool returns its pages, not its lines. Cite a text extract made with pdftotext (for example: pdftotext ${p}) and record the command in "from".`
  if (type === 'image') return `${p} is an image, and images cannot be quoted; cite a text source for what it shows.`
  return `${other}; cite a text extract made with a tool and record the command in "from".`
}

/** A page the Read tool refused as too large, with its own token count of the page when its words give one. */
type Refusal = { offset: number; asked: number; count?: { tokens: number; cap: number } }
/** What the last count says the text weighs: the lines it covers, and tokens per character once they are all read. */
type Weight = { from: number; to: number; tokens: number; cap: number; perChar?: number }
/** What a refusal with no count says: `lines` lines from its offset, up to (not including) line `end`, did not fit. */
type Ceiling = { end: number; lines: number }

const refusalOf = (words: string, offset: number, asked: number): Refusal => {
  const m = COUNT.exec(words)
  return { offset, asked, ...(m ? { count: { tokens: Number(m[1]), cap: Number(m[2]) } } : {}) }
}
const sameCount = (a: Refusal | undefined, b: Refusal): boolean => a?.count !== undefined && a.count.tokens === b.count?.tokens

/**
 * The page after a refusal. The count covers exactly the refused lines (from its offset to the file's end
 * at most), so the next page is that many lines scaled to FILL of the cap. With no count, a quarter; and as
 * such a refusal says nothing of other lines, its size is a ceiling only for pages that overlap its lines.
 */
function afterRefusal(r: Refusal, total: number): { limit: number; weight?: Weight; ceiling?: Ceiling } {
  const span = Math.min(r.asked, total - r.offset + 1)
  if (!r.count) return { limit: Math.max(1, Math.floor(span / 4)), ceiling: { end: r.offset + span, lines: span } }
  const { tokens, cap } = r.count
  return { limit: Math.max(1, Math.min(span - 1, Math.floor(span * FILL * cap / tokens))), weight: { from: r.offset, to: r.offset + span - 1, tokens, cap } }
}

/** The Read and Write tools answer a person's deny rule with their own error, not a deny, so the engine's
 *  verdicts for the rules the tool applies tell the person's refusal from a failure: its own, and any the
 *  tool also applies (the Write tool refuses a path a Read deny rule covers). A verdict that cannot be had
 *  because the session has no such tool (the person's settings removed it) is their refusal too; any
 *  other error stays the tool's. */
async function personsVerdict(h: Host, tool: string, input: Record<string, unknown>, r: Outcome, alsoApplies: [string, Record<string, unknown>][] = []): Promise<Outcome> {
  if (r.deny !== undefined || !r.isError) return r
  for (const [t, i] of [[tool, input] as [string, Record<string, unknown>], ...alsoApplies]) {
    const v = await h.verdict(t, i).catch(() => undefined)
    if (v?.decision === 'deny') return { deny: clean(r.text) }
    if (v === undefined && !(await h.hasTool(t))) return { deny: `this session has no ${t} tool (the person's settings deny it, or it was left out of the session).` }
  }
  return r
}

/** One Read call, its error put to the person's verdict (personsVerdict). */
async function readCall(h: Host, input: { file_path: string; offset: number; limit: number }): Promise<Outcome> {
  return personsVerdict(h, 'Read', input, await h.readTool(input))
}

/**
 * Read a file through the engine's Read tool, paging past its per-call cap by the paging rule at
 * SIZE_REFUSAL, which keeps the calls few: each may be a permission question (a file outside the working
 * folder is asked about per call). Anything that is not a regular file is refused before it is opened; a
 * file over MAX_SOURCE_BYTES is refused once the person's settings have allowed reading it (so a refusal
 * never reveals the size of a file they deny). A file the tool reads as a notebook, a PDF or an image
 * (readsAs) is named for what it is whether the tool returns it or refuses it, with the tool's first
 * sentence added only when the refusal is not WHOLE_REFUSAL; a path that leads nowhere is not named for
 * its type, and is reported in the tool's words. A refusal by the person (their rules, mode, hooks or
 * dialog, known by readCall) is reported as theirs, whatever the file.
 */
async function readFile(h: Host, p: string, use: Use): Promise<ReadResult> {
  const k = await h.kind(p)
  if (k && k.kind !== 'file') return { failed: `${p} is not a regular file.` }
  const kind = k ? readsAs(p) : undefined
  const lines: string[] = []
  let offset = 1
  let limit = MAX_PAGE
  let total: number | undefined
  // a refusal before the file's length was known: the one line read next gives it, and is kept
  let pending: Refusal | undefined
  // how the last refusal sizes the pages after it: by its count, or (with none) by a ceiling over its lines
  let weight: Weight | undefined
  let ceiling: Ceiling | undefined
  // every refusal is classed, counted and told from one value, its first sentence (firstSaid)
  const said = (text: unknown, at: number, asked: number) => {
    const why = clean(text)
    const first = firstSaid(why, p)
    return { why, ...first, refusal: refusalOf(first.words, at, asked) }
  }
  for (let calls = 0; calls < MAX_CALLS; calls++) {
    const r = await readCall(h, { file_path: p, offset, limit })
    if (r.deny !== undefined) return { refused: clean(r.deny) }
    if (r.isError) {
      const { why, words, told, refusal } = said(r.text, offset, limit)
      // the path has decided what the file is; the tool's words add at most their first sentence (WHOLE_REFUSAL)
      if (kind) return { failed: WHOLE_REFUSAL.test(words) ? notText(p, kind, use) : `${notText(p, kind, use)} The Read tool also said: ${told}` }
      if (!SIZE_REFUSAL.test(words)) return { failed: why }
      if ((total === undefined ? limit : Math.min(limit, total - offset + 1)) <= 1) {
        // No line has come back yet, and one line weighs what the bigger page before it did: either nothing
        // follows that line, or the tool gives the same answer whatever part is asked for. The next line
        // tells which. (With no count the two cannot be told apart, and the line is blamed.)
        if (total === undefined && sameCount(pending, refusal)) {
          calls++
          const after = await readCall(h, { file_path: p, offset: offset + 1, limit: 1 })
          if (after.deny !== undefined) return { refused: clean(after.deny) }
          if (after.isError && sameCount(refusal, said(after.text, offset + 1, 1).refusal)) return { failed: notPaged(p, told, use) }
        }
        // the Read tool cannot split a line, so a one-line page over its cap cannot be read: say so plainly
        return { failed: tooLong(p, use) }
      }
      if (total === undefined) { pending = refusal; limit = 1; continue }
      ;({ limit, weight, ceiling } = afterRefusal(refusal, total))
      continue
    }
    const res = r.result as { type?: unknown; file?: { content?: unknown; numLines?: number; startLine?: number; totalLines?: number } } | undefined
    const f = res?.file
    if (kind || res?.type !== 'text' || typeof f?.content !== 'string') return { failed: notText(p, kind ?? res?.type, use) }
    if (offset === 1 && k && k.size > MAX_SOURCE_BYTES) return { failed: `${p} is over ${MAX_SOURCE_BYTES / 1_000_000} MB; cite a smaller extract.` }
    const n = f.numLines ?? 0
    const got = f.content.split('\n').slice(0, n)
    lines.push(...got)
    const last = (f.startLine ?? offset) + n - 1
    total = f.totalLines ?? 0
    if (n === 0 || last >= total) return { text: lines.join('\n') }
    offset = last + 1
    if (pending) {
      ;({ limit, weight, ceiling } = afterRefusal(pending, total))
      pending = undefined
      continue
    }
    if (weight && weight.perChar === undefined && lines.length >= weight.to) {
      const chars = lines.slice(weight.from - 1, weight.to).join('\n').length
      if (chars > 0) weight.perChar = weight.tokens / chars
    }
    // the page just read, weighed by the last count: per character once its lines are all read, per line until then
    let fits = MAX_PAGE
    if (weight) {
      const est = weight.perChar !== undefined ? weight.perChar * got.join('\n').length : weight.tokens * n / (weight.to - weight.from + 1)
      fits = est > 0 ? Math.floor(FILL * weight.cap * n / est) : MAX_PAGE
    }
    // a refusal with no count bounds only pages that would overlap its lines
    if (ceiling && offset >= ceiling.end) ceiling = undefined
    limit = Math.max(limit, Math.min(2 * n, fits, ceiling ? ceiling.lines - 1 : MAX_PAGE))
  }
  return { failed: `stopped after ${MAX_CALLS} Read calls before the end of ${p}.` }
}

/** A path typed with "~" names the home folder in a shell, but nothing here expands it. */
const tilde = (p: string, base: string): string | undefined =>
  p.startsWith('~') ? `give the path without ~: absolute, or relative to ${base} (got ${p}).` : undefined

async function load(h: Host, given: string): Promise<{ abs: string; analysis?: Analysis; failure?: string }> {
  const home = tilde(given, 'the working folder')
  if (home) return { abs: given, failure: `the model path starts with "~"; ${home}` }
  const abs = absPath(h.cwd, given)
  const r = await readFile(h, abs, 'model')
  if ('refused' in r) return { abs, failure: `reading the model file ${abs} was refused: ${r.refused}` }
  if ('failed' in r) return { abs, failure: `cannot read the model file ${abs}: ${r.failed}` }
  return { abs, analysis: await check(r.text, abs, { read: p => readFile(h, p, 'source') }) }
}

/** What to do about a file where the page would go: advice both callers can follow (/stockflow-check has no "out"). */
const MOVE_IT = 'Delete or move the file, or give the render tool another "out".'

/**
 * Where the page goes: `out` (relative to the model's folder) or beside the model, as the person would
 * spell it. It must land inside the model's folder and not through a symbolic link, and it may replace
 * only a page whose seal is intact (stockflow wrote it and nobody changed it since).
 */
async function placePage(h: Host, model: string, out: string | undefined): Promise<{ page?: string; problem?: string }> {
  const folder = dirname(model)
  const o = out?.trim()
  const home = o ? tilde(o, 'the model\'s folder') : undefined
  if (home) return { problem: `"out" starts with "~"; ${home}` }
  const page = o ? (isAbsPath(o) ? joinPath('', o) : joinPath(folder, o)) : `${model.replace(/\.json$/i, '')}.html`
  if (!/\.html$/i.test(page)) return { problem: '"out" must end in .html.' }
  const realFolder = await h.real(folder)
  if (!realFolder) return { problem: `cannot resolve the model's folder ${folder}.` }
  if (await h.isLink(page)) return { problem: `${page} is a symbolic link, and stockflow does not write a page through one. ${MOVE_IT}` }
  const parent = await h.real(dirname(page))
  if (!parent) return { problem: `the folder ${dirname(page)} does not exist.` }
  const land = (await h.real(page)) ?? joinPath(parent, basename(page))
  if (!isInside(realFolder, land)) return { problem: `the page must be written inside the model's folder (${folder}).` }
  if (await h.exists(page)) {
    const r = await readFile(h, page, 'page')
    if (!('text' in r)) return { problem: `${page} exists and cannot be read to confirm stockflow wrote it: ${unread(r)} ${MOVE_IT}` }
    const problem = sealProblem(page, sealState(r.text))
    if (problem) return { problem }
  }
  return { page }
}

const unread = (r: { refused: string } | { failed: string }): string => ('refused' in r ? `reading it was refused: ${r.refused}` : r.failed)

/**
 * Why a page may not be replaced, from its seal. Only an intact seal allows it; any other state refuses.
 * The advice suits both callers: /stockflow-check has no "out".
 */
function sealProblem(page: string, state: ReturnType<typeof sealState>): string | undefined {
  if (state === 'intact') return undefined
  if (state === 'none') return `${page} exists without stockflow's seal, so stockflow cannot confirm it wrote the page and will not replace it (a hook may have removed the seal as the page was written, for example one that strips comments). ${MOVE_IT}`
  return `${page} was changed after stockflow wrote it (edited, or rewritten by a hook). Move the edits into the model, or delete the file, then render again.`
}

type Written = { bytes: number; layout: Issue[]; legend: string[]; readerView: string; problem?: string; note?: string }

/** One write, through the Write tool, then a read-back: what landed is what the next render will judge. */
async function writePage(h: Host, a: Analysis, page: string): Promise<Written> {
  const r = render(a)
  const base = { bytes: utf8Bytes(r.html), layout: r.layout, legend: r.legend, readerView: r.readerView }
  const broken = r.layout.filter(i => i.level === 'error')
  if (broken.length) return { ...base, bytes: 0, problem: `not written, because a figure could not be drawn: ${broken.map(i => `${i.code} ${i.where}: ${i.message}`).join(' ')}` }
  const w = await personsVerdict(h, 'Write', { file_path: page, content: r.html }, await h.writeTool(page, r.html), [['Read', { file_path: page }]])
  if (w.deny !== undefined) return { ...base, bytes: 0, problem: `writing ${page} was refused: ${clean(w.deny)}` }
  if (w.isError) return { ...base, bytes: 0, problem: `writing ${page} failed: ${clean(w.text)}` }
  // a read-back that fails is said, never dropped: the next render reads the page the same way
  const back = await readFile(h, page, 'page')
  if (!('text' in back)) return { ...base, note: `The page could not be read back through the Read tool (${unread(back)}); the next render may not be able to replace it.` }
  const state = sealState(back.text)
  // stockflow sealed what it just wrote, so a page with no seal now lost it on the way to the disk. The page
  // on disk is refused by every later render whether or not the hook still runs, so deleting it is what the
  // next render needs; excluding the page from the hook only keeps the pages written after that.
  if (state === 'none') return { ...base, note: 'A hook removed stockflow\'s seal from the page as it was written (for example a formatter that strips comments). The page on disk can no longer be confirmed as stockflow\'s, so delete it before rendering again; while that hook runs, each new page loses its seal too, so also exclude the page from the hook.' }
  const problem = sealProblem(page, state)
  return { ...base, note: problem ? `The page changed as it was written (a hook rewrote it), so the next render will refuse to replace it: ${problem}` : undefined }
}

/** A plugin's own tool shows no permission prompt, so its explicit rules are honoured here. */
async function mayRun(h: Host, tool: string, input: Record<string, unknown>, what: string): Promise<string | undefined> {
  const v = await h.verdict(tool, input).catch(() => ({ decision: 'deny', reason: 'the permission check failed.' } as { decision: string; rule?: string; reason?: string }))
  if (v.decision === 'deny') return `the person's settings deny ${tool}${v.reason ? `: ${v.reason}` : '.'}`
  if (v.decision === 'ask' && v.rule) {
    const yes = 'Allow it'
    const answer = await h.ask(`Your settings ask before ${tool} runs. Let stockflow ${what}?`, [yes, 'Do not allow it']).catch(() => '')
    if (answer !== yes) return `the person's settings ask before ${tool} runs, and it was not allowed.`
  }
  return undefined
}

function summaryText(a: Analysis): string {
  const r = a.report
  const lines = [`stockflow-check: ${r.summary}`]
  const show = (title: string, list: Issue[], more: number) => {
    if (!list.length) return
    lines.push(title, ...list.map(i => `  ${i.code} ${i.where}: ${i.message}`))
    if (more) lines.push(`  … and ${more} more`)
  }
  show('Errors:', r.errors, r.more.errors)
  show('Warnings:', r.warnings, r.more.warnings)
  for (const u of r.undeclared) lines.push(`  undeclared loop: ${u.route}\n    add ${JSON.stringify(u.declare)} with its id, name and story`)
  return lines.join('\n')
}

export const register: Register = on => {
  const reg: Registered = { tools: {}, agents: [] }

  on('session.start', async ($, e, next) => {
    reg.tools = {}
    reg.agents = []
    await $.command.register({
      name: 'stockflow-check',
      description: 'Check a stockflow model file and, when it has no errors, re-render its page beside it.',
      argumentHint: '<path to model.json>',
    })
    reg.tools.check = (await $.tool.register({
      name: 'check',
      description: 'Check a stockflow/1 model file: verifies each cited quote against its file, enforces stock-and-flow notation, finds every feedback loop and derives its type, checks numbers and units, derives the model boundary. Reads through the Read tool, so the person\'s permission settings apply; it reads whole lines, so a file with a line too long for one Read call (minified or single-line JSON), a notebook, a PDF or an image must be cited through a text extract. Returns JSON with a one-line summary, errors and warnings (code, where, message, source), loops with generated traces, undeclared loops with their route and a declaration to complete, what is not checked, and (reader_view: true, no errors) the page\'s plain-text reader view.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The model JSON file: absolute, or relative to the session\'s working folder.' },
          reader_view: { type: 'boolean', description: 'Also return the page\'s plain-text reader view (when the check has no errors), for a reviewer without a browser.' },
        },
        required: ['path'],
      },
      isDeferred: false,
    })).tool
    reg.tools.render = (await $.tool.register({
      name: 'render',
      description: 'Render a stockflow/1 model to a self-contained HTML page (figures, generated legend, short answer, loops, boundary, sources). Refuses while the check has errors. Writes through the Write tool (the person\'s permission settings apply), only inside the model file\'s folder, never over a file stockflow did not write or one changed since. Returns JSON with the page path, the plain-text reader view, layout warnings and legend entries.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The model JSON file: absolute, or relative to the session\'s working folder.' },
          out: { type: 'string', description: 'Where to write the page (.html), relative to the model\'s folder and inside it. Default: beside the model, same name.' },
        },
        required: ['path'],
      },
      isDeferred: false,
    })).tool
    let md = ''
    try { md = await $.fs.read(`${$.plugin.root}/prompt.md`) } catch { md = '' }
    for (const lens of LENSES) {
      const prompt = section(md, `lens:${lens.name}`)
      if (!prompt) continue
      const tools = lens.tools.map(t => (t === CHECK ? reg.tools.check ?? CHECK : t))
      try { reg.agents.push((await $.agent.register({ name: lens.name, description: lens.description, prompt, tools })).agent) } catch { /* the injected text then says to brief a general subagent */ }
    }
    return next(e)
  })

  on('skill.prompt', { skill: SKILL }, async ($, e, next) => {
    const r = await next(e)
    const asked = requestOf(r.text ?? e.text ?? '')
    let md = ''
    try { md = await $.fs.read(`${$.plugin.root}/prompt.md`) } catch { md = '' }
    const method = section(md, 'method')
    const lenses = section(md, 'lenses')
    if (!method || !lenses) {
      return { ...r, text: `The stockflow plugin is installed incorrectly: its method file (prompt.md) is missing or lacks its method or lens sections, so the method cannot run. Tell the person, and suggest reinstalling the plugin. What they asked to model: ${asked || '(nothing given)'}` }
    }
    const head = asked
      ? `What to model, as the person put it:\n\n${asked}`
      : 'Nothing was named. Model the current repository or the system under discussion; first propose two or three candidate questions from a quick look, and ask which one (or state the one you chose and invite a change).'
    const example = `## Worked example: a valid model\n\nA tiny job runner, checked clean by the tools. Copy its shape, not its content.\n\n\`\`\`json\n${JSON.stringify(EXAMPLE_MODEL, null, 1)}\n\`\`\``
    return { ...r, text: [head, header(reg), method, lenses, fieldReference(), example].join('\n\n') }
  })

  on('command.run', { command: 'stockflow-check' }, async ($, e) => {
    const given = argPath(e.args)
    if (!given) return { text: 'stockflow-check: give the model file, e.g. /stockflow-check stockflow/model.json' }
    const h: Host = {
      cwd: await $.session.cwd(),
      kind: p => $.fs.stat(p).then(x => ({ kind: x.kind, size: x.size }), () => undefined),
      real: p => $.fs.stat(p, { resolve: true }).then(s => s.realPath, () => undefined),
      isLink: p => $.fs.list(dirname(p)).then(es => es.some(x => x.name === basename(p) && x.isLink), () => false),
      exists: p => $.fs.exists(p),
      readTool: input => $.tool.call({ tool: 'Read', ...input }).then(r => r as Outcome, err => ({ isError: true, text: String(err) })),
      writeTool: (file_path, content) => $.tool.call({ tool: 'Write', file_path, content }).then(r => r as Outcome, err => ({ isError: true, text: String(err) })),
      verdict: (tool, input) => $.tool.check({ tool, input }),
      hasTool: name => $.tool.list().then(ts => ts.some(t => t.name === name), () => true),
      ask: (question, options) => $.ui.ask(question, options),
    }
    const { abs, analysis, failure } = await load(h, given)
    if (!analysis) return { text: `stockflow-check: ${failure}` }
    if (!analysis.report.ok) return { text: summaryText(analysis) }
    const place = await placePage(h, abs, undefined)
    if (!place.page) return { text: `${summaryText(analysis)}\nNot rendered: ${place.problem}` }
    const w = await writePage(h, analysis, place.page)
    if (w.problem) return { text: `${summaryText(analysis)}\nNot rendered: ${w.problem}` }
    return { text: `${summaryText(analysis)}\nRendered ${place.page} (${w.bytes} bytes).${w.note ? ` ${w.note}` : ''}${w.layout.length ? ` ${w.layout.length} layout warning(s):\n${w.layout.map(i => `  ${i.code} ${i.where}: ${i.message}`).join('\n')}` : ''}` }
  })

  on('tool.call', { tool: CHECK }, async ($, e) => {
    const given = typeof e.path === 'string' ? e.path.trim() : ''
    if (!given) return { deny: 'check needs { path }: the model JSON file.' }
    const h: Host = {
      cwd: await $.session.cwd(),
      kind: p => $.fs.stat(p).then(x => ({ kind: x.kind, size: x.size }), () => undefined),
      real: p => $.fs.stat(p, { resolve: true }).then(s => s.realPath, () => undefined),
      isLink: p => $.fs.list(dirname(p)).then(es => es.some(x => x.name === basename(p) && x.isLink), () => false),
      exists: p => $.fs.exists(p),
      readTool: input => $.tool.call({ tool: 'Read', ...input }).then(r => r as Outcome, err => ({ isError: true, text: String(err) })),
      writeTool: (file_path, content) => $.tool.call({ tool: 'Write', file_path, content }).then(r => r as Outcome, err => ({ isError: true, text: String(err) })),
      verdict: (tool, input) => $.tool.check({ tool, input }),
      hasTool: name => $.tool.list().then(ts => ts.some(t => t.name === name), () => true),
      ask: (question, options) => $.ui.ask(question, options),
    }
    const stop = await mayRun(h, CHECK, { path: given }, `check ${given}`)
    if (stop) return { deny: `check: ${stop}` }
    const { analysis, failure } = await load(h, given)
    if (!analysis) return { deny: `check: ${failure}` }
    const withReader = e.reader_view === true && analysis.report.ok ? { reader_view: render(analysis).readerView } : {}
    return { result: JSON.stringify({ ...analysis.report, ...withReader }, null, 1) }
  }).catch(($, e, next) => ({ deny: `check crashed (${next.error.kind}): ${next.error.message ?? 'no message'}. Check the model's shape against the field reference.` }))

  on('tool.call', { tool: RENDER }, async ($, e) => {
    const given = typeof e.path === 'string' ? e.path.trim() : ''
    if (!given) return { deny: 'render needs { path }: the model JSON file.' }
    const h: Host = {
      cwd: await $.session.cwd(),
      kind: p => $.fs.stat(p).then(x => ({ kind: x.kind, size: x.size }), () => undefined),
      real: p => $.fs.stat(p, { resolve: true }).then(s => s.realPath, () => undefined),
      isLink: p => $.fs.list(dirname(p)).then(es => es.some(x => x.name === basename(p) && x.isLink), () => false),
      exists: p => $.fs.exists(p),
      readTool: input => $.tool.call({ tool: 'Read', ...input }).then(r => r as Outcome, err => ({ isError: true, text: String(err) })),
      writeTool: (file_path, content) => $.tool.call({ tool: 'Write', file_path, content }).then(r => r as Outcome, err => ({ isError: true, text: String(err) })),
      verdict: (tool, input) => $.tool.check({ tool, input }),
      hasTool: name => $.tool.list().then(ts => ts.some(t => t.name === name), () => true),
      ask: (question, options) => $.ui.ask(question, options),
    }
    const out = typeof e.out === 'string' ? e.out : undefined
    const stop = await mayRun(h, RENDER, { path: given, ...(out ? { out } : {}) }, `render ${given}`)
    if (stop) return { deny: `render: ${stop}` }
    const { abs, analysis, failure } = await load(h, given)
    if (!analysis) return { deny: `render: ${failure}` }
    if (!analysis.report.ok) return { result: JSON.stringify({ rendered: false, why: 'the model has check errors; fix them and render again', ...analysis.report }, null, 1) }
    const place = await placePage(h, abs, out)
    if (!place.page) return { deny: `render: ${place.problem}` }
    const w = await writePage(h, analysis, place.page)
    if (w.problem) return { result: JSON.stringify({ rendered: false, why: w.problem, summary: analysis.report.summary }, null, 1) }
    return { result: JSON.stringify({ rendered: true, page: place.page, bytes: w.bytes, ...(w.note ? { note: w.note } : {}), layout: w.layout, legend: w.legend, summary: analysis.report.summary, warnings: analysis.report.warnings, reader_view: w.readerView }, null, 1) }
  }).catch(($, e, next) => ({ deny: `render crashed (${next.error.kind}): ${next.error.message ?? 'no message'}.` }))
}

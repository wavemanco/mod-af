import type { EngineInterface, PromptComposeInput, Register } from 'claude-code'
import type { JargoneRegistered, JargoneReplyGlossary, JargoneVoice } from '../types'
import {
  checkText, DEFAULT_GLOSSARY, linksIn, loadLists, parseGlossary, replyNote,
  type Finding, type Glossary, type Lists, type Scores,
} from './check.ts'
import { EXCEPTIONS, FAMILIARITY, REPLACEMENTS } from './data.ts'

// The wiring. /jargone is a skill (a skill starts a model turn); /jargone-check and /jargone-voice are
// commands this module answers itself (no model turn). The skill.prompt hook replaces the skill's text
// with the method and the reviewer briefs, read from ../prompt.md between their markers. The check
// tool and /jargone-check run the same pure checker (check.ts) on what gather() collects.
//
// Every file is read through Claude Code's own Read tool, and the /jargone-check report is written
// through its Write tool ($.tool.call), so the person's rules, permission mode, PreToolUse hooks and
// dialogs decide each read and write as they would for the model's own calls. Only prompt.md, the
// plugin's own file, is read with $.fs.
//
// Session mode (/jargone-voice) keeps its settings in $.state (types/index.d.ts), which survives a hot
// reload of this module, with the standing instruction built once from prompt.md when it is turned on.
// prompt.compose adds that instruction to every system prompt while it is on; classic.Stop checks each
// reply and shows the person a note the model never reads ($.ui.log).

const SKILL = 'jargone:jargone'
const CHECK = 'mcp__jargone__check'
const VOICE_ID = 'jargone:voice'

const VOICE = { plugin: 'jargone', key: 'voice' } as const
const NOTICE = { plugin: 'jargone', key: 'noticeDue' } as const
const REGISTERED = { plugin: 'jargone', key: 'registered' } as const
const REPLY_GLOSSARY = { plugin: 'jargone', key: 'replyGlossary' } as const

const LENSES = [
  {
    name: 'accuracy-reviewer',
    tools: ['Read', 'Grep', 'Glob'],
    description: 'jargone reviewer: checks a rewrite against its original, the files content moved to and the files it describes, for claims that changed, wrong definitions, words used in two senses and lost facts. Read-only.',
  },
  {
    // No tools: the cold reader is given the rewrite's text and must not open the original.
    name: 'cold-reader',
    tools: [],
    description: 'jargone reviewer: a cold reader, briefed as the named reader and given only the rewrite\'s text, who says what it is, who it is for, when to use it, what to remember and what was unclear. Opens no files.',
  },
] as const

// ------------------------------------------------------------------------------------ helpers

/** The text between <!-- name:start --> and <!-- name:end -->, or null. Tolerates CRLF and spacing. */
export function section(md: string, name: string): string | null {
  const re = new RegExp(`<!--\\s*${name}:start\\s*-->\\r?\\n([\\s\\S]*?)<!--\\s*${name}:end\\s*-->`)
  const body = re.exec(md)?.[1]?.trim()
  return body ? body : null
}

/** The person's request: everything between SKILL.md's first <request> and its last </request>. */
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

/** Whether the request asks for the ASD-STE100-inspired style. */
export const asksSte = (request: string): boolean => /(^|\s)--ste-inspired(?=\s|$)/.test(request)

const isAbs = (p: string): boolean => /^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(p)

/** Resolve `rel` against `base` (an absolute `rel` wins), with `.` and `..` worked out and forward slashes. */
export function joinPath(base: string, rel: string): string {
  const raw = (isAbs(rel) ? rel : `${base.replace(/[\\/]+$/, '')}/${rel}`).replace(/\\/g, '/')
  let prefix = ''
  let rest = raw
  const drive = /^([A-Za-z]:)\//.exec(raw)
  if (drive) { prefix = `${drive[1]}/`; rest = raw.slice(prefix.length) }
  else if (raw.startsWith('//')) { prefix = '//'; rest = raw.slice(2) }
  else if (raw.startsWith('/')) { prefix = '/'; rest = raw.slice(1) }
  const out: string[] = []
  for (const part of rest.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      // a UNC path's server and share (//server/share) are its root: ".." stops there, as Windows does
      if (prefix === '//' && out.length <= 2) continue
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
      else if (!prefix) out.push('..')
      continue
    }
    out.push(part)
  }
  return prefix + out.join('/')
}

/**
 * A path from the working folder (as pathFrom or a listing gives it) put under that folder as it is. It
 * is never read again for a drive letter or a leading slash, as joinPath reads a typed path, so a folder
 * named "C:" (or a name holding a backslash) on Linux or macOS stays inside the working folder.
 */
export const under = (root: string, rel: string): string => `${root.replace(/\/+$/, '')}/${rel}`

/**
 * A typed path (absolute, or relative to the working folder `cwd`) as an absolute path, by the rules of
 * the system the working folder is on (`posix`; Host decides it once, from the folder the session gives:
 * one that starts with "/"). On Linux and macOS only a leading "/" makes a path absolute, and "C:" or a
 * backslash is part of a name; on Windows, as joinPath reads it, drive letters, backslashes and UNC
 * shares included. Left out, `posix` is read from the folder's normalized form, where "//" is a share.
 */
export function resolveTyped(cwd: string, typed: string, posix = cwd.startsWith('/') && !cwd.startsWith('//')): string {
  if (!posix) return joinPath(cwd, typed)
  const out: string[] = []
  for (const part of (typed.startsWith('/') ? typed : `${cwd}/${typed}`).split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') { out.pop(); continue }
    out.push(part)
  }
  return `/${out.join('/')}`
}

/** `abs` as a path from the folder `root` (no leading "./"), or undefined when it is not inside it. */
export function pathFrom(root: string, abs: string): string | undefined {
  // roots here are already in the working folder's form (Host normalizes them once): only a trailing slash is dropped
  const r = root.length > 1 ? root.replace(/\/+$/, '') : root
  if (r === '/') return abs.startsWith('/') && abs.length > 1 && !abs.startsWith('//') ? abs.slice(1) : undefined
  return abs.startsWith(`${r}/`) && abs.length > r.length + 1 ? abs.slice(r.length + 1) : undefined
}

/** Some names, for a note, as they are (the report makes each note one line): the first five, then "…" if there are more. */
const someOf = (names: string[]): string => `${names.slice(0, 5).map(n => n || '""').join(', ')}${names.length > 5 ? ', …' : ''}`

/** Text kept to one line, as a Markdown heading or list item needs: each run of line breaks becomes a space. */
const oneLine = (text: string): string => text.replace(/[\r\n]+/g, ' ')

/** A name a folder's entry may have as one part of a path: a string, not empty, not "." or "..", holding no slash. */
const isPlainName = (name: unknown): name is string =>
  typeof name === 'string' && name !== '' && name !== '.' && name !== '..' && !name.includes('/')

const dirOf = (rel: string): string => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '')
const baseOf = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''

/**
 * Where a link written in the file `from` (a path from the working folder) leads, as a path from the
 * working folder; undefined for a web address, or a path that climbs out of the folder. A leading "/"
 * starts at the working folder, as GitHub starts it at the repository's top.
 */
export function linkedPath(from: string, target: string): string | undefined {
  let t = target.trim()
  if (t.startsWith('<') && t.endsWith('>')) t = t.slice(1, -1).trim()
  if (!t || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(t) || t.startsWith('//')) return undefined
  t = t.replace(/\?.*$/, '')
  try { t = decodeURI(t) } catch { /* keep it as written */ }
  const out: string[] = []
  for (const part of (t.startsWith('/') ? t : `${dirOf(from)}/${t}`).split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (!out.length) return undefined
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join('/')
}

/** Whether a file is a folder's README (any extension), as GitHub shows one when the folder is opened. */
const isReadme = (rel: string): boolean => /^readme(\.[^./]+)?$/i.test(baseOf(rel))

/**
 * Whether a link that resolved to `resolved` opens the document `doc`: the file itself, or its folder
 * when the document is that folder's README in Markdown (a `#fragment` reaches a heading only in
 * rendered Markdown). A folder holding two Markdown READMEs is not told apart.
 */
export function leadsTo(resolved: string, doc: string): boolean {
  return resolved === doc || (dirOf(doc) === resolved && isReadme(doc) && /\.(md|markdown)$/i.test(doc))
}

/**
 * The project's own name, which J04 accepts in the opening (and J01 and J07 treat as a name), and where
 * it came from. Nothing records it, so it is taken from a folder name: for a README, the folder that
 * holds it; for any other file, the working folder. The check's notes say which name was used and
 * why, so a wrong guess is visible; the right name can be added to "known" in .jargone/glossary.json.
 */
export function projectNameOf(cwd: string, rel: string): { name: string; from: string } {
  const dir = dirOf(rel)
  if (isReadme(rel) && dir) return { name: baseOf(dir), from: 'the folder that holds this README' }
  // the top of a file system ("/", "C:/") has no name
  const top = baseOf(cwd)
  return { name: !cwd.startsWith('/') && /^[A-Za-z]:$/.test(top) ? '' : top, from: 'the working folder' }
}

/** The one file content may move to (principle 2, method step 4): `<name>-reference.md` beside the document. */
export function referenceFileOf(rel: string): string {
  const dir = dirOf(rel)
  const name = baseOf(rel).replace(/(.)\.[^.]*$/, '$1')
  return dir ? `${dir}/${name}-reference.md` : `${name}-reference.md`
}

/** The moved-to paths in a `.jargone/moves/<file>.json` file, and what is wrong with it. */
export function movesOf(json: string): { to: string[]; problems: string[] } {
  let raw: unknown
  try { raw = JSON.parse(json) } catch (e) { return { to: [], problems: [`it is not valid JSON (${(e as Error).message})`] } }
  const list = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { moves?: unknown }).moves : undefined
  if (!Array.isArray(list)) return { to: [], problems: ['it has no "moves" list, such as {"moves": []}'] }
  const to: string[] = []
  const problems: string[] = []
  list.forEach((m, i) => {
    const t = m !== null && typeof m === 'object' ? (m as { to?: unknown }).to : undefined
    if (typeof t === 'string' && t.trim()) { if (!to.includes(t.trim())) to.push(t.trim()) }
    else problems.push(`entry ${i + 1} has no "to" path`)
  })
  return { to, problems }
}

/** Whether session mode is on: the one test the status, the standing instruction and the reply check all use. */
export function voiceOn(v: JargoneVoice | undefined): v is JargoneVoice {
  return v?.on === true && typeof v.text === 'string' && v.text !== ''
}

/** What `/jargone-voice <args>` asks for. */
export type VoiceArgs =
  | { action: 'status' }
  | { action: 'off' }
  | { action: 'on'; reader: string; rewrite: boolean; ste: boolean }
  | { action: 'error'; message: string }

const VOICE_USAGE = 'Use /jargone-voice on for <reader> [--rewrite] [--ste-inspired], /jargone-voice off, or /jargone-voice alone to see whether it is on.'

export function parseVoice(args: string): VoiceArgs {
  const words = args.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return { action: 'status' }
  const verb = (words[0] ?? '').toLowerCase()
  if (verb === 'off') return words.length === 1 ? { action: 'off' } : { action: 'error', message: `"off" takes nothing after it. ${VOICE_USAGE}` }
  if (verb !== 'on') return { action: 'error', message: `"${words[0]}" is not on or off. ${VOICE_USAGE}` }
  let rewrite = false
  let ste = false
  const rest: string[] = []
  for (const w of words.slice(1)) {
    if (w === '--rewrite') rewrite = true
    else if (w === '--ste-inspired') ste = true
    else if (w.startsWith('--')) return { action: 'error', message: `"${w}" is not an option. The options are --rewrite and --ste-inspired.` }
    else rest.push(w)
  }
  if (rest[0]?.toLowerCase() !== 'for' || rest.length < 2) {
    return { action: 'error', message: 'Name the reader after "for", for example /jargone-voice on for a new contributor. Whether a word is jargon depends on who reads it, so there is no default reader.' }
  }
  const reader = argPath(rest.slice(1).join(' '))
  if (!reader) return { action: 'error', message: 'Name the reader after "for", for example /jargone-voice on for a new contributor.' }
  return { action: 'on', reader, rewrite, ste }
}

/**
 * The standing instruction for session mode: prompt.md's voice section with the reader in place of
 * every {reader}, and the ste line after it when asked for. Null when prompt.md lacks a section it needs.
 */
export function voiceText(md: string, v: Pick<JargoneVoice, 'reader' | 'ste'>): string | null {
  const voice = section(md, 'voice')
  if (!voice) return null
  const text = voice.split('{reader}').join(v.reader)
  if (!v.ste) return text
  const ste = section(md, 'ste')
  return ste ? `${text}\n\n${ste}` : null
}

/** What the model is told when --rewrite asks it to write a reply again: at most `cap` findings, then how many more. */
export function rewriteRequest(reader: string, findings: Finding[], more: number): string {
  return [
    `jargone session mode: your last reply has wording problems for this reader: ${reader}. Write the reply again, once, for that reader, and fix the problems below. Keep code, commands, logs and quotations as they are. Where a plainer word would change the meaning, keep the term and define it.`,
    ...findings.map(f => `- Line ${f.line}: ${f.message}`),
    ...(more > 0 ? [`- and ${more} more.`] : []),
  ].join('\n')
}

/**
 * A time as a UTC date, YYYY-MM-DD. The plugin API gives no time zone (and a hook's own clock runs in
 * UTC), so the report names the date in UTC and says so, rather than call it the person's.
 */
export function utcDate(ms: number): string | undefined {
  const d = new Date(ms)
  const year = d.getUTCFullYear()
  return Number.isNaN(d.getTime()) || year < 0 || year > 9999 ? undefined : d.toISOString().slice(0, 10)
}

/**
 * The first line of the /jargone-check report for a file: the one mark that a file at a report's path
 * is jargone's own report for it. A line break in the file's name becomes a space, so it stays one line.
 */
export const reportHead = (rel: string): string => `# jargone check: ${oneLine(rel)}`

/** The first line of a text, without a leading byte-order mark; a line ends at CR, LF or CRLF, as oneLine sees line breaks. */
const firstLine = (text: string): string => text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/)[0] ?? ''

/** The /jargone-check report, in Markdown, written at `ms`; utcDate writes the date, and "(UTC)" goes only beside one. */
export function checkReport(rel: string, ms: number, r: { summary: string; findings: Finding[] }, notes: string[]): string {
  const date = utcDate(ms)
  const lines = [reportHead(rel), '', `Written by \`/jargone-check\` on ${date ? `${date} (UTC)` : 'an unknown date'}. It changed no file but this report.`, '', r.summary, '', '## Findings', '']
  if (!r.findings.length) lines.push('No findings.')
  for (const f of r.findings) {
    const words = (f.suggestion ?? []).filter(s => !s.startsWith('('))
    const options = f.code !== 'J07' && words.length ? ` Plainer options: ${words.map(s => `"${s}"`).join(', ')}.` : ''
    lines.push(`- **Line ${f.line}, ${f.code} (${f.severity}):** ${oneLine(`${f.message}${options}`)}`)
  }
  if (notes.length) lines.push('', '## Notes', '', ...notes.map(n => `- ${oneLine(n)}`))
  return `${lines.join('\n')}\n`
}

// ------------------------------------------------------------------------------- the word lists

// Built once from the generated data module, then kept: the lists are fixed data, so a module copy is
// safe across sessions and reloads (a reload builds them again from the same strings).
let lists: Lists | undefined
const theLists = (): Lists => (lists ??= loadLists(FAMILIARITY, REPLACEMENTS, EXCEPTIONS))

// ------------------------------------------------------------------------------------ the host

/** What a tool call through the engine came back with. */
type Outcome = { deny?: string; isError?: boolean; text?: string; result?: unknown }

/** Everything the checks need from the engine, as closures over one hook's `$`. */
type Host = {
  cwd: string
  /** Whether the working folder is on Linux or macOS: the folder the session gave starts with "/". */
  posix: boolean
  /** Claude Code's Read tool: the person's rules, mode, hooks and dialog decide. */
  readTool: (input: { file_path: string; offset: number; limit: number }) => Promise<Outcome>
  /** Claude Code's Write tool: the person's rules, mode, hooks and dialog decide. */
  writeTool: (file_path: string, content: string) => Promise<Outcome>
  /**
   * One look at a path: what it leads to (a link followed; a link to nothing is `other`), whether the
   * path itself is a link, its time and size, and with `resolve` its real place (every link followed, in
   * the working folder's form; absent when the engine does not give it); undefined when the look fails for any reason: nothing
   * there, no permission to look, a hook above refusing it, or an answer missing its kind, link flag,
   * time or size. The plugin API gives no error kinds to tell these apart, so all count as nothing there.
   */
  stat: (p: string, resolve?: boolean) => Promise<{ kind: string; isLink: boolean; mtimeMs: number; size: number; realPath?: string } | undefined>
  /**
   * A folder's entries (names only; nothing is read), shape-checked here once for every reader:
   * undefined when the listing fails or is malformed. An entry jargone cannot follow is left out of
   * `entries` and its name (undefined when it has none) put in `skipped`, for a reader to say so: one whose kind
   * is not file, dir or other, or whose name is not a plain name (isPlainName), so none leads out of
   * the folder.
   */
  list: (p: string) => Promise<{ entries: { name: string; kind: 'file' | 'dir' | 'other'; isLink: boolean }[]; skipped: (string | undefined)[] } | undefined>
  /** The engine's verdict for a call: the person's rules and mode. */
  verdict: (tool: string, input: Record<string, unknown>) => Promise<{ decision: string; rule?: string; reason?: string }>
  ask: (question: string, options: string[]) => Promise<string>
}

async function host($: EngineInterface): Promise<Host> {
  const raw = await $.session.cwd()
  const posix = raw.startsWith('/')
  return {
    cwd: resolveTyped(raw, raw, posix),
    posix,
    readTool: input => $.tool.call({ tool: 'Read', ...input }).then(r => r as Outcome, err => ({ isError: true, text: String(err) })),
    writeTool: (file_path, content) => $.tool.call({ tool: 'Write', file_path, content }).then(r => r as Outcome, err => ({ isError: true, text: String(err) })),
    // an answer with no value, or without its kind, link flag, time or size, counts as a failed look (the catch is after the mapping)
    // the engine gives realPath already resolved: it is only put in the same form as the working folder
    stat: (p, resolve = false) => $.fs.stat(p, { resolve }).then(s => {
      if (typeof s.kind !== 'string' || typeof s.isLink !== 'boolean' || typeof s.mtimeMs !== 'number' || typeof s.size !== 'number') throw new Error('an incomplete look')
      return { kind: s.kind as string, isLink: s.isLink, mtimeMs: s.mtimeMs, size: s.size, ...(typeof s.realPath === 'string' ? { realPath: resolveTyped(s.realPath, s.realPath, posix) } : {}) }
    }).catch(() => undefined),
    // a malformed answer (not a list) throws in the mapping, and the catch after it makes that undefined
    list: p => $.fs.list(p).then(es => {
      const entries: { name: string; kind: 'file' | 'dir' | 'other'; isLink: boolean }[] = []
      const skipped: (string | undefined)[] = []
      for (const e of es) {
        const shaped = e !== null && typeof e === 'object' && isPlainName(e.name) && (e.kind === 'file' || e.kind === 'dir' || e.kind === 'other')
        if (shaped) entries.push({ name: e.name, kind: e.kind, isLink: e.isLink === true })
        else skipped.push(e !== null && typeof e === 'object' && typeof e.name === 'string' ? e.name : undefined)
      }
      return { entries, skipped }
    }).catch(() => undefined),
    verdict: (tool, input) => $.tool.check({ tool, input }),
    ask: (question, options) => $.ui.ask(question, options),
  }
}

/** The engine's own words, as one sentence: tags removed, a full stop at the end. */
const clean = (t: unknown): string => {
  const s = String(t ?? '').replace(/<\/?tool_use_error>/g, '').trim() || 'no reason given'
  return /[.!?]$/.test(s) ? s : `${s}.`
}

/** The most lines one Read call asks for: the Read tool's own default. */
const MAX_PAGE = 2000
/** A stop for a Read tool that never reaches the end of a file. */
const MAX_CALLS = 200
/** The Read tool's refusals of a page as too large to return, known only by their words. */
const SIZE_REFUSAL = /exceeds maximum allowed|more than a read can return|use a smaller limit/i

/**
 * What the folder's listing shows under a path's exact name, if anything (an empty or failed listing
 * shows nothing). Names are compared as written: a file system that treats two spellings as one name
 * (case, or Unicode normalization on macOS) can hide an entry from this.
 */
async function listed(h: Host, p: string): Promise<{ isLink: boolean } | undefined> {
  return (await h.list(dirOf(p)))?.entries.find(e => e.name === baseOf(p))
}

/** Whether a look found nothing there: the one rule for "missing", for readText and the reply glossary's stamp. */
const isMissing = (look: unknown): look is undefined => look === undefined

type Look = Awaited<ReturnType<Host['stat']>>

/**
 * Read a whole text file through the Read tool, page by page. A page the tool refuses as too large is
 * asked for again at a quarter of its lines; a single line it refuses cannot be split, so that fails.
 * `missing` follows isMissing (any failed look: see Host.stat); a link to nothing is there, as `other`,
 * and so "not a regular file". With `noLink`, a path that is itself a link is refused in the same look
 * that finds the file. `look` is a look the caller already took, used instead of taking another, so the
 * caller and the read judge the same moment.
 */
async function readText(h: Host, p: string, opts: { noLink?: boolean; look?: Look } = {}): Promise<{ text: string } | { problem: string; missing?: true; link?: true }> {
  const noLink = opts.noLink === true
  const look = 'look' in opts ? opts.look : await h.stat(p)
  if (isMissing(look)) return { problem: `${p} does not exist.`, missing: true }
  if (noLink && look.isLink) return { problem: `${p} is a link, not a file of its own.`, link: true }
  if (look.kind !== 'file') return { problem: `${p} is not a regular file.` }
  const lines: string[] = []
  let offset = 1
  let limit = MAX_PAGE
  for (let calls = 0; calls < MAX_CALLS; calls++) {
    const r = await h.readTool({ file_path: p, offset, limit })
    if (r.deny !== undefined) return { problem: `reading ${p} was refused: ${clean(r.deny)}` }
    if (r.isError) {
      const why = clean(r.text)
      if (!SIZE_REFUSAL.test(why)) {
        // gone (or swapped for a link) since the first look, as a second look decides, not the tool's words
        const again = await h.stat(p)
        if (isMissing(again)) return { problem: `${p} does not exist.`, missing: true }
        if (noLink && again.isLink) return { problem: `${p} is a link, not a file of its own.`, link: true }
        return { problem: `the Read tool could not read ${p}: ${why}` }
      }
      if (limit <= 1) return { problem: `a line in ${p} is too long for Claude Code's Read tool, which reads whole lines.` }
      limit = Math.max(1, Math.floor(limit / 4))
      continue
    }
    const res = r.result as { type?: unknown; file?: { content?: unknown; numLines?: number; startLine?: number; totalLines?: number } } | undefined
    const f = res?.file
    if (res?.type !== 'text' || typeof f?.content !== 'string') return { problem: `the Read tool reads ${p} as ${typeof res?.type === 'string' ? `"${res.type}"` : 'something'}, not as lines of text.` }
    const n = f.numLines ?? 0
    lines.push(...f.content.split('\n').slice(0, n))
    const last = (f.startLine ?? offset) + n - 1
    if (n === 0 || last >= (f.totalLines ?? 0)) return { text: lines.join('\n') }
    offset = last + 1
    limit = Math.min(MAX_PAGE, limit * 2)
  }
  return { problem: `stopped after ${MAX_CALLS} Read calls before the end of ${p}.` }
}

/** A plugin's own tool shows no permission prompt, so the person's explicit rules for it are honoured here. */
async function mayRun(h: Host, input: Record<string, unknown>, what: string): Promise<string | undefined> {
  const v = await h.verdict(CHECK, input).catch(() => ({ decision: 'deny', reason: 'the permission check failed.' } as { decision: string; rule?: string; reason?: string }))
  if (v.decision === 'deny') return `the person's settings deny ${CHECK}${v.reason ? `: ${v.reason}` : '.'}`
  if (v.decision === 'ask' && v.rule) {
    const yes = 'Allow it'
    const answer = await h.ask(`Your settings ask before ${CHECK} runs. Let jargone ${what}?`, [yes, 'Do not allow it']).catch(() => '')
    if (answer !== yes) return `the person's settings ask before ${CHECK} runs, and it was not allowed.`
  }
  return undefined
}

// ---------------------------------------------------------------------------------- the check

/** Folded to one case: a file system that ignores case reads `.Jargone` as `.jargone`. */
const fold = (p: string): string => p.toLowerCase()
/**
 * Whether a folder name is jargone's own `.jargone`, in any case, for the link search to skip. On a
 * file system that keeps case, a separate `.Jargone/` folder is skipped too.
 */
const isJargoneName = (name: string): boolean => fold(name) === '.jargone'
/** Folders never searched for links: git's own and installed packages (and jargone's own, isJargoneName). */
const SKIP_DIRS = new Set(['.git', 'node_modules'])
/** The most other Markdown files read for links to the document. */
export const MAX_LINK_FILES = 200
/** The most folders listed while looking for them. */
export const MAX_LINK_DIRS = 2000

/**
 * The Markdown files in the working folder, nearest first, in name order within a folder; the folders
 * that could not be listed; and the entries that could not be searched.
 */
async function markdownFiles(h: Host, realCwd: string | undefined, doc: string, realDoc: string | undefined): Promise<{ files: string[]; cut: boolean; unlisted: string[]; skipped: string[] }> {
  const files: string[] = []
  const unlisted: string[] = []
  const skipped: string[] = []
  const queue = ['']
  let dirsListed = 0
  while (queue.length) {
    if (dirsListed >= MAX_LINK_DIRS) return { files, cut: true, unlisted, skipped }
    const dir = queue.shift() as string
    dirsListed++
    const listing = await h.list(dir ? under(h.cwd, dir) : h.cwd)
    if (!listing) { unlisted.push(dir || 'the working folder itself'); continue }
    for (const name of listing.skipped) skipped.push(name === undefined ? `an entry with no name in ${dir || 'the working folder'}` : dir ? `${dir}/${name}` : name)
    for (const e of listing.entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const rel = dir ? `${dir}/${e.name}` : e.name
      if (e.kind === 'dir' && !SKIP_DIRS.has(e.name) && !isJargoneName(e.name)) queue.push(rel)
      else if (e.kind === 'file' && /\.(md|markdown)$/i.test(e.name)) files.push(rel)
      // A link is listed as itself (kind other). It is not a page (GitHub shows where it points, and does
      // not render it), so it is never read; links written to it are judged by where it leads (toDoc).
      // What it leads to inside the working folder is searched there, under its own path, unless it is in
      // a folder the search skips. A link that could hold links to the document (to a folder, or to a
      // Markdown file by the name of what it leads to) but leads outside the folder, into a skipped folder,
      // or somewhere that cannot be had, is named. One that leads to the document is the document.
      else if (e.kind === 'other' && e.isLink && rel !== doc && !SKIP_DIRS.has(e.name) && !isJargoneName(e.name)) {
        const look = await h.stat(under(h.cwd, rel), true)
        if (look?.kind !== 'dir' && look?.kind !== 'file') continue
        if (realDoc !== undefined && look.realPath === realDoc) continue
        // a link to the working folder itself (docs/repo -> ..) leads inside: the whole folder is searched
        const realRel = look.realPath && realCwd ? (look.realPath === realCwd ? '' : pathFrom(realCwd, look.realPath)) : undefined
        const mayHoldLinks = look.kind === 'dir' || /\.(md|markdown)$/i.test(baseOf(look.realPath ?? rel))
        const searched = realRel !== undefined && !realRel.split('/').some(part => SKIP_DIRS.has(part) || isJargoneName(part))
        if (mayHoldLinks && !searched) skipped.push(rel)
      }
    }
  }
  return { files, cut: false, unlisted, skipped }
}

/**
 * Links to a heading of the document (`#fragment`) from Markdown files in the working folder, the
 * document's own links by file name included. J05 checks only links with a fragment: a link to the
 * file alone keeps working whatever the rewrite does.
 */
async function inboundLinks(h: Host, doc: string, docText: string): Promise<{ inbound: { from: string; fragment: string }[]; notes: string[] }> {
  const realCwd = (await h.stat(h.cwd, true))?.realPath
  // The document may itself be a link. The file it leads to (as a path from the working folder's real
  // place) is then the page GitHub shows: it is the document too, not another file, and the document's
  // own links are read from there (reported under the name that was checked). Limit: when that place
  // cannot be had, the file it leads to may be read as another file.
  const realDoc = (await h.stat(under(h.cwd, doc), true))?.realPath
  const docPlace = realDoc && realCwd ? pathFrom(realCwd, realDoc) : undefined
  // Whether a link leads to the document: by its written path, or by where its target really is (every
  // link on the way followed, a folder by the README GitHub opens in it), compared with where the
  // document really is. One look per target, kept. Limit: a target whose place cannot be had is judged
  // by its written path alone.
  const looks = new Map<string, Promise<Look>>()
  const lookAt = (rel: string): Promise<Look> => {
    let p = looks.get(rel)
    if (!p) { p = h.stat(under(h.cwd, rel), true); looks.set(rel, p) }
    return p
  }
  const toDoc = async (to: string): Promise<boolean> => {
    if (leadsTo(to, doc)) return true
    if (realDoc === undefined) return false
    const look = await lookAt(to)
    if (look?.realPath !== undefined && leadsTo(look.realPath, realDoc)) return true
    // a folder opens its README.md on GitHub: only a folder is asked for one
    return look?.kind === 'dir' && (await lookAt(to ? `${to}/README.md` : 'README.md'))?.realPath === realDoc
  }
  const inbound: { from: string; fragment: string }[] = []
  const collect = async (from: string, text: string, base = from) => {
    for (const l of linksIn(text)) {
      if (l.fragment === undefined || !l.target) continue
      const to = linkedPath(base, l.target)
      if (to !== undefined && (await toDoc(to))) inbound.push({ from, fragment: l.fragment })
    }
  }
  await collect(doc, docText, docPlace ?? doc)
  const { files, cut, unlisted, skipped } = await markdownFiles(h, realCwd, doc, realDoc)
  const others = files.filter(f => f !== doc && f !== docPlace)
  const unread: string[] = []
  for (const f of others.slice(0, MAX_LINK_FILES)) {
    const r = await readText(h, under(h.cwd, f))
    if ('problem' in r) unread.push(f)
    else await collect(f, r.text)
  }
  const notes: string[] = []
  if (others.length > MAX_LINK_FILES) notes.push(`Links to this file's headings were looked for in the first ${MAX_LINK_FILES} of ${others.length} other Markdown files in the working folder; links in the other ${others.length - MAX_LINK_FILES} were not checked.`)
  if (cut) notes.push(`The working folder has more than ${MAX_LINK_DIRS} folders; Markdown files past the first ${MAX_LINK_DIRS} were not searched for links to this file.`)
  if (unlisted.length) notes.push(`${unlisted.length} folder${unlisted.length === 1 ? '' : 's'} could not be listed, so Markdown files in ${unlisted.length === 1 ? 'it were' : 'them were'} not searched for links to this file: ${someOf(unlisted)}.`)
  if (skipped.length) notes.push(`${skipped.length} entr${skipped.length === 1 ? 'y' : 'ies'} in the working folder could not be searched for links to this file (a link leading outside the working folder, into a folder the search skips, or somewhere that could not be had; an entry of unknown kind; or a name that cannot be part of a path: none, empty, ".", ".." or holding a slash): ${someOf(skipped)}.`)
  if (unread.length) notes.push(`${unread.length} Markdown file${unread.length === 1 ? '' : 's'} could not be read, so links in ${unread.length === 1 ? 'it were' : 'them were'} not checked: ${someOf(unread)}.`)
  return { inbound, notes }
}

/** The glossary, `.jargone/glossary.json`, with what is wrong with it; the defaults when there is none. `unread` when it is there and could not be read. */
async function readGlossary(h: Host, look?: { look: Look }): Promise<{ glossary: Glossary; notes: string[]; unread?: true; missing?: true }> {
  const r = await readText(h, under(h.cwd, '.jargone/glossary.json'), look ?? {})
  if ('problem' in r && r.missing) return { glossary: DEFAULT_GLOSSARY, notes: [], missing: true }
  if ('problem' in r) return { glossary: DEFAULT_GLOSSARY, notes: [`.jargone/glossary.json could not be read, so the defaults were used: ${r.problem}`], unread: true }
  const { glossary, problems } = parseGlossary(r.text)
  return { glossary, notes: problems }
}

/**
 * The glossary for the check on each reply, kept for the session in $.state with the file's time and
 * size, and read again (through the Read tool) only when they change, so a reply does not cost a Read
 * call, or a permission question, each time. A refused read is kept too, until the file changes or
 * session mode is turned on again. Limit: an edit that keeps the file's size within the file system's
 * time precision is not seen until the next change. The check tool reads the glossary afresh each time.
 */
async function glossaryForReplies($: EngineInterface, h: Host, fresh = false): Promise<JargoneReplyGlossary> {
  const p = under(h.cwd, '.jargone/glossary.json')
  const look = await h.stat(p)
  const held = (await $.state.get(REPLY_GLOSSARY)).value
  const none = { stamp: '', glossary: DEFAULT_GLOSSARY, notes: [] }
  if (isMissing(look)) {
    // nothing there: recorded when that is news, so a value held from before is not reused if the file returns
    if (held && held.stamp !== '') await $.state.set(REPLY_GLOSSARY, none)
    return none
  }
  const key = `${p}|${look.kind}:${look.mtimeMs}:${look.size}`
  if (!fresh && held?.stamp === key) return held
  // the read judges the same look the stamp was taken from, so a value is never filed under another moment's stamp
  const { glossary, notes, unread, missing } = await readGlossary(h, { look })
  // gone between the stamp and the read: filed as nothing there, not under the stamp of a file it never read
  const value = missing ? none : { stamp: key, glossary, notes: unread ? [...notes, 'It is tried again when it changes, or when session mode is turned on again.'] : notes }
  await $.state.set(REPLY_GLOSSARY, value)
  return value
}

type Checked = { rel: string; summary: string; findings: Finding[]; scores: Scores; notes: string[] }

/**
 * Collect what the checker needs for one file and run it: the file, the glossary, and (when an earlier
 * /jargone saved the original) the original, the files listed in the moves file and the links to the
 * document's headings, which only J05 uses.
 */
async function runCheck(h: Host, given: string): Promise<Checked | { problem: string }> {
  if (given.startsWith('~')) return { problem: `give the path without ~: absolute, or relative to the working folder (got ${given}).` }
  const abs = resolveTyped(h.cwd, given, h.posix)
  const rel = pathFrom(h.cwd, abs)
  if (rel === undefined) return { problem: `${abs} is not inside the working folder (${h.cwd}). jargone keeps its copies and reports in .jargone/ there, so it checks only files inside it.` }
  const doc = await readText(h, abs)
  if ('problem' in doc) return { problem: doc.problem }
  const { glossary, notes } = await readGlossary(h)

  let original: string | undefined
  const moved: { path: string; text: string }[] = []
  let inbound: { from: string; fragment: string }[] = []
  // jargone's own working files (the original, the moves file, the report) are files of their own: one
  // that is a link (to the document itself, say) is refused in the same look, not followed
  const o = await readText(h, under(h.cwd, `.jargone/originals/${rel}`), { noLink: true })
  if (!('problem' in o)) original = o.text
  else if (!o.missing) notes.push(`The saved original could not be read, so J05 (nothing lost) did not run: ${o.problem}`)
  if (original !== undefined) {
    const m = await readText(h, under(h.cwd, `.jargone/moves/${rel}.json`), { noLink: true })
    if ('problem' in m && !m.missing) notes.push(`The moves file could not be read, so no moved-to file was read: ${m.problem}`)
    else if (!('problem' in m)) {
      const { to, problems } = movesOf(m.text)
      for (const p of problems) notes.push(`.jargone/moves/${rel}.json: ${p}.`)
      // Content moves to one file only, <name>-reference.md beside the document (principle 2), named by
      // that path as the method writes it: any other listed path is not read (the saved original in
      // .jargone/, or a copy elsewhere, would otherwise hide every loss), and neither is a link planted at
      // that name. J05 matches a heading moved there by the file's name alone (a limit noted in check.ts).
      // Limit: J05 counts whatever the file holds (SPEC section 4), so content it already held, or a copy
      // of the original written into it (a hard link too), still hides a loss; only the accuracy reviewer
      // would see that. Counting only what it gained since the original was saved needs a record of the
      // file taken at that moment, which the method does not keep yet.
      const allowed = referenceFileOf(rel)
      let allowedListed = false
      for (const t of to) {
        if (pathFrom(h.cwd, resolveTyped(h.cwd, t, h.posix)) === allowed) allowedListed = true
        else notes.push(`The moves file lists ${t}, but content moves only to ${allowed}, the reference file beside the document, so ${t} was not read.`)
      }
      if (allowedListed) {
        const r = await readText(h, under(h.cwd, allowed), { noLink: true })
        if ('problem' in r && r.link) notes.push(`The moved-to file ${allowed} is a link, not a file of its own, so it was not read and what moved there counts as lost: write the reference file as a regular file.`)
        else if ('problem' in r) notes.push(`The moved-to file ${allowed} could not be read, so what moved there counts as lost: ${r.problem}`)
        else moved.push({ path: allowed, text: r.text })
      }
    }
    const links = await inboundLinks(h, rel, doc.text)
    inbound = links.inbound
    notes.push(...links.notes)
  }

  const project = projectNameOf(h.cwd, rel)
  notes.push(project.name
    ? `The project's name was taken to be "${project.name}", the name of ${project.from}. J04 accepts it in the opening, and J01 and J07 treat it as a name. If that is wrong, add the right name to "known" in .jargone/glossary.json.`
    : `No project name was found (${project.from} has no name), so J04 accepts no name in the opening. Add the project's name to "known" in .jargone/glossary.json.`)
  const r = checkText({ text: doc.text, lists: theLists(), glossary, projectName: project.name || undefined, original, moved, inbound })
  return { rel, summary: r.summary, findings: r.findings, scores: r.scores, notes }
}

// ------------------------------------------------------------------------------- the /jargone skill

function header(reg: JargoneRegistered | undefined): string {
  // This module answers only CHECK, so a tool registered under any other name would never be answered.
  const tool = reg?.tool !== CHECK
    ? `The check tool did not register as \`${CHECK}\` in this session${reg?.tool ? ` (a tool registered as \`${reg.tool}\`, which nothing answers: do not call it)` : ''}. Do not search for it. Tell the person, check J01 to J05 by hand as step 3 of the method says, and give no readability scores.`
    : `Tool: \`${CHECK}\` { path } runs the code checks (J01 to J07) on a file in the working folder. It reads the glossary, the saved original, the moves file and the links to the file's headings from other Markdown files, and returns JSON with a summary, the findings, readability scores and notes. If it is not in your tool list, load it with ToolSearch ("jargone").`
  const agents = reg?.agents.length
    ? `Reviewer agents (read-only): ${reg.agents.map(a => `\`${a}\``).join(', ')}. ${reg.agents.length < LENSES.length ? 'For a reviewer without an agent, give its brief below to a general subagent.' : 'Their briefs are below, so you know what each checks.'}`
    : 'No reviewer agents registered: give each brief below to a general subagent, or do each as a separate pass yourself, labelled "self-review, not independent".'
  return ['# jargone in this session', '', tool, agents, 'The person can run the checks on a file at any time with /jargone-check <file>.'].join('\n')
}

/** prompt.md, the plugin's own file, read fresh each time; '' when it cannot be read. */
async function readPrompt($: EngineInterface): Promise<string> {
  return $.fs.read(`${$.plugin.root}/prompt.md`).then(t => String(t), () => '')
}

/**
 * Once after session mode is turned on, name the other instructions that shape replies: the output
 * style, and sections other plugins add. The sections are read from a composition through every
 * other hook (this one is skipped), so a plugin whose hook runs above jargone's is seen too; if that
 * composition fails, only what reached this hook is named, and the note says so.
 */
async function noticeOnce($: EngineInterface, e: PromptComposeInput, below: string[]): Promise<void> {
  const due = await $.state.get(NOTICE)
  if (due.value !== true) return
  if (!(await $.state.set(NOTICE, false, { ifVersion: due.version })).isSet) return
  let ids = below
  let partial = false
  try { ids = (await $.prompt.compose(e)).sections.map(s => s.id) } catch { partial = true }
  const plugins = [...new Set(ids.filter(id => /^[^:\s]+:\S/.test(id) && !id.startsWith('jargone:')))]
  const style = e.outputStyle?.name
  if (!style && !plugins.length) return
  const named = [
    ...(style ? [`the output style "${style}"`] : []),
    ...(plugins.length ? [`instructions from other plugins (${plugins.join(', ')})${partial ? ', and possibly others jargone could not see' : ''}`] : []),
  ]
  $.ui.log(`jargone: session mode is on. Other instructions also shape replies in this session: ${named.join(' and ')}. If they pull another way, you can turn them off; jargone never removes them.`)
}

// ----------------------------------------------------------------------------------- registration

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    theLists()
    await $.command.register({
      name: 'jargone-check',
      description: 'Run jargone\'s code checks on a file, and write the findings to .jargone/reports/<file>.check.md.',
      argumentHint: '<file>',
    }).catch(() => undefined)
    await $.command.register({
      name: 'jargone-voice',
      description: 'Plain replies for a named reader for the rest of the session: turn it on or off, or see whether it is on.',
      argumentHint: 'on for <reader> [--rewrite] [--ste-inspired] | off',
    }).catch(() => undefined)
    let tool: string | null = null
    try {
      tool = (await $.tool.register({
        name: 'check',
        description: 'Run jargone\'s code checks on a Markdown or plain-text file in the working folder. J01: a term used before it is defined. J02: one thing with two names (glossary pairs). J03: long sentences. J04: an uncommon word in the opening paragraph. J05 (only when an earlier /jargone saved the original in .jargone/originals/<file>): a number, code or link of the original that is in neither the file nor its reference file, <name>-reference.md beside it (counted when .jargone/moves/<file>.json lists that path and it is a file, not a link; other listed paths are not read), and links to the file\'s headings that no longer resolve. J07: a plainer word is available (a suggestion). Readability scores are for information only. Uses .jargone/glossary.json when present. Reads through the Read tool, so the person\'s permission settings apply. Returns JSON: summary, findings (code, severity, line, term, message, suggestion), scores, notes.',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string', description: 'The file to check: relative to the working folder, or absolute inside it.' } },
          required: ['path'],
        },
        isDeferred: false,
      })).tool
    } catch { /* the injected header then says the tool is missing */ }
    const md = await readPrompt($)
    const agents: string[] = []
    for (const lens of LENSES) {
      const prompt = section(md, `lens:${lens.name}`)
      if (!prompt) continue
      try { agents.push((await $.agent.register({ name: lens.name, description: lens.description, prompt, tools: [...lens.tools] })).agent) } catch { /* the header then says to brief a general subagent */ }
    }
    await $.state.set(REGISTERED, { tool, agents })
    return next(e)
  })

  on('skill.prompt', { skill: SKILL }, async ($, e, next) => {
    const r = await next(e)
    const asked = requestOf(r.text ?? e.text ?? '')
    const md = await readPrompt($)
    const method = section(md, 'method')
    const lenses = section(md, 'lenses')
    if (!method || !lenses) {
      return { ...r, text: `The jargone plugin is installed incorrectly: its method file (prompt.md) is missing or lacks its method or reviewer sections, so the method cannot run. Tell the person, and suggest reinstalling the plugin. What they asked for: ${asked || '(nothing given)'}` }
    }
    const head = asked
      ? `What to rewrite and for whom, as the person put it:\n\n${asked}`
      : 'Nothing was named. Ask the person which file to rewrite and who will read it, and wait for the answer.'
    const parts = [head, header((await $.state.get(REGISTERED)).value), method, lenses]
    const ste = asksSte(asked) ? section(md, 'ste') : null
    if (ste) parts.push(`## The ASD-STE100-inspired style instruction\n\n${ste}`)
    return { ...r, text: parts.join('\n\n') }
  })

  on('tool.call', { tool: CHECK }, async ($, e) => {
    const given = typeof e.path === 'string' ? argPath(e.path) : ''
    if (!given) return { deny: 'check needs { path }: the file to check, relative to the working folder.' }
    const h = await host($)
    const stop = await mayRun(h, { path: given }, `check ${given}`)
    if (stop) return { deny: `check: ${stop}` }
    const c = await runCheck(h, given)
    if ('problem' in c) return { deny: `check: ${c.problem}` }
    return { result: JSON.stringify({ file: c.rel, summary: c.summary, findings: c.findings, scores: c.scores, notes: c.notes }, null, 1) }
  }).catch(($, e, next) => ({ deny: `check crashed (${next.error.kind}): ${next.error.message ?? 'no message'}.` }))

  on('command.run', { command: 'jargone-check' }, async ($, e) => {
    const given = argPath(e.args)
    if (!given) return { text: 'jargone-check: name the file, for example /jargone-check README.md' }
    const h = await host($)
    const c = await runCheck(h, given)
    if ('problem' in c) return { text: `jargone-check: ${oneLine(c.problem)}` }
    const reportRel = `.jargone/reports/${c.rel}.check.md`
    const report = under(h.cwd, reportRel)
    const at = await $.clock.now()
    const said = `jargone-check ${oneLine(c.rel)}: ${c.summary}`
    const unwritten = (why: string) => ({ text: [`${said} The report ${oneLine(reportRel)} was not written: ${oneLine(why)}`, ...c.findings.map(f => `  Line ${f.line}, ${f.code} (${f.severity}): ${oneLine(f.message)}`)].join('\n') })
    // The Write tool will not replace a file this session has not read, so an earlier report is read first.
    // Only a report jargone wrote is replaced. A link is not written through (the Write tool would replace
    // what it points at), and a file that does not read as a jargone report is not replaced (a hard link to
    // the document looks like a plain file to every look, but holds the document's text). A write fails
    // closed: when no look could be had, the folder's listing must show nothing by that name.
    const earlier = await readText(h, report, { noLink: true })
    if ('problem' in earlier && earlier.link) return unwritten(`${reportRel} is a link, not a file of its own, so nothing was written through it.`)
    const entry = 'problem' in earlier && earlier.missing ? await listed(h, report) : undefined
    if (entry) return unwritten(`${reportRel} is there but could not be looked at${entry.isLink ? ', and it is a link' : ''}, so it was not replaced.`)
    if (!('problem' in earlier) && firstLine(earlier.text) !== reportHead(c.rel)) return unwritten(`${reportRel} does not read as the jargone check report for ${c.rel}, so it was not replaced. Move or delete it, then run the check again.`)
    if ('problem' in earlier && !earlier.missing) return unwritten(`an earlier report is there, and it could not be read before replacing it: ${earlier.problem}`)
    const w = await h.writeTool(report, checkReport(c.rel, at, c, c.notes))
    if (w.deny !== undefined || w.isError) return unwritten(clean(w.deny ?? w.text))
    return { text: `${said} Findings: ${oneLine(reportRel)}` }
  }).catch(($, e, next) => ({ text: oneLine(`jargone-check crashed (${next.error.kind}): ${next.error.message ?? 'no message'}.`) }))

  on('command.run', { command: 'jargone-voice' }, async ($, e) => {
    const a = parseVoice(e.args)
    const now = await $.state.get(VOICE)
    if (a.action === 'error') return { text: `jargone-voice: ${a.message}` }
    if (a.action === 'status') {
      const v = now.value
      return { text: voiceOn(v)
        ? `jargone-voice: on for ${v.reader}. Replies are checked and a note is shown after each; ${v.rewrite ? 'a reply that fails is rewritten once' : 'warn-only (no rewrites)'}; ASD-STE100-inspired style ${v.ste ? 'on' : 'off'}.`
        : `jargone-voice: off. ${VOICE_USAGE}` }
    }
    if (a.action === 'off') {
      const was = voiceOn(now.value)
      await $.state.set(VOICE, { on: false, reader: '', rewrite: false, ste: false, text: '' })
      await $.state.set(NOTICE, false)
      return { text: was ? 'jargone-voice: off.' : 'jargone-voice: already off.' }
    }
    const text = voiceText(await readPrompt($), a)
    if (!text) {
      return { text: `jargone-voice: the plugin is installed incorrectly: prompt.md lacks its ${a.ste ? 'voice or ste' : 'voice'} section, so session mode cannot run. Nothing was changed.` }
    }
    // turning it on reads the glossary afresh, so a refused or changed one is asked about now, not after a
    // reply; it is read first, so a failure here leaves session mode as it was
    const g = await glossaryForReplies($, await host($), true)
    await $.state.set(VOICE, { on: true, reader: a.reader, rewrite: a.rewrite, ste: a.ste, text })
    await $.state.set(NOTICE, true)
    return { text: oneLine(`jargone-voice: on for ${a.reader}. Each reply is checked, and a note is shown after it; ${a.rewrite ? 'a reply that fails is rewritten once (an extra model turn each time)' : 'warn-only'}${a.ste ? '; ASD-STE100-inspired style' : ''}.${g.notes.length ? ` Glossary: ${g.notes.join(' ')}` : ''}`) }
  }).catch(($, e, next) => ({ text: oneLine(`jargone-voice crashed (${next.error.kind}): ${next.error.message ?? 'no message'}.`) }))

  // The standing instruction, while session mode is on. A teammate's render of the lead's prompt is
  // left alone: session mode covers the main conversation, not other agents.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (e.traits.includes('teammate')) return r
    const v = (await $.state.get(VOICE)).value
    if (!voiceOn(v)) return r
    // /context measures the prompt (trait "analysis") and sends nothing, so it does not use up the notice.
    if (!e.traits.includes('analysis')) await noticeOnce($, e, r.sections.map(s => s.id))
    return { ...r, sections: [...r.sections.filter(s => s.id !== VOICE_ID), { id: VOICE_ID, text: v.text, scope: 'session' as const }] }
  }).catch(($, e, next) => next(e))

  // The check on each reply of the main conversation. The note goes to $.ui.log, a transcript line the
  // model is never sent. With --rewrite, a reply that fails is sent back once; the reply that answers
  // that request arrives with stop_hook_active set, and is never sent back again.
  on('classic.Stop', async ($, e, next) => {
    const r = await next(e)
    if (e.agent_id) return r
    const v = (await $.state.get(VOICE)).value
    if (!voiceOn(v)) return r
    const reply = e.last_assistant_message ?? ''
    if (!reply.trim()) return r
    const g = await glossaryForReplies($, await host($))
    const n = replyNote(reply, theLists(), g.glossary)
    const ask = v.rewrite && !n.ok && !e.stop_hook_active && r.block === undefined && r.preventContinuation === undefined
    const glossaryNote = g.notes.length ? ` Glossary: ${g.notes.join(' ')}` : ''
    $.ui.log(oneLine(`${ask ? `${n.note} (asked Claude to rewrite the reply once)` : n.note}${glossaryNote}`))
    return ask ? { ...r, block: rewriteRequest(v.reader, n.findings, n.more) } : r
  }).catch(($, e, next) => next(e))
}

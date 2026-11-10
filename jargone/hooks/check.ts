// jargone's checker: the checks SPEC.md section 4 runs in code (J01–J07), the short note on each
// reply in session mode (section 13), and the helpers session mode uses to filter the terms a model
// reader lists (`wordsOf`, `definedTerms`, `filterKnown`).
//
// Pure: no `$`, no file access. The caller passes in the text, the word lists and the glossary.
// One parser reads the document (`parse` below), as Markdown or as plain text. Every check,
// `anchorsOf`, `linksIn`, `wordsOf` and `definedTerms` read what it returns, so no two of them can
// disagree about what is code, a quotation, a link or a heading.
//
// Severity, and what "passes" means. J02 and J05 find errors, J03 finds warnings, and J01, J04 and J07
// find hints. A check passes when it has no errors (`passes`): that is the one definition. A hint is a
// candidate for the writer to judge, never an error and never a reason a check fails, because a word
// list cannot tell whether a reader knows a word (the 0.1 trial, on the lab branch claude/jargone-lab: 2026-10-31-trial/trial.md): a model briefed as
// the reader decides that.
//
// What counts as prose. Checks J01–J04 and J07 read prose only. Left out, with line numbers kept:
// front matter, fenced and indented code, `<pre>`, `<script>` and `<style>` blocks, HTML comments,
// inline code (and <code>/<kbd> elements), images, link targets (the link text is prose), reference
// definitions, autolinks and bare web addresses, HTML tags (text between tags is prose), and direct
// quotations: text inside “…” or "…" (a quotation inside a quotation stays inside it), inside ‘…’ or
// '…' on one line, and a `>` block quote. A GitHub alert (a `>` block that opens with `[!NOTE]`,
// `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`) is the writer's own note, so it is prose.
//
// Plain text (`format: 'text'`) has no Markdown: no code, headings, links, markup or block quotes. Each
// run of lines between blank lines is a paragraph; a line that starts with "-", "*", "+", "•", or a
// number and "." or ")", starts a list item, except that a numbered line other than 1 carries on a
// paragraph, as in Markdown; the first paragraph is the title when it is one line that does not end in
// punctuation. Only web addresses and quotations are left out of its prose.

export type Code = 'J01' | 'J02' | 'J03' | 'J04' | 'J05' | 'J06' | 'J07'
export type Severity = 'error' | 'warning' | 'hint'
export type Finding = {
  code: Code
  severity: Severity
  /** For J05's lost content, the line in the saved original; for every other finding, the line in the text checked. */
  line: number
  term?: string
  message: string
  suggestion?: string[]
}
export type Format = 'markdown' | 'text'
export type Scores = { flesch: number; grade: number; avgSentence: number; longestSentence: number; words: number; sentences: number }
export type Glossary = { known: string[]; same: string[][]; max_words: number; max_words_in_steps: number; cutoff: number }
export type Replacement = { from: string; to: string[]; source: string; unless?: string }
export type Lists = { familiarity: Map<string, number>; replacements: Replacement[]; exceptions: Set<string> }
export type CheckInput = {
  /** The document as it stands (for a rewrite, the rewrite). */
  text: string
  lists: Lists
  glossary?: Glossary
  /** The project's own name: J04 accepts it in the opening, and J01 and J07 treat it as a name. */
  projectName?: string
  /** The checks to run; all seven when left out. J05 runs only when `original` is given. */
  codes?: Code[]
  /** How `text` and `original` are read: as Markdown (the default) or as plain text. The caller takes it from the file's extension. */
  format?: Format
  /** The saved original (`.jargone/originals/<file>`), for J05 and the "before" scores. */
  original?: string
  /** The files listed in `.jargone/moves/<file>.json`, with their contents now. They are read as Markdown. */
  moved?: { path: string; text: string }[]
  /**
   * The moved-to file's text from before the rewrite ('' when it did not exist): J05 counts only what
   * that file gained since, so content it already held cannot stand in for content the rewrite lost.
   * It belongs with the saved original: when a later run keeps an earlier original, it keeps this too.
   * Left out, everything the file holds counts as gained, and the summary says so.
   */
  referenceBefore?: string
  /** Links to this document from other files in the repository; `fragment` is the part after `#`. */
  inbound?: { from: string; fragment?: string }[]
}

export const ALL_CODES: readonly Code[] = Object.freeze(['J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07'] as Code[])
const SEVERITY: Record<Code, Severity> = {
  J01: 'hint', J02: 'error', J03: 'warning', J04: 'hint', J05: 'error', J06: 'warning', J07: 'hint',
}

/** A check passes when it has no errors. Warnings and hints never make it fail. */
export function passes(findings: readonly Finding[]): boolean {
  return !findings.some(f => f.severity === 'error')
}

export const DEFAULT_GLOSSARY: Glossary = Object.freeze({
  known: Object.freeze([]) as unknown as string[],
  same: Object.freeze([]) as unknown as string[][],
  max_words: 30,
  max_words_in_steps: 20,
  cutoff: 6.0,
})

/**
 * Everyday acronyms that J01, J04 and J07 accept as known for every reader, as if they were in the
 * glossary's `known` list. They only quiet hints: they do not filter the terms a model reader lists.
 */
export const DEFAULT_KNOWN: string[] = Object.freeze([
  'AI', 'API', 'CSV', 'FAQ', 'GB', 'ID', 'KB', 'LLM', 'MB', 'OK', 'PDF', 'PR', 'README', 'UI', 'URL', 'USB',
]) as unknown as string[]

const GLOSSARY_FILE = '.jargone/glossary.json'

// ---------------------------------------------------------------------------------------------
// The glossary and the word lists

/**
 * Read `.jargone/glossary.json`. A field that is missing keeps its default; a field that is wrong
 * keeps its default and is named in `problems`, so a typo is reported rather than silently ignored.
 */
export function parseGlossary(json: string): { glossary: Glossary; problems: string[] } {
  const glossary: Glossary = { known: [], same: [], max_words: 30, max_words_in_steps: 20, cutoff: 6.0 }
  const problems: string[] = []
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (e) {
    return { glossary, problems: [`${GLOSSARY_FILE} is not valid JSON (${(e as Error).message}), so the defaults were used.`] }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { glossary, problems: [`${GLOSSARY_FILE} must be a JSON object such as {"known": ["API"]}, so the defaults were used.`] }
  }
  const o = raw as Record<string, unknown>
  for (const k of Object.keys(o)) {
    if (!['known', 'same', 'max_words', 'max_words_in_steps', 'cutoff'].includes(k)) problems.push(`"${k}" is not a glossary field, so it was ignored.`)
  }
  const isWord = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
  if (o.known !== undefined) {
    if (!Array.isArray(o.known)) problems.push('"known" must be a list of words, so it was ignored.')
    else {
      o.known.forEach((v, i) => {
        if (isWord(v)) glossary.known.push(v.trim())
        else problems.push(`"known" item ${i + 1} is not a word, so it was ignored.`)
      })
    }
  }
  if (o.same !== undefined) {
    if (!Array.isArray(o.same)) problems.push('"same" must be a list of groups such as [["job", "task"]], so it was ignored.')
    else {
      o.same.forEach((v, i) => {
        if (Array.isArray(v) && v.length >= 2 && v.every(isWord)) glossary.same.push(v.map(w => (w as string).trim()))
        else problems.push(`"same" group ${i + 1} must list two or more words, so it was ignored.`)
      })
    }
  }
  for (const k of ['max_words', 'max_words_in_steps'] as const) {
    if (o[k] === undefined) continue
    const v = o[k]
    if (typeof v === 'number' && Number.isInteger(v) && v > 0) glossary[k] = v
    else problems.push(`"${k}" must be a whole number above 0, so ${glossary[k]} was used.`)
  }
  if (o.cutoff !== undefined) {
    const v = o.cutoff
    if (typeof v === 'number' && v >= 1 && v <= 7) glossary.cutoff = v
    else problems.push(`"cutoff" must be a number from 1 to 7, so ${glossary.cutoff} was used.`)
  }
  return { glossary, problems }
}

/**
 * Build the lists from the three data strings (hooks/data.ts). They are generated and shipped with
 * the plugin, so a malformed line or entry throws instead of being skipped: a broken build must be
 * loud, not a quietly shorter list.
 */
export function loadLists(familiarityTsv: string, replacementsJson: string, exceptionsText: string): Lists {
  const familiarity = new Map<string, number>()
  familiarityTsv.replace(/\r\n?/g, '\n').split('\n').forEach((row, i) => {
    if (row.trim() === '' || row.startsWith('#')) return
    const [word, value] = row.split('\t')
    const rating = Number(value)
    if (i === 0 && !Number.isFinite(rating)) return // a header row
    if (!word?.trim() || value === undefined || value.trim() === '' || !Number.isFinite(rating) || rating < 1 || rating > 7) {
      throw new Error(`familiarity list, line ${i + 1}: expected "word<TAB>rating from 1 to 7", got ${JSON.stringify(row.slice(0, 60))}`)
    }
    const w = word.trim().toLowerCase()
    familiarity.set(w, Math.max(rating, familiarity.get(w) ?? 0))
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(replacementsJson)
  } catch (e) {
    throw new Error(`replacement list: not valid JSON (${(e as Error).message})`)
  }
  if (!Array.isArray(parsed)) throw new Error('replacement list: expected a JSON array of entries')
  const replacements: Replacement[] = parsed.map((r: Record<string, unknown>, i) => {
    const ok = r !== null && typeof r === 'object' && typeof r.from === 'string' && r.from.trim() !== '' &&
      Array.isArray(r.to) && r.to.every(t => typeof t === 'string') && typeof r.source === 'string' &&
      (r.unless === undefined || typeof r.unless === 'string')
    if (!ok) throw new Error(`replacement list, entry ${i + 1}: expected {"from": "...", "to": [...], "source": "...", "unless"?: "..."}`)
    const entry: Replacement = { from: (r.from as string).trim(), to: [...(r.to as string[])], source: r.source as string }
    if (typeof r.unless === 'string') entry.unless = r.unless
    return entry
  })
  const exceptions = new Set(
    exceptionsText.replace(/\r\n?/g, '\n').split('\n').map(l => l.trim().toLowerCase()).filter(l => l !== '' && !l.startsWith('#')),
  )
  return { familiarity, replacements, exceptions }
}

// ---------------------------------------------------------------------------------------------
// Comparing words: plural and verb endings
//
// A word is compared by a key. The key is the word's base form when one is in the familiarity list,
// or the word itself, passed through a small fixed rule (`crude`) so that forms of a word that is in
// no list ("kubelet", "kubelets") still share a key. The base forms tried, in order:
//   -ies → -y;  -es → drop "s", drop "es";  -s → drop "s" (not after s, u or i: "class", "status", "this")
//   -ied → -y;  -ed → drop "d", drop "ed", drop "ed" and one of a doubled last letter ("stopped")
//   -ing → drop "ing", drop "ing" and add "e", drop "ing" and one of a doubled last letter ("running")
// A base must keep at least 3 letters. A word counts as common when it, or any of its bases, is rated
// at or above the cut-off. A hyphenated word ("set-up") counts as common when each of its parts does,
// a prefix such as "re" in "re-run", or a single letter as in "e-mail", aside.
//
// `wordsOf`, `definedTerms` and `filterKnown` have no lists, so their key is `crude` alone: the same
// rule, so "kubelets" and "kubelet" still meet.

function bases(w: string): string[] {
  const out: string[] = []
  const add = (b: string) => {
    if (b.length >= 3 && b !== w && !out.includes(b)) out.push(b)
  }
  const undouble = (s: string) => {
    if (/([b-df-hj-np-tv-z])\1$/.test(s)) add(s.slice(0, -1))
  }
  if (w.endsWith('ies')) add(`${w.slice(0, -3)}y`)
  else if (w.endsWith('es')) {
    add(w.slice(0, -1))
    add(w.slice(0, -2))
  } else if (w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) add(w.slice(0, -1))
  if (w.endsWith('ied')) add(`${w.slice(0, -3)}y`)
  else if (w.endsWith('ed')) {
    add(w.slice(0, -1))
    add(w.slice(0, -2))
    undouble(w.slice(0, -2))
  }
  if (w.endsWith('ing')) {
    const s = w.slice(0, -3)
    add(s)
    add(`${s}e`)
    undouble(s)
  }
  return out
}

/** The fixed rule that gives every form of a word the same key, list or no list. */
function crude(w: string): string {
  let s = w
  if (s.length > 4 && /ie[sd]$/.test(s)) s = `${s.slice(0, -3)}y`
  else if (s.length >= 6 && s.endsWith('ing')) s = s.slice(0, -3)
  else if (s.length >= 5 && s.endsWith('ed')) s = s.slice(0, -2)
  else if (s.length >= 4 && s.endsWith('s') && !/(?:ss|us|is)$/.test(s)) s = s.slice(0, -1)
  if (s.length >= 4 && s.endsWith('e')) s = s.slice(0, -1)
  if (/([b-df-hj-np-tv-z])\1$/.test(s)) s = s.slice(0, -1)
  return s
}

const KEYS = new WeakMap<Lists, Map<string, string>>()

function keyOf(lists: Lists, lower: string): string {
  let cache = KEYS.get(lists)
  if (!cache) KEYS.set(lists, (cache = new Map()))
  let k = cache.get(lower)
  if (k === undefined) {
    const base = bases(lower).find(b => lists.familiarity.has(b))
    k = crude(base ?? lower)
    cache.set(lower, k)
  }
  return k
}

/** A prefix written with a hyphen ("re-run", "non-text"): a hyphenated word is common when the rest of it is. */
const PREFIXES = new Set(['re', 'pre', 'co', 'non', 'un', 'de', 'dis', 'sub', 'anti', 'multi', 'semi', 'mis', 'inter', 'intra', 'post', 'mid', 'ex', 'bi', 'tri'])

/** `alsoKnown` lets a part of a hyphenated word pass on another ground: the glossary, or the project's name. */
function isFamiliar(lists: Lists, lower: string, cutoff: number, alsoKnown: (part: string) => boolean = () => false): boolean {
  if ((lists.familiarity.get(lower) ?? 0) >= cutoff) return true
  if (bases(lower).some(b => (lists.familiarity.get(b) ?? 0) >= cutoff)) return true
  if (!lower.includes('-')) return false
  const parts = lower.split('-').filter(p => p !== '')
  return parts.length > 1 && parts.every((p, i) =>
    p.length === 1 || (i === 0 && PREFIXES.has(p)) || alsoKnown(p) || isFamiliar(lists, p, cutoff) ||
    (p.length > 2 && p.endsWith('s') && isFamiliar(lists, p.slice(0, -1), cutoff)))
}

// ---------------------------------------------------------------------------------------------
// Reading Markdown: blocks

const CODE = '\uE000' // an inline code span, in prose: one word, never a term
const CELL = '\uE001' // a table cell boundary: ends a sentence
const QUOTE = '\uE003' // a direct quotation, in prose: one word, never a term
const RAW = '\uE00F' // starts a term's key that is the term as written (`termKey`): no text holds it
const MARKS = /[\uE000-\uE00F]/g
// Text held aside while a heading's markup is read (code, an autolink's address), one character each.
const HOLD = 0xf0000
const HELD = /[\u{F0000}-\u{FFFFD}]/gu
const PRIVATE = /[\uE000-\uE00F\u{F0000}-\u{FFFFD}]/gu

type Line = { n: number; text: string }
type BlockKind = 'heading' | 'para' | 'item' | 'table'
type Block = {
  kind: BlockKind
  lines: Line[]
  /** A step of a numbered procedure (`stepItem`), or a paragraph inside one: J03's limit there is `max_words_in_steps`. */
  step: boolean
  level: number
  /** An HTML heading: a title for J04, but not a heading GitHub gives an anchor. */
  html: boolean
  /** Inside a `>` block quote (not a GitHub alert): a quotation, so not prose. */
  quote: boolean
  /** Inside a GitHub alert (`> [!NOTE]` …): prose, but not the document's opening. */
  alert: boolean
  /** A table's header row: column headings, so not sentences for J03 or the scores. */
  head: boolean
}
type Def = { target: string; line: number }
type CodeText = { text: string; line: number }

const block = (kind: BlockKind, lines: Line[], more: Partial<Block> = {}): Block =>
  ({ kind, lines, step: false, level: 0, html: false, quote: false, alert: false, head: false, ...more })

function width(s: string): number {
  let w = 0
  for (const ch of s) {
    if (ch === ' ') w++
    else if (ch === '\t') w += 4 - (w % 4)
    else break
  }
  return w
}

function dedent(s: string, cols: number): string {
  let w = 0
  let k = 0
  while (k < s.length && w < cols && (s[k] === ' ' || s[k] === '\t')) {
    w += s[k] === '\t' ? 4 - (w % 4) : 1
    k++
  }
  return s.slice(k)
}

function unquote(s: string): { text: string; depth: number } {
  let text = s
  let depth = 0
  for (;;) {
    const m = /^[ \t]{0,3}> ?/.exec(text)
    if (!m) return { text, depth }
    text = text.slice(m[0].length)
    depth++
  }
}

function trimBlankLines(ls: string[]): string[] {
  let a = 0
  let b = ls.length
  while (a < b && !ls[a].trim()) a++
  while (b > a && !ls[b - 1].trim()) b--
  return ls.slice(a, b)
}

const normLabel = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

function cellsOf(row: string): string[] {
  let r = row.trim()
  if (r.startsWith('|')) r = r.slice(1)
  if (r.endsWith('|') && !r.endsWith('\\|')) r = r.slice(0, -1)
  return r.split(/(?<!\\)\|/)
}

const DELIMITER_ROW = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/
const ALERT = /^\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/i
/**
 * A line that starts a block of its own, so it cannot be the lazy continuation of a quoted paragraph
 * (CommonMark tests it outside the quotation): a heading, a fence, a thematic break, a list item of
 * any number, or an HTML block of types 1 to 6. An inline tag or an autolink does not.
 */
const INTERRUPTS = new RegExp('^[ \\t]{0,3}(?:#{1,6}(?:[ \\t]|$)|`{3,}|~{3,}|(?:[-*+]|\\d{1,9}[.)])(?:[ \\t]|$)|([-*_])(?:[ \\t]*\\1){2,}[ \\t]*$|' +
  '<(?:script|pre|style|textarea)(?:[\\s>]|$)|<!--|<\\?|<![A-Za-z]|<!\\[CDATA\\[|' +
  '</?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|' +
  'fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|' +
  'menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[\\s/>]|$))', 'i')

/**
 * Verbs in their base form that open a step of a procedure ("Open the file", "Then run the tests").
 * A numbered item is a step, and J03 holds it to `max_words_in_steps`, only when it opens with one of
 * these, after markup and after at most one of the words in SEQUENCE. A numbered list of findings,
 * questions or options is not a procedure, so it keeps the 30-word limit. A word that is both a verb
 * and a noun ("Test results …") still counts: the rule is a fixed list, not a reading of the sentence.
 */
const STEP_VERBS = new Set(`
add allow apply approve ask assign attach back build call cancel change check choose clean clear click clone close
commit compare configure confirm connect copy create cut define delete deploy describe disable download drag drop
edit enable enter export extract fill find fix follow get give go grant hold import include insert install keep
launch leave let list load locate log look make mark measure merge move name navigate note open paste pick place
press print pull push put read rebase reboot record refresh reload remove rename repeat replace reply request rerun
reset restart restore retry return revert review run save scroll search see select send set share show sign start
stop store submit switch take tap tell test tick try turn type uncheck uninstall unzip update upgrade upload use
verify view visit wait watch write`.trim().split(/\s+/))
const SEQUENCE = new Set(['first', 'second', 'third', 'then', 'next', 'now', 'finally', 'lastly', 'last', 'also'])

/** Does this numbered item's text open with a verb of STEP_VERBS? */
function stepItem(text: string): boolean {
  const t = text.trimStart()
  if (t.startsWith('`')) return false
  const rest = t.replace(/^[*_~[("“‘'\s]+/, '')
  const first = /^\p{L}+(?:-\p{L}+)*/u.exec(rest)?.[0]
  if (!first) return false
  if (STEP_VERBS.has(first.toLowerCase())) return true
  if (!SEQUENCE.has(first.toLowerCase())) return false
  const second = /^[*_~\]),:\s]*(\p{L}+(?:-\p{L}+)*)/u.exec(rest.slice(first.length))?.[1]
  return !!second && STEP_VERBS.has(second.toLowerCase())
}

type Blocks = { blocks: Block[]; code: CodeText[]; defs: Map<string, Def>; defList: Def[] }

function parseBlocks(md: string): Blocks {
  const lines = md.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(PRIVATE, ' ').split('\n')
  const blocks: Block[] = []
  const code: CodeText[] = []
  const defs = new Map<string, Def>()
  const defList: Def[] = []
  let cur: Block | null = null
  let curDepth = 0
  // a `>` block: the depth of the GitHub alert now open (0 for none; GitHub opens one only at depth 1),
  // whether the line before was its "[!NOTE]" line, and the depth of the line before
  let alertDepth = 0
  let afterMarker = false
  let prevDepth = 0
  const lists: { indent: number; content: number; step: boolean }[] = []
  let indented: { lines: string[]; line: number; at: number } | null = null
  const flush = () => {
    if (cur) blocks.push(cur)
    cur = null
  }
  const endIndented = () => {
    if (indented) code.push({ text: trimBlankLines(indented.lines).join('\n'), line: indented.line })
    indented = null
  }

  let i = 0
  if (lines.length > 1 && /^(?:---|\+\+\+)[ \t]*$/.test(lines[0])) {
    const close = lines[0].startsWith('+') ? /^\+\+\+[ \t]*$/ : /^(?:---|\.\.\.)[ \t]*$/
    for (let j = 1; j < lines.length; j++) {
      if (close.test(lines[j])) {
        i = j + 1
        break
      }
    }
  }

  for (; i < lines.length; i++) {
    const { text: body, depth } = unquote(lines[i])
    // a line without all its ">" marks that carries on a quoted paragraph belongs to it (CommonMark's
    // lazy continuation), so it stays inside the quotation
    const carries = depth < prevDepth && body.trim() !== '' && !INTERRUPTS.test(body)
    const lazyQuote = carries && cur !== null && depth < curDepth && (cur.kind === 'para' || cur.kind === 'item')
    // the alert's text may start on a line without its ">", right after the "[!NOTE]" line
    const lazyAlert = carries && afterMarker
    // the line right after "[!NOTE]" carries on the marker's paragraph, so it is never indented code
    const afterAlertMarker = afterMarker
    afterMarker = false
    // the depth the line belongs to: a lazy line keeps the depth it carries on
    const at = lazyQuote ? curDepth : lazyAlert ? alertDepth : depth
    const opensQuote = depth > 0 && prevDepth === 0
    prevDepth = at
    if (at === 0) alertDepth = 0
    if (body.trim() === '') {
      flush()
      if (indented) indented.lines.push('')
      continue
    }
    if (opensQuote && depth === 1 && ALERT.test(body.trim())) {
      flush()
      alertDepth = depth
      afterMarker = true
      continue
    }
    // inside an alert, only a deeper `>` is a quotation
    const quote = at > alertDepth
    const inAlert = alertDepth > 0 && at >= alertDepth
    const indent = width(body)
    if (indented) {
      if (indent >= indented.at) {
        indented.lines.push(dedent(body, indented.at))
        continue
      }
      endIndented()
    }

    // fenced code (any indentation, so a fence inside a list item is found)
    const fence = /^([ \t]*)(`{3,}|~{3,})(.*)$/.exec(body)
    if (fence && !(fence[2][0] === '`' && fence[3].includes('`'))) {
      flush()
      const ch = fence[2][0]
      const len = fence[2].length
      const pad = width(fence[1])
      const content: string[] = []
      let j = i + 1
      for (; j < lines.length; j++) {
        const inner = depth > 0 ? unquote(lines[j]).text : lines[j]
        const close = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(inner)
        if (close && close[1][0] === ch && close[1].length >= len) break
        content.push(dedent(inner, pad))
      }
      code.push({ text: content.join('\n'), line: i + 1 })
      i = j
      continue
    }

    // HTML comments and raw blocks
    if (/^[ \t]*<!--/.test(body) && !body.includes('-->')) {
      flush()
      let j = i + 1
      while (j < lines.length && !lines[j].includes('-->')) j++
      i = j
      continue
    }
    const raw = /^[ \t]*<(pre|script|style|textarea)\b/i.exec(body)
    if (raw) {
      flush()
      const close = new RegExp(`</${raw[1]}[ \\t]*>`, 'i')
      let j = i
      while (j < lines.length && !close.test(lines[j])) j++
      const end = Math.min(j, lines.length - 1)
      if (raw[1].toLowerCase() === 'pre') {
        code.push({ text: lines.slice(i, end + 1).join('\n').replace(/<\/?pre\b[^>]*>/gi, '').replace(/^\n+|\n+$/g, ''), line: i + 1 })
      }
      i = end
      continue
    }

    const sameDepth = cur !== null && curDepth === depth
    const lazy = sameDepth || lazyQuote
    const item = /^([ \t]*)([-*+]|\d{1,9}[.)])(?=[ \t]|$)([ \t]*)/.exec(body)
    if (!lazy && !item) while (lists.length && indent < lists[lists.length - 1].content) lists.pop()
    const owner = lists[lists.length - 1]

    // indented code: cannot interrupt a paragraph; inside a list item it starts 4 columns past the item's text
    const codeAt = owner ? owner.content + 4 : 4
    if (!lazy && !(afterAlertMarker && at === alertDepth) && indent >= codeAt) {
      flush()
      indented = { lines: [dedent(body, codeAt)], line: i + 1, at: codeAt }
      continue
    }

    // setext heading underline, then thematic break
    if (sameDepth && cur!.kind === 'para' && /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(body)) {
      cur!.kind = 'heading'
      cur!.level = body.trim()[0] === '=' ? 1 : 2
      cur!.step = false
      flush()
      continue
    }
    if (/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(body)) {
      flush()
      continue
    }

    // ATX heading
    const atx = /^[ \t]*(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/.exec(body)
    if (atx && (indent <= 3 || lists.length)) {
      flush()
      blocks.push(block('heading', [{ n: i + 1, text: atx[2] ?? '' }], { level: atx[1].length, quote, alert: inAlert }))
      continue
    }
    // an HTML heading on one line: a title for J04, but not a heading GitHub gives an anchor
    const hh = /^[ \t]*<h([1-6])\b[^>]*>(.*?)<\/h\1>[ \t]*$/i.exec(body)
    if (hh) {
      flush()
      blocks.push(block('heading', [{ n: i + 1, text: body.trim() }], { level: Number(hh[1]), html: true, quote, alert: inAlert }))
      continue
    }

    // reference definition: [label]: target
    const def = lazy ? null : /^[ \t]{0,3}\[([^\]^][^\]]*)\]:[ \t]*(?:<([^>]*)>|(\S+))/.exec(body)
    if (def) {
      flush()
      const d = { target: def[2] ?? def[3], line: i + 1 }
      if (!defs.has(normLabel(def[1]))) defs.set(normLabel(def[1]), d)
      defList.push(d)
      // its title may stand alone on the next line
      const rest = body.slice(def[0].length)
      if (!rest.trim() && i + 1 < lines.length && /^[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\))[ \t]*$/.test(unquote(lines[i + 1]).text)) i++
      continue
    }

    // table: a header row, a delimiter row with as many cells, then rows
    if (body.includes('|') && i + 1 < lines.length) {
      const next = unquote(lines[i + 1]).text
      if (DELIMITER_ROW.test(next) && cellsOf(next).length === cellsOf(body).length) {
        flush()
        let j = i
        for (; j < lines.length; j++) {
          if (j === i + 1) continue
          const row = unquote(lines[j]).text
          if (row.trim() === '' || !row.includes('|')) break
          blocks.push(block('table', [{ n: j + 1, text: row }], { quote, alert: inAlert, head: j === i }))
        }
        i = j - 1
        continue
      }
    }

    // list item (an ordered item interrupts a paragraph only when it starts at 1, as in CommonMark)
    if (item && !(lazy && cur!.kind === 'para' && /^\d/.test(item[2]) && Number.parseInt(item[2], 10) !== 1)) {
      flush()
      const markAt = width(item[1])
      while (lists.length && lists[lists.length - 1].indent >= markAt) lists.pop()
      const gap = width(item[1] + item[2] + item[3]) - width(item[1] + item[2])
      const content = markAt + item[2].length + (gap >= 1 && gap <= 4 ? gap : 1)
      const text = body.slice(item[0].length)
      const step = /\d/.test(item[2]) && stepItem(text)
      lists.push({ indent: markAt, content, step })
      cur = block('item', [{ n: i + 1, text }], { step, quote, alert: inAlert })
      curDepth = at
      continue
    }

    // paragraph text; a footnote definition's text is prose
    let text = body.trim()
    if (lazy) {
      cur!.lines.push({ n: i + 1, text })
      continue
    }
    flush()
    const foot = /^\[\^[^\]]+\]:[ \t]*/.exec(text)
    if (foot) text = text.slice(foot[0].length)
    // a paragraph inside a list item belongs to that item: a step's further paragraphs are the step too
    cur = block(owner ? 'item' : 'para', [{ n: i + 1, text }], { step: owner?.step ?? false, quote, alert: inAlert })
    curDepth = at
  }
  flush()
  endIndented()
  return { blocks, code, defs, defList }
}

/** Plain text: paragraphs between blank lines, list items, and a title line; no Markdown. */
function parseTextBlocks(text: string): Blocks {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(PRIVATE, ' ').split('\n')
  const blocks: Block[] = []
  let cur: Block | null = null
  const flush = () => {
    if (cur) blocks.push(cur)
    cur = null
  }
  lines.forEach((line, i) => {
    if (line.trim() === '') return flush()
    const item = /^[ \t]*([-*+•]|\d{1,9}[.)])[ \t]+(?=\S)/.exec(line)
    // as in Markdown, a numbered line interrupts a paragraph only when it is 1: "The limit is\n30. After …" is one paragraph
    if (item && !(cur?.kind === 'para' && /^\d/.test(item[1]) && Number.parseInt(item[1], 10) !== 1)) {
      flush()
      const rest = line.slice(item[0].length)
      cur = block('item', [{ n: i + 1, text: rest.trim() }], { step: /\d/.test(item[1]) && stepItem(rest) })
    } else if (cur) cur.lines.push({ n: i + 1, text: line.trim() })
    else cur = block('para', [{ n: i + 1, text: line.trim() }])
  })
  flush()
  const first = blocks[0]
  if (first?.kind === 'para' && first.lines.length === 1 && !/[.!?:;,…]["'”’)\]]*$/.test(first.lines[0].text)) {
    first.kind = 'heading'
    first.level = 1
  }
  return { blocks, code: [], defs: new Map(), defList: [] }
}

// ---------------------------------------------------------------------------------------------
// Reading Markdown: inline text

const NUMBER = /\d+(?:[.,]\d+)*/g

function newlines(s: string): number {
  let n = 0
  for (let j = 0; j < s.length; j++) if (s.charCodeAt(j) === 10) n++
  return n
}
const keepNl = (s: string, fill: string) => fill + '\n'.repeat(newlines(s))

/** Index of the first value in a sorted list at or after `k`; the list's length when there is none. */
function firstAtOrAfter(sorted: ArrayLike<number>, k: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < k) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Positions of a character (or a short string) in `s`, in order. */
function positionsOf(s: string, ch: string): number[] {
  const at: number[] = []
  for (let k = s.indexOf(ch); k >= 0; k = s.indexOf(ch, k + 1)) at.push(k)
  return at
}

/** The first position in a sorted list at or after `k`, or undefined. */
const nextIn = (sorted: number[], k: number): number | undefined => sorted[firstAtOrAfter(sorted, k)]

/**
 * How many newlines come before a position of `s`. The newlines are found once and each answer is a
 * binary search, so a long paragraph with many links or numbers is read in one pass, not one per link.
 */
function lineIndex(s: string): (k: number) => number {
  const at = positionsOf(s, '\n')
  return k => firstAtOrAfter(at, k)
}

function escapedAt(s: string, i: number): boolean {
  let b = 0
  for (let j = i - 1; j >= 0 && s[j] === '\\'; j--) b++
  return b % 2 === 1
}

type Sink = { target(t: string, nl: number): void; span(c: string, nl: number): void; id(id: string): void }
const NO_SINK: Sink = { target() {}, span() {}, id() {} }

/**
 * Inline code spans and HTML comments, which start wherever they open first (CommonMark): so a
 * comment inside a code span is code, and a code span inside a comment is part of the comment. A run
 * of backticks opens a span that the next run of the same length closes, within one table cell; a
 * backslash before a run makes its first backtick plain text. A comment runs from `<!--` to `-->`.
 * Prose: each span becomes one CODE mark and a comment a space; plain: a span is held aside
 * (`hold`), and a comment goes.
 */
function maskCode(s: string, sink: Sink, plain: boolean, hold: (t: string) => string): string {
  const ticks = s.includes('`')
  const comments = s.includes('<!--') ? positionsOf(s, '<!--').filter(k => !escapedAt(s, k)) : []
  if (!ticks && !comments.length) return s
  const runs: { at: number; len: number; escaped: boolean }[] = []
  for (let k = s.indexOf('`'); k >= 0; k = s.indexOf('`', k)) {
    let e = k
    while (s[e] === '`') e++
    runs.push({ at: k, len: e - k, escaped: escapedAt(s, k) })
    k = e
  }
  const byLen = new Map<number, number[]>()
  runs.forEach((r, idx) => {
    const list = byLen.get(r.len)
    if (list) list.push(idx)
    else byLen.set(r.len, [idx])
  })
  const closes = comments.length ? positionsOf(s, '-->') : []
  const cells = positionsOf(s, CELL)
  const nlAt = lineIndex(s)
  let out = ''
  let pos = 0
  let r = 0
  let ci = 0
  for (;;) {
    while (r < runs.length && runs[r].at < pos) r++
    while (ci < comments.length && comments[ci] < pos) ci++
    const comment = comments[ci]
    // the first run before the next comment that opens a span
    let span: { at: number; len: number; close: number; q: number } | undefined
    for (; r < runs.length && (comment === undefined || runs[r].at < comment); r++) {
      const at = runs[r].escaped ? runs[r].at + 1 : runs[r].at
      const len = runs[r].escaped ? runs[r].len - 1 : runs[r].len
      if (len === 0) continue
      const same = byLen.get(len) ?? []
      const q = same[firstAtOrAfter(same, r + 1)]
      if (q === undefined) continue
      const close = runs[q].at
      const cell = nextIn(cells, at)
      if (cell !== undefined && cell < close) continue
      span = { at, len, close, q }
      break
    }
    if (span) {
      const raw = s.slice(span.at + span.len, span.close)
      let content = raw.replace(/\n/g, ' ')
      if (/^ [\s\S]*[^ ][\s\S]* $/.test(content)) content = content.slice(1, -1)
      sink.span(content, nlAt(span.at))
      out += s.slice(pos, span.at) + (plain ? hold(content) : keepNl(raw, CODE))
      pos = span.close + span.len
      r = span.q + 1
      continue
    }
    if (comment === undefined) break
    const end = nextIn(closes, comment + 4)
    ci++
    if (end === undefined) continue // never closed: not a comment
    out += s.slice(pos, comment) + keepNl(s.slice(comment, end + 3), plain ? '' : ' ')
    pos = end + 3
  }
  return out + s.slice(pos)
}

/** For each "[", the position of its matching "]" (or -1), found in one pass; a pair never spans a table cell. */
function bracketPairs(s: string): Int32Array {
  const pair = new Int32Array(s.length).fill(-1)
  const open: number[] = []
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (c === CELL) open.length = 0
    else if (c === '\\') k++
    else if (c === '[') open.push(k)
    else if (c === ']' && open.length) pair[open.pop()!] = k
  }
  return pair
}

/**
 * For each position, where a link destination written without `<…>` and starting there would end:
 * at the first ")" that closes no "(" opened since, or at the first space, line break or table cell,
 * or at the end. A backslash keeps the next character from ending it. Found for every position in one
 * pass, so a text with many unclosed "](" is read in linear time, not once to its end per "](".
 */
function bareEnds(s: string): Int32Array {
  const n = s.length
  const ends = new Int32Array(n + 1).fill(n)
  const starts: number[] = []
  const depths: number[] = []
  let d = 0
  for (let k = 0; k < n; k++) {
    const c = s[k]
    starts.push(k)
    depths.push(d)
    if (c === CELL || /\s/.test(c)) {
      while (starts.length) {
        ends[starts.pop()!] = k
        depths.pop()
      }
      d = 0
    } else if (c === '\\') {
      if (k + 1 < n) {
        k++
        starts.push(k)
        depths.push(d)
      }
    } else if (c === '(') d++
    else if (c === ')') {
      while (starts.length && depths[depths.length - 1] >= d) {
        ends[starts.pop()!] = k
        depths.pop()
      }
      d--
    }
  }
  return ends
}

type DestIndex = { ends: Int32Array; gt: number[]; dq: number[]; sq: number[]; rp: number[] }

function destIndex(s: string): DestIndex {
  return { ends: bareEnds(s), gt: positionsOf(s, '>'), dq: positionsOf(s, '"'), sq: positionsOf(s, "'"), rp: positionsOf(s, ')') }
}

/** A link destination after `](`: `<...>` or a run without spaces and with balanced brackets, then an optional title. */
function destination(s: string, p: number, ix: DestIndex): { target: string; end: number } | null {
  let k = p + 1
  while (s[k] === ' ' || s[k] === '\t' || s[k] === '\n') k++
  let target: string
  if (s[k] === '<') {
    const e = nextIn(ix.gt, k)
    if (e === undefined) return null
    target = s.slice(k + 1, e)
    k = e + 1
  } else {
    const e = ix.ends[k]
    target = s.slice(k, e)
    k = e
  }
  while (s[k] === ' ' || s[k] === '\t' || s[k] === '\n') k++
  if (s[k] === '"' || s[k] === "'" || s[k] === '(') {
    const e = nextIn(s[k] === '(' ? ix.rp : s[k] === '"' ? ix.dq : ix.sq, k + 1)
    if (e === undefined) return null
    k = e + 1
    while (s[k] === ' ' || s[k] === '\t' || s[k] === '\n') k++
  }
  if (s[k] !== ')') return null
  return { target, end: k + 1 }
}

/**
 * Images (`image`) or links. An image goes entirely (to `imageFill`). A link keeps its text ('keep')
 * or loses it ('drop'); its target goes to the sink.
 */
function maskLinks(s: string, defs: Map<string, Def>, image: boolean, mode: 'keep' | 'drop', sink: Sink, imageFill = ' '): string {
  if (!s.includes('[')) return s
  let out = ''
  const pair = bracketPairs(s)
  const nlAt = lineIndex(s)
  const closers = positionsOf(s, ']')
  let ix: DestIndex | undefined
  let i = 0
  while (i < s.length) {
    const opens = image ? s[i] === '!' && s[i + 1] === '[' : s[i] === '['
    if (!opens || escapedAt(s, i)) {
      out += s[i++]
      continue
    }
    const lb = image ? i + 1 : i
    if (!image && s[lb + 1] === '^') {
      const e = nextIn(closers, lb)
      if (e !== undefined && !s.slice(lb, e).includes(CELL)) {
        out += keepNl(s.slice(i, e + 1), ' ')
        i = e + 1
        continue
      }
    }
    const rb = pair[lb]
    if (rb < 0) {
      out += s[i++]
      continue
    }
    const text = s.slice(lb + 1, rb)
    let end = -1
    let target: string | undefined
    let inline = false
    if (s[rb + 1] === '(') {
      const d = destination(s, rb + 1, (ix ??= destIndex(s)))
      if (d) {
        end = d.end
        target = d.target
        inline = true
      }
    }
    if (end < 0 && s[rb + 1] === '[') {
      const e = nextIn(closers, rb + 2)
      if (e !== undefined) {
        const d = defs.get(normLabel(s.slice(rb + 2, e) || text))
        if (d) {
          end = e + 1
          target = d.target
        }
      }
    }
    if (end < 0) {
      const d = defs.get(normLabel(text))
      if (d) {
        end = rb + 1
        target = d.target
      }
    }
    if (end < 0) {
      out += s[i++]
      continue
    }
    if (inline && target !== undefined) sink.target(target, nlAt(i))
    if (image) out += keepNl(s.slice(i, end), imageFill)
    else if (mode === 'drop') out += keepNl(s.slice(i, end), ' ')
    else out += keepNl(s.slice(i, lb + 1), '') + text + keepNl(s.slice(rb, end), '')
    i = end
  }
  return out
}

const AUTOLINK = /<((?:[A-Za-z][A-Za-z0-9+.-]{1,31}):[^\s<>]*|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)>/g
const TAG = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g
// an attribute named exactly href, src, id or name: not data-src or data-id
const ATTR = /(?<![\w-])(href|src|id|name)[ \t]*=[ \t]*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi
const BARE_URL = /(?<![\w/])(?:https?:\/\/|www\.)[^\s<>\uE000-\uE00F]*[^\s<>.,;:!?'")\]\uE000-\uE00F]/g
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
}
const MARKUP_ESCAPES = new Set(['[', ']', '(', ')', '<', '>', '"', "'", '!', '`', '|'])

function decodeEntities(s: string): string {
  return s.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m
    const cp = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10)
    if (!(cp > 0 && cp <= 0x10ffff)) return m
    const ch = String.fromCodePoint(cp)
    return /[\uE000-\uE00F\n]/.test(ch) || (cp >= 0xf0000 && cp <= 0xffffd) ? ' ' : ch
  })
}

function maskHtml(s: string, sink: Sink, fill: string): string {
  let nlAt: ((k: number) => number) | undefined
  return s.replace(TAG, (m: string, off: number) => {
    for (const a of m.matchAll(ATTR)) {
      const v = a[2] ?? a[3] ?? a[4] ?? ''
      if (/^(?:href|src)$/i.test(a[1])) sink.target(v, (nlAt ??= lineIndex(s))(off))
      else if (v) sink.id(v)
    }
    return keepNl(m, fill)
  })
}

const CODE_ELEMENT = /<(code|kbd|samp|var|tt)\b[^>]*>([\s\S]*?)<\/\1[ \t]*>/gi

/**
 * The text emphasis renders to, for a heading's anchor: the runs of `*`, `_` and `~` that open or
 * close emphasis or strikethrough are removed, by CommonMark's delimiter rules (and GitHub's for `~`:
 * one or two, matched by length). So `_Setup_ guide` reads "Setup guide", while the underscores of
 * `snake_case` stay. Text held aside (code) counts as a letter here and is never markup.
 */
function stripEmphasis(t: string): string {
  if (!/[*_~]/.test(t)) return t
  type D = { ch: string; at: number; len: number; orig: number; open: boolean; close: boolean }
  const ds: D[] = []
  const space = (c: string | undefined) => c === undefined || /\s/.test(c)
  const punct = (c: string | undefined) => c !== undefined && /[\p{P}\p{S}]/u.test(c)
  for (let k = 0; k < t.length;) {
    const c = t[k]
    if ((c !== '*' && c !== '_' && c !== '~') || escapedAt(t, k)) {
      k++
      continue
    }
    let e = k
    while (t[e] === c) e++
    const before = t[k - 1]
    const after = t[e]
    const left = !space(after) && (!punct(after) || space(before) || punct(before))
    const right = !space(before) && (!punct(before) || space(after) || punct(after))
    const len = e - k
    if (!(c === '~' && len > 2)) {
      ds.push({
        ch: c, at: k, len, orig: len,
        open: c === '_' ? left && (!right || punct(before)) : left,
        close: c === '_' ? right && (!left || punct(after)) : right,
      })
    }
    k = e
  }
  const n = ds.length
  const prev = Int32Array.from({ length: n }, (_, i) => i - 1)
  const next = Int32Array.from({ length: n }, (_, i) => i + 1)
  const unlink = (i: number) => {
    if (prev[i] >= 0) next[prev[i]] = next[i]
    if (next[i] < n) prev[next[i]] = prev[i]
  }
  const drop = new Uint8Array(t.length)
  // where the search for an opener may stop, by kind of closer: CommonMark's "openers_bottom"
  const bottom = new Map<string, number>()
  let ci = 0
  while (ci < n) {
    const cl = ds[ci]
    if (!cl.close || cl.len === 0) {
      ci = next[ci]
      continue
    }
    const kind = `${cl.ch}${cl.orig % 3}${cl.open ? 1 : 0}`
    const floor = bottom.get(kind) ?? -1
    let oi = prev[ci]
    for (; oi > floor; oi = prev[oi]) {
      const op = ds[oi]
      if (op.ch !== cl.ch || !op.open || op.len === 0) continue
      const fits = cl.ch === '~'
        ? op.len === cl.len
        : !((op.close || cl.open) && (op.orig + cl.orig) % 3 === 0 && !(op.orig % 3 === 0 && cl.orig % 3 === 0))
      if (fits) break
    }
    if (oi <= floor) {
      bottom.set(kind, prev[ci])
      const nx = next[ci]
      if (!cl.open) unlink(ci)
      ci = nx
      continue
    }
    const op = ds[oi]
    const use = cl.ch === '~' ? cl.len : op.len >= 2 && cl.len >= 2 ? 2 : 1
    for (let x = op.at + op.len - use; x < op.at + op.len; x++) drop[x] = 1
    for (let x = cl.at; x < cl.at + use; x++) drop[x] = 1
    op.len -= use
    cl.at += use
    cl.len -= use
    // the delimiters between the two can no longer match anything
    next[oi] = ci
    prev[ci] = oi
    if (op.len === 0) unlink(oi)
    if (cl.len === 0) {
      const nx = next[ci]
      unlink(ci)
      ci = nx
    }
  }
  let out = ''
  for (let x = 0; x < t.length; x++) if (!drop[x]) out += t[x]
  return out
}

/**
 * Direct quotations: “…”, "…", ‘…’, and '…' on one line. Each becomes one QUOTE mark. Quotation
 * marks are paired as brackets are, so a quotation inside a quotation stays inside it:
 * `"he wrote "80% of the way" and stopped"` is one quotation.
 */
function maskQuotes(s: string, quotes: string[]): string {
  if (!/["'“‘]/.test(s)) return s
  const opensAfter = (k: number) => k === 0 || /[\s([{—–\-/\uE000-\uE00F]/.test(s[k - 1])
  const letterAt = (k: number) => /[\p{L}\p{N}]/u.test(s[k] ?? '')
  const spaceAt = (k: number) => /\s/.test(s[k] ?? ' ')
  // A closing straight quote has no space before it, and a closing straight or single quote no letter
  // after it (so "don't" closes nothing). A quotation stops at a table cell; one in straight single
  // quotes also stops at the line's end.
  const kinds: Record<string, { opens(k: number): boolean; closes(k: number): boolean }> = {
    '"': { opens: k => opensAfter(k) && !spaceAt(k + 1), closes: k => !spaceAt(k - 1) && !letterAt(k + 1) },
    '“': { opens: () => true, closes: () => false },
    '”': { opens: () => false, closes: () => true },
    '‘': { opens: k => opensAfter(k), closes: () => false },
    '’': { opens: () => false, closes: k => !letterAt(k + 1) },
    "'": { opens: k => opensAfter(k) && letterAt(k + 1), closes: k => !spaceAt(k - 1) && !letterAt(k + 1) },
  }
  const family = (c: string) => (c === '“' || c === '”' ? '“' : c === '‘' || c === '’' ? '‘' : c)
  const stacks = new Map<string, number[]>([['"', []], ['“', []], ['‘', []], ["'", []]])
  const pairs: [number, number][] = []
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (c === CELL) for (const st of stacks.values()) st.length = 0
    else if (c === '\n') stacks.get("'")!.length = 0
    const kind = kinds[c]
    if (!kind) continue
    const st = stacks.get(family(c))!
    // a mark that could do either closes when a quotation of its kind is open
    if (st.length && kind.closes(k)) pairs.push([st.pop()!, k])
    else if (kind.opens(k)) st.push(k)
  }
  if (!pairs.length) return s
  pairs.sort((a, b) => a[0] - b[0])
  let out = ''
  let pos = 0
  for (const [open, close] of pairs) {
    if (open < pos) continue // inside a quotation already taken
    quotes.push(s.slice(open + 1, close))
    out += s.slice(pos, open) + keepNl(s.slice(open, close + 1), QUOTE)
    pos = close + 1
  }
  return out + s.slice(pos)
}

type InlineResult = { text: string; numbersFrom: string; quotes: string[]; nav: boolean }

/**
 * One block's text with its markup read. Prose mode keeps the words a reader reads as prose and
 * marks code and quotations; plain mode gives the text a heading renders to (for its anchor).
 * Every step keeps the newlines, so a position's line is the count of newlines before it.
 */
function inline(src: string, defs: Map<string, Def>, plain: boolean, sink: Sink): InlineResult {
  const held: string[] = []
  const hold = (t: string) => String.fromCodePoint(HOLD + held.push(t) - 1)
  let s = maskCode(src, sink, plain, hold)
  let nlAt = lineIndex(s)
  s = s.replace(CODE_ELEMENT, (m: string, _t: string, inner: string, off: number) => {
    const content = inner.replace(/<[^>]*>/g, '').replace(/\n/g, ' ')
    sink.span(content, nlAt(off))
    return plain ? hold(content) : keepNl(m, CODE)
  })
  if (!plain) s = s.replace(/\\([!-/:-@[-`{-~])/g, (_m, c: string) => (MARKUP_ESCAPES.has(c) ? ' ' : c))
  s = maskLinks(s, defs, true, 'keep', sink, plain ? '' : ' ')
  const beforeLinks = s
  s = maskLinks(s, defs, false, 'keep', sink)
  nlAt = lineIndex(s)
  s = s.replace(AUTOLINK, (m: string, t: string, off: number) => {
    sink.target(t, nlAt(off))
    return plain ? hold(t) : ' '
  })
  s = maskHtml(s, sink, plain ? '' : ' ')
  if (plain) {
    s = decodeEntities(stripEmphasis(s).replace(/\\([!-/:-@[-`{-~])/g, '$1'))
    s = s.replace(HELD, ch => held[ch.codePointAt(0)! - HOLD] ?? '')
    return { text: s, numbersFrom: s, quotes: [], nav: false }
  }
  nlAt = lineIndex(s)
  s = s.replace(BARE_URL, (m: string, off: number) => {
    sink.target(m, nlAt(off))
    return ' '
  })
  s = decodeEntities(s)
  const numbersFrom = s
  const quotes: string[] = []
  s = maskQuotes(s, quotes)
  // a navigation line: nothing but links, images and code once the links' own text is gone too
  const linkless = maskHtml(maskLinks(beforeLinks, defs, false, 'drop', NO_SINK).replace(AUTOLINK, ' ').replace(BARE_URL, ' '), NO_SINK, ' ')
  return { text: s, numbersFrom, quotes, nav: !/\p{L}/u.test(linkless.replace(MARKS, ' ')) }
}

/** One plain-text block: web addresses go (to the sink) and quotations are marked; nothing else is markup. */
function inlineText(src: string, sink: Sink): InlineResult {
  const nlAt = lineIndex(src)
  const s = src.replace(BARE_URL, (m: string, off: number) => {
    sink.target(m, nlAt(off))
    return ' '
  })
  const quotes: string[] = []
  return { text: maskQuotes(s, quotes), numbersFrom: s, quotes, nav: false }
}

// ---------------------------------------------------------------------------------------------
// Reading Markdown: words and sentences

type Word = {
  t: 'word'
  text: string
  /** Lower case; for an acronym, without a plural "s" ("APIs" → "api"). */
  lower: string
  line: number
  acronym: boolean
  /** Starts with a capital and is not an acronym. */
  cap: boolean
  /** Shaped like an identifier or a coded name: camelCase, snake_case, a dot, a slash or a leading dash, or hyphenated with a digit or an inner capital ("CB-001"). */
  ident: boolean
  /** Which written token it came from. */
  token: number
  /** The first word of its sentence. */
  start: boolean
  heading: boolean
  /** Punctuation after it ends a clause: a comma, colon, semicolon or full stop. */
  stop: boolean
  /** Written with "'s", "'re" or "'m" after it ("it's", a form of "be"), which the word leaves out. */
  contracted: boolean
  /** Index of its sentence in the document. */
  s: number
}
type Item =
  | Word
  | { t: 'open' | 'close' | 'dash' | 'code'; line: number }
  /** A number, or a token with digits that is not a word ("6ea9c81"), as written. */
  | { t: 'num'; line: number; text: string }
  /**
   * A quotation: its text read into sentences as prose is, and their words (the same objects).
   * `joins`: it reads as part of the sentence around it (at most one sentence, not ended inside the
   * quotation marks, and no code in it), so `runsOf` carries the run around it through it.
   */
  | { t: 'quote'; line: number; words: Word[]; sentences: Sentence[]; joins: boolean }
type Sentence = { items: Item[]; line: number; words: number; syllables: number; kind: BlockKind; step: boolean; head: boolean; block: number }

const LEAD = /^[(\[{"'“‘*_~¡¿<>]+/
const TRAIL = /[)\]}"'”’*_~,.;:!?…<>%]+$/
/** Abbreviations a full stop never ends a sentence after ("Dr. Lee", "e.g. this"). */
const NEVER_ENDS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'vs', 'cf', 'fig', 'approx', 'eg', 'ie', 'viz', 'ca'])
/** Abbreviations that end a sentence only when the next word does not start with a small letter ("etc. Then" ends one; "etc. and" does not). */
const MAY_END = new Set(['etc', 'al', 'inc', 'ltd', 'co', 'jr', 'sr', 'incl', 'esp'])

type Part = { text: string; acronym: boolean; cap: boolean; ident: boolean; contracted?: boolean }

/**
 * The words in one written token, after its punctuation is gone. A hyphenated token is one word: an
 * ordinary one ("set-up", "re-run") is read whole, and one with a digit, or a capital after its first
 * letter ("CB-001", "ASD-STE100", "iso-24495"), is a name or an identifier. Otherwise a part with
 * digits is a word only when shaped like an acronym ("EC2"); else it is a number or a code, not a word.
 */
function partsOf(core: string): Part[] {
  if (!/\p{L}/u.test(core)) return []
  const ident = (text: string): Part[] => [{ text, acronym: false, cap: false, ident: true }]
  const bare = core.replace(/^-+/, '')
  if (core.startsWith('-') || /[/\\.@#$%^&=+|_:~]/.test(bare) || /\p{Ll}\p{Lu}/u.test(bare)) return ident(core)
  let w = core.replace(/’/g, "'")
  const neg = /^(\p{L}+)n't$/iu.exec(w)
  if (neg) w = ({ ca: 'can', wo: 'will', sha: 'shall' } as Record<string, string>)[neg[1].toLowerCase()] ?? neg[1]
  // "it's" or "they're" (a form of "be"), not "we've" or "he'd"
  const contracted = !neg && /'(?:s|re|m)$/i.test(w)
  if (!neg) w = w.replace(/'(?:s|re|ve|ll|d|m)$/i, '')
  const segments = w.split('-').filter(p => p !== '')
  if (segments.length > 1) {
    if (/\d/.test(w) || /\p{Lu}/u.test(w.slice(1))) return ident(w)
    if (segments.every(p => /^\p{L}+$/u.test(p))) return [{ text: w, acronym: false, cap: /^\p{Lu}/u.test(w), ident: false }]
  }
  const out: Part[] = []
  for (const p of w.split(/['-]/)) {
    if (p === '') continue
    if (/\d/.test(p)) {
      if (/^[\p{Lu}\d]+s?$/u.test(p) && (p.match(/\p{Lu}/gu)?.length ?? 0) >= 2) out.push({ text: p, acronym: true, cap: false, ident: false })
      continue
    }
    if (!/^\p{L}+$/u.test(p)) continue
    const acronym = /^\p{Lu}{2,}s?$/u.test(p)
    out.push({ text: p, acronym, cap: !acronym && /^\p{Lu}/u.test(p), ident: false })
  }
  if (contracted && out.length) out[out.length - 1].contracted = true
  return out
}

function wordOf(p: Part, line: number, start: boolean, heading: boolean, token: number, stop = false): Word {
  const lower = p.acronym ? p.text.replace(/s$/, '').toLowerCase() : p.text.toLowerCase()
  return { t: 'word', text: p.text, lower, line, acronym: p.acronym, cap: p.cap, ident: p.ident, token, start, heading, stop, contracted: !!p.contracted, s: -1 }
}

const CLAUSE_END = /[,;:.!?…]/

/** Words of a short piece of text, without sentences (quotations, glossary entries, list entries). */
function wordsIn(text: string, line = 0): Word[] {
  const out: Word[] = []
  text.split(/\s+/).forEach((chunk, token) => {
    const trail = TRAIL.exec(chunk)?.[0] ?? ''
    const core = chunk.replace(LEAD, '').replace(TRAIL, '')
    const parts = partsOf(core)
    parts.forEach((p, k) => out.push(wordOf(p, line, false, false, token, k === parts.length - 1 && CLAUSE_END.test(trail))))
  })
  return out
}

/**
 * Syllables in a word: the same rough rule as the readability script (lab branch claude/jargone-lab: 2026-10-30-readability/readability.py). Letters a–z only, one final
 * "e" dropped, then each run of vowels (a, e, i, o, u, y) counts as one, with at least 1.
 */
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '').replace(/e$/, '')
  return w ? Math.max(1, (w.match(/[aeiouy]+/g) ?? []).length) : 0
}

function syllablesIn(core: string): number {
  const runs = core.match(/\p{L}+/gu)
  if (!runs) return 1 // a number
  return Math.max(1, runs.reduce((n, r) => n + syllables(r), 0))
}

/** A line that is nothing but one bold span ("**Options**"): a title, so it ends its sentence. */
function boldTitle(line: string): boolean {
  const m = /^\s*(\*\*|__)(?=\S)(.*?\S)\1[:.]?\s*$/.exec(line)
  return !!m && !m[2].includes(m[1])
}

/**
 * Split one block's prose into sentences. A sentence ends at ".", "!", "?" or "…", whatever the next
 * word starts with, except after an abbreviation: never after one of NEVER_ENDS or letters with full
 * stops ("e.g.", "U.S."), and after one of MAY_END or an ellipsis only when the next word does not
 * start with a small letter. It also ends at a table cell, after a line that is one bold span (a
 * title), and at the end of the block. A word counts once for length, an inline code span or a
 * quotation counts as one word, and so does a number. It returns whether the text ends with a full
 * stop (or "!", "?") that ends a sentence, as read here.
 */
function sentencesOf(text: string, quotes: string[], lineOf: (nl: number) => number, block: Block, blockIndex: number, out: Sentence[]): boolean {
  const heading = block.kind === 'heading'
  const titles = new Set<number>()
  text.split('\n').forEach((l, k) => {
    if (boldTitle(l)) titles.add(k)
  })
  let sen: Sentence | null = null
  let sawWord = false
  let pending: false | 'soft' | 'hard' = false
  let qi = 0
  let token = 0
  let nl = 0
  let last = 0
  const end = () => {
    if (sen && sen.items.length) out.push(sen)
    sen = null
    sawWord = false
    pending = false
  }
  for (const m of text.matchAll(/[^\s\uE001]+|\uE001/g)) {
    const before = nl
    nl += newlines(text.slice(last, m.index))
    last = m.index!
    if (nl !== before && titles.has(before)) end()
    const line = lineOf(nl)
    const chunk = m[0]
    if (chunk === CELL) {
      end()
      continue
    }
    if (pending) {
      if (pending === 'soft' && /^\p{Ll}/u.test(chunk.replace(LEAD, ''))) pending = false
      else end()
    }
    if (!sen) sen = { items: [], line, words: 0, syllables: 0, kind: block.kind, step: block.step, head: block.head, block: blockIndex }
    const s: Sentence = sen
    for (const piece of chunk.split(/([—–])/)) {
      if (!piece) continue
      if (piece === '—' || piece === '–' || /^-{1,3}$/.test(piece)) {
        s.items.push({ t: 'dash', line })
        continue
      }
      const lead = LEAD.exec(piece)?.[0] ?? ''
      const rest = piece.slice(lead.length)
      const trail = TRAIL.exec(rest)?.[0] ?? ''
      const core = rest.slice(0, rest.length - trail.length)
      if (lead.includes('(')) s.items.push({ t: 'open', line })
      token++
      const marks = core.match(/[\uE000\uE003]/g)
      if (marks) {
        for (const mk of marks) {
          if (mk === CODE) {
            s.items.push({ t: 'code', line })
            continue
          }
          // the quotation's text, read the way prose is (it holds no quotation mark of its own)
          const qt = quotes[qi++] ?? ''
          const inner: Sentence[] = []
          const ends = sentencesOf(qt, [], () => line, block, blockIndex, inner)
          const joins = inner.length <= 1 && !ends && !qt.includes(CODE)
          s.items.push({ t: 'quote', line, words: inner.flatMap(q => q.items.filter((x): x is Word => x.t === 'word')), sentences: inner, joins })
        }
        s.words += marks.length
        s.syllables += marks.length
      } else if (/[\p{L}\p{N}]/u.test(core)) {
        s.words++
        s.syllables += syllablesIn(core)
        const parts = partsOf(core)
        if (!parts.length) s.items.push({ t: 'num', line, text: core })
        parts.forEach((p, k) => {
          s.items.push(wordOf(p, line, !sawWord, heading, token, k === parts.length - 1 && CLAUSE_END.test(trail)))
          sawWord = true
        })
      }
      if (trail.includes(')')) s.items.push({ t: 'close', line })
      if (/[.!?…]/.test(trail)) {
        const lower = core.toLowerCase()
        if (/^(?:\p{L}\.)+\p{L}$/u.test(core) || NEVER_ENDS.has(lower)) continue
        pending = MAY_END.has(lower) || /(?:\.\.\.|…)[)\]}"'”’*_~]*$/.test(trail) ? 'soft' : 'hard'
      }
    }
  }
  const ended = pending === 'hard'
  end()
  return ended
}

// ---------------------------------------------------------------------------------------------
// The parsed document

type Doc = {
  blocks: Block[]
  sentences: Sentence[]
  /** Per block: index of its first sentence, and whether it holds only links, images and code. */
  firstSentence: number[]
  nav: boolean[]
  /** The sentences of `>` block quotes: quotations, so no check reads them, but `tokenRuns` does. */
  quoted: Sentence[]
  spans: CodeText[]
  code: CodeText[]
  links: { target: string; line: number }[]
  ids: string[]
  headings: { text: string; line: number }[]
  numbers: { value: string; line: number }[]
}

function parse(md: string, format: Format = 'markdown'): Doc {
  const plainText = format === 'text'
  const p = plainText ? parseTextBlocks(md) : parseBlocks(md)
  const doc: Doc = {
    blocks: p.blocks, sentences: [], firstSentence: [], nav: [], quoted: [], spans: [], code: p.code,
    links: p.defList.map(d => ({ target: d.target, line: d.line })), ids: [], headings: [], numbers: [],
  }
  p.blocks.forEach((b, bi) => {
    let text = b.lines.map(l => l.text).join('\n')
    if (b.kind === 'table') text = text.replace(/(?<!\\)\|/g, CELL)
    const lineOf = (nl: number) => b.lines[Math.min(nl, b.lines.length - 1)].n
    const sink: Sink = {
      target: (t, nl) => doc.links.push({ target: t, line: lineOf(nl) }),
      span: (c, nl) => doc.spans.push({ text: c, line: lineOf(nl) }),
      id: id => doc.ids.push(id),
    }
    const r = plainText ? inlineText(text, sink) : inline(text, p.defs, false, sink)
    const nlAt = lineIndex(r.numbersFrom)
    for (const m of r.numbersFrom.matchAll(NUMBER)) doc.numbers.push({ value: m[0], line: lineOf(nlAt(m.index!)) })
    doc.firstSentence.push(doc.sentences.length)
    doc.nav.push(r.nav)
    sentencesOf(r.text, r.quotes, lineOf, b, bi, b.quote ? doc.quoted : doc.sentences)
    if (!plainText && b.kind === 'heading' && !b.html) {
      doc.headings.push({ text: inline(b.lines.map(l => l.text).join(' '), p.defs, true, NO_SINK).text, line: b.lines[0].n })
    }
  })
  doc.sentences.forEach((s, si) => {
    for (const it of s.items) {
      if (it.t === 'word') it.s = si
      else if (it.t === 'quote') for (const w of it.words) w.s = si
    }
  })
  doc.links.sort((a, b) => a.line - b.line)
  return doc
}

function sentencesOfBlock(doc: Doc, bi: number): Sentence[] {
  const to = bi + 1 < doc.firstSentence.length ? doc.firstSentence[bi + 1] : doc.sentences.length
  return doc.sentences.slice(doc.firstSentence[bi], to)
}

function docWords(doc: Doc): Word[] {
  return doc.sentences.flatMap(s => s.items.filter((it): it is Word => it.t === 'word'))
}

/**
 * The document's opening, which J04 reads: the first paragraph after the title. The title is the
 * first heading when that heading is of level 1 (a status line above it is not the opening); with no
 * such heading, the first paragraph of the document. Badges, images and lines of only links are
 * skipped, and so are block quotes and GitHub alerts.
 */
function openingBlock(doc: Doc): number {
  const first = doc.blocks.findIndex(b => b.kind === 'heading')
  const from = first >= 0 && doc.blocks[first].level === 1 ? first + 1 : 0
  for (let i = from; i < doc.blocks.length; i++) {
    const b = doc.blocks[i]
    if (b.kind === 'para' && !b.quote && !b.alert && !doc.nav[i] && sentencesOfBlock(doc, i).some(s => s.items.some(it => it.t === 'word'))) return i
  }
  return -1
}

// ---------------------------------------------------------------------------------------------
// Anchors and links

/** GitHub's rule (github-slugger): lower case; drop all but letters, marks, numbers, "_", "-" and spaces; each space → "-". */
function slugBase(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-')
}

function anchorsOfDoc(doc: Doc): string[] {
  const seen = new Map<string, number>()
  const out: string[] = []
  for (const h of doc.headings) {
    const base = slugBase(h.text)
    let slug = base
    while (seen.has(slug)) {
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      slug = `${base}-${n}`
    }
    seen.set(slug, 0)
    out.push(slug)
  }
  return [...out, ...doc.ids]
}

/**
 * The anchors a link's `#fragment` can reach in this Markdown, as GitHub makes them from each
 * heading's rendered text (emphasis marks, images and HTML tags gone, code kept as text): one per
 * heading in order (a repeated heading gets "-1", "-2", …), then any HTML `id` or `name` attribute.
 */
export function anchorsOf(markdown: string): string[] {
  return anchorsOfDoc(parse(markdown))
}

function splitTarget(t: string): { target: string; fragment?: string } {
  const h = t.indexOf('#')
  return h < 0 ? { target: t } : { target: t.slice(0, h), fragment: t.slice(h + 1) }
}

/**
 * Every link in this Markdown, in line order: inline links and images, reference definitions,
 * autolinks, bare web addresses and HTML href/src. `target` is the part before `#` ("" for a link
 * to a heading of the same document); `fragment` is the part after it, as written.
 */
export function linksIn(markdown: string): { target: string; fragment?: string; line: number }[] {
  return parse(markdown).links.map(l => ({ ...splitTarget(l.target), line: l.line }))
}

/** A `#fragment` as a browser compares it with an anchor: %-escapes decoded, and (as GitHub does) any case. */
function fragmentKey(fragment: string): string {
  let f = fragment
  try {
    f = decodeURIComponent(fragment)
  } catch {
    // keep it as written
  }
  return f.toLowerCase()
}

/** Which anchor a fragment leads to, or -1. */
function anchorAt(anchors: string[], fragment: string): number {
  const f = fragmentKey(fragment)
  return anchors.findIndex(a => a.toLowerCase() === f)
}

/** Does the fragment lead somewhere? An empty fragment and "#top" lead to the top of the page. */
function resolves(anchors: string[], fragment: string): boolean {
  const f = fragmentKey(fragment)
  return f === '' || f === 'top' || anchorAt(anchors, fragment) >= 0
}

// ---------------------------------------------------------------------------------------------
// Definitions

const DEFINING_VERBS = new Set(['is', 'are', 'means', 'mean'])
const ARTICLES = new Set(['a', 'an', 'the'])
/** "We called the API" is an action, not a name given: "called" after one of these is not a definition ("it's called" still is). */
const SUBJECTS = new Set(['i', 'we', 'you', 'they', 'he', 'she', 'it'])
/** Words that end the name after "called" ("is called RAD because …"), and that are never a defined term. */
const FUNCTION_WORDS = new Set(`
a an the and or but nor so yet because since although though while when where whether if then than as at by for
from in into of off on onto out over to up with within without about after before between through during under
is are was were be been being am has have had do does did will would can could shall should may might must not
no it its this that these those they them their there here he him his she her we us our you your i me my which
who whom whose what why how all any each every some such`.trim().split(/\s+/))

/**
 * The terms this sentence defines, in the forms J01 accepts: `Full Name (ACRONYM)`, `term (meaning)`,
 * `term — meaning`, a sentence of the form "term is …" or "term means …" (with "a", "an" or "the"
 * allowed before the term), and "… called TERM" (so "X is called Y" too). After "called" the term is
 * a quotation; or a name of up to 4 capitalised words or acronyms ("called RAD", "called First
 * Look"); or, after "a", "an" or "the", up to 4 words that stop at a comma or full stop or before a
 * word such as "because" ("called the moves file"). A bare word in lower case after "called" is not
 * a term ("is called often", "is called automatically"), so "called idempotent" defines nothing
 * either. A term may be a quotation: 'A "pod" is …'. The full name before "(ACRONYM)" may be a quotation.
 */
function definitionsIn(s: Sentence): Word[][] {
  const it = s.items
  const out: Word[][] = []
  // a word such as "it" or "this" is never the term ("It is late" defines nothing)
  const termAt = (j: number): Word[] | null => {
    const x = it[j]
    return x?.t === 'word' ? (FUNCTION_WORDS.has(x.lower) ? null : [x]) : x?.t === 'quote' && x.words.length ? x.words : null
  }
  for (let j = 0; j < it.length; j++) {
    const term = termAt(j)
    if (!term) continue
    const next = it[j + 1]
    // term (meaning)  ·  term — meaning; "(SLO)" alone is the next form, which defines the acronym instead
    const acronymOnly = next?.t === 'open' && it[j + 2]?.t === 'word' && (it[j + 2] as Word).acronym && it[j + 3]?.t === 'close'
    if (next && (next.t === 'open' || next.t === 'dash') && !acronymOnly) out.push(term)
    // term is …  ·  term means …
    else if ((j === 0 || (j === 1 && it[0].t === 'word' && ARTICLES.has(it[0].lower))) && next?.t === 'word' && DEFINING_VERBS.has(next.lower)) out.push(term)
    // Full Name (ACRONYM): only an acronym, so "the kubelet (below)" defines nothing
    const x = it[j]
    if (x.t === 'word' && x.acronym && it[j - 1]?.t === 'open' && next?.t === 'close' && (it[j - 2]?.t === 'word' || (it[j - 2]?.t === 'quote' && (it[j - 2] as { words: Word[] }).words.length > 0))) out.push(term)
    // … called TERM
    const before = it[j - 1]
    if (x.t !== 'word' || x.lower !== 'called' || (before?.t === 'word' && SUBJECTS.has(before.lower) && !before.contracted)) continue
    let k = j + 1
    const a = it[k]
    const article = a?.t === 'word' && ARTICLES.has(a.lower)
    if (article) k++
    const q = it[k]
    if (q?.t === 'quote' && q.words.length) {
      out.push(q.words)
      continue
    }
    // a name (capitalised words or an acronym), or a phrase after "a", "an" or "the"; a bare word in
    // lower case is not taken, since after "called" it is mostly not a name ("is called often")
    const named = (w: Word) => w.cap || w.acronym
    const first = it[k]
    if (first?.t !== 'word' || (!article && !named(first))) continue
    const name: Word[] = []
    for (; name.length < 4; k++) {
      const w = it[k]
      if (w?.t !== 'word' || FUNCTION_WORDS.has(w.lower) || (!article && !named(w))) break
      name.push(w)
      if (w.stop) break
    }
    if (name.length) out.push(name)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Session mode: the person's own words, terms defined earlier, and filtering a model reader's list

/** The longest phrase `wordsOf` records: a term of more words is matched only by the glossary. */
const PHRASE_MAX = 6

/** A word's key without the word lists: `crude` (an identifier is compared as written, in lower case). */
const plainKey = (w: Word): string => (w.ident ? w.lower : crude(w.lower))

type Token = Word | { t: 'num'; line: number; text: string }

/**
 * The runs of tokens that `wordsOf`, `termKey` and the glossary's `known` phrases are all read by, so
 * a term, a glossary entry and the text they are compared with are cut up the same way. Within a
 * sentence a token is a word, or a number or a token with digits ("3", "6ea9c81"); brackets and
 * dashes are passed over, and code ends a run. A quotation is read the same way: one that reads as
 * part of its sentence joins the run around it ('the "cold read" step'), and one with code in it or a
 * sentence ending inside it stands on its own. The sentences of a `>` block quote are read like any others.
 */
function tokenRuns(doc: Doc): Token[][] {
  return runsOf([...doc.sentences, ...doc.quoted])
}

function runsOf(sentences: Sentence[]): Token[][] {
  const runs: Token[][] = []
  for (const s of sentences) {
    let run: Token[] = []
    const end = () => {
      if (run.length) runs.push(run)
      run = []
    }
    for (const it of s.items) {
      if (it.t === 'word' || it.t === 'num') run.push(it)
      else if (it.t === 'code') end()
      else if (it.t === 'quote') {
        const inner = runsOf(it.sentences)
        if (it.joins) run.push(...inner.flat())
        else {
          end()
          runs.push(...inner)
        }
      }
    }
    end()
  }
  return runs
}

/** A token's key without the word lists: a word's `plainKey`, a number as written. */
const tokenKey = (t: Token): string => (t.t === 'word' ? plainKey(t) : t.text.toLowerCase())
const keyRuns = (doc: Doc): string[][] => tokenRuns(doc).map(r => r.map(tokenKey))

/**
 * A term's key: its tokens' keys (`keyRuns`), joined by spaces. A term with code in it, or that runs
 * over a sentence's end, has no such key, since the person's words cannot show they know it: its key
 * is the term itself in lower case after RAW, a character the parser removes from every text, so no
 * token's key holds it and only the same entry in the glossary matches it.
 */
function termKey(term: string): string {
  let key = TERM_KEYS.get(term)
  if (key === undefined) {
    if (TERM_KEYS.size > CACHE_MAX) TERM_KEYS.clear()
    TERM_KEYS.set(term, (key = termKeyOf(term)))
  }
  return key
}
// termKey is a pure function of the term: glossary entries are read once, not on every call. The
// bound is far above any glossary, so a cache never empties itself within one call.
const TERM_KEYS = new Map<string, string>()
const CACHE_MAX = 100000

function termKeyOf(term: string): string {
  const { runs, code } = entryRuns(term)
  return runs.length === 1 && !code ? runs[0].map(tokenKey).join(' ') : `${RAW}${term.trim().replace(/\s+/g, ' ').toLowerCase()}`
}

/**
 * The normalised words of a text, for the person's own words in session mode. It holds the key of
 * each word of its prose and quotations (code, link targets and web addresses left out), compared as
 * J01 compares words (plural and verb endings removed, by the fixed rule); each number or token with
 * digits as written ("6ea9c81"); and the keys of each run of 2 to 6 of these, joined by spaces, so a
 * phrase the person wrote ("Python 3 runtime", "SLO (service level objective)") is known as a phrase.
 * `filterKnown` reads it. To count terms defined earlier as known too, add
 * `wordsOf(definedTerms(text).join('\n\n'))`.
 */
export function wordsOf(text: string): Set<string> {
  const out = new Set<string>()
  for (const run of keyRuns(parse(text))) {
    for (let i = 0; i < run.length; i++) {
      let key = run[i]
      out.add(key)
      for (let k = i + 1; k < run.length && k - i < PHRASE_MAX; k++) {
        key = `${key} ${run[k]}`
        out.add(key)
      }
    }
  }
  return out
}

/**
 * The terms a text defines, as J01 counts a definition: in one of the forms of `definitionsIn`, in the
 * sentence where the term is first used or in the next one. A form further on defines nothing:
 * "Restart the kubelet. … See the kubelet (below)." does not define "kubelet". Each term is given as
 * written, once. The forms are loose ("The deployment is failing" has the form "term is …"), so this
 * can count a term as defined that was not explained; J01 has the same limit.
 */
export function definedTerms(text: string): string[] {
  const doc = parse(text)
  // the sentence where each word is first used, as a word or inside a quotation
  const firstUse = new Map<string, number>()
  doc.sentences.forEach((s, si) => {
    for (const it of s.items) {
      for (const w of it.t === 'word' ? [it] : it.t === 'quote' ? it.words : []) if (!firstUse.has(plainKey(w))) firstUse.set(plainKey(w), si)
    }
  })
  const out: string[] = []
  const seen = new Set<string>()
  doc.sentences.forEach((s, si) => {
    for (const ws of definitionsIn(s)) {
      if (!ws.some(w => si - (firstUse.get(plainKey(w)) ?? si) <= 1)) continue
      const key = ws.map(plainKey).join(' ')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(ws.map(w => w.text).join(' '))
    }
  })
  return out
}

/**
 * The terms a model reader listed, without those the reader counts as knowing: a term in `known`
 * (keys from `wordsOf`: the person's own words, and terms defined earlier) and a term in the
 * glossary's `known` list. A term of several words is one phrase: it is known only as that phrase,
 * not because each of its words is. Each term is kept once, as first written; blanks are dropped.
 * DEFAULT_KNOWN does not apply here: the model reader, not a fixed list, decides what is jargon.
 */
export function filterKnown(terms: string[], known: Set<string>, glossary?: Glossary): string[] {
  const listed = new Set((glossary?.known ?? []).map(termKey))
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of terms) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    const term = raw.trim()
    const key = termKey(term)
    if (seen.has(key)) continue
    seen.add(key)
    if (known.has(key) || listed.has(key)) continue
    out.push(term)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// The checks

type Ctx = {
  lists: Lists
  g: Glossary
  key(w: Word): string
  familiar(lower: string): boolean
  /** A word on the known list (the glossary's and DEFAULT_KNOWN), or part of a known phrase where it stands. */
  known(w: Word): boolean
  /** Part of an occurrence of a known phrase of several words. */
  inPhrase(w: Word): boolean
  project: Set<string>
  replacementsFor(key: string): string[] | undefined
}

type Entry = { r: Replacement; keys: string[] }
const INDEXES = new WeakMap<Lists, { byFirst: Map<string, Entry[]>; exceptions: Set<string> }>()

function matchKey(lists: Lists, w: Word): string {
  return w.ident ? w.lower : keyOf(lists, w.lower)
}

function replacementIndex(lists: Lists) {
  let ix = INDEXES.get(lists)
  if (!ix) {
    const byFirst = new Map<string, Entry[]>()
    for (const r of lists.replacements) {
      const keys = wordsIn(r.from).map(w => matchKey(lists, w))
      if (!keys.length) continue
      const list = byFirst.get(keys[0]) ?? []
      list.push({ r, keys })
      byFirst.set(keys[0], list)
    }
    for (const list of byFirst.values()) list.sort((a, b) => b.keys.length - a.keys.length)
    const exceptions = new Set<string>()
    for (const e of lists.exceptions) {
      exceptions.add(e)
      const ws = wordsIn(e)
      if (ws.length === 1) exceptions.add(matchKey(lists, ws[0]))
    }
    INDEXES.set(lists, (ix = { byFirst, exceptions }))
  }
  return ix
}

/** Runs of words that stand next to each other in a sentence, with nothing (code, a bracket, a dash) between. */
function wordRuns(doc: Doc): Word[][] {
  const runs: Word[][] = []
  for (const s of doc.sentences) {
    let run: Word[] = []
    for (const it of s.items) {
      if (it.t === 'word') run.push(it)
      else {
        if (run.length) runs.push(run)
        run = []
      }
    }
    if (run.length) runs.push(run)
  }
  return runs
}

/** A known entry's token runs, and whether it holds code: read once per entry, as `termKey` is. */
function entryRuns(entry: string): { runs: Token[][]; code: boolean } {
  let r = ENTRY_RUNS.get(entry)
  if (!r) {
    if (ENTRY_RUNS.size > CACHE_MAX) ENTRY_RUNS.clear()
    const doc = parse(entry)
    ENTRY_RUNS.set(entry, (r = { runs: tokenRuns(doc), code: doc.spans.length > 0 || doc.code.length > 0 }))
  }
  return r
}
const ENTRY_RUNS = new Map<string, { runs: Token[][]; code: boolean }>()

function context(lists: Lists, g: Glossary, doc: Doc, projectName?: string): Ctx {
  // A known entry of one word is known wherever it stands; one of several words is a phrase, known
  // only where those words stand together, and its words are not known on their own.
  // An entry is read by the same token reader as `filterKnown` reads it (`tokenRuns`), so "kubectl 2"
  // is a phrase of two tokens for both, not the word "kubectl".
  const single = new Set<string>()
  const singleKeys = new Set<string>()
  const phrases: string[][] = []
  const key = (t: Token) => (t.t === 'word' ? matchKey(lists, t) : t.text.toLowerCase())
  for (const k of [...DEFAULT_KNOWN, ...g.known]) {
    const { runs, code } = entryRuns(k)
    if (runs.length !== 1 || code) {
      single.add(k.trim().toLowerCase()) // nothing a word of the text can match: compared as written
      continue
    }
    const [run] = runs
    if (run.length > 1) {
      phrases.push(run.map(key))
      continue
    }
    const t = run[0]
    single.add(k.trim().toLowerCase())
    if (t.t === 'word') {
      single.add(t.lower)
      single.add(t.text.toLowerCase())
      singleKeys.add(matchKey(lists, t))
    }
  }
  const inPhrase = new Set<Word>()
  if (phrases.length) {
    for (const run of tokenRuns(doc)) {
      const keys = run.map(key)
      for (let i = 0; i < run.length; i++) {
        for (const p of phrases) {
          if (i + p.length > run.length || !p.every((k, j) => keys[i + j] === k)) continue
          for (let j = 0; j < p.length; j++) {
            const t = run[i + j]
            if (t.t === 'word') inPhrase.add(t)
          }
        }
      }
    }
  }
  const project = new Set<string>()
  if (projectName?.trim()) {
    project.add(projectName.trim().toLowerCase())
    for (const w of wordsIn(projectName)) {
      project.add(w.lower)
      project.add(w.text.toLowerCase())
    }
  }
  const ix = replacementIndex(lists)
  // A hyphenated word is known when a part of it is known (the glossary, or the project's name) and
  // each other part is known or common: "kubelet-based" with "kubelet" in the glossary.
  const partKnown = (p: string) => single.has(p) || singleKeys.has(keyOf(lists, p)) || project.has(p)
  const compoundKnown = (lower: string) =>
    lower.includes('-') && lower.split('-').some(partKnown) && isFamiliar(lists, lower, g.cutoff, partKnown)
  return {
    lists,
    g,
    key: w => matchKey(lists, w),
    familiar: lower => isFamiliar(lists, lower, g.cutoff),
    known: w => single.has(w.lower) || single.has(w.text.toLowerCase()) || singleKeys.has(matchKey(lists, w)) || inPhrase.has(w) || compoundKnown(w.lower),
    inPhrase: w => inPhrase.has(w),
    project,
    // J01 and J04 offer the same replacements J07 does, so they honour the same exceptions: a word whose
    // plain swap would change a precise meaning gets no swap offered by any check (SPEC section 4, J07).
    replacementsFor: key => (ix.exceptions.has(key) ? undefined : ix.byFirst.get(key)?.find(e => e.keys.length === 1)?.r.to),
  }
}

const finding = (code: Code, line: number, message: string, term?: string, suggestion?: string[]): Finding => {
  const f: Finding = { code, severity: SEVERITY[code], line, message }
  if (term !== undefined) f.term = term
  if (suggestion?.length) f.suggestion = suggestion
  return f
}

/**
 * The words that look like names: capitalised in mid-sentence and not an acronym. A sentence's
 * capitalised first word is a name too when the same word is written that way in mid-sentence
 * elsewhere (outside headings, which are often in title case), or when the next word is a name
 * ("Andrej Karpathy").
 */
function namesOf(doc: Doc): Set<Word> {
  const words = docWords(doc)
  const midCaps = new Set(words.filter(w => w.cap && !w.start && !w.heading && w.text.length > 1).map(w => w.text))
  const names = new Set<Word>()
  for (const s of doc.sentences) {
    s.items.forEach((it, k) => {
      if (it.t !== 'word' || !it.cap) return
      const next = s.items[k + 1]
      if (!it.start || midCaps.has(it.text) || (next?.t === 'word' && next.cap && !next.start)) names.add(it)
    })
  }
  return names
}

function j01(doc: Doc, c: Ctx): Finding[] {
  const words = docWords(doc)
  const names = namesOf(doc)
  type Term = { first: Word; count: number; acronym: boolean; common: boolean }
  const terms = new Map<string, Term>()
  for (const w of words) {
    if (w.ident || names.has(w) || w.lower.length < 2 || c.project.has(w.lower) || c.known(w)) continue
    const k = c.key(w)
    const t = terms.get(k)
    if (t) {
      t.count++
      t.acronym ||= w.acronym
      t.common ||= c.familiar(w.lower)
    } else terms.set(k, { first: w, count: 1, acronym: w.acronym, common: c.familiar(w.lower) })
  }
  // a term's first appearance may be a quoted mention: 'A "pod" is …'
  const mentions = new Map<string, Word>()
  for (const s of doc.sentences) {
    for (const it of s.items) {
      if (it.t !== 'quote') continue
      for (const w of it.words) if (!mentions.has(c.key(w))) mentions.set(c.key(w), w)
    }
  }
  const defs = new Map<number, Set<string>>()
  const defines = (si: number, key: string) => {
    const s = doc.sentences[si]
    if (!s) return false
    let keys = defs.get(si)
    if (!keys) defs.set(si, (keys = new Set(definitionsIn(s).flat().map(w => c.key(w)))))
    return keys.has(key)
  }
  const out: Finding[] = []
  for (const [k, t] of terms) {
    if (t.common || !(t.acronym || t.count >= 2)) continue
    const m = mentions.get(k)
    const first = m && m.s < t.first.s ? m : t.first
    if (defines(first.s, k) || defines(first.s + 1, k)) continue
    const shown = t.first.text
    const message = t.acronym
      ? `"${shown}" is not written out where it first appears. A hint, not an error: if the reader may not know it, write it out there or in the next sentence, for example "Full Name (${shown})". If every reader knows it, add it to "known" in ${GLOSSARY_FILE}.`
      : `"${shown}" is used before it is explained. A hint, not an error: if the reader may not know it, explain it where it first appears or in the next sentence, for example "${shown} (what it means)", or use plain words. If every reader knows it, add it to "known" in ${GLOSSARY_FILE}.`
    out.push(finding('J01', first.line, message, shown, c.replacementsFor(k)))
  }
  return out
}

function j02(doc: Doc, c: Ctx): Finding[] {
  const out: Finding[] = []
  const runs = doc.sentences.map(s => s.items.filter((it): it is Word => it.t === 'word'))
  for (const group of c.g.same) {
    const firsts = group.map(member => {
      const keys = wordsIn(member).map(w => c.key(w))
      if (!keys.length) return null
      for (const run of runs) {
        for (let i = 0; i + keys.length <= run.length; i++) {
          if (keys.every((k, j) => c.key(run[i + j]) === k)) return { member, line: run[i].line, s: run[i].s }
        }
      }
      return null
    })
    const present = firsts.filter((f): f is NonNullable<typeof f> => f !== null).sort((a, b) => a.s - b.s || a.line - b.line)
    if (present.length < 2) continue
    const where = present.map(p => `"${p.member}" first on line ${p.line}`).join(', ')
    out.push(finding('J02', present[1].line,
      `${present.map(p => `"${p.member}"`).join(' and ')} name the same thing (the glossary's "same" list). Use one name throughout: ${where}.`,
      present[1].member))
  }
  return out
}

/**
 * The sentences J03 and the scores read: those of paragraphs, list items and table cells. Headings,
 * and a table's header row, are left out: they are labels, not sentences. Quotations are left out too:
 * text in quotation marks counts as one word, and the sentences of a `>` block quote are kept apart
 * (`doc.quoted`), where no check reads them.
 */
const counted = (doc: Doc) => doc.sentences.filter(s => s.kind !== 'heading' && !s.head && s.words > 0)

function j03(doc: Doc, c: Ctx): Finding[] {
  const out: Finding[] = []
  for (const s of counted(doc)) {
    const limit = s.step ? c.g.max_words_in_steps : c.g.max_words
    if (s.words <= limit) continue
    out.push(finding('J03', s.line, s.step
      ? `A sentence in a numbered step has ${s.words} words; the limit there is ${limit}. Split it.`
      : `A sentence has ${s.words} words; the limit is ${limit}. Split it.`))
  }
  return out
}

function j04(doc: Doc, c: Ctx): Finding[] {
  const bi = openingBlock(doc)
  if (bi < 0) return []
  const out: Finding[] = []
  const seen = new Set<string>()
  for (const s of sentencesOfBlock(doc, bi)) {
    for (const it of s.items) {
      if (it.t !== 'word' || c.project.has(it.lower) || c.project.has(it.text.toLowerCase()) || c.familiar(it.lower) || c.known(it)) continue
      const k = c.key(it)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(finding('J04', it.line,
        `"${it.text}" in the opening paragraph is not on the common-word list. A hint, not an error: if the reader may not know it, use a common word there (explaining it in the opening does not make it common). If every reader knows it, add it to "known" in ${GLOSSARY_FILE}.`,
        it.text, c.replacementsFor(k)))
    }
  }
  return out
}

function normBlock(text: string): string {
  const ls = trimBlankLines(text.split('\n').map(l => l.replace(/[ \t]+$/, '')))
  let pad = Infinity
  for (const l of ls) if (l.trim()) pad = Math.min(pad, width(l))
  if (pad === Infinity) pad = 0
  return ls.map(l => dedent(l, pad)).join('\n')
}

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p

// J05's units of content, each counted: numbers in prose, inline code, code blocks and link targets.
type Bag = Map<string, number>
type Units = { numbers: Bag; spans: Bag; blocks: Bag; links: Bag }

function bag(values: Iterable<string>): Bag {
  const b: Bag = new Map()
  for (const v of values) b.set(v, (b.get(v) ?? 0) + 1)
  return b
}

/** What `a` holds beyond `b`, counted. */
function minus(a: Bag, b: Bag): Bag {
  const out: Bag = new Map()
  for (const [v, n] of a) {
    const left = n - (b.get(v) ?? 0)
    if (left > 0) out.set(v, left)
  }
  return out
}

function unitsOf(doc: Doc): Units {
  return {
    numbers: bag(doc.numbers.map(n => n.value)),
    spans: bag(doc.spans.map(s => s.text)),
    blocks: bag(doc.code.map(b => normBlock(b.text))),
    links: bag(doc.links.map(l => l.target)),
  }
}

const unitsMinus = (a: Units, b: Units): Units =>
  ({ numbers: minus(a.numbers, b.numbers), spans: minus(a.spans, b.spans), blocks: minus(a.blocks, b.blocks), links: minus(a.links, b.links) })

const lineKey = (l: string) => unquote(l).text.trim().replace(/\s+/g, ' ')
const lineBag = (text: string) => bag(text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').map(lineKey).filter(l => l !== ''))

/**
 * A copy of the original is not a move. The moved-to file holds one when what it gained includes,
 * unchanged, the original's opening paragraph (the one J04 reads; skipped when there is none) and at
 * least 9 in 10 of the original's non-blank lines. Lines are compared after trimming, collapsing
 * spaces and removing `>` marks. A copy with its opening changed, or with more than 1 line in 10
 * changed, is not recognised; the accuracy reviewer, who reads the moved-to file, is the check then.
 */
function copyOf(origText: string, orig: Doc, gainedLines: Bag): { matched: number; total: number } | undefined {
  const lines = lineBag(origText)
  let total = 0
  let matched = 0
  for (const [l, n] of lines) {
    total += n
    matched += Math.min(n, gainedLines.get(l) ?? 0)
  }
  if (!total || matched * 10 < total * 9) return undefined
  const ob = openingBlock(orig)
  if (ob >= 0) {
    const raw = origText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
    if (!orig.blocks[ob].lines.every(l => gainedLines.has(lineKey(raw[l.n - 1] ?? '')))) return undefined
  }
  return { matched, total }
}

type MovedFile = { path: string; text: string; doc: Doc }

/**
 * J05: every number (in prose), inline code span, code block and link target of the original is in
 * the rewrite or in what the moved-to file gained (`referenceBefore`). Numbers are counted: an
 * original that says 3 twice needs 3 twice. Numbers are read from prose on both sides (headings,
 * table cells and quotations included; list markers, link targets, web addresses, HTML comments,
 * code and front matter not), so a number elsewhere in the file cannot stand in for one lost. A code
 * span also counts as kept inside a code block. Every link to a heading still resolves.
 */
function j05(orig: Doc, origText: string, rew: Doc, moved: MovedFile[], before: { text: string; doc: Doc } | undefined,
  inbound: { from: string; fragment?: string }[]): { findings: Finding[]; movedNote: string } {
  const out: Finding[] = []
  const rewU = unitsOf(rew)
  const beforeU = before ? unitsOf(before.doc) : undefined
  const beforeLines = before ? lineBag(before.text) : new Map<string, number>()
  const gain: Units = { numbers: new Map(), spans: new Map(), blocks: new Map(), links: new Map() }
  // what each moved file's anchors lead to, and which headings and ids it gained, for a link that now
  // leads to a heading moved there. A heading is told by its text, not its anchor: a repeated heading's
  // anchor ("setup-1") depends on where it stands, so it can change when another one is added
  const anchorsGained: { path: string; anchors: string[]; bases: string[]; headings: Bag; ids: Bag }[] = []
  let copies = 0
  for (const m of moved) {
    const copy = copyOf(origText, orig, minus(lineBag(m.text), beforeLines))
    if (copy) {
      copies++
      out.push(finding('J05', 1,
        `The reference file ${m.path} gained a copy of the original: its opening paragraph and ${copy.matched} of its ${copy.total} lines, unchanged. A reference file holds the detail moved out of the document, so nothing it gained counts as moved, and J05 compared the rewrite with the original alone. Keep only the moved detail there.`,
        m.path))
      continue
    }
    const u = beforeU ? unitsMinus(unitsOf(m.doc), beforeU) : unitsOf(m.doc)
    for (const k of ['numbers', 'spans', 'blocks', 'links'] as const) for (const [v, n] of u[k]) gain[k].set(v, (gain[k].get(v) ?? 0) + n)
    const bases = m.doc.headings.map(h => slugBase(h.text))
    anchorsGained.push({
      path: m.path, anchors: anchorsOfDoc(m.doc), bases,
      headings: minus(bag(bases), bag(before ? before.doc.headings.map(h => slugBase(h.text)) : [])),
      ids: minus(bag(m.doc.ids), bag(before ? before.doc.ids : [])),
    })
  }
  const nowhere = !moved.length
    ? 'not in the rewrite'
    : copies === moved.length
      ? 'not in the rewrite (the copy of the original in the reference file does not count)'
      : 'in neither the rewrite nor what the reference file gained'
  const rewBlocks = [...rewU.blocks.keys()]
  const gainBlocks = [...gain.blocks.keys()]
  const moves = { numbers: 0, spans: 0, blocks: 0, links: 0 }

  const byValue = new Map<string, number[]>()
  for (const n of orig.numbers) {
    const lines = byValue.get(n.value)
    if (lines) lines.push(n.line)
    else byValue.set(n.value, [n.line])
  }
  for (const [v, lines] of byValue) {
    const need = lines.length
    const inRew = rewU.numbers.get(v) ?? 0
    const have = inRew + (gain.numbers.get(v) ?? 0)
    moves.numbers += Math.max(0, Math.min(need, have) - Math.min(need, inRew))
    if (have >= need) continue
    const where = [...new Set(lines)]
    out.push(finding('J05', lines[0], need === 1
      ? `The number ${v} on line ${lines[0]} of the original is ${nowhere}.`
      : `The number ${v} is in the original ${need} times (line${where.length > 1 ? 's' : ''} ${where.join(', ')}), but ${have === 0 ? 'not at all' : have === 1 ? 'once' : `${have} times`} in the rewrite${moved.length && copies < moved.length ? ' and what the reference file gained' : ''}. Each use is a fact to keep.`,
    v))
  }
  const seen = new Set<string>()
  const first = (k: string) => !seen.has(k) && !!seen.add(k)
  for (const s of orig.spans) {
    if (!s.text.trim() || !first(`s${s.text}`)) continue
    if (rewU.spans.has(s.text) || rewBlocks.some(b => b.includes(s.text))) continue
    if (gain.spans.has(s.text) || gainBlocks.some(b => b.includes(s.text))) {
      moves.spans++
      continue
    }
    out.push(finding('J05', s.line, `The code "${s.text}" on line ${s.line} of the original is ${nowhere}.`, s.text))
  }
  for (const b of orig.code) {
    const norm = normBlock(b.text)
    if (!norm || !first(`c${norm}`) || rewBlocks.some(h => h.includes(norm))) continue
    if (gainBlocks.some(h => h.includes(norm))) {
      moves.blocks++
      continue
    }
    out.push(finding('J05', b.line, `The code block on line ${b.line} of the original is missing or changed. Keep code exactly as it was.`))
  }
  // A link to a heading that moved: the rewrite now links to that heading in the moved file, and it
  // is a heading (or id) the file gained, not one it held before nor one in a copy of the original.
  // The link's file is matched to a moved file by file name only, because the checker is not given
  // the document's own path to resolve relative links against; the moved file sits beside the original.
  const movedTo = (fragment: string) => rew.links.some(l => {
    const t = splitTarget(l.target)
    if (!t.target || t.fragment === undefined || fragmentKey(t.fragment) !== fragmentKey(fragment)) return false
    return anchorsGained.some(g => {
      if (baseName(g.path) !== baseName(t.target)) return false
      const at = anchorAt(g.anchors, fragment)
      return at >= 0 && (at < g.bases.length ? g.headings.has(g.bases[at]) : g.ids.has(g.anchors[at]))
    })
  })
  for (const l of orig.links) {
    if (!first(`l${l.target}`) || rewU.links.has(l.target)) continue
    if (gain.links.has(l.target)) {
      moves.links++
      continue
    }
    if (l.target.startsWith('#') && movedTo(l.target.slice(1))) continue
    out.push(finding('J05', l.line, `The link to "${l.target}" on line ${l.line} of the original is ${nowhere}.`, l.target))
  }
  const origAnchors = anchorsOfDoc(orig)
  const rewAnchors = anchorsOfDoc(rew)
  const broken = new Set<string>()
  for (const l of rew.links) {
    if (!l.target.startsWith('#') || broken.has(l.target)) continue
    const fragment = l.target.slice(1)
    if (resolves(rewAnchors, fragment)) continue
    const alreadyBroken = orig.links.some(o => o.target === l.target) && !resolves(origAnchors, fragment)
    if (alreadyBroken) continue
    broken.add(l.target)
    out.push(finding('J05', l.line, `The link to "${l.target}" on line ${l.line} leads to no heading in this document. A heading that a link points to may not be reworded.`, l.target))
  }
  for (const r of inbound) {
    if (r.fragment === undefined || !resolves(origAnchors, r.fragment) || resolves(rewAnchors, r.fragment)) continue
    const at = anchorAt(origAnchors, r.fragment)
    const line = at >= 0 && at < orig.headings.length ? orig.headings[at].line : 1
    out.push(finding('J05', line,
      `The link from ${r.from} to "#${r.fragment}" no longer leads to a heading. Keep the wording of the heading on line ${line} of the original: jargone does not change other files' links.`,
      `#${r.fragment}`))
  }
  const parts = [plural(moves.numbers, 'number'), plural(moves.spans, 'code span'), plural(moves.blocks, 'code block'), plural(moves.links, 'link')]
    .filter((_, i) => [moves.numbers, moves.spans, moves.blocks, moves.links][i] > 0)
  let movedNote = parts.length ? ` J05 counted as moved to the reference file, so they are no longer in the document: ${listed(parts)}.` : ''
  if (moved.length > copies && !before) movedNote += ' J05 counted everything in the reference file as new, since its text from before the rewrite was not given.'
  return { findings: out, movedNote }
}

function j07(doc: Doc, c: Ctx): Finding[] {
  const ix = replacementIndex(c.lists)
  const hits = new Map<Entry, Word[][]>()
  for (const run of wordRuns(doc)) {
    let i = 0
    while (i < run.length) {
      const match = (ix.byFirst.get(c.key(run[i])) ?? []).find(e => e.keys.every((k, j) => run[i + j] && c.key(run[i + j]) === k))
      if (!match) {
        i++
        continue
      }
      const ws = run.slice(i, i + match.keys.length)
      i += match.keys.length
      const phrase = ws.map(w => w.lower).join(' ')
      if (ix.exceptions.has(phrase) || ws.every(w => c.inPhrase(w))) continue
      if (ws.length === 1 && (ix.exceptions.has(c.key(ws[0])) || c.known(ws[0]) || c.project.has(ws[0].lower))) continue
      const list = hits.get(match) ?? []
      list.push(ws)
      hits.set(match, list)
    }
  }
  const out: Finding[] = []
  for (const [e, uses] of hits) {
    const shown = uses[0].map((w, k) => (k === 0 ? '' : w.token === uses[0][k - 1].token ? '-' : ' ') + w.text).join('')
    const words = e.r.to.filter(t => !t.startsWith('('))
    const advice = e.r.to.filter(t => t.startsWith('('))
    const offer = words.length ? `try ${words.map(t => `"${t}"`).join(' or ')}` : 'it can often be left out or said more exactly'
    const lines = [...new Set(uses.map(u => u[0].line))]
    const more = lines.length > 1 ? ` Also on line${lines.length > 2 ? 's' : ''} ${lines.slice(1).join(', ')}.` : ''
    const unless = e.r.unless ? ` Keep it if ${e.r.unless}.` : ''
    const notes = advice.length ? ` ${advice.join(' ')}` : ''
    out.push(finding('J07', lines[0],
      `"${shown}" has a plainer option: ${offer}.${notes}${unless} A hint, not an error: keep the word if a swap would change the meaning.${more}`,
      shown, e.r.to))
  }
  return out
}

const round1 = (x: number) => Math.round(x * 10) / 10

function scoresOf(doc: Doc): Scores {
  const ss = counted(doc)
  let words = 0
  let syl = 0
  let longest = 0
  for (const s of ss) {
    words += s.words
    syl += s.syllables
    longest = Math.max(longest, s.words)
  }
  const sentences = ss.length
  if (!words) return { flesch: 0, grade: 0, avgSentence: 0, longestSentence: 0, words: 0, sentences: 0 }
  const perSentence = words / sentences
  const perWord = syl / words
  return {
    flesch: round1(206.835 - 1.015 * perSentence - 84.6 * perWord),
    grade: round1(0.39 * perSentence + 11.8 * perWord - 15.59),
    avgSentence: round1(perSentence),
    longestSentence: longest,
    words,
    sentences,
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const listed = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const scoreText = (s: Scores) => `reading ease ${s.flesch}, grade ${s.grade}, average sentence ${s.avgSentence} words, longest ${s.longestSentence} words`

/**
 * Run the checks on a document. J06 is never a finding: its scores are in `scores` and, with
 * "before" scores when `original` is given, in `summary`. The summary opens with whether the
 * document passes (`passes`: no errors).
 */
export function checkText(input: CheckInput): { findings: Finding[]; scores: Scores; summary: string } {
  const given: Partial<Glossary> = input.glossary ?? {}
  const g: Glossary = {
    known: given.known ?? [],
    same: given.same ?? [],
    max_words: given.max_words ?? DEFAULT_GLOSSARY.max_words,
    max_words_in_steps: given.max_words_in_steps ?? DEFAULT_GLOSSARY.max_words_in_steps,
    cutoff: given.cutoff ?? DEFAULT_GLOSSARY.cutoff,
  }
  const format: Format = input.format === 'text' ? 'text' : 'markdown'
  const codes = new Set<Code>(input.codes ?? ALL_CODES)
  const doc = parse(input.text, format)
  const c = context(input.lists, g, doc, input.projectName)
  const findings: Finding[] = []
  if (codes.has('J01')) findings.push(...j01(doc, c))
  if (codes.has('J02')) findings.push(...j02(doc, c))
  if (codes.has('J03')) findings.push(...j03(doc, c))
  if (codes.has('J04')) findings.push(...j04(doc, c))
  const orig = input.original !== undefined ? parse(input.original, format) : undefined
  let movedNote = ''
  if (codes.has('J05') && orig) {
    const moved = (input.moved ?? []).map(m => ({ ...m, doc: parse(m.text) }))
    const before = input.referenceBefore !== undefined ? { text: input.referenceBefore, doc: parse(input.referenceBefore) } : undefined
    const r = j05(orig, input.original!, doc, moved, before, input.inbound ?? [])
    findings.push(...r.findings)
    movedNote = r.movedNote
  }
  if (codes.has('J07')) findings.push(...j07(doc, c))
  const order = (f: Finding) => ALL_CODES.indexOf(f.code)
  findings.sort((a, b) => a.line - b.line || order(a) - order(b))
  const scores = scoresOf(doc)

  const count = (s: Severity) => findings.filter(f => f.severity === s).length
  const per = ALL_CODES.filter(k => findings.some(f => f.code === k)).map(k => `${k}: ${findings.filter(f => f.code === k).length}`)
  let summary = findings.length
    ? `${passes(findings) ? 'Passes' : 'Does not pass'}: ${plural(count('error'), 'error')}, ${plural(count('warning'), 'warning')} and ${plural(count('hint'), 'hint')} (${per.join(', ')}).`
    : 'Passes: no findings.'
  summary += movedNote
  if (codes.has('J06')) {
    summary += ` Scores, for information only: ${scoreText(scores)}`
    summary += orig ? `; before the rewrite, ${scoreText(scoresOf(orig))}.` : '.'
  } else if (codes.has('J03')) summary += ` Longest sentence: ${plural(scores.longestSentence, 'word')}.`
  if (codes.has('J05') && !orig) summary += ' J05 did not run: no saved original was read.'
  return { findings, scores, summary }
}

/**
 * Session mode's code check on one reply: J01, J03 and J07 on its prose (code and quotations
 * skipped). Its note reports only the long sentences and how many hints there are, for example
 * "jargone: 1 long sentence (longest 41 words), 3 hints"; the terms the reader would not know come
 * from the model reader, not from here. `ok` is `passes`: these checks find no errors, so a reply
 * never fails on them. `findings` holds at most `cap`, warnings before hints, and `more` counts the rest.
 */
export function replyNote(text: string, lists: Lists, glossary: Glossary = DEFAULT_GLOSSARY, cap = 10): { ok: boolean; note: string; findings: Finding[]; more: number } {
  const r = checkText({ text, lists, glossary, codes: ['J01', 'J03', 'J07'] })
  const rank: Record<Severity, number> = { error: 0, warning: 1, hint: 2 }
  const all = [...r.findings].sort((a, b) => rank[a.severity] - rank[b.severity] || a.line - b.line)
  const n = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 10
  const findings = all.slice(0, n)
  const long = all.filter(f => f.code === 'J03').length
  const hints = all.filter(f => f.severity === 'hint').length
  const parts: string[] = []
  if (long) parts.push(`${plural(long, 'long sentence')} (longest ${r.scores.longestSentence} words)`)
  if (hints) parts.push(plural(hints, 'hint'))
  return { ok: passes(all), note: `jargone: ${parts.length ? parts.join(', ') : 'nothing to flag'}`, findings, more: all.length - findings.length }
}

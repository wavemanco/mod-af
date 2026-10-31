// jargone's checker: the checks SPEC.md section 4 runs in code (J01–J07), and the short note on each
// reply in session mode (section 13).
//
// Pure: no `$`, no file access. The caller passes in the text, the word lists and the glossary.
// One parser reads the Markdown (`parse` below). Every check, `anchorsOf` and `linksIn` read what it
// returns, so no two checks can disagree about what is code, a quotation, a link or a heading.
//
// What counts as prose. Checks J01–J04 and J07 read prose only. Left out, with line numbers kept:
// front matter, fenced and indented code, `<pre>`, `<script>` and `<style>` blocks, HTML comments,
// inline code (and <code>/<kbd> elements), images, link targets (the link text is prose), reference
// definitions, autolinks and bare web addresses, HTML tags (text between tags is prose), and direct
// quotations: text inside “…” or "…", or inside ‘…’ or '…' on one line. A `>` block is read as prose:
// in Markdown it is mostly the writer's own note or warning, not someone else's words.

export type Code = 'J01' | 'J02' | 'J03' | 'J04' | 'J05' | 'J06' | 'J07'
export type Finding = {
  code: Code
  severity: 'error' | 'warning'
  /** For J05's lost content, the line in the saved original; for every other finding, the line in the text checked. */
  line: number
  term?: string
  message: string
  suggestion?: string[]
}
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
  /** The saved original (`.jargone/originals/<file>`), for J05 and the "before" scores. */
  original?: string
  /** The files listed in `.jargone/moves/<file>.json`, with their contents now. */
  moved?: { path: string; text: string }[]
  /** Links to this document from other files in the repository; `fragment` is the part after `#`. */
  inbound?: { from: string; fragment?: string }[]
}

export const ALL_CODES: readonly Code[] = Object.freeze(['J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07'] as Code[])
const SEVERITY: Record<Code, 'error' | 'warning'> = {
  J01: 'error', J02: 'error', J03: 'warning', J04: 'error', J05: 'error', J06: 'warning', J07: 'warning',
}

export const DEFAULT_GLOSSARY: Glossary = Object.freeze({
  known: Object.freeze([]) as unknown as string[],
  same: Object.freeze([]) as unknown as string[][],
  max_words: 30,
  max_words_in_steps: 20,
  cutoff: 6.0,
})

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
// at or above the cut-off.

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

function isFamiliar(lists: Lists, lower: string, cutoff: number): boolean {
  if ((lists.familiarity.get(lower) ?? 0) >= cutoff) return true
  return bases(lower).some(b => (lists.familiarity.get(b) ?? 0) >= cutoff)
}

// ---------------------------------------------------------------------------------------------
// Reading Markdown: blocks

const CODE = '\uE000' // an inline code span, in prose: one word, never a term
const CELL = '\uE001' // a table cell boundary: ends a sentence
const QUOTE = '\uE003' // a direct quotation, in prose: one word, never a term
const PRIVATE = /[\uE000-\uE00F]/g

type Line = { n: number; text: string }
type BlockKind = 'heading' | 'para' | 'item' | 'table'
type Block = { kind: BlockKind; lines: Line[]; step: boolean; level: number; html: boolean }
type Def = { target: string; line: number }
type CodeText = { text: string; line: number }

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

type Blocks = { blocks: Block[]; code: CodeText[]; defs: Map<string, Def>; defList: Def[] }

function parseBlocks(md: string): Blocks {
  const lines = md.replace(/\r\n?/g, '\n').replace(PRIVATE, ' ').split('\n')
  const blocks: Block[] = []
  const code: CodeText[] = []
  const defs = new Map<string, Def>()
  const defList: Def[] = []
  let cur: Block | null = null
  let curDepth = 0
  let blank = true
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
    if (body.trim() === '') {
      flush()
      if (indented) indented.lines.push('')
      blank = true
      continue
    }
    blank = false
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

    const lazy = cur !== null && curDepth === depth
    const item = /^([ \t]*)([-*+]|\d{1,9}[.)])(?=[ \t]|$)([ \t]*)/.exec(body)
    if (!lazy && !item) while (lists.length && indent < lists[lists.length - 1].content) lists.pop()
    const owner = lists[lists.length - 1]

    // indented code: cannot interrupt a paragraph; inside a list item it starts 4 columns past the item's text
    const codeAt = owner ? owner.content + 4 : 4
    if (!lazy && indent >= codeAt) {
      flush()
      indented = { lines: [dedent(body, codeAt)], line: i + 1, at: codeAt }
      continue
    }

    // setext heading underline, then thematic break
    if (lazy && cur!.kind === 'para' && /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(body)) {
      cur!.kind = 'heading'
      cur!.level = body.trim()[0] === '=' ? 1 : 2
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
      blocks.push({ kind: 'heading', level: atx[1].length, lines: [{ n: i + 1, text: atx[2] ?? '' }], step: false, html: false })
      continue
    }
    // an HTML heading on one line: a title for J04, but not a heading GitHub gives an anchor
    const hh = /^[ \t]*<h([1-6])\b[^>]*>(.*?)<\/h\1>[ \t]*$/i.exec(body)
    if (hh) {
      flush()
      blocks.push({ kind: 'heading', level: Number(hh[1]), lines: [{ n: i + 1, text: body.trim() }], step: false, html: true })
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
          blocks.push({ kind: 'table', level: 0, lines: [{ n: j + 1, text: row }], step: false, html: false })
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
      const parent = lists[lists.length - 1]
      const gap = width(item[1] + item[2] + item[3]) - width(item[1] + item[2])
      const content = markAt + item[2].length + (gap >= 1 && gap <= 4 ? gap : 1)
      const step = /\d/.test(item[2]) || (parent?.step ?? false)
      lists.push({ indent: markAt, content, step })
      cur = { kind: 'item', level: 0, lines: [{ n: i + 1, text: body.slice(item[0].length) }], step, html: false }
      curDepth = depth
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
    cur = { kind: owner ? 'item' : 'para', level: 0, lines: [{ n: i + 1, text }], step: owner?.step ?? false, html: false }
    curDepth = depth
  }
  flush()
  endIndented()
  return { blocks, code, defs, defList }
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
function firstAtOrAfter(sorted: number[], k: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < k) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Positions of a character in `s`, in order. */
function positionsOf(s: string, ch: string): number[] {
  const at: number[] = []
  for (let k = s.indexOf(ch); k >= 0; k = s.indexOf(ch, k + 1)) at.push(k)
  return at
}

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
 * Inline code spans (CommonMark): a run of backticks opens a span that the next run of the same
 * length closes, within one table cell. A backslash before a run makes its first backtick plain text.
 * Prose: each span becomes one CODE mark; plain: its text.
 */
function maskCode(s: string, sink: Sink, plain: boolean): string {
  if (!s.includes('`')) return s
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
  const cells = positionsOf(s, CELL)
  const nlAt = lineIndex(s)
  let out = ''
  let pos = 0
  for (let r = 0; r < runs.length; r++) {
    const at = runs[r].escaped ? runs[r].at + 1 : runs[r].at
    const len = runs[r].escaped ? runs[r].len - 1 : runs[r].len
    if (len === 0) continue
    const same = byLen.get(len) ?? []
    const q = same[firstAtOrAfter(same, r + 1)]
    if (q === undefined) continue
    const close = runs[q].at
    const cell = cells[firstAtOrAfter(cells, at)]
    if (cell !== undefined && cell < close) continue
    const raw = s.slice(at + len, close)
    let content = raw.replace(/\n/g, ' ')
    if (/^ [\s\S]*[^ ][\s\S]* $/.test(content)) content = content.slice(1, -1)
    sink.span(content, nlAt(at))
    out += s.slice(pos, at) + (plain ? content : keepNl(raw, CODE))
    pos = close + len
    r = q
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

/** A link destination after `](`: `<...>` or a run without spaces and with balanced brackets, then an optional title. */
function destination(s: string, p: number): { target: string; end: number } | null {
  let k = p + 1
  while (s[k] === ' ' || s[k] === '\t' || s[k] === '\n') k++
  let target: string
  if (s[k] === '<') {
    const e = s.indexOf('>', k)
    if (e < 0) return null
    target = s.slice(k + 1, e)
    k = e + 1
  } else {
    let depth = 0
    const start = k
    for (; k < s.length; k++) {
      const c = s[k]
      if (c === '\\') {
        k++
        continue
      }
      if (c === '(') depth++
      else if (c === ')') {
        if (depth === 0) break
        depth--
      } else if (/\s/.test(c) || c === CELL) break
    }
    target = s.slice(start, k)
  }
  while (s[k] === ' ' || s[k] === '\t' || s[k] === '\n') k++
  if (s[k] === '"' || s[k] === "'" || s[k] === '(') {
    const e = s.indexOf(s[k] === '(' ? ')' : s[k], k + 1)
    if (e < 0) return null
    k = e + 1
    while (s[k] === ' ' || s[k] === '\t' || s[k] === '\n') k++
  }
  if (s[k] !== ')') return null
  return { target, end: k + 1 }
}

/**
 * Images (`image`) or links. An image goes entirely. A link keeps its text ('keep'), loses it
 * ('drop'), or is reduced to its text in plain mode; its target goes to the sink.
 */
function maskLinks(s: string, defs: Map<string, Def>, image: boolean, mode: 'keep' | 'drop', sink: Sink): string {
  let out = ''
  const pair = bracketPairs(s)
  const nlAt = lineIndex(s)
  let i = 0
  while (i < s.length) {
    const opens = image ? s[i] === '!' && s[i + 1] === '[' : s[i] === '['
    if (!opens || escapedAt(s, i)) {
      out += s[i++]
      continue
    }
    const lb = image ? i + 1 : i
    if (!image && s[lb + 1] === '^') {
      const e = s.indexOf(']', lb)
      if (e > 0 && !s.slice(lb, e).includes(CELL)) {
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
      const d = destination(s, rb + 1)
      if (d) {
        end = d.end
        target = d.target
        inline = true
      }
    }
    if (end < 0 && s[rb + 1] === '[') {
      const e = s.indexOf(']', rb + 2)
      if (e >= 0) {
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
    if (image || mode === 'drop') out += keepNl(s.slice(i, end), ' ')
    else out += keepNl(s.slice(i, lb + 1), '') + text + keepNl(s.slice(rb, end), '')
    i = end
  }
  return out
}

const AUTOLINK = /<((?:[A-Za-z][A-Za-z0-9+.-]{1,31}):[^\s<>]*|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)>/g
const TAG = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g
const ATTR = /\b(href|src|id|name)[ \t]*=[ \t]*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi
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
    return /[\uE000-\uE00F\n]/.test(ch) ? ' ' : ch
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

/** Direct quotations: “…”, "…", ‘…’, and '…' on one line. Each becomes one QUOTE mark. */
function maskQuotes(s: string, quotes: string[]): string {
  const opensAfter = (k: number) => k === 0 || /[\s([{—–\-/\uE000-\uE00F]/.test(s[k - 1])
  // Where a quotation may close, found once per kind of mark. A closing straight quote has no space
  // before it, and a closing straight or single quote no letter after it (so "don't" closes nothing).
  // A quotation stops at a table cell; one in straight single quotes also stops at the line's end.
  const closers = (ch: string, noLetterAfter: boolean, noSpaceBefore: boolean) =>
    positionsOf(s, ch).filter(k => !(noSpaceBefore && /\s/.test(s[k - 1] ?? ' ')) && !(noLetterAfter && /[\p{L}\p{N}]/u.test(s[k + 1] ?? '')))
  const cells = positionsOf(s, CELL)
  const lineEnds = [...cells, ...positionsOf(s, '\n')].sort((a, b) => a - b)
  const kinds = new Map<string, { close: number[]; stops: number[] }>()
  const kindOf = (c: string) => {
    let k = kinds.get(c)
    if (!k) {
      if (c === '“') k = { close: closers('”', false, false), stops: cells }
      else if (c === '"') k = { close: closers('"', true, true), stops: cells }
      else if (c === '‘') k = { close: closers('’', true, false), stops: cells }
      else k = { close: closers("'", true, true), stops: lineEnds }
      kinds.set(c, k)
    }
    return k
  }
  const after = (list: number[], i: number) => list[firstAtOrAfter(list, i + 1)]
  let out = ''
  let pos = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const opens = c === '“' ||
      (c === '"' && opensAfter(i) && /\S/.test(s[i + 1] ?? '')) ||
      (c === '‘' && opensAfter(i)) ||
      (c === "'" && opensAfter(i) && /[\p{L}\p{N}]/u.test(s[i + 1] ?? ''))
    if (!opens) continue
    const kind = kindOf(c)
    const close = after(kind.close, i)
    if (close === undefined) continue
    const stop = after(kind.stops, i)
    if (stop !== undefined && stop < close) continue
    quotes.push(s.slice(i + 1, close))
    out += s.slice(pos, i) + keepNl(s.slice(i, close + 1), QUOTE)
    pos = close + 1
    i = close
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
  let s = maskCode(src, sink, plain)
  let nlAt = lineIndex(s)
  s = s.replace(CODE_ELEMENT, (m: string, _t: string, inner: string, off: number) => {
    const content = inner.replace(/<[^>]*>/g, '').replace(/\n/g, ' ')
    sink.span(content, nlAt(off))
    return plain ? content : keepNl(m, CODE)
  })
  if (!plain) s = s.replace(/\\([!-/:-@[-`{-~])/g, (_m, c: string) => (MARKUP_ESCAPES.has(c) ? ' ' : c))
  s = s.replace(/<!--[\s\S]*?-->/g, m => keepNl(m, plain ? '' : ' '))
  s = maskLinks(s, defs, true, 'keep', sink)
  const beforeLinks = s
  s = maskLinks(s, defs, false, 'keep', sink)
  nlAt = lineIndex(s)
  s = s.replace(AUTOLINK, (m: string, t: string, off: number) => {
    sink.target(t, nlAt(off))
    return plain ? t : ' '
  })
  s = maskHtml(s, sink, plain ? '' : ' ')
  if (plain) {
    s = decodeEntities(s.replace(/\\([!-/:-@[-`{-~])/g, '$1'))
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
  return { text: s, numbersFrom, quotes, nav: !/\p{L}/u.test(linkless.replace(/[\uE000-\uE00F]/g, ' ')) }
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
  /** Shaped like an identifier: camelCase, snake_case, a dot, a slash or a leading dash. */
  ident: boolean
  /** A prefix written with a hyphen, such as the "re" of "re-run". */
  prefix: boolean
  /** Which written token it came from: the words of "state-of-the-art" share one. */
  token: number
  /** The first word of its sentence. */
  start: boolean
  heading: boolean
  /** Index of its sentence in the document. */
  s: number
}
type Item =
  | Word
  | { t: 'open' | 'close' | 'dash' | 'code' | 'num'; line: number }
  | { t: 'quote'; line: number; words: Word[] }
type Sentence = { items: Item[]; line: number; words: number; syllables: number; kind: BlockKind; step: boolean; block: number }

const LEAD = /^[(\[{"'“‘*_~¡¿<>]+/
const TRAIL = /[)\]}"'”’*_~,.;:!?…<>%]+$/
const TITLES = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'vs', 'cf', 'fig', 'approx'])

type Part = { text: string; acronym: boolean; cap: boolean; ident: boolean; prefix: boolean }

/** A prefix written with a hyphen ("re-run", "non-text"): J01 and J04 do not read it as a word of its own. */
const PREFIXES = new Set(['re', 'pre', 'co', 'non', 'un', 'de', 'dis', 'sub', 'anti', 'multi', 'semi', 'mis', 'inter', 'intra', 'post', 'mid', 'ex', 'bi', 'tri'])

/**
 * The words in one written token, after its punctuation is gone. A hyphenated token gives one word
 * per part. A part with digits is a word only when shaped like an acronym ("EC2"); otherwise it is
 * a number or a code, not a word.
 */
function partsOf(core: string): Part[] {
  if (!/\p{L}/u.test(core)) return []
  const bare = core.replace(/^-+/, '')
  if (core.startsWith('-') || /[/\\.@#$%^&=+|_:~]/.test(bare) || /\p{Ll}\p{Lu}/u.test(bare)) {
    return [{ text: core, acronym: false, cap: false, ident: true, prefix: false }]
  }
  let w = core.replace(/’/g, "'")
  const neg = /^(\p{L}+)n't$/iu.exec(w)
  if (neg) w = ({ ca: 'can', wo: 'will', sha: 'shall' } as Record<string, string>)[neg[1].toLowerCase()] ?? neg[1]
  else w = w.replace(/'(?:s|re|ve|ll|d|m)$/i, '')
  const pieces = w.split(/['-]/).filter(p => p !== '')
  const prefixed = pieces.length > 1 && PREFIXES.has(pieces[0].toLowerCase())
  const out: Part[] = []
  pieces.forEach((p, i) => {
    if (/\d/.test(p)) {
      if (/^[\p{Lu}\d]+s?$/u.test(p) && (p.match(/\p{Lu}/gu)?.length ?? 0) >= 2) out.push({ text: p, acronym: true, cap: false, ident: false, prefix: false })
      return
    }
    if (!/^\p{L}+$/u.test(p)) return
    const acronym = /^\p{Lu}{2,}s?$/u.test(p)
    out.push({ text: p, acronym, cap: !acronym && /^\p{Lu}/u.test(p), ident: false, prefix: prefixed && i === 0 })
  })
  return out
}

function wordOf(p: Part, line: number, start: boolean, heading: boolean, token: number): Word {
  const lower = p.acronym ? p.text.replace(/s$/, '').toLowerCase() : p.text.toLowerCase()
  return { t: 'word', text: p.text, lower, line, acronym: p.acronym, cap: p.cap, ident: p.ident, prefix: p.prefix, token, start, heading, s: -1 }
}

/** Words of a short piece of text, without sentences (quotations, glossary entries, list entries). */
function wordsIn(text: string, line = 0): Word[] {
  const out: Word[] = []
  text.split(/\s+/).forEach((chunk, token) => {
    const core = chunk.replace(LEAD, '').replace(TRAIL, '')
    for (const p of partsOf(core)) out.push(wordOf(p, line, false, false, token))
  })
  return out
}

/**
 * Syllables in a word: the same rough rule as research/readability.py. Letters a–z only, one final
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

/**
 * Split one block's prose into sentences. A sentence ends at ".", "!", "?" or "…" when the next word
 * does not start with a small letter (so "e.g. the" and "Dr. Lee" do not end one), at a table cell
 * and at the end of the block. A word counts once for length, an inline code span or a quotation
 * counts as one word, and so does a number.
 */
function sentencesOf(text: string, quotes: string[], lineOf: (nl: number) => number, block: Block, blockIndex: number, out: Sentence[]): void {
  const heading = block.kind === 'heading'
  let sen: Sentence | null = null
  let sawWord = false
  let pending = false
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
    nl += newlines(text.slice(last, m.index))
    last = m.index!
    const line = lineOf(nl)
    const chunk = m[0]
    if (chunk === CELL) {
      end()
      continue
    }
    if (pending) {
      if (/^\p{Ll}/u.test(chunk.replace(LEAD, ''))) pending = false
      else end()
    }
    if (!sen) sen = { items: [], line, words: 0, syllables: 0, kind: block.kind, step: block.step, block: blockIndex }
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
          if (mk === CODE) s.items.push({ t: 'code', line })
          else s.items.push({ t: 'quote', line, words: wordsIn(quotes[qi++] ?? '', line) })
        }
        s.words += marks.length
        s.syllables += marks.length
      } else if (/[\p{L}\p{N}]/u.test(core)) {
        s.words++
        s.syllables += syllablesIn(core)
        const parts = partsOf(core)
        if (!parts.length) s.items.push({ t: 'num', line })
        for (const p of parts) {
          s.items.push(wordOf(p, line, !sawWord, heading, token))
          sawWord = true
        }
      }
      if (trail.includes(')')) s.items.push({ t: 'close', line })
      if (/[.!?…]/.test(trail) && !/^(?:\p{L}\.)+\p{L}$/u.test(core) && !TITLES.has(core.toLowerCase())) pending = true
    }
  }
  end()
}

// ---------------------------------------------------------------------------------------------
// The parsed document

type Doc = {
  blocks: Block[]
  sentences: Sentence[]
  /** Per block: index of its first sentence, and whether it holds only links, images and code. */
  firstSentence: number[]
  nav: boolean[]
  spans: CodeText[]
  code: CodeText[]
  links: { target: string; line: number }[]
  ids: string[]
  headings: { text: string; line: number }[]
  numbers: { value: string; line: number }[]
}

function parse(md: string): Doc {
  const p = parseBlocks(md)
  const doc: Doc = {
    blocks: p.blocks, sentences: [], firstSentence: [], nav: [], spans: [], code: p.code,
    links: p.defList.map(d => ({ target: d.target, line: d.line })), ids: [], headings: [], numbers: [],
  }
  p.blocks.forEach((b, bi) => {
    let text = b.lines.map(l => l.text).join('\n')
    if (b.kind === 'table') text = text.replace(/(?<!\\)\|/g, CELL)
    const lineOf = (nl: number) => b.lines[Math.min(nl, b.lines.length - 1)].n
    const r = inline(text, p.defs, false, {
      target: (t, nl) => doc.links.push({ target: t, line: lineOf(nl) }),
      span: (c, nl) => doc.spans.push({ text: c, line: lineOf(nl) }),
      id: id => doc.ids.push(id),
    })
    const nlAt = lineIndex(r.numbersFrom)
    for (const m of r.numbersFrom.matchAll(NUMBER)) doc.numbers.push({ value: m[0], line: lineOf(nlAt(m.index!)) })
    doc.firstSentence.push(doc.sentences.length)
    doc.nav.push(r.nav)
    sentencesOf(r.text, r.quotes, lineOf, b, bi, doc.sentences)
    if (b.kind === 'heading' && !b.html) {
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

function wordsOf(doc: Doc): Word[] {
  return doc.sentences.flatMap(s => s.items.filter((it): it is Word => it.t === 'word'))
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
 * The anchors a link's `#fragment` can reach in this Markdown, as GitHub makes them: one per heading
 * in order (a repeated heading gets "-1", "-2", …), then any HTML `id` or `name` attribute.
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
// The checks

type Ctx = {
  lists: Lists
  g: Glossary
  key(w: Word): string
  familiar(lower: string): boolean
  known(w: Word): boolean
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

function context(lists: Lists, g: Glossary, projectName?: string): Ctx {
  const knownLower = new Set<string>()
  const knownKeys = new Set<string>()
  for (const k of g.known) {
    knownLower.add(k.trim().toLowerCase())
    for (const w of wordsIn(k)) {
      knownLower.add(w.lower)
      knownLower.add(w.text.toLowerCase())
      knownKeys.add(matchKey(lists, w))
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
  return {
    lists,
    g,
    key: w => matchKey(lists, w),
    familiar: lower => isFamiliar(lists, lower, g.cutoff),
    known: w => knownLower.has(w.lower) || knownLower.has(w.text.toLowerCase()) || knownKeys.has(matchKey(lists, w)),
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

const DEFINING_VERBS = new Set(['is', 'are', 'means', 'mean'])
const ARTICLES = new Set(['a', 'an', 'the'])

/** Does this sentence define the term with this key, in one of the forms J01 accepts? */
function defines(s: Sentence | undefined, key: string, c: Ctx): boolean {
  if (!s) return false
  const it = s.items
  const isTerm = (x: Item | undefined) =>
    !!x && ((x.t === 'word' && c.key(x) === key) || (x.t === 'quote' && x.words.length === 1 && c.key(x.words[0]) === key))
  for (let j = 0; j < it.length; j++) {
    if (!isTerm(it[j])) continue
    const next = it[j + 1]
    // term (meaning)  ·  term — meaning
    if (next && (next.t === 'open' || next.t === 'dash')) return true
    // a sentence of the form "term is …" or "term means …", with "a", "an" or "the" allowed before the term
    const opens = j === 0 || (j === 1 && it[0].t === 'word' && ARTICLES.has(it[0].lower))
    if (opens && next?.t === 'word' && DEFINING_VERBS.has(next.lower)) return true
    // Full Name (TERM)
    if (it[j - 1]?.t === 'open' && next?.t === 'close' && it[j - 2]?.t === 'word') return true
  }
  return false
}

/**
 * The words that look like names: capitalised in mid-sentence and not an acronym. A sentence's
 * capitalised first word is a name too when the same word is written that way in mid-sentence
 * elsewhere (outside headings, which are often in title case), or when the next word is a name
 * ("Andrej Karpathy").
 */
function namesOf(doc: Doc): Set<Word> {
  const words = wordsOf(doc)
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
  const words = wordsOf(doc)
  const names = namesOf(doc)
  type Term = { first: Word; count: number; acronym: boolean; common: boolean }
  const terms = new Map<string, Term>()
  for (const w of words) {
    if (w.ident || w.prefix || names.has(w) || w.lower.length < 2 || c.project.has(w.lower) || c.known(w)) continue
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
  const out: Finding[] = []
  for (const [k, t] of terms) {
    if (t.common || !(t.acronym || t.count >= 2)) continue
    const m = mentions.get(k)
    const first = m && m.s < t.first.s ? m : t.first
    if (defines(doc.sentences[first.s], k, c) || defines(doc.sentences[first.s + 1], k, c)) continue
    const shown = t.first.text
    const message = t.acronym
      ? `"${shown}" is not written out where it first appears. Write it out there or in the next sentence, for example "Full Name (${shown})", or add it to "known" in ${GLOSSARY_FILE} if every reader knows it.`
      : `"${shown}" is used before it is explained. Explain it where it first appears or in the next sentence, for example "${shown} (what it means)", or use plain words. If every reader knows it, add it to "known" in ${GLOSSARY_FILE}.`
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

/** The sentences J03 and the scores read: paragraphs and list items, not headings or table cells. */
const counted = (doc: Doc) => doc.sentences.filter(s => (s.kind === 'para' || s.kind === 'item') && s.words > 0)

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
  const bi = doc.blocks.findIndex((b, i) => b.kind === 'para' && !doc.nav[i] && sentencesOfBlock(doc, i).some(s => s.items.some(it => it.t === 'word')))
  if (bi < 0) return []
  const out: Finding[] = []
  const seen = new Set<string>()
  for (const s of sentencesOfBlock(doc, bi)) {
    for (const it of s.items) {
      if (it.t !== 'word' || it.prefix || c.project.has(it.lower) || c.project.has(it.text.toLowerCase()) || c.familiar(it.lower) || c.known(it)) continue
      const k = c.key(it)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(finding('J04', it.line,
        `"${it.text}" in the opening paragraph is not a common word. Use a common word there: explaining it in the opening does not count. If every reader knows it, add it to "known" in ${GLOSSARY_FILE}.`,
        it.text, c.replacementsFor(k)))
    }
  }
  return out
}

function normBlock(text: string): string {
  const ls = trimBlankLines(text.split('\n').map(l => l.replace(/[ \t]+$/, '')))
  const widths = ls.filter(l => l.trim()).map(width)
  const pad = widths.length ? Math.min(...widths) : 0
  return ls.map(l => dedent(l, pad)).join('\n')
}

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p

function j05(orig: Doc, rew: Doc, rewText: string, moved: { path: string; text: string; doc: Doc }[], inbound: { from: string; fragment?: string }[]): Finding[] {
  const out: Finding[] = []
  const docs = [rew, ...moved.map(m => m.doc)]
  const numbers = new Set([rewText, ...moved.map(m => m.text)].flatMap(t => [...t.matchAll(NUMBER)].map(m => m[0])))
  const spans = new Set(docs.flatMap(d => d.spans.map(s => s.text)))
  const blocks = docs.flatMap(d => d.code.map(b => normBlock(b.text)))
  const targets = new Set(docs.flatMap(d => d.links.map(l => l.target)))
  const seen = new Set<string>()
  const first = (k: string) => !seen.has(k) && !!seen.add(k)

  for (const n of orig.numbers) {
    if (first(`n${n.value}`) && !numbers.has(n.value)) {
      out.push(finding('J05', n.line, `The number ${n.value} on line ${n.line} of the original is in neither the rewrite nor a file the detail moved to.`, n.value))
    }
  }
  for (const s of orig.spans) {
    if (!s.text.trim() || !first(`s${s.text}`) || spans.has(s.text) || blocks.some(b => b.includes(s.text))) continue
    out.push(finding('J05', s.line, `The code "${s.text}" on line ${s.line} of the original is in neither the rewrite nor a file the detail moved to.`, s.text))
  }
  for (const b of orig.code) {
    const norm = normBlock(b.text)
    if (!norm || !first(`c${norm}`) || blocks.some(h => h.includes(norm))) continue
    out.push(finding('J05', b.line, `The code block on line ${b.line} of the original is missing or changed. Keep code exactly as it was.`))
  }
  // A link to a heading that moved: the rewrite now links to that heading in the moved file. The
  // link's file is matched to a moved file by file name only, because the checker is not given the
  // document's own path to resolve relative links against; the moved file sits beside the original.
  const movedTo = (fragment: string) => rew.links.some(l => {
    const t = splitTarget(l.target)
    if (!t.target || t.fragment === undefined || fragmentKey(t.fragment) !== fragmentKey(fragment)) return false
    return moved.some(m => baseName(m.path) === baseName(t.target) && resolves(anchorsOfDoc(m.doc), fragment))
  })
  for (const l of orig.links) {
    if (!first(`l${l.target}`) || targets.has(l.target)) continue
    if (l.target.startsWith('#') && movedTo(l.target.slice(1))) continue
    out.push(finding('J05', l.line, `The link to "${l.target}" on line ${l.line} of the original is in neither the rewrite nor a file the detail moved to.`, l.target))
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
  return out
}

function j07(doc: Doc, c: Ctx): Finding[] {
  const ix = replacementIndex(c.lists)
  const hits = new Map<Entry, Word[][]>()
  const scan = (run: Word[]) => {
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
      if (ix.exceptions.has(phrase) || (ws.length === 1 && (ix.exceptions.has(c.key(ws[0])) || c.known(ws[0]) || c.project.has(ws[0].lower)))) continue
      const list = hits.get(match) ?? []
      list.push(ws)
      hits.set(match, list)
    }
  }
  for (const s of doc.sentences) {
    let run: Word[] = []
    for (const it of s.items) {
      if (it.t === 'word') run.push(it)
      else {
        scan(run)
        run = []
      }
    }
    scan(run)
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
      `"${shown}" has a plainer option: ${offer}.${notes}${unless} This is a suggestion only: keep the word if a swap would change the meaning.${more}`,
      shown, e.r.to))
  }
  return out
}

const round1 = (x: number) => Math.round(x * 10) / 10

function scoresOf(doc: Doc): Scores {
  const ss = counted(doc)
  const words = ss.reduce((n, s) => n + s.words, 0)
  const syl = ss.reduce((n, s) => n + s.syllables, 0)
  const sentences = ss.length
  if (!words) return { flesch: 0, grade: 0, avgSentence: 0, longestSentence: 0, words: 0, sentences: 0 }
  const perSentence = words / sentences
  const perWord = syl / words
  return {
    flesch: round1(206.835 - 1.015 * perSentence - 84.6 * perWord),
    grade: round1(0.39 * perSentence + 11.8 * perWord - 15.59),
    avgSentence: round1(perSentence),
    longestSentence: Math.max(...ss.map(s => s.words)),
    words,
    sentences,
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const scoreText = (s: Scores) => `reading ease ${s.flesch}, grade ${s.grade}, average sentence ${s.avgSentence} words, longest ${s.longestSentence} words`

/**
 * Run the checks on a document. J06 is never a finding: its scores are in `scores` and, with
 * "before" scores when `original` is given, in `summary`.
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
  const codes = new Set<Code>(input.codes ?? ALL_CODES)
  const doc = parse(input.text)
  const c = context(input.lists, g, input.projectName)
  const findings: Finding[] = []
  if (codes.has('J01')) findings.push(...j01(doc, c))
  if (codes.has('J02')) findings.push(...j02(doc, c))
  if (codes.has('J03')) findings.push(...j03(doc, c))
  if (codes.has('J04')) findings.push(...j04(doc, c))
  const orig = input.original !== undefined ? parse(input.original) : undefined
  if (codes.has('J05') && orig) {
    const moved = (input.moved ?? []).map(m => ({ ...m, doc: parse(m.text) }))
    findings.push(...j05(orig, doc, input.text, moved, input.inbound ?? []))
  }
  if (codes.has('J07')) findings.push(...j07(doc, c))
  const order = (f: Finding) => ALL_CODES.indexOf(f.code)
  findings.sort((a, b) => a.line - b.line || order(a) - order(b))
  const scores = scoresOf(doc)

  const errors = findings.filter(f => f.severity === 'error').length
  const per = ALL_CODES.filter(k => findings.some(f => f.code === k)).map(k => `${k}: ${findings.filter(f => f.code === k).length}`)
  let summary = findings.length
    ? `${plural(errors, 'error')} and ${plural(findings.length - errors, 'warning')} (${per.join(', ')}).`
    : 'No findings.'
  if (codes.has('J06')) {
    summary += ` Scores, for information only: ${scoreText(scores)}`
    summary += orig ? `; before the rewrite, ${scoreText(scoresOf(orig))}.` : '.'
  } else if (codes.has('J03')) summary += ` Longest sentence: ${scores.longestSentence} words.`
  if (codes.has('J05') && !orig) summary += ' J05 did not run: there is no saved original.'
  return { findings, scores, summary }
}

/**
 * Session mode's check on one reply: J01, J03 and J07 on its prose (code and quotations skipped).
 * `ok` is true when nothing was found. `findings` holds at most `cap` of them, errors first, and
 * `more` counts the rest; `note` is one line for the person, such as
 * "jargone: 3 undefined terms, longest sentence 41 words".
 */
export function replyNote(text: string, lists: Lists, glossary: Glossary = DEFAULT_GLOSSARY, cap = 10): { ok: boolean; note: string; findings: Finding[]; more: number } {
  const r = checkText({ text, lists, glossary, codes: ['J01', 'J03', 'J07'] })
  const all = [...r.findings].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) || a.line - b.line)
  const n = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 10
  const findings = all.slice(0, n)
  const count = (k: Code) => all.filter(f => f.code === k).length
  const parts: string[] = []
  if (count('J01')) parts.push(plural(count('J01'), 'undefined term'))
  if (count('J03')) parts.push(`longest sentence ${r.scores.longestSentence} words`)
  if (count('J07')) parts.push(plural(count('J07'), 'word has a plainer option', 'words have a plainer option'))
  return { ok: all.length === 0, note: `jargone: ${parts.length ? parts.join(', ') : 'nothing to flag'}`, findings, more: all.length - findings.length }
}

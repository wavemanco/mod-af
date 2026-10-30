// Small pure helpers shared by the checker and the renderer. No `$`, no Node.

/** Escape text for HTML element content and double-quoted attributes. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Collapse runs of whitespace and trim, so quotes match across line wraps and indentation. */
export function normWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export function isBlank(s: unknown): boolean {
  return typeof s !== 'string' || s.trim().length === 0
}

/** Absolute on POSIX (`/x`), Windows (`C:\x`, `C:/x`) or UNC (`\\host\x`). */
export function isAbsPath(p: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(p)
}

/** The folder part of a path, with forward slashes. */
export function dirname(p: string): string {
  const s = p.replace(/\\/g, '/')
  const i = s.lastIndexOf('/')
  if (i < 0) return '.'
  if (i === 0) return '/'
  if (/^[A-Za-z]:$/.test(s.slice(0, i))) return s.slice(0, i + 1)
  return s.slice(0, i)
}

/**
 * Resolve `rel` against `base` (an absolute rel wins), normalising `.` and `..` and using forward
 * slashes. Leading `..` that would climb above an absolute root are dropped, as a shell would.
 */
export function joinPath(base: string, rel: string): string {
  const raw = isAbsPath(rel) ? rel : `${base.replace(/[\\/]+$/, '')}/${rel}`
  const s = raw.replace(/\\/g, '/')
  let prefix = ''
  let rest = s
  const drive = /^([A-Za-z]:)\//.exec(s)
  if (drive) { prefix = `${drive[1]}/`; rest = s.slice(prefix.length) }
  else if (s.startsWith('//')) { prefix = '//'; rest = s.slice(2) }
  else if (s.startsWith('/')) { prefix = '/'; rest = s.slice(1) }
  const out: string[] = []
  for (const part of rest.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
      else if (!prefix) out.push('..')
      continue
    }
    out.push(part)
  }
  const joined = prefix + out.join('/')
  return joined === '' ? '.' : joined
}

/** True when `p` (already joined) lies inside `root` (already joined). */
export function isInside(root: string, p: string): boolean {
  const r = root.replace(/\/+$/, '')
  return p === r || p.startsWith(`${r}/`) || r === '.' && !p.startsWith('..') && !isAbsPath(p)
}

/** Parse a line reference: 12, "12", "12-20". Returns null when malformed. 1-based, inclusive. */
export function parseLines(v: unknown): [number, number] | null {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return [v, v]
  if (typeof v !== 'string') return null
  // Spaces and tabs only, so a value carrying a line break is refused, not read as a range.
  const m = /^[ \t]*(\d+)[ \t]*(?:[-–][ \t]*(\d+))?[ \t]*$/.exec(v)
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  if (a < 1 || b < a) return null
  return [a, b]
}

/** A number as read: its value, where it stands, its text as written, and for an item of a list in
 *  code, where that list's opening bracket stands (so a message can show the list it was split from). */
export type NumberToken = { value: number; start: number; end: number; text: string; list?: number }

const ISO_DATE = /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?(?!\d)/g
// in order: a grouped number (1,000 or 10_000, with any decimals), only when the whole run of digits and
// that separator is one ("1,500,25" and "1,8,120" are lists; "[1_000,2_000]" is two groupings); a hex,
// octal or binary literal; a plain number with an optional exponent (12, 2.5, 1e5, 1.5e-3, 1E+3)
const EXPONENT = String.raw`[eE][+\-−]?\d+`
const NUMBER = new RegExp(String.raw`(?<!\d,)\d{1,3},\d{3}(?:,\d{3})*(?:\.\d+)?(?!\d|,\d)|(?<!\d_)\d{1,3}_\d{3}(?:_\d{3})*(?:\.\d+)?(?!\d|_\d)|0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|\d+(?:\.\d+)?(?:${EXPONENT})?`, 'g')
// digits with no point, separator or prefix: what may follow a leading dot (".5", ".5e3")
const BARE = new RegExp(String.raw`^\d+(?:${EXPONENT})?$`)
// Chinese, Japanese, Korean, Thai, Lao, Khmer and Myanmar put no space between words, so one of their
// letters next to a number is a word boundary, never part of an identifier
const NO_SPACE_SCRIPTS = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\p{Script=Thai}\\p{Script=Lao}\\p{Script=Khmer}\\p{Script=Myanmar}'
const NO_SPACE = new RegExp(`[${NO_SPACE_SCRIPTS}]`, 'u')
const idLetter = (c: string): boolean => /\p{L}/u.test(c) && !NO_SPACE.test(c)
const wordish = (c: string): boolean => /[\p{L}\p{N}_)\].]/u.test(c) && !NO_SPACE.test(c)

/** -1 or 1 when text[i] is a minus or plus sign, 0 when it is anything else (a hyphen follows a word, a digit or a bracket). */
export function signAt(text: string, i: number): -1 | 0 | 1 {
  const c = text[i] ?? ''
  if ((c !== '-' && c !== '−' && c !== '+') || wordish(text[i - 1] ?? '')) return 0
  return c === '+' ? 1 : -1
}
const UNIT = new RegExp(`^(?:(?![${NO_SPACE_SCRIPTS}])[\\p{L}%µ])+`, 'u')

// The zero of every run of ten decimal digits in the Basic Multilingual Plane (Unicode keeps each
// script's 0-9 contiguous): Arabic-Indic, Extended Arabic-Indic, NKo, Devanagari, Bengali … Thai …
// fullwidth (the last, U+FF10, is what NFKC folds to ASCII).
const DIGIT_ZEROS = [
  0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xde6, 0xe50, 0xed0, 0xf20,
  0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50,
  0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0xff10,
]

/**
 * Decimal digits of any script as ASCII, and the Arabic decimal and thousands separators (U+066B,
 * U+066C) as "." and ",", one character for one, so every position is kept. Digits outside the Basic
 * Multilingual Plane (mathematical bold, Osmanya…) take two code units and are left as they are, so
 * they are not read as numbers.
 */
export function asciiDigits(s: string): string {
  return s.replace(/[\p{Nd}\u066b\u066c]/gu, ch => {
    if (ch === '\u066b') return '.'
    if (ch === '\u066c') return ','
    if (ch.length !== 1 || ch <= '9') return ch
    const c = ch.charCodeAt(0)
    const z = DIGIT_ZEROS.find(z0 => c >= z0 && c < z0 + 10)
    return z === undefined ? ch : String.fromCharCode(0x30 + c - z)
  })
}

/**
 * The numbers in a text, read as a reader would, each once: "1,000" and "10_000" are one number,
 * "2.5" and ".5" are decimals, "-1" is negative, "1e5", "1.5e-3", "0x1F", "0o17" and "0b101" are
 * read by their value, and a short unit glued on ("900s", "10ms", "4GB", "3x") ends the number.
 * Digits of any script count ("９", "٩", "١٢٫٥"), and a letter of a script written without spaces
 * (Chinese, Japanese, Korean, Thai, Lao, Khmer, Myanmar) next to a number is a word boundary
 * ("容纳4096个"). Not numbers: digits inside an identifier ("v2", "x86", "k8s", "UTF-8", "HTTP/2",
 * "x1e5"), the parts of a dotted version after the first ("1.2.3"), and ISO dates ("2026-10-22").
 * Formats are read as English: "1.000" is 1 and "3,5" is 3 and 5.
 *
 * A comma grouping is one number unless it is an item of a list in code (see listItem), which gives
 * its items: "[100,250,500]" is 100, 250 and 500, "f(1,500)" 1 and 500, but "(up to 1,500 jobs)",
 * "limit (1,500)", a quoted "1,500" and a "1,500" in a comment are 1500. The page and its sources are
 * read with this one function, so identical text has one reading wherever it stands: "[1,500]" on the
 * page is 1 and 500. Known limits: a bracket written inside a string or a comment still opens a list
 * ("see [1,000, 5,000]" gives 1, 0, 5 and 0), a "(" after a closing bracket is prose
 * ("handlers[0](1,500)" gives 0 and 1500), and a comment is known by its marker alone, so a "//" or
 * "#" that is no comment (Python's floor division) reads the rest of its line as prose.
 */
export function numberTokens(s: string): NumberToken[] {
  const text = asciiDigits(s).replace(ISO_DATE, m => ' '.repeat(m.length))
  const out: NumberToken[] = []
  const brackets = bracketScan(text)
  NUMBER.lastIndex = 0
  for (let m = NUMBER.exec(text); m; m = NUMBER.exec(text)) {
    let start = m.index
    const end = start + m[0].length
    const b1 = text[start - 1] ?? ''
    const b2 = text[start - 2] ?? ''
    if (idLetter(b1)) continue
    if (b1 === '.' && /\d/.test(b2)) continue
    if ((b1 === '-' || b1 === '/') && idLetter(b2)) continue
    const a1 = text[end] ?? ''
    if (a1 === '_') continue
    if (idLetter(a1) || a1 === '%' || a1 === 'µ') {
      const unit = UNIT.exec(text.slice(end))![0]
      const next = text[end + unit.length] ?? ''
      if (unit.length > 5 || (/[\p{L}\p{N}_]/u.test(next) && !NO_SPACE.test(next))) continue
    }
    let digits = m[0].replace(/[,_]/g, '').replace('−', '-')
    // ".5" is a half when the dot follows no digit, dot or word ("x.5" and "1..5" keep their 5)
    if (b1 === '.' && BARE.test(m[0]) && !(idLetter(b2) || /[\p{N}_.]/u.test(b2))) { start -= 1; digits = `0.${digits}` }
    const sign = signAt(text, start - 1)
    if (sign) start -= 1
    const list = m[0].includes(',') ? listItem(text, start, end, brackets) : -1
    if (list >= 0) {
      // each item keeps its own place; the sign belongs to the first
      let at = m.index
      m[0].split(',').forEach((part, k) => {
        const from = k === 0 ? start : at
        out.push({ value: (k === 0 ? sign || 1 : 1) * Number(part), start: from, end: at + part.length, text: s.slice(from, at + part.length), list })
        at += part.length + 1
      })
      continue
    }
    out.push({ value: (sign || 1) * Number(digits), start, end, text: s.slice(start, end) })
  }
  // a run too long to be one number (Infinity) is dropped only here, after a list has been split
  return out.filter(t => Number.isFinite(t.value))
}

/** The values of the numbers in a text (see numberTokens). */
export function numbersIn(s: string): number[] {
  return numberTokens(s).map(t => t.value)
}

const CLOSER: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const SPACE = /\s/

type Brackets = { openAt: (pos: number) => number; isList: (at: number) => boolean; inProse: () => boolean }

/**
 * Whether text[i] opens or closes a string: " and ` unless escaped (\"); ' unless escaped or an
 * apostrophe (between letters or digits: "queue's"), though after a string prefix (f'…', rb'…') it
 * opens one.
 */
function stringQuote(text: string, i: number): boolean {
  const c = text[i]
  if (text[i - 1] === '\\') return false
  if (c === '"' || c === '`') return true
  if (c !== "'") return false
  if (!(/[\p{L}\p{N}]/u.test(text[i - 1] ?? '') && /[\p{L}\p{N}]/u.test(text[i + 1] ?? ''))) return true
  return /(?:^|[^\p{L}\p{N}_])[bBfFrRuU]{1,2}$/u.test(text.slice(Math.max(0, i - 3), i))
}

/**
 * The innermost open bracket before each position, for positions asked in increasing order: one pass
 * over the text in all. A closer with no open bracket of its kind is ignored; one that has closes it
 * and every bracket opened after it. Each bracket's listBracket verdict is worked out once, so a long
 * list after a long run of spaces stays linear. Quote marks and comment markers are noted on the way,
 * so whether the last position asked is inside a string or a comment opened since the innermost open
 * bracket is known at once.
 */
function bracketScan(text: string): Brackets {
  const open: number[] = []
  const count: Record<string, number> = { '(': 0, '[': 0, '{': 0 }
  const opener: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const verdict = new Map<number, boolean>()
  // one bit per kind of quote mark, flipped by each: its value now, and at each open bracket
  const BIT: Record<string, number> = { '"': 1, '`': 2, "'": 4 }
  let parity = 0
  const parityAt: number[] = []
  // where the open line comment (#, // or -- to the line's end) and block comment (/* to its end)
  // start, or -1. A marker is looked for anywhere outside a string, and each one restarts its kind.
  // Quote marks inside an open comment are not counted, so a quotation wrapping across comment lines,
  // or an apostrophe in one, cannot leave a string open that turns later comment text into code. A
  // marker that is no comment can still mislead: a "/*" that opens nothing stops the count of quotes
  // until the next "*/", so a string after it may be read as code (rare; not met in real files).
  let line = -1
  let block = -1
  let i = 0
  const inString = (): boolean => parityAt.length > 0 && parity !== parityAt[parityAt.length - 1]
  return {
    isList(at: number): boolean {
      let v = verdict.get(at)
      if (v === undefined) { v = listBracket(text, at); verdict.set(at, v) }
      return v
    },
    inProse(): boolean {
      const top = open.length ? open[open.length - 1] : -1
      return inString() || line > top || block > top
    },
    openAt(pos: number): number {
      for (; i < pos; i++) {
        const c = text[i]
        const d = text[i + 1]
        if (c === '\n') line = -1
        else if (c === '*' && d === '/' && i > block + 1) block = -1
        if (c in BIT && line < 0 && block < 0 && stringQuote(text, i)) parity ^= BIT[c]
        else if (c in CLOSER) { open.push(i); parityAt.push(parity); count[c]++ }
        else if (c in opener && count[opener[c]] > 0) {
          for (let top = open.pop()!; ; top = open.pop()!) { parityAt.pop(); count[text[top]]--; if (text[top] === opener[c]) break }
        }
        else if ((c === '#' || (c === '/' || c === '-') && d === c) && !inString()) line = i
        else if (c === '/' && d === '*' && !inString()) block = i
      }
      return open.length ? open[open.length - 1] : -1
    },
  }
}

/**
 * Whether the bracket at text[at] opens a list in code: "[" or "{" always; "(" when it follows "=",
 * a comma or an opening bracket (spaces between allowed: "x = (1,500)", "f(a, (640,480))",
 * "((128,256))"), a name with no space (a call: "range(1,100)"), or the SQL keywords IN or VALUES,
 * in capitals ("IN (500,502,503)"). Anything else is prose: "limit (1,500)", "costs: (1,500)".
 */
function listBracket(text: string, at: number): boolean {
  if (text[at] !== '(') return true
  const b1 = text[at - 1] ?? ''
  if (idLetter(b1) || /[\p{N}_]/u.test(b1)) return true
  let k = at - 1
  while (k >= 0 && SPACE.test(text[k])) k--
  if (k < 0) return false
  if ('=,([{'.includes(text[k])) return true
  return k < at - 1 && /(?:^|[^\p{L}\p{N}_])(?:IN|VALUES)$/u.test(text.slice(Math.max(0, k - 6), k + 1))
}

/**
 * Where the list opens when the number at text[start, end) is an item of a list in code, else -1: its
 * innermost open bracket opens a list (listBracket), and, skipping spaces and line ends, it stands
 * after that bracket or a comma and before a comma or the bracket's closer, and not inside a string
 * or a comment opened after that bracket. A quoted string is read as prose: a quote mark is never a
 * boundary (["1,000","5,000"] gives 1000 and 5000), and a list of numbers inside a string is prose too:
 * f("one of 1,000, 5,000, 10,000") gives 1000, 5000 and 10000. So is a comment, guessed by its marker
 * outside a string (#, // or -- to the end of the line, or a /* block): "{ // waits 1,000, 2,000 ms"
 * gives 1000 and 2000. A bracket written inside a string or a comment is still a bracket, so
 * "see [1,000, 5,000]" splits.
 */
function listItem(text: string, start: number, end: number, brackets: Brackets): number {
  const at = brackets.openAt(start)
  if (at < 0) return -1
  let l = start - 1
  while (l > at && SPACE.test(text[l])) l--
  if (l !== at && text[l] !== ',') return -1
  let r = end
  while (r < text.length && SPACE.test(text[r])) r++
  return (text[r] === ',' || text[r] === CLOSER[text[at]]) && brackets.isList(at) && !brackets.inProse() ? at : -1
}

/**
 * The list whose bracket opens at s[at], as written, up to the bracket's closer (or the end of s), cut
 * to max characters: what a message shows so a split item can be told from the grouping it came from.
 */
export function listText(s: string, at: number, max = 60): string {
  const want: string[] = []
  let i = at
  for (; i < s.length; i++) {
    const c = s[i]
    if (c in CLOSER) want.push(CLOSER[c])
    else if (want.includes(c)) {
      while (want.pop() !== c);
      if (!want.length) break
    }
  }
  const whole = s.slice(at, i + 1)
  return whole.length > max ? `${whole.slice(0, max - 1)}…` : whole
}

/**
 * Split text into lines as the Read tool numbers them: at \n, with \r\n as one ending. A lone \r stays
 * inside its line (Read, grep -n and cat -n all agree), so a cited line number means the same here.
 */
export function splitLines(s: string): string[] {
  return s.split(/\r?\n/)
}

/** Rough display width of one character, in ems: wide scripts and emoji take a full em. */
export function charEm(ch: string): number {
  const c = ch.codePointAt(0) ?? 0
  if ((c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || c >= 0x1f300) return 1
  if (ch === ' ') return 0.32
  if (/[mwMW@]/.test(ch)) return 0.9
  if (/[il.,:;'|!]/.test(ch)) return 0.3
  if (/\p{Lu}/u.test(ch)) return 0.7
  return 0.58
}

/** Estimated width of a string in pixels at a font size. */
export function textWidth(s: string, size: number): number {
  let em = 0
  for (const ch of s) em += charEm(ch)
  return Math.max(8, em * size)
}

/** The last part of a path. */
export function basename(p: string): string {
  const s = p.replace(/\\/g, '/').replace(/\/+$/, '')
  return s.slice(s.lastIndexOf('/') + 1)
}

/** A 53-bit content fingerprint (cyrb53), as hex: enough to tell whether a file changed, not a security hash. */
export function fingerprint(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

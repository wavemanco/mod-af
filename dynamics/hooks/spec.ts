// The dynamics/1 checker. One parse, staged checks, everything derived once and handed to the
// renderer. Pure apart from `check`, which reads files through the `Io` it is given.
//
// Rule codes and the sources behind them are listed in REFERENCES.md and the README.

import { SECTIONS, STATUS_DOC, type Field, type SectionName } from './fields.ts'
import { enumerateCycles, loopType, type Edge, type Sign } from './graph.ts'
import { asciiDigits, basename, dirname, isAbsPath, isBlank, joinPath, listText, normWs, numberTokens, parseLines, signAt, splitLines, type NumberToken } from './text.ts'

export const SPEC = 'dynamics/1'
const MAX_CYCLES = 400
const MAX_ISSUES = 40
const BUSY_FIGURE = 12
const MAX_PER_FIGURE = 40
const MAX_ELEMENTS = 400
const MAX_DESIGNED = 30
const MAX_LOOPS_PER_FIGURE = 40

// ------------------------------------------------------------------------------------- types

export type Kind = 'stock' | 'aux' | 'constant' | 'cloud' | 'shadow'
export type Status = 'observed' | 'modelled' | 'intended' | 'missing'

export type Evidence = {
  root?: string
  path?: string
  lines?: string
  quote: string
  kind?: string
  url?: string
  from?: string
}

type Common = { id: string; status: Status; claim?: string; evidence: Evidence[]; emphasis?: string; detail?: string; component?: string }
export type Node = Common & {
  kind: Kind; figure: string; at: [number, number]; label: string; units?: string; value?: string
  of?: string; why_outside?: string; label_at?: string
}
export type Flow = Common & { from: string; to: string; label: string; units?: string; valve: number; route?: string; label_at?: string; figure: string }
export type Link = Common & { from: string; to: string; polarity: '+' | '-'; mechanism: string; label?: string; delay: boolean; bend?: number; figure: string }
export type Loop = { id: string; name: string; path: string[]; story?: string; minor: boolean; goal?: string; marker_at?: [number, number] }
export type Figure = { id: string; title: string; question: string; caption?: string }

export type Model = {
  spec: string
  title: string
  subject: { name: string; kind: string; roots: Record<string, string>; ref?: string; dirty?: boolean; date: string }
  question: string
  answer: { text: string; loops: string[] }
  horizon?: string
  time_unit?: string
  audience?: string
  reference_modes: { variable: string; pattern: string; basis: string; why?: string; evidence: Evidence[] }[]
  boundary: { excluded: { name: string; why: string }[] }
  emphasis?: { name: string; rule: string }
  figures: Figure[]
  nodes: Node[]
  flows: Flow[]
  links: Link[]
  loops: Loop[]
  review?: { rounds?: number; agreed?: number; independent?: boolean; visual?: boolean; note?: string }
  notes: string[]
}

export type Issue = { code: string; level: 'error' | 'warning'; where: string; message: string; source?: string }

export type LoopReport = {
  id?: string
  name?: string
  minor?: boolean
  figure: string
  path: string[]
  /** via[i] is the link or flow that joins path[i] to path[i + 1] (cyclically). */
  via: string[]
  type: 'R' | 'B'
  stocks: string[]
  /** Element ids: the loop's vertices and the links and flows between them. */
  members: string[]
  /** live: built and running (observed or modelled parts). designed: needs an intended or missing part. */
  kind: 'live' | 'designed'
  modelled: boolean
  hedge?: string
  /** Generated all-else-equal trace, e.g. "more Queued jobs → more dispatched (+) → fewer Queued jobs (drains)". */
  trace: string
  declared: boolean
}

/**
 * A live loop the model has not declared. It carries the route (each step's mechanism) but no verdict:
 * the modeller traces a change around it from the mechanisms, decides R or B, and the check then
 * compares that judgement with the signs (L04).
 */
export type UndeclaredLoop = { figure: string; path: string[]; route: string; declare: Record<string, unknown> }

export type Report = {
  ok: boolean
  summary: string
  spec: string
  model_path: string
  errors: Issue[]
  warnings: Issue[]
  more: { errors: number; warnings: number }
  skipped: string[]
  loops: LoopReport[]
  undeclared: UndeclaredLoop[]
  designed: LoopReport[]
  boundary: {
    endogenous: { id: string; loops: string[] }[]
    exogenous: string[]
    sources_and_sinks: string[]
    not_built: string[]
    excluded: { name: string; why: string }[]
  }
  counts: Record<string, number>
  not_checked: string[]
}

export type Analysis = { report: Report; model?: Model; roots?: Record<string, string> }

/** The largest file the check reads, model or source. Claude Code's Read tool also reads whole lines
 *  only, so a file with a single line too long for one Read call cannot be read at any size. */
export const MAX_SOURCE_BYTES = 2_000_000
/** The furthest grid cell a node may sit in: far beyond any figure a reader can take in. */
const MAX_CELL = 100

/**
 * What reading a file gave: its text; or the engine's refusal (the person's rules, mode, hooks or
 * dialog said no); or a failure (missing, not text, too large), each in the engine's own words.
 */
export type ReadResult = { text: string } | { refused: string } | { failed: string }

export type Io = { read: (path: string) => Promise<ReadResult> }

export const NOT_CHECKED = [
  'whether each quote supports what is drawn (the facts review does that)',
  'whether labels, details, claims, mechanisms, stories and the answer are true (prose is not machine-checked)',
  'behaviour over time: this is a model of structure; nothing is simulated',
  'dimensions of variables, constants and links (there are no equations)',
  'evidence was read from the files on disk when the check ran; subject.ref is declared, not verified',
  'whether a saved extract (evidence with "from") is the original\'s own words: quotes are checked against the extract only',
  'numbers in the title, question, horizon, loop goals, figure titles and questions, units, component names and the review note (the modeller\'s framing)',
  'claims, and the reasons given for suspected behaviour: the modeller\'s statements, printed as such',
  'whether a number in page-wide prose (the answer, captions, notes, boundary reasons, cloud labels) comes from the element it is about: it is matched against every checked quote and modelled claim in the model',
  'numbers written as compound durations (1m30s) or versions with more than two parts (1.2.3), in prose: they are not compared, and a constant\'s value written so must appear whole, and with its sign, where its quote was found in the file (or in its claim, when not observed); hex, octal, binary and scientific forms (0x10, 1e3) are compared by value',
  'numbers in a locale\'s own format: every number is read as English, so "1.000" is 1, "3,5" is 3 and 5 and "1 500" is 1 and 500; digits joined by commas in threes are one number, on the page as in the sources and quoted or not ("8,120" in a CSV row is 8120, "500,502,503" in a string is one number), unless they stand between commas or brackets in a list in code: [ ], { }, or ( after =, a comma, an opening bracket, a call\'s name, IN or VALUES, and not in a string or a comment opened after that bracket ("[100,250,500]" and "f(1,500)" give their items; "limit (1,500)" is 1500)',
  'brackets in prose: the page is read as its sources are, so digits in [ ] or { } on the page are list items ("[1,500]" in the answer is 1 and 500; write one number outside brackets, and a list as plain numbers: [1000, 5000]); a bracket written inside a string still opens a list ("see [1,000, 5,000]" gives 1, 0, 5 and 0); and a ( after a closing bracket is prose (the (1,500) of handlers[0](1,500) or make_clamp(n)(1,500) is 1500)',
  'comments, on the page as in the sources: a comment is read as prose, as a string is, and is guessed by its marker alone, outside a string (#, // or -- to the end of the line; /* to */), and quote marks inside it are not counted, so "// waits 500, 1,000, 2,000 ms" inside a function body or a list gives 500, 1000 and 2000; a bracket written inside a comment still opens a list (so a Lua --[[ ]] block is read as code on every line, its [[ being a list bracket); a marker that is no comment (Python\'s floor division //, a # that is not a comment, a decrement --) makes the items after it, in a bracket opened before it, read as prose to the end of its line (after /*, to the next */), so such a list is one number and a page that gives its items gets a false warning, while a bracket opened after the marker is still read as code; and a /* that opens no comment stops the count of quote marks until the next */, so a string after it may be read as code',
]

// ------------------------------------------------------------------------------ shape (stage S)

const ID_RE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function typeOk(f: Field, v: unknown): boolean {
  switch (f.type) {
    case 'string': return typeof v === 'string'
    case 'number': return typeof v === 'number' && Number.isFinite(v)
    case 'boolean': return typeof v === 'boolean'
    case 'object': return isObj(v)
    case 'array': return Array.isArray(v)
    case 'strings': return Array.isArray(v) && v.every(x => typeof x === 'string')
    case 'cell': return Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= MAX_CELL)
    case 'map': return isObj(v) && Object.keys(v).length > 0 && Object.values(v).every(x => typeof x === 'string' && x.trim().length > 0)
    case 'lines': return typeof v === 'string' || (typeof v === 'number' && Number.isInteger(v) && v > 0)
  }
}

const EXPECT: Record<string, string> = {
  string: 'text', number: 'a number', boolean: 'true or false', object: 'an object', array: 'a list',
  strings: 'a list of text', cell: '[column, row] with numbers from 0 to 100', map: 'an object of name → path, at least one',
  lines: '"12", "12-20" or a line number',
}

/** Edit distance with adjacent swaps (Damerau-Levenshtein, optimal string alignment). */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
  }
  return d[a.length][b.length]
}

/** The real field an unknown key is probably a misspelling of: within two edits of the whole name. */
function near(name: string, known: readonly string[]): string | undefined {
  const n = name.toLowerCase()
  let best: string | undefined
  let bestD = 3
  for (const k of known) {
    const d = editDistance(n, k.toLowerCase())
    if (d < bestD && d <= (k.length <= 4 ? 1 : 2)) { best = k; bestD = d }
  }
  return best
}

/** Validate an object against its section: types, enums, always-required fields, unknown keys. */
function shapeOf(section: SectionName, v: unknown, where: string, issues: Issue[]): void {
  const s = SECTIONS[section]
  if (!isObj(v)) { issues.push({ code: 'S01', level: 'error', where, message: `must be an object (${s.title}).` }); return }
  const known = s.fields.map(f => f.name)
  // an unknown key is ignored, with a warning; no field has a default that a misspelling could fall back
  // to unnoticed (status, the one that changes meaning, is required), so a typo cannot change the model
  for (const key of Object.keys(v)) if (!known.includes(key)) {
    const guess = near(key, known)
    issues.push({ code: 'S05', level: 'warning', where: `${where}.${key}`, message: guess ? `unknown field "${key}"; did you mean "${guess}"? It is ignored.` : `unknown field "${key}"; it is ignored.` })
  }
  if (section === 'node' && v.kind !== 'cloud' && v.kind !== 'shadow' && (v.status === undefined || v.status === null))
    issues.push({ code: 'S01', level: 'error', where: `${where}.status`, message: `"status" is required on every stock, variable and constant: ${STATUS_DOC}` })
  for (const f of s.fields) {
    const val = v[f.name]
    const w = `${where}.${f.name}`
    if (val === undefined || val === null) {
      if (f.required === true) issues.push({ code: 'S01', level: 'error', where: w, message: `"${f.name}" is required: ${f.doc}` })
      continue
    }
    if (!typeOk(f, val)) { issues.push({ code: 'S01', level: 'error', where: w, message: `"${f.name}" must be ${EXPECT[f.type]}; found ${JSON.stringify(val).slice(0, 60)}.` }); continue }
    if (f.enum && !f.enum.includes(String(val)) && !(f.name === 'polarity' && (val === '−' || val === '–')))
      issues.push({ code: 'S01', level: 'error', where: w, message: `"${f.name}" must be one of ${f.enum.map(e => `"${e}"`).join(', ')}; found ${JSON.stringify(val)}.${f.name === 'spec' && val === 'stockflow/1' ? ' The plugin was renamed: set it to "dynamics/1".' : ''}` })
    if (f.type === 'string' && f.required === true && isBlank(val)) issues.push({ code: 'S04', level: 'error', where: w, message: `"${f.name}" must not be blank.` })
    if (f.type === 'array' && f.of) (val as unknown[]).forEach((item, i) => shapeOf(f.of!, item, `${w}[${i}]`, issues))
    if (f.type === 'object' && f.of) shapeOf(f.of, val, w, issues)
  }
}

/** Parse JSON, reporting line and column on failure. */
export function parseModel(text: string): { raw?: unknown; error?: string } {
  try { return { raw: JSON.parse(text) } }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const pos = /position (\d+)/.exec(msg)
    if (pos) {
      const p = Number(pos[1])
      const before = text.slice(0, p)
      const line = before.split('\n').length
      const col = p - before.lastIndexOf('\n')
      return { error: `not valid JSON at line ${line}, column ${col}.` }
    }
    // the engine's message can quote the file's contents, so it is never passed on
    return { error: 'not valid JSON.' }
  }
}

/** A display string: runs of whitespace (line breaks included) become one space, so the page, the
 *  reader view and the checks all see the same text. */
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? normWs(v) : undefined)
const txt = (v: unknown): string => (typeof v === 'string' ? normWs(v) : String(v ?? ''))
/** A file name is kept as written: "Queue  Notes.md" (two spaces) is a different file from "Queue Notes.md". */
const verbatim = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)
const ev = (v: unknown): Evidence[] => Array.isArray(v) ? v.filter(isObj).map(e => ({
  root: verbatim(e.root), path: verbatim(e.path), lines: e.lines === undefined || e.lines === null ? undefined : String(e.lines), quote: txt(e.quote ?? ''),
  kind: str(e.kind), url: str(e.url), from: str(e.from),
})) : []

/** Build the typed model from a raw object that passed the shape stage. */
function normalise(raw: Record<string, unknown>): Model {
  const subject = raw.subject as Record<string, unknown>
  const answer = raw.answer as Record<string, unknown>
  const status = (v: unknown): Status => (['observed', 'modelled', 'intended', 'missing'].includes(String(v)) ? v as Status : 'observed')
  const nodes = (raw.nodes as Record<string, unknown>[]).map(n => ({
    id: String(n.id), kind: n.kind as Kind, figure: String(n.figure), at: n.at as [number, number],
    label: str(n.label) ?? '', units: str(n.units), value: str(n.value), component: str(n.component), detail: str(n.detail),
    status: status(n.status), claim: str(n.claim), evidence: ev(n.evidence), emphasis: str(n.emphasis),
    of: str(n.of), why_outside: str(n.why_outside), label_at: str(n.label_at),
  }))
  const figOf = new Map(nodes.map(n => [n.id, n.figure]))
  const flows = (raw.flows as Record<string, unknown>[]).map(f => ({
    id: String(f.id), from: String(f.from), to: String(f.to), label: txt(f.label), units: str(f.units),
    component: str(f.component), detail: str(f.detail), status: status(f.status), claim: str(f.claim), evidence: ev(f.evidence),
    emphasis: str(f.emphasis), valve: typeof f.valve === 'number' ? f.valve : 0.5, route: str(f.route), label_at: str(f.label_at),
    figure: figOf.get(String(f.from)) ?? figOf.get(String(f.to)) ?? '',
  }))
  for (const f of flows) figOf.set(f.id, f.figure)
  const links = (raw.links as Record<string, unknown>[]).map(l => ({
    id: String(l.id), from: String(l.from), to: String(l.to), polarity: (l.polarity === '+' ? '+' : '-') as '+' | '-',
    mechanism: txt(l.mechanism ?? ''), label: str(l.label), delay: l.delay === true, detail: str(l.detail), component: undefined,
    status: status(l.status), claim: str(l.claim), evidence: ev(l.evidence), emphasis: str(l.emphasis),
    bend: typeof l.bend === 'number' ? l.bend : undefined, figure: figOf.get(String(l.to)) ?? figOf.get(String(l.from)) ?? '',
  }))
  const loops = (raw.loops as Record<string, unknown>[]).map(l => ({
    id: String(l.id), name: txt(l.name), path: (l.path as string[]).map(String), story: str(l.story), minor: l.minor === true,
    goal: str(l.goal), marker_at: l.marker_at as [number, number] | undefined,
  }))
  const boundary = raw.boundary as Record<string, unknown>
  return {
    spec: String(raw.spec), title: txt(raw.title),
    subject: {
      name: txt(subject.name), kind: String(subject.kind), roots: subject.roots as Record<string, string>,
      ref: str(subject.ref), dirty: subject.dirty === true ? true : undefined, date: txt(subject.date),
    },
    question: txt(raw.question),
    answer: { text: typeof answer.text === 'string' ? answer.text.split(/\r?\n/).map(normWs).filter(Boolean).join('\n') : txt(answer.text), loops: (answer.loops as string[]).map(String) },
    horizon: str(raw.horizon), time_unit: str(raw.time_unit), audience: str(raw.audience),
    reference_modes: ((raw.reference_modes ?? []) as Record<string, unknown>[]).map(r => ({
      variable: String(r.variable), pattern: txt(r.pattern), basis: String(r.basis), why: str(r.why), evidence: ev(r.evidence),
    })),
    boundary: { excluded: (boundary.excluded as Record<string, unknown>[]).map(x => ({ name: txt(x.name), why: txt(x.why) })) },
    emphasis: isObj(raw.emphasis) ? { name: txt(raw.emphasis.name), rule: txt(raw.emphasis.rule) } : undefined,
    figures: (raw.figures as Record<string, unknown>[]).map(f => ({ id: String(f.id), title: txt(f.title), question: txt(f.question), caption: str(f.caption) })),
    nodes, flows, links, loops,
    review: isObj(raw.review) ? {
      rounds: typeof raw.review.rounds === 'number' ? raw.review.rounds : undefined,
      agreed: typeof raw.review.agreed === 'number' ? raw.review.agreed : undefined,
      independent: typeof raw.review.independent === 'boolean' ? raw.review.independent : undefined,
      visual: typeof raw.review.visual === 'boolean' ? raw.review.visual : undefined,
      note: str(raw.review.note),
    } : undefined,
    notes: Array.isArray(raw.notes) ? (raw.notes as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()).map(normWs) : [],
  }
}

// ------------------------------------------------------------------------------------ naming

/**
 * What a reader calls an element: its label; a shadow, what it copies; a cloud, "outside the model";
 * a link, its two ends ("Jobs in flight → dispatched"), never its annotation. The checker's traces and
 * hedges and every place the page names an element use this one function.
 */
export function namer(model: Model): (id: string) => string {
  const nodes = new Map(model.nodes.map(n => [n.id, n]))
  const flows = new Map(model.flows.map(f => [f.id, f]))
  const links = new Map(model.links.map(l => [l.id, l]))
  const name = (id: string, depth = 0): string => {
    if (depth > 3) return id
    const n = nodes.get(id)
    if (n?.kind === 'shadow' && n.of) return name(n.of, depth + 1)
    if (n) return n.label || (n.kind === 'cloud' ? 'outside the model' : id)
    const f = flows.get(id)
    if (f) return f.label || id
    const l = links.get(id)
    if (l) return `${name(l.from, depth + 1)} → ${name(l.to, depth + 1)}`
    return id
  }
  return id => name(id)
}

// ----------------------------------------------------------------------------- evidence paths

/** The roots, resolved: absolute, or relative to the model file's folder. */
export function resolveRoots(model: Model, modelPath: string): Record<string, string> {
  const base = dirname(modelPath)
  const out: Record<string, string> = Object.create(null)
  // a root starting with "~" is refused (E05): "~" is not expanded, so it resolves to nothing, not a folder
  for (const [k, v] of Object.entries(model.subject.roots)) out[k] = v.trim().startsWith('~') ? '' : isAbsPath(v) ? joinPath('', v) : joinPath(base, v)
  return out
}

/** A safe relative path: forward slashes, no "..", not absolute. */
function badPath(p: string): string | null {
  if (isAbsPath(p) || /^[A-Za-z]:/.test(p)) return 'must be relative to a subject root, not absolute'
  if (p.includes('\\')) return 'must use forward slashes'
  if (p.split('/').includes('..')) return 'must not contain ".."; add a root for files outside the existing ones'
  return null
}

function evidenceTarget(e: Evidence, roots: Record<string, string>, firstRoot: string): { abs?: string; problem?: string } {
  if (!e.path) return {}
  const rootName = e.root ?? firstRoot
  // kept verbatim to name the file, so a line break would reach the page as a line of its own
  if (/[\n\r\v\f\u0085\u2028\u2029]/.test(`${e.root ?? ''}${e.path}`)) return { problem: 'a path or root name must not contain a line break.' }
  const root = Object.hasOwn(roots, rootName) ? roots[rootName] : undefined
  if (root === '') return { problem: `root "${rootName}" is refused: its folder starts with "~" (see subject.roots.${rootName}).` }
  if (!root) return { problem: `root "${rootName}" is not one of subject.roots (${Object.keys(roots).join(', ')}).` }
  const bad = badPath(e.path)
  if (bad) return { problem: `path "${e.path}" ${bad}.` }
  return { abs: joinPath(root, e.path) }
}

const CODE_EXT = /\.(py|pyi|pyx|go|ts|tsx|mts|cts|js|jsx|mjs|cjs|vue|svelte|rb|java|kt|kts|groovy|gradle|scala|clj|c|h|cc|cpp|cxx|hh|hpp|hxx|m|mm|cs|fs|vb|rs|swift|php|pl|pm|lua|r|jl|dart|ex|exs|erl|hs|ml|zig|nim|sh|bash|zsh|fish|ps1|bat|cmd|sql|graphql|proto|tf|hcl|nix|cmake|mk|yaml|yml|toml|json|jsonc|json5|xml|ini|cfg|conf|properties|env|lock)$/i
const DOC_EXT = /\.(md|mdx|markdown|rst|adoc|asciidoc|pdf|docx?|odt|rtf|org|tex)$/i
const DOC_NAME = /^(readme|changelog|changes|history|news|contributing|authors|notice|code_of_conduct|security|support)(\.(md|mdx|markdown|rst|adoc|asciidoc|pdf|docx?|odt|rtf|org|tex|txt))?$/i
const DOC_DIR = /(^|\/)(docs?|documentation|wiki|adrs?|rfcs?)\//i

/**
 * What a file is by its name alone. The extension decides first: a code or config extension is code
 * wherever it lives (security.py, docs/conf.py), a document extension is a document. A document's name
 * (README, CHANGELOG, HISTORY…) counts only with no extension or a document or .txt one. Any other .txt
 * or .html file is 'text': its name cannot say (see kindOfEvidence). Any other file is code.
 */
export function fileKind(path: string): 'doc' | 'code' | 'text' {
  const name = basename(path)
  if (CODE_EXT.test(name)) return 'code'
  if (DOC_EXT.test(name) || DOC_NAME.test(name)) return 'doc'
  if (/\.(txt|html?)$/i.test(name)) return 'text'
  return 'code'
}

/**
 * What a source is. A file's extension or name decides when it says (README.md and HISTORY.txt are
 * documents whatever "kind" claims), except that "kind": "doc" may mark a code file as documentation.
 * For any other .txt or .html file the declared kind decides; with none, it is a document under a docs,
 * wiki, adr or rfc folder or when it is a saved extract (evidence with "from"), else unsure. A web
 * address is a document.
 */
export function kindOfEvidence(e: Evidence): string {
  if (!e.path) return e.url ? 'doc' : e.kind ?? 'other'
  const fk = fileKind(e.path)
  if (fk === 'doc') return 'doc'
  if (fk === 'text') return e.kind ?? (e.from || DOC_DIR.test(e.path) ? 'doc' : 'other')
  return e.kind === 'doc' ? 'doc' : e.kind ?? 'code'
}

function allEvidence(model: Model): Evidence[] {
  return [
    ...model.nodes.flatMap(n => n.evidence), ...model.flows.flatMap(f => f.evidence),
    ...model.links.flatMap(l => l.evidence), ...model.reference_modes.flatMap(r => r.evidence),
  ]
}

const WORDCH = /[\p{L}\p{N}_]/u

/** A match is whole when it does not cut a word or a number short at either end. */
function wholeAt(text: string, at: number, len: number): boolean {
  const first = text[at] ?? ''
  const last = text[at + len - 1] ?? ''
  const before = text[at - 1] ?? ''
  const after = text[at + len] ?? ''
  if (before && WORDCH.test(first) && WORDCH.test(before)) return false
  if (after && WORDCH.test(last) && WORDCH.test(after)) return false
  if (/\d/.test(last) && /^[.,]\d/.test(text.slice(at + len, at + len + 2))) return false
  if (/\d/.test(first) && /\d[.,]$/.test(text.slice(Math.max(0, at - 2), at))) return false
  return true
}

/** Whether one of the numbers (in order, none overlapping) starts before offset p and ends after it. */
function cutAt(tokens: readonly NumberToken[], p: number): boolean {
  let lo = 0
  let hi = tokens.length - 1
  let k = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (tokens[mid].start < p) { k = mid; lo = mid + 1 } else hi = mid - 1
  }
  return k >= 0 && tokens[k].end > p
}

/** The numbers (in order) that start inside [start, end). */
function tokensIn(tokens: readonly NumberToken[], start: number, end: number): NumberToken[] {
  let lo = 0
  let hi = tokens.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (tokens[mid].start < start) lo = mid + 1
    else hi = mid
  }
  const out: NumberToken[] = []
  for (let k = lo; k < tokens.length && tokens[k].start < end; k++) out.push(tokens[k])
  return out
}

/**
 * The offset of the first whole occurrence of q in text, or -1. Whole: it cuts no word short, and no
 * number either (sign and separators included), so a quote cannot end on "8," of "8,000", on "2." of
 * "2.5", or start after the minus of "-1". `cuts` says whether a number runs across an offset; by
 * default the text's own reading (numberTokens) decides.
 */
export function findWhole(text: string, q: string, from = 0, cuts?: (p: number) => boolean): number {
  if (!q) return -1
  let cut = cuts
  for (let i = text.indexOf(q, from); i >= 0; i = text.indexOf(q, i + 1)) {
    if (!wholeAt(text, i, q.length)) continue
    if (!cut) { const tokens = numberTokens(text); cut = p => cutAt(tokens, p) }
    if (cut(i) || cut(i + q.length)) continue
    return i
  }
  return -1
}

/**
 * A text read once: its lines as the Read tool numbers them, the lines joined with "\n" (so an offset
 * and a line number agree), where each line starts, and its numbers read in context, when first asked.
 */
export type Reading = { lines: string[]; text: string; starts: number[]; tokens: () => NumberToken[] }

export function readingOf(source: string): Reading {
  const lines = splitLines(source)
  const starts: number[] = []
  let at = 0
  for (const l of lines) { starts.push(at); at += l.length + 1 }
  const text = lines.join('\n')
  let tokens: NumberToken[] | undefined
  return { lines, text, starts, tokens: () => (tokens ??= numberTokens(text)) }
}

/**
 * text[from, to) as normWs gives it (each run of whitespace one space, the ends trimmed), and where
 * each offset of that stands in text: a run's space at the run's first character, the end just after
 * the last character kept.
 */
function normPlaced(text: string, from: number, to: number): { norm: string; at: (p: number) => number } {
  let a = from
  let b = to
  while (a < b && /\s/.test(text[a])) a++
  while (b > a && /\s/.test(text[b - 1])) b--
  const map = new Uint32Array(b - a)
  const parts: string[] = []
  let n = 0
  let k = a
  const ws = /\s+/g
  ws.lastIndex = a
  for (let m = ws.exec(text); m && m.index < b; m = ws.exec(text)) {
    parts.push(text.slice(k, m.index), ' ')
    for (let j = k; j < m.index; j++) map[n++] = j
    map[n++] = m.index
    k = m.index + m[0].length
  }
  parts.push(text.slice(k, b))
  for (let j = k; j < b; j++) map[n++] = j
  return { norm: parts.join(''), at: p => (p < n ? map[p] : n ? map[n - 1] + 1 : a) }
}

/** Where a quote was found: the lines it spans (1-based) and its span [start, end) in the reading's text. */
export type Place = { first: number; last: number; start: number; end: number }

/** What a source says, by position: a checked quote's span in its file's text, or the whole of a claim,
 *  with that text's numbers read in context. A source lends the numbers that start inside the span. */
type Spot = { text: string; start: number; end: number; tokens: () => NumberToken[] }

/**
 * Where q stands in lines first..last of a reading: whitespace-insensitively, as whole words, and
 * cutting none of the numbers the file's own reading gives there. The span is what the quote lends
 * and where a value it backs is looked for, so the match and the lending cannot disagree. Null when
 * it is not there.
 */
export function findQuote(r: Reading, q: string, first = 1, last = r.lines.length): Place | null {
  if (!q) return null
  const { norm, at } = normPlaced(r.text, r.starts[first - 1], r.starts[last - 1] + r.lines[last - 1].length)
  const i = findWhole(norm, q, 0, p => cutAt(r.tokens(), at(p)))
  if (i < 0) return null
  const start = at(i)
  const end = at(i + q.length)
  const lineOf = (offset: number): number => {
    let lo = 0
    let hi = r.starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (r.starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
  return { first: lineOf(start), last: lineOf(end - 1), start, end }
}

// ---------------------------------------------------------------------------------- the check

/** Read the model file and every cited file through `io`, then analyse. */
export async function check(modelText: string, modelPath: string, io: Io): Promise<Analysis> {
  const parsed = parseModel(modelText)
  if (parsed.error) return { report: emptyReport(modelPath, [{ code: 'S00', level: 'error', where: 'model', message: `The model file is ${parsed.error}` }], ['all checks after parsing']) }
  const shapeIssues: Issue[] = []
  shapeOf('model', parsed.raw, 'model', shapeIssues)
  if (shapeIssues.some(i => i.level === 'error'))
    return { report: emptyReport(modelPath, shapeIssues, ['references', 'notation', 'evidence', 'loops', 'units', 'boundary']) }
  const model = normalise(parsed.raw as Record<string, unknown>)
  const roots = resolveRoots(model, modelPath)
  const first = Object.keys(model.subject.roots)[0]
  const files = new Map<string, string | null>()
  const unreadable = new Map<string, Exclude<ReadResult, { text: string }>>()
  for (const e of allEvidence(model)) {
    const t = evidenceTarget(e, roots, first)
    if (!t.abs || files.has(t.abs)) continue
    let r: ReadResult
    try { r = await io.read(t.abs) } catch (err) { r = { failed: err instanceof Error ? err.message : String(err) } }
    if ('text' in r) files.set(t.abs, r.text)
    else { files.set(t.abs, null); unreadable.set(t.abs, r) }
  }
  return analyse(model, modelPath, files, unreadable, shapeIssues)
}

function emptyReport(modelPath: string, issues: Issue[], skipped: string[]): Report {
  const errors = issues.filter(i => i.level === 'error')
  const warnings = issues.filter(i => i.level === 'warning')
  return {
    ok: false,
    summary: `${errors.length} error(s), ${warnings.length} warning(s) in the model's shape; later checks skipped until it parses.`,
    spec: SPEC, model_path: modelPath, errors: errors.slice(0, MAX_ISSUES), warnings: warnings.slice(0, MAX_ISSUES),
    more: { errors: Math.max(0, errors.length - MAX_ISSUES), warnings: Math.max(0, warnings.length - MAX_ISSUES) },
    skipped, loops: [], undeclared: [], designed: [],
    boundary: { endogenous: [], exogenous: [], sources_and_sinks: [], not_built: [], excluded: [] },
    counts: {}, not_checked: NOT_CHECKED,
  }
}

/** The checks after the shape stage. Pure. */
export function analyse(model: Model, modelPath: string, files: ReadonlyMap<string, string | null>, unreadable: ReadonlyMap<string, Exclude<ReadResult, { text: string }>> = new Map(), prior: Issue[] = []): Analysis {
  const issues: Issue[] = [...prior]
  const err = (code: string, where: string, message: string, source?: string) => issues.push({ code, level: 'error', where, message, ...(source ? { source } : {}) })
  const warn = (code: string, where: string, message: string, source?: string) => issues.push({ code, level: 'warning', where, message, ...(source ? { source } : {}) })
  const roots = resolveRoots(model, modelPath)
  const firstRoot = Object.keys(model.subject.roots)[0]

  // ---- S02: ids, one namespace, unique regardless of case (a reader cannot tell "r1" from "R1")
  const owner = new Map<string, string>()
  const ownerOf = new Map<string, string>()
  const takeId = (id: string, where: string) => {
    if (!ID_RE.test(id)) err('S02', where, `id "${id}" must start with a letter and use letters, digits, "_", "-" or "." (max 64).`)
    const prior2 = ownerOf.get(id.toLowerCase())
    if (prior2) err('S02', where, `id "${id}" is already used by ${prior2}; ids are unique across figures, nodes, flows, links and loops, regardless of case.`)
    else { ownerOf.set(id.toLowerCase(), where); owner.set(id, where) }
  }
  model.figures.forEach(f => takeId(f.id, `figure "${f.id}"`))
  model.nodes.forEach(n => takeId(n.id, `node "${n.id}"`))
  model.flows.forEach(f => takeId(f.id, `flow "${f.id}"`))
  model.links.forEach(l => takeId(l.id, `link "${l.id}"`))
  model.loops.forEach(l => takeId(l.id, `loop "${l.id}"`))
  if (model.figures.length === 0) err('S01', 'figures', 'at least one figure is required.')
  for (const [k, v] of Object.entries(model.subject.roots)) if (v.trim().startsWith('~'))
    err('E05', `subject.roots.${k}`, `"${v}" starts with "~", which is not expanded: give the folder as an absolute path, or relative to the model file.`)

  const nodeById = new Map(model.nodes.map(n => [n.id, n]))
  const nodeById0 = nodeById
  const flowById = new Map(model.flows.map(f => [f.id, f]))
  const linkById = new Map(model.links.map(l => [l.id, l]))
  const figIds = new Set(model.figures.map(f => f.id))
  const kindOf = (id: string): Kind | 'flow' | undefined => nodeById.get(id)?.kind ?? (flowById.has(id) ? 'flow' : undefined)
  const orig = (id: string): string => { const n = nodeById.get(id); return n?.kind === 'shadow' && n.of ? n.of : id }

  // ---- S03/S04 and per-kind field rules
  for (const n of model.nodes) {
    const w = `node "${n.id}"`
    if (!figIds.has(n.figure)) err('S03', w, `"figure" "${n.figure}" names no figure.`)
    if (n.kind !== 'cloud' && n.kind !== 'shadow' && isBlank(n.label)) err('S04', w, '"label" is required: a quantity that can go up or down (Hines).', 'Hines')
    if (n.kind === 'cloud' && isBlank(n.why_outside)) err('N07', w, 'a cloud needs "why_outside": what lies beyond the boundary and why it does not matter to the question (Ford 2019).', 'Ford 2019')
    if (n.kind === 'shadow') {
      if (!n.of) err('S03', w, 'a shadow needs "of": the id of what it copies.')
      else {
        const k = kindOf(n.of)
        if (!k) err('S03', w, `"of" names "${n.of}", which is no node or flow.`)
        else if (k === 'shadow' || k === 'cloud') err('N04', w, `a shadow copies a stock, variable, constant or flow, not a ${k} (Vensim; isee).`, 'Vensim; isee')
      }
    } else if (n.of) err('S01', w, '"of" is for shadows only.')
    if ((n.kind === 'cloud' || n.kind === 'shadow') && n.status !== 'observed') err('S01', w, `a ${n.kind} takes no status.`)
    if (n.value && n.kind !== 'constant') err('N10', w, '"value" is for constants only: a stock\'s value changes, and a variable is computed. Put a snapshot in "detail" with its source.')
    if (n.label_at && n.kind !== 'aux' && n.kind !== 'constant') warn('S05', w, '"label_at" only moves variable and constant labels.')
  }
  for (const f of model.flows) {
    const w = `flow "${f.id}"`
    if (f.valve < 0.15 || f.valve > 0.85) err('S01', w, '"valve" must be from 0.15 to 0.85.')
  }
  for (const l of model.links) {
    const w = `link "${l.id}"`
    if (isBlank(l.mechanism)) err('S04', w, '"mechanism" must say how the target reads the source (Sterman 2001: links are causal, not correlations).', 'Sterman 2001')
    if (l.bend !== undefined && (l.bend < -1 || l.bend > 1)) err('S01', w, '"bend" must be from -1 to 1.')
  }
  const LOOP_ID = /^([RB])([1-9]\d*)$/
  for (const lp of model.loops) {
    const w = `loop "${lp.id}"`
    if (!LOOP_ID.test(lp.id)) err('L04', w, `loop ids are R1, R2… (reinforcing) or B1, B2… (balancing), so the letter a reader sees in the marker is the loop's type (Sterman 2001). Trace a change around the loop, decide, then name it.`, 'Sterman 2001')
    if (!lp.minor && isBlank(lp.story)) err('S04', w, '"story" is required unless "minor": trace a change around the loop (Sterman 2001).', 'Sterman 2001')
    if (lp.path.length < 2) err('S01', w, '"path" needs at least two ids.')
  }
  if (model.title.trim().split(/\s+/).length > 4) warn('T01', 'title', 'keep the title to two to four words; put the rest in "question".')
  if (model.figures.length > 3) warn('T02', 'figures', `${model.figures.length} figures: the method plans one to three, each answering one sub-question.`)
  const rv = model.review
  if (rv) {
    for (const k of ['rounds', 'agreed'] as const) {
      const v = rv[k]
      if (v !== undefined && (!Number.isInteger(v) || v < 0)) warn('V01', `review.${k}`, `"${k}" counts review rounds: a whole number, 0 or more; found ${v}.`)
    }
    const whole = (v: number | undefined): v is number => v !== undefined && Number.isInteger(v) && v >= 0
    if (whole(rv.rounds) && whole(rv.agreed) && rv.rounds > rv.agreed) warn('V01', 'review.rounds', `${rv.rounds} rounds were run but ${rv.agreed} agreed: a round beyond the agreed number needs the person's yes. If they gave it, record the new number in "agreed".`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(model.subject.date)) warn('S06', 'subject.date', '"date" should be YYYY-MM-DD.')
  for (const n of model.nodes) if ((n.kind === 'cloud' || n.kind === 'shadow') && n.emphasis)
    err('P03', `node "${n.id}"`, `a ${n.kind} cannot carry "emphasis"; highlight ${n.kind === 'shadow' ? 'the element it copies' : 'the flow that crosses the boundary'} instead.`)
  const total = model.nodes.length + model.flows.length + model.links.length
  if (total > MAX_ELEMENTS) err('N12', 'model', `${total} nodes, flows and links is more than one model should hold (${MAX_ELEMENTS}; plugin rule). Narrow the question or aggregate.`)
  for (const f of model.figures) {
    const k = model.nodes.filter(n => n.figure === f.id && n.kind !== 'cloud').length + model.flows.filter(x => (nodeById0.get(x.from)?.figure ?? nodeById0.get(x.to)?.figure) === f.id).length
    if (k > MAX_PER_FIGURE) err('N12', `figure "${f.id}"`, `${k} elements (stocks, variables, constants, shadows and flows) in one figure cannot be drawn legibly; at most ${MAX_PER_FIGURE} (plugin rule, after Sterman 2001's advice against one comprehensive diagram). Split it by sub-question.`)
  }

  // ---- N01–N09: notation
  for (const f of model.flows) {
    const w = `flow "${f.id}"`
    const kf = kindOf(f.from)
    const kt = kindOf(f.to)
    if (!kf) err('S03', w, `"from" names "${f.from}", which is no node.`)
    if (!kt) err('S03', w, `"to" names "${f.to}", which is no node.`)
    if (!kf || !kt) continue
    if (f.from === f.to) err('N01', w, 'a flow cannot run from a stock into itself.')
    else if (![kf, kt].every(k => k === 'stock' || k === 'cloud'))
      err('N01', w, `a flow runs between stocks and clouds; here ${kf} → ${kt}. Something read rather than moved is an information link (Ford 2019).`, 'Ford 2019')
    else if (kf === 'cloud' && kt === 'cloud') err('N01', w, 'cloud → cloud moves nothing in the model; one end must be a stock (Ford 2019).', 'Ford 2019')
    const ff = nodeById.get(f.from)?.figure
    const ft = nodeById.get(f.to)?.figure
    if (ff && ft && ff !== ft) err('N05', w, `its ends are in different figures ("${ff}", "${ft}"). A flow lives in one figure; move one end, or split the stock's story into one figure.`)
    if (f.status === 'observed' || f.status === 'modelled') for (const [end, id] of [['source', f.from], ['target', f.to]] as const) {
      const st = nodeById.get(id)?.status
      if (st === 'intended' || st === 'missing') warn('E01', w, `is ${f.status}, but its ${end} "${id}" is ${st}: what is not built cannot be read or fed. Mark the flow ${st} too, or the ${end} built.`)
    }
  }
  for (const n of model.nodes) if (n.kind === 'stock' && !model.flows.some(f => f.from === n.id || f.to === n.id))
    err('N02', `node "${n.id}"`, 'a stock changes only through flows, and this one has none. If nothing fills or drains it, it is a constant or a variable (Ford 2019; MIT D-4498).', 'Ford 2019; MIT D-4498')
  const cloudUse = new Map<string, number>()
  for (const f of model.flows) for (const e of [f.from, f.to]) if (nodeById.get(e)?.kind === 'cloud') cloudUse.set(e, (cloudUse.get(e) ?? 0) + 1)
  for (const [c, k] of cloudUse) if (k > 1) warn('C01', `node "${c}"`, `this cloud serves ${k} flow ends. A source and a sink of the same thing can hide a stock that closes a loop; draw the stock, or give each flow its own cloud with its own reason (Ford 2019: a cloud stands for a stock inconsequential to the question).`, 'Ford 2019')

  const pairSeen = new Map<string, string>()
  for (const l of model.links) {
    const w = `link "${l.id}"`
    const kf = kindOf(l.from)
    const kt = kindOf(l.to)
    if (!kf) err('S03', w, `"from" names "${l.from}", which is no node or flow.`)
    if (!kt) err('S03', w, `"to" names "${l.to}", which is no node or flow.`)
    if (!kf || !kt) continue
    if (orig(l.from) === l.to) err('N03', w, 'a link cannot point at its own source (a shadow counts as what it copies).')
    if (kf === 'cloud') err('N03', w, 'a cloud lies outside the model and influences nothing; start the link at a variable.')
    if (kt === 'stock') err('N03', w, `links never end on a stock: stocks change only through flows. Point it at the flow that changes "${l.to}" (Ford 2019; MIT D-4498).`, 'Ford 2019; MIT D-4498')
    else if (kt === 'constant') err('N03', w, `"${l.to}" is a constant, and constants do not change (Naugle 2024). If something changes it, make it a variable.`, 'Naugle 2024')
    else if (kt === 'cloud') err('N03', w, 'links cannot end on a cloud.')
    else if (kt === 'shadow') err('N03', w, 'nothing may point into a shadow; point at the variable it copies, in its own figure (Vensim; isee).', 'Vensim; isee')
    const ff = nodeById.get(l.from)?.figure ?? flowById.get(l.from)?.figure
    const ft = nodeById.get(l.to)?.figure ?? flowById.get(l.to)?.figure
    if (ff && ft && ff !== ft) err('N05', w, `the link joins figure "${ff}" to "${ft}". Draw a shadow of "${l.from}" in "${ft}" and link from it.`)
    const key = `${orig(l.from)}→${l.to}`
    const p2 = pairSeen.get(key)
    if (p2) err('N08', w, `duplicates link "${p2}": the same source (a shadow counts as what it copies) and target.`)
    else pairSeen.set(key, l.id)
    if (l.status === 'observed' || l.status === 'modelled') for (const [end, id] of [['source', orig(l.from)], ['target', l.to]] as const) {
      const st = nodeById.get(id)?.status ?? flowById.get(id)?.status
      if (st === 'intended' || st === 'missing') warn('E01', w, `is ${l.status}, but its ${end} "${id}" is ${st}: what is not built cannot be read or fed. Mark the link ${st} too, or the ${end} built.`)
    }
    const tf = flowById.get(l.to)
    if (tf && tf.from === orig(l.from) && kindOf(orig(l.from)) === 'stock' && l.polarity === '-')
      warn('X02', w, `"${orig(l.from)}" → its own outflow "${tf.id}" is signed −. The pipe already counts the drain (−); − here says a fuller stock drains more slowly. If that is not what the code does, make it + (Sterman 2000, Table 5-1).`, 'Sterman 2000')
  }

  // ---- E01–E07: status, claims, evidence
  // each cited file is read once, its numbers in context (Reading)
  const readings = new Map<string, Reading | null>()
  const readingAt = (p: string): Reading | null => {
    if (!readings.has(p)) { const t = files.get(p); readings.set(p, typeof t === 'string' ? readingOf(t) : null) }
    return readings.get(p) ?? null
  }
  let quotesVerified = 0
  /** The quotes the check found in their files, each with where it was found: the only quotes a number
   *  may come from. A quote lends what its file says there ("(1,500)" cut out of "clamp(1,500)" lends 1
   *  and 500), never its own reading of itself. */
  const verified = new Map<Evidence, Spot>()
  const accept = (e: Evidence, r: Reading, at: Place): void => {
    quotesVerified++
    verified.set(e, { text: r.text, start: at.start, end: at.end, tokens: r.tokens })
  }
  const checkEvidence = (list: Evidence[], where: string): void => {
    list.forEach((e, i) => {
      const w = `${where}.evidence[${i}]`
      if (isBlank(e.quote)) { err('S04', w, '"quote" is required: the exact text that shows it.'); return }
      if (!e.path) {
        if (e.url) warn('E03', w, `"${e.url}" cannot be checked offline. Save a copy (text) under a subject root, cite it by path, and record the URL in "from".`)
        else err('S01', w, 'evidence needs a "path" (or a "url").')
        return
      }
      const t = evidenceTarget(e, roots, firstRoot)
      if (t.problem) { err('E05', w, t.problem); return }
      const abs = t.abs!
      if (e.kind && ['code', 'config', 'test'].includes(e.kind) && fileKind(e.path) === 'doc')
        warn('E06', w, `"kind" says ${e.kind}, but "${e.path}" is a document by its extension or name (a document's name, such as README or HISTORY, decides even with .txt); the check treats it as one.`)
      const why = unreadable.get(abs)
      if (why && 'refused' in why) { err('E07', w, `reading "${e.path}" (${abs}) was refused: ${why.refused} If the person allows it, check again; otherwise cite a copy they allow.`); return }
      const r = readingAt(abs)
      if (!r) { err('E02', w, `cannot read "${e.path}" (${abs}): ${why && 'failed' in why ? why.failed : 'no reason given.'}`); return }
      const q = normWs(e.quote)
      if (q.replace(/\s/g, '').length < 4) { err('E02', w, `the quote "${q}" is too short to show anything; quote a few words of the line.`); return }
      const range = e.lines === undefined ? null : parseLines(e.lines)
      if (e.lines !== undefined && !range) { err('S01', w, `"lines" ${JSON.stringify(e.lines)} must be "12" or "12-20" with the first <= the last.`); return }
      if (range && range[1] > r.lines.length) { err('E02', w, `lines ${range[0]}-${range[1]} are past the end of "${e.path}" (${r.lines.length} lines).`); return }
      if (range) {
        const inside = findQuote(r, q, range[0], range[1])
        if (inside) {
          accept(e, r, inside)
          if (range[1] - range[0] > inside.last - inside.first + 15)
            warn('E02', w, `the quote spans ${inside.last - inside.first + 1} line(s) but "lines" cites ${range[1] - range[0] + 1}; narrow it to ${inside.first}${inside.last > inside.first ? `-${inside.last}` : ''}.`)
          return
        }
      }
      const at = findQuote(r, q)
      const span = at ? (at.last > at.first ? `${at.first}-${at.last}` : `${at.first}`) : ''
      if (at && !range) { accept(e, r, at); warn('E02', w, `quote found at line ${span}; add "lines": "${span}".`) }
      else if (at) err('E02', w, `the quote is in "${e.path}" at line ${span}, not ${e.lines}. Set "lines": "${span}".`)
      else err('E02', w, `the quote does not appear in "${e.path}"${range ? ` lines ${e.lines}` : ''} as whole words. Quote the source exactly: a run of spaces, tabs or line breaks may be longer or shorter, but none may be added or dropped.`)
    })
  }
  const subjKind = model.subject.kind
  const statusRules = (el: { status: Status; claim?: string; evidence: Evidence[] }, w: string): void => {
    if (el.status === 'observed' && el.evidence.length === 0)
      err('E01', w, 'observed needs evidence: path, lines and an exact quote. If you inferred it, set "status": "modelled" and give the "claim" (Shreckengost; Naugle 2024).', 'Shreckengost; Naugle 2024')
    else if (el.status === 'observed' && !el.evidence.some(e => e.path))
      err('E01', w, 'observed needs at least one quote checked against a file; a web address alone cannot be checked. Save a text extract of the page under a subject root and cite it by path, or mark this modelled.')
    if (el.status !== 'observed' && isBlank(el.claim))
      err('E01', w, `"${el.status}" needs a "claim": what is ${el.status === 'modelled' ? 'inferred and why' : el.status === 'intended' ? 'specified but not built' : 'absent and why it should be there'} (Naugle 2024).`, 'Naugle 2024')
    if ((el.status === 'intended' || el.status === 'missing') && el.evidence.length === 0)
      warn('E01', w, `"${el.status}" should cite ${el.status === 'intended' ? 'the document that specifies it' : 'where it would be read'}.`)
    if (el.status === 'observed' && (subjKind === 'codebase' || subjKind === 'mixed') && el.evidence.length && el.evidence.every(e => kindOfEvidence(e) === 'doc'))
      warn('E06', w, 'observed in a codebase, but every source is a document (judged by the file\'s extension or name, where a document\'s name such as README or HISTORY counts with .txt too; for any other .txt or .html file by its "kind", or with none by its folder or a saved extract\'s "from"). Is it built? If the code does not do it, it is "intended".')
  }
  // E04: every number the page states as a fact needs a source, and a source is a quote the check found
  // in its file, or the claim of a part marked modelled, intended or missing (printed beside it). Page
  // and sources are read by one function, each number once (text.ts numberTokens), so a page that copies
  // its source is read as the source is. An element's own strings answer to its own
  // sources; a loop's name and story to the sources of the elements on the loop and those that link
  // into them; a reference mode's pattern to its own quotes (and, when suspected, its printed "why");
  // page-wide prose to every source in the model (a deferral: which element a sentence is about is not
  // machine-readable; NOT_CHECKED says so). Framing (title, question, horizon, goals, units, components)
  // is not checked.
  type Source = Evidence | string
  const sourcesOf = (el: Common): Source[] => [...el.evidence.filter(e => verified.has(e)), ...(el.status !== 'observed' && el.claim ? [el.claim] : [])]
  // a claim says what it says throughout; a checked quote, what its file says where it was found; a
  // quote not found says nothing
  const claimSpots = new Map<string, Spot>()
  const nowhere: Spot = { text: '', start: 0, end: 0, tokens: () => [] }
  const spotOf = (src: Source): Spot => {
    if (typeof src !== 'string') return verified.get(src) ?? nowhere
    let s = claimSpots.get(src)
    if (!s) {
      let tokens: NumberToken[] | undefined
      s = { text: src, start: 0, end: src.length, tokens: () => (tokens ??= numberTokens(src)) }
      claimSpots.set(src, s)
    }
    return s
  }
  const numberRule = (field: string, s: string | undefined, sources: Source[], w: string, whose: string): void => {
    if (!s) return
    const known = new Set(sources.flatMap(src => { const p = spotOf(src); return tokensIn(p.tokens(), p.start, p.end).map(t => t.value) }))
    const seen = new Set<number>()
    for (const t of numberTokens(s)) {
      if (known.has(t.value) || seen.has(t.value)) continue
      seen.add(t.value)
      // an item split out of a bracketed grouping is shown with its list, so "1" out of "[1,500]" is understood
      const item = t.list === undefined ? '' : ` (an item of the list ${listText(s, t.list)}: digits in brackets are read as a list in code, on the page as in the sources)`
      warn('E04', w, `the number ${t.text}${item} in "${field}" is in none of ${whose}. Every number on the page needs a source (plugin rule). If it is part of a name or a version (OAuth 2.0, ISO 8601), say so when you accept this warning.`)
    }
  }
  const whoseOf = (el: Common): string => el.status === 'observed' ? "this element's checked quotes" : "this element's checked quotes or its claim"
  const ownNumbers = (el: Common, w: string, fields: [string, string | undefined][]) => {
    const whose = whoseOf(el)
    const all: [string, string | undefined][] = el.status === 'observed' ? [...fields, ['claim', el.claim]] : fields
    for (const [field, text] of all) numberRule(field, text, sourcesOf(el), w, whose)
  }
  // v stands whole inside the spot (whitespace-insensitively, cutting no word, and no number of the
  // text's own reading, short), and not after a minus sign it lacks: the text before the spot counts,
  // so a quote cut just after the minus of "-1m30s" does not back "1m30s"
  const writtenIn = (p: Spot, v: string): boolean => {
    const { norm, at } = normPlaced(p.text, p.start, p.end)
    const cuts = (i: number) => cutAt(p.tokens(), at(i))
    for (let i = findWhole(norm, v, 0, cuts); i >= 0; i = findWhole(norm, v, i + 1, cuts)) if (/^[-−]/.test(v) || signAt(p.text, at(i) - 1) !== -1) return true
    return false
  }
  // A constant's value is read as the page and its sources are read: its numbers are compared by value
  // ("500,502,503" alone is one number; write "[500, 502, 503]" for a list). Only digits the reader reads
  // as no number (1m30s, 1.2.3) are compared as written, in its own sources: where each quote was found
  // in its file, and in its claim when not observed (sourcesOf).
  const valueRule = (n: Node, w: string) => {
    const v = n.value
    if (!v) return
    const whose = whoseOf(n)
    numberRule('value', v, sourcesOf(n), w, whose)
    const tokens = numberTokens(v)
    const a = asciiDigits(v)
    let unread = false
    for (let i = 0; i < a.length; i++) if (/\d/.test(a[i]) && !tokens.some(t => t.start <= i && i < t.end)) unread = true
    if (unread && !sourcesOf(n).some(src => writtenIn(spotOf(src), v))) warn('E04', w, `the value "${v}" is not read as one number (a compound duration or a version with more than two parts), so it is compared as written, and it is written so in none of ${whose}. Quote the line that sets it, exactly.`)
  }
  for (const n of model.nodes) {
    const w = `node "${n.id}"`
    if (n.kind !== 'cloud' && n.kind !== 'shadow') statusRules(n, w)
    checkEvidence(n.evidence, w)
    if (n.kind !== 'shadow' && n.kind !== 'cloud') { ownNumbers(n, w, [['label', n.label], ['detail', n.detail], ['emphasis', n.emphasis]]); valueRule(n, w) }
  }
  for (const f of model.flows) { const w = `flow "${f.id}"`; statusRules(f, w); checkEvidence(f.evidence, w); ownNumbers(f, w, [['label', f.label], ['detail', f.detail], ['emphasis', f.emphasis]]) }
  for (const l of model.links) { const w = `link "${l.id}"`; statusRules(l, w); checkEvidence(l.evidence, w); ownNumbers(l, w, [['label', l.label], ['mechanism', l.mechanism], ['detail', l.detail], ['emphasis', l.emphasis]]) }
  model.reference_modes.forEach((r, i) => {
    const w = `reference_modes[${i}]`
    if (!kindOf(r.variable)) err('S03', w, `"variable" names "${r.variable}", which is no node or flow.`)
    if (r.basis === 'data' && r.evidence.length === 0) err('P02', w, 'basis "data" needs evidence: where the data is (Sterman 2000; Ford 2019).', 'Sterman 2000; Ford 2019')
    if (r.basis === 'hypothesised' && isBlank(r.why)) err('P02', w, 'a hypothesised behaviour needs "why": who suspects it and on what grounds. Leave reference modes out rather than invent one.')
    checkEvidence(r.evidence, w)
    // data is printed as "observed in <file>", so only its own checked quotes count; a suspected pattern
    // is printed with its "why"; the variable's claim is printed elsewhere, as a claim, so never counts
    const own: Source[] = r.evidence.filter(e => verified.has(e))
    if (r.basis === 'hypothesised') numberRule('pattern', r.pattern, [...own, ...(r.why ? [r.why] : [])], w, 'its own checked quotes or its "why"')
    else numberRule('pattern', r.pattern, own, w, 'its own checked quotes')
  })
  {
    // every quote the check verified (reference modes' included), and the claims of parts not observed
    const pool: Source[] = [...verified.keys(), ...[...model.nodes, ...model.flows, ...model.links].flatMap(el => el.status !== 'observed' && el.claim ? [el.claim] : [])]
    const whose = "the model's checked quotes or modelled claims"
    numberRule('text', model.answer.text, pool, 'answer', whose)
    model.figures.forEach(f => numberRule('caption', f.caption, pool, `figure "${f.id}"`, whose))
    model.notes.forEach((t, i) => numberRule('note', t, pool, `notes[${i}]`, whose))
    model.boundary.excluded.forEach((x, i) => { numberRule('name', x.name, pool, `boundary.excluded[${i}]`, whose); numberRule('why', x.why, pool, `boundary.excluded[${i}]`, whose) })
    model.nodes.forEach(n => {
      numberRule('why_outside', n.why_outside, pool, `node "${n.id}"`, whose)
      if (n.kind === 'cloud') numberRule('label', n.label, pool, `node "${n.id}"`, whose)
    })
    if (model.emphasis) { numberRule('name', model.emphasis.name, pool, 'emphasis', whose); numberRule('rule', model.emphasis.rule, pool, 'emphasis', whose) }
  }

  // ---- P03: emphasis
  const emphasised = [...model.nodes, ...model.flows, ...model.links].filter(x => x.emphasis)
  if (emphasised.length && !model.emphasis) err('P03', 'emphasis', `${emphasised.length} element(s) carry "emphasis" but there is no "emphasis": { name, rule }. A highlight without a stated rule cannot be decoded.`)
  if (model.emphasis && !emphasised.length) warn('P03', 'emphasis', 'an emphasis rule is declared but nothing is emphasised.')

  // ---- U01: units
  const unitless = [...model.nodes.filter(n => n.kind === 'stock' && !n.units).map(n => n.id), ...model.flows.filter(f => !f.units).map(f => f.id)]
  const TIME: Record<string, string> = { s: 'second', sec: 'second', secs: 'second', second: 'second', seconds: 'second', ms: 'millisecond', millisecond: 'millisecond', milliseconds: 'millisecond', min: 'minute', mins: 'minute', minute: 'minute', minutes: 'minute', h: 'hour', hr: 'hour', hrs: 'hour', hour: 'hour', hours: 'hour', d: 'day', day: 'day', days: 'day', wk: 'week', week: 'week', weeks: 'week', mo: 'month', month: 'month', months: 'month', yr: 'year', year: 'year', years: 'year' }
  // a count noun matches its plural whichever way the plural is made: try every singular reading. A
  // final s goes from three letters up (prs → pr, vms → vm); es and ies from four
  const forms = (w: string): string[] => {
    const out = new Set([w])
    if (w.length >= 3 && w.endsWith('s') && !w.endsWith('ss')) out.add(w.slice(0, -1))
    if (w.length > 3) {
      if (w.endsWith('ies')) out.add(`${w.slice(0, -3)}y`)
      if (w.endsWith('es')) out.add(w.slice(0, -2))
    }
    return [...out]
  }
  const partForms = (p: string, isTime: boolean): string[] => { const t = p.trim().toLowerCase().replace(/\s+/g, ' '); return isTime ? [t, ...forms(t)].map(x => TIME[x] ?? x) : forms(t) }
  const unitParts = (u: string) => u.toLowerCase().replace(/\s+per\s+/g, '/').split('/')
  const sameUnit = (a: string, b: string): boolean => {
    const pa = unitParts(a)
    const pb = unitParts(b)
    return pa.length === pb.length && pa.every((p, i) => { const fb = partForms(pb[i], i > 0); return partForms(p, i > 0).some(x => fb.includes(x)) })
  }
  if (!model.time_unit) warn('U01', 'time_unit', 'no "time_unit": flow units cannot be checked against stock units (Forrester & Senge 1980).', 'Forrester & Senge 1980')
  else for (const f of model.flows) {
    if (!f.units) continue
    const stocks = [f.from, f.to].map(id => nodeById.get(id)).filter((n): n is Node => n?.kind === 'stock')
    const su = stocks.filter(s => s.units)
    if (su.length === 2 && !sameUnit(su[0].units!, su[1].units!))
      err('U01', `flow "${f.id}"`, `a flow moves one kind of thing, but "${su[0].id}" counts ${su[0].units} and "${su[1].id}" counts ${su[1].units} (Ford 2019, conserved flow).`, 'Ford 2019')
    for (const s of su) if (!sameUnit(f.units, `${s.units}/${model.time_unit}`))
      err('U01', `flow "${f.id}"`, `units "${f.units}" do not match "${s.id}": expected "${s.units}/${model.time_unit}" (Forrester & Senge 1980).`, 'Forrester & Senge 1980')
  }
  if (unitless.length) warn('U01', 'units', `no units on ${unitless.join(', ')}. Units make dimensional errors visible (Forrester & Senge 1980).`, 'Forrester & Senge 1980')

  // ---- the causal graph: live (observed + modelled) and full (with intended and missing)
  const structural = issues.some(i => i.level === 'error' && /^(S0[0-5]|N0[1-58]|N12)$/.test(i.code))
  const vertices = [...model.nodes.filter(n => n.kind !== 'cloud' && n.kind !== 'shadow').map(n => n.id), ...model.flows.map(f => f.id)]
  const isLive = (s: Status) => s === 'observed' || s === 'modelled'
  const allEdges: Edge[] = []
  for (const l of model.links) {
    if (!kindOf(l.from) || !kindOf(l.to)) continue
    allEdges.push({ from: orig(l.from), to: l.to, sign: (l.polarity === '-' ? -1 : 1) as Sign, via: l.id, viaKind: 'link', status: l.status })
  }
  for (const f of model.flows) {
    if (nodeById.get(f.to)?.kind === 'stock') allEdges.push({ from: f.id, to: f.to, sign: 1, via: f.id, viaKind: 'flow', status: f.status })
    if (nodeById.get(f.from)?.kind === 'stock') allEdges.push({ from: f.id, to: f.from, sign: -1, via: f.id, viaKind: 'flow', status: f.status })
  }
  // an edge is live when its link or flow is live and the elements it joins are not intended
  const nodeLive = (id: string) => { const n = nodeById.get(id); return n ? isLive(n.status) : isLive(flowById.get(id)?.status ?? 'observed') }
  const liveEdges = allEdges.filter(e => isLive(e.status as Status) && nodeLive(e.from) && nodeLive(e.to))
  const liveRes = structural ? { cycles: [], truncated: false } : enumerateCycles(vertices, liveEdges, MAX_CYCLES)
  const fullRes = structural ? { cycles: [], truncated: false } : enumerateCycles(vertices, allEdges, MAX_CYCLES)
  if (liveRes.truncated || fullRes.truncated)
    err('L08', 'loops', `more than ${MAX_CYCLES} feedback loops, or too many paths to search. Aggregate variables or narrow the question.`)

  const labelOf = namer(model)
  const statusOf = (id: string): Status | undefined => nodeById.get(id)?.status ?? flowById.get(id)?.status ?? linkById.get(id)?.status
  const claimOf = (id: string): string | undefined => nodeById.get(id)?.claim ?? flowById.get(id)?.claim ?? linkById.get(id)?.claim
  const figureOfEdge = (e: Edge): string => (e.viaKind === 'link' ? linkById.get(e.via)?.figure : flowById.get(e.via)?.figure) ?? ''

  const describe = (c0: { nodes: string[]; edges: Edge[]; sign: Sign }, kind: 'live' | 'designed', startAt?: string): LoopReport => {
    let k = startAt ? c0.nodes.indexOf(startAt) : -1
    if (k < 0) k = Math.max(0, c0.nodes.findIndex(v => nodeById.get(v)?.kind === 'stock'))
    const c = { nodes: [...c0.nodes.slice(k), ...c0.nodes.slice(0, k)], edges: [...c0.edges.slice(k), ...c0.edges.slice(0, k)], sign: c0.sign }
    const via = c.edges.map(e => e.via)
    const members = [...new Set([...c.nodes, ...via])]
    const figs = [...new Set(c.edges.map(figureOfEdge))]
    const weak = members.filter(m => statusOf(m) !== undefined && statusOf(m) !== 'observed')
    const said = (list: string[]) => list.map(m => `${labelOf(m)} (${statusOf(m)}: ${claimOf(m) ?? 'no claim given'})`).join('; ')
    const notBuilt = weak.filter(m => statusOf(m) === 'intended' || statusOf(m) === 'missing')
    const modelled = weak.filter(m => statusOf(m) === 'modelled')
    const hedge = [notBuilt.length ? `Not built: ${said(notBuilt)}.` : '', modelled.length ? `Modelled, not observed: ${said(modelled)}.` : ''].filter(Boolean).join(' ') || undefined
    let d = 1
    const steps = [`more ${labelOf(c.nodes[0])}`]
    c.edges.forEach((e, i) => {
      d *= e.sign
      const next = c.nodes[(i + 1) % c.nodes.length]
      const how = e.viaKind === 'flow' ? `${labelOf(e.via)} ${e.sign > 0 ? 'fills it' : 'drains it'}` : e.sign > 0 ? '+' : '−'
      steps.push(`${d > 0 ? 'more' : 'less'} ${labelOf(next)} (${how})`)
    })
    return {
      figure: figs.join('+'), path: c.nodes, via, type: loopType(c.sign),
      stocks: c.nodes.filter(v => nodeById.get(v)?.kind === 'stock'), members, kind,
      modelled: weak.length > 0, hedge, trace: `${steps.join(' → ')}: ${c.sign > 0 ? 'reinforcing' : 'balancing'}`, declared: false,
    }
  }

  const rank = new Map([...vertices].sort().map((v, i) => [v, i]))
  const keyOf = (path: string[]): string => {
    let s = 0
    for (let i = 1; i < path.length; i++) if ((rank.get(path[i]) ?? 1e9) < (rank.get(path[s]) ?? 1e9)) s = i
    return [...path.slice(s), ...path.slice(0, s)].join('>')
  }
  // a routine loop: a stock and its own outflow, the stock read with + (so the loop balances)
  const isRoutine = (c: { nodes: string[]; edges: Edge[]; sign: Sign }): boolean => {
    if (c.nodes.length !== 2 || c.sign !== -1) return false
    const stock = c.nodes.find(v => nodeById.get(v)?.kind === 'stock')
    const flow = c.nodes.find(v => flowById.has(v))
    return !!stock && !!flow && flowById.get(flow)!.from === stock && c.edges.some(e => e.viaKind === 'link' && e.sign === 1)
  }
  const liveByKey = new Map(liveRes.cycles.map(c => [c.key, c]))
  const fullByKey = new Map(fullRes.cycles.map(c => [c.key, c]))
  const declaredKeys = new Map<string, string>()
  const loopReports: LoopReport[] = []
  for (const lp of model.loops) {
    const w = `loop "${lp.id}"`
    const unknown = lp.path.filter(id => !kindOf(id))
    if (unknown.length) { err('S03', w, `"path" names unknown ids: ${unknown.join(', ')}.`); continue }
    const path = lp.path.map(orig)
    const clouds = path.filter(id => nodeById.get(id)?.kind === 'cloud')
    if (clouds.length) { err('L03', w, `a loop cannot pass through a cloud (${clouds.join(', ')}).`); continue }
    if (new Set(path).size !== path.length) { err('L03', w, '"path" repeats an element; a loop visits each element once.'); continue }
    const key = keyOf(path)
    const dup = declaredKeys.get(key)
    if (dup) { err('L02', w, `declares the same loop as "${dup}".`); continue }
    declaredKeys.set(key, lp.id)
    if (structural) continue
    const c = liveByKey.get(key)
    if (!c) {
      if (fullByKey.has(key)) { err('L03', w, 'this loop runs through an intended or missing part, so it is not live. Remove it from "loops": the page lists it under "loops that would exist if built".'); continue }
      const gaps: string[] = []
      for (let i = 0; i < path.length; i++) {
        const a = path[i]
        const b = path[(i + 1) % path.length]
        if (!allEdges.some(e => e.from === a && e.to === b)) gaps.push(`${a} → ${b}`)
      }
      err('L03', w, gaps.length
        ? `is not a closed causal path: nothing connects ${gaps.join(', ')}. A flow connects only to the stock it fills or drains; a stock reaches a flow only through a link.`
        : 'is not one of the model\'s loops.')
      continue
    }
    const d = describe(c, 'live', path[0])
    const m = LOOP_ID.exec(lp.id)
    if (m && m[1] !== d.type)
      err('L04', w, `is ${d.type === 'R' ? 'reinforcing' : 'balancing'} by its signs: ${c.edges.filter(e => e.sign < 0).length} negative step(s) (${d.trace}). Your trace said otherwise, so a sign or the trace is wrong: re-read each link's mechanism (Ford 2019; Sterman 2001).`, 'Ford 2019; Sterman 2001')
    if (lp.goal && owner.has(lp.goal) && !nodeById.has(lp.goal)) err('S03', w, `"goal" "${lp.goal}" names a ${owner.get(lp.goal)}, not a node.`)
    else if (lp.goal && !owner.has(lp.goal) && /^[A-Za-z][\w.-]*$/.test(lp.goal) && /[_.]|[a-z][A-Z]/.test(lp.goal))
      warn('L06', w, `"goal" "${lp.goal}" looks like an id but names no node; use a node id, or a short phrase.`)
    if (lp.minor && !isRoutine(c)) err('L09', w, '"minor" is only for a routine loop: a stock draining through its own outflow, read with a + link. Give this loop a story instead.')
    loopReports.push({ ...d, id: lp.id, name: lp.name, minor: lp.minor, declared: true })
  }

  // undeclared live cycles, each with a declaration to complete
  // the route of a loop: each step's mechanism, with no sign and no verdict, for the modeller to trace
  const routeOf = (d: LoopReport): string => {
    const steps = [labelOf(d.path[0])]
    d.via.forEach((via, i) => {
      const next = d.path[(i + 1) % d.path.length]
      const l = linkById.get(via)
      const how = l ? `reads it: ${l.mechanism}` : flowById.get(via)?.to === next ? `${labelOf(via)} fills it` : `${labelOf(via)} drains it`
      steps.push(`${labelOf(next)} (${how})`)
    })
    return steps.join(' → ')
  }
  const undeclared: UndeclaredLoop[] = []
  const used = { R: 0, B: 0 }
  for (const lp of model.loops) { const m = LOOP_ID.exec(lp.id); if (m) used[m[1] as 'R' | 'B'] = Math.max(used[m[1] as 'R' | 'B'], Number(m[2])) }
  // the next id after the last loop's that no element holds: ids share one namespace, regardless of case
  const nextFree = (k: 'R' | 'B'): string => { let n = used[k] + 1; while (ownerOf.has(`${k.toLowerCase()}${n}`)) n++; return `${k}${n}` }
  for (const c of liveRes.cycles) {
    const d = describe(c, 'live')
    if (d.figure.includes('+')) err('L05', `loop ${c.nodes.join(' → ')}`, `runs across figures (${d.figure}). A loop must lie in one figure: move its elements into one figure.`)
    if (d.stocks.length === 0)
      err('L01', `loop ${c.nodes.join(' → ')}`, 'contains no stock. "Any feedback loop … must include at least one stock" (Naugle 2024). Usually one variable here accumulates: a perceived or cached value, an in-flight count, a backlog. Draw it as a stock, or remove a link the code does not have.', 'Naugle 2024')
    if (!declaredKeys.has(c.key))
      undeclared.push({ figure: d.figure, path: d.path, route: routeOf(d), declare: { id: '', name: '', path: d.path, story: '' } })
  }
  if (undeclared.length)
    err('L02', 'loops', `${undeclared.length} live feedback loop(s) are not declared. Each is listed under "undeclared" with its route and a declaration to complete. Trace a change around it from the mechanisms ("more X → more Y → …"), decide whether it reinforces or balances, then fill in the id (next free: ${nextFree('R')}, ${nextFree('B')}), the name and the story; the check then compares your verdict with the signs. A routine drain (a stock read with + by its own outflow) may be declared "minor": true instead of given a story. Or fix the structure if the loop is not real (Sterman 2001).`, 'Sterman 2001')
  const perFig = new Map<string, number>()
  for (const l of loopReports) if (!l.minor) perFig.set(l.figure, (perFig.get(l.figure) ?? 0) + 1)
  const allPerFig = new Map<string, number>()
  for (const l of loopReports) allPerFig.set(l.figure, (allPerFig.get(l.figure) ?? 0) + 1)
  for (const [f, k] of allPerFig) if (k > MAX_LOOPS_PER_FIGURE) err('L08', `figure "${f}"`, `${k} loops in one figure cannot be drawn or read (at most ${MAX_LOOPS_PER_FIGURE}; plugin rule). Split the figure by question, or aggregate.`)
  for (const [f, k] of perFig) if (k > BUSY_FIGURE) warn('L07', `figure "${f}"`, `${k} loops in one figure are hard to read. Split the figure by question (plugin rule, after Sterman 2001's advice against one comprehensive diagram).`)

  const designedAll = fullRes.cycles.filter(c => !liveByKey.has(c.key))
  for (const c of designedAll) if (!c.nodes.some(v => nodeById.get(v)?.kind === 'stock'))
    warn('L01', `loop ${c.nodes.join(' → ')}`, 'this loop would exist if the intended or missing parts were built, and it contains no stock (Naugle 2024): as specified, something that accumulates is drawn as a variable. Draw it as a stock, or say in the claim why the design has no accumulation.', 'Naugle 2024')
  const designed: LoopReport[] = designedAll.slice(0, MAX_DESIGNED).map(c => describe(c, 'designed'))

  // ---- E04 for loop names and stories: the sources of the loop's own elements and of what links into them
  for (const lr of loopReports) {
    const lp = model.loops.find(x => x.id === lr.id)
    if (!lp) continue
    // one hop, read from the members alone, so the order of links in the file cannot widen it
    const members = new Set(lr.members)
    const scope = new Set(members)
    for (const l of model.links) if (members.has(l.to)) { scope.add(l.id); scope.add(orig(l.from)) }
    if (lp.goal && nodeById.has(lp.goal)) scope.add(lp.goal)
    const pool = [...scope].map(id => nodeById.get(id) ?? flowById.get(id) ?? linkById.get(id)).filter((x): x is Node | Flow | Link => !!x).flatMap(sourcesOf)
    const whose = "the sources of the loop's elements or of what links into them"
    numberRule('name', lp.name, pool, `loop "${lp.id}"`, whose)
    numberRule('story', lp.story, pool, `loop "${lp.id}"`, whose)
  }

  // ---- X01 (extreme condition) and X03 (delays hide stocks), on the live graph
  const liveOut = new Map<string, string[]>()
  for (const e of liveEdges) liveOut.set(e.from, [...(liveOut.get(e.from) ?? []), e.to])
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set([from])
    const stack = [from]
    while (stack.length) {
      const v = stack.pop()!
      for (const w of liveOut.get(v) ?? []) {
        if (w === to) return true
        if (!seen.has(w)) { seen.add(w); stack.push(w) }
      }
    }
    return false
  }
  // information edges only (links), so the guard really reads the stock on the way to its outflow
  const infoOutOf = (edges: Edge[]): Map<string, Edge[]> => {
    const out = new Map<string, Edge[]>()
    for (const e of edges) if (e.viaKind === 'link') out.set(e.from, [...(out.get(e.from) ?? []), e])
    return out
  }
  const liveInfo = infoOutOf(liveEdges)
  const fullInfo = infoOutOf(allEdges)
  const readsWithSign = (infoOut: Map<string, Edge[]>, from: string, to: string): Set<number> => {
    const signs = new Set<number>()
    const seen = new Set<string>()
    const stack: [string, number][] = [[from, 1]]
    while (stack.length) {
      const [v, sg] = stack.pop()!
      for (const e of infoOut.get(v) ?? []) {
        const s2 = sg * e.sign
        if (e.to === to) { signs.add(s2); continue }
        if (nodeById.get(e.to)?.kind === 'stock') continue
        const key = `${e.to}|${s2}`
        if (!seen.has(key)) { seen.add(key); stack.push([e.to, s2]) }
      }
    }
    return signs
  }
  // decided once, from both graphs: a net + path in the live graph is a built guard; one in the full graph
  // only is a guard recorded as not built (the finding); a net − path, built or not, is no guard
  if (!structural) for (const f of model.flows) {
    if (!isLive(f.status) || nodeById.get(f.from)?.kind !== 'stock') continue
    const s = f.from
    if (readsWithSign(liveInfo, s, f.id).has(1)) continue
    const any = readsWithSign(fullInfo, s, f.id)
    if (any.has(1)) continue
    if (!any.size)
      warn('X01', `flow "${f.id}"`, `what stops "${f.label}" when "${labelOf(s)}" is empty? Nothing in the model reads "${labelOf(s)}" on the way to it. Cite the guard as a link; if the code has none, record the link as "missing" (or "intended" if a document specifies it) (direct extreme-condition test: Forrester & Senge 1980; Schwaninger & Groesser 2009).`, 'Forrester & Senge 1980; Schwaninger & Groesser 2009')
    else
      warn('X01', `flow "${f.id}"`, `"${labelOf(s)}" reaches "${f.label}" only through net − links (built or not), so an empty "${labelOf(s)}" would drain fastest. If the code stops the drain at zero, a + link is missing: cite it, or record it as "missing" (or "intended" if a document specifies it) (Forrester & Senge 1980).`, 'Forrester & Senge 1980')
  }
  const onLoop = new Set(loopReports.flatMap(l => l.via))
  for (const l of model.links) if (l.delay && onLoop.has(l.id))
    warn('X03', `link "${l.id}"`, `this information delay sits on a loop. Every delay hides a stock (the last-read "${labelOf(l.from)}"); draw it if the question turns on the delay (Sterman 2001).`, 'Sterman 2001')

  // ---- boundary chart (derived) and B01/B02
  const stocks = model.nodes.filter(n => n.kind === 'stock').map(n => n.id)
  const fromStock = new Set<string>()
  for (const s of stocks) {
    const stack = [s]
    fromStock.add(s)
    while (stack.length) { const v = stack.pop()!; for (const w of liveOut.get(v) ?? []) if (!fromStock.has(w)) { fromStock.add(w); stack.push(w) } }
  }
  const liveVertices = vertices.filter(nodeLive)
  const loopsOfVertex = (v: string) => loopReports.filter(l => l.path.includes(v)).map(l => l.id!).filter(Boolean)
  const boundary = {
    endogenous: liveVertices.filter(v => fromStock.has(v)).map(v => ({ id: v, loops: loopsOfVertex(v) })),
    exogenous: liveVertices.filter(v => !fromStock.has(v)),
    sources_and_sinks: model.nodes.filter(n => n.kind === 'cloud').map(n => n.id),
    not_built: [...model.nodes, ...model.flows, ...model.links].filter(x => x.status === 'intended' || x.status === 'missing').map(x => x.id),
    excluded: model.boundary.excluded,
  }
  const explained = new Set([...model.reference_modes.map(r => r.variable), ...model.answer.loops])
  for (const n of model.nodes) {
    if (n.kind !== 'aux' && n.kind !== 'constant') continue
    const outgoing = model.links.some(l => orig(l.from) === n.id)
    if (!outgoing && !explained.has(n.id)) warn('B01', `node "${n.id}"`, 'affects nothing: no link leaves it. Link it to what reads it, or remove it.')
    if (n.kind === 'aux' && !model.links.some(l => l.to === n.id))
      warn('B02', `node "${n.id}"`, 'a variable with no inputs: if it never changes over the horizon, make it a constant; if it varies, say in "detail" what drives it and why that stays outside the model (Trimble 2014).', 'Trimble 2014')
  }

  // ---- P01: the answer; P05: is the behaviour explained endogenously?
  const liveIds = new Set(loopReports.map(l => l.id))
  if (!structural) for (const id of model.answer.loops) {
    if (!liveIds.has(id)) err('P01', 'answer.loops', `"${id}" is not a declared live loop.`)
    else if (model.loops.find(l => l.id === id)?.minor) err('P01', 'answer.loops', `"${id}" is marked minor, but the answer rests on it: give it a story and drop "minor".`)
  }
  if (!structural) for (const r of model.reference_modes) {
    if (!kindOf(r.variable)) continue
    const v = orig(r.variable)
    const onAny = loopReports.some(l => l.path.includes(v)) || loopReports.some(l => l.path.some(m => reaches(m, v)))
    if (!onAny) warn('P05', 'reference_modes', `"${labelOf(v)}" is on no loop and no loop reaches it, so its behaviour is explained from outside the model. System dynamics looks for endogenous explanations (Richardson 2011); say so in the answer if that is the finding.`, 'Richardson 2011')
  }

  // ---- report
  const all = issues
  const errors = all.filter(i => i.level === 'error')
  const warnings = all.filter(i => i.level === 'warning')
  const count = (k: Kind) => model.nodes.filter(n => n.kind === k).length
  const counts = {
    stocks: count('stock'), flows: model.flows.length, variables: count('aux'), constants: count('constant'),
    clouds: count('cloud'), shadows: count('shadow'), links: model.links.length,
    loops: loopReports.length, reinforcing: loopReports.filter(l => l.type === 'R').length,
    balancing: loopReports.filter(l => l.type === 'B').length, designed_loops: designedAll.length,
    quotes_total: allEvidence(model).length, quotes_verified: quotesVerified,
    quotes_web: allEvidence(model).filter(e => !e.path && e.url).length, evidence_files: [...files.keys()].length,
  }
  const summary = errors.length
    ? `${errors.length} error(s), ${warnings.length} warning(s). Fix the errors, then check again; the page will not render until there are none.`
    : `OK: ${counts.stocks} stocks, ${counts.flows} flows, ${counts.loops} live loops (${counts.reinforcing} R, ${counts.balancing} B), ${counts.quotes_verified} of ${counts.quotes_total} quotes verified; ${warnings.length} warning(s) to resolve or accept.`
  const report: Report = {
    ok: errors.length === 0, summary, spec: SPEC, model_path: modelPath,
    errors: errors.slice(0, MAX_ISSUES), warnings: warnings.slice(0, MAX_ISSUES),
    more: { errors: Math.max(0, errors.length - MAX_ISSUES), warnings: Math.max(0, warnings.length - MAX_ISSUES) },
    skipped: structural ? ['loops', 'extreme conditions', 'boundary', 'the answer\'s loops'] : [],
    loops: loopReports, undeclared: undeclared.slice(0, 20), designed, boundary, counts, not_checked: NOT_CHECKED,
  }
  return { report, model, roots }
}

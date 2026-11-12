// The survey's inventory (DESIGN 3.8): which tracked files look like they hold pending work, which files name
// them, and what the guide files say. The readers (adapter.ts, cli.ts) list and read the files through collect.
import { scanTables } from './markdown.ts'
import { maskPrivacy } from './privacy.ts'

export type SurveyFile = { path: string; text: string }
// named: the person named it a tracker (--tracker)
export type Signals = { named: boolean; name: boolean; idHeadings: number; idTables: number; openBoxes: number;
  doneBoxes: number; todos: number; statusWords: number; dated: boolean; guide: boolean }
export type Candidate = { path: string; signals: Signals; score: number;
  hint: 'likely-tracker' | 'maybe' | 'likely-history' }
// ambiguous: some of the mentions are a bare name that more than one of the top files has; possible: every mention
// is a bare word for a name with no extension, or a path that names no tracked file
export type Reference = { target: string; from: string; count: number; machine: boolean; ambiguous?: true; possible?: true }
// unread: on a stop, the files it left unread, this one included
export type Skipped = { path: string; why: string; unread?: number }
// a file below the score that shows some sign of pending work, and that sign
export type Suspect = { path: string; why: string }
// denied: the files the person's Read rules kept the survey from, counted and never named; notTracker: the
// --not-tracker paths, which leave the candidates and the suspects but are said, so the agent sees the answer
export type Inventory = { files: number; candidates: Candidate[]; suspects: Suspect[]; references: Reference[];
  guides: { path: string; line: number; text: string }[]; skipped: Skipped[]; denied: number; notTracker: string[] }

const NAME = /backlog|todo|roadmap|plan|open|pending|defer|follow.?up|checklist|docket|tracker|playbook|issues|tasks|progress|launch/i
// [ \t] where the plan's pattern says \s: with /m, \s would run on past the line's end
const ID_HEADING = /^#{2,4}[ \t]+[A-Z][A-Z0-9]*-?\d+\b/gm
const ID_HEADERS = ['ID', 'Id', '#', 'Key', 'Ref']
// a list item of any marker: -, *, + or a number
const OPEN_BOX = /^[ \t]*(?:[-*+]|\d+[.)]) \[ \]/gm
const DONE_BOX = /^[ \t]*(?:[-*+]|\d+[.)]) \[[xX]\]/gm
const TODO = /\b(?:TODO|FIXME|XXX)\b/g
const STATUS = /\b(?:OPEN|DEFERRED|PENDING|BLOCKED|PARKED|TRIGGER|FIRED|CLOSED|DONE)\b/g
const DATE = /\d{4}-\d{2}-\d{2}/
const GUIDE = /^(?:README|CLAUDE|AGENTS|CONTRIBUTING|GOAL)(?:\..*)?$/i
const HISTORY_DIR = /^(?:archive|history|logs?|passes|responses)$/i
const GUIDE_LINE = /backlog|source of truth|single|defer|pending|trigger|docket/i
const MARKDOWN = /\.(?:md|markdown|mdx)$/i
// Markdown, plain text, or no extension (TODO): in code, a name like "open.ts" or an OPEN constant is no tracker
const PROSE = /(?:\.(?:md|markdown|mdx|txt|rst|org|adoc)|^[^.]+)$/i
const GUIDE_CUT = 200
const LOCKFILE = /(?:^|\/)(?:[^/]*\.lock|pnpm-lock\.yaml|package-lock\.json)$/
const DATA = /\.(?:ya?ml|json|csv|toml)$/i
const PENDING_HEADING = /^#{1,6}[ \t]+(?:to[ -]?dos?|roadmap|next[ -]steps?)\b/im
const TOP = 15, REFS = 5, SUSPECTS = 15
// letters, digits, space, dot, dash, underscore and slash: a path of these alone no shell reads as more than a word
const SHELL_SAFE = /^[\p{L}\p{Nd} ._/-]*$/u
// why the readers skipped a file
const LOCK = 'a lockfile', BINARY = 'binary (a NUL character)', BIG = 'over 2 MB', UNREADABLE = 'unreadable'
const MISSING = 'missing from the working tree', NOT_FILE = 'not a regular file (a link, a folder or a submodule)'
const AT_FILES = 'stopped at 3,000 files', AT_TOTAL = 'stopped at 30 MB in all'
export const CUT_LIST = 'the list of tracked files was cut short; the files after it were not read'

const baseOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
const count = (re: RegExp, text: string): number => text.match(re)?.length ?? 0
const byPath = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
// "/" separators, with "." and ".." folded
const fold = (p: string): string => {
  const out: string[] = []
  for (const s of p.split('/')) if (s === '..') out.pop(); else if (s !== '.' && s !== '') out.push(s)
  return out.join('/')
}

// a script with no extension (#!) is code
const isProse = (base: string, text: string): boolean => PROSE.test(base) && !text.startsWith('#!')

function signalsOf({ path, text }: SurveyFile, named: boolean): Signals {
  const base = baseOf(path), prose = isProse(base, text)
  return {
    named,
    name: prose && NAME.test(base),
    idHeadings: count(ID_HEADING, text),
    idTables: scanTables(text).filter(t => ID_HEADERS.includes(t.header[0])).length,
    openBoxes: count(OPEN_BOX, text),
    doneBoxes: count(DONE_BOX, text),
    todos: MARKDOWN.test(path) ? 0 : count(TODO, text),
    statusWords: prose ? count(STATUS, text) : 0,
    dated: DATE.test(path),
    guide: GUIDE.test(base),
  }
}

// to one decimal, which every term fits
const scoreOf = (s: Signals): number =>
  Math.round(10 * (3 * +s.name + 2 * s.idHeadings + 2 * s.idTables + s.openBoxes + s.statusWords / 5 + s.todos / 10)) / 10

// The suspects' signs, which the score leaves out (the owner, 2026-11-04): in prose, a TODO, roadmap or next-steps
// heading, TODOs or open boxes; a data file whose name holds a tracker word. In prose the scored signs too, below
// 3 (second check, finding 17, the owner's "Widen the suspects"): a lone ID table scores 2. '' for none.
function suspectOf({ path, text }: SurveyFile, s: Signals): string {
  const base = baseOf(path)
  if (DATA.test(base)) return NAME.test(base) ? 'a data file named like a tracker' : ''
  if (!isProse(base, text)) return ''
  const todos = count(TODO, text)
  return [PENDING_HEADING.test(text) && 'a TODO, roadmap or next-steps heading', todos && `${todos} TODOs`,
    s.openBoxes && `${s.openBoxes} open boxes`, s.idHeadings && `${s.idHeadings} ID headings`,
    s.idTables && `${s.idTables} ID tables`, s.statusWords && `${s.statusWords} status words`].filter(Boolean).join(', ')
}

// The person's answers (the owner, 2026-11-04): a tracker is a candidate, ranked first, even when it was not read; a
// not-tracker is neither a candidate nor a suspect. checkNamed has made both tracked, "/"-separated paths.
export function inventory(files: SurveyFile[], skipped: Skipped[] = [],
  { denied = 0, tracker = [] as string[], notTracker = [] as string[] } = {}): Inventory {
  const read = new Set(files.map(f => f.path))
  const sorted = [...files, ...tracker.filter(p => !read.has(p)).map(path => ({ path, text: '' }))].sort((a, b) => byPath(a.path, b.path))
  const candidates: Candidate[] = [], suspects: Suspect[] = []
  for (const f of sorted) {
    if (notTracker.includes(f.path)) continue
    const signals = signalsOf(f, tracker.includes(f.path)), score = scoreOf(signals)
    if (score < 3 && !signals.named) { const why = suspectOf(f, signals); if (why) suspects.push({ path: f.path, why }); continue }
    const history = signals.dated || f.path.split('/').slice(0, -1).some(d => HISTORY_DIR.test(d))
    candidates.push({ path: f.path, signals, score, hint: history ? 'likely-history' : score >= 10 ? 'likely-tracker' : 'maybe' })
  }
  // named first; history last: it stays where it is, so it should not spend the top places the references are counted for
  const old = (c: Candidate) => +(c.hint === 'likely-history')
  candidates.sort((a, b) => +b.signals.named - +a.signals.named || old(a) - old(b) || b.score - a.score || byPath(a.path, b.path))

  // one pass per file for all the top names, each with the path written before it; a name inside a longer one
  // ("MY-BACKLOG.md", "backlog.mdx") is not it
  const top = candidates.slice(0, TOP).map(c => c.path)
  const references: Reference[] = []
  if (top.length) {
    const same = new Map<string, string[]>()
    for (const t of top) same.set(baseOf(t), [...(same.get(baseOf(t)) ?? []), t])
    const names = [...same.keys()].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    // "/*": a URL's "//" may open the path
    const re = new RegExp(`(?<![\\w./-])(/*(?:[\\w.-]+/)*)(${names.join('|')})(?![\\w-])`, 'g')
    const known = new Set([...sorted.map(f => f.path), ...skipped.map(s => s.path)])
    // a target ends with the written path where the character before it in the target is not a path character: "/",
    // or a space, "@" or accented letter the capture stopped at (second check, finding 10)
    const ends = (t: string, said: string) => t.endsWith(said) && !/[\w.-]/.test(t.charAt(t.length - said.length - 1))
    for (const f of sorted) {
      // possible: a bare word for a name with no extension ("TODO", "open"), which plain text uses too, or a path that
      // names no tracked file ($ROOT/x, an absolute path, a URL)
      const hits = new Map<string, { count: number; possible: number; ambiguous: boolean }>()
      const hit = (t: string, ambiguous = false, possible = false) => {
        const h = hits.get(t) ?? { count: 0, possible: 0, ambiguous: false }
        hits.set(t, { count: h.count + +!possible, possible: h.possible + +possible, ambiguous: h.ambiguous || ambiguous })
      }
      // percent-encoded links decoded; a run that is no UTF-8 stays as it is
      const text = f.text.replace(/(?:%[0-9A-Fa-f]{2})+/g, s => { try { return decodeURIComponent(s) } catch { return s } })
      for (const [, before, name] of text.matchAll(re)) {
        const targets = same.get(name)!
        if (!before) { for (const t of targets) hit(t, targets.length > 1 && name.includes('.'), !name.includes('.')); continue }
        const relative = /^\.\.?\//.test(before)
        const said = fold(relative ? `${f.path}/../${before}${name}` : before + name)
        // a script, a workflow or a hook runs from the top, so its ./ and ../ are folded from there too
        const fromTop = relative && !MARKDOWN.test(f.path) ? fold(before + name) : said
        const credited = targets.filter(t => t === said || t === fromTop || (!relative && ends(t, said)))
        for (const t of credited) hit(t)
        if (!credited.length && !known.has(said) && !known.has(fromTop)) for (const t of targets) hit(t, false, true)
      }
      for (const [target, h] of hits) if (target !== f.path)
        references.push({ target, from: f.path, count: h.count || h.possible, machine: !MARKDOWN.test(f.path),
          ...(h.ambiguous ? { ambiguous: true as const } : {}), ...(h.count ? {} : { possible: true as const }) })
    }
    // possible uses after the readers, by path: their count says nothing
    references.sort((a, b) => top.indexOf(a.target) - top.indexOf(b.target) || +!!a.possible - +!!b.possible
      || (a.possible ? 0 : b.count - a.count) || byPath(a.from, b.from))
  }

  const guides: Inventory['guides'] = []
  for (const f of sorted) {
    if (!GUIDE.test(baseOf(f.path))) continue
    f.text.split(/\r?\n/).forEach((l, i) => {
      if (GUIDE_LINE.test(l)) guides.push({ path: f.path, line: i + 1, text: maskPrivacy(l.trim()) })
    })
  }
  return { files: files.length, candidates, suspects, references, guides, skipped, denied, notTracker }
}

const LABELS: [keyof Signals, string][] = [['idHeadings', 'ID headings'], ['idTables', 'ID tables'],
  ['openBoxes', 'open boxes'], ['doneBoxes', 'done boxes'], ['statusWords', 'status words'], ['todos', 'TODOs']]

function said(s: Signals): string {
  const out = [...(s.named ? ['named by --tracker'] : []), ...(s.name ? ['name'] : [])]
  for (const [k, label] of LABELS) if (s[k]) out.push(`${s[k]} ${label}`)
  if (s.dated) out.push('dated path')
  if (s.guide) out.push('guide file')
  return out.join(', ')
}

// Not measured's reasons, in its order; a stop is a limit that ended the reading
const DENIED = 'denied by Read rules', CUT = 'past the end of a cut-short list of tracked files'
const REASONS: [string, (s: Skipped) => boolean, boolean][] = [
  ['over 2 MB', s => s.why === BIG, false], ['binary or lockfile', s => s.why === LOCK || s.why === BINARY, false],
  ['unreadable', s => s.why === UNREADABLE, false], [MISSING, s => s.why === MISSING, false],
  ['links, folders or submodules', s => s.why === NOT_FILE, false], [DENIED, () => false, false],
  ['past the 3,000-file limit', s => s.why.startsWith(AT_FILES), true], ['past the 30 MB limit', s => s.why.startsWith(AT_TOTAL), true],
  [CUT, s => s.why === CUT_LIST, true]]

/** The files not read, counted by reason ("5 past the 3,000-file limit"); with stops, only the limits that ended the reading. */
export function notRead(inv: Pick<Inventory, 'skipped' | 'denied'>, stops = false): string[] {
  const out: string[] = []
  for (const [label, of, stop] of REASONS) {
    if (stops && !stop) continue
    const n = label === DENIED ? inv.denied : inv.skipped.filter(of).reduce((n, s) => n + (s.unread ?? 1), 0)
    if (n) out.push(label === CUT ? label : `${n} ${label}`)
  }
  return out
}

/** The survey procedure with its lines that name the Node command left out: with a file denied, the re-run is the
 *  person's /housekeeping survey, since the Node command ignores the Read rules (second check, finding 1). */
export const withoutNode = (procedure: string): string => procedure.split('\n').filter(l => !l.includes('cli.ts')).join('\n')

export function formatInventory(inv: Inventory, maxChars = 20_000): string {
  // with a file denied no note offers the --json output: only the Node command gives it, and it ignores the Read rules
  const json = inv.denied ? '' : ' (the --json output names them)'
  const lines =[`housekeeping survey: ${inv.files} files read, ${inv.candidates.length} candidates, ${inv.skipped.length} skipped`]
  // both answers, where the cut cannot reach: a tracker is a named candidate, a not-tracker is nowhere else
  const trackers = inv.candidates.filter(c => c.signals.named).map(c => c.path)
  if (trackers.length || inv.notTracker.length)
    lines.push('', `Answers in this run: --tracker ${trackers.join(', ') || 'none'}; --not-tracker ${inv.notTracker.join(', ') || 'none'}.`)
  // "nothing to move" only where nothing is tracked; elsewhere what was measured, and Not measured right after the
  // header, so the cut cannot hide it
  if (!inv.files && !inv.skipped.length && !inv.denied) lines.push('', 'No tracked files: nothing to move. /housekeeping init sets up the pair.')
  else if (!inv.candidates.length) lines.push('', "No file reached the survey's score of 3. Not measured, below, says what the survey " +
    'did not read, and Suspects the files with some sign of pending work.')
  lines.push('', '## Not measured', `Files not read: ${notRead(inv).join(', ') || 'none'}.`,
    'The score does not read data files (YAML, JSON, CSV, TOML), nor code files apart from their TODO comments.')
  if (inv.candidates.length) {
    lines.push('', '## Candidates (score, hint, path: signals)')
    for (const c of inv.candidates) lines.push(`${c.score.toFixed(1).padStart(6)}  ${c.hint.padEnd(14)}  ${c.path}: ${said(c.signals)}`)
  }
  lines.push('', '## Suspects (below the score of 3, with some sign of pending work)')
  // a path the procedure sends through the slash route, which uses no shell (second check, finding 3)
  for (const s of inv.suspects.slice(0, SUSPECTS))
    lines.push(`${s.path}: ${s.why}${SHELL_SAFE.test(s.path) ? '' : ' (name it only through /housekeeping survey: a shell can read this path as commands)'}`)
  if (!inv.suspects.length) lines.push('none')
  else if (inv.suspects.length > SUSPECTS) lines.push(`and ${inv.suspects.length - SUSPECTS} more${json}`)
  // before the references and guides, the long sections, so a cut hides them first; lockfiles and binaries are counted
  const noise = (s: Skipped) => s.why === LOCK || s.why === BINARY
  if (inv.skipped.length) {
    lines.push('', '## Skipped')
    for (const s of inv.skipped) if (!noise(s)) lines.push(`${s.path}: ${s.why}`)
    const n = inv.skipped.filter(noise).length
    if (n) lines.push(`and ${n} more: lockfiles and binaries${json}`)
  }
  // at most REFS files per target, so the references (unbounded) cannot crowd the guide lines out of the budget
  if (inv.references.length) {
    lines.push('', `## Files that name the top ${TOP}, at most ${REFS} each (machine: not Markdown, so a rename can break it)`)
    const byTarget = new Map<string, Reference[]>()
    for (const r of inv.references) { const a = byTarget.get(r.target); if (a) a.push(r); else byTarget.set(r.target, [r]) }
    for (const [target, refs] of byTarget) {
      lines.push(target)
      for (const r of refs.slice(0, REFS))
        lines.push(`${String(r.count).padStart(6)}  ${r.from}${r.machine ? ' (machine)' : ''}${r.ambiguous ? ' (ambiguous: a bare name several targets share)' : ''}${r.possible ? ' (possible use: a bare word, or a path that names no tracked file)' : ''}`)
      const rest = refs.slice(REFS)
      if (rest.length) lines.push(`        and ${rest.length} more, ${rest.filter(r => r.machine).length} of them machine${json}`)
    }
  }
  if (inv.guides.length) {
    lines.push('', '## What the guide files say')
    // whole in the --json output; "..." tells the reader the line goes on in its file
    for (const g of inv.guides)
      lines.push(`${g.path}:${g.line}: ${g.text.length > GUIDE_CUT ? g.text.slice(0, GUIDE_CUT) + '...' : g.text}`)
  }

  const text = lines.join('\n')
  if (text.length <= maxChars) return text
  const note = (n: number) => `[cut at ${maxChars} characters: ${n} more lines${inv.denied ? '' : '; the --json output has everything'}]`
  let kept = 0, used = 0
  while (kept < lines.length && used + lines[kept].length + 1 + note(lines.length).length <= maxChars) used += lines[kept++].length + 1
  return [...lines.slice(0, kept), note(lines.length - kept)].join('\n').slice(0, maxChars)
}

// The readers' rules: lockfiles, links, files over 2 MB and text holding a NUL are skipped, and reading stops at
// 3,000 files or 30 MB in all. stat answers null for a missing file; read, null for an unreadable one.
// shortcut: text that is not UTF-8 but holds no NUL (Latin-1, say) is read with U+FFFD for its stray bytes and is not
// counted as skipped, short of Review Focus 3, because the plugin's $.fs.read returns decoded text; upgrade when
// a reader can see the bytes. Binaries and UTF-16 are still caught by the NUL rule.
export const MAX_FILE = 2 * 1024 * 1024, MAX_FILES = 3000, MAX_TOTAL = 30 * 1024 * 1024
type Stat = { file: boolean; size: number } | null

/** The person's --tracker and --not-tracker paths, "/"-separated from the top, each once; an error names any that
 *  git does not track, or that is named both ways. */
export function checkNamed(paths: string[], tracker: string[], notTracker: string[]): { tracker: string[]; notTracker: string[] } | { error: string } {
  const norm = (ps: string[]) => [...new Set(ps.map(p => p.replaceAll('\\', '/').replace(/^(?:\.\/)+/, '')))]
  const t = norm(tracker), n = norm(notTracker), tracked = new Set(paths)
  const bad = [...t, ...n].filter(p => !tracked.has(p)), both = t.filter(p => n.includes(p))
  if (bad.length) return { error: `not a tracked file: ${bad.join(', ')}` }
  if (both.length) return { error: `named both --tracker and --not-tracker: ${both.join(', ')}` }
  return { tracker: t, notTracker: n }
}

// first: the --tracker paths, read before the rest. allow: false for a file the person's Read rules deny, which is
// counted and never named, read or stat'ed.
export async function collect(paths: string[], stat: (path: string) => Stat | Promise<Stat>,
  read: (path: string) => string | null | Promise<string | null>,
  { allow, first = [] }: { allow?: (path: string) => boolean | Promise<boolean>; first?: string[] } = {}): Promise<{ files: SurveyFile[]; skipped: Skipped[]; denied: number }> {
  const files: SurveyFile[] = [], skipped: Skipped[] = []
  let total = 0, denied = 0
  // then names that look like trackers or guides, so the limits fall on the rest
  const looks = (p: string) => NAME.test(baseOf(p)) || GUIDE.test(baseOf(p))
  const rest = paths.filter(p => !first.includes(p))
  paths = [...first, ...rest.filter(looks), ...rest.filter(p => !looks(p))]
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]
    const skip = (why: string) => skipped.push({ path, why })
    const stop = (why: string) => skipped.push({ path, why: `${why}: this file and the ${paths.length - i - 1} after it were not read`, unread: paths.length - i })
    // the deny first, so no stop names a denied file
    if (allow && !(await allow(path))) { denied++; continue }
    if (files.length >= MAX_FILES) { stop(AT_FILES); break }
    if (LOCKFILE.test(path)) { skip(LOCK); continue }
    const s = await stat(path)
    if (!s) { skip(MISSING); continue }
    if (!s.file) { skip(NOT_FILE); continue }
    if (s.size > MAX_FILE) { skip(BIG); continue }
    if (total + s.size > MAX_TOTAL) { stop(AT_TOTAL); break }
    const text = await read(path)
    total += s.size
    if (text === null) skip(UNREADABLE)
    else if (text.includes('\0')) skip(BINARY)
    else files.push({ path, text })
  }
  return { files, skipped, denied }
}

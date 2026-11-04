// The survey's inventory (DESIGN 3.8): which tracked files look like they hold pending work, which files name
// them, and what the guide files say. The readers (adapter.ts, cli.ts) list and read the files through collect.
import { scanTables } from './markdown.ts'
import { maskPrivacy } from './privacy.ts'

export type SurveyFile = { path: string; text: string }
export type Signals = { name: boolean; idHeadings: number; idTables: number; openBoxes: number;
  doneBoxes: number; todos: number; statusWords: number; dated: boolean; guide: boolean }
export type Candidate = { path: string; signals: Signals; score: number;
  hint: 'likely-tracker' | 'maybe' | 'likely-history' }
export type Reference = { target: string; from: string; count: number; machine: boolean }
export type Skipped = { path: string; why: string }
export type Inventory = { files: number; candidates: Candidate[]; references: Reference[];
  guides: { path: string; line: number; text: string }[]; skipped: Skipped[] }

const NAME = /backlog|todo|roadmap|plan|open|pending|defer|follow.?up|checklist|docket|tracker|playbook|issues|tasks|progress|launch/i
// [ \t] where the plan's pattern says \s: with /m, \s would run on past the line's end
const ID_HEADING = /^#{2,4}[ \t]+[A-Z][A-Z0-9]*-?\d+\b/gm
const ID_HEADERS = ['ID', 'Id', '#', 'Key', 'Ref']
const OPEN_BOX = /^[ \t]*- \[ \]/gm
const DONE_BOX = /^[ \t]*- \[[xX]\]/gm
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
const TOP = 15, REFS = 5

const baseOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)
const count = (re: RegExp, text: string): number => text.match(re)?.length ?? 0
const byPath = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

function signalsOf({ path, text }: SurveyFile): Signals {
  const base = baseOf(path), prose = PROSE.test(base)
  return {
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

export function inventory(files: SurveyFile[], skipped: Skipped[] = []): Inventory {
  const sorted = [...files].sort((a, b) => byPath(a.path, b.path))
  const candidates: Candidate[] = []
  for (const f of sorted) {
    const signals = signalsOf(f), score = scoreOf(signals)
    if (score < 3) continue
    const history = signals.dated || f.path.split('/').slice(0, -1).some(d => HISTORY_DIR.test(d))
    candidates.push({ path: f.path, signals, score, hint: history ? 'likely-history' : score >= 10 ? 'likely-tracker' : 'maybe' })
  }
  // history last: it stays where it is, so it should not spend the top places the references are counted for
  const old = (c: Candidate) => +(c.hint === 'likely-history')
  candidates.sort((a, b) => old(a) - old(b) || b.score - a.score || byPath(a.path, b.path))

  // one pass per file for all the top names; a name inside a longer one ("MY-BACKLOG.md", "backlog.mdx") is not it
  const top = candidates.slice(0, TOP).map(c => c.path)
  const references: Reference[] = []
  if (top.length) {
    const names = [...new Set(top.map(baseOf))].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const re = new RegExp(`(?<![\\w-])(?:${names.join('|')})(?![\\w-])`, 'g')
    for (const f of sorted) {
      const hits = new Map<string, number>()
      for (const m of f.text.matchAll(re)) hits.set(m[0], (hits.get(m[0]) ?? 0) + 1)
      for (const target of top) {
        const n = hits.get(baseOf(target))
        if (n && target !== f.path) references.push({ target, from: f.path, count: n, machine: !MARKDOWN.test(f.path) })
      }
    }
    references.sort((a, b) => top.indexOf(a.target) - top.indexOf(b.target) || b.count - a.count || byPath(a.from, b.from))
  }

  const guides: Inventory['guides'] = []
  for (const f of sorted) {
    if (!GUIDE.test(baseOf(f.path))) continue
    f.text.split(/\r?\n/).forEach((l, i) => {
      if (GUIDE_LINE.test(l)) guides.push({ path: f.path, line: i + 1, text: maskPrivacy(l.trim()) })
    })
  }
  return { files: files.length, candidates, references, guides, skipped }
}

const LABELS: [keyof Signals, string][] = [['idHeadings', 'ID headings'], ['idTables', 'ID tables'],
  ['openBoxes', 'open boxes'], ['doneBoxes', 'done boxes'], ['statusWords', 'status words'], ['todos', 'TODOs']]

function said(s: Signals): string {
  const out = s.name ? ['name'] : []
  for (const [k, label] of LABELS) if (s[k]) out.push(`${s[k]} ${label}`)
  if (s.dated) out.push('dated path')
  if (s.guide) out.push('guide file')
  return out.join(', ')
}

export function formatInventory(inv: Inventory, maxChars = 20_000): string {
  const lines = [`housekeeping survey: ${inv.files} files read, ${inv.candidates.length} candidates, ${inv.skipped.length} skipped`]
  if (!inv.candidates.length) {
    lines.push('', 'No file holds signs of pending work: nothing to move. /housekeeping init sets up the pair.')
  } else {
    lines.push('', '## Candidates (score, hint, path: signals)')
    for (const c of inv.candidates) lines.push(`${c.score.toFixed(1).padStart(6)}  ${c.hint.padEnd(14)}  ${c.path}: ${said(c.signals)}`)
  }
  // before the references and guides, the long sections, so a cut hides them first; lockfiles and binaries are counted
  const noise = (s: Skipped) => s.why === LOCK || s.why === BINARY
  if (inv.skipped.length) {
    lines.push('', '## Skipped')
    for (const s of inv.skipped) if (!noise(s)) lines.push(`${s.path}: ${s.why}`)
    const n = inv.skipped.filter(noise).length
    if (n) lines.push(`and ${n} more: lockfiles and binaries (the --json output names them)`)
  }
  // at most REFS files per target, so the references (unbounded) cannot crowd the guide lines out of the budget
  if (inv.references.length) {
    lines.push('', `## Files that name the top ${TOP}, at most ${REFS} each (machine: not Markdown, so a rename can break it)`)
    const byTarget = new Map<string, Reference[]>()
    for (const r of inv.references) { const a = byTarget.get(r.target); if (a) a.push(r); else byTarget.set(r.target, [r]) }
    for (const [target, refs] of byTarget) {
      lines.push(target)
      for (const r of refs.slice(0, REFS)) lines.push(`${String(r.count).padStart(6)}  ${r.from}${r.machine ? ' (machine)' : ''}`)
      const rest = refs.slice(REFS)
      if (rest.length) lines.push(`        and ${rest.length} more, ${rest.filter(r => r.machine).length} of them machine (the --json output names them)`)
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
  const note = (n: number) => `[cut at ${maxChars} characters: ${n} more lines; the --json output has everything]`
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
const LOCK = 'a lockfile', BINARY = 'binary (a NUL character)'
type Stat = { file: boolean; size: number } | null

export async function collect(paths: string[], stat: (path: string) => Stat | Promise<Stat>,
  read: (path: string) => string | null | Promise<string | null>): Promise<{ files: SurveyFile[]; skipped: Skipped[] }> {
  const files: SurveyFile[] = [], skipped: Skipped[] = []
  let total = 0
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]
    const skip = (why: string) => skipped.push({ path, why })
    const stop = (why: string) => skip(`${why}: this file and the ${paths.length - i - 1} after it were not read`)
    if (files.length >= MAX_FILES) { stop('stopped at 3,000 files'); break }
    if (LOCKFILE.test(path)) { skip(LOCK); continue }
    const s = await stat(path)
    if (!s) { skip('missing from the working tree'); continue }
    if (!s.file) { skip('not a regular file (a link, a folder or a submodule)'); continue }
    if (s.size > MAX_FILE) { skip('over 2 MB'); continue }
    if (total + s.size > MAX_TOTAL) { stop('stopped at 30 MB in all'); break }
    const text = await read(path)
    total += s.size
    if (text === null) skip('unreadable')
    else if (text.includes('\0')) skip(BINARY)
    else files.push({ path, text })
  }
  return { files, skipped }
}

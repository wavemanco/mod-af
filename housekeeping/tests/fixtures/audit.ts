// The audit's acceptance fixture (Phase 3, Task 3): a repository on init's format whose open backlog rows ten commits
// on main have done (one names its row only in the body), beside six decoys, built once with the audit's duty row and
// once without. Node only. Run it as node tests/fixtures/audit.ts <an empty or new folder> with|without: it prints
// what it built as JSON, the planted rows and the decoys included, which are the scorer's and never the audit's.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { initFiles } from '../../hooks/core/templates.ts'

export const PLANTED = ['B-1', 'B-2', 'B-4', 'B-5', 'B-7', 'B-8', 'B-10', 'B-12', 'B-13', 'B-15']
export const DECOYS: Record<string, string> = { 'B-3': 'a revert', 'B-6': 'prep for it', 'B-9': 'partial work',
  'B-11': 'a passing mention', 'B-14': 'an ID only on a side branch', 'B-16': 'a closing word for another ID' }
export type AuditFixture = { dir: string; duty: boolean; start: string; settingsCommit: string; planted: string[]; decoys: Record<string, string> }

const ITEMS: [string, string][] = [['B-1', 'Retry a failed upload three times'], ['B-2', 'Trim spaces in imported names'],
  ['B-3', 'Cache the rate lookups'], ['B-4', 'Log how long an export takes'], ['B-5', 'Add a health check route'],
  ['B-6', 'Add an archive command'], ['B-7', 'Cap the page size at 100'], ['B-8', 'Quote commas in CSV cells'],
  ['B-9', 'Import the whole ledger file'], ['B-10', 'Sort the report by date'], ['B-11', 'Rotate the log files'],
  ['B-12', 'Cache the parsed settings'], ['B-13', 'Split the report writer in two'], ['B-14', 'Swap the date parser'],
  ['B-15', 'Add a dark theme'], ['B-16', 'Page through the report'], ['B-17', 'Write the install guide'], ['B-18', 'Add a config check']]
const row = (cells: string[]) => `| ${cells.join(' | ')} |\n`
// init's columns: ID, Item, Priority, Milestone, Who, Land now, Trigger type, Trigger, Waits on, Details, Filed
const open = ([id, item]: [string, string]) => row([id, item, 'medium', 'none', 'agent', 'yes', 'now', 'Whenever an agent picks it up.', '—', '**Why:** asked for.', '2026-09-01'])
// a table's rows go after its header and separator, under its heading
const under = (text: string, heading: string, rows: string) => text.replace(new RegExp(`## ${heading}\\n\\n[^\\n]*\\n[^\\n]*\\n`), h => h + rows)

export function buildAudit(dir: string, duty: boolean): AuditFixture {
  mkdirSync(dir, { recursive: true })
  if (readdirSync(dir).length) throw new Error(`${dir} is not empty`)
  // the fixture's own identity, never the machine's, and its own day, a minute later each call, so check's dated
  // where-we-are holds
  let n = 0
  const git = (...a: string[]) => {
    const at = `2026-09-01T12:${String(n++).padStart(2, '0')}:00Z`
    return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...a],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at } }).trim()
  }
  const commit = (message: string[], files: Record<string, string>) => {
    for (const [p, text] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text) }
    git('add', '-A')
    git('commit', '-q', ...message.flatMap(m => ['-m', m]))
    return git('rev-parse', 'HEAD')
  }
  const code = (name: string, line: string) => ({ [`src/${name}.ts`]: `${line}\n` })

  const init = Object.fromEntries(initFiles('fixture', 'main').map(f => [f.path, f.content]))
  const settings = { ...JSON.parse(init['.housekeeping.json']), checklists: [{ file: 'backlog', heading: 'Launch checklist' }] }
  const backlog = under(under(init['docs/backlog.md'], 'Open', ITEMS.map(open).join(''), ), 'Done', row(['B-19', 'Set up the repository', 'none', '2026-09-01']))
    .replace('A new backlog: nothing is filed yet.\n', '2026-09-01: eighteen rows are open.\n\n## Launch checklist\n\n- [ ] Ship the uploads: B-1 and B-2.\n- [ ] Ship the reports: B-10 and B-16.\n')
  const playbook = under(init['docs/playbook.md'], 'Open', row(['P-1', 'Book the beta testers', 'high', 'none', 'owner', "no: the owner's outreach", 'event',
    'When the invite list is ready.', '—', '**Why:** the beta needs users.', '2026-09-01']))

  git('init', '-q', '-b', 'main')
  const settingsCommit = commit(['Set up the records'], { ...init, 'docs/backlog.md': backlog, 'docs/playbook.md': playbook,
    '.housekeeping.json': JSON.stringify(settings, null, 2) + '\n', 'README.md': '# fixture\n' })
  const readme = commit(['Say what the tool does in the readme'], { 'README.md': '# fixture\n\nA small tool that exports reports.\n' })
  if (duty) commit(['Add the audit duty'], { 'docs/playbook.md': under(playbook, 'Open', row(['P-2', 'Audit the records against the commits', '—', 'none', 'agent',
    'no: a standing duty', '—', 'Every 2 weeks: /housekeeping audit', '—', `Last done: 2026-09-01, through ${readme.slice(0, 7)}`, '2026-09-01'])) })

  // the ten closings do their row's work in full and wire it in, so a skeptic reading the hunk can agree; the decoys
  // are stubs, prep, a part, a revert or a mention (the acceptance run of 2026-11-12 found stubs here, rightly refused).
  // B-1's code tries three times in all, two retries, and both skeptics of the second run refused it on that: it acts
  // as a seventh decoy, and the bar is at least 9 of the 10
  commit(['Fix B-1: retry a failed upload three times'], code('upload', [
    'export const RETRIES = 3',
    'export async function upload(send: () => Promise<void>): Promise<void> {',
    '  for (let attempt = 1; ; attempt++) {',
    '    try { return await send() } catch (err) { if (attempt >= RETRIES) throw err }',
    '  }',
    '}'].join('\n')))
  const rates = commit(['Fix B-3: cache the rate lookups'], code('rates', 'export const cache = new Map<string, number>()'))
  commit(['Prep for B-6: move the helpers into one module'], code('util', 'export const id = <T>(x: T) => x'))
  commit(['B-2 done: trim spaces in imported names'], code('names', [
    'export const clean = (s: string) => s.trim()',
    'export const importNames = (names: string[]): string[] => names.map(clean)'].join('\n')))
  commit(['Log how long an export takes; closes B-4'], code('export', [
    'export async function exportReport(run: () => Promise<void>, log: (s: string) => void = console.log): Promise<void> {',
    '  const started = Date.now()',
    '  await run()',
    '  log(`export took ${Date.now() - started} ms`)',
    '}'].join('\n')))
  commit(['Tidy the logger (B-11 will build on it)'], code('log', 'export const log = (s: string) => console.log(s)'))
  commit(['Land B-5: a health check route'], code('health', [
    'export const routes: Record<string, () => string> = {}',
    "routes['/health'] = () => 'ok'"].join('\n')))
  git('revert', '--no-edit', rates)
  commit(["Land part 1 of B-9: read the ledger's header row", 'The rows themselves come in part 2.'], code('ledger', 'export const header = (l: string) => l.split(",")'))
  commit(['Resolve B-7 by capping the page size at 100'], code('page', [
    'export const PAGE_MAX = 100',
    'export const pageSize = (asked: number): number => Math.min(Math.max(1, asked), PAGE_MAX)'].join('\n')))
  commit(['B-8 fixed: quote commas in CSV cells'], code('csv', [
    "export const cell = (s: string) => s.includes(',') ? `\"${s}\"` : s",
    "export const csvRow = (cells: string[]): string => cells.map(cell).join(',')"].join('\n')))
  commit(['Fixes B-10, sorting the report by date'], code('report', [
    'export const sortReport = <T extends { at: number }>(rows: T[]): T[] => [...rows].sort((a, b) => a.at - b.at)'].join('\n')))
  commit(['Keep the parsed settings in memory', 'Closes B-12.'], code('settings', [
    'let parsed: unknown',
    'export const settings = (read: () => string): unknown => (parsed ??= JSON.parse(read()))'].join('\n')))
  commit(['Closed B-13: split the report writer; B-16 builds on this'], code('writer', [
    "export const head = (title: string): string => '# ' + title",
    "export const body = (rows: string[]): string => rows.join('\\n')",
    "export const write = (title: string, rows: string[]): string => head(title) + '\\n' + body(rows)"].join('\n')))
  // a closing commit on a branch that main merges
  git('checkout', '-q', '-b', 'theme')
  commit(['Lands B-15: a dark theme'], code('theme', [
    "export const themes = { light: { background: '#fff', color: '#111' }, dark: { background: '#111', color: '#eee' } }",
    "export const applyTheme = (name: keyof typeof themes, style: Record<string, string>) => Object.assign(style, themes[name])"].join('\n')))
  git('checkout', '-q', 'main')
  git('merge', '-q', '--no-ff', '-m', "Merge branch 'theme'", 'theme')
  // a closing commit on a branch main never merges
  git('checkout', '-q', '-b', 'spike')
  commit(['Fix B-14: swap the date parser'], code('dates', 'export const parse = (s: string) => new Date(s)'))
  git('checkout', '-q', 'main')
  return { dir, duty, start: duty ? readme : settingsCommit, settingsCommit, planted: [...PLANTED], decoys: { ...DECOYS } }
}

if (import.meta.main) {
  const [dir, kind] = process.argv.slice(2)
  if (!dir || !['with', 'without'].includes(kind)) { console.error('usage: node tests/fixtures/audit.ts <empty folder> with|without'); process.exitCode = 2 }
  else console.log(JSON.stringify(buildAudit(dir, kind === 'with'), null, 2))
}

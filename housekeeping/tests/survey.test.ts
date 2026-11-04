import { expect, test } from 'claude-code/testing'
import { collect, formatInventory, inventory } from '../hooks/core/survey.ts'

// A made-up repository: a backlog, a guide that names it, a dated pass note, an archived copy and a test that reads it.
const BACKLOG = [
  '# Backlog', '',
  '## B-1 Rate-limit the export', 'Status: OPEN', '',
  '## B-2 Retry uploads', 'Status: DEFERRED', '',
  '| ID | What | Status |', '|---|---|---|', '| B-3 | Docs | PENDING |', '',
  '- [ ] B-4 a follow-up', '',
].join('\n')
const README = [
  'BACKLOG.md is the single source of truth for pending work; see BACKLOG.md.',
  '- [ ] write the guide', '- [ ] add a logo', '- [ ] tag 1.0', '- [x] pick a name',
  'Deferred work goes in ' + 'x'.repeat(300),
  'Nothing else here.',
].join('\n')
const FILES = [
  { path: 'BACKLOG.md', text: BACKLOG },
  { path: 'README.md', text: README },
  { path: 'notes/2026-09-01-pass.md', text: '- [ ] one\n- [ ] two\n- [ ] three\n' },
  { path: 'archive/old-backlog.md', text: 'B-1 was OPEN\n' },
  { path: 'tests/test_x.py', text: 'path = ROOT / "BACKLOG.md"  # TODO: more\nassert "B-1" in path.read_text()\n' },
  { path: 'src/app.ts', text: 'export const x = 1 // MY-BACKLOG.md is another file\n' },
]

test('a backlog with ID headings and an ID table scores above a README', () => {
  const inv = inventory(FILES)
  const at = (p: string) => inv.candidates.findIndex(c => c.path === p)
  expect(inv.files).toBe(6)
  expect(inv.candidates[0].path).toBe('BACKLOG.md')
  expect(inv.candidates[0].signals).toEqual({ name: true, idHeadings: 2, idTables: 1, openBoxes: 1, doneBoxes: 0,
    todos: 0, statusWords: 3, dated: false, guide: false })
  expect(inv.candidates[0].score).toBe(10.6) // 3 + 2*2 + 2*1 + 1 + 3/5
  expect(inv.candidates[0].hint).toBe('likely-tracker')
  expect(at('README.md')).toBeGreaterThan(0)
  expect(inv.candidates[at('README.md')]).toEqual({ path: 'README.md', score: 3, hint: 'maybe', signals: { name: false,
    idHeadings: 0, idTables: 0, openBoxes: 3, doneBoxes: 1, todos: 0, statusWords: 0, dated: false, guide: true } })
  expect(at('src/app.ts')).toBe(-1)
})

test('a heading or a box is read on one line: a bare "##" over an ID is no ID heading', () => {
  const [c] = inventory([{ path: 'todo.md', text: '##\nB-1 one\n## C-2 two\n-\n[ ] three\n  - [ ] four\n' }]).candidates
  expect([c.signals.idHeadings, c.signals.openBoxes]).toEqual([1, 1])
})

test('a dated note and a file in an archive folder are likely history, whatever they hold', () => {
  const inv = inventory(FILES)
  const hint = (p: string) => inv.candidates.find(c => c.path === p)?.hint
  expect(hint('notes/2026-09-01-pass.md')).toBe('likely-history')
  expect(hint('archive/old-backlog.md')).toBe('likely-history')
})

test('likely history ranks after the other candidates, whatever its score; each group by score, then path', () => {
  const boxes = (n: number) => '- [ ] x\n'.repeat(n)
  const inv = inventory([{ path: 'archive/a.md', text: boxes(5) }, { path: 'BACKLOG.md', text: BACKLOG },
    { path: 'notes/2026-09-01-review.md', text: boxes(20) }, { path: 'docs/todo.md', text: boxes(1) }])
  expect(inv.candidates.map(c => [c.path, c.score, c.hint])).toEqual([['BACKLOG.md', 10.6, 'likely-tracker'],
    ['docs/todo.md', 4, 'maybe'], ['notes/2026-09-01-review.md', 20, 'likely-history'], ['archive/a.md', 5, 'likely-history']])
})

test('a test that names the backlog is a machine reference; a guide is not; a longer name is no reference', () => {
  const refs = inventory(FILES).references.filter(r => r.target === 'BACKLOG.md')
  expect(refs).toEqual([
    { target: 'BACKLOG.md', from: 'README.md', count: 2, machine: false },
    { target: 'BACKLOG.md', from: 'tests/test_x.py', count: 1, machine: true },
  ])
})

test('the guide lines that say where pending work goes: whole in the inventory, cut at 200 and marked in the text', () => {
  const inv = inventory(FILES), g = inv.guides
  expect(g.map(l => [l.path, l.line])).toEqual([['README.md', 1], ['README.md', 6]])
  expect(g[1].text).toBe('Deferred work goes in ' + 'x'.repeat(300))
  const text = formatInventory(inv)
  expect(text).toContain('\nREADME.md:6: ' + g[1].text.slice(0, 200) + '...')
  expect(text).toContain('\nREADME.md:1: ' + g[0].text + '\n')
})

test('name and status words count in prose files only: in code they are identifiers; TODOs count in code', () => {
  const words = 'OPEN CLOSED DONE PENDING '.repeat(10)
  const inv = inventory([{ path: 'src/handlers/open.ts', text: 'export const open = 1\n' },
    { path: 'src/states.py', text: words }, { path: 'docs/states.md', text: words },
    { path: 'TODO.txt', text: 'one\n' }, { path: 'TODO', text: 'one\n' }, { path: 'src/todo-list.ts', text: '// TODO x\n'.repeat(30) }])
  const at = (p: string) => inv.candidates.find(c => c.path === p)
  expect(at('src/handlers/open.ts')).toBeUndefined()
  expect(at('src/states.py')).toBeUndefined()
  expect(at('docs/states.md')?.score).toBe(8) // 40 status words / 5
  expect(at('TODO.txt')?.signals.name).toBe(true)
  expect(at('TODO')?.signals.name).toBe(true)
  expect(at('src/todo-list.ts')?.signals).toMatchObject({ name: false, todos: 30, statusWords: 0 })
  expect(at('src/todo-list.ts')?.score).toBe(3)
})

test('an empty file set gives no candidates, and the text says there is nothing to move', () => {
  const inv = inventory([])
  expect(inv).toEqual({ files: 0, candidates: [], references: [], guides: [], skipped: [] })
  expect(formatInventory(inv)).toContain('nothing to move')
})

test('formatInventory names the top candidate and stays within maxChars', () => {
  const many = Array.from({ length: 500 }, (_, i) => ({ path: `docs/plan-${String(i).padStart(3, '0')}.md`, text: '- [ ] a\n' }))
  const inv = inventory([...FILES, ...many], [{ path: 'img.png', why: 'binary (a NUL character)' },
    { path: 'pnpm-lock.yaml', why: 'a lockfile' }, { path: 'docs/huge.md', why: 'over 2 MB' }])
  const full = formatInventory(inv, 1e9)
  expect(full.length).toBeGreaterThan(20_000)
  expect(full).toContain('\ndocs/huge.md: over 2 MB\nand 2 more: lockfiles and binaries')
  expect(full.indexOf('## Skipped')).toBeLessThan(full.indexOf('## Files that name'))
  expect(full).not.toContain('img.png')
  const text = formatInventory(inv)
  expect(text.length).toBeLessThanOrEqual(20_000)
  expect(text).toContain('BACKLOG.md')
  expect(text).toContain('cut')
  for (const max of [50, 500, 5000]) expect(formatInventory(inv, max).length).toBeLessThanOrEqual(max)
})

test('the text shows at most 5 files per target and counts the rest, so the references leave room for the guide lines', () => {
  const plans = Array.from({ length: 15 }, (_, i) => `docs/plan-${String(i).padStart(2, '0')}.md`)
  const names = plans.map(p => p.slice(5)).join(' ')
  const inv = inventory([...plans.map(path => ({ path, text: '- [ ] a\n' })),
    { path: 'README.md', text: 'Deferred work: the single tracker is docs/plan-00.md.\n' },
    ...Array.from({ length: 300 }, (_, i) => ({ path: `src/f${String(i).padStart(3, '0')}.ts`, text: names })),
    { path: 'zz/notes.md', text: 'see plan-01.md' }])
  expect(inv.references.length).toBe(15 * 300 + 2) // the inventory keeps every one
  const text = formatInventory(inv)
  expect(text.length).toBeLessThanOrEqual(20_000)
  expect(text).toContain('\n## What the guide files say\nREADME.md:1: Deferred work: the single tracker is docs/plan-00.md.')
  expect(text).toContain('\ndocs/plan-00.md\n     1  README.md\n     1  src/f000.ts (machine)\n')
  expect(text).toContain('\n     1  src/f003.ts (machine)\n        and 296 more, 296 of them machine (the --json output names them)\ndocs/plan-01.md\n')
  expect(text).toContain('\n        and 296 more, 295 of them machine (the --json output names them)\ndocs/plan-02.md\n')
  expect(text).toContain('\ndocs/plan-14.md\n')
  expect(text).not.toContain('src/f005.ts')
  expect(text).not.toContain('cut at')
})

// The readers' rules, on stand-ins for git's list, stat and read. readTracked is these over $.fs, and the Node
// command's survey these over node:fs (node-tests/cli.spec.ts). The kit lets only a hooks module that calls
// $.process.run call it, so readTracked itself is reached through /housekeeping survey (Task 7).
function reader(tracked: Record<string, string>, links: string[] = []) {
  return [Object.keys(tracked),
    (p: string) => tracked[p] === undefined ? null : { file: !links.includes(p), size: tracked[p].length },
    (p: string) => tracked[p] ?? null] as const
}

test('the readers skip lockfiles, big files, links and binaries, and say why', async () => {
  const r = await collect(...reader({ 'BACKLOG.md': BACKLOG, 'pnpm-lock.yaml': 'x', 'web/yarn.lock': 'x', 'package-lock.json': '{}',
    'big.txt': 'x'.repeat(2 * 1024 * 1024 + 1), 'at-limit.md': 'x'.repeat(2 * 1024 * 1024), 'img.png': 'PNG\0\0',
    'latin.txt': 'caf' + String.fromCharCode(0xfffd), 'notes.md': 'see BACKLOG.md' }, ['notes.md']))
  // not UTF-8 but no NUL: read, its stray bytes as U+FFFD (the reference repository holds UTF-8 files that quote one)
  expect(r.files.map(f => f.path)).toEqual(['BACKLOG.md', 'at-limit.md', 'latin.txt'])
  expect(r.skipped).toEqual([
    { path: 'pnpm-lock.yaml', why: 'a lockfile' }, { path: 'web/yarn.lock', why: 'a lockfile' },
    { path: 'package-lock.json', why: 'a lockfile' }, { path: 'big.txt', why: 'over 2 MB' },
    { path: 'img.png', why: 'binary (a NUL character)' },
    { path: 'notes.md', why: 'not a regular file (a link, a folder or a submodule)' }])
})

test('the readers say a tracked file missing from the working tree, or unreadable', async () => {
  const r = await collect(['gone.md', 'locked.md'], p => (p === 'gone.md' ? null : { file: true, size: 1 }), () => null)
  expect(r).toEqual({ files: [], skipped: [{ path: 'gone.md', why: 'missing from the working tree' },
    { path: 'locked.md', why: 'unreadable' }] })
})

test('the readers stop at 3,000 files and say so', async () => {
  const r = await collect(...reader(Object.fromEntries(Array.from({ length: 3005 }, (_, i) => [`f${String(i).padStart(4, '0')}.txt`, 'x']))))
  expect(r.files.length).toBe(3000)
  expect(r.skipped).toEqual([{ path: 'f3000.txt', why: 'stopped at 3,000 files: this file and the 4 after it were not read' }])
})

test('the readers stop at 30 MB in all and say so', async () => {
  const big = 'x'.repeat(500_000)
  const r = await collect(...reader(Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`f${String(i).padStart(2, '0')}.txt`, big]))))
  expect(r.files.length).toBe(62) // 62 * 500,000 bytes is under 30 MiB; the 63rd is over
  expect(r.skipped).toEqual([{ path: 'f62.txt', why: 'stopped at 30 MB in all: this file and the 7 after it were not read' }])
})

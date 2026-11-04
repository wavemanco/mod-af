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

test('a test that names the backlog is a machine reference; a guide is not; a longer name is no reference', () => {
  const refs = inventory(FILES).references.filter(r => r.target === 'BACKLOG.md')
  expect(refs).toEqual([
    { target: 'BACKLOG.md', from: 'README.md', count: 2, machine: false },
    { target: 'BACKLOG.md', from: 'tests/test_x.py', count: 1, machine: true },
  ])
})

test('the guide lines that say where pending work goes, each cut to 200 characters', () => {
  const g = inventory(FILES).guides
  expect(g.map(l => [l.path, l.line])).toEqual([['README.md', 1], ['README.md', 6]])
  expect(g[1].text.length).toBe(200)
})

test('an empty file set gives no candidates, and the text says there is nothing to move', () => {
  const inv = inventory([])
  expect(inv).toEqual({ files: 0, candidates: [], references: [], guides: [], skipped: [] })
  expect(formatInventory(inv)).toContain('nothing to move')
})

test('formatInventory names the top candidate and stays within maxChars', () => {
  const many = Array.from({ length: 500 }, (_, i) => ({ path: `docs/plan-${String(i).padStart(3, '0')}.md`, text: '- [ ] a\n' }))
  const inv = inventory([...FILES, ...many], [{ path: 'img.png', why: 'binary (a NUL character)' },
    { path: 'pnpm-lock.yaml', why: 'a lockfile' }, { path: 'docs/huge.md', why: 'over 512 KB' }])
  const full = formatInventory(inv, 1e9)
  expect(full.length).toBeGreaterThan(20_000)
  expect(full).toContain('\ndocs/huge.md: over 512 KB\nand 2 more: lockfiles and binaries')
  expect(full.indexOf('## Skipped')).toBeLessThan(full.indexOf('## Files that name'))
  expect(full).not.toContain('img.png')
  const text = formatInventory(inv)
  expect(text.length).toBeLessThanOrEqual(20_000)
  expect(text).toContain('BACKLOG.md')
  expect(text).toContain('cut')
  for (const max of [50, 500, 5000]) expect(formatInventory(inv, max).length).toBeLessThanOrEqual(max)
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
    'big.txt': 'x'.repeat(512 * 1024 + 1), 'img.png': 'PNG\0\0', 'latin.txt': 'caf' + String.fromCharCode(0xfffd),
    'notes.md': 'see BACKLOG.md' }, ['notes.md']))
  // not UTF-8 but no NUL: read, its stray bytes as U+FFFD (the reference repository holds UTF-8 files that quote one)
  expect(r.files.map(f => f.path)).toEqual(['BACKLOG.md', 'latin.txt'])
  expect(r.skipped).toEqual([
    { path: 'pnpm-lock.yaml', why: 'a lockfile' }, { path: 'web/yarn.lock', why: 'a lockfile' },
    { path: 'package-lock.json', why: 'a lockfile' }, { path: 'big.txt', why: 'over 512 KB' },
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

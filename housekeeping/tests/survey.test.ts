import { expect, test } from 'claude-code/testing'
import { checkNamed, collect, formatInventory, inventory, notRead } from '../hooks/core/survey.ts'

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
  expect(inv.candidates[0].signals).toEqual({ named: false, name: true, idHeadings: 2, idTables: 1, openBoxes: 1, doneBoxes: 0,
    todos: 0, statusWords: 3, dated: false, guide: false })
  expect(inv.candidates[0].score).toBe(10.6) // 3 + 2*2 + 2*1 + 1 + 3/5
  expect(inv.candidates[0].hint).toBe('likely-tracker')
  expect(at('README.md')).toBeGreaterThan(0)
  expect(inv.candidates[at('README.md')]).toEqual({ path: 'README.md', score: 3, hint: 'maybe', signals: { named: false, name: false,
    idHeadings: 0, idTables: 0, openBoxes: 3, doneBoxes: 1, todos: 0, statusWords: 0, dated: false, guide: true } })
  expect(at('src/app.ts')).toBe(-1)
})

test('a heading or a box is read on one line: a bare "##" over an ID is no ID heading', () => {
  const [c] = inventory([{ path: 'todo.md', text: '##\nB-1 one\n## C-2 two\n-\n[ ] three\n  - [ ] four\n' }]).candidates
  expect([c.signals.idHeadings, c.signals.openBoxes]).toEqual([1, 1])
})

// finding 8: a box after "*", "+" or a number is a box too
test('a box counts whatever its list marker: -, *, + or a number', () => {
  const [c] = inventory([{ path: 'todo.md', text: '- [ ] a\n* [ ] b\n+ [ ] c\n1. [ ] d\n  12) [ ] e\n* [x] f\n3. [X] g\n' }]).candidates
  expect([c.signals.openBoxes, c.signals.doneBoxes]).toEqual([5, 2])
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

// finding 31: matched by base name, every same-named file shared every reader
test('a mention with a path names the target that path ends; a bare name names each same-named target, marked ambiguous', () => {
  const todo = '## T-1 one\n## T-2 two\n'
  const inv = inventory([{ path: 'BACKLOG.md', text: BACKLOG },
    { path: 'packages/a/TODO.md', text: todo }, { path: 'packages/b/TODO.md', text: todo },
    { path: 'scripts/b.py', text: 'open("packages/b/TODO.md")\n' },
    { path: 'packages/a/guide.md', text: 'See [the list](./TODO.md) and ../b/TODO.md.\n' },
    { path: 'notes.md', text: 'Each package has a TODO.md.\n' },
    { path: 'tools/old.sh', text: 'cat archive/BACKLOG.md\n' }])
  expect(inv.candidates.map(c => c.path)).toEqual(['BACKLOG.md', 'packages/a/TODO.md', 'packages/b/TODO.md'])
  // second check, finding 10: archive/BACKLOG.md names no tracked file, so it is a possible use, not no use
  expect(inv.references).toEqual([
    { target: 'BACKLOG.md', from: 'tools/old.sh', count: 1, machine: true, possible: true },
    { target: 'packages/a/TODO.md', from: 'notes.md', count: 1, machine: false, ambiguous: true },
    { target: 'packages/a/TODO.md', from: 'packages/a/guide.md', count: 1, machine: false },
    { target: 'packages/b/TODO.md', from: 'notes.md', count: 1, machine: false, ambiguous: true },
    { target: 'packages/b/TODO.md', from: 'packages/a/guide.md', count: 1, machine: false },
    { target: 'packages/b/TODO.md', from: 'scripts/b.py', count: 1, machine: true }])
  expect(formatInventory(inv)).toContain('\n     1  notes.md (ambiguous: a bare name several targets share)\n')
})

// finding 32: a file named TODO took every TODO comment for a reader, and a script named open scored on its name
test('for a target with no extension a bare word is a possible use, after the readers and not by count; a #! file is not prose', () => {
  const inv = inventory([{ path: 'TODO', text: '## T-1 one\n## T-2 two\n' },
    { path: 'src/a.ts', text: '// TODO one\n'.repeat(25) }, { path: 'src/b.ts', text: '// TODO\n'.repeat(2) },
    { path: 'lib/c.ts', text: '// TODO\n'.repeat(5) }, { path: 'scripts/check.sh', text: 'grep T- ../TODO\n' },
    { path: 'bin/open', text: '#!/bin/sh\nexec open "$@"\n' }])
  expect(inv.candidates.map(c => c.path)).toEqual(['TODO'])
  expect(inv.references).toEqual([
    { target: 'TODO', from: 'scripts/check.sh', count: 1, machine: true },
    { target: 'TODO', from: 'lib/c.ts', count: 5, machine: true, possible: true },
    { target: 'TODO', from: 'src/a.ts', count: 25, machine: true, possible: true },
    { target: 'TODO', from: 'src/b.ts', count: 2, machine: true, possible: true }])
  expect(formatInventory(inv)).toContain('\n    25  src/a.ts (machine) (possible use: a bare word, or a path that names no tracked file)\n')
})

// second check, finding 10: finding 31's strict rule dropped real readers, with nothing to say so
test('a path that ends a target after a space, ./ in a script from the top and a percent-encoded link are readers; $ROOT, absolute paths and URLs are possible uses', () => {
  const list = '## B-1 one\n## B-2 two\n'
  const inv = inventory([{ path: 'docs/backlog.md', text: list },
    { path: 'scripts/ci.sh', text: 'cat "$ROOT/docs/backlog.md"\ngrep B- /home/u/repo/docs/backlog.md\n' },
    { path: 'README.md', text: 'See https://github.com/o/r/blob/main/docs/backlog.md.\n' },
    { path: '.github/workflows/check.yml', text: 'run: grep B- ./docs/backlog.md && grep B- ../docs/backlog.md\n' },
    { path: 'docs/guide.md', text: 'Not [this](./docs/backlog.md).\n' }])
  expect(inv.references).toEqual([
    { target: 'docs/backlog.md', from: '.github/workflows/check.yml', count: 2, machine: true },
    { target: 'docs/backlog.md', from: 'README.md', count: 1, machine: false, possible: true },
    { target: 'docs/backlog.md', from: 'docs/guide.md', count: 1, machine: false, possible: true },
    { target: 'docs/backlog.md', from: 'scripts/ci.sh', count: 2, machine: true, possible: true }])
  const spaced = inventory([{ path: 'my docs/todo.md', text: list }, { path: 'tools/a.sh', text: 'cat "my docs/todo.md"\n' },
    // %E9 alone is no UTF-8, so it stays as it is
    { path: 'notes.md', text: '[the list](my%20docs/todo.md)\n' }, { path: 'b.md', text: '[the list](my%20docs/caf%E9/todo.md)\n' }])
  expect(spaced.references).toEqual([
    { target: 'my docs/todo.md', from: 'notes.md', count: 1, machine: false },
    { target: 'my docs/todo.md', from: 'tools/a.sh', count: 1, machine: true },
    { target: 'my docs/todo.md', from: 'b.md', count: 1, machine: false, possible: true }])
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
  expect(inv).toEqual({ files: 0, candidates: [], suspects: [], references: [], guides: [], skipped: [], denied: 0, notTracker: [] })
  expect(formatInventory(inv)).toContain('\n\nNo tracked files: nothing to move. /housekeeping init sets up the pair.\n')
})

// finding 8: "no file holds signs of pending work" was said of work the score does not read
const NOT_READ = [{ path: 'big.md', why: 'over 2 MB' }, { path: 'img.png', why: 'binary (a NUL character)' },
  { path: 'pnpm-lock.yaml', why: 'a lockfile' }, { path: 'x.md', why: 'unreadable' }, { path: 'gone.md', why: 'missing from the working tree' },
  { path: 'f3000.txt', why: 'stopped at 3,000 files: this file and the 4 after it were not read', unread: 5 }]

test('Not measured comes right after the header: the files not read, by reason, and what the score does not read', () => {
  for (const inv of [inventory(FILES, NOT_READ), inventory([{ path: 'src/a.ts', text: 'x' }], NOT_READ)]) {
    const lines = formatInventory(inv, 600).split('\n')
    expect(lines.slice(lines.indexOf('## Not measured'), lines.indexOf('## Not measured') + 3)).toEqual(['## Not measured',
      'Files not read: 1 over 2 MB, 2 binary or lockfile, 1 unreadable, 1 missing from the working tree, 5 past the 3,000-file limit.',
      'The score does not read data files (YAML, JSON, CSV, TOML), nor code files apart from their TODO comments.'])
    expect(lines.indexOf('## Not measured')).toBeLessThanOrEqual(4)
  }
  expect(formatInventory(inventory(FILES))).toContain('\n## Not measured\nFiles not read: none.\n')
  // finding 7: the reply names the limits that stopped the reading
  expect(notRead(inventory(FILES, NOT_READ), true)).toEqual(['5 past the 3,000-file limit'])
})

test('with no candidates the text says no file reached the score of 3, and lists the suspects with their reasons', () => {
  const inv = inventory([{ path: 'README.md', text: '# App\n\n## Roadmap\n\nmore later\n' },
    { path: 'NOTES.md', text: 'TODO: fix the export\nTODO: docs\n' }, { path: 'docs/a.md', text: '- [ ] one\n* [ ] two\n' },
    { path: 'backlog.yaml', text: 'items:\n  - x\n' }, { path: 'tasks.csv', text: 'id,what\n1,x\n' }, { path: 'config.yaml', text: 'a: 1\n' },
    { path: 'docs/b.md', text: 'nothing here\n' }, { path: 'src/a.ts', text: '// TODO x\n' }, { path: 'bin/run', text: '#!/bin/sh\n# TODO\n' }])
  expect(inv.candidates).toEqual([])
  expect(inv.suspects).toEqual([{ path: 'NOTES.md', why: '2 TODOs' },
    { path: 'README.md', why: 'a TODO, roadmap or next-steps heading' }, { path: 'backlog.yaml', why: 'a data file named like a tracker' },
    { path: 'docs/a.md', why: '2 open boxes' }, { path: 'tasks.csv', why: 'a data file named like a tracker' }])
  const text = formatInventory(inv)
  expect(text).toContain("\n\nNo file reached the survey's score of 3. Not measured, below, says what the survey did not read, " +
    'and Suspects the files with some sign of pending work.\n\n## Not measured\n')
  expect(text).toContain('\n## Suspects (below the score of 3, with some sign of pending work)\nNOTES.md: 2 TODOs\nREADME.md: a TODO, roadmap')
  expect(text).not.toContain('nothing to move')
})

// finding 8, re-scoring: the person settles what the score cannot
test('a --tracker path is a candidate with a named signal, first, with its readers; a --not-tracker path leaves candidates and suspects', () => {
  const inv = inventory([...FILES, { path: 'tasks.yaml', text: 'items: []\n' }, { path: 'NOTES.md', text: 'TODO: x\n' },
    { path: 'scripts/load.py', text: 'open("tasks.yaml")\n' }], [], { tracker: ['tasks.yaml', 'denied.md'], notTracker: ['BACKLOG.md', 'NOTES.md'] })
  expect(inv.candidates.slice(0, 2).map(c => [c.path, c.signals.named, c.score])).toEqual([['denied.md', true, 0], ['tasks.yaml', true, 0]])
  expect(inv.candidates.some(c => c.path === 'BACKLOG.md' || c.path === 'NOTES.md')).toBe(false)
  expect(inv.suspects.some(s => s.path === 'NOTES.md' || s.path === 'tasks.yaml')).toBe(false)
  expect(inv.references.filter(r => r.target === 'tasks.yaml')).toEqual([{ target: 'tasks.yaml', from: 'scripts/load.py', count: 1, machine: true }])
  expect(inv.files).toBe(9)
  expect(formatInventory(inv)).toContain('\n   0.0  maybe           tasks.yaml: named by --tracker\n')
})

// second check, finding 12: through the slash route the agent never saw a not-tracker answer
test('with --tracker or --not-tracker the inventory keeps the not-trackers and the text names both answers in one line', () => {
  const inv = inventory(FILES, [], { tracker: ['tasks.yaml'], notTracker: ['BACKLOG.md', 'NOTES.md'] })
  expect(inv.notTracker).toEqual(['BACKLOG.md', 'NOTES.md'])
  const text = formatInventory(inv)
  expect(text.split('\n').slice(1, 3)).toEqual(['', 'Answers in this run: --tracker tasks.yaml; --not-tracker BACKLOG.md, NOTES.md.'])
  expect(formatInventory(inventory(FILES, [], { notTracker: ['NOTES.md'] })))
    .toContain('\nAnswers in this run: --tracker none; --not-tracker NOTES.md.\n')
  expect(formatInventory(inventory(FILES))).not.toContain('Answers in this run')
})

// second check, finding 1: with a file denied, the re-run is the person's slash command, which has no --json
test('with a file denied, no note in the text offers the --json output', () => {
  const inv = inventory([{ path: 'BACKLOG.md', text: BACKLOG },
    ...Array.from({ length: 20 }, (_, i) => ({ path: `docs/n${String(i).padStart(2, '0')}.md`, text: 'see BACKLOG.md\n- [ ] x\n' }))],
  [{ path: 'pnpm-lock.yaml', why: 'a lockfile' }], { denied: 1 })
  expect(formatInventory({ ...inv, denied: 0 }, 1e9).match(/--json/g)!.length).toBe(3)
  expect(formatInventory({ ...inv, denied: 0 }, 400)).toContain('; the --json output has everything]')
  for (const max of [1e9, 400]) expect(formatInventory(inv, max)).not.toContain('--json')
  expect(formatInventory(inv, 1e9)).toContain('\nand 5 more\n')
  expect(formatInventory(inv, 400)).toMatch(/\[cut at 400 characters: \d+ more lines\]$/)
})

// second check, finding 3: a cmd.exe shim for node re-read a tracked name's "&" as a command
test('a suspect whose path holds anything but letters, digits, space, dot, dash, underscore or slash is marked for the slash route', () => {
  const paths = ['docs/b&mkdir,x&.md', "docs/it's.md", 'docs/50%.md', 'docs/my list.md', 'docs/café.md', 'docs/a_b-c.1.md']
  const text = formatInventory(inventory(paths.map(path => ({ path, text: '- [ ] x\n' }))))
  const mark = ' (name it only through /housekeeping survey: a shell can read this path as commands)'
  for (const p of paths.slice(0, 3)) expect(text).toContain(`\n${p}: 1 open boxes${mark}\n`)
  for (const p of paths.slice(3)) expect(text).toMatch(new RegExp(`\\n${p.replaceAll('.', '\\.')}: 1 open boxes(\\n|$)`))
})

test('the named paths are made repository-relative with "/"; one git does not track, or named both ways, is an error naming it', () => {
  expect(checkNamed(['docs/a.md', 'b.md'], ['./docs/a.md', 'docs\\a.md'], ['b.md'])).toEqual({ tracker: ['docs/a.md'], notTracker: ['b.md'] })
  expect(checkNamed(['a.md'], ['nope.md', 'a.md'], ['gone.md'])).toEqual({ error: 'not a tracked file: nope.md, gone.md' })
  expect(checkNamed(['a.md'], ['a.md'], ['./a.md'])).toEqual({ error: 'named both --tracker and --not-tracker: a.md' })
})

test('the readers read the --tracker paths first', async () => {
  const r = await collect(...reader({ 'a.txt': 'x', 'b.txt': 'x', 'z.yaml': 'x' }), { first: ['z.yaml'] })
  expect(r.files.map(f => f.path)).toEqual(['z.yaml', 'a.txt', 'b.txt'])
})

test('the text shows at most 15 suspects and counts the rest; the inventory keeps them all', () => {
  const inv = inventory([{ path: 'BACKLOG.md', text: BACKLOG },
    ...Array.from({ length: 20 }, (_, i) => ({ path: `docs/n${String(i).padStart(2, '0')}.md`, text: '- [ ] x\n' }))])
  expect(inv.suspects.length).toBe(20)
  const text = formatInventory(inv)
  expect(text.endsWith('\ndocs/n14.md: 1 open boxes\nand 5 more (the --json output names them)')).toBe(true)
  expect(text).not.toContain('docs/n15.md')
  expect(text.indexOf('## Candidates')).toBeLessThan(text.indexOf('## Suspects'))
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
    { path: 'locked.md', why: 'unreadable' }], denied: 0 })
})

test('the readers stop at 3,000 files and say so', async () => {
  const r = await collect(...reader(Object.fromEntries(Array.from({ length: 3005 }, (_, i) => [`f${String(i).padStart(4, '0')}.txt`, 'x']))))
  expect(r.files.length).toBe(3000)
  expect(r.skipped).toEqual([{ path: 'f3000.txt', why: 'stopped at 3,000 files: this file and the 4 after it were not read', unread: 5 }])
})

// finding 3: a denied file is never named, even where a limit stops the reading
test('a file the Read rules deny is counted, never named, and not the file a stop names', async () => {
  const tracked = Object.fromEntries(Array.from({ length: 3003 }, (_, i) => [`f${String(i).padStart(4, '0')}.txt`, 'x']))
  const deny = new Set(['f0001.txt', 'f3001.txt'])
  const r = await collect(...reader(tracked), { allow: p => !deny.has(p) })
  expect(r.files.length).toBe(3000)
  expect(r.denied).toBe(2)
  expect(r.skipped).toEqual([{ path: 'f3002.txt', why: 'stopped at 3,000 files: this file and the 0 after it were not read', unread: 1 }])
})

// finding 30: read in path order, the limits fell on a tracker in docs/ behind apps/
test('the readers read the names that look like trackers or guides first, so the limits fall on the rest', async () => {
  const big = 'x'.repeat(500_000)
  const r = await collect(...reader({ ...Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`apps/f${String(i).padStart(2, '0')}.txt`, big])),
    'docs/backlog.md': '## B-1 x\n', 'docs/README.md': 'the backlog\n' }))
  expect(r.files.slice(0, 2).map(f => f.path)).toEqual(['docs/backlog.md', 'docs/README.md'])
  expect(r.skipped).toEqual([{ path: 'apps/f62.txt', why: 'stopped at 30 MB in all: this file and the 7 after it were not read', unread: 8 }])
})

test('the readers stop at 30 MB in all and say so', async () => {
  const big = 'x'.repeat(500_000)
  const r = await collect(...reader(Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`f${String(i).padStart(2, '0')}.txt`, big]))))
  expect(r.files.length).toBe(62) // 62 * 500,000 bytes is under 30 MiB; the 63rd is over
  expect(r.skipped).toEqual([{ path: 'f62.txt', why: 'stopped at 30 MB in all: this file and the 7 after it were not read', unread: 8 }])
})

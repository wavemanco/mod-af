// The Node command, run as a child process against a temporary git repository.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backlog, playbook, settings } from '../tests/fixtures/small.ts'

const CLI = join(import.meta.dirname, '..', 'cli.ts')
const git = (dir: string, ...a: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...a], { cwd: dir, encoding: 'utf8', stdio: 'pipe' })

function repo(branch = 'main'): string {
  const dir = mkdtempSync(join(tmpdir(), 'hk-cli-'))
  git(dir, 'init', '-q', '-b', branch)
  writeFileSync(join(dir, 'backlog.md'), backlog)
  writeFileSync(join(dir, 'playbook.md'), playbook)
  writeFileSync(join(dir, '.housekeeping.json'), settings)
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'first')
  return dir
}
const run = (...a: string[]) => spawnSync('node', [CLI, ...a], { encoding: 'utf8' })

const LINE = '8 rows in all = 2 closed + 6 open; open = 2 land now + 1 small choice + 3 not now; 4 open in the backlog, 2 in the playbook'

test('map writes the page and prints the partition line', () => {
  const dir = repo(), out = join(dir, 'out', 'map.html')
  const r = run('map', '--repo', dir, '--out', out)
  assert.equal(r.status, 0, r.stderr + r.stdout)
  assert.equal(r.stdout.trim(), LINE)
  assert.ok(readFileSync(out, 'utf8').includes('window.DATA = '))
  const again = run('map', '--repo', dir) // default out
  assert.equal(again.status, 0)
  assert.ok(existsSync(join(dir, '.housekeeping', 'route-map.html')))
})

test('check exits 0 on a sound repository', () => {
  assert.equal(run('check', '--repo', repo()).status, 0)
})

test('brief prints the short view', () => {
  const r = run('brief', '--repo', repo())
  assert.equal(r.status, 0, r.stderr)
  assert.ok(r.stdout.startsWith('# Small: where we are'))
  assert.ok(r.stdout.length <= 8000)
})

test('check exits 1 and map writes nothing after a column name is broken', () => {
  const dir = repo()
  writeFileSync(join(dir, '.housekeeping.json'), settings.replace('"waitsOn":"Waits on"', '"waitsOn":"Waits upon"'))
  git(dir, 'commit', '-qam', 'break a column')
  const r = run('check', '--repo', dir)
  assert.equal(r.status, 1)
  assert.match(r.stdout, /^error /m)
  const out = join(dir, 'x.html')
  assert.equal(run('map', '--repo', dir, '--out', out).status, 1)
  assert.equal(existsSync(out), false)
})

test('--settings pointing at a missing file exits 1, naming it', () => {
  const r = run('check', '--repo', repo(), '--settings', 'no-such-settings.json')
  assert.equal(r.status, 1)
  assert.ok((r.stdout + r.stderr).includes('no-such-settings.json'))
})

test('a repository with no main branch exits 2', () => {
  const dir = repo('trunk')
  const r = run('check', '--repo', dir)
  assert.equal(r.status, 2)
  assert.ok((r.stdout + r.stderr).includes("housekeeping: no branch 'main' in "))
  assert.ok((r.stdout + r.stderr).includes('"mainBranch"'), r.stdout)
})

test('a directory that is no git repository says what git said, exit 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hk-cli-'))
  writeFileSync(join(dir, '.housekeeping.json'), settings)
  const r = run('check', '--repo', dir)
  assert.equal(r.status, 2)
  assert.match(r.stdout, /not a git repository/)
})

test('survey needs no settings, prints the top candidate first, and writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hk-cli-'))
  git(dir, 'init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'TODO.md'), '## T-1 one\n## T-2 two\n## T-3 three\n- [ ] four\n') // 3 + 2*3 + 1
  writeFileSync(join(dir, 'README.md'), 'Pending work goes in TODO.md.\n')
  writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'first')
  const r = run('survey', '--repo', dir)
  assert.equal(r.status, 0, r.stderr + r.stdout)
  const first = r.stdout.split('\n').find(l => /^\s+\d/.test(l))
  assert.match(first ?? '', /likely-tracker\s+TODO\.md/)
  assert.match(r.stdout, /README\.md:1: Pending work goes in TODO\.md\./)
  assert.match(r.stdout, /^and 1 more: lockfiles and binaries/m)
  const j = run('survey', '--json', '--repo', dir)
  assert.equal(j.status, 0, j.stderr)
  const inv = JSON.parse(j.stdout)
  assert.equal(inv.candidates[0].path, 'TODO.md')
  assert.deepEqual(inv.skipped, [{ path: 'pnpm-lock.yaml', why: 'a lockfile' }])
  assert.deepEqual(inv.references, [{ target: 'TODO.md', from: 'README.md', count: 1, machine: false }])
  assert.equal(git(dir, 'status', '--porcelain', '--ignored'), '')
})

// finding 8, re-scoring: the person's answers on the Node command too
test('survey takes --tracker and --not-tracker, repeatable; a path git does not track is an error naming it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hk-cli-'))
  git(dir, 'init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'TODO.md'), '## T-1 one\n## T-2 two\n')
  writeFileSync(join(dir, 'tasks.yaml'), 'items: []\n')
  writeFileSync(join(dir, 'load.py'), 'open("tasks.yaml")\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'first')
  const j = run('survey', '--json', '--repo', dir, '--tracker', 'tasks.yaml', '--not-tracker', 'TODO.md', '--not-tracker', 'load.py')
  assert.equal(j.status, 0, j.stderr + j.stdout)
  const inv = JSON.parse(j.stdout)
  assert.deepEqual(inv.candidates.map((c: { path: string; signals: { named: boolean } }) => [c.path, c.signals.named]), [['tasks.yaml', true]])
  assert.deepEqual(inv.references, [{ target: 'tasks.yaml', from: 'load.py', count: 1, machine: true }])
  const bad = run('survey', '--repo', dir, '--tracker', 'nope.md')
  assert.equal(bad.status, 2)
  assert.match(bad.stdout, /not a tracked file: nope\.md/)
  assert.equal(run('check', '--repo', dir, '--tracker', 'tasks.yaml').status, 2) // survey's option only
})

test('survey outside a git repository says what git said, exit 2', () => {
  const r = run('survey', '--repo', mkdtempSync(join(tmpdir(), 'hk-cli-')))
  assert.equal(r.status, 2)
  assert.match(r.stdout, /not a git repository/)
})

// finding 15: check said nothing and brief died with a stack trace
test('an impossible Last done date is a check warning, and brief still prints', () => {
  const dir = repo()
  writeFileSync(join(dir, 'backlog.md'), backlog.replace('| Whenever an agent picks it up. | — | **Why:** slow builds. |',
    '| Every 30 days. | — | **Why:** slow builds. Last done: 2026-13-01 |'))
  git(dir, 'commit', '-qam', 'a typo in a date')
  const c = run('check', '--repo', dir)
  assert.equal(c.status, 0, c.stderr + c.stdout)
  assert.match(c.stdout, /^warning last-done backlog:23 B-005: Last done "2026-13-01" is not a real YYYY-MM-DD date$/m)
  const b = run('brief', '--repo', dir)
  assert.equal(b.status, 0, b.stderr)
  assert.match(b.stdout, /^Duties due: $/m)
})

test('brief counts duties due by today, not by the head commit date', () => {
  const dir = repo()
  const b = backlog.replace('| Whenever an agent picks it up. | — | **Why:** slow builds. |',
    '| Every 30 days. | — | **Why:** slow builds. Last done: 2026-10-01 |')
  assert.notEqual(b, backlog)
  writeFileSync(join(dir, 'backlog.md'), b)
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-qam', 'old'],
    { cwd: dir, env: { ...process.env, GIT_COMMITTER_DATE: '2026-10-02T00:00:00Z', GIT_AUTHOR_DATE: '2026-10-02T00:00:00Z' } })
  const r = run('brief', '--repo', dir)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^Duties due: .*B-005/m)
})

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
})

// The Node command, run as a child process against a temporary git repository.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { backlog, playbook, settings } from '../tests/fixtures/small.ts'
import { withoutNode } from '../hooks/core/survey.ts'

const CLI = join(import.meta.dirname, '..', 'cli.ts')
// this file's own git calls never run a git.exe that a fixture holds (finding 2), whatever shell started the run
process.env.NoDefaultCurrentDirectoryInExePath = '1'
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

// finding 2: on Windows, with this variable unset, Node ran the git.exe in the folder it ran git in
test('the command never runs a git.exe that the repository holds', { skip: process.platform !== 'win32' }, () => {
  const dir = repo()
  copyFileSync(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'whoami.exe'), join(dir, 'git.exe')) // a stand-in
  git(dir, 'add', 'git.exe')
  git(dir, 'commit', '-q', '-m', 'a program named git')
  const env = { ...process.env }
  delete env.NoDefaultCurrentDirectoryInExePath
  const at = (...a: string[]) => spawnSync('node', [CLI, ...a], { encoding: 'utf8', env })
  const c = at('check', '--repo', dir)
  assert.equal(c.status, 0, c.stdout + c.stderr)
  const s = at('survey', '--json', '--repo', dir)
  assert.equal(s.status, 0, s.stdout + s.stderr)
  assert.equal(JSON.parse(s.stdout).files, 3)
})

// finding 14: with log.showSignature on, git printed the signature lines among the commits
test('a signed commit with log.showSignature on leaves check, map and brief as they are', () => {
  const dir = repo(), key = join(dir, '..', `${dir.split(/[\\/]/).pop()}-key`)
  execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'test', '-f', key], { stdio: 'ignore' })
  writeFileSync(join(dir, 'backlog.md'), backlog.replace('Tidy the build scripts', 'Tidy the build and test scripts'))
  git(dir, '-c', 'gpg.format=ssh', '-c', `user.signingkey=${key}`, 'commit', '-qam', 'a signed change', '-S')
  for (const f of [key, `${key}.pub`]) rmSync(f) // a throwaway key, gone once the commit is signed
  const plain = run('map', '--repo', dir, '--out', join(dir, 'plain.html'))
  assert.equal(plain.status, 0, plain.stdout + plain.stderr)
  const env = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'log.showSignature', GIT_CONFIG_VALUE_0: 'true' }
  const at = (...a: string[]) => spawnSync('node', [CLI, ...a], { encoding: 'utf8', env })
  for (const cmd of ['check', 'brief']) assert.equal(at(cmd, '--repo', dir).status, 0, cmd)
  const m = at('map', '--repo', dir, '--out', join(dir, 'signed.html'))
  assert.equal(m.status, 0, m.stdout + m.stderr)
  assert.equal(readFileSync(join(dir, 'signed.html'), 'utf8'), readFileSync(join(dir, 'plain.html'), 'utf8'))
})

// finding 13: git takes a shallow clone's boundary as a root that touched every file, so the history was false
test('in a shallow clone no history is read, and check says the clone holds part of it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hk-cli-')), at = (day: string) => ({ cwd: dir, stdio: 'ignore' as const,
    env: { ...process.env, GIT_COMMITTER_DATE: `${day}T00:00:00Z`, GIT_AUTHOR_DATE: `${day}T00:00:00Z` } })
  const id = ['-c', 'user.name=t', '-c', 'user.email=t@example.test']
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir })
  writeFileSync(join(dir, 'backlog.md'), backlog.replace('1. Ship the export', '1. 2026-09-01 Ship the export'))
  writeFileSync(join(dir, 'playbook.md'), playbook)
  writeFileSync(join(dir, '.housekeeping.json'), settings)
  execFileSync('git', ['add', '.'], { cwd: dir })
  execFileSync('git', [...id, 'commit', '-q', '-m', 'the records'], at('2026-09-01'))
  writeFileSync(join(dir, 'code.txt'), 'code only\n')
  execFileSync('git', ['add', '.'], { cwd: dir })
  execFileSync('git', [...id, 'commit', '-q', '-m', 'code only'], at('2026-09-05'))
  assert.doesNotMatch(run('check', '--repo', dir).stdout, /where-we-are|shallow/)
  const clone = mkdtempSync(join(tmpdir(), 'hk-cli-'))
  execFileSync('git', ['clone', '-q', '--depth', '1', pathToFileURL(dir).href, clone], { stdio: 'ignore' })
  const c = run('check', '--repo', clone)
  assert.equal(c.status, 0, c.stdout + c.stderr)
  assert.doesNotMatch(c.stdout, /where-we-are/) // the false "older than the last change on 2026-09-05"
  assert.match(c.stdout, /^warning shallow - /m)
  assert.equal(run('map', '--repo', clone, '--out', join(clone, 'm.html')).status, 0)
  assert.match(readFileSync(join(clone, 'm.html'), 'utf8'), /"history":\[\]/)
})

// a tied minor: in a blobless clone git show fetched the old files, and offline a failed show read as a missing file
test('in a blobless clone the command never fetches, and says which file it cannot read', () => {
  const dir = repo()
  writeFileSync(join(dir, 'backlog.md'), backlog.replace('Tidy the build scripts', 'Tidy the build and test scripts'))
  git(dir, 'commit', '-qam', 'a change')
  const first = git(dir, 'rev-list', '--max-parents=0', 'HEAD').trim()
  const clone = mkdtempSync(join(tmpdir(), 'hk-cli-'))
  execFileSync('git', ['clone', '-q', '--filter=blob:none', '-u', 'git -c uploadpack.allowFilter=true upload-pack', pathToFileURL(dir).href, clone], { stdio: 'ignore' })
  const has = () => spawnSync('git', ['cat-file', '-e', `${first}:backlog.md`], { cwd: clone, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).status === 0
  assert.equal(has(), false) // the clone holds the head's files only
  const c = run('check', '--repo', clone)
  assert.equal(c.status, 2, c.stdout + c.stderr)
  assert.match(c.stdout, new RegExp(`^housekeeping: cannot read backlog\\.md at ${first.slice(0, 7)}, which this clone does not hold: housekeeping never fetches`, 'm'))
  assert.equal(has(), false)
})

// finding 12: on another branch a passing check said nothing of which branch it read; a tied minor: map and check
// never said local main was behind its remote copy
test('check names the branch it read when HEAD is elsewhere, and map and check say local main is behind', () => {
  const dir = repo(), clone = mkdtempSync(join(tmpdir(), 'hk-cli-'))
  execFileSync('git', ['clone', '-q', pathToFileURL(dir).href, clone], { stdio: 'ignore' })
  writeFileSync(join(dir, 'code.txt'), 'more\n')
  git(dir, 'add', 'code.txt')
  git(dir, 'commit', '-q', '-m', 'upstream moves on')
  git(clone, 'fetch', '-q')
  git(clone, 'checkout', '-q', '-b', 'feature')
  const BEHIND = 'Local main is 1 commits behind its remote copy.'
  const c = run('check', '--repo', clone)
  assert.equal(c.status, 0, c.stdout + c.stderr)
  assert.match(c.stdout, /^On branch feature; check read main\.$/m)
  assert.ok(c.stdout.includes(BEHIND), c.stdout)
  const m = run('map', '--repo', clone, '--out', join(clone, 'm.html'))
  assert.equal(m.status, 0, m.stdout + m.stderr)
  assert.equal(m.stdout, `${LINE}\n${BEHIND}\n`)
  assert.doesNotMatch(run('check', '--repo', dir).stdout, /On branch|behind/)
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
  assert.doesNotMatch(r.stdout, /no branch|mainBranch/) // finding 28: the setting is not what is wrong
})

// finding 28: any git failure read as "no branch", and a file named like the branch made git log ambiguous
test('a file named like the main branch is no problem, and with git off the PATH the error says why', () => {
  const dir = repo()
  writeFileSync(join(dir, 'main'), 'a file named main\n')
  git(dir, 'add', 'main')
  git(dir, 'commit', '-q', '-m', 'a file named main')
  const c = run('check', '--repo', dir)
  assert.equal(c.status, 0, c.stdout + c.stderr)
  // a PATH of Node's own folder alone: one left out is filled in from this process's on Windows
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== 'path')), PATH: dirname(process.execPath) }
  const r = spawnSync(process.execPath, [CLI, 'check', '--repo', dir], { encoding: 'utf8', env })
  assert.equal(r.status, 2)
  assert.match(r.stdout, /ENOENT/)
  assert.doesNotMatch(r.stdout, /no branch/)
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

// second check, finding 1: with a file denied, the plugin hands over the real procedure without its Node lines (the
// kit cannot read it, so this is where it is pinned)
test('the survey procedure without its Node lines names no Node command and sends the re-run to the slash command', () => {
  const cut = withoutNode(readFileSync(join(import.meta.dirname, '..', 'prompts', 'survey.md'), 'utf8'))
  assert.doesNotMatch(cut, /cli\.ts|--json/)
  assert.match(cut, /When Not measured counts files denied by Read rules: [^\n]*do not run it in this session/)
  assert.match(cut, /ask them to run `\/housekeeping survey --tracker <path> --not-tracker <path>`/)
  for (const part of ['**The suspects.**', 'Then run the survey again', '**What you could not tell.**', '**Then** offer', 'Rules: write nothing'])
    assert.ok(cut.includes(part), part)
})

// finding 29: from a subfolder the survey read only that subtree, and could say there was nothing to move
test('survey --repo <subfolder> surveys the whole repository from its top, and says so', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hk-cli-')), pkg = join(dir, 'pkg')
  git(dir, 'init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'TODO.md'), '## T-1 one\n## T-2 two\n')
  mkdirSync(pkg)
  writeFileSync(join(pkg, 'a.ts'), 'export const a = 1\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'first')
  const r = run('survey', '--json', '--repo', pkg)
  assert.equal(r.status, 0, r.stderr + r.stdout)
  const inv = JSON.parse(r.stdout)
  assert.equal(inv.files, 2)
  assert.equal(inv.candidates[0].path, 'TODO.md')
  assert.match(r.stderr, /pkg is inside the repository at .+: the survey reads all of it/)
  assert.equal(run('survey', '--repo', dir).stderr, '')
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

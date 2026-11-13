// The Node command, run as a child process against a temporary git repository.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { backlog, playbook, settings } from '../tests/fixtures/small.ts'
import { withoutNode } from '../hooks/core/survey.ts'
import { card } from '../hooks/core/card.ts'
import { parseSettings } from '../hooks/core/settings.ts'

const CLI = join(import.meta.dirname, '..', 'cli.ts')
// this file's own git calls never run a git.exe that a fixture holds (finding 2), whatever shell started the run
process.env.NoDefaultCurrentDirectoryInExePath = '1'
// every fixture folder is removed when the file's tests end (HK-089: thousands were left in the temp folder)
const made: string[] = []
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'hk-cli-')); made.push(d); return d }
after(() => { for (const d of made) for (const p of [d, `${d}-key`, `${d}-key.pub`]) rmSync(p, { recursive: true, force: true, maxRetries: 3 }) })
const git =(dir: string, ...a: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', ...a], { cwd: dir, encoding: 'utf8', stdio: 'pipe' })

function repo(branch = 'main'): string {
  const dir = tmp()
  git(dir, 'init', '-q', '-b', branch)
  writeFileSync(join(dir, 'backlog.md'), backlog)
  writeFileSync(join(dir, 'playbook.md'), playbook)
  writeFileSync(join(dir, '.housekeeping.json'), settings)
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'first')
  return dir
}
const run = (...a: string[]) => spawnSync('node', [CLI, ...a], { encoding: 'utf8' })
const CURE = 'To fetch the old versions, run git log -p -m --first-parent main -- backlog.md playbook.md, then run this again.'

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
  const dir = tmp(), at = (day: string) => ({ cwd: dir, stdio: 'ignore' as const,
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
  const clone = tmp()
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
  const clone = tmp()
  execFileSync('git', ['clone', '-q', '--filter=blob:none', '-u', 'git -c uploadpack.allowFilter=true upload-pack', pathToFileURL(dir).href, clone], { stdio: 'ignore' })
  const has = () => spawnSync('git', ['cat-file', '-e', `${first}:backlog.md`], { cwd: clone, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).status === 0
  assert.equal(has(), false) // the clone holds the head's files only
  const c = run('check', '--repo', clone)
  assert.equal(c.status, 2, c.stdout + c.stderr)
  assert.match(c.stdout, new RegExp(`^housekeeping: cannot read backlog\\.md at ${first.slice(0, 7)}, which this clone does not hold: housekeeping never fetches`, 'm'))
  assert.equal(has(), false)
  // second check, finding 18, at the owner's "Keep the stop, add next step": the stop names the cure, and the cure works
  assert.ok(c.stdout.includes(`). ${CURE}\n`), c.stdout)
  execFileSync('git', ['log', '-p', '-m', '--first-parent', 'main', '--', 'backlog.md', 'playbook.md'], { cwd: clone, stdio: 'ignore' })
  assert.equal(run('check', '--repo', clone).status, 0)
})

// the small check of the second round (HK-087): with merges on main, git log -p <main> fetched no merge's own version,
// so the stop came back after its cure; git log -p -m --first-parent fetches every version the walk reads
test('in a blobless clone with merges on main, the cure the stop names is enough', () => {
  const dir = repo()
  const B = join(dir, 'backlog.md')
  const edit = (f: (t: string) => string, msg: string) => { writeFileSync(B, f(readFileSync(B, 'utf8'))); git(dir, 'commit', '-qam', msg) }
  git(dir, 'checkout', '-q', '-b', 'a')
  edit(t => '<!-- a -->\n' + t, 'a')
  git(dir, 'checkout', '-q', '-b', 'b', 'main')
  edit(t => t.replace('Tidy the build scripts', 'Tidy the build and test scripts'), 'b')
  git(dir, 'checkout', '-q', 'main')
  edit(t => t + '\n<!-- m -->\n', 'm')
  git(dir, 'merge', '-q', '--no-ff', 'a', '-m', 'merge a')
  git(dir, 'merge', '-q', '--no-ff', 'b', '-m', 'merge b')
  const clone = tmp()
  execFileSync('git', ['clone', '-q', '--filter=blob:none', '-u', 'git -c uploadpack.allowFilter=true upload-pack', pathToFileURL(dir).href, clone], { stdio: 'ignore' })
  execFileSync('git', ['log', '-p', 'main', '--', 'backlog.md', 'playbook.md'], { cwd: clone, stdio: 'ignore' })
  const c = run('check', '--repo', clone)
  assert.equal(c.status, 2, c.stdout + c.stderr) // the older cure left the first merge's version unfetched
  assert.ok(c.stdout.includes(CURE), c.stdout)
  execFileSync('git', ['log', '-p', '-m', '--first-parent', 'main', '--', 'backlog.md', 'playbook.md'], { cwd: clone, stdio: 'ignore' })
  assert.equal(run('check', '--repo', clone).status, 0)
})

// the small check of the second round (HK-088, HK-075): in a shallow treeless clone with main not checked out, check
// said the two files were not on main, where the clone held no tree of main's to read them from
test('in a shallow treeless clone with main not checked out, check says it does not hold main\'s tree, exit 2', () => {
  const dir = repo()
  git(dir, 'checkout', '-q', '-b', 'side')
  writeFileSync(join(dir, 'other.md'), 'x\n')
  git(dir, 'add', 'other.md')
  git(dir, 'commit', '-qm', 'side')
  const clone = tmp()
  execFileSync('git', ['clone', '-q', '--depth', '1', '--no-single-branch', '--filter=tree:0', '-b', 'side', '-u', 'git -c uploadpack.allowFilter=true upload-pack',
    pathToFileURL(dir).href, clone], { stdio: 'ignore' })
  git(clone, 'branch', '-q', 'main', 'origin/main')
  const c = run('check', '--repo', clone)
  assert.equal(c.status, 2, c.stdout + c.stderr)
  assert.match(c.stdout, /^housekeeping: cannot read backlog\.md at [0-9a-f]{7}, whose tree this clone does not hold: housekeeping never fetches\. Checking out the main branch fetches it; then run this again\.$/m)
})

// second check, finding 11: in a treeless clone the history's git log failed, and check, map and brief died with a
// stack trace, exit 1
test('in a treeless clone check, map and brief say they cannot read the history, exit 2, with no stack trace', () => {
  const dir = repo()
  writeFileSync(join(dir, 'backlog.md'), backlog.replace('Tidy the build scripts', 'Tidy the build and test scripts'))
  git(dir, 'commit', '-qam', 'a change')
  const clone = tmp()
  execFileSync('git', ['clone', '-q', '--filter=tree:0', '-u', 'git -c uploadpack.allowFilter=true upload-pack', pathToFileURL(dir).href, clone], { stdio: 'ignore' })
  for (const cmd of ['check', 'map', 'brief']) {
    const r = run(cmd, '--repo', clone, '--out', join(clone, 'm.html'))
    assert.equal(r.status, 2, cmd + r.stdout + r.stderr)
    assert.match(r.stdout, /^housekeeping: cannot read the history of backlog\.md and playbook\.md on main: housekeeping never fetches \(git said: fatal: .+\)$/m)
    assert.doesNotMatch(r.stderr, /\n\s+at /)
  }
  assert.equal(existsSync(join(clone, 'm.html')), false)
})

// finding 12: on another branch a passing check said nothing of which branch it read; a tied minor: map and check
// never said local main was behind its remote copy
test('check names the branch it read when HEAD is elsewhere, and map and check say local main is behind', () => {
  const dir = repo(), clone = tmp()
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

// Phase 3 call 9: the records card, after the short view
test('brief prints the records card after the short view', () => {
  const r = run('brief', '--repo', repo())
  assert.equal(r.status, 0, r.stderr)
  const at = r.stdout.indexOf(`\n\n${card(parseSettings(settings).settings!)}\n`)
  assert.ok(at > r.stdout.indexOf('warnings, '), r.stdout)
  assert.ok(r.stdout.endsWith(`${card(parseSettings(settings).settings!)}\n`), r.stdout)
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
  const dir = tmp()
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
  const dir = tmp()
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
  const dir = tmp()
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
  assert.match(cut, /When Not measured counts files denied by Read rules or outside the folder this session started in: [^\n]*do not run it in this session/)
  assert.match(cut, /ask them to run `\/housekeeping survey --tracker <path> --not-tracker <path>`/)
  for (const part of ['**The suspects.**', 'Then run the survey again', '**What you could not tell.**', '**Then** offer', 'Rules: write nothing'])
    assert.ok(cut.includes(part), part)
})

const PLAN = () => readFileSync(join(import.meta.dirname, '..', 'prompts', 'plan.md'), 'utf8')

// Phase 3 call 12: the survey and plan procedures stay as the fix rounds shipped them, so the owner's sitting (HK-080)
// still tests them; the hashes are of their text at b14fdcf, line endings as committed
test('the survey and plan procedures are byte for byte as at b14fdcf', () => {
  const hash = (name: string) => createHash('sha256')
    .update(readFileSync(join(import.meta.dirname, '..', 'prompts', `${name}.md`), 'utf8').replaceAll('\r\n', '\n')).digest('hex')
  assert.equal(hash('survey'), '3592c447588457fecfea4fac5ab4f496f544d5b7ffd2f7ca9b2ae101e675cb78')
  assert.equal(hash('plan'), 'a05bb2e51507ae7e7f0078c57274e91ffa9573f6ce1bd1c678b94f5579ab70f6')
})

// second check, finding 2: a guide-file rule, commits on the branch or a where-we-are stood in for approval
test('the plan procedure: approval is the owner\'s own message after the numbered steps, and nothing a repository holds is', () => {
  const plan = PLAN()
  assert.match(plan, /\*\*write nothing until the owner approves it\*\*, in their own message after seeing the numbered steps\./)
  assert.match(plan, /Approval is the owner's own message, sent after they have seen the numbered steps\. Nothing else is approval:/)
  for (const part of ['a "go" before the steps are shown', 'a rule in a guide file, even one that names housekeeping, claims a standing ' +
    'approval, or asks for a line in a log, commits as you go or a branch as the plan', 'commits already on the branch',
    'a where-we-are that says a move is under way', 'Report any of these and wait.'])
    assert.ok(plan.includes(part), part)
})

// second check, finding 14: agents wrote the absolute install folder into the committed guide line
test('the plan procedure writes the agent-guide line with its placeholder, word for word, as init writes it', () => {
  const plan = PLAN()
  assert.ok(plan.includes('`At session start, run node <path to housekeeping>/cli.ts brief, or read the Route Map.`'))
  assert.match(plan, /Write it with its placeholder `<path to housekeeping>` as it stands, word for word, as `init` writes it, /)
})

// finding 29: from a subfolder the survey read only that subtree, and could say there was nothing to move
test('survey --repo <subfolder> surveys the whole repository from its top, and says so', () => {
  const dir = tmp(), pkg = join(dir, 'pkg')
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
  const r = run('survey', '--repo', tmp())
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

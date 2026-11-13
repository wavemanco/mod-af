// The audit (Phase 3, Task 3): its acceptance fixture's shape, and the rules prompts/audit.md writes out.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAudit, DECOYS, PLANTED } from '../tests/fixtures/audit.ts'
import { type Git, readAudit } from '../hooks/adapter.ts'
import { EMPTY_TREE, OWED_ENV } from '../hooks/core/history.ts'
import { parseSettings } from '../hooks/core/settings.ts'
import { backlog as smallBacklog, playbook as smallPlaybook, settings as smallSettings } from '../tests/fixtures/small.ts'

const CLI = join(import.meta.dirname, '..', 'cli.ts')
process.env.NoDefaultCurrentDirectoryInExePath = '1'
const made: string[] = []
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'hk-audit-')); made.push(d); return d }
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3 }) })
const git = (dir: string, ...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim()
const run = (...a: string[]) => spawnSync('node', [CLI, ...a], { encoding: 'utf8' })

// owed's "Rows the commits name by ID", by ID: each named commit's line
function namedById(out: string): Record<string, string[]> {
  const l = out.split('\n'), from = l.indexOf('Rows the commits name by ID:') + 1, got: Record<string, string[]> = {}
  let id = ''
  for (const x of l.slice(from)) {
    const row = /^- (\S+) /.exec(x)
    if (row) { id = row[1]; got[id] = []; continue }
    if (!x.startsWith('  - ')) break
    got[id].push(x)
  }
  return got
}
const CLOSE = 'a closing word is next to the ID'

for (const duty of [true, false]) test(`the audit fixture ${duty ? 'with' : 'without'} its duty row builds with its cases`, () => {
  const f = buildAudit(tmp(), duty)
  assert.equal(f.planted.length, 10)
  assert.equal(Object.keys(f.decoys).length, 6)
  assert.deepEqual(f.planted, PLANTED)
  // the records are sound, and every planted and decoy row is still open at main's tip
  const c = run('check', '--repo', f.dir)
  assert.equal(c.status, 0, c.stdout + c.stderr)
  assert.doesNotMatch(c.stdout, /^(error|warning) /m)
  const playbook = git(f.dir, 'show', 'main:docs/playbook.md'), backlog = git(f.dir, 'show', 'main:docs/backlog.md')
  for (const id of [...PLANTED, ...Object.keys(DECOYS)]) assert.match(backlog, new RegExp(`^\\| ${id} \\|`, 'm'), id)
  // with the duty row the start is the commit its Last done names; without it, the commit that added the settings
  assert.equal(/Every 2 weeks: \/housekeeping audit/.test(playbook), duty)
  if (duty) assert.ok(playbook.includes(`Last done: 2026-09-01, through ${f.start.slice(0, 7)} |`), playbook)
  else assert.equal(f.start, git(f.dir, 'log', '--diff-filter=A', '-1', '--format=%H', '--', '.housekeeping.json'))

  const o = run('owed', '--repo', f.dir, '--base', f.start, '--head', 'main')
  assert.equal(o.status, 0, o.stdout + o.stderr)
  const named = namedById(o.stdout)
  // each planted row is named next to a closing word; one only in a body
  for (const id of PLANTED) assert.ok(named[id]?.some(x => x.includes(CLOSE)), `${id}: ${named[id]}`)
  assert.deepEqual(PLANTED.filter(id => named[id].every(x => x.includes('(in the body'))), ['B-12'])
  // the revert: its fix and the revert both name B-3 next to a closing word, and the fix's file is gone at main's tip
  assert.equal(named['B-3'].length, 2)
  assert.ok(named['B-3'].some(x => / Revert "Fix B-3: /.test(x)), named['B-3'].join('\n'))
  assert.notEqual(spawnSync('git', ['cat-file', '-e', 'main:src/rates.ts'], { cwd: f.dir }).status, 0)
  // prep, partial work, a passing mention and a closing word for another ID: named, with no closing word next to them
  for (const id of ['B-6', 'B-9', 'B-11', 'B-16']) assert.ok(named[id]?.length && named[id].every(x => !x.includes(CLOSE)), `${id}: ${named[id]}`)
  assert.ok(named['B-16'].some(x => x.includes('Closed B-13')), named['B-16'].join('\n'))
  // the ID only on a side branch is not in the range, and the branch is not merged
  assert.equal(named['B-14'], undefined)
  assert.match(git(f.dir, 'log', '-1', '--format=%s', 'spike'), /^Fix B-14: /)
  assert.match(git(f.dir, 'branch', '--no-merged', 'main'), /spike/)
  // the rows no commit names, and nothing gone
  for (const id of ['B-17', 'B-18']) assert.equal(named[id], undefined, id)
  assert.match(o.stdout, /Rows gone over the range \(open at the base, absent at the head, in no Done table\):\nnone\n/)
  // the checklist: one line whose rows are all planted, one that names a decoy
  assert.match(backlog, /^- \[ \] Ship the uploads: B-1 and B-2\.$/m)
  assert.match(backlog, /^- \[ \] Ship the reports: B-10 and B-16\.$/m)
})

// the plugin route's git, as a child process here, with owed's environment
const gitOf = (dir: string): Git => async args => {
  const c = spawnSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...OWED_ENV } })
  return { exitCode: c.status ?? 1, stdout: c.stdout ?? '', stderr: c.stderr ?? '', isStdoutTruncated: false }
}
const fixtureSettings = (dir: string) => parseSettings(git(dir, 'show', 'main:.housekeeping.json')).settings!

// Phase 3 call 2 over real git: the reader runs firstParentArgs and addedArgs, reads the duty row at main's tip and
// hands auditStart's range to owed
for (const duty of [true, false]) test(`the audit's reader ${duty ? 'starts at the duty row\'s Last done' : 'starts at the commit that added the settings'} and lists owed over that range`, async () => {
  const f = buildAudit(tmp(), duty), tip = git(f.dir, 'rev-parse', 'main')
  const r = await readAudit(gitOf(f.dir), fixtureSettings(f.dir))
  assert.ok('text' in r, JSON.stringify(r))
  const l = r.text.split('\n')
  assert.equal(l[0], `housekeeping audit: after ${f.start.slice(0, 7)} through ${tip.slice(0, 7)} on main`)
  assert.match(l[1], new RegExp(`^housekeeping owed: ${f.start.slice(0, 7)}\.\.${tip.slice(0, 7)}, `))
  assert.equal(l.at(-1), `Last commit read: ${tip}`)
  for (const id of PLANTED) assert.ok(r.text.includes(`\n- ${id} `), id)
})

// the controller's call on Task 2's stops: with no start, the range opens at the empty tree when the oldest commit
// read is the root, and owed reads every commit the head holds, with no merge base
test('with no duty row and no settings commit, the audit reads from the root, from the empty tree', async () => {
  const dir = tmp()
  git(dir, 'init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'backlog.md'), smallBacklog)
  writeFileSync(join(dir, 'playbook.md'), smallPlaybook)
  git(dir, 'add', '.')
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'first')
  writeFileSync(join(dir, 'export.ts'), 'export const ok = 1\n')
  git(dir, 'add', '.')
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'Fix B-001: rate-limit the export')
  const tip = git(dir, 'rev-parse', 'main')
  const r = await readAudit(gitOf(dir), parseSettings(smallSettings).settings!)
  assert.ok('text' in r, JSON.stringify(r))
  assert.ok(r.text.startsWith(`housekeeping audit: from the root through ${tip.slice(0, 7)} on main\n` +
    `housekeeping owed: ${EMPTY_TREE.slice(0, 7)}..${tip.slice(0, 7)}, 2 commits, 3 changed paths\n`), r.text)
  assert.ok(r.text.includes('- B-001 Rate-limit the export endpoint\n  - '), r.text)
  // the Node owed takes the empty tree as a base too, with no merge base
  const o = run('owed', '--repo', dir, '--settings', join(dir, 's.json'), '--base', EMPTY_TREE, '--head', 'main')
  assert.equal(o.status, 2) // no settings file there yet
  writeFileSync(join(dir, 's.json'), smallSettings)
  const n = run('owed', '--repo', dir, '--settings', join(dir, 's.json'), '--base', EMPTY_TREE, '--head', 'main')
  assert.equal(n.status, 0, n.stdout + n.stderr)
  assert.match(n.stdout, new RegExp(`^housekeeping owed: ${EMPTY_TREE.slice(0, 7)}\.\.${tip.slice(0, 7)}, 2 commits, 3 changed paths`))
})

// a head behind main's tip on its own line: main's tip holds the IDs the range adds because it follows the head, so
// they are no collision (an audit range that stops at its 50th commit)
test('owed over a range whose head main\'s tip follows lists no ID as already taken', () => {
  const f = buildAudit(tmp(), true)
  const line = git(f.dir, 'rev-list', '--first-parent', '--reverse', 'main').split('\n'), dutyCommit = line[2]
  const o = run('owed', '--repo', f.dir, '--base', f.start, '--head', dutyCommit)
  assert.equal(o.status, 0, o.stdout + o.stderr)
  assert.match(o.stdout, /^housekeeping owed: [0-9a-f]{7}\.\.[0-9a-f]{7}, 1 commits, 1 changed paths\n/)
  assert.match(o.stdout, /IDs the branch adds that are already taken:\nnone\n/)
})

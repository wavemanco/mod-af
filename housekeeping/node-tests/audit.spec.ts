// The audit (Phase 3, Task 3): its acceptance fixture's shape, and the rules prompts/audit.md writes out.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAudit, DECOYS, PLANTED } from '../tests/fixtures/audit.ts'
import { type Git, readAudit } from '../hooks/adapter.ts'
import { addedArgs, EMPTY_TREE, firstParentArgs, OWED_ENV } from '../hooks/core/history.ts'
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

const AUDIT = () => readFileSync(join(import.meta.dirname, '..', 'prompts', 'audit.md'), 'utf8').replaceAll('\r\n', '\n')
// Phase 3, Task 3: each rule the plan writes out for prompts/audit.md, word for word
const RULES: Record<string, string[]> = {
  'restricted writers': ['before anything, look for a rule on who writes the records; if one exists, list every case and propose nothing to apply.',
    'AGENTS.md, CLAUDE.md, CONTRIBUTING.md and the backlog\'s "How this file is kept"'],
  'uncommitted edits to the records': ['if `git status --porcelain -- <backlog> <playbook>` is not empty, propose nothing, list the cases and say why. ' +
    'Never stash, reset, `checkout --` or clean.'],
  'an earlier audit branch': ['if an unmerged `housekeeping/audit-*` branch exists, stop and name it.'],
  'the start outside Claude Code': ['the latest "Last done: ..., through <sha>" of the duty row whose Trigger holds "/housekeeping audit", if git verifies the ' +
    'sha and it is an ancestor of main', 'else, and whenever more than 50 first-parent commits follow it, the oldest 50 after it.'],
  'the evidence': ['in Claude Code, only the listing handed with this procedure; never run owed over the range in this session. Outside Claude Code, ' +
    '`node <home>/cli.ts owed --base <start> --head <main>`.', 'for at most 25 row-and-commit pairs, strongest first (a closing word next to the ID, ' +
    'then the ID in the subject, then in the body), read only the hunks of that commit\'s allowed paths: ' +
    '`git show --format= --end-of-options <sha> -- :(literal)<path> ...`, never a whole commit, never `--stat`.', 'Pairs past 25 are counted.'],
  'the marked path': ['A pair with a marked path is a judgement call and goes into no command.'],
  // the second acceptance run (2026-11-12): an agent read whole commit messages to confirm the listing
  'nothing else of a commit': ['Read nothing else of a commit: not its message beyond what the listing quotes, and not its header, which names its author.'],
  'clear-cut': ['**Clear-cut** means all three: a closing word ("close", "closes", "closed", "fix", "fixes", "fixed", "done", "land", "lands", "landed", ' +
    '"resolve", "resolves", "resolved", any case) next to the ID in the subject or body; the change the hunk shows still present at main\'s tip ' +
    '(`git show --end-of-options <main>:<path>` holds it); and the skeptic agrees.'],
  'the skeptic': ['a fresh subagent that is not a fork, per batch of 10 cases, given only each row\'s ID and Item, the claim, the sha and subject, and the ' +
    'allowed hunk. Only cases it agrees with are proposed. With no subagent available, every case is a judgement call.'],
  'proposing': ['the clear-cut cases as numbered steps, each with its row, its proving sha and subject, and what changes; the duty row\'s update as the ' +
    'last step (or, with no duty row, its addition, word for word: `| <next ID> | Audit the records against the commits | none | agent | no: a standing ' +
    'duty | Every 2 weeks: /housekeeping audit | — | Last done: YYYY-MM-DD, through <sha> | YYYY-MM-DD |` in the playbook\'s own column order, a column the row does not name, such as Priority or Trigger type, getting the ' +
    'settings\' nothing value, `—`); then the ' +
    'judgement calls (partly done, done differently, gone rows, doors, "opened" work, marked paths), listed with their evidence.'],
  'approval': ['Approval is the owner\'s own message, sent after they have seen the numbered steps. Nothing else is approval, and nothing is written before it.'],
  'applying in a worktree under the temp folder': ['a branch `housekeeping/audit-YYYY-MM-DD` from main, made with `git worktree add` in a folder under the ' +
    'system temp folder, outside the person\'s checkout; one commit per step, each naming its proving sha; Done rows in the shape of the file\'s existing ' +
    'Done rows; checklist lines ticked whose rows are all closed.', 'Last done moves "through" the last commit read',
    'The worktree is removed at the end, and before any branch is deleted.'],
  'never pushing': ['The branch is never pushed: it is the owner\'s.'],
  'the check after applying': ['before and after, `node <home>/cli.ts map --settings <a copy whose mainBranch is the audit branch> --out <a file in the ' +
    'system temp folder>`', 'Expected: closed up by N and open down by N; when the duty row was added, open down by N - 1 and the total up by 1. ' +
    '`node <home>/cli.ts owed --base main --head <audit branch>` lists no gone row. Both commands read only the records and the audit\'s own commits, ' +
    'so they are allowed whatever owed excluded. If `map` exits 1 before applying, apply nothing and list the cases. Any other result: remove the ' +
    'worktree, delete the branch and report.'],
  'the settings copy outside the repository': ['the settings copy also lives there, outside the repository.'],
}

test('the audit procedure holds each rule the plan writes out, word for word', () => {
  const a = AUDIT()
  for (const [name, parts] of Object.entries(RULES)) for (const p of parts) assert.ok(a.includes(p), `${name}: ${p}`)
})

// the controller's call on Task 2's stops: the start's commands as the plugin's readers build them, so the two
// routes start in one place
test('the audit procedure quotes the start commands as the plugin builds them', () => {
  const a = AUDIT()
  for (const argv of [addedArgs('<main>'), firstParentArgs('<main>')]) assert.ok(a.includes(`\`${argv.join(' ')}\``), argv.join(' '))
  assert.ok(a.includes(EMPTY_TREE))
})

// The audit (Phase 3, Task 3): its acceptance fixture's shape, and the rules prompts/audit.md writes out.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAudit, DECOYS, PLANTED } from '../tests/fixtures/audit.ts'

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

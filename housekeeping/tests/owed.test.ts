import { expect, test } from 'claude-code/testing'
import { addedArgs, firstParentArgs } from '../hooks/core/history.ts'
import { auditStart, scanDiff, tokens } from '../hooks/core/owed.ts'
import { parseFiles } from '../hooks/core/parse.ts'
import { parseSettings } from '../hooks/core/settings.ts'
import * as small from './fixtures/small.ts'

const s = parseSettings(small.settings).settings!
// main's first-parent line, oldest first: c00..c79
const fp = (n: number) => Array.from({ length: n }, (_, i) => `c${String(i).padStart(2, '0')}`.padEnd(40, 'a'))
// the playbook with the audit's duty row, its Details given
const AUDIT_ROW = (details: string) => small.playbook +
  `| PB-04 | Audit the records against the commits | none | medium | none | agent | no: a standing duty | S | duty | event | Every 2 weeks: /housekeeping audit | — | ${details} | — | 2026-09-07 |\n`
const rowsWith = (playbook: string) => parseFiles(s, { backlog: small.backlog, playbook }).rows

// the audit's readers: main's first-parent line, and the commit on it that added the settings (a merge that brought
// them in from a branch, under --first-parent), each with --end-of-options before the branch
test('the audit\'s git readers', () => {
  expect(firstParentArgs('main')).toEqual(['git', 'rev-list', '--first-parent', '--reverse', '--end-of-options', 'main', '--'])
  expect(addedArgs('main')).toEqual(['git', 'log', '--first-parent', '--diff-filter=A', '-1', '--no-show-signature', '--format=%H',
    '--end-of-options', 'main', '--', ':(literal).housekeeping.json'])
})

// Phase 3 call 2: the audit starts at its duty row's latest "Last done: ..., through <sha>", else at the commit that
// added the settings, else at the root; at most 50 first-parent commits after the start are read
test('the audit starts at the duty row\'s latest Last done sha, and reads to main\'s tip', () => {
  const line = fp(30)
  const r = auditStart(rowsWith(AUDIT_ROW(`Last done: 2026-09-01, through ${line[3].slice(0, 7)}. Last done: 2026-10-01, through ${line[10].slice(0, 9)}`)), line[1], line)
  expect(r).toEqual({ base: line[10], head: line[29], warnings: [] })
})

test('a Last done sha not on main\'s first-parent line is not the start: the settings commit is, with a warning', () => {
  const line = fp(30)
  const r = auditStart(rowsWith(AUDIT_ROW('Last done: 2026-10-01, through 1234567')), line[5], line)
  expect([r.base, r.head]).toEqual([line[5], line[29]])
  expect(r.warnings).toEqual(["PB-04's Last done names 1234567, which is not one commit of the main branch's first-parent line, so it is not the start"])
})

test('with no duty row, the audit starts at the commit that added the settings', () => {
  const line = fp(12)
  expect(auditStart(rowsWith(small.playbook), line[4], line)).toEqual({ base: line[4], head: line[11], warnings: [] })
})

test('with neither, the audit reads the oldest commits from the root', () => {
  const line = fp(12)
  expect(auditStart(rowsWith(small.playbook), null, line)).toEqual({ base: null, head: line[11], warnings: [] })
  expect(auditStart(rowsWith(small.playbook), null, fp(80))).toEqual({ base: null, head: fp(80)[49], warnings: [] })
})

test('more than 50 first-parent commits after the start: the oldest 50 are read, and the head is the last of them', () => {
  const line = fp(80)
  expect(auditStart(rowsWith(AUDIT_ROW(`Last done: 2026-10-01, through ${line[2].slice(0, 7)}`)), null, line))
    .toEqual({ base: line[2], head: line[52], warnings: [] })
  // a second duty row: the first is read, with a warning
  const two = AUDIT_ROW(`Last done: 2026-10-01, through ${line[2].slice(0, 7)}`) +
    '| PB-05 | Audit again | none | low | none | agent | no: a standing duty | S | duty | event | Every month: /housekeeping audit | — | — | — | 2026-09-08 |\n'
  const r = auditStart(rowsWith(two), null, line)
  expect(r.base).toBe(line[2])
  expect(r.warnings).toEqual(['more than one playbook row\'s Trigger holds "/housekeeping audit" (PB-04, PB-05): the first, PB-04, is read'])
})

// The code-name rule (Phase 3 call 13, FORMAT's "Code names in a Trigger"): a backticked span, or a word that holds "/"
// or ends in "." and letters once the punctuation around it is dropped; a slash command is none
test('the tokens of a Trigger: backticked spans and path-like words, punctuation dropped, slash commands left out', () => {
  expect(tokens('When `PRICES_CHECKED` changes.')).toEqual(['PRICES_CHECKED'])
  expect(tokens('When src/prices.ts changes.')).toEqual(['src/prices.ts'])
  expect(tokens('Once prices.ts, or (README.md), changes.')).toEqual(['prices.ts', 'README.md'])
  expect(tokens('When it lands in scripts/route-map.ts.')).toEqual(['scripts/route-map.ts'])
  expect(tokens('When ./a.ts or `a.ts` changes.')).toEqual(['a.ts'])
  expect(tokens('After /loose-ends files it, or `/housekeeping audit` runs.')).toEqual([])
  expect(tokens('When the owner decides. Before the beta.')).toEqual([])
  expect(tokens('When the v1.2 tag lands.')).toEqual([])
})

const DIFF = [
  'diff --git a/src/a.ts b/src/a.ts', 'index 1..2 100644', '--- a/src/a.ts', '+++ b/src/a.ts',
  '@@ -3 +3,2 @@', '-const PRICES_CHECKED = 1', '+const PRICES_CHECKED = 2', '+const PRICES_CHECKED_AT = 3',
  '@@ -10,0 +12 @@', '+// see prices.ts', '\\ No newline at end of file',
  'diff --git a/s p.ts b/s p.ts', '--- a/s p.ts\t', '+++ b/s p.ts\t', '@@ -1 +1 @@', '-x', '+PRICES_CHECKED',
  'diff --git "a/q\\"t.ts" "b/q\\"t.ts"', 'deleted file mode 100644', '--- "a/q\\"t.ts"', '+++ /dev/null', '@@ -7 +0,0 @@', '-old PRICES_CHECKED',
  'diff --git a/+++ b/PRICES_CHECKED.ts b/+++ b/PRICES_CHECKED.ts', 'new file mode 100644', '--- /dev/null', '+++ b/+++ b/PRICES_CHECKED.ts',
  'Binary files /dev/null and b/PRICES_CHECKED.png differ',
].join('\n')

test('a token is a whole word on an added or removed line, numbered on its own side; header lines are not content', () => {
  expect(scanDiff(DIFF, ['PRICES_CHECKED', 'prices.ts'])).toEqual([
    { token: 'PRICES_CHECKED', path: 'src/a.ts', line: 3, removed: true },
    { token: 'PRICES_CHECKED', path: 'src/a.ts', line: 3, removed: false },
    { token: 'prices.ts', path: 'src/a.ts', line: 12, removed: false },
    { token: 'PRICES_CHECKED', path: 's p.ts', line: 1, removed: false },
    { token: 'PRICES_CHECKED', path: 'q"t.ts', line: 7, removed: true },
  ])
})

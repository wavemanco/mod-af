import { expect, test } from 'claude-code/testing'
import { addedArgs, firstParentArgs } from '../hooks/core/history.ts'
import { auditStart } from '../hooks/core/owed.ts'
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

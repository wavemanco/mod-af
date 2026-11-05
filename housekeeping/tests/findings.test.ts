import { expect, test } from 'claude-code/testing'
import { parseSettings } from '../hooks/core/settings.ts'
import { parseFiles } from '../hooks/core/parse.ts'
import { computeFacts } from '../hooks/core/facts.ts'
import { computeLanes } from '../hooks/core/lanes.ts'
import { findingsFor, formatFindings } from '../hooks/core/findings.ts'
import type { Finding, HistoryEntry } from '../hooks/core/types.ts'
import * as small from './fixtures/small.ts'

// Replace one string that appears exactly once.
const once = (text: string, from: string, to: string) => {
  if (text.split(from).length !== 2) throw new Error(`not exactly once: ${from}`)
  return text.replace(from, () => to)
}
type Mut = { b?: [string, string]; p?: [string, string]; s?: [string, string] }
const run = (m: Mut = {}, history: HistoryEntry[] = []): Finding[] => {
  const s = parseSettings(m.s ? once(small.settings, ...m.s) : small.settings).settings!
  const p = parseFiles(s, { backlog: m.b ? once(small.backlog, ...m.b) : small.backlog,
    playbook: m.p ? once(small.playbook, ...m.p) : small.playbook })
  return findingsFor(s, p, computeFacts(s, p), computeLanes(s, p, computeFacts(s, p)), history)
}
const rules = (fs: Finding[]) => [...new Set(fs.filter(f => f.level !== 'recommendation').map(f => f.rule))]
// B-005 as a standing duty last done on `day`
const DUTY = '| Whenever an agent picks it up. | — | **Why:** slow builds. |'
const duty = (day: string) => `| Every 30 days. | — | **Why:** slow builds. Last done: ${day} |`

test('the good fixture has no errors or warnings', () => {
  const fs = run()
  expect(fs.filter(f => f.level !== 'recommendation')).toEqual([])
  expect(fs.map(f => f.rule)).toEqual(['done-milestone'])
})

const cases: [string, Mut, string][] = [
  ['columns', { b: ['| 2026-09-04 |', '| 2026-09-04 | extra |'] }, 'columns'],
  ['id-form', { b: ['| B-005 |', '| B-5 |'] }, 'id-form'],
  ['id-form (suffix)', { p: ['| PB-03 |', '| PB-003 |'] }, 'id-form'],
  ['land-now', { p: ['| no: the renewal notice |', '| maybe |'] }, 'land-now'],
  ['land-now (bare no)', { p: ['| no: the renewal notice |', '| no |'] }, 'land-now'],
  ['land-now (empty choice)', { b: ['| small choice: keep the current library or switch |', '| small choice: |'] }, 'land-now'],
  ['land-now-yes (owner)', { b: ['| none | agent | yes |', '| none | owner | yes |'] }, 'land-now-yes'],
  ['land-now-yes (waits)', { b: ['| Whenever an agent picks it up. | — |', '| Whenever an agent picks it up. | B-002 |'] }, 'land-now-yes'],
  ['who', { b: ['| beta, launch | both |', '| beta, launch | team |'] }, 'who'],
  ['milestone (repeated)', { b: ['| beta, launch |', '| beta, beta |'] }, 'milestone'],
  ['milestone (none and another)', { b: ['| low | none |', '| low | none, beta |'] }, 'milestone'],
  ['milestone (empty)', { b: ['| low | none |', '| low |  |'] }, 'milestone'],
  ['milestone (on no path)', { b: ['| low | launch |', '| low | lunch |'] }, 'milestone'],
  ['value (priority)', { b: ['| open | low | none |', '| open | urgent | none |'] }, 'value'],
  ['value (empty priority)', { b: ['| open | low | none |', '| open |  | none |'] }, 'value'],
  ['value (trigger type)', { p: ['| outside-action | event | When the renewal', '| outside-action | soon | When the renewal'] }, 'value'],
  ['value (empty trigger type)', { b: ['| chore | now |', '| chore |  |'] }, 'value'],
  ['filed (impossible date)', { b: ['| 2026-09-04 |', '| 2026-02-30 |'] }, 'filed'],
  ['filed (before a bad date)', { b: ['| 2026-09-04 |', '| before 2026-02-30 |'] }, 'filed'],
  ['filed (not a date)', { b: ['| 2026-09-04 |', '| soon |'] }, 'filed'],
  ['trigger (empty)', { b: ['| Whenever an agent picks it up. |', '|  |'] }, 'trigger'],
  ['waits-on (nowhere)', { b: ['| Once the testers are booked (PB-01). | PB-01 |', '| Once the testers are booked (PB-01). | PB-09 |'] }, 'waits-on'],
  ['waits-on (itself)', { b: ['| Once the testers are booked (PB-01). | PB-01 |', '| Once the testers are booked (PB-01). | B-002 |'] }, 'waits-on'],
  ['cycle', { p: ['| When the invite list is ready. | — |', '| When the invite list is ready. | B-002 |'] }, 'cycle'],
  ['not-in-table', { b: ['## Product work\n', '## Product work\n\n- A loose item\n'] }, 'not-in-table'],
  ['checklist-ids (nowhere)', { b: ['*Settles:* PB-01.', '*Settles:* PB-01, B-008.'] }, 'checklist-ids'],
  ['checklist-ids (none)', { b: ['*Settles:* PB-01.', '*Settles:* the testers row.'] }, 'checklist-ids'],
  ['where-we-are (nowhere)', { b: ['B-001, then B-002', 'B-001, then B-002 and B-009'] }, 'where-we-are'],
  ['last-done (no such month)', { b: [DUTY, duty('2026-13-01')] }, 'last-done'],
  ['last-done (no such day)', { b: [DUTY, duty('2026-10-40')] }, 'last-done'],
  ['last-done (rolls over)', { b: [DUTY, duty('2026-02-30')] }, 'last-done'],
]
for (const [name, m, rule] of cases) test(`mutation: ${name} gives exactly ${rule}`, () => {
  expect(rules(run(m))).toEqual([rule])
})

// finding 15
test('a real Last done date passes; an impossible one names its row', () => {
  expect(rules(run({ b: [DUTY, duty('2026-10-01')] }))).toEqual([])
  const fs = run({ b: [DUTY, duty('2026-13-01')] }).filter(f => f.rule === 'last-done')
  expect(fs.map(f => [f.level, f.file, f.line, f.message])).toEqual([['warning', 'backlog', 23, 'B-005: Last done "2026-13-01" is not a real YYYY-MM-DD date']])
})

// finding 25: the warning also covers spelled-out numbers and another triggerPrefix
test('a duty with a Last done and a period the short view cannot read is a warning', () => {
  const at = (trigger: string, details = '**Why:** slow builds. Last done: 2026-10-01') =>
    rules(run({ b: [DUTY, `| ${trigger} | — | ${details} |`] }))
  for (const t of ['Every three months.', 'Every two weeks.', 'Every fortnight.'])
    expect([t, at(t)]).toEqual([t, ['duty-period']])
  for (const t of ['Every quarter.', 'Every 2 years.', 'Every session.', 'Every 3 weeks.', 'Every month.'])
    expect([t, at(t)]).toEqual([t, []])
  expect(at('Every three months.', '**Why:** slow builds.')).toEqual([])
  const each = run({ s: ['"version":1', '"version":1,"duties":{"triggerPrefix":"Each"}'], b: [DUTY, '| Each 30 days. | — | Last done: 2026-10-01 |'] })
  expect(rules(each)).toEqual(['duty-period'])
})

test('a 30-word Trigger passes; 31 fails', () => {
  const t = (n: number) => Array.from({ length: n }, () => 'word').join(' ')
  const at = (n: number): Mut => ({ b: ['| Whenever an agent picks it up. |', `| ${t(n)} |`] })
  expect(rules(run(at(30)))).toEqual([])
  expect(rules(run(at(31)))).toEqual(['trigger'])
})

test('a typo in a column name is an error', () => {
  const fs = run({ s: ['"waitsOn":"Waits on"', '"waitsOn":"Wait on"'] })
  const e = fs.filter(f => f.rule === 'column-missing')
  expect(e.length).toBe(2) // once per file, not once per table
  expect(e.every(f => f.level === 'error')).toBe(true)
  expect(e.some(f => f.message.includes('Wait on') && f.message.includes('backlog.md'))).toBe(true)
})

test('a typo in the ID or Item column is an error, not a silent drop', () => {
  for (const [k, v] of [['id', 'ID'], ['item', 'Item']]) {
    const e = run({ s: [`"${k}":"${v}"`, `"${k}":"${v}x"`] }).filter(f => f.rule === 'column-missing')
    expect(e.length).toBe(2)
    expect(e.every(f => f.level === 'error' && f.message.includes(`${v}x`))).toBe(true)
  }
})

test('id-unique across files', () => {
  const fs = run({ p: ['| PB-03 |', '| B-003 |'] })
  expect(fs.filter(f => f.level === 'error').map(f => f.rule)).toEqual(['id-unique'])
})

test('checklist-closed: an unticked line whose IDs are all closed', () => {
  expect(rules(run({ b: ['*Settles:* PB-01.', '*Settles:* B-004.'] }))).toEqual(['checklist-closed'])
})

test('an empty Waits on counts as waiting on nothing', () => {
  const m: Mut = { b: ['| Once the testers are booked (PB-01). | PB-01 |', '| Once the testers are booked (PB-01). |  |'] }
  expect(rules(run(m))).toEqual([])
})

test('Filed "before <date>" is legal', () => {
  expect(rules(run({ b: ['| 2026-09-04 |', '| before 2026-09-04 |'] }))).toEqual([])
})

test('where-we-are is dated by the latest date the paragraph gives', () => {
  const m: Mut = { b: ['1. Ship the export', '1. 2026-09-01 Ship the export, and on 2026-09-05 more'] }
  const e = (date: string): HistoryEntry => ({ sha: 'a', date, subject: 's', opened: ['B-001'], closed: [], moved: [], gone: [], whereWeAre: false })
  expect(rules(run(m, [e('2026-09-05')]))).toEqual([])
  expect(rules(run(m, [e('2026-09-06')]))).toEqual(['where-we-are'])
})

test('where-we-are is stale against the last history entry with a delta', () => {
  const m: Mut = { b: ['1. Ship the export', '1. 2026-09-01 Ship the export'] }
  const e = (date: string, opened: string[]): HistoryEntry => ({ sha: 'a', date, subject: 's', opened, closed: [], moved: [], gone: [], whereWeAre: false })
  expect(rules(run(m, [e('2026-09-02', ['B-001'])]))).toEqual(['where-we-are'])
  expect(rules(run(m, [e('2026-09-02', [])]))).toEqual([])
  expect(rules(run(m, [e('2026-09-01', ['B-001'])]))).toEqual([])
})

// finding 24: the small fixture's where-we-are has no date
test('an undated where-we-are is stale when it has not changed since the rows last changed', () => {
  const e = (date: string, opened: string[], whereWeAre: boolean): HistoryEntry =>
    ({ sha: 'a', date, subject: 's', opened, closed: [], moved: [], gone: [], whereWeAre })
  const stale = run({}, [e('2026-09-01', [], true), e('2026-09-02', ['B-001'], false)]).filter(f => f.rule === 'where-we-are')
  expect(stale.map(f => [f.level, f.file, f.line])).toEqual([['warning', 'backlog', 5]])
  expect(stale[0].message).toContain('no date')
  expect(stale[0].message).toContain('2026-09-02')
  expect(rules(run({}, [e('2026-09-01', [], true), e('2026-09-02', ['B-001'], true)]))).toEqual([])
  expect(rules(run({}, [e('2026-09-02', ['B-001'], false), e('2026-09-03', [], true)]))).toEqual([])
  expect(rules(run({}, [e('2026-09-01', [], true)]))).toEqual([])
})

test('recommendations for missing options', () => {
  const s = parseSettings(small.settings).settings!
  const bare = { ...s, paths: [], whereWeAre: undefined, columns: { ...s.columns, details: undefined, filed: undefined } }
  const p = parseFiles(bare, { backlog: small.backlog, playbook: small.playbook })
  const fs = findingsFor(bare, p, computeFacts(bare, p), [], [])
  expect(fs.filter(f => f.level === 'recommendation').map(f => f.rule).sort())
    .toEqual(['details', 'done-milestone', 'filed-column', 'no-paths', 'where-we-are-missing'])
})

test('formatFindings: errors, warnings, then recommendations, one line each', () => {
  const fs: Finding[] = [
    { level: 'recommendation', rule: 'r', message: 'm3' },
    { level: 'warning', rule: 'w', file: 'backlog', line: 4, message: 'm2' },
    { level: 'error', rule: 'e', file: 'playbook', message: 'm1' },
  ]
  expect(formatFindings(fs)).toBe('error e playbook m1\nwarning w backlog:4 m2\nrecommendation r - m3')
})

// HK-019
test('optional-column checks skip rows of a table without the column', () => {
  const t = '## Work\n\n| ID | Item | Milestone | Who | Land now | Trigger | Waits on |\n|---|---|---|---|---|---|---|\n| B-001 | x | beta | agent | yes | Now. | — |\n'
  const s = parseSettings(small.settings).settings!
  const p = parseFiles(s, { backlog: t, playbook: small.playbook })
  const fs = findingsFor(s, p, computeFacts(s, p), computeLanes(s, p, computeFacts(s, p)), [])
  expect(rules(fs)).toEqual([])
})

// HK-007
test('a yes row that waits only on a closed row gets no land-now-yes warning', () => {
  expect(rules(run({ b: ['| Whenever an agent picks it up. | — |', '| Whenever an agent picks it up. | B-004 |'] }))).toEqual([])
})

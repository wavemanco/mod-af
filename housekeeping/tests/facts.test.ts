import { expect, test } from 'claude-code/testing'
import { parseSettings } from '../hooks/core/settings.ts'
import { parseFiles } from '../hooks/core/parse.ts'
import { computeFacts } from '../hooks/core/facts.ts'
import { backlog, playbook, settings } from './fixtures/small.ts'

const s = parseSettings(settings).settings!
const facts = (b = backlog, p = playbook) => computeFacts(s, parseFiles(s, { backlog: b, playbook: p }))

test('partition', () => {
  const c = facts().counts
  expect([c.all, c.closed, c.open, c.yes, c.choice, c.no]).toEqual([8, 2, 6, 2, 1, 3])
  expect([c.needYou, c.waitsOnRow, c.noMilestone, c.queue]).toEqual([3, 1, 2, 4])
  expect([c.perFile.backlog.open, c.perFile.playbook.open]).toEqual([4, 2])
  expect([c.perFile.backlog.closed, c.perFile.playbook.closed]).toEqual([1, 1])
})

test('unlocks is the inverse of Waits on', () => {
  const f = facts()
  expect(f.unlocks['PB-01']).toEqual(['B-002'])
  expect(f.opens['PB-01']).toBe(1)
  expect(f.before['B-002']).toEqual(['PB-01'])
})

test('queue order', () => {
  expect(facts().queue).toEqual(['PB-01', 'B-002', 'B-003', 'PB-03'])
})

test('landNow', () => {
  expect(facts().landNow).toEqual(['B-001', 'B-005'])
})

test('a door opens when its rows close', () => {
  const f = facts(backlog.replace('| PB-01 | **Why:** asked', '| B-004 | **Why:** asked'))
  expect(f.closedIds.sort()).toEqual(['B-004', 'PB-02'])
  expect(f.doors).toEqual(['B-002'])
})

test('a duty leaves Land now', () => {
  const f = facts(backlog.replace('Whenever an agent picks it up.', 'Every 30 days.'))
  expect(f.duties).toEqual(['B-005'])
  expect(f.landNow).toEqual(['B-001'])
  expect(f.counts.yes).toBe(2)
})

test('cycles terminate', () => {
  const f = facts(backlog, playbook.replace('ready. | — |', 'ready. | B-002 |'))
  expect(f.opens['PB-01']).toBe(1)
  expect(f.opens['B-002']).toBe(1)
})

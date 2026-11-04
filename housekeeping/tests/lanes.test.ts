import { expect, test } from 'claude-code/testing'
import { parseSettings } from '../hooks/core/settings.ts'
import { parseFiles } from '../hooks/core/parse.ts'
import { computeFacts } from '../hooks/core/facts.ts'
import { computeLanes } from '../hooks/core/lanes.ts'
import * as small from './fixtures/small.ts'
import * as paths from './fixtures/paths.ts'

const lanes = (fx: { settings: string; playbook: string }, backlog: string) => {
  const s = parseSettings(fx.settings).settings!
  const p = parseFiles(s, { backlog, playbook: fx.playbook })
  return computeLanes(s, p, computeFacts(s, p))
}
const host = (ls: ReturnType<typeof lanes>) => ls.find(l => l.path === 'host')!

test('one lane per path, shared first', () => {
  const ls = lanes(paths, paths.backlog())
  expect(ls.map(l => l.path)).toEqual(['host', 'school', 'solo'])
  for (const l of ls) {
    expect(l.stations[0].milestone).toBe('core-ready')
    expect(l.stations[0].stops).toEqual(['C-001', 'C-002'])
  }
})

test('chain and gate', () => {
  const st = host(lanes(paths, paths.backlog())).stations[1]
  expect([st.milestone, st.stops, st.chain, st.gate]).toEqual(['host-beta', ['L-001', 'H-001'], 3, 'C-001'])
})

test('next', () => {
  for (const l of lanes(paths, paths.backlog())) expect(l.next).toBe('core-ready')
  expect(host(lanes(paths, paths.backlog(['C-001', 'C-002']))).next).toBe('host-beta')
})

test('small fixture', () => {
  const ls = lanes(small, small.backlog)
  expect(ls.map(l => l.path)).toEqual(['product'])
  expect(ls[0].stations.map(s => s.stops)).toEqual([['B-001', 'PB-01', 'B-002'], ['B-003', 'B-002']])
})

test('a self-wait and a cycle terminate', () => {
  for (const over of [{ 'H-001': 'H-001' }, { 'C-001': 'C-002' }]) {
    const st = host(lanes(paths, paths.backlog([], over))).stations
    for (const s of st) expect(Number.isFinite(s.chain)).toBe(true)
  }
})

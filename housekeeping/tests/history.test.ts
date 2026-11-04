import { expect, test } from 'claude-code/testing'
import { parseSettings } from '../hooks/core/settings.ts'
import { parseFiles } from '../hooks/core/parse.ts'
import { computeFacts } from '../hooks/core/facts.ts'
import { computeLanes } from '../hooks/core/lanes.ts'
import { findingsFor } from '../hooks/core/findings.ts'
import { historyFrom, logArgs, parseLog, showArgs, snapshot } from '../hooks/core/history.ts'
import * as small from './fixtures/small.ts'

const s = parseSettings(small.settings).settings!
const line = (text: string, id: string) => text.split('\n').find(l => l.startsWith(`| ${id} `))!
const without = (text: string, id: string) => text.replace(line(text, id) + '\n', '')

const b2 = without(small.backlog, 'B-001').replace('| Closed |\n', '| Closed |\n| Rate-limit the export (B-001) | 2026-09-11 | Closed |\n')
const pb03 = line(small.playbook, 'PB-03')
const files1 = { backlog: small.backlog, playbook: small.playbook }
const files2 = { backlog: b2, playbook: small.playbook }
const files3 = { backlog: b2.replace(line(b2, 'B-005') + '\n', line(b2, 'B-005') + '\n' + pb03 + '\n'), playbook: without(small.playbook, 'PB-03') }
const info = (n: number) => ({ sha: `abcdef${n}0123456789`, date: `2026-09-0${n}`, subject: `c${n}` })
const snaps = [files1, files2, files3].map((f, i) => ({ ...snapshot(s, f), ...info(i + 1) }))

test('the git arguments', () => {
  expect(logArgs(s)).toEqual(['git', 'log', '--reverse', '--format=%H%x09%cs%x09%s', 'main', '--', 'backlog.md', 'playbook.md'])
  expect(showArgs('abc', 'backlog.md')).toEqual(['git', 'show', 'abc:backlog.md'])
})

test('parseLog reads one entry per line', () => {
  expect(parseLog('abc\t2026-11-01\tfirst\ndef\t2026-11-02\tsecond\n')).toEqual([
    { sha: 'abc', date: '2026-11-01', subject: 'first' }, { sha: 'def', date: '2026-11-02', subject: 'second' }])
})

test('deltas between snapshots', () => {
  const h = historyFrom(snaps)
  expect(h[1].closed).toEqual(['B-001'])
  expect(h[2].moved).toEqual(['PB-03'])
  expect(h[0].sha).toBe('abcdef1')
})

test('the first entry opens everything open', () => {
  expect(historyFrom(snaps)[0].opened).toHaveLength(6)
})

test('gone and where-we-are changes', () => {
  const a = snapshot(s, files1)
  const b = { ...a, open: { ...a.open }, whereWeAre: 'new' }
  delete b.open['B-003']
  const h = historyFrom([{ ...a, ...info(1) }, { ...b, ...info(2) }])
  expect(h[1].gone).toEqual(['B-003'])
  expect(h[1].whereWeAre).toBe(true)
})

test('a stale where we are is a warning', () => {
  const stale = (h: ReturnType<typeof historyFrom>) => {
    const f = { ...files1, backlog: files1.backlog.replace('1. Ship the export', '1. 2026-09-01 Ship the export') }
    const p = parseFiles(s, f), facts = computeFacts(s, p)
    return findingsFor(s, p, facts, computeLanes(s, p, facts), h).filter(x => x.rule === 'where-we-are')
  }
  const e = { sha: 'a', date: '2026-09-05', subject: 's', opened: [], closed: ['B-001'], moved: [], gone: [], whereWeAre: false }
  expect(stale([e])).toHaveLength(1)
  expect(stale([{ ...e, date: '2026-09-01' }])).toEqual([])
})

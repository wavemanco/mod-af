import { expect, test } from 'claude-code/testing'
import { parseSettings } from '../hooks/core/settings.ts'
import { build } from '../hooks/core/index.ts'
import type { BuildInput } from '../hooks/core/types.ts'
import * as small from './fixtures/small.ts'

const settings = parseSettings(small.settings).settings!
const input = (over: Partial<BuildInput['files']> = {}): BuildInput => ({
  settings, files: { backlog: small.backlog, playbook: small.playbook, ...over },
  head: { sha: 'abcdef0123456789', date: '2026-09-12', subject: 'head' }, snapshots: [],
})

test('same input, same page', () => {
  const a = build(input()), b = build(input())
  expect(a.html).not.toBeNull()
  expect(a.html).toBe(b.html)
})

test('partition line', () => {
  expect(build(input()).partition).toBe(
    '8 rows in all = 2 closed + 6 open; open = 2 land now + 1 small choice + 3 not now; 4 open in the backlog, 2 in the playbook')
})

test('privacy blocks the page', () => {
  const b = small.backlog.replace('one client can exhaust it', 'ask jane.doe@gmail.com')
  const o = build(input({ backlog: b }))
  expect(o.html).toBeNull()
  expect(o.findings.some(f => f.level === 'error' && f.rule === 'privacy' && f.message.includes('B-001'))).toBe(true)
})

test('missing playbook blocks the page', () => {
  const o = build(input({ playbook: null }))
  expect(o.html).toBeNull()
  expect(o.findings.some(f => f.level === 'error' && f.rule === 'file')).toBe(true)
})

import { expect, test } from 'claude-code/testing'
import { brief } from '../hooks/core/brief.ts'
import type { PageData } from '../hooks/core/types.ts'
import { once, SMALL, smallData } from './fixtures/page-data.ts'
import * as small from './fixtures/small.ts'

test('the short view on the small fixture', () => {
  const t = brief(SMALL, {})
  expect(t).toContain('product: next beta, 3 stops')
  expect(t).toContain('B-001')
  const needs = t.slice(t.indexOf('Needs you:'))
  expect(needs.indexOf('PB-01')).toBeGreaterThan(-1)
  expect(needs.indexOf('PB-01')).toBeLessThan(needs.indexOf('B-003'))
  expect(t.length).toBeLessThanOrEqual(8000)
})

test('a duty is due by its last-done date and interval', () => {
  const b = once(small.backlog, '| Whenever an agent picks it up. | — | **Why:** slow builds. |',
    '| Every 30 days. | — | **Why:** slow builds. Last done: 2026-10-01 |')
  const d = smallData(b)
  const duties = (today: string) => brief(d, { today }).split('\n').filter(l => l.startsWith('Duties due:')).join('')
  expect(duties('2026-11-03')).toContain('B-005')
  expect(duties('2026-10-15')).not.toContain('B-005')
  expect(brief(d, {})).not.toContain('Duties due:')
})

test('a hit in the short view is masked, not blocked', () => {
  const t = brief({ ...SMALL, project: 'ask jane.doe@gmail.com' }, {})
  expect(t.includes('jane.doe@gmail.com')).toBe(false)
  expect(t).toContain('ask ja**************om')
})

test('branch and remote notes', () => {
  const t = brief(SMALL, { branch: 'feature/x', behindRemote: 3 })
  expect(t).toContain('On branch feature/x; the map shows main.')
  expect(t).toContain('Local main is 3 commits behind its remote copy.')
  expect(brief(SMALL, { branch: 'main' })).not.toContain('On branch')
})

test('a huge where-we-are text keeps the brief within 8,000 characters', () => {
  const d: PageData = { ...SMALL, whereWeAre: { file: 'backlog', line: 1, text: 'word '.repeat(10000), date: null } }
  expect(brief(d, {}).length).toBeLessThanOrEqual(8000)
  const long = { ...SMALL, project: 'x'.repeat(9000) }
  const t = brief(long, {})
  expect(t.length).toBe(8000)
  expect(t.endsWith('…')).toBe(true)
})

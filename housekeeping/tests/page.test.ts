import { expect, test } from 'claude-code/testing'
import { renderPage } from '../hooks/core/page.ts'
import { TEMPLATE } from '../hooks/core/template.ts'
import type { PageData } from '../hooks/core/types.ts'
import { once, SMALL, smallData } from './fixtures/page-data.ts'
import * as small from './fixtures/small.ts'

// The page's script runs on the stub DOM in node-tests/page.spec.ts: this kit runs no code from strings.
const ascii = (t: string) => /^[\x00-\x7f]*$/.test(t)
const dataLine = (html: string) => /^window\.DATA = (.*);$/m.exec(html)

test('fills the placeholder once', () => {
  const html = renderPage(SMALL)
  expect(html.split('window.DATA = {').length).toBe(2)
  expect(ascii(TEMPLATE)).toBe(true)
  expect(ascii(html)).toBe(true)
  expect(html.split('</script>').length).toBe(TEMPLATE.split('</script>').length)
})

test('hostile cells survive', () => {
  const hostile = String.raw`</script><script>alert(1)</script> $& $1 \| caf` + '\u00e9'
  const d = smallData(once(small.backlog, String.raw`**Why:** one client can exhaust it (a \| b).`, hostile))
  const html = renderPage(d)
  expect(html.split('</script>').length).toBe(TEMPLATE.split('</script>').length)
  expect(ascii(html)).toBe(true)
  const line = dataLine(html)
  expect(line).not.toBe(null)
  const back = (JSON.parse(line![1]) as PageData).rows.find(r => r.id === 'B-001')!.details
  expect(back).toBe('</script><script>alert(1)</script> $& $1 | caf\u00e9')
  expect(back).toBe(d.rows.find(r => r.id === 'B-001')!.details)
})

test('throws on a bad template', () => {
  for (const t of ['no placeholder', 'window.DATA = /*DATA*/null; /*DATA*/null']) {
    let threw = false
    try { renderPage(SMALL, t) } catch { threw = true }
    expect(threw).toBe(true)
  }
})

test('closed rows carry no Details', () => {
  expect(SMALL.done).toHaveLength(2)
  for (const e of SMALL.done) expect(Object.keys(e).sort()).toEqual(['file', 'ids', 'item', 'landed', 'milestone'])
})

test('pageData derives the queue, defaults, duties, first seen and history', () => {
  let b = once(small.backlog, '| **Why:** two candidates. |', '| **Why:** two candidates.<br>**Default until decided:** keep the current library |')
  b = once(b, '| Whenever an agent picks it up. | — | **Why:** slow builds. |', '| Every 30 days. | — | **Why:** slow builds. Last done: 2026-10-01 |')
  const d = smallData(b)
  expect([d.project, d.commit, d.date]).toEqual(['Small', '2222222', '2026-09-02'])
  expect(d.queue).toEqual([
    { id: 'PB-01', before: 'beta', paths: ['product'], holdsUp: 1 },
    { id: 'B-002', before: 'beta', paths: ['product'], holdsUp: 0 },
    { id: 'B-003', before: 'launch', paths: ['product'], holdsUp: 0 },
    { id: 'PB-03', before: null, paths: [], holdsUp: 0 }])
  const row = (id: string) => d.rows.find(r => r.id === id)!
  expect(row('B-003').defaultUntilDecided).toBe('keep the current library')
  expect(row('B-001').defaultUntilDecided).toBe(null)
  expect(d.duties).toEqual([{ id: 'B-005', trigger: 'Every 30 days.', lastDone: '2026-10-01' }])
  expect(row('B-005').firstSeen).toEqual({ sha: '2222222', date: '2026-09-02', subject: 'step 2' })
  expect(row('B-001').firstSeen).toEqual({ sha: '1111111', date: '2026-09-01', subject: 'step 1' })
  expect([row('PB-01').unlocks, row('PB-01').opens, row('PB-01').landNow]).toEqual([['B-002'], 1, 'no'])
  expect(d.history.map(h => h.subject)).toEqual(['step 2', 'step 1'])
})

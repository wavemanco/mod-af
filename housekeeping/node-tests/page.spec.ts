// The page's own script, run on the stub DOM. It runs under Node (node --test), not the plugin test kit:
// the kit's runtime allows no code from strings, and the page's script is text in the template.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderPage } from '../hooks/core/page.ts'
import { all, attr, clickAll, fire, memoryStorage, runPage } from '../tests/stub-dom.ts'
import { PATHS, SMALL } from '../tests/fixtures/page-data.ts'

test('the script draws every view', () => {
  for (const d of [SMALL, PATHS]) {
    const { errors, views, opened } = clickAll(renderPage(d))
    assert.deepEqual(errors, [])
    const tabs = [...views.keys()]
    for (const v of ['lanes', 'since', 'land', 'queue', 'doors', 'checklists']) assert.ok(tabs.includes(`tab-${v}`), `no tab-${v} in ${tabs}`)
    assert.equal(tabs.includes('tab-warnings'), d.findings.length > 0)
    // every open row opens from some view
    assert.deepEqual([...opened].sort(), d.rows.map(r => r.id).sort())
  }
  assert.ok(PATHS.findings.length > 0)
  const lanes = clickAll(renderPage(PATHS)).views.get('tab-lanes') ?? []
  assert.equal(lanes.filter(e => attr(e, 'class') === 'lane').length, 3)
})

test('Changed since keeps the chosen commit', () => {
  const html = renderPage(PATHS), store = memoryStorage()
  const since = (choose?: string) => {
    const pg = runPage(html, store)
    const tab = pg.el('tabs')?.children.find(t => attr(t, 'id') === 'tab-since')
    assert.ok(tab, 'no tab-since')
    fire(tab, 'click')
    const sel = () => all(pg.el('views')!).find(e => attr(e, 'aria-label') === 'Changed since commit')!
    if (choose) fire(sel(), 'change', { target: { value: choose } })
    return { chosen: sel().children.filter(o => attr(o, 'selected') !== undefined).map(o => attr(o, 'value')),
      text: pg.el('views')!.textContent }
  }
  const first = since()
  assert.deepEqual(first.chosen, ['1111111'])
  assert.ok(first.text.includes('C-001 (closed)'))
  assert.ok(since('2222222').text.includes('Nothing changed after this commit'))
  assert.deepEqual(since().chosen, ['2222222'])
})

// The page's own script, run on the stub DOM. It runs under Node (node --test), not the plugin test kit:
// the kit's runtime allows no code from strings, and the page's script is text in the template.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderPage } from '../hooks/core/page.ts'
import { all, attr, clickAll, fire, memoryStorage, runPage } from '../tests/stub-dom.ts'
import { PATHS, SMALL } from '../tests/fixtures/page-data.ts'
import type { PageData } from '../hooks/core/types.ts'

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

// Opens the page, shows Changed since, and picks a commit if asked: the chosen option and the view's text.
const since = (d: PageData, store: ReturnType<typeof memoryStorage>, choose?: string) => {
  const pg = runPage(renderPage(d), store)
  const tab = pg.el('tabs')?.children.find(t => attr(t, 'id') === 'tab-since')
  assert.ok(tab, 'no tab-since')
  fire(tab, 'click')
  const sel = () => all(pg.el('views')!).find(e => attr(e, 'aria-label') === 'Changed since commit')!
  if (choose) fire(sel(), 'change', { target: { value: choose } })
  return { chosen: sel().children.filter(o => attr(o, 'selected') !== undefined).map(o => attr(o, 'value')),
    text: pg.el('views')!.textContent }
}

// DESIGN 3.5: by default the last commit this viewer saw; with none, ten commits back (the controller's ruling)
test('Changed since opens on the last commit this viewer saw, and a pick changes only the view', () => {
  const store = memoryStorage()
  const first = since(PATHS, store)
  assert.deepEqual(first.chosen, ['1111111']) // nothing stored and fewer than ten: the oldest
  assert.ok(first.text.includes('C-001 (closed)'))
  assert.equal(store.getItem('housekeeping.since.Paths'), '2222222') // the newest, as seen
  const second = since(PATHS, store)
  assert.deepEqual(second.chosen, ['2222222'])
  assert.ok(second.text.includes('Nothing changed after this commit'))
  assert.ok(since(PATHS, store, '1111111').text.includes('C-001 (closed)'))
  assert.equal(store.getItem('housekeeping.since.Paths'), '2222222')
  assert.deepEqual(since(PATHS, store).chosen, ['2222222'])
})

test('with nothing stored, Changed since starts ten commits back', () => {
  const entry = (i: number) => ({ ...PATHS.history[0], sha: `c${i}`, subject: `commit ${i}` })
  const many = { ...PATHS, history: Array.from({ length: 12 }, (_, i) => entry(i)) }
  assert.deepEqual(since(many, memoryStorage()).chosen, ['c10'])
  assert.match(since(many, memoryStorage()).text, /In the 10 commits after c10/)
})

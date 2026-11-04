// The page's own script, run on the stub DOM. It runs under Node (node --test), not the plugin test kit:
// the kit's runtime allows no code from strings, and the page's script is text in the template.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderPage } from '../hooks/core/page.ts'
import { all, attr, clickAll, El, fire, memoryStorage, runPage, S, throwingStorage } from '../tests/stub-dom.ts'
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

// The reference page was about 36,000 px tall: every stop of every station, and all of a 4,000-character where-we-are.
const text = (e: El) => e.textContent
const BIG: PageData = (() => {
  const base = SMALL.rows.find(r => r.id === 'B-001')!
  const extra = Array.from({ length: 30 }, (_, i) => ({ ...base, id: `S-${String(i + 1).padStart(2, '0')}`, waitsOn: [], unlocks: [] }))
  const lane = SMALL.lanes[0]
  return { ...SMALL, rows: [...SMALL.rows, ...extra],
    whereWeAre: { ...SMALL.whereWeAre!, text: 'word '.repeat(800) + 'END' },
    lanes: [{ ...lane, stations: [{ ...lane.stations[0], stops: extra.map(r => r.id) }, ...lane.stations.slice(1)] }] }
})()

test('a station of 30 stops shows its first 5, and an "and 25 more" control opens the rest', () => {
  const { errors, opened } = clickAll(renderPage(BIG))
  assert.deepEqual(errors, [])
  assert.ok(opened.has('S-30')) // every stop is still there to open
  const pg = runPage(renderPage(BIG))
  const view = all(pg.el('views')!)
  const [shown, rest] = view.filter(e => attr(e, 'class') === 'stops')
  assert.equal(shown.children.length, 5)
  assert.equal(rest.children.length, 25)
  assert.equal(rest.hidden, true)
  const more = view.find(e => e[S].tag === 'button' && text(e) === 'and 25 more')
  assert.ok(more, 'no "and 25 more" control')
  fire(more, 'click')
  assert.equal(rest.hidden, false)
  assert.equal(attr(more, 'aria-expanded'), 'true')
  fire(more, 'click')
  assert.equal(rest.hidden, true)
  assert.equal(text(more), 'and 25 more')
})

test('a long where-we-are is cut at a word near 600 characters, with a "more" toggle', () => {
  const pg = runPage(renderPage(BIG))
  const where = all(pg.el('views')!).find(e => attr(e, 'class') === 'card where')!
  const [, short, full] = where.children
  assert.ok(!short.hidden && full.hidden)
  assert.ok(text(short).length <= 610 && text(short).length > 500, String(text(short).length))
  assert.ok(!text(short).includes('END') && /word …$/.test(text(short)))
  const more = where.children.find(e => e[S].tag === 'button' && text(e) === 'more')!
  fire(more, 'click')
  assert.ok(short.hidden && !full.hidden && text(full).endsWith('END'))
  // a short one is shown whole, with no toggle
  const small = all(runPage(renderPage(SMALL)).el('views')!).find(e => attr(e, 'class') === 'card where')!
  assert.equal(small.children.filter(e => e[S].tag === 'button').length, 0)
})

test('a counts line under the title links each number to its view', () => {
  const pg = runPage(renderPage(SMALL))
  const counts = pg.el('counts')!.children
  assert.deepEqual(counts.map(text), [`${SMALL.counts.open} open`, `${SMALL.counts.yes} land now`, `${SMALL.counts.choice} small choice`,
    `${SMALL.counts.needYou} need you`, `${SMALL.doors.length} doors just opened`])
  const tab = () => pg.el('tabs')!.children.find(t => attr(t, 'aria-selected') === 'true')!
  assert.deepEqual(counts.map(c => { fire(c, 'click'); return attr(tab(), 'id') }), ['tab-lanes', 'tab-land', 'tab-queue', 'tab-queue', 'tab-doors'])
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

// The Light / Dark / System switch.
const theme = (store = memoryStorage()) => {
  const pg = runPage(renderPage(SMALL), store)
  return { pg, store, theme: () => attr(pg.root, 'data-theme'), pressed: (m: string) => attr(pg.el(`theme-${m}`)!, 'aria-pressed') }
}

test('choosing Dark or Light sets data-theme on the root, System removes it, and the choice is stored', () => {
  const t = theme()
  assert.equal(t.theme(), undefined)
  assert.equal(t.pressed('system'), 'true')
  fire(t.pg.el('theme-dark')!, 'click')
  assert.equal(t.theme(), 'dark')
  assert.equal(t.store.getItem('housekeeping.theme'), 'dark')
  assert.deepEqual(['system', 'light', 'dark'].map(t.pressed), ['false', 'false', 'true'])
  fire(t.pg.el('theme-light')!, 'click')
  assert.equal(t.theme(), 'light')
  fire(t.pg.el('theme-system')!, 'click')
  assert.equal(t.theme(), undefined)
  assert.equal(t.pressed('system'), 'true')
})

test('a stored theme is applied on load', () => {
  const store = memoryStorage()
  store.setItem('housekeeping.theme', 'dark')
  const t = theme(store)
  assert.equal(t.theme(), 'dark')
  assert.equal(t.pressed('dark'), 'true')
})

test('with a storage that throws, the page still draws and the switch still works', () => {
  const t = theme(throwingStorage)
  assert.ok(all(t.pg.el('views')!).length > 0)
  fire(t.pg.el('theme-dark')!, 'click')
  assert.equal(t.theme(), 'dark')
  fire(t.pg.el('theme-system')!, 'click')
  assert.equal(t.theme(), undefined)
})

test('the switch buttons are real buttons and Light overrides a dark system', () => {
  const html = renderPage(SMALL)
  for (const m of ['system', 'light', 'dark']) assert.match(html, new RegExp(`<button type="button" id="theme-${m}" aria-pressed=`))
  assert.match(html, /:root:not\(\[data-theme="light"\]\)/)
})

import { expect, test } from 'claude-code/testing'
import { EXAMPLE_FILES, EXAMPLE_MODEL } from '../hooks/example.ts'
import { render, sealState, type Rendered } from '../hooks/render.ts'
import { check, type Analysis } from '../hooks/spec.ts'
import { textWidth } from '../hooks/text.ts'
import { SECTIONS } from '../hooks/fields.ts'

// Renderer fixes, each pinned through the real path: check() then render(), as the render tool calls them.

type Json = any

async function example(patch?: (m: Json) => void): Promise<Analysis> {
  const m = JSON.parse(JSON.stringify(EXAMPLE_MODEL))
  if (patch) patch(m)
  const files = EXAMPLE_FILES as Record<string, string>
  return check(JSON.stringify(m), '/w/model.json', { read: async p => { const t = files[p.replace('/w/src/', '')]; return t === undefined ? { failed: 'File does not exist.' } : { text: t } } })
}

/** A small model whose observed parts each cite a line of one generated source file. */
async function probe(parts: { nodes: Json[]; flows?: Json[]; links?: Json[]; figures?: Json[]; emphasis?: Json; loops?: Json[] }): Promise<Analysis> {
  const src: string[] = []
  const cite = (x: Json) => {
    x.status ??= 'observed'
    if (x.status === 'observed') { src.push(`element ${x.id} is real`); x.evidence = [{ path: 'src.txt', lines: String(src.length), quote: src[src.length - 1] }] }
    else x.claim ??= `assumed for ${x.id}`
  }
  const nodes = parts.nodes.map(n => ({ ...n }))
  const flows = (parts.flows ?? []).map(f => ({ ...f }))
  const links = (parts.links ?? []).map(l => ({ mechanism: 'reads it', ...l }))
  for (const n of nodes) if (n.kind === 'cloud') n.why_outside ??= 'outside the question'; else if (n.kind !== 'shadow') cite(n)
  for (const x of [...flows, ...links]) cite(x)
  const m = {
    spec: 'dynamics/1', title: 'Probe', subject: { name: 'probe', kind: 'codebase', roots: { code: './src' }, date: '2026-10-22' },
    question: 'What happens?', answer: { text: 'Something.', loops: [] }, time_unit: 'day', boundary: { excluded: [] },
    figures: parts.figures ?? [{ id: 'f1', title: 'Figure one', question: 'Q one?' }], nodes, flows, links, loops: parts.loops ?? [],
    ...(parts.emphasis ? { emphasis: parts.emphasis } : {}),
  }
  const a = await check(JSON.stringify(m), '/m/model.json', { read: async p => (p === '/m/src/src.txt' ? { text: src.join('\n') } : { failed: 'File does not exist.' }) })
  expect(a.report.errors).toEqual([])
  return a
}

/** The page's detail-panel data, parsed the way the page's own script parses it. */
const infoOf = (html: string): Json => JSON.parse(/<script type="application\/json" id="sf-info">([\s\S]*?)<\/script>/.exec(html)![1])
const groupOf = (html: string, id: string): string => new RegExp(`<g [^>]*data-id="${id}"[\\s\\S]*?</g>`).exec(html)![0]
const sectionOf = (html: string, fig: string): string => new RegExp(`<section data-fig="${fig}"[\\s\\S]*?</section>`).exec(html)![0]
/** Legend entries as [swatch, text]: one .key per line. */
function keys(html: string): { swatch: string; text: string }[] {
  const legend = /<div class="legend">([\s\S]*?)\n<\/div>\n<\/section>/.exec(html)![1]
  return [...legend.matchAll(/<div class="key">(<svg[\s\S]*?<\/svg>)<div>([\s\S]*?)<\/div><\/div>/g)].map(k => ({ swatch: k[1], text: k[2] }))
}
const num = (s: string) => Number(s)
const near = (a: number, b: number, within = 0.5) => expect(Math.abs(a - b)).toBeLessThan(within)
type P = { x: number; y: number }
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)
/** Geometry of one drawn flow: pipe start, valve centre, arrowhead tip and base, and its cross if any. */
function flowGeometry(g: string) {
  const start = /class="pipe-outer" d="M([-\d.]+),([-\d.]+)/.exec(g)!
  const pipe = /class="pipe-outer" d="([^"]*)"/.exec(g)![1]
  const valve = /class="valve-shape" d="M[^"]*? L[^"]*? L([-\d.]+),([-\d.]+)/.exec(g)!
  const head = /class="pipe-head" points="([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+)"/.exec(g)!
  const x = /class="miss-x" d="M([-\d.]+),([-\d.]+)/.exec(g)
  const tip = { x: num(head[1]), y: num(head[2]) }
  const base = { x: (num(head[3]) + num(head[5])) / 2, y: (num(head[4]) + num(head[6])) / 2 }
  return {
    corners: pipe.split(' L').length - 1, start: { x: num(start[1]), y: num(start[2]) }, valve: { x: num(valve[1]), y: num(valve[2]) },
    tip, base, cross: x ? { x: num(x[1]) + 6, y: num(x[2]) + 6 } : undefined,
  }
}

/** The worked example three times over: each copy's ids suffixed, its rows moved down, its loops renumbered. */
function tripled(): Json {
  const m = JSON.parse(JSON.stringify(EXAMPLE_MODEL))
  const detail = 'Shown when selected: what this element means for the queue, where it is read in the code, and what changes it, in one or two sentences.'
  const out = { ...m, nodes: [] as Json[], flows: [] as Json[], links: [] as Json[], loops: [] as Json[] }
  let r = 0
  let b = 0
  for (let k = 0; k < 3; k++) {
    const id = (s: string) => (k ? `${s}_${k + 1}` : s)
    const isId = new Set([...m.nodes, ...m.flows, ...m.links].map((x: Json) => x.id))
    for (const n of m.nodes) out.nodes.push({ ...n, id: id(n.id), at: [n.at[0], n.at[1] + 3.5 * k], ...(n.of ? { of: id(n.of) } : {}), ...(n.kind !== 'cloud' && n.kind !== 'shadow' ? { detail } : {}) })
    for (const f of m.flows) out.flows.push({ ...f, id: id(f.id), from: id(f.from), to: id(f.to), detail })
    for (const l of m.links) out.links.push({ ...l, id: id(l.id), from: id(l.from), to: id(l.to), detail })
    for (const lp of m.loops) out.loops.push({ ...lp, id: lp.id.startsWith('R') ? `R${++r}` : `B${++b}`, path: lp.path.map(id), ...(lp.goal && isId.has(lp.goal) ? { goal: id(lp.goal) } : {}) })
  }
  return out
}

// ------------------------------------------------------------------- I3-01: the page reads back in pages

test('no line of the page is over 4000 characters, for the example and a model three times its size', { timeoutMs: 30_000 }, async () => {
  const one = render(await example())
  const big = await example(m => Object.assign(m, tripled()))
  expect(big.report.errors).toEqual([])
  const three = render(big)
  expect(three.html.length).toBeGreaterThan(2.4 * one.html.length)
  for (const page of [one, three]) {
    expect(Math.max(...page.html.split('\n').map(l => l.length))).toBeLessThanOrEqual(4000)
    expect(sealState(page.html)).toBe('intact')
    expect(page.layout.filter(i => i.level === 'error')).toEqual([])
  }
})

/**
 * A model near the checker's limits: five figures of 39 elements (380 in all), each with one balancing
 * loop through 34 variables, a third of them modelled; every element in one component. So the boundary
 * and component rows list the whole model, and each loop's trace and hedge list a whole figure.
 */
function nearTheLimits(): Parameters<typeof probe>[0] {
  const parts = { figures: [] as Json[], nodes: [] as Json[], flows: [] as Json[], links: [] as Json[], loops: [] as Json[] }
  for (let k = 0; k < 5; k++) {
    const g = `g${k}`
    const p = (s: string) => `${s}_${k}`
    const part = { component: 'the scheduling service' }
    parts.figures.push({ id: g, title: `Stage ${k}`, question: 'What holds work back?' })
    parts.nodes.push({ id: p('cin'), kind: 'cloud', figure: g, at: [0, 4] }, { id: p('cout'), kind: 'cloud', figure: g, at: [10, 4] },
      { id: p('S1'), kind: 'stock', figure: g, at: [3, 4], label: 'Pending work items', units: 'items', ...part },
      { id: p('S2'), kind: 'stock', figure: g, at: [7, 4], label: 'Work in progress', units: 'items', ...part })
    parts.flows.push({ id: p('F0'), from: p('cin'), to: p('S1'), label: 'arriving', units: 'items/day' },
      { id: p('F1'), from: p('S1'), to: p('S2'), label: 'started', units: 'items/day' }, { id: p('F2'), from: p('S2'), to: p('cout'), label: 'finished', units: 'items/day' })
    // a ring of variables above the stocks: S1 → a0 → … → a33 → F1
    for (let i = 0; i < 34; i++) {
      const t = (i / 33) * Math.PI
      parts.nodes.push({ id: p(`a${i}`), kind: 'aux', figure: g, at: [Math.round((5 - 4.6 * Math.cos(t)) * 2) / 2, Math.round((4 - 3.6 * Math.sin(t)) * 2) / 2 + (i % 2) * 0.3],
        label: `pressure signal ${i} read by the scheduler`, ...part, ...(i % 3 ? {} : { status: 'modelled', claim: `the scheduler reads signal ${i}` }) })
      parts.links.push({ id: p(`l${i}`), from: i ? p(`a${i - 1}`) : p('S1'), to: p(`a${i}`), polarity: '+' })
    }
    parts.links.push({ id: p('lz'), from: p('a33'), to: p('F1'), polarity: '+' })
    parts.loops.push({ id: `B${k + 1}`, name: `Pressure ${k}`, path: [p('S1'), ...Array.from({ length: 34 }, (_, i) => p(`a${i}`)), p('F1')], story: 'More pressure, less work held.' })
  }
  return parts
}

test('near the checker\'s limits no line is over 4000 characters, and the long rows read as before', { timeoutMs: 30_000 }, async () => {
  const a = await probe(nearTheLimits())
  expect(a.model!.nodes.length + a.model!.flows.length + a.model!.links.length).toBe(380)
  const page = render(a)
  const lines = page.html.split('\n')
  expect(Math.max(...lines.map(l => l.length))).toBeLessThan(4000)
  // what a browser shows: tags dropped, each run of whitespace one space
  const shown = (h: string) => h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim()
  const said = page.readerView.split('\n')
  const rows = [...page.html.matchAll(/<tr><th>([^<]*)<\/th><td>([\s\S]*?)<\/td><\/tr>/g)]
  for (const name of ['Inside the feedback (driven by the stocks)', 'Inputs from outside', 'Sources and sinks', 'Left out on purpose', 'the scheduling service']) {
    const row = rows.find(r => r[1] === name)!
    expect(said).toContain(`${name}: ${shown(row[2])}`)
  }
  expect(shown(rows.find(r => r[1] === 'Inside the feedback (driven by the stocks)')![2]).length).toBeGreaterThan(4000)
  // a loop's trace and hedge: one step or clause a line, shown as the reader view says them
  for (const k of ['trace', 'hedge']) {
    const divs = [...page.html.matchAll(new RegExp(`<div class="${k}">([\\s\\S]*?)</div>`, 'g'))].map(d => d[1])
    expect(divs.length).toBe(5)
    for (const d of divs) {
      expect(said.some(l => l.includes(shown(d)))).toBe(true)
      for (const l of d.split('\n')) expect(k === 'trace' ? l.split('→').length : l.split('; ').length).toBeLessThanOrEqual(2)
    }
  }
})

test('each SVG element, each block and each detail-panel entry sits on a line of its own', async () => {
  const page = render(await example()).html
  const lines = page.split('\n')
  // the panel data: "{", one "id":{…} entry per line, "}"
  const json = /<script type="application\/json" id="sf-info">\n([\s\S]*?)\n<\/script>/.exec(page)![1].split('\n')
  expect(json[0]).toBe('{')
  expect(json[json.length - 1]).toBe('}')
  const entries = json.slice(1, -1)
  expect(entries.length).toBe(Object.keys(infoOf(page)).length)
  for (const e of entries) expect(e).toMatch(/^"[^"]+":\{.*\},?$/)
  // inside a figure no line holds two drawn elements
  const svg = /<svg class="sd"[\s\S]*?<\/svg>/.exec(page)![0]
  for (const l of svg.split('\n')) expect((l.match(/<(path|polygon|rect|circle|line|text|g)\b/g) ?? []).length).toBeLessThanOrEqual(1)
  for (const tag of ['<section data-fig="f1" id="fig-f1">', '<div class="legend">', '<table>', '<footer>']) expect(lines).toContain(tag)
  expect(lines.filter(l => l.startsWith('<tr>')).length).toBeGreaterThan(20)
  expect(lines.filter(l => l.startsWith('<div class="key">')).length).toBe(render(await example()).legend.length)
})

// ----------------------------------------------------------------- I3-09: text after the seal is a change

test('a page with anything but whitespace after its seal reads as changed; only a page with no seal reads as none', async () => {
  const page = render(await example()).html
  expect(sealState(page)).toBe('intact')
  expect(sealState(`${page}\n  \n`)).toBe('intact')
  expect(sealState(`${page}\n<!-- formatted by hook -->\n`)).toBe('changed')
  expect(sealState(`${page}<p>x</p>`)).toBe('changed')
  expect(sealState(page.replace('</main>', '<p>notes</p></main>'))).toBe('changed')
  expect(sealState('<p>my notes</p>')).toBe('none')
})

// --------------------------------------------------- R3-01: G00 reads the drawn numbers, not the page text

test('model text with "NaN" or "Infinity" in it is drawn; a coordinate that is no number is G00', async () => {
  const a = await example(m => {
    m.nodes.find((n: Json) => n.id === 'dead').label = 'NaN-safe dead letters'
    m.flows.find((f: Json) => f.id === 'dropped').label = 'Infinity bound'
    m.links.find((l: Json) => l.id === 'busy_dispatch').label = 'NaN slots'
  })
  expect(a.report.errors).toEqual([])
  const page = render(a)
  expect(page.layout).toEqual([])
  expect(page.html).toContain('NaN-safe dead letters')
  expect(page.html).toContain('Infinity bound')
  // the checker refuses cells past 100; the guard stays as a defence for geometry that is no number, so
  // place the far node after the check: refused, and in finite time
  const far = await example()
  far.model!.nodes.find(n => n.id === 'dead')!.at = [1e306, 2.5]
  const g00 = render(far).layout.filter(i => i.level === 'error')
  expect(g00.map(i => `${i.code} ${i.where}`)).toEqual(['G00 figure "f1"'])
  // a cell far out but still a number is drawn, also in finite time
  const huge = await example()
  huge.model!.nodes.find(n => n.id === 'dead')!.at = [1e300, 2.5]
  expect(render(huge).layout.filter(i => i.level === 'error')).toEqual([])
  // and the checker itself keeps such cells out
  const refused = await example(m => { m.nodes.find((n: Json) => n.id === 'dead').at = [1e306, 2.5] })
  expect(refused.report.errors.map(i => i.code)).toEqual(['S01'])
})

// ---------------------- R3-02, R4-01, R5-01: a route is judged as drawn, its runs and its valve, against its ends

const twoStocks = (at: [number, number], flow: Json = {}) => probe({
  nodes: [{ id: 'A', kind: 'stock', figure: 'f1', at: [0, 0], label: 'Waiting' }, { id: 'B', kind: 'stock', figure: 'f1', at, label: 'Served' }],
  flows: [{ id: 'serve', from: 'A', to: 'B', label: 'served', ...flow }],
})
const pointsInto = (g: ReturnType<typeof flowGeometry>, c: P) => (g.tip.x - g.base.x) * (c.x - g.tip.x) + (g.tip.y - g.base.y) * (c.y - g.tip.y) > 0
const cell = (at: readonly number[]): P => ({ x: 80 + at[0] * 190, y: 80 + at[1] * 130 })
/** The reviewer's model: a stock draining to a cloud below and a little right, in a routine loop. */
const drain = (at: [number, number], route?: string) => probe({
  nodes: [
    { id: 'in', kind: 'cloud', figure: 'f1', at: [0, 0] }, { id: 'S', kind: 'stock', figure: 'f1', at: [1.5, 0], label: 'Open tickets', units: 'tickets' },
    { id: 'gone', kind: 'cloud', figure: 'f1', at }, { id: 'k', kind: 'constant', figure: 'f1', at: [3, 0], label: 'drop rate', value: 'two' },
  ],
  flows: [{ id: 'opened', from: 'in', to: 'S', label: 'opened', units: 'tickets/day' }, { id: 'dropped', from: 'S', to: 'gone', label: 'dropped', units: 'tickets/day', ...(route ? { route } : {}) }],
  links: [{ id: 'kd', from: 'k', to: 'dropped', polarity: '+' }, { id: 'sd', from: 'S', to: 'dropped', polarity: '+' }],
  loops: [{ id: 'B1', name: 'Tickets get dropped', path: ['S', 'dropped'], minor: true }],
})
/** A stock or a cloud, as the reviewer's harness draws them: a stock with a short label is 140 by 56, a cloud 50 by 30. */
const end = (id: string, kind: string, at: readonly number[]): Json => kind === 'stock'
  ? { id, kind, figure: 'f1', at, label: id === 'A' ? 'Open tickets' : 'Escalated tickets', units: 'tickets' } : { id, kind, figure: 'f1', at }
type Box = { x: number; y: number; w: number; h: number }
const endBox = (kind: string, at: readonly number[]): Box => {
  const c = cell(at)
  return kind === 'stock' ? { x: c.x - 70, y: c.y - 28, w: 140, h: 56 } : { x: c.x - 25, y: c.y - 15, w: 50, h: 30 }
}
/** One default flow A → B (or with the given fields), each end a stock or a cloud. */
const single = (ka: string, a: readonly number[], kb: string, b: readonly number[], flow: Json = {}) =>
  probe({ nodes: [end('A', ka, a), end('B', kb, b)], flows: [{ id: 'f', from: 'A', to: 'B', label: 'moved', units: 'tickets/day', ...flow }] })
/** A drawn pipe's points, from its start to its arrowhead's tip (the path itself stops 9 px short of the tip). */
function pipeOf(g: string): P[] {
  const pts = /class="pipe-outer" d="([^"]*)"/.exec(g)![1].replace(/[ML]/g, ' ').trim().split(/\s+/).map(s => { const [x, y] = s.split(',').map(Number); return { x, y } })
  const head = /class="pipe-head" points="([-\d.]+),([-\d.]+)/.exec(g)!
  pts[pts.length - 1] = { x: num(head[1]), y: num(head[2]) }
  return pts
}
const toBox = (p: P, r: Box) => Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h))
const onOutline = (p: P, r: Box) => toBox(p, r) < 0.8 && Math.min(Math.abs(p.x - r.x), Math.abs(p.x - r.x - r.w), Math.abs(p.y - r.y), Math.abs(p.y - r.y - r.h)) < 0.8
/** How long the runs after the first lie within 8 px of the source's box, in 1 px samples. */
function hugging(pts: P[], src: Box): number {
  let n = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const steps = Math.max(1, Math.ceil(dist(pts[i], pts[i + 1])))
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps
      if (toBox({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }, src) < 8) n += dist(pts[i], pts[i + 1]) / steps
    }
  }
  return n
}
/** Does a valve's 22 px box overlap an end's box? */
const valveOn = (v: P, r: Box) => Math.abs(v.x - (r.x + r.w / 2)) < 11 + r.w / 2 && Math.abs(v.y - (r.y + r.h / 2)) < 11 + r.h / 2
/** A page's layout messages, one line each. */
const said = (page: Rendered) => page.layout.map(i => `${i.code} ${i.where}: ${i.message}`)
/** What the reviewer measured on one drawn flow, read back from the page. */
function judged(page: Rendered, src: Box, dst: Box, id = 'f') {
  const g = groupOf(page.html, id)
  const pts = pipeOf(g)
  const valve = flowGeometry(g).valve
  return { pts, starts: onOutline(pts[0], src), lands: onOutline(pts[pts.length - 1], dst), hug: hugging(pts, src), valveOnEnd: valveOn(valve, src) || valveOn(valve, dst) }
}

test('an elbow needs the arrowhead\'s room before the target, and past the source only a visible gap', async () => {
  // the corner 44 px past the stock's side, 115 px above the cloud: an elbow, by default and when asked for
  for (const route of [undefined, 'hv']) {
    const page = render(await drain([2.1, 1], route))
    const g = flowGeometry(groupOf(page.html, 'dropped'))
    expect(page.layout).toEqual([])
    expect(g.corners).toBe(2)
    expect(g.start.y).toBe(80)
    expect(pointsInto(g, cell([2.1, 1]))).toBe(true)
  }
  // 10.75 px past the side is enough for an elbow asked for (the source needs 8, not the arrowhead's 16);
  // by default the plumb pipe through the width the ends share is cheaper
  const asked = render(await drain([1.925, 1], 'hv'))
  expect(asked.layout).toEqual([])
  expect(flowGeometry(groupOf(asked.html, 'dropped')).corners).toBe(2)
  const plain = flowGeometry(groupOf(render(await drain([1.925, 1])).html, 'dropped'))
  expect(plain.corners).toBe(1)
  expect(plain.start.x).toBe(plain.tip.x)
  // hv would leave no room for the arrowhead before the stock, and there is no shared band: vh
  const vh = render(await single('cloud', [0, 0], 'stock', [1.5, 0.29]))
  const v = flowGeometry(groupOf(vh.html, 'f'))
  expect(vh.layout).toEqual([])
  expect(v.corners).toBe(2)
  expect(v.start).toEqual({ x: 80, y: 95 })
  expect(pointsInto(v, cell([1.5, 0.29]))).toBe(true)
  // with room for the corner and its arrowhead, the elbow stays
  for (const [at, flow] of [[[2, 0.4], {}], [[1, 1.5], { route: 'vh' }]] as const) {
    const page = render(await twoStocks([...at] as [number, number], flow))
    const g = flowGeometry(groupOf(page.html, 'serve'))
    expect(page.layout).toEqual([])
    expect(g.corners).toBe(2)
    expect(pointsInto(g, cell(at))).toBe(true)
  }
})

test('a route that does not fit is drawn as the nearest shape that does, and G08 names the real cause', async () => {
  const cases: [Promise<Analysis>, string, P][] = [
    [twoStocks([0.3, 1.5], { route: 'vh' }), 'route "vh" does not fit here: its corner would fall inside the target. It is drawn straight;', cell([0.3, 1.5])],
    [twoStocks([2, 0.3], { route: 'hv' }), 'route "hv" does not fit here: its corner would leave no room for the arrowhead before the target. It is drawn straight;', cell([2, 0.3])],
    [drain([1.8, 1], 'hv'), 'route "hv" does not fit here: its corner would fall inside the source. It is drawn straight;', cell([1.8, 1])],
    [drain([1.89, 1], 'hv'), 'route "hv" does not fit here: past its corner it would run within 8 px of the source. It is drawn straight;', cell([1.89, 1])],
  ]
  for (const [a, says, target] of cases) {
    const page = render(await a)
    const g08 = page.layout.filter(i => i.code === 'G08')
    expect(g08.length).toBe(1)
    expect(g08[0].message).toContain(says)
    for (const retired of ['nearly in line', 'sit against the source']) expect(page.layout.map(i => i.message).join('\n')).not.toContain(retired)
    const id = /flow "(\w+)"/.exec(g08[0].where)![1]
    const g = flowGeometry(groupOf(page.html, id))
    expect(g.corners).toBe(1)
    // level or plumb, into the target
    expect(g.start.x === g.tip.x || g.start.y === g.tip.y).toBe(true)
    expect(pointsInto(g, target)).toBe(true)
  }
})

test('no pipe runs along its source or puts its valve on an end; where the ends share a band it runs level', async () => {
  // the reviewer's two cases: the hv corner 6 px past the source, and stocks sharing a band 22 px high
  for (const [b, level] of [[[0.9, 1.1], false], [[2.5, 0.76], true]] as const) {
    const page = render(await single('stock', [0.5, 0.5], 'stock', b))
    const j = judged(page, endBox('stock', [0.5, 0.5]), endBox('stock', b))
    expect(page.layout).toEqual([])
    expect(j.hug).toBeLessThan(20)
    expect(j.valveOnEnd).toBe(false)
    expect(j.starts && j.lands).toBe(true)
    if (level) expect(j.pts.length === 2 && j.pts[0].y === j.pts[1].y).toBe(true)
  }
  // asked for, the elbow of the first case is refused, and the cause is the run beside the source
  const asked = render(await single('stock', [0.5, 0.5], 'stock', [0.9, 1.1], { route: 'hv' }))
  expect(asked.layout.map(i => `${i.code} ${i.where}: ${i.message}`)).toEqual(['G08 flow "f": route "hv" does not fit here: past its corner it would run within 8 px of the source. It is drawn as a detour to the right of both ends; drop "route" or move an end.'])
  expect(judged(asked, endBox('stock', [0.5, 0.5]), endBox('stock', [0.9, 1.1])).hug).toBe(0)
})

test('every default pipe leaves its source\'s outline, lands on its target\'s, keeps off its source and keeps its valve off both ends', { timeoutMs: 30_000 }, async () => {
  const bad: string[] = []
  for (const [ka, kb] of [['stock', 'stock'], ['stock', 'cloud'], ['cloud', 'stock']])
    for (const dx of [-1.6, -1, -0.6, -0.4, 0, 0.4, 0.6, 0.8, 0.9, 1.2, 1.6, 2]) for (let k = -12; k <= 12; k++) {
      const a = [2.5, 2]
      const b = [2.5 + dx, 2 + k * 0.05]
      const page = render(await single(ka, a, kb, b))
      if (page.layout.some(i => i.code === 'G01')) continue
      const j = judged(page, endBox(ka, a), endBox(kb, b))
      if (!j.starts || !j.lands || j.hug >= 20 || j.valveOnEnd) bad.push(`${ka}→${kb} ${dx},${(k * 0.05).toFixed(2)}: ${JSON.stringify(j)}`)
    }
  expect(bad).toEqual([])
})

/** Does each corner of a drawn arrowhead's base, carried forward along the arrow, meet the target's box? */
function baseHeld(g: string, r: Box): boolean {
  const h = /class="pipe-head" points="([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+)"/.exec(g)!.slice(1).map(num)
  const tip = { x: h[0], y: h[1] }
  const corners = [{ x: h[2], y: h[3] }, { x: h[4], y: h[5] }]
  const d = { x: tip.x - (h[2] + h[4]) / 2, y: tip.y - (h[3] + h[5]) / 2 }
  // where the line c + t·d (t >= 0) is inside the box, slab by slab; 0.05 px for the page's rounding
  return corners.every(c => {
    let lo = 0
    let hi = Infinity
    for (const [p, v, a, b] of [[c.x, d.x, r.x - 0.05, r.x + r.w + 0.05], [c.y, d.y, r.y - 0.05, r.y + r.h + 0.05]]) {
      if (Math.abs(v) < 1e-9) { if (p < a || p > b) return false; continue }
      const t1 = (a - p) / v
      const t2 = (b - p) / v
      lo = Math.max(lo, Math.min(t1, t2))
      hi = Math.min(hi, Math.max(t1, t2))
    }
    return lo <= hi
  })
}

test('a pipe runs level or plumb only where its target holds the arrowhead\'s whole base; else it turns', async () => {
  // the reviewer's cloud and stock share a band 9.5 px wide: room for the pipe (8), not for the arrowhead's base (13.2)
  const page = render(await single('cloud', [2.5, 2], 'stock', [2.95, 2.6]))
  expect(page.layout).toEqual([])
  const g = groupOf(page.html, 'f')
  expect(flowGeometry(g).corners).toBe(2)
  expect(baseHeld(g, endBox('stock', [2.95, 2.6]))).toBe(true)
  // asked for, the straight pipe is refused, and the G08 says why
  const asked = render(await single('cloud', [2.5, 2], 'stock', [2.95, 2.6], { route: 'straight' }))
  expect(said(asked)).toEqual(['G08 flow "f": route "straight" does not fit here: its arrowhead would hang past the corner of the target. It is drawn as an elbow, horizontal first; drop "route" or move an end.'])
  // a slant meets its target at an angle: its base is carried forward right across the target, and is held
  const slant = render(await single('stock', [2.5, 2], 'stock', [0.1, 0.2], { route: 'straight' }))
  expect(slant.layout).toEqual([])
  expect(pipeOf(groupOf(slant.html, 'f')).length).toBe(2)
  expect(baseHeld(groupOf(slant.html, 'f'), endBox('stock', [0.1, 0.2]))).toBe(true)
  // across bands that hold the pipe but not the arrowhead: plumb (shared widths) and level (shared heights), either way
  const bad: string[] = []
  const tries: [string, string, number[]][] = []
  for (const [ka, kb, dxs] of [['cloud', 'stock', [0.435, 0.445, 0.455]], ['stock', 'cloud', [0.435, 0.445, 0.455]], ['stock', 'stock', [0.67, 0.68, 0.69]]] as const)
    for (const dx of dxs) for (const dy of [-1, -0.6, 0.6, 1]) tries.push([ka, kb, [2.5 + dx, 2 + dy]])
  for (const [ka, kb, dys] of [['cloud', 'stock', [0.235, 0.25, 0.265]], ['stock', 'cloud', [0.235, 0.25, 0.265]], ['stock', 'stock', [0.365, 0.38, 0.395]]] as const)
    for (const dy of dys) for (const dx of [-1.2, 1.2]) tries.push([ka, kb, [2.5 + dx, 2 + dy]])
  for (const [ka, kb, b] of tries) {
    const one = render(await single(ka, [2.5, 2], kb, b))
    if (!baseHeld(groupOf(one.html, 'f'), endBox(kb, b)) || one.layout.length) bad.push(`${ka}→${kb} ${b}: ${JSON.stringify(pipeOf(groupOf(one.html, 'f')))} ${said(one).join(' ')}`)
  }
  expect(bad).toEqual([])
})

test('a valve on a node is reported, its own source and target included', async () => {
  // three flows between stocks 22 px apart: two detours fit, the third has only the plumb stub, whose valve covers both
  const close = render(await probe({ nodes: [end('A', 'stock', [0, 0]), end('B', 'stock', [0, 0.6])], flows: [
    { id: 'p', from: 'A', to: 'B', label: 'moved', units: 'tickets/day' }, { id: 'q', from: 'B', to: 'A', label: 'moved back', units: 'tickets/day' },
    { id: 'r', from: 'A', to: 'B', label: 'moved again', units: 'tickets/day' }] }))
  const said = close.layout.map(i => `${i.code} ${i.where}: ${i.message}`)
  expect(said.filter(s => s.startsWith('G08')).length).toBe(1)
  expect(said.filter(s => s.startsWith('G08'))[0]).toContain('G08 flow "r": no other shape fits here (level or plumb: its valve would sit on the source;')
  expect(said.filter(s => s.startsWith('G08'))[0]).toContain('It is drawn straight, anyway (its valve would sit on the source);')
  expect(said.filter(s => s.startsWith('G03'))).toEqual([
    'G03 flow "r": its valve sits on the stock of "A". Set its "valve" or "route", or move an end.',
    'G03 flow "r": its valve sits on the stock of "B". Set its "valve" or "route", or move an end.',
  ])
  // a variable 6 px off the pipe: the pipe clears its box, the valve does not
  const beside = render(await probe({ nodes: [end('A', 'stock', [0, 0]), end('B', 'stock', [2, 0]), { id: 'v', kind: 'aux', figure: 'f1', at: [1, 0.115], label: 'v' }],
    flows: [{ id: 'f', from: 'A', to: 'B', label: 'moved', units: 'tickets/day' }] }))
  expect(beside.layout.map(i => `${i.code} ${i.where}: ${i.message}`)).toEqual(['G03 flow "f": its valve sits on the variable of "v". Set its "valve" or "route", or move an end.'])
  // stocks 12 px apart with three flows: the last asks to run straight, here a slant too short for its arrowhead;
  // a detour fits, so it is drawn as one, and its G08 does not claim that no other shape does
  const forced = render(await probe({ nodes: [end('A', 'stock', [2.5, 2]), end('B', 'stock', [1.7, 1.6])], flows: [
    { id: 'p', from: 'A', to: 'B', label: 'moved', units: 'tickets/day' }, { id: 'q', from: 'B', to: 'A', label: 'moved back', units: 'tickets/day' },
    { id: 'r', from: 'A', to: 'B', label: 'moved again', units: 'tickets/day', route: 'straight' }] }))
  expect(forced.layout.map(i => `${i.code} ${i.where}: ${i.message}`)).toEqual(['G08 flow "r": route "straight" does not fit here: the ends are too close for its arrowhead. It is drawn as a detour below both ends; drop "route" or move an end.'])
  // a copy is text: G02 already reports it over a valve, so it is reported once
  const copy = render(await probe({ nodes: [end('A', 'stock', [0, 0]), end('B', 'stock', [2, 0]), { id: 'sh', kind: 'shadow', figure: 'f1', at: [1, 0.13], of: 'A' }],
    flows: [{ id: 'f', from: 'A', to: 'B', label: 'moved', units: 'tickets/day' }] }))
  expect(copy.layout.map(i => `${i.code} ${i.where}: ${i.message}`)).toEqual(['G02 shadow of "sh": overlaps the valve of "f". Move an element ("at"), or set "label_at", "valve", "bend" or "marker_at".'])
})

// ---------------- R4-02, R5-02: the flows between two ends are routed together, whatever their order in the file

type Parts = Parameters<typeof probe>[0]
const pair = (at: [number, number]): Parts => ({
  nodes: [{ id: 'A', kind: 'stock', figure: 'f1', at: [0, 0], label: 'Open tickets', units: 'tickets' }, { id: 'B', kind: 'stock', figure: 'f1', at, label: 'Escalated tickets', units: 'tickets' }],
  flows: [{ id: 'escalate', from: 'A', to: 'B', label: 'escalated', units: 'tickets/day' }, { id: 'back', from: 'B', to: 'A', label: 'handed back', units: 'tickets/day' }],
})
function orders<T>(xs: T[]): T[][] {
  return xs.length <= 1 ? [xs] : xs.flatMap((x, i) => orders([...xs.slice(0, i), ...xs.slice(i + 1)]).map(o => [x, ...o]))
}
/** Each flow's drawn group (pipe, valve and label) by id. */
const flowGroups = (html: string): Record<string, string> => Object.fromEntries([...html.matchAll(/<g class="el flow[^"]*" data-id="([^"]+)"[\s\S]*?<\/g>/g)].map(g => [g[1], g[0]]))
/** Check and render a model with its flows listed in every order; each order must draw every flow the same and say the same. */
async function everyOrder(parts: Parts): Promise<Rendered> {
  const [first, ...rest] = orders(parts.flows ?? [])
  const page = render(await probe({ ...parts, flows: first }))
  for (const flows of rest) {
    const again = render(await probe({ ...parts, flows }))
    expect(flowGroups(again.html)).toEqual(flowGroups(page.html))
    expect([...again.layout].map(i => i.message).sort()).toEqual([...page.layout].map(i => i.message).sort())
  }
  return page
}

test('two flows between the same ends are never drawn along each other: the earlier id takes the cheaper shape', async () => {
  // side by side 0.1 and 0.25 rows apart, and stacked 0.15 and 0.3 columns apart: one straight, one detour
  for (const at of [[2, 0.1], [2, 0.25], [0.15, 1.5], [0.3, 1.5]] as [number, number][]) {
    const page = await everyOrder(pair(at))
    expect(page.layout).toEqual([])
    const there = flowGeometry(groupOf(page.html, 'escalate'))
    const back = flowGeometry(groupOf(page.html, 'back'))
    expect(back.corners).toBe(1)
    expect(back.start.x === back.tip.x || back.start.y === back.tip.y).toBe(true)
    expect(there.corners).toBe(3)
    expect(pointsInto(there, cell(at))).toBe(true)
    expect(pointsInto(back, cell([0, 0]))).toBe(true)
  }
  // a stock and a cloud: the two never turn at the same corner; with the plumb stub too short for a valve the
  // return turns and the other detours, and where both elbows fit apart both are elbows
  for (const [at, corners] of [[[0.25, 0.5], [3, 2]], [[0.7, 0.3], [2, 2]]] as [[number, number], [number, number]][]) {
    const page = await everyOrder({
      nodes: [{ id: 'A', kind: 'stock', figure: 'f1', at: [0, 0], label: 'Open tickets', units: 'tickets' }, { id: 'B', kind: 'cloud', figure: 'f1', at }],
      flows: [{ id: 'escalate', from: 'A', to: 'B', label: 'escalated', units: 'tickets/day' }, { id: 'back', from: 'B', to: 'A', label: 'handed back', units: 'tickets/day' }],
    })
    expect(page.layout).toEqual([])
    expect([flowGeometry(groupOf(page.html, 'escalate')).corners, flowGeometry(groupOf(page.html, 'back')).corners]).toEqual(corners)
  }
  // an explicit detour leaves the straight pipe free for the default flow
  const after = await everyOrder({
    nodes: [{ id: 'A', kind: 'stock', figure: 'f1', at: [0, 0], label: 'Open tickets', units: 'tickets' }, { id: 'B', kind: 'stock', figure: 'f1', at: [2, 0], label: 'Escalated tickets', units: 'tickets' }],
    flows: [{ id: 'escalate', from: 'A', to: 'B', label: 'escalated', units: 'tickets/day', route: 'under' }, { id: 'back', from: 'B', to: 'A', label: 'handed back', units: 'tickets/day' }],
  })
  expect(after.layout).toEqual([])
  expect(flowGeometry(groupOf(after.html, 'back')).corners).toBe(1)
  expect(flowGeometry(groupOf(after.html, 'escalate')).corners).toBe(3)
  // routes that ask for the same corner: the earlier id keeps its own, whichever of the two corners it asked for;
  // the later is refused, said why, and takes the other elbow
  const sameCorner = (backId: string) => everyOrder({
    nodes: [{ id: 'A', kind: 'stock', figure: 'f1', at: [0, 0], label: 'Open tickets', units: 'tickets' }, { id: 'B', kind: 'stock', figure: 'f1', at: [2, 1], label: 'Escalated tickets', units: 'tickets' }],
    flows: [{ id: 'escalate', from: 'A', to: 'B', label: 'escalated', units: 'tickets/day', route: 'vh' }, { id: backId, from: 'B', to: 'A', label: 'handed back', units: 'tickets/day', route: 'hv' }],
  })
  // "back" is the earlier id: it keeps hv, and "escalate" (vh) is refused
  const same = await sameCorner('back')
  expect(same.layout.map(i => `${i.code} ${i.where}: ${i.message}`)).toEqual(['G08 flow "escalate": route "vh" does not fit here: it would be drawn on top of the pipe of "back", between the same ends. It is drawn as an elbow, horizontal first; drop "route" or move an end.'])
  expect(flowGeometry(groupOf(same.html, 'escalate')).start).toEqual({ x: 150, y: 80 })
  expect(flowGeometry(groupOf(same.html, 'back')).start).toEqual({ x: 390, y: 210 })
  // "returned" is the later id: now "escalate", the flow that asked vh, keeps its corner
  const kept = await sameCorner('returned')
  expect(kept.layout.map(i => `${i.code} ${i.where}: ${i.message}`)).toEqual(['G08 flow "returned": route "hv" does not fit here: it would be drawn on top of the pipe of "escalate", between the same ends. It is drawn as an elbow, vertical first; drop "route" or move an end.'])
  expect(flowGeometry(groupOf(kept.html, 'escalate')).start).toEqual({ x: 80, y: 108 })
  expect(flowGeometry(groupOf(kept.html, 'returned')).start).toEqual({ x: 460, y: 182 })
  // a single flow between near-level stocks runs level through the height they share, unwarned
  const one = render(await twoStocks([2, 0.18]))
  const g = flowGeometry(groupOf(one.html, 'serve'))
  expect(one.layout).toEqual([])
  expect(g.corners).toBe(1)
  expect(g.start.y).toBe(g.tip.y)
  expect(pointsInto(g, cell([2, 0.18]))).toBe(true)
})

test('the worked example with its flows listed backwards draws every flow the same, with no layout warnings', async () => {
  const page = render(await example())
  const back = render(await example(m => { m.flows.reverse() }))
  expect(back.layout).toEqual([])
  expect(flowGroups(back.html)).toEqual(flowGroups(page.html))
})

test('the reviewer\'s cloud and stock draw two clean elbows in either order', async () => {
  const page = await everyOrder({
    nodes: [{ id: 'inbox', kind: 'cloud', figure: 'f1', at: [0.5, 0.5] }, { id: 'open', kind: 'stock', figure: 'f1', at: [1.3, 0.8], label: 'Open tickets', units: 'tickets' }],
    flows: [{ id: 'filed', from: 'inbox', to: 'open', label: 'filed', units: 'tickets/day' }, { id: 'withdrawn', from: 'open', to: 'inbox', label: 'withdrawn', units: 'tickets/day' }],
  })
  expect(page.layout).toEqual([])
  expect(pipeOf(groupOf(page.html, 'filed'))).toEqual([{ x: 175, y: 160 }, { x: 175, y: 184 }, { x: 257, y: 184 }])
  expect(pipeOf(groupOf(page.html, 'withdrawn'))).toEqual([{ x: 327, y: 156 }, { x: 327, y: 145 }, { x: 200, y: 145 }])
  // the valve of "withdrawn" moves off the stock it leaves, along its own run
  expect(valveOn(flowGeometry(groupOf(page.html, 'withdrawn')).valve, endBox('stock', [1.3, 0.8]))).toBe(false)
  // labels are placed in id order too: here the first label placed takes the spot the other would want
  const labels = await everyOrder({
    nodes: [end('A', 'cloud', [0.5, 0.5]), end('B', 'stock', [1, 1.1])],
    flows: [{ id: 'm0', from: 'A', to: 'B', label: 'moved 0', units: 'tickets/day' }, { id: 'm1', from: 'B', to: 'A', label: 'moved 1', units: 'tickets/day' }],
  })
  expect(labels.layout).toEqual([])
  // the lint reads the box the chooser cleared: this valve sits 2 px off the cloud and is not reported
  const near = await everyOrder({
    nodes: [end('A', 'stock', [2.5, 2]), end('B', 'cloud', [2.3, 1.4])],
    flows: [{ id: 'm0', from: 'A', to: 'B', label: 'moved 0', units: 'tickets/day' }, { id: 'm1', from: 'B', to: 'A', label: 'moved 1', units: 'tickets/day' }],
  })
  expect(near.layout).toEqual([])
  const box = endBox('cloud', [2.3, 1.4])
  const v = flowGeometry(groupOf(near.html, 'm1')).valve
  expect(v.x - 11 - (box.x + box.w)).toBeLessThan(3)
  expect(valveOn(v, box)).toBe(false)
})

test('two pipes 8.7 px apart are reported as running along each other wherever they fall on the lint\'s grid', async () => {
  // a1's last run and b1's first run, plumb and 8.7 px apart, either side of a 48 px cell edge
  const bx = 48 * 18 - 8.35
  const at = (x: number, y: number) => [(x - 80) / 190, (y - 80) / 130]
  const page = render(await probe({
    nodes: [
      { id: 'A', kind: 'stock', figure: 'f1', at: at(bx - 400, 210), label: 'Waiting' }, { id: 'B', kind: 'stock', figure: 'f1', at: at(bx, 410), label: 'Served' },
      { id: 'C', kind: 'stock', figure: 'f1', at: at(bx + 8.7, 80), label: 'Queued' }, { id: 'D', kind: 'stock', figure: 'f1', at: at(bx + 300, 310), label: 'Done' },
    ],
    flows: [{ id: 'a1', from: 'A', to: 'B', label: 'served' }, { id: 'b1', from: 'C', to: 'D', label: 'done', route: 'vh' }],
  }))
  expect(page.layout.map(i => `${i.code} ${i.where}: ${i.message}`)).toEqual(['G03 flow "a1": its pipe runs along the pipe of "b1". Set a "route", or move an end.'])
})

test('two pipes running along each other are reported whichever id comes first: the test reads both pipes\' ends', async () => {
  // two slants 2.7° apart that cross; only the end of A → B's pipe lies within 9 px of the other
  const nodes = [{ id: 'A', kind: 'cloud', figure: 'f1', at: [1.55263, 1.62231] }, { id: 'B', kind: 'stock', figure: 'f1', at: [3.53636, 2.67757], label: 'Served' },
    { id: 'C', kind: 'cloud', figure: 'f1', at: [1.03105, 1.47774] }, { id: 'D', kind: 'stock', figure: 'f1', at: [5.05248, 3.30847], label: 'Done' }]
  for (const [ab, cd] of [['a1', 'b1'], ['b1', 'a1']]) {
    const page = render(await probe({ nodes, flows: [{ id: ab, from: 'A', to: 'B', label: 'one', route: 'straight' }, { id: cd, from: 'C', to: 'D', label: 'two', route: 'straight' }] }))
    expect(said(page)).toContain('G03 flow "a1": its pipe runs along the pipe of "b1". Set a "route", or move an end.')
  }
})

test('three flows between two ends draw the same in all six orders: straight, under and over by id', async () => {
  const page = await everyOrder({
    nodes: [end('A', 'stock', [0, 0]), end('B', 'stock', [2, 0])],
    flows: [{ id: 'p', from: 'A', to: 'B', label: 'moved', units: 'tickets/day' }, { id: 'q', from: 'B', to: 'A', label: 'moved back', units: 'tickets/day' },
      { id: 'r', from: 'A', to: 'B', label: 'moved again', units: 'tickets/day' }],
  })
  expect(page.layout).toEqual([])
  expect(['p', 'q', 'r'].map(id => flowGeometry(groupOf(page.html, id)).corners)).toEqual([1, 3, 3])
  // q below both, r above both
  expect(pipeOf(groupOf(page.html, 'q'))[1].y).toBeGreaterThan(108)
  expect(pipeOf(groupOf(page.html, 'r'))[1].y).toBeLessThan(52)
  // a stock and a cloud far apart: the two elbows fit, and the third, last by id, detours over them and crosses
  // one, which the lint accepts, rather than slanting with a G08
  const tight = await everyOrder({
    nodes: [end('A', 'stock', [2.5, 2]), end('B', 'cloud', [0.5, 0.95])],
    flows: [{ id: 'p', from: 'A', to: 'B', label: 'moved', units: 'tickets/day' }, { id: 'q', from: 'B', to: 'A', label: 'moved back', units: 'tickets/day' },
      { id: 'r', from: 'A', to: 'B', label: 'moved again', units: 'tickets/day' }],
  })
  expect(tight.layout).toEqual([])
  expect(['p', 'q', 'r'].map(id => flowGeometry(groupOf(tight.html, id)).corners)).toEqual([2, 2, 3])
})

// ---------- R6-01, R6-02: one test of two pipes for the chooser and the lint; named routes that clash, by id

/** Do two drawn pipes paint as one: point for point within 9 px, either way round? */
const onePipe = (p: P[], q: P[]) => [q, [...q].reverse()].some(r => r.length === p.length && r.every((v, k) => dist(v, p[k]) < 9))
/** The pairs of flows on a page drawn as one pipe. */
function sharing(html: string, ids: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
    if (onePipe(pipeOf(groupOf(html, ids[i])), pipeOf(groupOf(html, ids[j])))) out.push(`${ids[i]}/${ids[j]}`)
  return out
}
/** Flows m0, m1, ... between ends A and B, one per "AB" or "BA", with the routes given. */
const between = (a: Json, b: Json, pattern: string[], routes: (string | undefined)[] = []): Parts => ({
  nodes: [a, b],
  flows: pattern.map((p, i) => ({ id: `m${i}`, from: p[0], to: p[1], label: `moved ${i}`, units: 'tickets/day', ...(routes[i] ? { route: routes[i] } : {}) })),
})
test('flows between two ends never share a pipe while another shape is free; a crossing is taken before a G03 or a slant', { timeoutMs: 30_000 }, async () => {
  // the reviewer's three flows between a stock and a cloud: three pipes, nothing reported (the detour crosses one pipe)
  const three = await everyOrder(between(end('A', 'stock', [2.5, 2]), end('B', 'cloud', [1.8, 0.2]), ['AB', 'BA', 'AB']))
  expect(sharing(three.html, ['m0', 'm1', 'm2'])).toEqual([])
  expect(three.layout).toEqual([])
  // four flows between stocks a column and a half apart: four pipes, nothing reported
  const four = await everyOrder(between(end('A', 'stock', [2.5, 2]), end('B', 'stock', [3.3, 3.4]), ['AB', 'BA', 'AB', 'BA']))
  expect(sharing(four.html, ['m0', 'm1', 'm2', 'm3'])).toEqual([])
  expect(four.layout).toEqual([])
  // four flows one way between a stock and a cloud level with it: straight, under and over, then a slant that still
  // meets the straight pipe, rather than a second straight pipe drawn on top of the first
  const level = await everyOrder(between(end('A', 'stock', [2.5, 2]), end('B', 'cloud', [0.1, 1.9]), ['AB', 'AB', 'AB', 'AB']))
  expect(sharing(level.html, ['m0', 'm1', 'm2', 'm3'])).toEqual([])
  expect(pipeOf(groupOf(level.html, 'm3')).length).toBe(2)
  // a missing flow's × is one of the marks the others keep off, as the lint holds them to
  const lost = between(end('A', 'stock', [2.5, 2]), end('B', 'stock', [0.2, 0.8]), ['AB', 'BA', 'AB'])
  lost.flows![0] = { ...lost.flows![0], status: 'missing', claim: 'it should move tickets and does not' }
  const missing = await everyOrder(lost)
  expect(missing.layout).toEqual([])
  expect(flowGeometry(groupOf(missing.html, 'm0')).cross).toBeDefined()
  // the reviewer's four flows one column and one row apart: still four pipes; the lint reports the one fault the
  // chooser could not avoid, and the slant's G08 says what each other shape would meet
  const tight = await everyOrder(between(end('A', 'stock', [0.5, 0.5]), end('B', 'stock', [1.5, 1.5]), ['AB', 'BA', 'AB', 'BA']))
  expect(sharing(tight.html, ['m0', 'm1', 'm2', 'm3'])).toEqual([])
  expect(said(tight).filter(s => s.startsWith('G03'))).toEqual(['G03 flow "m1": its pipe runs through the valve of "m2". Set its "route", or move an end.'])
  const g08 = said(tight).filter(s => s.startsWith('G08'))
  expect(g08.length).toBe(1)
  expect(g08[0]).toContain('G08 flow "m3": no other shape fits here (')
  expect(g08[0]).toContain('under: it would be drawn on top of the pipe of "m2", between the same ends')
})

test('of two named routes that want the same pipe the earlier id keeps its own; one kept while it meets a sibling says so', { timeoutMs: 30_000 }, async () => {
  // the reviewer's three flows: m0 asks vh and m1 hv, the same corner; m2 asks nothing
  const named = await everyOrder(between(end('A', 'stock', [2.5, 2]), end('B', 'cloud', [1.9, 0.2]), ['AB', 'BA', 'AB'], ['vh', 'hv']))
  expect(said(named)).toEqual(['G08 flow "m1": route "hv" does not fit here: it would be drawn on top of the pipe of "m0", between the same ends. It is drawn as a detour above both ends; drop "route" or move an end.'])
  expect(sharing(named.html, ['m0', 'm1', 'm2'])).toEqual([])
  const m0 = pipeOf(groupOf(named.html, 'm0'))
  expect(m0.length === 3 && m0[0].x === m0[1].x).toBe(true)
  // four flows where no choice keeps the "over" of m0 clear of m1: it is kept, and its G08 says so beside the lint's G03
  const kept = await everyOrder(between(end('A', 'stock', [2.5, 2]), end('B', 'stock', [1.3, 1]), ['AB', 'BA', 'AB', 'BA'], ['over', undefined, 'under']))
  expect(said(kept)).toContain('G08 flow "m0": route "over" is drawn as asked, but it has the pipe of "m1" running through its valve, between the same ends. Drop "route" or move an end.')
  expect(said(kept)).toContain('G03 flow "m1": its pipe runs through the valve of "m0". Set its "route", or move an end.')
})

test('past four flows between two ends, a route of its own is still kept: those are placed first', async () => {
  // five flows between level stocks: straight, under and over fit; "p5" asks for over and keeps it
  const flows = ['p1', 'p2', 'p3', 'p4', 'p5'].map((id, i) => ({ id, from: i % 2 ? 'B' : 'A', to: i % 2 ? 'A' : 'B', label: `moved ${id}`, units: 'tickets/day', ...(id === 'p5' ? { route: 'over' } : {}) }))
  const page = render(await probe({ nodes: [end('A', 'stock', [0, 0]), end('B', 'stock', [2, 0])], flows }))
  expect(page.layout.filter(i => i.where === 'flow "p5"')).toEqual([])
  expect(pipeOf(groupOf(page.html, 'p5'))[1].y).toBeLessThan(52)
  expect(flowGeometry(groupOf(page.html, 'p1')).corners).toBe(1)
  expect(pipeOf(groupOf(page.html, 'p2'))[1].y).toBeGreaterThan(108)
  // and the file's order still does not matter
  const reversed = render(await probe({ nodes: [end('A', 'stock', [0, 0]), end('B', 'stock', [2, 0])], flows: [...flows].reverse() }))
  expect(flowGroups(reversed.html)).toEqual(flowGroups(page.html))
})

// ------ R7-01..R7-04: a crossing keeps clear of every run end; a shape's own fault is graded; valves keep off marks

/** The distance from p to the segment ab. */
function toRun(p: P, a: P, b: P): number {
  const d = { x: b.x - a.x, y: b.y - a.y }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / (d.x * d.x + d.y * d.y || 1)))
  return dist(p, { x: a.x + d.x * t, y: a.y + d.y * t })
}
/**
 * The pairs of drawn pipes that touch: two runs, not parallel, with an end of one within 9 px of the other. Whether they
 * cross or not, they paint as one pipe that forks, or a T; a crossing keeps every run end 9 px or more from the other run.
 */
function touching(html: string, ids: string[]): string[] {
  const runs = (id: string) => { const p = pipeOf(groupOf(html, id)); return p.slice(1).map((b, k) => [p[k], b] as const) }
  const out: string[] = []
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
    if (runs(ids[i]).some(([a, b]) => runs(ids[j]).some(([c, d]) => {
      const u = { x: b.x - a.x, y: b.y - a.y }
      const v = { x: d.x - c.x, y: d.y - c.y }
      if (Math.abs(u.x * v.y - u.y * v.x) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) <= 0.05) return false
      return Math.min(toRun(a, c, d), toRun(b, c, d), toRun(c, a, b), toRun(d, a, b)) < 9
    }))) out.push(`${ids[i]}/${ids[j]}`)
  return out
}

test('a crossing keeps clear of every run end; pipes that fork or meet near an end are avoided, or reported', { timeoutMs: 30_000 }, async () => {
  // the reviewer's tc2: four flows between a stock and a cloud, the last asked to run straight; kept as a slant, it leaves
  // the cloud 6.4 px from m1, and the two paint as one pipe that forks: reported, not accepted as a crossing
  const tc2 = render(await probe(between(end('A', 'stock', [2.5, 2]), end('B', 'cloud', [0.1, 1.1]), ['AB', 'BA', 'AB', 'BA'], [undefined, undefined, undefined, 'straight'])))
  expect(touching(tc2.html, ['m0', 'm1', 'm2', 'm3'])).toEqual(['m1/m3'])
  expect(said(tc2)).toEqual([
    'G08 flow "m3": route "straight" is drawn as asked, but it touches the pipe of "m1", between the same ends. Drop "route" or move an end.',
    'G03 flow "m1": its pipe touches the pipe of "m3". Set a "route", or move an end.',
  ])
  // the reviewer's tc1: the slant would leave the cloud 7.3 px from an elbow; the chooser takes shapes that keep apart
  const tc1 = render(await probe(between(end('A', 'cloud', [2.5, 2]), end('B', 'stock', [1.9, 0.2]), ['AB', 'BA', 'AB'], [undefined, undefined, 'straight'])))
  expect(touching(tc1.html, ['m0', 'm1', 'm2'])).toEqual([])
  // along the row of tc2: wherever two pipes touch, the lint says so
  for (let k = 0; k <= 6; k++) {
    const page = render(await probe(between(end('A', 'stock', [2.5, 2]), end('B', 'cloud', [0.1, 0.8 + k * 0.1]), ['AB', 'BA', 'AB', 'BA'], [undefined, undefined, undefined, 'straight'])))
    for (const pair of touching(page.html, ['m0', 'm1', 'm2', 'm3'])) {
      const [p, q] = pair.split('/')
      expect(said(page)).toContain(`G03 flow "${p}": its pipe touches the pipe of "${q}". Set a "route", or move an end.`)
    }
  }
})

test('a shape that does not fit is drawn only when each shape that fits would lie on another pipe, and its G08 says which', async () => {
  // the reviewer's ss1: m1's "hv" would lie on m0's "vh"; it is drawn as a detour that fits, not as a slant whose valve
  // covers both stocks
  const ss1 = render(await probe(between(end('A', 'stock', [2.5, 2]), end('B', 'stock', [1.7, 1.4]), ['AB', 'BA', 'AB'], ['vh', 'hv'])))
  expect(said(ss1).filter(s => s.startsWith('G08'))).toEqual(['G08 flow "m1": route "hv" does not fit here: it would be drawn on top of the pipe of "m0", between the same ends. It is drawn as a detour below both ends; drop "route" or move an end.'])
  expect(said(ss1).filter(s => s.includes(' its valve sits on '))).toEqual([])
  const m1 = judged(ss1, endBox('stock', [1.7, 1.4]), endBox('stock', [2.5, 2]), 'm1')
  expect(m1.pts.length).toBe(4)
  expect(m1.valveOnEnd).toBe(false)
  // the reviewer's nos: "straight" between ends that share no band is a slant whose valve would sit on its source; a
  // detour fits, so it is drawn, and nothing claims that no other shape does
  const nos = render(await probe(between(end('A', 'cloud', [2.5, 2]), end('B', 'stock', [1.9, 1.6]), ['AB', 'BA', 'AB'], ['vh', 'straight'])))
  expect(said(nos).filter(s => s.startsWith('G08'))).toEqual(['G08 flow "m1": route "straight" does not fit here: its valve would sit on the source. It is drawn as a detour below both ends; drop "route" or move an end.'])
  expect(said(nos).filter(s => s.includes(' its valve sits on '))).toEqual([])
  // four flows: m3's slant does not fit, and each shape that does would lie on a sibling's pipe (hv on m0's, under on
  // m1's, over on m2's; vh does not fit): the slant is drawn, and the G08 says that, not that no other shape fits
  const onTop = render(await probe(between(end('A', 'cloud', [2.5, 2]), end('B', 'stock', [1.9, 1.7]), ['AB', 'BA', 'AB', 'BA'], [undefined, undefined, undefined, 'straight'])))
  expect(said(onTop)).toContain('G08 flow "m3": route "straight" does not fit here: its valve would sit on the source, and every shape that does would be drawn on top of another pipe between the same ends. It is drawn as asked anyway; drop "route" or move an end.')
  expect(sharing(onTop.html, ['m0', 'm1', 'm2', 'm3'])).toEqual([])
})

/** Do two valves' boxes (22 px square, 1 px apart) meet? */
const valvesMeet = (u: P, v: P) => Math.abs(u.x - v.x) < 23 && Math.abs(u.y - v.y) < 23
/** Does a valve's box meet an arrowhead's box (16 px square round the tip), 1 px apart? */
const valveOnHead = (v: P, tip: P) => Math.abs(v.x - tip.x) < 20 && Math.abs(v.y - tip.y) < 20

test('a valve on another pipe\'s valve or arrowhead moves along its own run; where it cannot, it is reported', async () => {
  // the reviewer's c4: two outflows of one stock to clouds stacked one above the other run 19.5 px apart; m1's valve
  // moves along its run off m0's, and the page is clean
  const c4 = render(await probe({ nodes: [end('A', 'stock', [2.5, 2]), end('B', 'cloud', [0.5, 1.6]), end('C', 'cloud', [0.5, 2.2])],
    flows: [{ id: 'm0', from: 'A', to: 'B', label: 'moved 0', units: 'tickets/day' }, { id: 'm1', from: 'A', to: 'C', label: 'moved 1', units: 'tickets/day' }] }))
  expect(c4.layout).toEqual([])
  const [v0, v1] = ['m0', 'm1'].map(id => flowGeometry(groupOf(c4.html, id)).valve)
  expect(valvesMeet(v0, v1)).toBe(false)
  expect(v1.y).toBe(359.5)
  // the clouds nearer: m0's valve moves off m1's arrowhead, then m1's off m0's valve
  const near = render(await probe({ nodes: [end('A', 'stock', [2.5, 2]), end('B', 'cloud', [1.7, 1.6]), end('C', 'cloud', [1.7, 2.2])],
    flows: [{ id: 'm0', from: 'A', to: 'B', label: 'moved 0', units: 'tickets/day' }, { id: 'm1', from: 'A', to: 'C', label: 'moved 1', units: 'tickets/day' }] }))
  expect(near.layout).toEqual([])
  const [n0, n1] = ['m0', 'm1'].map(id => flowGeometry(groupOf(near.html, id)))
  expect(valveOnHead(n0.valve, n1.tip)).toBe(false)
  expect(valvesMeet(n0.valve, n1.valve)).toBe(false)
  // C → A's valve has no room to move on its short run: A → B's, the earlier, gives way along its own
  const way = render(await probe({ nodes: [end('A', 'stock', [2.5, 2]), end('B', 'stock', [2.7, 1]), end('C', 'stock', [3.1, 1.5])],
    flows: [{ id: 'm0', from: 'A', to: 'B', label: 'moved 0', units: 'tickets/day' }, { id: 'm1', from: 'C', to: 'A', label: 'moved 1', units: 'tickets/day' }] }))
  expect(said(way)).toEqual(['G03 flow "m0": its pipe runs through the valve of "m1". Set its "route", or move an end.'])
  expect(valvesMeet(flowGeometry(groupOf(way.html, 'm0')).valve, flowGeometry(groupOf(way.html, 'm1')).valve)).toBe(false)
  // the reviewer's vt3: three flows between two stocks; the detour's valve moves off m0's, and no valve sits on another's
  // valve or arrowhead
  const vt3 = render(await probe(between(end('A', 'stock', [2.5, 2]), end('B', 'stock', [1.7, 1.4]), ['AB', 'BA', 'AB'])))
  expect(vt3.layout).toEqual([])
  const g = ['m0', 'm1', 'm2'].map(id => flowGeometry(groupOf(vt3.html, id)))
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j) {
    expect(valveOnHead(g[i].valve, g[j].tip)).toBe(false)
    if (i < j) expect(valvesMeet(g[i].valve, g[j].valve)).toBe(false)
  }
  // three flows between a stock and a cloud too close for m1's valve to move off m0's arrowhead: reported
  const cramped = render(await probe(between(end('A', 'stock', [2.5, 2]), end('B', 'cloud', [2.3, 2.4]), ['AB', 'BA', 'AB'])))
  expect(said(cramped)).toContain('G03 flow "m1": its valve sits on the arrowhead of "m0". Set its "route", or move an end.')
  // and between other ends: C → A's valve, on a run too short to move along, sits on the arrowhead of A → B
  const apart = render(await probe({ nodes: [end('A', 'stock', [2.5, 2]), end('B', 'cloud', [2.1, 2.4]), end('C', 'cloud', [2.1, 2.7])],
    flows: [{ id: 'm0', from: 'A', to: 'B', label: 'moved 0', units: 'tickets/day' }, { id: 'm1', from: 'C', to: 'A', label: 'moved 1', units: 'tickets/day' }] }))
  expect(said(apart)).toContain('G03 flow "m1": its valve sits on the arrowhead of "m0". Set its "route", or move an end.')
  // no "valve" can clear an arrowhead: the reviewer's cramped case keeps its report for every valve setting
  for (const v0 of [0.15, 0.5, 0.85]) for (const v1 of [0.15, 0.5, 0.85]) {
    const parts = between(end('A', 'stock', [2.5, 2]), end('B', 'cloud', [2.3, 2.4]), ['AB', 'BA', 'AB'])
    parts.flows = parts.flows!.map(f => f.id === 'm0' ? { ...f, valve: v0 } : f.id === 'm1' ? { ...f, valve: v1 } : f)
    expect(said(render(await probe(parts)))).toContain('G03 flow "m1": its valve sits on the arrowhead of "m0". Set its "route", or move an end.')
  }
})

test('a kept named route\'s G08 reads the valves as drawn, after every valve is settled', async () => {
  // the reviewer's d2-1: a flow between other ends (a0, the earliest id) moves m2's valve in the last settle,
  // onto m1's; the G08 for m1's kept "straight" says so
  const page = render(await probe({ nodes: [end('A', 'stock', [2.5, 2]), end('B', 'stock', [1.3, 1.7]), end('C', 'cloud', [1.9, 1.7])],
    flows: [{ id: 'a0', from: 'A', to: 'C', label: 'moved 0', units: 'tickets/day' }, { id: 'm1', from: 'A', to: 'B', label: 'moved 1', units: 'tickets/day', route: 'straight' },
      { id: 'm2', from: 'B', to: 'A', label: 'moved 2', units: 'tickets/day' }] }))
  expect(said(page)).toContain('G08 flow "m1": route "straight" is drawn as asked, but it has its valve on the valve of "m2", between the same ends. Drop "route" or move an end.')
  expect(said(page)).toContain('G03 flow "m1": its valve sits on the valve of "m2". Set the "valve" of either, or a "route", or move an end.')
})

test('past four flows between two ends, each is graded against those decided: none drawn on top while a shape is free', async () => {
  // a stock and a cloud nearly level: the fifth flow takes the slant (G08) rather than lie on m0's straight pipe
  const level = render(await probe(between(end('A', 'stock', [2.5, 2]), end('B', 'cloud', [0.1, 1.8]), ['AB', 'BA', 'AB', 'BA', 'AB'])))
  expect(sharing(level.html, ['m0', 'm1', 'm2', 'm3', 'm4'])).toEqual([])
  const levelG08 = said(level).filter(s => s.startsWith('G08'))
  expect(levelG08.length === 1 && levelG08[0].startsWith('G08 flow "m4": no other shape fits here (')).toBe(true)
  // a cloud and a stock: the lint faults come before crossings, flow by flow, and a G08 shape goes to the later id
  const far = render(await probe(between(end('A', 'cloud', [2.5, 2]), end('B', 'stock', [0.5, 0.6]), ['AB', 'BA', 'AB', 'BA', 'AB'])))
  expect(sharing(far.html, ['m0', 'm1', 'm2', 'm3', 'm4'])).toEqual([])
  expect(said(far).filter(s => s.startsWith('G03 flow "m'))).toEqual([
    'G03 flow "m1": its pipe runs along the pipe of "m4". Set a "route", or move an end.',
    'G03 flow "m4": its pipe runs through the arrowhead of "m1". Set its "route", or move an end.',
  ])
  const farG08 = said(far).filter(s => s.startsWith('G08'))
  expect(farG08.length === 1 && farG08[0].startsWith('G08 flow "m3": no other shape fits here (')).toBe(true)
})

test('the flows between two ends are decided together: two elbows rather than an elbow and a detour', async () => {
  // deciding one by one, the first would take its cheapest elbow and leave the other only a detour
  const page = await everyOrder({
    nodes: [end('A', 'stock', [2.5, 2]), end('B', 'cloud', [0.5, 1.7])],
    flows: [{ id: 'm0', from: 'A', to: 'B', label: 'moved', units: 'tickets/day' }, { id: 'm1', from: 'B', to: 'A', label: 'moved back', units: 'tickets/day' }],
  })
  expect(page.layout).toEqual([])
  expect(['m0', 'm1'].map(id => flowGeometry(groupOf(page.html, id)).corners)).toEqual([2, 2])
})

test('"under" goes below both ends, or round their right side when one lies above the other', async () => {
  // diagonal ends, one column and one row apart: below
  const diag = pipeOf(groupOf(render(await single('stock', [0.5, 0.5], 'stock', [1.5, 1.5], { route: 'under' })).html, 'f'))
  expect(diag.length).toBe(4)
  expect(diag[1].y).toBeGreaterThan(endBox('stock', [1.5, 1.5]).y + 56)
  // ends whose widths overlap: to the right
  const stack = pipeOf(groupOf(render(await single('stock', [0, 0], 'stock', [0.3, 1.5], { route: 'under' })).html, 'f'))
  expect(stack.length).toBe(4)
  expect(stack[1].x).toBeGreaterThan(endBox('stock', [0.3, 1.5]).x + 140)
})

// ------------------------------------------------------- R3-03: a wide figure scrolls at a legible scale

test('a wide figure keeps 80% of its natural width and the frame scrolls, with the hint', async () => {
  const N = 8
  const nodes: Json[] = [{ id: 'in', kind: 'cloud', figure: 'f1', at: [0, 0] }, { id: 'out', kind: 'cloud', figure: 'f1', at: [2 * N + 2, 0] }]
  for (let i = 0; i < N; i++) nodes.push({ id: `s${i}`, kind: 'stock', figure: 'f1', at: [2 * i + 2, 0], label: `Stage ${i + 1} items`, units: 'items' })
  const flows: Json[] = []
  for (let i = 0; i <= N; i++) flows.push({ id: `move${i}`, from: i === 0 ? 'in' : `s${i - 1}`, to: i === N ? 'out' : `s${i}`, label: `moved ${i}`, units: 'items/day' })
  const page = render(await probe({ nodes, flows })).html
  const [, vw, minW] = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+" style="min-width:([\d.]+)px"/.exec(page)!.map(Number)
  expect(vw).toBeGreaterThan(1375)
  expect(minW).toBe(Math.round(vw))
  expect(page).toContain('.narrow{display:none}figure.scrolls .narrow{display:inline}')
  expect(page).toContain('<figcaption><span class="narrow">Scroll the figure sideways to see all of it. </span>')
})

test('the scroll hint shows exactly when a figure\'s frame scrolls, judged on load and on resize', async () => {
  // the test kit cannot run the page's script, so its one rule is read from the script itself
  const page = render(await example()).html
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)![1]
  const hint = /function hint\(\)\{([^\n]*)\}\n/.exec(script)![1]
  expect(hint).toContain("var fr=f.querySelector('.frame');if(fr)f.classList.toggle('scrolls',fr.scrollWidth>fr.clientWidth+2)")
  expect(script).toContain("hint();window.addEventListener('resize',hint);")
  expect(page).not.toContain('@media (max-width:700px){.narrow')
})

// ------------------------------------------- R3-04, R3-05, R3-06: a shadow shows and carries what it copies

const shadowModel = (emphasis = false) => probe({
  figures: [{ id: 'f1', title: 'Figure one', question: 'Q one?' }, { id: 'f2', title: 'Figure two', question: 'Q two?' }],
  ...(emphasis ? { emphasis: { name: 'Hot', rule: 'the ones on fire' } } : {}),
  nodes: [
    { id: 'c1', kind: 'cloud', figure: 'f1', at: [0, 0] }, { id: 's1', kind: 'stock', figure: 'f1', at: [2, 0], label: 'Backlog' },
    { id: 'c2', kind: 'cloud', figure: 'f1', at: [0, 1.5] }, { id: 's2', kind: 'stock', figure: 'f1', at: [2, 1.5], label: 'Done work' },
    { id: 'sh_miss', kind: 'shadow', figure: 'f2', at: [0, 0], of: 'fl_miss' },
    { id: 'sh_mod', kind: 'shadow', figure: 'f2', at: [2, 0], of: 'fl_mod' },
    { id: 't', kind: 'aux', figure: 'f2', at: [1, 1], label: 'target' },
  ],
  flows: [
    { id: 'fl_miss', from: 'c1', to: 's1', label: 'logged', status: 'missing', claim: 'nothing logs arrivals', ...(emphasis ? { emphasis: 'never logged' } : {}) },
    { id: 'fl_mod', from: 'c2', to: 's2', label: 'finished', status: 'modelled', claim: 'work finishes at some rate' },
  ],
  links: [{ id: 'mt', from: 'sh_mod', to: 't', polarity: '+' }],
})

test('a copy of a missing element is marked apart from a copy of a modelled one: dashed and crossed', async () => {
  const page = render(await shadowModel())
  expect(page.legend).toContain('shadow|missing')
  expect(page.legend).toContain('shadow|modelled')
  expect(groupOf(page.html, 'sh_miss')).toContain('class="miss-x sm"')
  expect(groupOf(page.html, 'sh_mod')).toContain('class="shadow-ul"')
  expect(groupOf(page.html, 'sh_mod')).not.toContain('miss-x')
  const k = keys(page.html)
  const miss = k.find(e => e.text.includes('something missing'))!
  const mod = k.find(e => e.text.includes('something modelled'))!
  // the CSS paints both status classes alike, so the drawing itself must differ
  const drawn = (s: string) => s.replace(/ class="[^"]*"/g, '')
  expect(drawn(miss.swatch)).not.toBe(drawn(mod.swatch))
  expect(miss.text).toContain('underlined dashed and crossed (×)')
  expect(mod.text).toContain('underlined dashed,')
  expect(mod.text).not.toContain('crossed')
})

test('a copy\'s detail panel carries the copied element\'s status, claim, evidence and highlight', async () => {
  const page = render(await example(m => {
    m.emphasis = { name: 'Backlog', rule: 'where the backlog shows' }
    Object.assign(m.nodes.find((n: Json) => n.id === 'queue'), { status: 'modelled', claim: 'the queue is in memory', emphasis: 'the backlog', detail: 'Held in memory.' })
  }))
  const info = infoOf(page.html)
  const copy = info.queue_seen
  const original = info.queue
  for (const k of ['s', 'c', 'e', 'x', 'd', 'u']) expect(copy[k]).toEqual(original[k])
  expect(copy.s).toBe('modelled')
  expect(copy.c).toBe('the queue is in memory')
  expect(copy.e.length).toBeGreaterThan(0)
  expect(copy.t).toBe('<Queued jobs>')
  expect(copy.k).toBe('copy (shadow)')
  expect(copy.o).toBe('A copy of “Queued jobs”, which is drawn in full elsewhere on this page.')
  // the panel script prints that line
  expect(page.html).toContain("if(i.o)h+='<p>'+esc(i.o)+'</p>';")
})

test('a copy of a highlighted element is highlighted too: colour, name, the figure\'s list, legend and reader view', async () => {
  const page = render(await example(m => {
    m.emphasis = { name: 'Backlog', rule: 'where the backlog shows' }
    m.nodes.find((n: Json) => n.id === 'queue').emphasis = 'the backlog'
  }))
  const f2 = sectionOf(page.html, 'f2')
  expect(/<g [^>]*data-id="queue_seen"[^>]*>/.exec(f2)![0]).toContain('class="el shadow obs emph"')
  expect(f2).toContain('aria-label="copy of Queued jobs, highlighted"')
  expect(f2).toContain('<li>Queued jobs (copy): the backlog</li>')
  expect(page.legend).toContain('shadow|observed|emph')
  const entry = keys(page.html).find(k => k.swatch.includes('class="el shadow obs emph"'))!
  expect(entry.text).toContain('It is highlighted (Backlog): where the backlog shows.')
  expect(page.html).toContain('svg .emph :is(.link-head,.pipe-head,.aux-dot,.lbl,.st-title,.shadow-lbl)')
  const f2text = page.readerView.slice(page.readerView.indexOf('## Figure: Who notices a backlog'))
  expect(f2text).toContain('Copies of elements drawn elsewhere: <Queued jobs> (highlighted)')
  expect(f2text).toContain('Highlighted: Queued jobs (copy): the backlog')
  // a highlighted copy of a missing element keeps its cross, in the alert colour
  const hot = render(await shadowModel(true))
  expect(hot.legend).toContain('shadow|missing|emph')
  expect(groupOf(hot.html, 'sh_miss')).toContain('class="el shadow miss emph"')
  expect(groupOf(hot.html, 'sh_miss')).toContain('miss-x')
})

test('a modelled copy is underlined, an observed copy is not, and the legend says where the original is', async () => {
  const plain = render(await example())
  expect(groupOf(plain.html, 'queue_seen')).not.toContain('shadow-ul')
  expect(keys(plain.html).some(k => k.text.includes('is a copy of something drawn in full elsewhere on this page (a shadow)'))).toBe(true)
  const modelled = render(await example(m => { Object.assign(m.nodes.find((n: Json) => n.id === 'queue'), { status: 'modelled', claim: 'the queue is in memory' }) }))
  expect(groupOf(modelled.html, 'queue_seen')).toContain('class="shadow-ul"')
})

test('a copy\'s panel and figure list the loops through its own links, not those of the original', async () => {
  // S feeds its own inflow (R1); a copy of S, drawn beside it, reads the outflow (B1)
  const page = render(await probe({
    nodes: [
      { id: 'c', kind: 'cloud', figure: 'f1', at: [0, 0] }, { id: 'S', kind: 'stock', figure: 'f1', at: [2, 0], label: 'Backlog', units: 'items' },
      { id: 'd', kind: 'cloud', figure: 'f1', at: [4, 0] }, { id: 'sh', kind: 'shadow', figure: 'f1', at: [3, 1], of: 'S' },
    ],
    flows: [{ id: 'fill', from: 'c', to: 'S', label: 'filled', units: 'items/day' }, { id: 'drain', from: 'S', to: 'd', label: 'drained', units: 'items/day' }],
    links: [{ id: 'sf', from: 'S', to: 'fill', polarity: '+' }, { id: 'shd', from: 'sh', to: 'drain', polarity: '+' }],
    loops: [{ id: 'R1', name: 'Backlog feeds itself', path: ['S', 'fill'], story: 'More backlog, more filled, more backlog.' }, { id: 'B1', name: 'Backlog drains', path: ['S', 'drain'], minor: true }],
  }))
  const info = infoOf(page.html)
  expect([...info.S.l].sort()).toEqual(['B1', 'R1'])
  expect(info.sh.l).toEqual(['B1'])
  expect(/<g [^>]*data-id="sh"[^>]*>/.exec(page.html)![0]).toContain('data-loops="B1"')
})

// ------------------------------- R4-03: one rectangle for a shadow's extent, read by its link exits and the lint

/** Copies of a missing flow, each with a link to a variable below, below-right, right and level-right. */
const missingCopies = (extra: Json[] = []) => probe({
  figures: [{ id: 'f1', title: 'Figure one', question: 'Q one?' }, { id: 'f2', title: 'Figure two', question: 'Q two?' }],
  nodes: [
    { id: 'c1', kind: 'cloud', figure: 'f1', at: [0, 0] }, { id: 's1', kind: 'stock', figure: 'f1', at: [2, 0], label: 'Backlog', units: 'items' },
    ...[[0.5, 1.3], [1.6, 1.3], [1.6, 0.4], [1.6, 0]].flatMap(([dx, dy], i) => [
      { id: `sh${i}`, kind: 'shadow', figure: 'f2', at: [i * 3, 0], of: 'logged' },
      { id: `t${i}`, kind: 'aux', figure: 'f2', at: [i * 3 + dx, dy + 0.001], label: `alarm ${i}` },
    ]),
    ...extra,
  ],
  flows: [{ id: 'logged', from: 'c1', to: 's1', label: 'logged arrivals with a longer label', units: 'items/day', status: 'missing' }],
  links: [0, 1, 2, 3].map(i => ({ id: `l${i}`, from: `sh${i}`, to: `t${i}`, polarity: '+', status: 'missing', bend: 0 })),
})

test('a link out of a copy of a missing element leaves past its ×, and is not reported as crossing it', async () => {
  const page = render(await missingCopies())
  expect(page.layout.filter(i => i.code === 'G03')).toEqual([])
  for (const i of [0, 1, 2, 3]) {
    const x = /class="miss-x sm" d="M([-\d.]+),([-\d.]+)/.exec(groupOf(page.html, `sh${i}`))!.map(Number)
    const start = /class="link-path" d="M([-\d.]+),([-\d.]+)/.exec(groupOf(page.html, `l${i}`))!.map(Number)
    // the drawn × spans 7 px from (x[1], x[2]); the link starts clear of it
    const dx = Math.max(x[1] - start[1], 0, start[1] - (x[1] + 7))
    const dy = Math.max(x[2] - start[2], 0, start[2] - (x[2] + 7))
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(3)
  }
})

test('a missing copy\'s × is part of its extent: a label forced onto the × alone is flagged', async () => {
  // a variable right of sh0, its label forced left: 3 px clear of the copy's name, over its ×
  const w = textWidth('<logged arrivals with a longer label>', 12)
  const x = 80 + w / 2 + 6 + 13 + textWidth('z', 12)
  const page = render(await missingCopies([{ id: 'z', kind: 'aux', figure: 'f2', at: [(x - 80) / 190, 0.1], label: 'z', label_at: 'left' }]))
  const meets = (p: Rendered) => p.layout.filter(i => i.code === 'G02' && `${i.where} ${i.message}`.includes('shadow of "sh0"') && `${i.where} ${i.message}`.includes('label of "z"'))
  expect(meets(page).length).toBe(1)
  // the same label one × further right is clear of it
  expect(meets(render(await missingCopies([{ id: 'z', kind: 'aux', figure: 'f2', at: [(x + 8 - 80) / 190, 0.1], label: 'z', label_at: 'left' }])))).toEqual([])
})

// -------------------------------------------------------------------- R3-07, R3-11: the R/B tag colours

const designedOnly = () => example(m => {
  m.links = m.links.filter((l: Json) => !['busy_done', 'busy_fail', 'busy_drop', 'busy_dispatch', 'q_dispatch', 'pages_resolve'].includes(l.id))
  m.loops = []; m.answer.loops = []
  m.links.push({ status: 'intended', id: 'q_sub', from: 'queue', to: 'submitted', polarity: '-', mechanism: 'callers back off', claim: 'DESIGN.md asks for it' })
})

test('the R/B tag swatch letters carry no text halo', async () => {
  const page = render(await designedOnly())
  expect(page.legend).toContain('pill')
  const pill = keys(page.html).find(k => k.text.includes('tag marks a loop'))!
  expect(pill.swatch).toContain('<g class="pill-sw">')
  expect(pill.swatch).not.toContain('fill="#fff"')
  expect(page.html).toContain('svg .pill-sw text{stroke:none;fill:var(--on-tag)')
})

test('the R/B tags are readable in both themes: text on the tag colour is at least 4.5:1', async () => {
  const css = /<style>([\s\S]*?)<\/style>/.exec(render(await designedOnly()).html)![1]
  const lum = (hex: string) => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  // the light tokens, and both dark blocks (the media query and the explicit theme)
  const blocks = [...css.matchAll(/\{(--bg:[^}]*)\}/g)].map(b => Object.fromEntries([...b[1].matchAll(/--([\w-]+):(#[0-9a-f]{6})/g)].map(x => [x[1], x[2]])))
  expect(blocks.length).toBe(3)
  expect(blocks.map(b => b['on-tag'])).toEqual(['#ffffff', '#151514', '#151514'])
  for (const b of blocks) for (const tag of ['r', 'b']) expect(contrast(b['on-tag'], b[tag])).toBeGreaterThanOrEqual(4.5)
  expect(css).toContain('.pill{display:inline-block;font-size:11px;font-weight:700;border-radius:4px;padding:0 5px;margin-right:5px;color:var(--on-tag)')
})

// --------------------------------------------- R3-08: a missing pipe's × sits in the room it has, never on the arrowhead

const missingPipe = async (gap: number, valve?: number) => {
  const page = render(await probe({
    nodes: [{ id: 'S1', kind: 'stock', figure: 'f1', at: [0, 0], label: 'Pending' }, { id: 'S2', kind: 'stock', figure: 'f1', at: [gap, 0], label: 'Done' }],
    flows: [{ id: 'fx', from: 'S1', to: 'S2', label: 'moved', status: 'missing', ...(valve ? { valve } : {}) }],
  }))
  return flowGeometry(groupOf(page.html, 'fx'))
}

test('a missing pipe\'s × is centred between the valve and the arrowhead, else upstream, else over the valve', async () => {
  // long: downstream, centred between the valve's edge (11 px) and the arrowhead's base (12 px back from the tip)
  const long = await missingPipe(1.5)
  const down = dist(long.valve, long.tip)
  expect(long.cross!.x).toBeGreaterThan(long.valve.x)
  near(dist(long.valve, long.cross!), 11 + (down - 23) / 2)
  // a short run after the valve: upstream, by the same rule
  const late = await missingPipe(2, 0.85)
  expect(dist(late.valve, late.tip) - 23).toBeLessThan(14)
  expect(late.cross!.x).toBeLessThan(late.valve.x)
  near(dist(late.valve, late.cross!), 11 + (dist(late.valve, late.start) - 23) / 2)
  // no room either side: over the valve, painted after it
  const tiny = await missingPipe(0.95)
  expect(dist(tiny.valve, tiny.cross!)).toBeLessThan(0.2)
  const g = groupOf(render(await probe({
    nodes: [{ id: 'S1', kind: 'stock', figure: 'f1', at: [0, 0], label: 'Pending' }, { id: 'S2', kind: 'stock', figure: 'f1', at: [0.95, 0], label: 'Done' }],
    flows: [{ id: 'fx', from: 'S1', to: 'S2', label: 'moved', status: 'missing' }],
  })).html, 'fx')
  expect(g.indexOf('valve-shape')).toBeLessThan(g.indexOf('miss-x'))
  // never on the arrowhead or the valve where there is room
  for (const p of [long, late]) {
    expect(dist(p.cross!, p.valve)).toBeGreaterThanOrEqual(11 + 7)
    expect(dist(p.cross!, p.tip)).toBeGreaterThanOrEqual(12 + 7)
  }
})

test('the legend\'s missing-pipe swatch places its × as the figures do', async () => {
  const page = render(await probe({
    nodes: [{ id: 'S1', kind: 'stock', figure: 'f1', at: [0, 0], label: 'Pending' }, { id: 'S2', kind: 'stock', figure: 'f1', at: [1.5, 0], label: 'Done' }],
    flows: [{ id: 'fx', from: 'S1', to: 'S2', label: 'moved', status: 'missing' }],
  }))
  const sw = keys(page.html).find(k => k.swatch.includes('miss-x') && k.swatch.includes('pipe-head'))!.swatch
  const g = flowGeometry(sw)
  expect(g.cross!.x).toBeGreaterThan(g.valve.x)
  near(dist(g.valve, g.cross!), 11 + (dist(g.valve, g.tip) - 23) / 2)
})

// ------------------------------------------------- R3-09: round-2 renderer fixes that had no failing test

test('labels keep off arrowheads, delay marks and crosses: one forced onto them is flagged', async () => {
  const page = render(await probe({
    nodes: [
      // a link P → T arrives at T from the right; T's label is forced onto its arrowhead
      { id: 'T', kind: 'aux', figure: 'f1', at: [0, 0], label: 'target', label_at: 'right' },
      { id: 'P', kind: 'aux', figure: 'f1', at: [1.5, 0], label: 'source' },
      // straight links Q → R (read late) and U → W (missing) pass under V's and X's labels at their middles
      { id: 'Q', kind: 'aux', figure: 'f1', at: [0, 2], label: 'q', label_at: 'left' },
      { id: 'R', kind: 'aux', figure: 'f1', at: [2, 2], label: 'r', label_at: 'right' },
      { id: 'V', kind: 'aux', figure: 'f1', at: [1, 1.8], label: 'over the bars', label_at: 'below' },
      { id: 'U', kind: 'aux', figure: 'f1', at: [0, 3.5], label: 'u', label_at: 'left' },
      { id: 'W', kind: 'aux', figure: 'f1', at: [2, 3.5], label: 'w', label_at: 'right' },
      { id: 'X', kind: 'aux', figure: 'f1', at: [1, 3.3], label: 'over the cross', label_at: 'below' },
    ],
    links: [
      { id: 'pt', from: 'P', to: 'T', polarity: '+', bend: 0 },
      { id: 'qr', from: 'Q', to: 'R', polarity: '+', bend: 0, delay: true },
      { id: 'uw', from: 'U', to: 'W', polarity: '+', bend: 0, status: 'missing' },
    ],
  }))
  const said = page.layout.map(i => `${i.code} ${i.where}: ${i.message}`).join('\n')
  expect(said).toContain('G02 label of "T": overlaps the arrowhead of "pt"')
  expect(said).toContain('G02 label of "V": overlaps the delay mark of "qr"')
  expect(said).toContain('G02 label of "X": overlaps the cross of "uw"')
})

test('a link into a flow\'s valve ends on the pipe by design and is not flagged', async () => {
  const page = render(await example())
  expect(page.layout).toEqual([])
  const a = await example()
  expect(a.model!.links.some(l => a.model!.flows.some(f => f.id === l.to))).toBe(true)
})

test('the detail panel carries detail, units and an extract\'s origin from the same rows as the table', async () => {
  const info = infoOf(render(await example(m => {
    m.nodes.find((n: Json) => n.id === 'queue').detail = 'Held in memory; lost on restart.'
    Object.assign(m.flows.find((f: Json) => f.id === 'resolved'), { evidence: [{ url: 'https://example.com/runbook', quote: 'close each page by hand', from: 'pdftotext runbook.pdf' }] })
  })).html)
  expect(info.queue.d).toBe('Held in memory; lost on restart.')
  expect(info.queue.u).toBe('jobs')
  expect(info.resolved.e[0]).toEqual({ r: 'https://example.com/runbook', q: 'close each page by hand', u: true, f: 'pdftotext runbook.pdf' })
})

test('wide letters are measured wide: M and W at 0.9 em, any other capital at 0.7 em', () => {
  near(textWidth('MW', 10), 18, 0.01)
  near(textWidth('ÉÅ', 10), 14, 0.01)
})

// --------------------------------------------- R4-04: a cited path is printed exactly as the checker read it

test('a cited path is printed as written: two spaces stay two, in the panel data, the page and the reader view', async () => {
  const files: Record<string, string> = { 'Queue  Notes.py': 'jobs = deque()\n', 'Queue Notes.py': 'def submit(job): jobs.append(job)\n' }
  const model = (path: string) => ({
    spec: 'dynamics/1', title: 'Probe', subject: { name: 'probe', kind: 'codebase', roots: { code: './src' }, date: '2026-10-22' },
    question: 'What happens?', answer: { text: 'Something.', loops: [] }, time_unit: 'day', boundary: { excluded: [] },
    figures: [{ id: 'f1', title: 'Figure one', question: 'Q one?' }],
    nodes: [
      { id: 'c', kind: 'cloud', figure: 'f1', at: [0, 0], why_outside: 'callers' },
      // "lines" may hold spaces around the number (a line break is refused); the page prints the range it names
      { id: 'S', kind: 'stock', figure: 'f1', at: [2, 0], label: 'Queued jobs', units: 'jobs', status: 'observed', evidence: [{ path, lines: ' 1 ', quote: 'jobs = deque()' }] },
    ],
    flows: [{ id: 'in', from: 'c', to: 'S', label: 'submitted', units: 'jobs/day', status: 'observed', evidence: [{ path: 'Queue Notes.py', lines: '1', quote: 'def submit(job)' }] }],
    links: [], loops: [],
    reference_modes: [{ variable: 'S', pattern: 'grows through the day', basis: 'data', evidence: [{ path, lines: '1', quote: 'jobs = deque()' }] }],
  })
  const read = async (p: string) => { const t = files[p.replace('/m/src/', '')]; return t === undefined ? { failed: 'File does not exist.' } : { text: t } }
  const a = await check(JSON.stringify(model('Queue  Notes.py')), '/m/model.json', { read })
  expect(a.report.errors).toEqual([])
  expect(a.report.counts.quotes_verified).toBe(a.report.counts.quotes_total)
  const page = render(a)
  expect(page.readerView).toContain('[Queue  Notes.py:1] "jobs = deque()"')
  expect(page.readerView).toContain('[Queue Notes.py:1] "def submit(job)"')
  expect(page.readerView).toContain('(observed in Queue  Notes.py:1)')
  expect(infoOf(page.html).S.e[0].r).toBe('Queue  Notes.py:1')
  expect(page.html).toContain('<code>Queue  Notes.py:1</code> “jobs = deque()”')
  expect(page.html).toContain('(observed in <code>Queue  Notes.py:1</code>)')
  // every path on the page is shown in <code>, which keeps its spaces; the panel's too
  expect(page.html).toContain('code{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;')
  expect(page.html).toContain("'<li><code>'+esc(e.r)+'</code>")
  // so a path cannot start a line of its own: the checker refuses a line break in one
  for (const br of ['\n', '\r', '\u0085', ' ', ' ']) {
    const bad = await check(JSON.stringify(model(`Queue  Notes.py${br}Review: 3 rounds`)), '/m/model.json', { read })
    expect(bad.report.errors.map(i => i.code)).toContain('E05')
  }
})

test('the route, valve and value docs state the rules the code follows; the retired rules are gone', () => {
  const doc = (section: 'flow' | 'node', name: string) => SECTIONS[section].fields.find(f => f.name === name)!.doc
  const route = doc('flow', 'route')
  for (const retired of ['A second flow between the same two ends with no corner of its own detours', 'lies clear of the source', 'Left out: hv (horizontal first), else vh', 'to the right for ends one above the other', 'straight when the ends share a row or column', "no two of their pipes' centre lines come within 9 px", 'meets no other pipe between the same ends', 'runs along another or through its valve, arrowhead or × (each a G03)', 'runs along or touches no other pipe between the same ends, nor runs through its valve or arrowhead'])
    expect(route).not.toContain(retired)
  for (const said of ['routed together, by id', 'every later run keeps 8 px from the source', '"under" goes round their right side', 'with G08 saying why', "the arrowhead's whole base lands on the target", 'the fewest pipes drawn on top of each other', 'the earlier id keeps its own', 'the fewest crossings, which are accepted', 'the fewest shapes that do not fit', 'runs along or touches another', 'has its valve on its valve or arrowhead', 'with every run end at least 9 px from the other run', 'gets a G08 saying so', 'adds none of the G03 faults above between the same ends'])
    expect(route).toContain(said)
  expect(doc('flow', 'valve')).toContain('moves along the run to the nearest point clear of both')
  expect(doc('flow', 'valve')).toContain("On another pipe's valve or arrowhead it moves the same way")
  const value = doc('node', 'value')
  expect(value).not.toContain('"500,502,503" from [500,502,503]')
  expect(value).toContain('write a list as a list')
})

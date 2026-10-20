import { describe, expect, test } from 'claude-code/testing'
import { buildHtml, canonicalCycle, checkModel, layoutModel, parseModel, type SdModel } from '../hooks/model'

// A small support desk: two balancing loops (capacity, deterrence) and one reinforcing loop
// (word of mouth) that arrives in a later stage.
function sample(): SdModel {
  return {
    meta: { title: 'Desk Dynamics', subject: 'Support desk', sources: ['docs/desk.md'] },
    stages: [{ id: 'v1', label: 'Launch' }, { id: 'v2', label: 'Growth' }],
    nodes: [
      { id: 'src', name: 'Requests', kind: 'cloud', col: 1, row: 3 },
      { id: 'done', name: 'Closed', kind: 'cloud', col: 8, row: 3 },
      { id: 'backlog', name: 'Open backlog', kind: 'stock', meaning: 'Requests waiting', refs: ['docs/desk.md'], col: 4, row: 3, stage: 'v1' },
      { id: 'intake', name: 'Intake', kind: 'flow', flow_from: 'src', flow_to: 'backlog', meaning: 'New requests', stage: 'v1' },
      { id: 'resolution', name: 'Resolution', kind: 'flow', flow_from: 'backlog', flow_to: 'done', meaning: 'Requests closed', stage: 'v1' },
      { id: 'capacity', name: 'Agent capacity', kind: 'parameter', meaning: 'Agents on shift', refs: ['docs/desk.md'], col: 6, row: 5, stage: 'v1' },
      { id: 'wait', name: 'Wait time', kind: 'auxiliary', meaning: 'Hours to first reply', refs: ['docs/desk.md'], col: 4, row: 5, stage: 'v1' },
      { id: 'src2', name: 'Prospects', kind: 'cloud', col: 1, row: 1 },
      { id: 'users', name: 'Active users', kind: 'stock', meaning: 'People using the product', refs: ['docs/desk.md'], col: 4, row: 1, stage: 'v2' },
      { id: 'signups', name: 'Signups', kind: 'flow', flow_from: 'src2', flow_to: 'users', meaning: 'New users', stage: 'v2' },
    ],
    links: [
      { from: 'intake', to: 'backlog', polarity: '+', mechanism: 'Definition: requests queue up', evidence: 'inferred' },
      { from: 'resolution', to: 'backlog', polarity: '-', mechanism: 'Definition: closed requests leave', evidence: 'inferred' },
      { from: 'backlog', to: 'resolution', polarity: '+', mechanism: 'More work in hand, more closed', evidence: 'documented', refs: ['docs/desk.md'] },
      { from: 'capacity', to: 'resolution', polarity: '+', mechanism: 'More agents close more', evidence: 'documented', refs: ['docs/desk.md'] },
      { from: 'backlog', to: 'wait', polarity: '+', mechanism: 'Longer queue, longer wait', evidence: 'documented', refs: ['docs/desk.md'] },
      { from: 'wait', to: 'intake', polarity: '-', mechanism: 'Long waits deter requests', evidence: 'hypothesis' },
      { from: 'signups', to: 'users', polarity: '+', mechanism: 'Definition: new users join', evidence: 'inferred' },
      { from: 'users', to: 'signups', polarity: '+', mechanism: 'Word of mouth', evidence: 'inferred', delay: true },
      { from: 'users', to: 'intake', polarity: '+', mechanism: 'More users, more requests', evidence: 'documented', refs: ['docs/desk.md'] },
    ],
    loops: [
      { id: 'B1', type: 'B', name: 'Working the queue', path: ['backlog', 'resolution'], story: 'A longer queue gets worked faster.', stage: 'v1', col: 5, row: 4 },
      { id: 'B2', type: 'B', name: 'Deterrence', path: ['backlog', 'wait', 'intake'], story: 'Long waits put people off asking.', stage: 'v1', col: 3, row: 4 },
      { id: 'R1', type: 'R', name: 'Word of mouth', path: ['users', 'signups'], story: 'Users bring users.', stage: 'v2', col: 3, row: 2 },
    ],
  }
}

const errorsOf = (m: SdModel) => checkModel(m).errors.join('\n')
const warningsOf = (m: SdModel) => checkModel(m).warnings.join('\n')
const isAscii = (s: string) => [...s].every(ch => ch.charCodeAt(0) < 128)

describe('check_model', () => {
  test('a well-formed model has no errors', () => {
    const r = checkModel(sample())
    expect(r.errors).toEqual([])
    expect(r.stats.loops_balancing).toBe(2)
    expect(r.stats.loops_reinforcing).toBe(1)
    expect(r.stats.links_hypothesis).toBe(1)
  })

  test('loop type must match the parity of its "-" links', () => {
    const m = sample()
    m.loops[0] = { ...m.loops[0]!, type: 'R' }
    expect(errorsOf(m)).toMatch(/B1 is declared R but has 1 "-" link/)
  })

  test('an open loop is an error', () => {
    const m = sample()
    m.loops.push({ id: 'B9', type: 'B', name: 'Broken', path: ['wait', 'capacity'], story: 'x', stage: 'v1' })
    expect(errorsOf(m)).toMatch(/B9 is not closed: there is no link wait -> capacity/)
  })

  test('a flow must fill with "+" and drain with "-"', () => {
    const m = sample()
    m.links[1] = { ...m.links[1]!, polarity: '+' }
    expect(errorsOf(m)).toMatch(/drains its flow_from stock, so the link must be "-"/)
  })

  test('only a stock\'s own flows change it', () => {
    const m = sample()
    m.links.push({ from: 'capacity', to: 'backlog', polarity: '-', mechanism: 'Agents shrink the queue', evidence: 'inferred' })
    expect(errorsOf(m)).toMatch(/link capacity -> backlog: only a stock's own flows change it/)
  })

  test('the same link twice with a different sign is an error; an exact repeat a warning', () => {
    const m = sample()
    m.links.push({ ...m.links[4]!, polarity: '-' })
    expect(errorsOf(m)).toMatch(/link backlog -> wait is listed twice with a different sign or delay/)
    const n = sample()
    n.links.push({ ...n.links[4]! })
    expect(errorsOf(n)).toBe('')
    expect(warningsOf(n)).toMatch(/link backlog -> wait is listed twice; the first is used/)
  })

  test('a loop cannot arrive before its links', () => {
    const m = sample()
    m.loops[2] = { ...m.loops[2]!, stage: 'v1' }
    expect(errorsOf(m)).toMatch(/R1 is in stage "v1" but one of its links or nodes arrives in "v2"/)
  })

  test('a loop with no stage in a staged model is an error when its links arrive later', () => {
    const m = sample()
    delete m.loops[2]!.stage
    expect(errorsOf(m)).toMatch(/R1 has no stage but its links arrive in "v2"/)
  })

  test('a flow cannot arrive before the stock it fills', () => {
    const m = sample()
    m.nodes[9] = { ...m.nodes[9]!, stage: 'v1' }
    expect(errorsOf(m)).toMatch(/flow "signups" is in an earlier stage than the stock it fills \("users"\)/)
  })

  test('a loop through no stock is flagged', () => {
    const m = sample()
    m.nodes.push({ id: 'policy', name: 'Triage policy', kind: 'decision', meaning: 'How hard to triage', refs: ['docs/desk.md'], col: 7, row: 6, stage: 'v1' })
    m.links.push({ from: 'wait', to: 'policy', polarity: '+', mechanism: 'Long waits tighten triage', evidence: 'inferred' })
    m.links.push({ from: 'policy', to: 'wait', polarity: '-', mechanism: 'Triage cuts waits', evidence: 'inferred' })
    m.loops.push({ id: 'B3', type: 'B', name: 'Triage', path: ['wait', 'policy'], story: 'Waits tighten triage.', stage: 'v1', col: 6, row: 7 })
    expect(errorsOf(m)).toBe('')
    expect(warningsOf(m)).toMatch(/loop B3 passes through no stock/)
  })

  test('stocks drawn on top of each other make the pipe draw backwards', () => {
    const m = sample()
    m.nodes[1] = { ...m.nodes[1]!, col: 4, row: 3 }
    expect(errorsOf(m)).toMatch(/flow "resolution": "backlog" and "done" overlap, so the pipe would draw backwards/)
  })

  test('unnamed feedback cycles are reported', () => {
    const m = sample()
    m.loops = m.loops.filter(l => l.id !== 'B2')
    expect(checkModel(m).notes.join('\n')).toMatch(/Unnamed cycles.*B: backlog -> wait -> intake/)
  })

  test('cycles compare whatever their starting node', () => {
    expect(canonicalCycle(['wait', 'intake', 'backlog'])).toBe(canonicalCycle(['backlog', 'wait', 'intake']))
  })

  test('parse normalises spellings and rejects the wrong shape', () => {
    expect(parseModel({ nodes: [] }).errors.join(' ')).toMatch(/links/)
    const raw = JSON.parse(JSON.stringify(sample()))
    raw.links[1].polarity = String.fromCharCode(0x2212)
    raw.nodes[2].kind = 'STOCK'
    const { model } = parseModel(raw)
    expect(model?.links[1]?.polarity).toBe('-')
    expect(model?.nodes[2]?.kind).toBe('stock')
  })
})

describe('render', () => {
  const TEMPLATE = '<title>@@TITLE@@</title><p>@@EYEBROW@@</p><p>@@LEDE@@</p><footer>@@FOOT@@</footer><svg aria-label="@@ARIA@@" viewBox="@@VIEWBOX@@" style="min-width:@@MINWIDTH@@px"></svg><script>/*@@DATA@@*/</script><script>/*@@RENDERER@@*/</script>'

  test('the page is ASCII-only and keeps model text out of the markup', () => {
    const m = sample()
    m.meta = { ...m.meta, title: `Caf${String.fromCharCode(0xe9)} Dynamics`, lede: '<script>alert(1)</script>' }
    m.loops[0] = { ...m.loops[0]!, story: '</script><script>alert(2)</script>' }
    const html = buildHtml(m, layoutModel(m), TEMPLATE, 'void 0')
    expect(isAscii(html)).toBe(true)
    expect(html).toContain('<title>Caf&#xe9; Dynamics</title>')
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('</script><script>alert')
  })

  test('markers inside model text are never filled', () => {
    const m = sample()
    m.meta = { ...m.meta, title: '@@DATA@@', subject: '@@RENDERER@@', lede: '/*@@RENDERER@@*/', verification: '@@LEDE@@ /*@@DATA@@*/' }
    m.loops[0] = { ...m.loops[0]!, name: '/*@@DATA@@*/', story: '@@TITLE@@' }
    const html = buildHtml(m, layoutModel(m), TEMPLATE, 'RENDERER_BODY')
    expect(html).not.toContain('@@')
    expect(html.split('RENDERER_BODY')).toHaveLength(2)
    expect(html.split('window.MODEL = ')).toHaveLength(2)
    const data = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'))
    const lines = data.split('\n')
    expect(lines).toHaveLength(5)
    for (const line of lines) {
      const json = line.slice(line.indexOf(' = ') + 3, -1)
      expect(() => JSON.parse(json)).not.toThrow()
    }
    const model = JSON.parse(lines[0]!.slice(lines[0]!.indexOf(' = ') + 3, -1))
    expect(model.loops[0].story).toBe('@@TITLE@@')
  })

  test('layout places every non-flow node, spare row for the unplaced', () => {
    const m = sample()
    delete m.nodes[5]!.col
    const layout = layoutModel(m)
    expect(layout.unplaced).toEqual(['capacity'])
    expect(layout.pos.size).toBe(m.nodes.filter(n => n.kind !== 'flow').length)
  })
})

describe('the plugin', () => {
  const OUT = '/scratch/desk.html'

  test('check_model answers through the engine', async $ => {
    const r = await $.tool.call({ tool: 'mcp__dynamics__check_model', model: sample() })
    expect(String(r.result ?? '')).toMatch(/^CLEAN/)
  })

  test('check_model reads only .json files', async $ => {
    const r = await $.tool.call({ tool: 'mcp__dynamics__check_model', path: '/etc/passwd' })
    expect(String(r.result ?? '')).toMatch(/^Pass `path`/)
  })

  test('render_model refuses a relative path and a model with errors', async $ => {
    const rel = await $.tool.call({ tool: 'mcp__dynamics__render_model', model: sample(), out: 'x.html' })
    expect(String(rel.result ?? '')).toMatch(/^Pass `out`: an absolute path/)
    const m = sample()
    m.loops[0] = { ...m.loops[0]!, type: 'R' }
    const bad = await $.tool.call({ tool: 'mcp__dynamics__render_model', model: m, out: OUT })
    expect(String(bad.result ?? '')).toMatch(/^Not rendered: the model has errors/)
  })

  test('render_model writes the page', async ($, on) => {
    const written: { path: string; text: string }[] = []
    on('tool.check', () => ({ decision: 'allow' }))
    on('fs.exists', () => ({ value: false }))
    on('fs.read', (_$, e) => ({ value: e.path.endsWith('template.html') ? '<title>@@TITLE@@</title><script>/*@@DATA@@*/</script><script>/*@@RENDERER@@*/</script>' : 'void 0' }))
    on('fs.write', (_$, e) => { written.push({ path: e.path, text: e.text }); return { value: undefined } })
    on('fs.stat', (_$, e) => ({ value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false, realPath: e.path } }))
    const r = await $.tool.call({ tool: 'mcp__dynamics__render_model', model: sample(), out: OUT })
    expect(String(r.result ?? '')).toMatch(/^Wrote \S*desk\.html: 2 stocks, 3 flows, 9 links, 3 loops, 2 stages/)
    expect(written).toHaveLength(1)
    expect(written[0]!.path).toMatch(/desk\.html$/)
    expect(written[0]!.text).toContain('<title>Desk Dynamics</title>')
    expect(isAscii(written[0]!.text)).toBe(true)
  })

  test('render_model will not overwrite a file it did not make', async ($, on) => {
    let writes = 0
    on('tool.check', () => ({ decision: 'allow' }))
    on('fs.exists', () => ({ value: true }))
    on('fs.read', () => ({ value: '<!doctype html><title>Someone else</title>' }))
    on('fs.write', () => { writes++; return { value: undefined } })
    const r = await $.tool.call({ tool: 'mcp__dynamics__render_model', model: sample(), out: OUT })
    expect(String(r.result ?? '')).toMatch(/already exists and was not made by dynamics/)
    expect(writes).toBe(0)
  })

  test('render_model respects a denied write', async ($, on) => {
    on('tool.check', () => ({ decision: 'deny', reason: 'outside the project' }))
    const denied = await $.tool.call({ tool: 'mcp__dynamics__render_model', model: sample(), out: OUT })
    expect(String(denied.result ?? '')).toMatch(/^Not rendered: writing \S*desk\.html is not allowed here \(outside the project\)/)
  })

  test('render_model reports a write that fails', async ($, on) => {
    on('tool.check', () => ({ decision: 'allow' }))
    on('fs.exists', () => ({ value: false }))
    on('fs.read', () => ({ value: '<script>/*@@DATA@@*/</script>' }))
    on('fs.write', () => ({ deny: 'disk full' }))
    const r = await $.tool.call({ tool: 'mcp__dynamics__render_model', model: sample(), out: OUT })
    expect(String(r.result ?? '')).toMatch(/^Could not write \S*desk\.html/)
  })
})

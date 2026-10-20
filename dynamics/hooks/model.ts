// The system-dynamics model: its shape, the deterministic checks, the layout and the page.
// Pure functions (no engine calls), so the hooks module and the tests share them.
// This file is ASCII only: characters beyond it are built with String.fromCharCode.

export type Kind = 'stock' | 'flow' | 'auxiliary' | 'parameter' | 'exogenous' | 'decision' | 'cloud'
export type Evidence = 'documented' | 'inferred' | 'hypothesis'
export const KINDS: readonly Kind[] = ['stock', 'flow', 'auxiliary', 'parameter', 'exogenous', 'decision', 'cloud']
export const EVIDENCE: readonly Evidence[] = ['documented', 'inferred', 'hypothesis']

export interface SdNode {
  id: string
  name: string
  kind: Kind
  meaning?: string
  unit?: string
  stage?: string
  flow_from?: string // kind 'flow' only: the stock or cloud it drains
  flow_to?: string // kind 'flow' only: the stock or cloud it fills
  refs?: string[]
  col?: number // grid placement, 1-based; flows sit between their endpoints instead
  row?: number
  label_side?: 'left' | 'right' // a vertical flow's label side
}
export interface SdLink {
  from: string
  to: string
  polarity: '+' | '-'
  delay?: boolean
  mechanism?: string
  evidence?: Evidence
  stage?: string
  refs?: string[]
  bend?: number // curve: 0 straight, +-0.2 default arc, up to +-0.6
}
export interface SdLoop {
  id: string
  type: 'R' | 'B'
  name: string
  path: string[]
  story?: string
  stage?: string
  refs?: string[]
  col?: number // where the loop marker sits; default: centre of its nodes
  row?: number
}
export interface SdStage { id: string; label?: string; summary?: string }
export interface SdMeta {
  title?: string
  subject?: string
  lede?: string
  overview?: string
  sources?: string[]
  verification?: string
}
export interface SdModel { meta?: SdMeta; stages?: SdStage[]; nodes: SdNode[]; links: SdLink[]; loops: SdLoop[] }

export interface CheckReport {
  errors: string[]
  warnings: string[]
  notes: string[]
  stats: Record<string, number>
}

// Readability caps: past these a diagram stops being readable. Clouds do not count.
export const CAPS = { stocks: 11, flows: 10, others: 16, loops: 9 }
const MAX_CYCLE_LENGTH = 8
const MAX_CYCLES = 500
const MAX_SEARCH_STEPS = 200_000
const MINUS = String.fromCharCode(0x2212)
const MIDDOT = String.fromCharCode(0xb7)
const ID = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const RESERVED = new Set(Object.getOwnPropertyNames(Object.prototype))

// Drawing sizes, shared with assets/renderer.js (keep them in step).
export const CELL_W = 108
export const CELL_H = 112
const MARGIN_X = 90
const MARGIN_Y = 70
const STOCK_HW = 66
const STOCK_HH = 25
const CHAR_W = 6.4

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const strs = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim()) : undefined
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Reads untyped JSON into a model, normalising spellings (a minus sign for -, kinds lowercased). */
export function parseModel(raw: unknown): { model?: SdModel; errors: string[] } {
  if (!isObj(raw)) return { errors: ['the model must be a JSON object with nodes, links and loops'] }
  const errors: string[] = []
  for (const key of ['nodes', 'links', 'loops']) if (!Array.isArray(raw[key])) errors.push(`\`${key}\` must be an array`)
  if (errors.length) return { errors }
  const nodes: SdNode[] = (raw.nodes as unknown[]).filter(isObj).map(n => ({
    id: str(n.id) ?? '',
    name: str(n.name) ?? '',
    kind: (str(n.kind)?.toLowerCase() ?? '') as Kind,
    meaning: str(n.meaning),
    unit: str(n.unit),
    stage: str(n.stage),
    flow_from: str(n.flow_from),
    flow_to: str(n.flow_to),
    refs: strs(n.refs),
    col: num(n.col),
    row: num(n.row),
    label_side: n.label_side === 'left' ? 'left' : n.label_side === 'right' ? 'right' : undefined,
  }))
  const links: SdLink[] = (raw.links as unknown[]).filter(isObj).map(l => {
    const p = String(l.polarity ?? '').trim()
    return {
      from: str(l.from) ?? '',
      to: str(l.to) ?? '',
      polarity: (p === '+' ? '+' : p === '-' || p === MINUS ? '-' : p) as '+' | '-',
      delay: l.delay === true,
      mechanism: str(l.mechanism),
      evidence: str(l.evidence)?.toLowerCase() as Evidence | undefined,
      stage: str(l.stage),
      refs: strs(l.refs),
      bend: num(l.bend),
    }
  })
  const loops: SdLoop[] = (raw.loops as unknown[]).filter(isObj).map(lp => ({
    id: str(lp.id) ?? '',
    type: (str(lp.type)?.toUpperCase() ?? '') as 'R' | 'B',
    name: str(lp.name) ?? '',
    path: strs(lp.path) ?? [],
    story: str(lp.story),
    stage: str(lp.stage),
    refs: strs(lp.refs),
    col: num(lp.col),
    row: num(lp.row),
  }))
  const stages: SdStage[] | undefined = Array.isArray(raw.stages)
    ? raw.stages.filter(isObj).map(s => ({ id: str(s.id) ?? '', label: str(s.label), summary: str(s.summary) }))
    : undefined
  const m = isObj(raw.meta) ? raw.meta : {}
  const meta: SdMeta = {
    title: str(m.title), subject: str(m.subject), lede: str(m.lede), overview: str(m.overview),
    sources: strs(m.sources), verification: str(m.verification),
  }
  return { model: { meta, stages, nodes, links, loops }, errors: [] }
}

const edgeKey = (from: string, to: string) => `${from}>${to}`

interface Box { x: number; y: number; hw: number; hh: number }

/** A node's drawn box, as assets/renderer.js draws it, in drawing units (null for flows). */
function boxOf(n: SdNode, x: number, y: number): Box | null {
  if (n.kind === 'flow') return null
  if (n.kind === 'stock') return { x, y, hw: STOCK_HW, hh: STOCK_HH }
  if (n.kind === 'cloud') return { x, y, hw: 18, hh: 12 }
  const lines = wrapWords(n.name, 18)
  return { x, y, hw: (Math.max(...lines.map(l => l.length)) * CHAR_W + 14) / 2, hh: lines.length * 8 + 5 }
}
function wrapWords(s: string, max: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const w of s.split(' ')) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w } else cur = (cur + ' ' + w).trim()
  }
  if (cur) out.push(cur)
  return out.length ? out : ['']
}
const overlaps = (a: Box, b: Box, pad = 2) => Math.abs(a.x - b.x) < a.hw + b.hw + pad && Math.abs(a.y - b.y) < a.hh + b.hh + pad

/** Every deterministic check: ids, structure, flows, stock rules, loop closure and parity, stages, caps, layout. */
export function checkModel(model: SdModel): CheckReport {
  const errors: string[] = []
  const warnings: string[] = []
  const notes: string[] = []
  const nodes = new Map<string, SdNode>()
  const badId = (id: string) => !ID.test(id) || RESERVED.has(id)
  const idRule = 'ids start with a letter and use letters, digits, _ . or - (and are not names like "constructor")'

  // --- stages
  const stageIds = (model.stages ?? []).map(s => s.id)
  const hasStages = stageIds.length > 0
  stageIds.forEach((id, i) => {
    if (!id) errors.push(`stage #${i + 1} has no id`)
    else if (badId(id)) errors.push(`stage id "${id}" is not allowed: ${idRule}`)
    else if (stageIds.indexOf(id) !== i) errors.push(`stage id "${id}" is used twice`)
  })
  const stageIdx = (s: string | undefined): number => (s === undefined ? 0 : stageIds.indexOf(s))
  const checkStage = (s: string | undefined, what: string) => {
    if (s === undefined) return
    if (!hasStages) warnings.push(`${what} names stage "${s}" but the model lists no stages; it is ignored`)
    else if (!stageIds.includes(s)) errors.push(`${what} names stage "${s}", which is not one of: ${stageIds.join(', ')}`)
  }
  const nodeStage = (id: string) => stageIdx(nodes.get(id)?.stage)

  // --- nodes
  model.nodes.forEach((n, i) => {
    const what = n.id ? `node "${n.id}"` : `node #${i + 1}`
    if (!n.id) { errors.push(`${what} has no id`); return }
    if (badId(n.id)) { errors.push(`${what}: the id is not allowed: ${idRule}`); return }
    if (nodes.has(n.id)) { errors.push(`node id "${n.id}" is used twice`); return }
    nodes.set(n.id, n)
    if (!KINDS.includes(n.kind)) errors.push(`${what} has kind "${n.kind}"; use one of ${KINDS.join(', ')}`)
    if (!n.name) errors.push(`${what} has no name`)
    else if (n.name.split(/\s+/).length > 4) warnings.push(`${what}: name "${n.name}" is longer than 4 words`)
    if (n.kind !== 'cloud' && !n.meaning) warnings.push(`${what} has no meaning`)
    if (n.kind !== 'cloud' && n.kind !== 'flow' && !(n.refs && n.refs.length)) warnings.push(`${what} cites no source (refs); a variable that exists only in a hypothesis cites what it is about and says so in its meaning`)
    checkStage(n.stage, what)
  })
  for (const n of nodes.values()) {
    if (n.kind !== 'flow') continue
    for (const end of ['flow_from', 'flow_to'] as const) {
      const target = n[end]
      const node = target ? nodes.get(target) : undefined
      if (!target) errors.push(`flow "${n.id}" has no ${end}; use a stock, or a cloud for outside the boundary`)
      else if (!node) errors.push(`flow "${n.id}": ${end} "${target}" is not a node (declare clouds as nodes too)`)
      else if (node.kind !== 'stock' && node.kind !== 'cloud') errors.push(`flow "${n.id}": ${end} "${target}" is a ${node.kind}; a flow moves between stocks or clouds`)
      else if (hasStages && node.kind === 'stock' && stageIdx(n.stage) >= 0 && stageIdx(node.stage) > stageIdx(n.stage))
        errors.push(`flow "${n.id}" is in an earlier stage than the stock it ${end === 'flow_to' ? 'fills' : 'drains'} ("${target}")`)
    }
    if (n.flow_from && n.flow_from === n.flow_to) errors.push(`flow "${n.id}" drains and fills the same node`)
  }

  // --- links
  const edges = new Map<string, SdLink>()
  model.links.forEach((l, i) => {
    const what = l.from && l.to ? `link ${l.from} -> ${l.to}` : `link #${i + 1}`
    const from = nodes.get(l.from)
    const to = nodes.get(l.to)
    if (!from) errors.push(`${what}: "${l.from}" is not a node`)
    if (!to) errors.push(`${what}: "${l.to}" is not a node`)
    if (l.from === l.to) errors.push(`${what} points at itself`)
    if (l.polarity !== '+' && l.polarity !== '-') errors.push(`${what} has polarity "${l.polarity}"; use "+" or "-"`)
    if (!l.mechanism) warnings.push(`${what} has no mechanism`)
    if (l.evidence === undefined) warnings.push(`${what} has no evidence tag; mark it documented, inferred or hypothesis`)
    else if (!EVIDENCE.includes(l.evidence)) errors.push(`${what} has evidence "${l.evidence}"; use ${EVIDENCE.join(', ')}`)
    else if (l.evidence === 'documented' && !(l.refs && l.refs.length)) warnings.push(`${what} is documented but cites no source (refs); cite one or mark it inferred or hypothesis`)
    if (l.bend !== undefined && Math.abs(l.bend) > 0.6) warnings.push(`${what}: bend ${l.bend} is outside -0.6..0.6`)
    const key = edgeKey(l.from, l.to)
    const first = edges.get(key)
    if (first) {
      if (first.polarity !== l.polarity || !!first.delay !== !!l.delay) errors.push(`${what} is listed twice with a different sign or delay; keep one`)
      else warnings.push(`${what} is listed twice; the first is used`)
    } else edges.set(key, l)
    checkStage(l.stage, what)
    if (hasStages && from && to && l.stage !== undefined && stageIdx(l.stage) >= 0 && stageIdx(l.stage) < Math.max(nodeStage(l.from), nodeStage(l.to)))
      errors.push(`${what} is in stage "${l.stage}", earlier than one of its nodes`)
    if (from?.kind === 'flow') {
      if (l.to === from.flow_to && l.polarity === '-') errors.push(`${what}: a flow fills its flow_to stock, so the link must be "+"`)
      if (l.to === from.flow_from && l.polarity === '+') errors.push(`${what}: a flow drains its flow_from stock, so the link must be "-"`)
    }
    // Only a stock's own flows change it.
    if (to?.kind === 'stock' && from && (from.kind !== 'flow' || (l.to !== from.flow_to && l.to !== from.flow_from)))
      errors.push(`${what}: only a stock's own flows change it; link "${l.from}" to the rate of one of its flows instead`)
  })
  for (const n of nodes.values()) {
    if (n.kind === 'flow') {
      const to = n.flow_to ? nodes.get(n.flow_to) : undefined
      const from = n.flow_from ? nodes.get(n.flow_from) : undefined
      if (to?.kind === 'stock' && !edges.has(edgeKey(n.id, to.id))) warnings.push(`flow "${n.id}" has no link to the stock it fills; add {"from": "${n.id}", "to": "${to.id}", "polarity": "+", "evidence": "inferred", "mechanism": "Definition: ..."}`)
      if (from?.kind === 'stock' && !edges.has(edgeKey(n.id, from.id))) warnings.push(`flow "${n.id}" has no link to the stock it drains; add {"from": "${n.id}", "to": "${from.id}", "polarity": "-", "evidence": "inferred", "mechanism": "Definition: ..."}`)
    }
    if (n.kind === 'stock' && ![...nodes.values()].some(f => f.kind === 'flow' && (f.flow_to === n.id || f.flow_from === n.id)))
      warnings.push(`stock "${n.id}" has no inflow or outflow; a stock changes only through flows (or make it a parameter)`)
  }
  const linkStage = (l: SdLink): number => (l.stage !== undefined ? stageIdx(l.stage) : Math.max(nodeStage(l.from), nodeStage(l.to)))

  // --- loops: closure and polarity parity (even number of "-" links = reinforcing)
  const loopIds = new Set<string>()
  const declared = new Set<string>()
  let longestDeclared = 0
  model.loops.forEach((lp, i) => {
    const what = lp.id ? `loop ${lp.id}` : `loop #${i + 1}`
    if (!lp.id) errors.push(`${what} has no id`)
    else if (badId(lp.id)) errors.push(`${what}: the id is not allowed: ${idRule}`)
    else if (loopIds.has(lp.id)) errors.push(`loop id "${lp.id}" is used twice`)
    else loopIds.add(lp.id)
    if (!lp.name) warnings.push(`${what} has no name`)
    if (!lp.story) warnings.push(`${what} has no story`)
    checkStage(lp.stage, what)
    if (lp.type !== 'R' && lp.type !== 'B') errors.push(`${what} has type "${lp.type}"; use "R" or "B"`)
    if (lp.path.length < 2) { errors.push(`${what} needs at least 2 nodes in its path`); return }
    if (new Set(lp.path).size !== lp.path.length) errors.push(`${what} visits a node twice; a loop path is a simple cycle`)
    let negatives = 0
    let closed = true
    let latest = 0
    lp.path.forEach((id, j) => {
      if (!nodes.has(id)) { errors.push(`${what}: "${id}" is not a node`); closed = false; return }
      latest = Math.max(latest, nodeStage(id))
      const next = lp.path[(j + 1) % lp.path.length] as string
      const link = edges.get(edgeKey(id, next))
      if (!link) { errors.push(`${what} is not closed: there is no link ${id} -> ${next}`); closed = false; return }
      if (link.polarity === '-') negatives++
      latest = Math.max(latest, linkStage(link))
    })
    if (!closed) return
    longestDeclared = Math.max(longestDeclared, lp.path.length)
    const computed = negatives % 2 === 0 ? 'R' : 'B'
    if (lp.type !== computed) errors.push(`${what} is declared ${lp.type} but has ${plural(negatives, '"-" link')}, which makes it ${computed === 'R' ? 'reinforcing (R)' : 'balancing (B)'}`)
    const key = canonicalCycle(lp.path)
    if (declared.has(key)) errors.push(`${what} repeats a loop already listed`)
    declared.add(key)
    if (!lp.path.some(id => nodes.get(id)?.kind === 'stock')) warnings.push(`${what} passes through no stock; a feedback loop needs an accumulation, so add the stock it hides (a current level or policy) or treat it as one decision rule`)
    if (hasStages) {
      if (lp.stage === undefined) {
        if (latest > 0) errors.push(`${what} has no stage but its links arrive in "${stageIds[latest]}"; set "stage": "${stageIds[latest]}"`)
      } else if (stageIdx(lp.stage) >= 0) {
        if (stageIdx(lp.stage) < latest) errors.push(`${what} is in stage "${lp.stage}" but one of its links or nodes arrives in "${stageIds[latest]}"; a loop exists only once all its links do`)
        else if (stageIdx(lp.stage) > latest) warnings.push(`${what} is in stage "${lp.stage}" but all its links exist by "${stageIds[latest]}"`)
      }
    }
  })

  // --- feedback cycles nobody named (bounded search)
  const cycles = findCycles(nodes, edges)
  const isDrain = (c: string[]) => {
    if (c.length !== 2) return false
    const [a, b] = c as [string, string]
    const na = nodes.get(a), nb = nodes.get(b)
    return (na?.kind === 'stock' && nb?.kind === 'flow' && nb.flow_from === a) || (nb?.kind === 'stock' && na?.kind === 'flow' && na.flow_from === b)
  }
  const unnamed = cycles.list.filter(c => !declared.has(canonicalCycle(c)))
  const drains = unnamed.filter(isDrain)
  const others = unnamed.filter(c => !isDrain(c))
  const limits = [
    `cycles longer than ${MAX_CYCLE_LENGTH} links were not searched`,
    cycles.truncated ? 'the search stopped early on a large graph' : '',
  ].filter(Boolean).join('; ')
  if (cycles.list.length || declared.size) {
    notes.push(`${plural(declared.size, 'named loop')} close${declared.size === 1 ? 's' : ''}. The search found ${cycles.truncated ? 'at least ' : ''}${plural(cycles.list.length, 'feedback cycle')} of up to ${MAX_CYCLE_LENGTH} links (${limits}).`)
    if (others.length) {
      const shown = others.slice(0, 6).map(c => {
        const neg = c.filter((id, j) => edges.get(edgeKey(id, c[(j + 1) % c.length] as string))?.polarity === '-').length
        return `${neg % 2 === 0 ? 'R' : 'B'}: ${c.join(' -> ')}`
      })
      notes.push(`Unnamed cycles (name the ones that matter; the rest are fine to leave): ${shown.join(' | ')}${others.length > 6 ? ` | ... ${others.length - 6} more` : ''}`)
    }
    if (drains.length) notes.push(`${plural(drains.length, 'unnamed first-order drain')} (a stock and its own outflow) left out of that list.`)
    if (longestDeclared > MAX_CYCLE_LENGTH) notes.push(`A named loop has ${longestDeclared} links; longer unnamed cycles may exist: trace them by hand.`)
  } else notes.push(`The search found no feedback cycles of up to ${MAX_CYCLE_LENGTH} links: without loops this is a causal chain, not a dynamic model (${limits}).`)

  // --- readability caps
  const count = (k: Kind) => model.nodes.filter(n => n.kind === k).length
  const stocks = count('stock')
  const flows = count('flow')
  const otherVars = model.nodes.filter(n => n.kind !== 'stock' && n.kind !== 'flow' && n.kind !== 'cloud').length
  if (stocks > CAPS.stocks) warnings.push(`${stocks} stocks; above ${CAPS.stocks} the diagram gets hard to read`)
  if (flows > CAPS.flows) warnings.push(`${flows} flows; above ${CAPS.flows} the diagram gets hard to read`)
  if (otherVars > CAPS.others) warnings.push(`${otherVars} other variables (clouds not counted); above ${CAPS.others} the diagram gets hard to read`)
  if (model.loops.length > CAPS.loops) warnings.push(`${model.loops.length} loops; above ${CAPS.loops} the diagram gets hard to read`)
  if (stocks === 0) warnings.push('no stocks: a stock-and-flow model needs at least one accumulation')

  // --- layout: boxes, pipes and loop markers, in drawing units
  const layout = layoutModel(model)
  const boxes: { id: string; box: Box }[] = []
  for (const n of model.nodes) {
    if (n.kind === 'flow' || !nodes.has(n.id)) continue
    if (n.col === undefined || n.row === undefined) { warnings.push(`node "${n.id}" has no col/row; it will be placed in a spare row`); continue }
    if (n.col < 1 || n.row < 1) warnings.push(`node "${n.id}": col and row start at 1`)
    const p = layout.pos.get(n.id)
    const box = p ? boxOf(n, p.x, p.y) : null
    if (box) boxes.push({ id: n.id, box })
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (overlaps(boxes[i]!.box, boxes[j]!.box)) warnings.push(`nodes "${boxes[i]!.id}" and "${boxes[j]!.id}" overlap on the drawing; move one (stocks need at least 2 columns between centres)`)
  const valves = new Map<string, { x: number; y: number }>()
  for (const n of nodes.values()) {
    if (n.kind !== 'flow' || !n.flow_from || !n.flow_to) continue
    const a = layout.pos.get(n.flow_from), b = layout.pos.get(n.flow_to)
    const na = nodes.get(n.flow_from), nb = nodes.get(n.flow_to)
    if (!a || !b || !na || !nb) continue
    valves.set(n.id, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    const ba = boxOf(na, a.x, a.y), bb = boxOf(nb, b.x, b.y)
    if (ba && bb) {
      const gap = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y)
        ? Math.abs(a.x - b.x) - ba.hw - bb.hw
        : Math.abs(a.y - b.y) - ba.hh - bb.hh
      if (gap < 0) errors.push(`flow "${n.id}": "${n.flow_from}" and "${n.flow_to}" overlap, so the pipe would draw backwards; leave at least one empty column, or a row, between them`)
      else if (gap < 30) warnings.push(`flow "${n.id}": the pipe between "${n.flow_from}" and "${n.flow_to}" is too short to read; leave another column between them`)
    }
    const v = valves.get(n.id)!
    for (const { id, box } of boxes) if (id !== n.flow_from && id !== n.flow_to && overlaps(box, { x: v.x, y: v.y, hw: 10, hh: 10 }, 0)) warnings.push(`node "${id}" sits on the valve of flow "${n.id}"; move it`)
  }
  const markers: { id: string; x: number; y: number }[] = []
  for (const lp of model.loops) {
    const m = layout.loopPos.get(lp.id) ?? centroid(lp.path.map(id => layout.pos.get(id) ?? valves.get(id)).filter((p): p is { x: number; y: number } => !!p))
    if (!m) continue
    const placed = layout.loopPos.has(lp.id)
    const near = [
      ...boxes.filter(b => overlaps(b.box, { x: m.x, y: m.y, hw: 16, hh: 16 }, 0)).map(b => `node "${b.id}"`),
      ...[...valves].filter(([, v]) => Math.hypot(v.x - m.x, v.y - m.y) < 28).map(([id]) => `flow "${id}"`),
      ...markers.filter(o => Math.hypot(o.x - m.x, o.y - m.y) < 40).map(o => `loop ${o.id}`),
    ]
    if (near.length) warnings.push(`loop ${lp.id}'s marker${placed ? '' : ' (placed at the centre of its nodes)'} lands on ${near.join(', ')}; give the loop a col/row in open space`)
    markers.push({ id: lp.id, ...m })
  }

  const evidence = (e: Evidence) => model.links.filter(l => l.evidence === e).length
  return {
    errors, warnings, notes,
    stats: {
      stocks, flows, others: otherVars, clouds: count('cloud'), links: model.links.length,
      loops_reinforcing: model.loops.filter(l => l.type === 'R').length,
      loops_balancing: model.loops.filter(l => l.type === 'B').length,
      links_documented: evidence('documented'), links_inferred: evidence('inferred'), links_hypothesis: evidence('hypothesis'),
      links_untagged: model.links.filter(l => l.evidence === undefined).length,
      stages: stageIds.length, cycles: cycles.list.length,
    },
  }
}

function centroid(points: { x: number; y: number }[]): { x: number; y: number } | undefined {
  if (!points.length) return undefined
  return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length }
}

/** A cycle's rotation-independent key: start at its smallest id. */
export function canonicalCycle(path: string[]): string {
  if (!path.length) return ''
  let best = 0
  path.forEach((id, i) => { if (id < (path[best] as string)) best = i })
  return [...path.slice(best), ...path.slice(0, best)].join('>')
}

function findCycles(nodes: Map<string, SdNode>, edges: Map<string, SdLink>): { list: string[][]; truncated: boolean } {
  const ids = [...nodes.keys()].sort()
  const order = new Map(ids.map((id, i) => [id, i]))
  const out = new Map<string, string[]>()
  for (const l of edges.values()) {
    if (!nodes.has(l.from) || !nodes.has(l.to) || l.from === l.to) continue
    const list = out.get(l.from) ?? []
    list.push(l.to)
    out.set(l.from, list)
  }
  const list: string[][] = []
  let truncated = false
  let steps = 0
  // Each simple cycle is found once, from its smallest node, visiting only larger nodes.
  for (const start of ids) {
    const s = order.get(start) as number
    const path = [start]
    const onPath = new Set([start])
    const walk = (at: string): void => {
      for (const nxt of out.get(at) ?? []) {
        if (truncated) return
        if (++steps > MAX_SEARCH_STEPS) { truncated = true; return }
        if (nxt === start) {
          list.push([...path])
          if (list.length >= MAX_CYCLES) { truncated = true; return }
        } else if (!onPath.has(nxt) && (order.get(nxt) as number) > s && path.length < MAX_CYCLE_LENGTH) {
          path.push(nxt); onPath.add(nxt)
          walk(nxt)
          path.pop(); onPath.delete(nxt)
        }
      }
    }
    walk(start)
    if (truncated) break
  }
  return { list, truncated }
}

/** A plain-text report the model reads. */
export function formatReport(r: CheckReport): string {
  const s = r.stats
  const head = r.errors.length
    ? `NOT CLEAN: ${plural(r.errors.length, 'error')}, ${plural(r.warnings.length, 'warning')}. Fix every error, then check again.`
    : r.warnings.length
      ? `CLEAN of errors; ${plural(r.warnings.length, 'warning')} to review.`
      : 'CLEAN: no errors, no warnings.'
  const lines = [
    head,
    `Model: ${plural(s.stocks ?? 0, 'stock')}, ${plural(s.flows ?? 0, 'flow')}, ${plural(s.others ?? 0, 'other variable')}, ${plural(s.clouds ?? 0, 'cloud')}, ${plural(s.links ?? 0, 'link')} ` +
      `(${s.links_documented} documented, ${s.links_inferred} inferred, ${s.links_hypothesis} hypothesis${s.links_untagged ? `, ${s.links_untagged} untagged` : ''}), ` +
      `${s.loops_reinforcing} reinforcing + ${s.loops_balancing} balancing loops, ${plural(s.stages ?? 0, 'stage')}.`,
  ]
  if (r.errors.length) lines.push('', 'Errors:', ...r.errors.map(e => `- ${e}`))
  if (r.warnings.length) lines.push('', 'Warnings:', ...r.warnings.map(w => `- ${w}`))
  if (r.notes.length) lines.push('', 'Notes:', ...r.notes.map(n => `- ${n}`))
  return lines.join('\n')
}

// --- layout and page

export interface Layout {
  pos: Map<string, { x: number; y: number }>
  loopPos: Map<string, { x: number; y: number }>
  bend: Map<string, number>
  flowLabel: Map<string, 'left' | 'right'>
  width: number
  height: number
  unplaced: string[]
}

/** Grid placement (col/row) to drawing coordinates; nodes with no place go in a spare row. */
export function layoutModel(model: SdModel): Layout {
  const placed = model.nodes.filter(n => n.kind !== 'flow' && n.col !== undefined && n.row !== undefined)
  const placedLoops = model.loops.filter(l => l.col !== undefined && l.row !== undefined)
  const maxCol = Math.max(4, ...placed.map(n => n.col as number), ...placedLoops.map(l => l.col as number))
  let maxRow = Math.max(3, ...placed.map(n => n.row as number), ...placedLoops.map(l => l.row as number))
  const at = (col: number, row: number) => ({ x: MARGIN_X + (col - 1) * CELL_W, y: MARGIN_Y + (row - 1) * CELL_H })
  const pos: Layout['pos'] = new Map()
  for (const n of placed) pos.set(n.id, at(n.col as number, n.row as number))
  const unplaced = model.nodes.filter(n => n.kind !== 'flow' && !pos.has(n.id)).map(n => n.id)
  if (unplaced.length) {
    const perRow = Math.max(1, Math.floor(maxCol / 2))
    maxRow += 1
    unplaced.forEach((id, i) => { pos.set(id, at(1 + 2 * (i % perRow), maxRow + Math.floor(i / perRow))) })
    maxRow += Math.floor((unplaced.length - 1) / perRow)
  }
  const loopPos: Layout['loopPos'] = new Map()
  for (const lp of placedLoops) loopPos.set(lp.id, at(lp.col as number, lp.row as number))
  const bend: Layout['bend'] = new Map()
  for (const l of model.links) if (l.bend !== undefined && !bend.has(edgeKey(l.from, l.to))) bend.set(edgeKey(l.from, l.to), Math.max(-0.6, Math.min(0.6, l.bend)))
  const flowLabel: Layout['flowLabel'] = new Map()
  for (const n of model.nodes) if (n.kind === 'flow' && n.label_side) flowLabel.set(n.id, n.label_side)
  return {
    pos, loopPos, bend, flowLabel, unplaced,
    width: Math.round(2 * MARGIN_X + (maxCol - 1) * CELL_W),
    height: Math.round(2 * MARGIN_Y + (maxRow - 1) * CELL_H + 30),
  }
}

/** HTML text, ASCII only: markup characters, "@" and everything past ASCII as entities. */
export function escapeHtml(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.codePointAt(0) as number
    if (ch === '&') out += '&amp;'
    else if (ch === '<') out += '&lt;'
    else if (ch === '>') out += '&gt;'
    else if (ch === '"') out += '&quot;'
    else if (ch === "'") out += '&#39;'
    else if (ch === '@') out += '&#64;'
    else if (c > 126 || c < 32) out += c === 10 ? ' ' : `&#x${c.toString(16)};`
    else out += ch
  }
  return out
}

/** JSON safe inside a <script>: no "<", ">", "&" or "@", and ASCII only. */
export function jsonForScript(value: unknown): string {
  const json = JSON.stringify(value) ?? 'null'
  let out = ''
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i)
    const ch = json[i] as string
    if (ch === '<' || ch === '>' || ch === '&' || ch === '@' || c > 126) out += '\\u' + c.toString(16).padStart(4, '0')
    else out += ch
  }
  return out
}

const MARKERS = /\/\*@@(?:DATA|RENDERER)@@\*\/|@@[A-Z]+@@/g

/** The model as the page draws it: each link once (the first of any repeat), as the checker read it. */
function pageModel(model: SdModel): SdModel {
  const seen = new Set<string>()
  const links = model.links.filter(l => { const k = edgeKey(l.from, l.to); if (seen.has(k)) return false; seen.add(k); return true })
  return { ...model, links }
}

/** The page: the template's markers filled in one pass, so no filled value is ever read as a marker. */
export function buildHtml(model: SdModel, layout: Layout, template: string, renderer: string): string {
  const meta = model.meta ?? {}
  const title = meta.title ?? (meta.subject ? `${meta.subject} Dynamics` : 'System Dynamics')
  const subject = meta.subject ?? title.replace(/\s+Dynamics$/i, '')
  const lede = meta.lede ??
    'What accumulates in this system, what fills and drains it, and which feedback loops push it forward or hold it back. Select a loop, box or variable to trace its mechanism and its source.'
  const foot = [
    meta.sources?.length ? `Built from ${meta.sources.join(', ')}.` : '',
    meta.verification ?? '',
    'A qualitative model drawn from the sources, not a simulation: each sign says how one thing moves another, everything else held equal. Dashed links are hypotheses the sources do not state.',
  ].filter(Boolean).join(' ')
  const obj = <T>(m: Map<string, T>) => Object.assign(Object.create(null) as Record<string, T>, Object.fromEntries(m))
  const data = [
    `window.MODEL = ${jsonForScript(pageModel(model))};`,
    `window.POS = ${jsonForScript(obj(layout.pos))};`,
    `window.LOOP_POS = ${jsonForScript(obj(layout.loopPos))};`,
    `window.BEND = ${jsonForScript(obj(layout.bend))};`,
    `window.FLOW_LABEL = ${jsonForScript(obj(layout.flowLabel))};`,
  ].join('\n')
  const loopsAria = model.loops.map(l => `${l.type === 'R' ? 'reinforcing' : 'balancing'} loop ${l.name}`).join('; ') || 'no loops'
  const values: Record<string, string> = {
    '@@TITLE@@': escapeHtml(title),
    '@@EYEBROW@@': escapeHtml(`${subject} ${MIDDOT} stock-and-flow model`),
    '@@LEDE@@': escapeHtml(lede),
    '@@FOOT@@': escapeHtml(foot),
    '@@ARIA@@': escapeHtml(`Stock-and-flow model of ${subject}: ${loopsAria}.`),
    '@@VIEWBOX@@': `0 0 ${layout.width} ${layout.height}`,
    '@@MINWIDTH@@': String(Math.min(1100, Math.max(640, Math.round(layout.width * 0.7)))),
    '/*@@DATA@@*/': data,
    '/*@@RENDERER@@*/': renderer,
  }
  return template.replace(MARKERS, m => values[m] ?? m)
}

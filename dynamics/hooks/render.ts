// Renders a checked dynamics/1 model to one self-contained HTML page, plus a plain-text reader view
// built from the same section data. Pure: strings in, strings out.
//
// Everything structural on the page is read from the checker's Analysis (loop polarity, membership,
// traces, hedges, the boundary chart). The legend is built from the marks this page actually draws,
// one entry per visual signature, with the same functions that draw the figures.

import { namer, type Analysis, type Evidence, type Flow, type Issue, type Link, type LoopReport, type Model, type Node, type Status } from './spec.ts'
import { esc, fingerprint, parseLines, textWidth } from './text.ts'

// ----------------------------------------------------------------------------------- geometry

const CW = 190
const RH = 130
const MARGIN = 80
const STOCK_W = 140
const STOCK_H = 56
const FONT = 12
const PIPE_HALF = 4 // half the painted pipe's width
const PIPE_PAD = PIPE_HALF + 2 // half the painted pipe plus the text halo
const HEAD = 12 // a pipe's arrowhead length
const VALVE_R = 11 // a valve's half-width across the pipe and along it
const SHADOW_CROSS = 7 // the × after a missing element's shadow

type P = { x: number; y: number }
type Rect = { x: number; y: number; w: number; h: number }
type Box = Rect & { owner: string; what: string }
type Seg = { a: P; b: P; owner: string }
type Curve = { a: P; c: P; b: P }

const grid = (c: number, r: number): P => ({ x: MARGIN + c * CW, y: MARGIN + r * RH })
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: P, k: number): P => ({ x: a.x * k, y: a.y * k })
const len = (a: P): number => Math.hypot(a.x, a.y)
const unit = (a: P): P => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l } }
const perp = (a: P): P => ({ x: -a.y, y: a.x })
/** Every number drawn goes through r1, so G00 counts the drawn geometry itself, never the page text. */
let nonFinite = 0
const r1 = (n: number): string => {
  if (!Number.isFinite(n)) nonFinite++
  return (Math.round(n * 10) / 10).toString()
}
const pt = (p: P): string => `${r1(p.x)},${r1(p.y)}`
const textW = (s: string, size = FONT): number => textWidth(s, size)

function wrap(s: string, maxPx: number, size = FONT): string[] {
  if (textW(s, size) <= maxPx) return [s]
  const words = s.split(' ')
  if (words.length === 1) return [s]
  let best = 1
  let bestW = Infinity
  for (let i = 1; i < words.length; i++) {
    const w = Math.max(textW(words.slice(0, i).join(' '), size), textW(words.slice(i).join(' '), size))
    if (w < bestW) { bestW = w; best = i }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}
const quad = (q: Curve, t: number): P => {
  const u = 1 - t
  return { x: u * u * q.a.x + 2 * u * t * q.c.x + t * t * q.b.x, y: u * u * q.a.y + 2 * u * t * q.c.y + t * t * q.b.y }
}
const quadTan = (q: Curve, t: number): P => unit({ x: 2 * (1 - t) * (q.c.x - q.a.x) + 2 * t * (q.b.x - q.c.x), y: 2 * (1 - t) * (q.c.y - q.a.y) + 2 * t * (q.b.y - q.c.y) })
const hit = (a: Rect, b: Rect, pad = 0): boolean => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad
const inRect = (p: P, b: Rect, pad = 0): boolean => p.x > b.x - pad && p.x < b.x + b.w + pad && p.y > b.y - pad && p.y < b.y + b.h + pad
function distSeg(p: P, a: P, b: P): number {
  const ab = sub(b, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)))
  return len(sub(p, add(a, mul(ab, t))))
}
function distRect(p: P, r: Rect): number {
  return Math.hypot(Math.max(r.x - p.x, 0, p.x - (r.x + r.w)), Math.max(r.y - p.y, 0, p.y - (r.y + r.h)))
}
/** Exact: does segment ab come within `pad` of rectangle r? */
function segNearRect(a: P, b: P, r: Rect, pad: number): boolean {
  const x0 = r.x - pad, y0 = r.y - pad, x1 = r.x + r.w + pad, y1 = r.y + r.h + pad
  let t0 = 0
  let t1 = 1
  const d = sub(b, a)
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0
    const t = q / p
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t } else { if (t < t0) return false; if (t < t1) t1 = t }
    return true
  }
  return clip(-d.x, a.x - x0) && clip(d.x, x1 - a.x) && clip(-d.y, a.y - y0) && clip(d.y, y1 - a.y) && t0 <= t1
}
/** Winding number of poly around p, in screen coordinates: positive means the outline runs clockwise there. */
function winding(p: P, poly: P[]): number {
  let wn = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const isLeft = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y)
    if (a.y <= p.y) { if (b.y > p.y && isLeft > 0) wn++ }
    else if (b.y <= p.y && isLeft < 0) wn--
  }
  return wn
}

/** A coarse spatial index so placement and lint stay roughly linear in figure size. */
type Grid<T extends Rect> = { add(item: T): void; near(r: Rect, pad?: number): T[] }
function makeGrid<T extends Rect>(s = 48): Grid<T> {
  const cells = new Map<string, T[]>()
  // an item too big (or not finite) to file cell by cell is returned by every query: still correct, never a hang
  const wide: T[] = []
  const all: T[] = []
  const span = (a: number, b: number): [number, number] | null => {
    const i0 = Math.floor(a / s)
    const i1 = Math.floor(b / s)
    // past 2^53 a cell index stops counting (i + 1 === i), so such an item is wide too
    return Number.isSafeInteger(i0) && Number.isSafeInteger(i1) && i1 - i0 <= 400 ? [i0, i1] : null
  }
  return {
    add(item) {
      all.push(item)
      const xs = span(item.x, item.x + item.w)
      const ys = span(item.y, item.y + item.h)
      if (!xs || !ys || (xs[1] - xs[0] + 1) * (ys[1] - ys[0] + 1) > 4000) { wide.push(item); return }
      for (let i = xs[0]; i <= xs[1]; i++)
        for (let j = ys[0]; j <= ys[1]; j++) {
          const k = `${i},${j}`
          const list = cells.get(k)
          if (list) list.push(item); else cells.set(k, [item])
        }
    },
    near(r, pad = 0) {
      const xs = span(r.x - pad, r.x + r.w + pad)
      const ys = span(r.y - pad, r.y + r.h + pad)
      if (!xs || !ys || (xs[1] - xs[0] + 1) * (ys[1] - ys[0] + 1) > 4000) return [...all]
      const out = new Set<T>(wide)
      for (let i = xs[0]; i <= xs[1]; i++)
        for (let j = ys[0]; j <= ys[1]; j++)
          for (const t of cells.get(`${i},${j}`) ?? []) out.add(t)
      return [...out]
    },
  }
}
type SegItem = Rect & Seg
type PtItem = Rect & { p: P; owner: string }
const segItem = (s: Seg): SegItem => ({ ...s, x: Math.min(s.a.x, s.b.x), y: Math.min(s.a.y, s.b.y), w: Math.abs(s.a.x - s.b.x), h: Math.abs(s.a.y - s.b.y) })
const ptItem = (p: P, owner: string): PtItem => ({ p, owner, x: p.x, y: p.y, w: 0, h: 0 })

type Shape = { kind: 'rect'; c: P; w: number; h: number } | { kind: 'circle'; c: P; r: number }
function exitPoint(s: Shape, toward: P, gap = 3): P {
  const v = sub(toward, s.c)
  const d = len(v) < 1e-6 ? { x: 1, y: 0 } : unit(v)
  if (s.kind === 'circle') return add(s.c, mul(d, s.r + gap))
  const tx = d.x === 0 ? Infinity : (s.w / 2 + gap) / Math.abs(d.x)
  const ty = d.y === 0 ? Infinity : (s.h / 2 + gap) / Math.abs(d.y)
  return add(s.c, mul(d, Math.min(tx, ty)))
}
/** The point `d` along a polyline, or its end when the line is shorter. */
function along(path: P[], d: number): P {
  for (let i = 1; i < path.length; i++) {
    const seg = len(sub(path[i], path[i - 1]))
    if (d <= seg) return add(path[i - 1], mul(sub(path[i], path[i - 1]), seg ? d / seg : 0))
    d -= seg
  }
  return path[path.length - 1]
}
/**
 * Where a missing pipe's × goes: centred between the valve's edge and the arrowhead's base when that room
 * fits the × (14 px), else the same on the upstream side, else over the valve. pts[seg] → pts[seg + 1]
 * is the run that holds the valve.
 */
function crossPlace(pts: P[], seg: number, valve: P): P {
  for (const path of [[valve, ...pts.slice(seg + 1)], [valve, ...pts.slice(0, seg + 1).reverse()]]) {
    const total = path.slice(1).reduce((t, q, i) => t + len(sub(q, path[i])), 0)
    const room = total - HEAD - VALVE_R
    if (room >= 14) return along(path, VALVE_R + room / 2)
  }
  return valve
}
/** An arrowhead as drawn: its tip at `at`, then the two corners of its base, `size` back and 0.55 × size either side. */
function headPoints(at: P, dir: P, size: number): [P, P, P] {
  const d = unit(dir)
  const n = perp(d)
  const back = sub(at, mul(d, size))
  return [at, add(back, mul(n, size * 0.55)), sub(back, mul(n, size * 0.55))]
}
const halfW = (s: Shape): number => (s.kind === 'rect' ? s.w / 2 : s.r)
const halfH = (s: Shape): number => (s.kind === 'rect' ? s.h / 2 : s.r)

/** The middle of where two extents overlap, when the overlap holds the pipe's width; else null. */
function shared(c1: number, h1: number, c2: number, h2: number): number | null {
  const lo = Math.max(c1 - h1, c2 - h2)
  const hi = Math.min(c1 + h1, c2 + h2)
  return hi - lo >= 2 * PIPE_HALF ? (lo + hi) / 2 : null
}

// ---------------------------------------------------------------------------------- pipe routes

/**
 * A pipe's shape: level or plumb through the band its ends share ("straight"), an elbow (hv leaves the
 * source horizontally, vh vertically), a detour ("under", "over"), or, last, a straight slant.
 */
type Route = 'straight' | 'hv' | 'vh' | 'under' | 'over' | 'slant'
const ROUTES: readonly Route[] = ['straight', 'hv', 'vh', 'under', 'over', 'slant']
/** Cheapest first. A detour costs more than two elbows, so a pair of elbows beats an elbow and a detour. */
const ROUTE_COST: Record<Route, number> = { straight: 0, hv: 1, vh: 2, under: 4, over: 5, slant: 20 }
/** Any stand-in for a route the model names costs more than every shape a model leaves to the renderer. */
const FALLBACK = 100
/** Above this many flows between the same two ends, routes are decided one by one: named routes first, each in id order. */
const JOINT_MAX = 4
/** How far a run's centre line keeps from an end box it does not leave or enter: the pipe's half-width and a visible gap. */
const RUN_CLEAR = PIPE_HALF + 4
/** Pipe centre lines closer than this paint as one pipe. */
const PIPES_APART = 2 * PIPE_HALF + 1
/** A valve's box keeps at least this far from a stock, cloud or other node. */
const VALVE_GAP = 1

const extent = (s: Shape): Rect => ({ x: s.c.x - halfW(s), y: s.c.y - halfH(s), w: 2 * halfW(s), h: 2 * halfH(s) })
/**
 * A valve as a box, which placeValve, settle, pipesClash and the lint test against. A stand-in: the drawn bowtie
 * (draw.valve) reaches VALVE_R across its pipe but only 7 px along it, so two valves 14-22 px apart along their
 * pipes count as meeting though they do not (moved apart, or reported); on a slant its corners reach 2 px past the box.
 */
const valveBox = (c: P): Rect => ({ x: c.x - VALVE_R, y: c.y - VALVE_R, w: 2 * VALVE_R, h: 2 * VALVE_R })
/**
 * A stand-in for a pipe's arrowhead, which pipesClash and the lint test other pipes, labels and links against.
 * Blind spot: the drawn arrowhead (headPoints) reaches 12 px back from the tip, this box only 8, so a pipe
 * crossing 9-12 px behind a sibling's tip is neither avoided nor reported. Boxing the drawn arrowhead instead
 * moves link bends and labels in the worked example, so it waits for its own change.
 */
const headBox = (tip: P): Rect => ({ x: tip.x - 8, y: tip.y - 8, w: 16, h: 16 })
/** The one test of a valve against a node's box: the chooser refuses it, the lint reports it. */
const valveMeets = (c: P, r: Rect): boolean => hit(valveBox(c), r, VALVE_GAP)
/** The node boxes a valve must keep off (Box.what); a shadow is text, so G02 already tests it against a valve. */
const NODE_BOX = new Set(['stock', 'cloud', 'variable', 'constant'])
/** An elbow's corner: hv leaves the source horizontally, vh vertically. */
const cornerOf = (a: P, b: P, r: 'hv' | 'vh'): P => (r === 'vh' ? { x: a.x, y: b.y } : { x: b.x, y: a.y })
/** Ends one above the other (their widths overlap) detour round the side; any others, below or above. */
const stacked = (sa: Shape, sb: Shape): boolean => Math.max(sa.c.x - halfW(sa), sb.c.x - halfW(sb)) < Math.min(sa.c.x + halfW(sa), sb.c.x + halfW(sb))

/** The points of a route between two ends, from the source's outline to the target's; null when it has no such shape. */
function pipeShape(route: Route, sa: Shape, sb: Shape): P[] | null {
  const a = sa.c
  const b = sb.c
  if (route === 'straight') {
    const yMid = shared(a.y, halfH(sa), b.y, halfH(sb))
    const xMid = shared(a.x, halfW(sa), b.x, halfW(sb))
    const sx = Math.sign(b.x - a.x) || 1
    const sy = Math.sign(b.y - a.y) || 1
    if (yMid !== null) return [{ x: a.x + sx * halfW(sa), y: yMid }, { x: b.x - sx * halfW(sb), y: yMid }]
    if (xMid !== null) return [{ x: xMid, y: a.y + sy * halfH(sa) }, { x: xMid, y: b.y - sy * halfH(sb) }]
    return null
  }
  if (route === 'slant') return [exitPoint(sa, b, 0), exitPoint(sb, a, 0)]
  if (route === 'hv' || route === 'vh') {
    const corner = cornerOf(a, b, route)
    return [exitPoint(sa, corner, 0), corner, exitPoint(sb, corner, 0)]
  }
  const side = route === 'under' ? 1 : -1
  if (stacked(sa, sb)) {
    // round the right side ("under") or the left ("over")
    const toward = Math.sign(b.y - a.y) || 1
    const ay = a.y + toward * halfH(sa) * 0.35
    const by = b.y - toward * halfH(sb) * 0.35
    const ax = a.x + side * halfW(sa)
    const bx = b.x + side * halfW(sb)
    const x = side > 0 ? Math.max(ax, bx) + 0.42 * CW : Math.min(ax, bx) - 0.42 * CW
    return [{ x: ax, y: ay }, { x, y: ay }, { x, y: by }, { x: bx, y: by }]
  }
  // below both ends ("under") or above them ("over")
  const toward = Math.sign(b.x - a.x) || 1
  const ax = a.x + toward * halfW(sa) * 0.35
  const bx = b.x - toward * halfW(sb) * 0.35
  const ay = a.y + side * halfH(sa)
  const by = b.y + side * halfH(sb)
  const y = side > 0 ? Math.max(ay, by) + 0.42 * RH : Math.min(ay, by) - 0.42 * RH
  return [{ x: ax, y: ay }, { x: ax, y }, { x: bx, y }, { x: bx, y: by }]
}

/**
 * The valve: on the longest run, at `frac` of it, moved to the nearest point of that run where its box
 * stays clear of both ends (VALVE_GAP). When no point is clear it stays at `frac`, and pipeFault refuses it.
 */
function placeValve(pts: P[], frac: number, ends: readonly Rect[]): { run: number; c: P } {
  let run = 0
  for (let k = 1; k < pts.length - 1; k++) if (len(sub(pts[k + 1], pts[k])) > len(sub(pts[run + 1], pts[run]))) run = k
  const p0 = pts[run]
  const d = sub(pts[run + 1], p0)
  // the open stretch of the run (0 to 1) where the valve's box would meet each end
  const banned: [number, number][] = []
  for (const r of ends) {
    let lo = -Infinity
    let hi = Infinity
    for (const [p, v, c, h] of [[p0.x, d.x, r.x + r.w / 2, r.w / 2 + VALVE_R + VALVE_GAP], [p0.y, d.y, r.y + r.h / 2, r.h / 2 + VALVE_R + VALVE_GAP]]) {
      if (v === 0) { if (!(Math.abs(p - c) < h)) hi = -Infinity }
      else { const t1 = (c - h - p) / v; const t2 = (c + h - p) / v; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2)) }
    }
    if (lo < hi) banned.push([lo, hi])
  }
  const free = (t: number) => t >= 0 && t <= 1 && banned.every(([lo, hi]) => t <= lo || t >= hi)
  let t = frac
  if (!free(t)) {
    const edges = banned.flatMap(([lo, hi]) => [lo - 1e-9, hi + 1e-9]).filter(free)
    if (edges.length) t = edges.reduce((best, e) => (Math.abs(e - frac) < Math.abs(best - frac) ? e : best))
  }
  return { run, c: add(p0, mul(d, t)) }
}

/** Exact distance from segment ab to rectangle r: 0 when they meet. */
function segRectDist(a: P, b: P, r: Rect): number {
  if (segNearRect(a, b, r, 0)) return 0
  const corners = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x, y: r.y + r.h }, { x: r.x + r.w, y: r.y + r.h }]
  return Math.min(distRect(a, r), distRect(b, r), ...corners.map(c => distSeg(c, a, b)))
}
/** Do segments ab and cd cross, each passing from one side of the other to the other side? */
function segsCross(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, r: P) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const d1 = o(c, d, a)
  const d2 = o(c, d, b)
  const d3 = o(a, b, c)
  const d4 = o(a, b, d)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}
/** The least distance from an end of either segment to the other segment. */
const endsApart = (a: P, b: P, c: P, d: P): number => Math.min(distSeg(a, c, d), distSeg(b, c, d), distSeg(c, a, b), distSeg(d, a, b))

/**
 * Why a drawn pipe does not fit between its ends, or '' when it does. Judged on what is drawn: the run
 * into the target keeps the arrowhead's room outside it, and the arrowhead (headPoints, as draw.pipe
 * draws it) lands with its whole base over the target; every later run keeps RUN_CLEAR from the source,
 * every earlier run RUN_CLEAR from the target; the valve's box meets neither end.
 */
function pipeFault(pts: P[], valve: P, src: Rect, dst: Rect): string {
  const runs = pts.length - 1
  const first = runs === 2 ? 'its corner' : 'its first turn'
  const last = runs === 2 ? 'its corner' : 'its last turn'
  const into = distRect(pts[runs - 1], dst)
  if (runs > 1 && into <= 0) return `${last} would fall inside the target`
  if (into < HEAD + 4) return runs > 1 ? `${last} would leave no room for the arrowhead before the target` : 'the ends are too close for its arrowhead'
  // a base corner whose line forward never meets the target hangs past its corner (the line runs right across the target)
  const dir = unit(sub(pts[runs], pts[runs - 1]))
  for (const c of headPoints(pts[runs], dir, HEAD).slice(1))
    if (!segNearRect(c, add(c, mul(dir, HEAD + dst.w + dst.h)), dst, 1e-6)) return 'its arrowhead would hang past the corner of the target'
  if (runs > 1 && distRect(pts[1], src) <= 0) return `${first} would fall inside the source`
  for (let k = 1; k < runs; k++) if (segRectDist(pts[k], pts[k + 1], src) < RUN_CLEAR) return `past ${first} it would run within ${RUN_CLEAR} px of the source`
  for (let k = 0; k < runs - 1; k++) if (segRectDist(pts[k], pts[k + 1], dst) < RUN_CLEAR) return `before ${last} it would run within ${RUN_CLEAR} px of the target`
  if (valveMeets(valve, src)) return 'its valve would sit on the source'
  if (valveMeets(valve, dst)) return 'its valve would sit on the target'
  return ''
}

type Pipe = { route: Route; pts: P[]; run: number; valve: P; fault: string }

/** A missing flow's ×, as a box: drawn 12 px across with its stroke. */
const crossBox = (x: P): Rect => ({ x: x.x - 7, y: x.y - 7, w: 14, h: 14 })
/** `at`: where the mark is drawn, for the valve and the × (crossPlace). */
type PipeMark = { what: 'valve' | 'arrowhead' | 'cross'; r: Rect; at?: P }
/** What a pipe draws on its line that no other pipe may run through: the chooser tests these, the lint adds them as boxes, the × is drawn from them. */
function pipeMarks(p: Pipe, missing: boolean): PipeMark[] {
  const marks: PipeMark[] = [{ what: 'valve', r: valveBox(p.valve), at: p.valve }, { what: 'arrowhead', r: headBox(p.pts[p.pts.length - 1]) }]
  if (missing) { const at = crossPlace(p.pts, p.run, p.valve); marks.push({ what: 'cross', r: crossBox(at), at }) }
  return marks
}
type Run = { a: P; b: P }
/** Two runs lie along each other: parallel, with an end of either within PIPES_APART of the other. Painted, they read as one pipe. */
function runsAlong(s: Run, o: Run): boolean {
  const d1 = unit(sub(s.b, s.a))
  const d2 = unit(sub(o.b, o.a))
  if (Math.abs(d1.x * d2.y - d1.y * d2.x) > 0.05) return false
  return distSeg(o.a, s.a, s.b) < PIPES_APART || distSeg(o.b, s.a, s.b) < PIPES_APART || distSeg(s.a, o.a, o.b) < PIPES_APART || distSeg(s.b, o.a, o.b) < PIPES_APART
}
const runsThrough = (s: Run, r: Rect): boolean => segNearRect(s.a, s.b, r, 1)
type Placed = { pts: P[]; marks: PipeMark[] }
type Clash = {
  /** runs [of p, of q] that lie along each other */
  along: [number, number][]
  /** runs [of p, of q], not along, with an end of one within PIPES_APART of the other, crossing or not; one at a corner that turns along the other pipe is left to `along` */
  touch: [number, number][]
  /** a run of one pipe (0: p, 1: q) through a mark of the other, once per mark */
  through: { by: 0 | 1; what: PipeMark['what'] }[]
  /** the valve of one pipe (0: p, 1: q) on the valve or arrowhead of the other, once per mark */
  marks: { by: 0 | 1; what: 'valve' | 'arrowhead' }[]
  /** pairs of runs that cross, every run end at least PIPES_APART from the other run */
  cross: number
  /** the two paint as one pipe: point for point within PIPES_APART, either way round */
  same: boolean
}
/**
 * The one test of two pipes against each other, for the route chooser and the layout lint alike. Running
 * along the other, touching it, running through one of its marks, or a valve on its valve or arrowhead is what
 * the lint reports (G03); a crossing it accepts.
 */
function pipesClash(p: Placed, q: Placed): Clash {
  const runs = (x: Placed): Run[] => x.pts.slice(1).map((b, k) => ({ a: x.pts[k], b }))
  const rp = runs(p)
  const rq = runs(q)
  const along: [number, number][] = []
  const touch: [number, number][] = []
  let cross = 0
  rp.forEach((s, i) => rq.forEach((o, j) => {
    if (runsAlong(s, o)) along.push([i, j])
    // a run end within PIPES_APART of the other run paints as a fork or a T: a crossing keeps every end clear
    else if (endsApart(s.a, s.b, o.a, o.b) < PIPES_APART) touch.push([i, j])
    else if (segsCross(s.a, s.b, o.a, o.b)) cross++
  }))
  // a corner turning into a run that lies along the other pipe is where that along starts: reported once, as along
  const isAlong = (i: number, j: number) => along.some(([x, y]) => x === i && y === j)
  const touches = touch.filter(([i, j]) => !isAlong(i - 1, j) && !isAlong(i + 1, j) && !isAlong(i, j - 1) && !isAlong(i, j + 1))
  const through: Clash['through'] = []
  for (const m of q.marks) if (rp.some(s => runsThrough(s, m.r))) through.push({ by: 0, what: m.what })
  for (const m of p.marks) if (rq.some(o => runsThrough(o, m.r))) through.push({ by: 1, what: m.what })
  // a valve against the other's valve (once: the test is symmetric) and arrowhead, by the valve's own test (valveMeets)
  const marks: Clash['marks'] = []
  for (const [by, x, y] of [[0, p, q], [1, q, p]] as const) for (const v of x.marks) if (v.what === 'valve' && v.at)
    for (const m of y.marks) if ((m.what === 'arrowhead' || (m.what === 'valve' && by === 0)) && valveMeets(v.at, m.r)) marks.push({ by, what: m.what })
  const close = (x: P[], y: P[]) => x.length === y.length && x.every((v, k) => len(sub(v, y[k])) < PIPES_APART)
  return { along, touch: touches, through, marks, cross, same: close(p.pts, q.pts) || close(p.pts, [...q.pts].reverse()) }
}
/** How many G03 the lint gives between two pipes: touching is reported once per pair. */
const faults = (c: Clash): number => c.along.length + Math.min(1, c.touch.length) + c.through.length + c.marks.length
/**
 * How pipe p meets pipe q when the lint would report it, gravest first (0: drawn on top, 1: along or
 * touching, 2: through a mark, or a valve on one), with [now, would] wordings; null when it would not.
 */
function meeting(c: Clash, other: string): { rank: number; said: [string, string] } | null {
  const of = `the pipe of "${other}"`
  if (c.same) return { rank: 0, said: [`is drawn on top of ${of}`, `be drawn on top of ${of}`] }
  if (c.along.length) return { rank: 1, said: [`runs along ${of}`, `run along ${of}`] }
  if (c.touch.length) return { rank: 1, said: [`touches ${of}`, `touch ${of}`] }
  const t = c.through.find(x => x.by === 0) ?? c.through[0]
  if (t) return { rank: 2, said: t.by === 0 ? [`runs through the ${t.what} of "${other}"`, `run through the ${t.what} of "${other}"`] : [`has ${of} running through its ${t.what}`, `have ${of} running through its ${t.what}`] }
  const v = c.marks.find(x => x.by === 0) ?? c.marks[0]
  if (!v) return null
  return { rank: 2, said: v.by === 0 ? [`has its valve on the ${v.what} of "${other}"`, `have its valve on the ${v.what} of "${other}"`] : [`has the valve of "${other}" on its ${v.what}`, `have the valve of "${other}" on its ${v.what}`] }
}
/** Is key x before key y, comparing in order? */
function before(x: readonly number[], y: readonly number[]): boolean {
  const k = x.findIndex((v, q) => v !== y[q])
  return k >= 0 && x[k] < y[k]
}

const ROUTE_NAME: Record<Route, string> = { straight: 'level or plumb', hv: 'horizontal first', vh: 'vertical first', under: 'under', over: 'over', slant: 'at a slant' }
function drawnAs(p: Pipe, sa: Shape, sb: Shape): string {
  const route = p.route
  if (route === 'straight') return 'straight'
  if (route === 'slant') return p.pts[0].x === p.pts[1].x || p.pts[0].y === p.pts[1].y ? 'straight' : 'straight, at a slant'
  if (route === 'hv' || route === 'vh') return `as an elbow, ${ROUTE_NAME[route]}`
  const side = stacked(sa, sb) ? (route === 'under' ? 'to the right of' : 'to the left of') : route === 'under' ? 'below' : 'above'
  return `as a detour ${side} both ends`
}

/** A chosen pipe whose valve may move along its run: frac and ends are what placeValve placed it by. */
type Valved = { pipe: Pipe; frac: number; ends: readonly Rect[] }
/**
 * Where each valve is drawn, in the order given (id order). A valve on another pipe's arrowhead, or on a valve
 * placed before it, moves along its run to the nearest point clear of those and of both ends, as placeValve
 * moves it off the ends; where the run has no such point it stays, and pipesClash counts it. Then a valve still
 * on another's mark moves off them all if it can, so an earlier valve gives way to a later one whose run is too
 * short. Like placeValve, it knows only the flow's own ends: a valve can be moved onto another node, which the
 * lint reports (G03); keeping it off them left more faults in the sweeps than it removed.
 */
function settle(xs: readonly Valved[]): P[] {
  const heads = xs.map(y => pipeMarks(y.pipe, false).find(m => m.what === 'arrowhead')!.r)
  // valve i off every other arrowhead and the valves `others` (valveBox, as pipeMarks boxes them), if its run allows
  const clear = (i: number, c: P, others: readonly P[]): P => {
    const marks = [...heads.filter((_, j) => j !== i), ...others.map(valveBox)]
    if (!marks.some(r => valveMeets(c, r))) return c
    const keep = [...xs[i].ends, ...marks]
    const moved = placeValve(xs[i].pipe.pts, xs[i].frac, keep).c
    return keep.some(r => valveMeets(moved, r)) ? c : moved
  }
  const out: P[] = []
  xs.forEach((x, i) => out.push(clear(i, x.pipe.valve, out)))
  xs.forEach((_, i) => { out[i] = clear(i, out[i], out.filter((_, j) => j !== i)) })
  return out
}

/**
 * Every flow's pipe, and its G08 when it has one. The flows between one pair of ends are decided
 * together, in id order, so the file's order never changes the drawing. Each combination is judged with
 * its valves where they would be drawn (settle): the fewest pipes drawn on top of each other; then the
 * fewest shapes that do not fit (pipeFault; only the slant is kept when it does not), so such a shape is
 * drawn only when each shape that fits would be drawn on top of another pipe; then the fewest faults the
 * lint reports between them (pipesClash: one runs along or touches another, or through its valve,
 * arrowhead or ×, or has its valve on another's valve or arrowhead); then the fewest shapes that come with
 * a G08 (a refused route, a slant); then, between named routes, the earlier id keeps its own; then the
 * fewest crossings, which the lint accepts; then the lowest total cost, ties going to the earlier id. A
 * route the model names costs nothing; standing in for it costs FALLBACK more. The slant is always there,
 * last, so every flow is drawn. Last, every valve is settled against the marks of pipes between other ends.
 */
function routeFlows(flows: readonly Flow[], shape: ReadonlyMap<string, Shape>): Map<string, { pipe: Pipe; warning: string }> {
  const out = new Map<string, { pipe: Pipe; warning: string }>()
  const groups = new Map<string, Flow[]>()
  for (const f of flows) {
    if (!shape.has(f.from) || !shape.has(f.to)) continue
    const k = [f.from, f.to].sort().join('\u0000')
    const g = groups.get(k)
    if (g) g.push(f); else groups.set(k, [f])
  }
  const byId = (x: Flow, y: Flow) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)
  const chosenAll: { f: Flow; v: Valved; warning: string }[] = []
  /** Claims about the pipes as drawn, made once every valve is settled (drawn: each flow's final valve by id). */
  const asDrawn: ((drawn: ReadonlyMap<string, P>) => void)[] = []
  for (const group of groups.values()) {
    group.sort(byId)
    const tried = group.map(f => {
      const sa = shape.get(f.from)!
      const sb = shape.get(f.to)!
      const ends = [extent(sa), extent(sb)]
      const built = new Map<Route, Pipe | null>()
      for (const r of ROUTES) {
        const pts = pipeShape(r, sa, sb)
        if (!pts) { built.set(r, null); continue }
        const { run, c } = placeValve(pts, f.valve, ends)
        built.set(r, { route: r, pts, run, valve: c, fault: pipeFault(pts, c, ends[0], ends[1]) })
      }
      const asked: Route | undefined = f.route === 'straight' ? (built.get('straight') ? 'straight' : 'slant')
        : f.route === 'hv' || f.route === 'vh' || f.route === 'under' || f.route === 'over' ? f.route : undefined
      const kept = (p: Pipe): boolean => p.route === asked && !p.fault
      const options: (Pipe & { cost: number; refused: number; warned: number; own: number })[] = []
      for (const r of ROUTES) {
        const p = built.get(r)
        if (!p || (p.fault && r !== 'slant')) continue
        const refused = asked !== undefined && !kept(p) ? 1 : 0
        // drawn with a G08 for its shape: a refused route, or a slant no route asked for
        const warned = refused || (asked === undefined && r === 'slant') ? 1 : 0
        options.push({ ...p, refused, warned, own: p.fault ? 1 : 0, cost: asked === undefined ? ROUTE_COST[r] : refused ? FALLBACK + ROUTE_COST[r] : 0 })
      }
      options.sort((x, y) => x.cost - y.cost)
      return { sa, sb, ends, built, asked, options, missing: f.status === 'missing' }
    })
    const n = group.length
    const item = (x: number, a: number): Valved => ({ pipe: tried[x].options[a], frac: group[x].valve, ends: tried[x].ends })
    /** The valves of combination cur (flow x takes option cur[x]), where they would be drawn. */
    const valvesOf = (cur: readonly number[]): P[] => settle(cur.map((a, x) => item(x, a)))
    // option a of flow x with its valve at v, cached by where the valve is: 0 where it was placed, else the nth place it moved to
    const moves = new Map<number, P[]>()
    const at = (x: number, a: number, v: P): number => {
      const k = x * ROUTES.length + a
      if (v === tried[x].options[a].valve) return k * 4096
      const seenAt = moves.get(k) ?? []
      moves.set(k, seenAt)
      let m = seenAt.findIndex(u => u.x === v.x && u.y === v.y)
      if (m < 0) m = seenAt.push(v) - 1
      return k * 4096 + m + 1
    }
    const placedSeen = new Map<number, Placed>()
    const placedAt = (x: number, a: number, v: P, k: number): Placed => {
      let p = placedSeen.get(k)
      if (!p) { const o = tried[x].options[a]; p = { pts: o.pts, marks: pipeMarks({ ...o, valve: v }, tried[x].missing) }; placedSeen.set(k, p) }
      return p
    }
    const seen = new Map<string, Clash>()
    const clash = (x: number, a: number, vx: P, y: number, b: number, vy: P): Clash => {
      const kx = at(x, a, vx)
      const ky = at(y, b, vy)
      const k = `${kx},${ky}`
      let c = seen.get(k)
      if (c === undefined) { c = pipesClash(placedAt(x, a, vx, kx), placedAt(y, b, vy, ky)); seen.set(k, c) }
      return c
    }
    let pick: number[] = []
    if (n <= JOINT_MAX) {
      // every combination, by [drawn on top, shapes that do not fit, lint faults, G08 shapes, refused routes by id, crossings, total, each cost]
      let bestKey: number[] | null = null
      const cur = new Array<number>(n).fill(0)
      const visit = (i: number): void => {
        if (i === n) {
          const vs = valvesOf(cur)
          let same = 0
          let bad = 0
          let cross = 0
          for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) {
            const c = clash(x, cur[x], vs[x], y, cur[y], vs[y])
            same += Number(c.same)
            bad += faults(c)
            cross += c.cross
          }
          const opt = cur.map((a, x) => tried[x].options[a])
          const costs = opt.map(o => o.cost)
          const key = [same, opt.reduce((s, o) => s + o.own, 0), bad, opt.reduce((s, o) => s + o.warned, 0), ...opt.map(o => o.refused), cross, costs.reduce((s, c) => s + c, 0), ...costs]
          if (!bestKey || before(key, bestKey)) { bestKey = key; pick = [...cur] }
          return
        }
        for (let a = 0; a < tried[i].options.length; a++) { cur[i] = a; visit(i + 1) }
      }
      visit(0)
    } else {
      // one by one, the flows with a route of their own first (a fixed choice), then the rest, each in id order:
      // against the pipes already decided, by [drawn on top, does not fit, lint faults, G08 shape, crossings, cost]
      const turn = [...group.keys()].sort((x, y) => Number(!tried[x].asked) - Number(!tried[y].asked) || x - y)
      pick = new Array<number>(n).fill(0)
      turn.forEach((i, k) => {
        let bestKey: number[] | null = null
        const done = turn.slice(0, k)
        const these = [...done, i].sort((x, y) => x - y)
        tried[i].options.forEach((o, a) => {
          const vs = settle(these.map(x => item(x, x === i ? a : pick[x])))
          const vi = vs[these.indexOf(i)]
          const key = [0, o.own, 0, o.warned, 0, o.cost]
          for (const j of done) {
            const c = clash(i, a, vi, j, pick[j], vs[these.indexOf(j)])
            key[0] += Number(c.same)
            key[2] += faults(c)
            key[4] += c.cross
          }
          if (!bestKey || before(key, bestKey)) { bestKey = key; pick[i] = a }
        })
      })
    }
    group.forEach((f, i) => {
      const t = tried[i]
      const chosen = t.options[pick[i]]
      /** How option a of this flow meets the pipes chosen for the others, valves at va: the gravest, the earlier id in a tie; null when it keeps apart. */
      const gravest = (a: number, va: readonly P[]): [string, string] | null => {
        let worst: { rank: number; said: [string, string] } | null = null
        for (let q = 0; q < n; q++) if (q !== i) { const m = meeting(clash(i, a, va[i], q, pick[q], va[q]), group[q].id); if (m && (!worst || m.rank < worst.rank)) worst = m }
        return worst?.said ?? null
      }
      const meets = (a: number) => gravest(a, valvesOf(pick.map((b, x) => (x === i ? a : b))))
      const why = (r: Route): string => {
        const p = t.built.get(r)
        if (!p) return 'the ends share no row or column wide enough for the pipe'
        if (p.fault) return p.fault
        const a = t.options.findIndex(o => o.route === r)
        const m = a >= 0 ? meets(a) : null
        return m ? `it would ${m[1]}, between the same ends` : 'it was given up so that the other pipes between the same ends keep apart'
      }
      // the slant is drawn even when it does not fit itself: then the warning says so too
      const how = `${drawnAs(chosen, t.sa, t.sb)}${chosen.fault ? `, anyway (${chosen.fault})` : ''}`
      let warning = ''
      if (t.asked && chosen.route === t.asked && chosen.fault)
        // read from the options: by the key, a shape that does not fit is drawn over one that does only when that
        // one would be drawn on top of another pipe (the others as chosen)
        warning = `route "${f.route}" does not fit here: ${chosen.fault}, and ${t.options.some(o => !o.fault) ? 'every shape that does would be drawn on top of another pipe between the same ends' : 'no other shape does'}. It is drawn as asked anyway; drop "route" or move an end.`
      else if (t.asked && chosen.route !== t.asked)
        warning = `route "${f.route}" does not fit here: ${why(t.asked)}. It is drawn ${how}; drop "route" or move an end.`
      else if (t.asked) {
        // kept, yet meeting a sibling as drawn: the lint's G03 says where; this says the named route did not keep it apart
        const entry = { f, v: item(i, pick[i]), warning }
        asDrawn.push(drawn => {
          const m = gravest(pick[i], group.map(g => drawn.get(g.id)!))
          if (m) entry.warning = `route "${f.route}" is drawn as asked, but it ${m[0]}, between the same ends. Drop "route" or move an end.`
        })
        chosenAll.push(entry)
        return
      } else if (chosen.route === 'slant')
        warning = `no other shape fits here (${ROUTES.filter(r => r !== 'slant').map(r => `${ROUTE_NAME[r]}: ${why(r)}`).join('; ')}). It is drawn ${how}; line the ends up ("at"), or move one further off.`
      chosenAll.push({ f, v: item(i, pick[i]), warning })
    })
  }
  // the valves against the marks of pipes between other ends too, in id order; where none is near, this gives
  // back each group's own settle, the one its chooser judged
  chosenAll.sort((x, y) => byId(x.f, y.f))
  const final = settle(chosenAll.map(x => x.v))
  const drawn = new Map(chosenAll.map((x, k) => [x.f.id, final[k]]))
  for (const claim of asDrawn) claim(drawn)
  chosenAll.forEach((x, k) => out.set(x.f.id, { pipe: { ...x.v.pipe, valve: final[k] }, warning: x.warning }))
  return out
}

/** Where a copy of a missing element carries its ×: past the right end of its underline (w: the text's width). */
const shadowCrossAt = (c: P, w: number): P => ({ x: c.x + w / 2 + SHADOW_CROSS / 2 + 2, y: c.y + 9 })
/**
 * All a shadow draws: its name and, for a copy of something missing, the ×. The one rectangle that both
 * link exits and the layout lint use, so the two cannot disagree about where the shadow ends.
 */
function shadowExtent(c: P, w: number, status: Status): Rect {
  const r = { x: c.x - w / 2 - 3, y: c.y - 9, w: w + 6, h: 18 }
  if (status !== 'missing') return r
  const x = shadowCrossAt(c, w)
  const h = SHADOW_CROSS / 2 + 1 // the ×'s half-size and its stroke
  const x1 = Math.max(r.x + r.w, x.x + h)
  const y1 = Math.max(r.y + r.h, x.y + h)
  return { x: r.x, y: r.y, w: x1 - r.x, h: y1 - r.y }
}

// ---------------------------------------------------------------------------- drawing primitives

/**
 * One SVG element per line, so the page can be read back in pages. Text is escaped, so every "<" starts
 * a tag; whitespace between SVG elements draws nothing.
 */
const lines = (svg: string): string => svg.replace(/></g, '>\n<')

function textEl(x: number, y: number, s: string, cls: string, anchor = 'middle'): string {
  return `<text x="${r1(x)}" y="${r1(y)}" class="${cls}" text-anchor="${anchor}">${esc(s)}</text>`
}
function arrowHead(at: P, dir: P, size: number, cls: string): string {
  return `<polygon class="${cls}" points="${headPoints(at, dir, size).map(pt).join(' ')}"/>`
}
function cross(m: P, r = 6): string {
  return `<path class="miss-x${r < 6 ? ' sm' : ''}" d="M${r1(m.x - r)},${r1(m.y - r)} L${r1(m.x + r)},${r1(m.y + r)} M${r1(m.x - r)},${r1(m.y + r)} L${r1(m.x + r)},${r1(m.y - r)}"/>`
}

/** The page's visual primitives. Legend swatches call these same functions. */
const draw = {
  stock(c: P, w: number, h: number): string {
    return `<rect class="stock-box" x="${r1(c.x - w / 2)}" y="${r1(c.y - h / 2)}" width="${r1(w)}" height="${r1(h)}" rx="2"/>`
  },
  cloud(c: P): string {
    const x = c.x - 24
    const y = c.y - 14
    return `<path class="cloud-shape" d="M${r1(x + 8)},${r1(y + 26)} a8,8 0 0 1 -2,-15 a10,10 0 0 1 16,-8 a11,11 0 0 1 20,3 a8,8 0 0 1 4,15 z"/>`
  },
  /** A variable's dot or a constant's ring; anything not observed wears a dashed or dotted halo. */
  dot(c: P, ring: boolean, status: Status): string {
    const core = `<circle class="${ring ? 'const-dot' : 'aux-dot'}" cx="${r1(c.x)}" cy="${r1(c.y)}" r="5"/>`
    return status === 'observed' ? core : `${core}<circle class="halo" cx="${r1(c.x)}" cy="${r1(c.y)}" r="9"/>`
  },
  /** A pipe with its valve; a missing one carries a cross at `crossAt` (crossPlace), painted last so it shows over the valve. */
  pipe(points: P[], valve: { c: P; dir: P }, crossAt?: P): string {
    const last = points[points.length - 1]
    // pipeFault judges this same arrowhead (headPoints, from the last run's direction)
    const dir = sub(last, points[points.length - 2])
    const end = sub(last, mul(unit(dir), 9))
    const d = points.slice(0, -1).map((p, i) => `${i ? 'L' : 'M'}${pt(p)}`).join(' ') + ` L${pt(end)}`
    let s = `<path class="pipe-outer" d="${d}"/><path class="pipe-inner" d="${d}"/>${arrowHead(last, dir, HEAD, 'pipe-head')}`
    s += draw.valve(valve.c, valve.dir)
    if (crossAt) s += cross(crossAt)
    return s
  },
  valve(c: P, dir: P): string {
    const d = unit(dir)
    const n = perp(d)
    const p = (a: number, b: number) => pt(add(add(c, mul(n, a)), mul(d, b)))
    return `<path class="valve-shape" d="M${p(VALVE_R, -7)} L${p(VALVE_R, 7)} L${pt(c)} Z M${p(-VALVE_R, -7)} L${p(-VALVE_R, 7)} L${pt(c)} Z"/>`
  },
  link(q: Curve, missing: boolean): string {
    const tan = quadTan(q, 1)
    const end = sub(q.b, mul(tan, 8))
    const d = `M${pt(q.a)} Q${pt(q.c)} ${pt(end)}`
    let s = `<path class="link-hit" d="${d}"/><path class="link-path" d="${d}"/>${arrowHead(q.b, tan, 9, 'link-head')}`
    if (missing) s += cross(quad(q, 0.5))
    return s
  },
  delay(q: Curve): string {
    const m = quad(q, 0.5)
    const d = quadTan(q, 0.5)
    const n = perp(d)
    const one = (k: number) => { const c = add(m, mul(d, k)); return `M${pt(add(c, mul(n, 7)))} L${pt(sub(c, mul(n, 7)))}` }
    return `<path class="delay-mark" d="${one(-2.5)} ${one(2.5)}"/>`
  },
  /**
   * A shadow: the copied name in angle brackets. A copy of something modelled is underlined dashed, of
   * something intended dotted, of something missing dashed with a small × at the right end (shadowCrossAt).
   */
  shadow(c: P, label: string, w: number, status: Status): string {
    const t = textEl(c.x, c.y + 4, label, 'shadow-lbl')
    if (status === 'observed') return t
    const ul = `<line class="shadow-ul" x1="${r1(c.x - w / 2)}" y1="${r1(c.y + 9)}" x2="${r1(c.x + w / 2)}" y2="${r1(c.y + 9)}"/>`
    return status === 'missing' ? `${t}${ul}${cross(shadowCrossAt(c, w), SHADOW_CROSS / 2)}` : `${t}${ul}`
  },
  sign(p: P, s: '+' | '-'): string {
    return `<text class="pol" x="${r1(p.x)}" y="${r1(p.y + 5)}" text-anchor="middle">${s === '-' ? '−' : '+'}</text>`
  },
  marker(c: P, id: string, clockwise: boolean, r = 15): string {
    const startA = clockwise ? -30 : 210
    const sx = c.x + r * Math.cos((startA * Math.PI) / 180)
    const sy = c.y + r * Math.sin((startA * Math.PI) / 180)
    const top = { x: c.x, y: c.y - r }
    const arc = `M${r1(sx)},${r1(sy)} A${r1(r)},${r1(r)} 0 1 ${clockwise ? 1 : 0} ${pt(top)}`
    const head = arrowHead(add(top, { x: clockwise ? 4 : -4, y: 0 }), { x: clockwise ? 1 : -1, y: 0 }, 7, 'mark-head')
    return `<path class="mark-arc" d="${arc}"/>${head}<text class="mark-id${r < 15 ? ' small' : ''}" x="${r1(c.x)}" y="${r1(c.y + (r < 15 ? 3.5 : 4))}" text-anchor="middle">${esc(id)}</text>`
  },
}

// ------------------------------------------------------------------------------- marks & legend

const STATUS_CLASS: Record<Status, string> = { observed: 'obs', modelled: 'hyp', intended: 'int', missing: 'miss' }

/** A mark is what a reader has to decode: a shape kind in a status, highlighted or not. */
type Mark = string
const markOf = (kind: string, status: Status, emph: boolean): Mark => `${kind}|${status}|${emph ? 'emph' : 'plain'}`

const KIND_TEXT: Record<string, string> = {
  stock: 'A **box** is something that piles up and stays until a flow changes it (a stock).',
  flow: 'A **pipe with a valve** is a rate that fills or drains a box (a flow), counted per unit of time. It is not a data path.',
  aux: 'A **dot** is a quantity worked out from others, which can change at once (a variable).',
  constant: 'A **ring** is a setting or limit that stays fixed over the time considered (a constant). Its value is shown when a source gives it.',
  link: 'A **thin arrow** means the target reads or depends on the source (a link). **+**: more of the source gives more of the target than there would otherwise be. **−**: less.',
}
const STATUS_WHY: Record<Status, string> = {
  observed: '',
  modelled: 'It was inferred by the modeller, not stated in the sources; select it to read the claim.',
  intended: 'It is specified or documented but not built, so it is not part of any live loop.',
  missing: 'It should exist and does not: the absence is a finding. It is not part of any live loop.',
}
const KIND_NOUN: Record<string, string> = { stock: 'box', flow: 'pipe', aux: 'dot', constant: 'ring', link: 'arrow' }
const KIND_NAME: Record<string, string> = { stock: 'stock', flow: 'flow', aux: 'variable', constant: 'constant', link: 'link' }

/** The words for what a variant looks like, matching what the CSS paints. */
function looks(kind: string, status: Status, emph: boolean): string {
  const colour = emph ? 'alert-colour' : status === 'observed' ? '' : 'grey'
  if (kind === 'aux' || kind === 'constant') {
    const halo = status === 'modelled' ? ' with a dashed halo' : status === 'intended' ? ' with a dotted halo' : ''
    return [colour, KIND_NOUN[kind]].filter(Boolean).join(' ') + halo
  }
  const line = status === 'modelled' ? 'dashed' : status === 'intended' ? 'dotted' : status === 'missing' ? 'dashed, crossed (×)' : ''
  return [line, colour, KIND_NOUN[kind]].filter(Boolean).join(' ')
}
const article = (w: string) => (/^[aeiou]/i.test(w) ? 'An' : 'A')
/** What a shadow's status looks like, matching draw.shadow and the CSS. */
const SHADOW_LOOK: Record<Status, string> = { observed: '', modelled: 'underlined dashed', intended: 'underlined dotted', missing: 'underlined dashed and crossed (×)' }
/** A shadow's mark: plain shadows keep the round-2 form, so a highlighted copy is a separate legend entry. */
const shadowMark = (st: Status, emph: boolean): Mark => `shadow|${st}${emph ? '|emph' : ''}`

type Rich = { html: string; text: string }
/** The plugin's own template text, in two forms: **bold** becomes <b> for the page and plain words for the reader view. */
function rich(s: string): Rich {
  return { html: esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'), text: s.replace(/\*\*(.+?)\*\*/g, '$1') }
}
/** The modeller's text, printed exactly as written (never parsed for markup). */
const plain = (s: string): Rich => ({ html: esc(s), text: s })
const cat = (...parts: Rich[]): Rich => ({ html: parts.map(p => p.html).join(''), text: parts.map(p => p.text).join('') })
/** The highlight's own rule, as the modeller wrote it, for a legend entry of a highlighted mark. */
const highlightRule = (model: Model): Rich => model.emphasis
  ? cat(plain(' It is highlighted ('), plain(model.emphasis.name), plain('): '), plain(model.emphasis.rule.trim().replace(/[.!?]?$/, m => m || '.')))
  : plain('')

type LegendEntry = { mark: Mark; swatch: string; rich: Rich }

function swatchFor(kind: string, status: Status, emph: boolean): string {
  const cls = `el ${kind} ${STATUS_CLASS[status]}${emph ? ' emph' : ''}`
  const sw = (body: string) => lines(`<svg class="sw" viewBox="0 0 64 36" aria-hidden="true"><g class="${cls}">${body}</g></svg>`)
  switch (kind) {
    case 'stock': return sw(draw.stock({ x: 32, y: 18 }, 50, 24))
    case 'flow': {
      const pts = [{ x: 4, y: 18 }, { x: 60, y: 18 }]
      const v = { x: 22, y: 18 }
      return sw(draw.pipe(pts, { c: v, dir: { x: 1, y: 0 } }, status === 'missing' ? crossPlace(pts, 0, v) : undefined))
    }
    case 'aux': return sw(draw.dot({ x: 32, y: 18 }, false, status))
    case 'constant': return sw(draw.dot({ x: 32, y: 18 }, true, status))
    default: {
      const q = { a: { x: 6, y: 26 }, c: { x: 32, y: 6 }, b: { x: 58, y: 26 } }
      return lines(`<svg class="sw" viewBox="0 0 64 36" aria-hidden="true"><g class="${cls}">${draw.link(q, status === 'missing')}</g><g class="sign${emph ? ' emph' : ''}">${draw.sign({ x: 54, y: 12 }, '+')}</g></svg>`)
    }
  }
}

function legend(model: Model, marks: Set<Mark>, extras: Set<string>): LegendEntry[] {
  const out: LegendEntry[] = []
  const statuses: Status[] = ['observed', 'modelled', 'intended', 'missing']
  for (const kind of ['stock', 'flow', 'aux', 'constant', 'link']) for (const st of statuses) for (const emph of [false, true]) {
    const mk = markOf(kind, st, emph)
    if (!marks.has(mk)) continue
    let text: Rich
    if (st === 'observed' && !emph) text = rich(KIND_TEXT[kind])
    else {
      const look = looks(kind, st, emph)
      const base = marks.has(markOf(kind, 'observed', false))
        ? `${article(look)} **${look}** is a ${KIND_NAME[kind]} drawn like the ${KIND_NOUN[kind]} above.`
        : `${KIND_TEXT[kind]} Drawn here as ${article(look).toLowerCase()} **${look}**.`
      text = rich([base, STATUS_WHY[st]].filter(Boolean).join(' '))
      if (emph) text = cat(text, highlightRule(model))
    }
    out.push({ mark: mk, swatch: swatchFor(kind, st, emph), rich: text })
  }
  const sw = (body: string) => lines(`<svg class="sw" viewBox="0 0 64 36" aria-hidden="true">${body}</svg>`)
  if (extras.has('cloud')) out.push({ mark: 'cloud', swatch: sw(`<g class="el cloud">${draw.cloud({ x: 32, y: 19 })}</g>`), rich: rich('A **cloud** is where a flow comes from or goes to outside the model; what lies there does not matter to the question.') })
  for (const st of statuses) for (const emph of [false, true]) {
    const mk = shadowMark(st, emph)
    if (!marks.has(mk)) continue
    const swatch = sw(`<g class="el shadow ${STATUS_CLASS[st]}${emph ? ' emph' : ''}">${draw.shadow({ x: 32, y: 18 }, '<x>', 26, st)}</g>`)
    const look = [emph ? 'in the alert colour' : '', SHADOW_LOOK[st]].filter(Boolean).join(', ')
    const what = st === 'observed'
      ? 'is a copy of something drawn in full elsewhere on this page (a shadow); nothing points into it.'
      : `is a copy (a shadow) of something ${st}: ${STATUS_WHY[st].charAt(0).toLowerCase()}${STATUS_WHY[st].slice(1)}`
    const text = rich(`A name in **<angle brackets>**${look ? `, ${look},` : ''} ${what}`)
    out.push({ mark: mk, swatch, rich: emph ? cat(text, highlightRule(model)) : text })
  }
  if (extras.has('delay')) {
    const q = { a: { x: 6, y: 18 }, c: { x: 32, y: 18 }, b: { x: 58, y: 18 } }
    out.push({ mark: 'delay', swatch: sw(`<g class="el link obs">${draw.link(q, false)}${draw.delay(q)}</g>`), rich: rich('Two short bars **∥** across an arrow mean the value is read late: polling, caching or reporting.') })
  }
  if (extras.has('R') || extras.has('B')) {
    const two = extras.has('R') && extras.has('B')
    const body = (extras.has('R') ? `<g class="loopmark R">${draw.marker({ x: two ? 16 : 32, y: 19 }, 'R', true, two ? 12 : 15)}</g>` : '') + (extras.has('B') ? `<g class="loopmark B">${draw.marker({ x: two ? 48 : 32, y: 19 }, 'B', false, two ? 12 : 15)}</g>` : '')
    out.push({ mark: 'loop', swatch: sw(body), rich: rich(`A **loop marker** sits inside a feedback loop.${extras.has('R') ? ' **R** (reinforcing): a change feeds on itself.' : ''}${extras.has('B') ? ' **B** (balancing): a change is pushed back toward a goal or limit.' : ''} The arrow shows which way the loop runs at the marker; select a loop to trace it.`) })
  } else if (extras.has('pill')) {
    // painted by the .pill-sw rules, like the page's .pill tags: no text halo, and the tag's own text colour
    out.push({ mark: 'pill', swatch: sw('<g class="pill-sw"><rect class="R" x="14" y="10" width="16" height="16" rx="3"/><text x="22" y="22" text-anchor="middle">R</text><rect class="B" x="36" y="10" width="16" height="16" rx="3"/><text x="44" y="22" text-anchor="middle">B</text></g>'),
      rich: rich('An **R** or **B** tag marks a loop that would exist if built: **R** (reinforcing), a change would feed on itself; **B** (balancing), a change would be pushed back toward a goal or limit.') })
  }
  return out
}

// ------------------------------------------------------------------------------------- figures

type Ctx = {
  name: (id: string) => string
  model: Model
  report: Analysis['report']
  nodeById: Map<string, Node>
  flowById: Map<string, Flow>
  linkById: Map<string, Link>
  loopsOf: Map<string, string[]>
}

/** What a reader calls an element: the checker's one naming function (spec.ts namer). */
const labelOf = (ctx: Ctx, id: string): string => ctx.name(id)

function attrs(ctx: Ctx, id: string, kind: string, status: Status, emph: boolean, aria: string): string {
  const cls = ['el', kind, STATUS_CLASS[status], emph ? 'emph' : ''].filter(Boolean).join(' ')
  const name = `${aria}${status === 'observed' ? '' : `, ${status}`}${emph ? ', highlighted' : ''}`
  return `class="${cls}" data-id="${esc(id)}" data-loops="${esc((ctx.loopsOf.get(id) ?? []).join(' '))}" tabindex="0" role="button" aria-label="${esc(name)}"`
}

/** What a shadow shows of the element it copies: its status and its highlight, read from that element. */
function copied(ctx: Ctx, n: Node): { status: Status; emphasis?: string } {
  const o = n.of ? ctx.nodeById.get(n.of) ?? ctx.flowById.get(n.of) : undefined
  return { status: o?.status ?? 'observed', emphasis: o?.emphasis }
}

type Drawn = {
  svg: string; layout: Issue[]; marks: Set<Mark>; extras: Set<string>; highlighted: string[]
  bends: Map<string, number>; tight: string[]
}

function drawFigure(ctx: Ctx, figId: string, bendOverride: ReadonlyMap<string, number> = new Map()): Drawn {
  nonFinite = 0
  const m = ctx.model
  const layout: Issue[] = []
  const marks = new Set<Mark>()
  const extras = new Set<string>()
  const warn = (code: string, where: string, message: string) => layout.push({ code, level: 'warning', where, message })
  const nodes = m.nodes.filter(n => n.figure === figId)
  const flows = m.flows.filter(f => f.figure === figId)
  const links = m.links.filter(l => l.figure === figId)

  const shape = new Map<string, Shape>()
  const boxes: Box[] = []
  const boxIdx = makeGrid<Box>()
  const addBox = (b: Box) => { boxes.push(b); boxIdx.add(b) }
  const segs: Seg[] = []
  const segIdx = makeGrid<SegItem>()
  const ptIdx = makeGrid<PtItem>(32)
  /** Link curves as short straight pieces, so a label is tested against the whole curve, not sample points. */
  const curveIdx = makeGrid<SegItem>()
  const curves = new Map<string, Curve>()
  const curveSamples = new Map<string, P[]>()
  const stockW = new Map<string, number>()
  const stockLines = new Map<string, string[]>()
  const shadowW = new Map<string, number>()

  for (const n of nodes) {
    const c = grid(n.at[0], n.at[1])
    if (n.kind === 'stock') {
      const lines = wrap(n.label, STOCK_W - 20, 12.5)
      const w = Math.max(STOCK_W, ...lines.map(l => textW(l, 12.5) + 20), n.units ? textW(`(${n.units})`, 11) + 20 : 0)
      stockW.set(n.id, w)
      stockLines.set(n.id, lines)
      const s: Shape = { kind: 'rect', c, w, h: STOCK_H }
      shape.set(n.id, s)
      addBox({ ...extent(s), owner: n.id, what: 'stock' })
    } else if (n.kind === 'cloud') {
      const s: Shape = { kind: 'rect', c, w: 50, h: 30 }
      shape.set(n.id, s)
      addBox({ ...extent(s), owner: n.id, what: 'cloud' })
    } else if (n.kind === 'shadow') {
      const w = textW(`<${labelOf(ctx, n.id)}>`, 12)
      shadowW.set(n.id, w)
      const r = shadowExtent(c, w, copied(ctx, n).status)
      shape.set(n.id, { kind: 'rect', c: { x: r.x + r.w / 2, y: r.y + r.h / 2 }, w: r.w, h: r.h })
      addBox({ ...r, owner: n.id, what: 'shadow' })
    } else {
      shape.set(n.id, { kind: 'circle', c, r: 5 })
      addBox({ x: c.x - 9, y: c.y - 9, w: 18, h: 18, owner: n.id, what: n.kind === 'aux' ? 'variable' : 'constant' })
    }
  }
  for (let i = 0; i < boxes.length; i++) for (const b of boxIdx.near(boxes[i], 4))
    if (b !== boxes[i] && boxes.indexOf(b) > i && hit(boxes[i], b, 4)) warn('G01', `node "${boxes[i].owner}"`, `overlaps node "${b.owner}". Move one of them ("at").`)

  // pipes: the flows between each pair of ends are routed together (routeFlows), then drawn
  const reported = new Set<string>()
  const once = (k: string, f: () => void) => { if (!reported.has(k)) { reported.add(k); f() } }
  const pipePts = new Map<string, P[]>()
  const valveAt = new Map<string, { c: P; dir: P }>()
  const crossAt = new Map<string, P>()
  const placed = new Map<string, Placed>()
  /** The boxes of pipe marks: pipes are tested against them by pipesClash, not by the lint's box loop. */
  const markBoxes = new Set<Box>()
  const routed = routeFlows(flows, shape)
  for (const f of flows) {
    const r = routed.get(f.id)
    if (!r) continue
    if (r.warning) warn('G08', `flow "${f.id}"`, r.warning)
    const { pts, run, valve: c } = r.pipe
    pipePts.set(f.id, pts)
    for (let k = 0; k < pts.length - 1; k++) { const s = { a: pts[k], b: pts[k + 1], owner: f.id }; segs.push(s); segIdx.add(segItem(s)) }
    valveAt.set(f.id, { c, dir: sub(pts[run + 1], pts[run]) })
    shape.set(f.id, { kind: 'circle', c, r: VALVE_R })
    const marks = pipeMarks(r.pipe, f.status === 'missing')
    placed.set(f.id, { pts, marks })
    for (const mk of marks) { const b = { ...mk.r, owner: f.id, what: mk.what }; addBox(b); markBoxes.add(b) }
    const x = marks.find(mk => mk.what === 'cross')?.at
    if (x) crossAt.set(f.id, x)
  }
  // pipes against each other: the chooser's own test (pipesClash), so the two cannot disagree; a crossing is accepted
  const pairs = new Set<string>()
  for (const s of segs) {
    const meet = (o: string) => { if (o !== s.owner) pairs.add([s.owner, o].sort().join('\u0000')) }
    for (const o of segIdx.near(segItem(s), PIPES_APART)) meet(o.owner)
    for (const b of boxIdx.near(segItem(s), 2)) if (markBoxes.has(b)) meet(b.owner)
  }
  // a valve on another pipe's mark, wherever their runs are
  for (const m of markBoxes) for (const b of boxIdx.near(m, VALVE_GAP)) if (markBoxes.has(b) && b.owner !== m.owner) pairs.add([m.owner, b.owner].sort().join('\u0000'))
  for (const k of [...pairs].sort()) {
    const [f, g] = k.split('\u0000')
    const c = pipesClash(placed.get(f)!, placed.get(g)!)
    for (const _ of c.along) warn('G03', `flow "${f}"`, `its pipe runs along the pipe of "${g}". Set a "route", or move an end.`)
    if (c.touch.length) warn('G03', `flow "${f}"`, `its pipe touches the pipe of "${g}". Set a "route", or move an end.`)
    for (const t of c.through) {
      const [by, of] = t.by === 0 ? [f, g] : [g, f]
      once(`${by}|${of}|${t.what}`, () => warn('G03', `flow "${by}"`, `its pipe runs through the ${t.what} of "${of}". Set its "route", or move an end.`))
    }
    for (const v of c.marks) {
      const [by, of] = v.by === 0 ? [f, g] : [g, f]
      // settle has already tried every point of its run: an arrowhead stays at its target, so only a route or
      // an end can clear it; another valve can move, so setting either valve may
      const advice = v.what === 'arrowhead' ? 'Set its "route", or move an end.' : `Set the "valve" of either, or a "route", or move an end.`
      once(`${by}|valve|${of}|${v.what}`, () => warn('G03', `flow "${by}"`, `its valve sits on the ${v.what} of "${of}". ${advice}`))
    }
  }

  // links: choose a bend that keeps the curve off boxes, pipes and earlier curves
  const bends = new Map<string, number>()
  const tight: string[] = []
  const sampleCurve = (q: Curve, n = 26): P[] => Array.from({ length: n + 1 }, (_, k) => quad(q, k / n))
  const curveFor = (l: Link, bend: number): Curve | null => {
    const sa = shape.get(l.from)
    const sb = shape.get(l.to)
    if (!sa || !sb) return null
    const chord = sub(sb.c, sa.c)
    const c0 = add(add(sa.c, mul(chord, 0.5)), mul(perp(unit(chord)), bend * len(chord)))
    const a = exitPoint(sa, c0)
    const b = exitPoint(sb, c0, 4)
    const c = add(add(a, mul(sub(b, a), 0.5)), mul(perp(unit(sub(b, a))), bend * len(sub(b, a))))
    return { a, c, b }
  }
  const curveCost = (l: Link, q: Curve): number => {
    let cost = 0
    for (let k = 3; k <= 23; k++) {
      const p = quad(q, k / 26)
      const r = { x: p.x, y: p.y, w: 0, h: 0 }
      for (const b of boxIdx.near(r, 4)) if (b.owner !== l.from && b.owner !== l.to && inRect(p, b, 3)) cost += 100
      for (const s of segIdx.near(r, PIPE_PAD + 2)) if (distSeg(p, s.a, s.b) < PIPE_PAD + 2) cost += 30
      for (const o of ptIdx.near(r, 6)) if (o.owner !== l.id && len(sub(p, o.p)) < 6) cost += 8
    }
    return cost
  }
  for (const l of links) {
    const sa = shape.get(l.from)
    const sb = shape.get(l.to)
    if (!sa || !sb) continue
    const short = len(sub(sb.c, sa.c)) < 170
    const atLeast = bendOverride.get(l.id)
    const base = short ? [0.5, -0.5, 0.7, -0.7, 0.35, -0.35] : [0.22, -0.22, 0.35, -0.35, 0.12, -0.12, 0.5, -0.5]
    const tries = l.bend !== undefined ? [l.bend]
      : atLeast !== undefined ? [atLeast, -atLeast, atLeast + 0.15, -(atLeast + 0.15)].filter(b => Math.abs(b) <= 0.95)
      : base
    let best: { q: Curve; cost: number; bend: number } | null = null
    tries.forEach((b, i) => {
      const q = curveFor(l, b)
      if (!q) return
      const cost = curveCost(l, q) + i
      if (!best || cost < best.cost) best = { q, cost, bend: b }
    })
    if (!best) continue
    const chosen = best as { q: Curve; bend: number }
    bends.set(l.id, chosen.bend)
    curves.set(l.id, chosen.q)
    const smp = sampleCurve(chosen.q)
    curveSamples.set(l.id, smp)
    for (const p of smp) ptIdx.add(ptItem(p, l.id))
    for (let k = 0; k < smp.length - 1; k++) curveIdx.add(segItem({ a: smp[k], b: smp[k + 1], owner: l.id }))
    const q = chosen.q
    addBox({ x: q.b.x - 6, y: q.b.y - 6, w: 12, h: 12, owner: l.id, what: 'arrowhead' })
    const midq = quad(q, 0.5)
    if (l.delay) addBox({ x: midq.x - 9, y: midq.y - 9, w: 18, h: 18, owner: l.id, what: 'delay mark' })
    if (l.status === 'missing') addBox({ x: midq.x - 7, y: midq.y - 7, w: 14, h: 14, owner: l.id, what: 'cross' })
  }

  // placing text: choose the candidate that overlaps least
  const textCost = (r: Rect, allowed: Set<string>): number => {
    let cost = 0
    for (const b of boxIdx.near(r, 1)) if (!allowed.has(b.owner) && hit(r, b, 1)) cost += 60 + Math.min(r.w, b.w) * Math.min(r.h, b.h) * 0.05
    for (const s of segIdx.near(r, PIPE_PAD)) if (!allowed.has(s.owner) && segNearRect(s.a, s.b, r, PIPE_PAD)) cost += 50
    const crossed = new Set<string>()
    for (const c of curveIdx.near(r, 1)) if (!allowed.has(c.owner) && !crossed.has(c.owner) && segNearRect(c.a, c.b, r, 1)) { crossed.add(c.owner); cost += 25 }
    return cost
  }
  type Cand = { x: number; y: number; anchor: string; w: number; h: number }
  // (x, y) is the baseline of the first line; the box runs from 11px above it for h pixels
  const rectOf = (c: Cand): Rect => ({ x: c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - c.w : c.x - c.w / 2, y: c.y - 11, w: c.w, h: c.h })
  const pick = (cands: Cand[], allowed: Set<string>): Cand => {
    let best = cands[0]
    let bestCost = Infinity
    cands.forEach((c, i) => { const cost = textCost(rectOf(c), allowed) + i * 0.5; if (cost < bestCost) { bestCost = cost; best = c } })
    return best
  }

  const parts: string[] = []
  const linkParts: string[] = []
  const textParts: string[] = []
  const signParts: string[] = []
  const markParts: string[] = []
  const highlighted: string[] = []

  // flow labels are placed in id order, like the routes, so the file's order of flows never moves one
  const flowLabel = new Map<string, Cand>()
  for (const f of [...flows].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) {
    const v = valveAt.get(f.id)
    if (!v) continue
    const horizontal = Math.abs(v.dir.x) >= Math.abs(v.dir.y)
    const w = textW(f.label)
    const sides = f.label_at ? [f.label_at] : horizontal ? ['below', 'above'] : ['right', 'left']
    const cands: Cand[] = []
    for (const side of sides) for (const shift of [0, 24, -24, 48, -48]) {
      const base = add(v.c, mul(unit(v.dir), shift))
      if (side === 'below') cands.push({ x: base.x, y: base.y + 30, anchor: 'middle', w, h: 15 })
      if (side === 'above') cands.push({ x: base.x, y: base.y - 18, anchor: 'middle', w, h: 15 })
      if (side === 'right') cands.push({ x: base.x + 17, y: base.y + 5, anchor: 'start', w, h: 15 })
      if (side === 'left') cands.push({ x: base.x - 17, y: base.y + 5, anchor: 'end', w, h: 15 })
    }
    const c = pick(cands, new Set([f.id]))
    addBox({ ...rectOf(c), owner: f.id, what: 'flow label' })
    flowLabel.set(f.id, c)
  }
  for (const f of flows) {
    const pts = pipePts.get(f.id)
    const v = valveAt.get(f.id)
    const c = flowLabel.get(f.id)
    if (!pts || !v || !c) continue
    marks.add(markOf('flow', f.status, !!f.emphasis))
    if (f.emphasis) highlighted.push(`${f.label}: ${f.emphasis}`)
    parts.push(`<g ${attrs(ctx, f.id, 'flow', f.status, !!f.emphasis, `flow: ${f.label}`)}>${draw.pipe(pts, v, crossAt.get(f.id))}${textEl(c.x, c.y, f.label, 'lbl rate', c.anchor)}</g>`)
  }

  for (const n of nodes) {
    const c = grid(n.at[0], n.at[1])
    if (n.kind === 'cloud') {
      extras.add('cloud')
      parts.push(`<g class="el cloud" data-id="${esc(n.id)}" data-loops="" tabindex="0" role="button" aria-label="${esc(`cloud: ${n.why_outside ?? 'outside the model'}`)}">${draw.cloud(c)}</g>`)
      continue
    }
    if (n.kind === 'shadow') {
      const cp = copied(ctx, n)
      marks.add(shadowMark(cp.status, !!cp.emphasis))
      if (cp.emphasis) highlighted.push(`${labelOf(ctx, n.id)} (copy): ${cp.emphasis}`)
      const label = `<${labelOf(ctx, n.id)}>`
      parts.push(`<g ${attrs(ctx, n.id, 'shadow', cp.status, !!cp.emphasis, `copy of ${labelOf(ctx, n.id)}`)}>${draw.shadow(c, label, shadowW.get(n.id) ?? textW(label, 12), cp.status)}</g>`)
      continue
    }
    if (n.emphasis) highlighted.push(`${labelOf(ctx, n.id)}: ${n.emphasis}`)
    if (n.kind === 'stock') {
      marks.add(markOf('stock', n.status, !!n.emphasis))
      const w = stockW.get(n.id) ?? STOCK_W
      const lines = stockLines.get(n.id) ?? [n.label]
      const sub2 = n.units ? `(${n.units})` : undefined
      const y0 = c.y - (lines.length - 1) * 7 - (sub2 ? 6 : 0)
      const txt = lines.map((ln, i) => textEl(c.x, y0 + i * 14 + 4, ln, 'st-title')).join('') + (sub2 ? textEl(c.x, y0 + lines.length * 14 + 4, sub2, 'st-sub') : '')
      parts.push(`<g ${attrs(ctx, n.id, 'stock', n.status, !!n.emphasis, `stock: ${n.label}`)}>${draw.stock(c, w, STOCK_H)}${txt}</g>`)
      continue
    }
    marks.add(markOf(n.kind, n.status, !!n.emphasis))
    const lines = [...wrap(n.label, 150), ...(n.value ? [`= ${n.value}`] : [])]
    const w = Math.max(...lines.map(l => textW(l)))
    const h = lines.length * 14 + 2
    const sides = n.label_at ? [n.label_at] : ['below', 'above', 'right', 'left']
    const cands: Cand[] = sides.map(side => side === 'below' ? { x: c.x, y: c.y + 23, anchor: 'middle', w, h }
      : side === 'above' ? { x: c.x, y: c.y - 13 - (lines.length - 1) * 14, anchor: 'middle', w, h }
      : side === 'right' ? { x: c.x + 13, y: c.y + 5, anchor: 'start', w, h } : { x: c.x - 13, y: c.y + 5, anchor: 'end', w, h })
    const ch = pick(cands, new Set([n.id]))
    addBox({ ...rectOf(ch), owner: n.id, what: 'label' })
    const txt = lines.map((s, i) => textEl(ch.x, ch.y + i * 14, s, i < lines.length - (n.value ? 1 : 0) ? 'lbl aux-lbl' : 'lbl st-sub', ch.anchor)).join('')
    parts.push(`<g ${attrs(ctx, n.id, n.kind, n.status, !!n.emphasis, `${n.kind === 'aux' ? 'variable' : 'constant'}: ${n.label}`)}>${draw.dot(c, n.kind === 'constant', n.status)}${txt}</g>`)
  }

  for (const l of links) {
    const q = curves.get(l.id)
    if (!q) continue
    marks.add(markOf('link', l.status, !!l.emphasis))
    if (l.emphasis) highlighted.push(`${labelOf(ctx, l.id)}: ${l.emphasis}`)
    let body = draw.link(q, l.status === 'missing')
    if (l.delay) { body += draw.delay(q); extras.add('delay') }
    linkParts.push(`<g ${attrs(ctx, l.id, 'link', l.status, !!l.emphasis, `link ${l.polarity === '-' ? 'minus' : 'plus'}: ${labelOf(ctx, l.id)}${l.label ? ` (${l.label})` : ''}`)}>${body}</g>`)
    if (l.label) {
      const mid = add(q.a, mul(sub(q.b, q.a), 0.5))
      const w = textW(l.label, 11)
      const cands: Cand[] = []
      for (const t of [0.5, 0.38, 0.62]) for (const side of [1, -1]) {
        let n = perp(quadTan(q, t))
        if ((q.c.x - mid.x) * n.x + (q.c.y - mid.y) * n.y < 0) n = mul(n, -1)
        n = mul(n, side)
        const p = add(quad(q, t), mul(n, l.delay ? 20 : 13))
        const anchor = Math.abs(n.x) > 0.6 ? (n.x > 0 ? 'start' : 'end') : 'middle'
        cands.push({ x: p.x, y: p.y + 4, anchor, w, h: 14 })
      }
      const c = pick(cands, new Set([l.id]))
      addBox({ ...rectOf(c), owner: l.id, what: 'link label' })
      textParts.push(`<g class="lbl-g" data-loops="${esc((ctx.loopsOf.get(l.id) ?? []).join(' '))}">${textEl(c.x, c.y, l.label, `lbl link-lbl${l.emphasis ? ' emph-t' : ''}`, c.anchor)}</g>`)
    }
  }
  const nearestOther = (p: P, own: string, within: number): number => {
    let d = Infinity
    for (const o of ptIdx.near({ x: p.x, y: p.y, w: 0, h: 0 }, within)) if (o.owner !== own) d = Math.min(d, len(sub(p, o.p)))
    for (const s of segIdx.near({ x: p.x, y: p.y, w: 0, h: 0 }, within)) d = Math.min(d, distSeg(p, s.a, s.b) - 4)
    return d
  }
  for (const l of links) {
    const q = curves.get(l.id)
    const own = curveSamples.get(l.id)
    if (!q || !own) continue
    const mid = add(q.a, mul(sub(q.b, q.a), 0.5))
    const cands: Cand[] = []
    // a sign sits near its arrowhead (Sterman 2001): try points a fixed distance back along the curve
    const fine = Array.from({ length: 101 }, (_, k) => quad(q, k / 100))
    const back: number[] = []
    let run = 0
    for (let k = 100; k > 0 && back.length < 4; k--) {
      run += len(sub(fine[k], fine[k - 1]))
      if (run >= [26, 36, 48, 62][back.length]) back.push((k - 1) / 100)
    }
    const ts = [...new Set([...back, 0.84, 0.76, 0.68])].filter(t => t >= 0.5)
    for (const t of ts) for (const side of [1, -1]) for (const off of [11, 14, 18]) {
      let n = perp(quadTan(q, t))
      if ((q.c.x - mid.x) * n.x + (q.c.y - mid.y) * n.y < 0) n = mul(n, -1)
      const p = add(quad(q, t), mul(n, side * off))
      cands.push({ x: p.x, y: p.y + 6, anchor: 'middle', w: 11, h: 14 })
    }
    // a sign must sit nearer its own link than any other link or pipe
    const owned = cands.filter(c => {
      const p = { x: c.x, y: c.y - 6 }
      const mine = Math.min(...own.map(s => len(sub(p, s))))
      return nearestOther(p, l.id, mine + 3) >= mine + 3
    })
    const c = pick(owned.length ? owned : cands, new Set([l.id]))
    const p = { x: c.x, y: c.y - 6 }
    addBox({ ...rectOf(c), owner: l.id, what: 'sign' })
    signParts.push(`<g class="sign${l.emphasis ? ' emph' : ''}" data-of="${esc(l.id)}">${draw.sign(p, l.polarity)}</g>`)
    if (!owned.length) warn('G05', `link "${l.id}"`, 'its + or − sign sits as close to another link or pipe as to its own. Set its "bend", or move an end.')
  }

  // loop markers: inside the loop as drawn, as far from everything as possible; direction read at the marker
  const clearance = (p: P, poly: P[], reach = 40): number => {
    let d = reach
    const r = { x: p.x, y: p.y, w: 0, h: 0 }
    for (const b of boxIdx.near(r, reach)) d = Math.min(d, distRect(p, b))
    for (const s of segIdx.near(r, reach)) d = Math.min(d, distSeg(p, s.a, s.b) - 4)
    for (const o of ptIdx.near(r, reach)) d = Math.min(d, len(sub(p, o.p)) - 1)
    for (let k = 0; k < poly.length; k++) d = Math.min(d, distSeg(p, poly[k], poly[(k + 1) % poly.length]))
    return d
  }
  for (const lp of ctx.report.loops.filter(l => l.figure === figId)) {
    const poly = outline(ctx, lp, pipePts, valveAt, curves, shape)
    if (poly.length < 3) continue
    extras.add(lp.type)
    const radius = lp.minor ? 10 : 15
    const declared = m.loops.find(x => x.id === lp.id)
    let c: P | null = null
    if (declared?.marker_at) {
      const want = grid(declared.marker_at[0], declared.marker_at[1])
      if (winding(want, poly) !== 0) c = want
      else warn('G04', `loop "${lp.id}"`, `"marker_at" ${declared.marker_at.join(', ')} lies outside the loop as drawn; the marker was placed automatically instead.`)
    }
    if (!c) {
      const xs = poly.map(p => p.x)
      const ys = poly.map(p => p.y)
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
      let best: P | null = null
      let bestD = -Infinity
      for (let i = 1; i < 20; i++) for (let j = 1; j < 20; j++) {
        const p = { x: x0 + ((x1 - x0) * i) / 20, y: y0 + ((y1 - y0) * j) / 20 }
        if (winding(p, poly) === 0) continue
        const d = clearance(p, poly)
        if (d > bestD) { bestD = d; best = p }
      }
      c = best ?? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
    }
    if (clearance(c, poly) < radius + 3) { tight.push(lp.id ?? ''); warn('G06', `loop "${lp.id}"`, 'too little room inside the loop for its marker: give a link in it more "bend", or move an element outward.') }
    const cw = winding(c, poly) > 0
    addBox({ x: c.x - radius - 2, y: c.y - radius - 2, w: 2 * radius + 4, h: 2 * radius + 4, owner: lp.id ?? '', what: 'loop marker' })
    markParts.push(`<g class="loopmark ${lp.type}" data-loop="${esc(lp.id ?? '')}" data-loops="${esc(lp.id ?? '')}" tabindex="0" role="button" aria-label="${esc(`loop ${lp.id}: ${lp.name}, ${lp.type === 'R' ? 'reinforcing' : 'balancing'}, runs ${cw ? 'clockwise' : 'counter-clockwise'} here`)}">${draw.marker(c, lp.id ?? '', cw, radius)}</g>`)
  }

  // ---- layout lint on the final positions
  // a loop marker is a circle in its box: test it as the circle the placer cleared
  const markerC = (b: Box): P => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
  const pointIn = (p: P, b: Box, pad: number) => (b.what === 'loop marker' ? len(sub(p, markerC(b))) < b.w / 2 - 2 + pad : inRect(p, b, pad))
  const boxesMeet = (t: Box, b: Box) => (b.what === 'loop marker' ? distRect(markerC(b), t) < b.w / 2 - 3 : t.what === 'loop marker' ? distRect(markerC(t), b) < t.w / 2 - 3 : hit(t, b, -1))
  for (const t of boxes) {
    if (!/label|sign|shadow|loop marker/.test(t.what)) continue
    for (const b of boxIdx.near(t, 1)) {
      if (b === t || b.owner === t.owner) continue
      if (boxesMeet(t, b)) once([t.owner, t.what, b.owner, b.what].sort().join('|'), () => warn('G02', `${t.what} of "${t.owner}"`, `overlaps the ${b.what} of "${b.owner}". Move an element ("at"), or set "label_at", "valve", "bend" or "marker_at".`))
    }
    for (const s of segIdx.near(t, PIPE_PAD)) if (s.owner !== t.owner && segNearRect(s.a, s.b, t, PIPE_PAD - 2))
      once(`${t.owner}|${t.what}|pipe ${s.owner}`, () => warn('G03', `${t.what} of "${t.owner}"`, `sits on the pipe of "${s.owner}". Move an element, or set "label_at", "valve" or "bend".`))
    if (t.what !== 'loop marker') for (const o of curveIdx.near(t, 0)) if (o.owner !== t.owner && segNearRect(o.a, o.b, t, -1))
      once(`${t.owner}|${t.what}|link ${o.owner}`, () => warn('G03', `${t.what} of "${t.owner}"`, `is crossed by the link "${o.owner}". Set the link's "bend", or "label_at", or move an element.`))
  }
  for (const l of links) {
    const smp = curveSamples.get(l.id)
    if (!smp) continue
    for (const p of smp.slice(3, -3)) for (const b of boxIdx.near({ x: p.x, y: p.y, w: 0, h: 0 }, 1)) {
      if (b.owner === l.id || b.owner === l.from || b.owner === l.to) continue
      // arrowheads of links into the same target meet there by design
      if (b.what === 'arrowhead' && ctx.linkById.get(b.owner)?.to === l.to) continue
      if (pointIn(p, b, 1)) once(`${l.id}|${b.owner}|${b.what}`, () => warn('G03', `link "${l.id}"`, `runs through the ${b.what} of "${b.owner}". Set its "bend", or move an end.`))
    }
  }
  // a pipe through any other box; another pipe's marks are pipesClash's, above
  for (const f of flows) for (const s of segs.filter(x => x.owner === f.id)) for (const b of boxIdx.near(segItem(s), 2)) {
    if (b.owner === f.id || b.owner === f.from || b.owner === f.to || markBoxes.has(b)) continue
    // a link into this flow ends on its valve, on the pipe, by design
    if (b.what === 'arrowhead' && ctx.linkById.get(b.owner)?.to === f.id) continue
    if (runsThrough(s, b)) once(`${f.id}|${b.owner}|${b.what}`, () => warn('G03', `flow "${f.id}"`, `its pipe runs through the ${b.what} of "${b.owner}". Set its "route", or move an end.`))
  }
  // a valve on a node hides where its pipe meets it; a flow's own source and target are not exempt
  for (const f of flows) {
    const v = valveAt.get(f.id)
    if (v) for (const b of boxIdx.near(valveBox(v.c), VALVE_GAP)) if (NODE_BOX.has(b.what) && valveMeets(v.c, b))
      once(`${f.id}|valve|${b.owner}`, () => warn('G03', `flow "${f.id}"`, `its valve sits on the ${b.what} of "${b.owner}". Set its "valve" or "route", or move an end.`))
  }
  const dense = nodes.filter(n => n.kind !== 'cloud').length + flows.length
  if (dense > 16) warn('G07', `figure "${figId}"`, `${dense} stocks, variables and flows in one figure are hard to read. Consider splitting it by sub-question (Sterman 2001).`)

  // ---- the SVG, in paint order: pipes and nodes, links, labels, signs, markers
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const grow = (p: P) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y) }
  for (const b of boxes) { grow(b); grow({ x: b.x + b.w, y: b.y + b.h }) }
  for (const smp of curveSamples.values()) smp.forEach(grow)
  for (const pts of pipePts.values()) pts.forEach(grow)
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 200; maxY = 100 }
  const pad = 26
  const vx = Math.floor(minX - pad)
  const vy = Math.floor(minY - pad)
  const vw = Math.ceil(maxX - minX + 2 * pad)
  const vh = Math.ceil(maxY - minY + 2 * pad)
  const fig = m.figures.find(f => f.id === figId)!
  // drawn at about its natural size: never smaller (the frame scrolls instead) and at most 15% larger
  const svg = lines(`<svg class="sd" viewBox="${r1(vx)} ${r1(vy)} ${r1(vw)} ${r1(vh)}" style="min-width:${r1(Math.round(vw))}px;max-width:${r1(Math.round(vw * 1.15))}px" role="group" aria-label="${esc(`Figure: ${fig.title}`)}">${parts.join('')}${linkParts.join('')}<g class="labels">${textParts.join('')}</g><g class="signs">${signParts.join('')}</g><g class="marks">${markParts.join('')}</g></svg>`)
  // a figure with a coordinate that is not a number would draw as an empty frame: refuse it, never ship it
  if (nonFinite > 0) layout.push({ code: 'G00', level: 'error', where: `figure "${figId}"`, message: 'the figure could not be drawn (a position came out as no number). Move the elements involved, or drop a "route" or "bend".' })
  return { svg, layout, marks, extras, highlighted, bends, tight }
}

/** How bad a drawn figure is: overlaps and crossings count most, cramped loop markers less. */
function badness(d: Drawn): number {
  return d.layout.reduce((s, i) => s + (i.code === 'G06' ? 3 : i.code === 'G04' || i.code === 'G07' ? 0 : 10), 0)
}

/** Draw a figure; where a loop lacks room for its marker, try more curvature on its links, keeping whichever drawing is best. */
function layoutFigure(ctx: Ctx, figId: string): Drawn {
  const override = new Map<string, number>()
  let best = drawFigure(ctx, figId, override)
  let current = best
  for (let round = 0; round < 3 && current.tight.length; round++) {
    let changed = false
    for (const id of current.tight) {
      const lp = ctx.report.loops.find(l => l.id === id)
      for (const via of lp?.via ?? []) {
        const link = ctx.linkById.get(via)
        if (!link || link.bend !== undefined) continue
        const b = Math.abs(current.bends.get(via) ?? 0.5)
        const next = Math.min(0.95, Math.round((b + 0.15) * 100) / 100)
        if (next > b) { override.set(via, next); changed = true }
      }
    }
    if (!changed) break
    current = drawFigure(ctx, figId, override)
    if (badness(current) < badness(best)) best = current
  }
  return best
}

/** The loop as drawn: each link's curve and each pipe run, in loop order. */
function outline(ctx: Ctx, lp: LoopReport, pipes: Map<string, P[]>, valves: Map<string, { c: P; dir: P }>, curves: Map<string, Curve>, shape: Map<string, Shape>): P[] {
  const out: P[] = []
  lp.via.forEach((via, i) => {
    const q = curves.get(via)
    if (q) { for (let k = 0; k <= 14; k++) out.push(quad(q, k / 14)); return }
    const f = ctx.flowById.get(via)
    const pts = pipes.get(via)
    const v = valves.get(via)
    if (!f || !pts || !v) { const s = shape.get(lp.path[i]); if (s) out.push(s.c); return }
    const target = lp.path[(i + 1) % lp.path.length]
    let seg = 0
    for (let k = 0; k < pts.length - 1; k++) if (distSeg(v.c, pts[k], pts[k + 1]) < 0.5) seg = k
    out.push(...(target === f.to ? [v.c, ...pts.slice(seg + 1)] : [v.c, ...pts.slice(0, seg + 1).reverse()]))
  })
  return out
}

// ----------------------------------------------------------------------------------------- page

const CSS = `
:root{--bg:#fbfaf7;--surface:#ffffff;--fg:#1c1b19;--muted:#66635d;--rule:#dedbd4;--accent:#2457a6;--alert:#b23a1f;--hyp:#8a8780;--r:#9a3b8f;--b:#1f7a5a;--on-tag:#ffffff;--halo:#ffffff}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#151514;--surface:#1d1d1b;--fg:#ecebe7;--muted:#a5a29b;--rule:#3a3936;--accent:#7aa7f0;--alert:#f08466;--hyp:#96938c;--r:#d58ccb;--b:#6cc7a3;--on-tag:#151514;--halo:#1d1d1b}}
:root[data-theme="dark"]{--bg:#151514;--surface:#1d1d1b;--fg:#ecebe7;--muted:#a5a29b;--rule:#3a3936;--accent:#7aa7f0;--alert:#f08466;--hyp:#96938c;--r:#d58ccb;--b:#6cc7a3;--on-tag:#151514;--halo:#1d1d1b}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg)}
body{font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.wrap{max-width:1400px;margin:0 auto;padding:28px 24px 64px;overflow-wrap:anywhere}
@media (max-width:560px){.wrap{padding:20px 16px 48px}}
h1{font-size:28px;line-height:1.2;margin:4px 0 10px}h2{font-size:20px;margin:36px 0 6px}h3{font-size:16px;margin:16px 0 6px}
.eyebrow{color:var(--muted);font-size:13px}.prose{max-width:72ch}.lead{font-size:18px;margin:6px 0}.muted{color:var(--muted)}
.answer{max-width:72ch;margin:14px 0;padding:12px 16px;border-left:3px solid var(--accent);background:var(--surface)}
.answer h2{font-size:15px;margin:0 0 4px}.answer p{margin:0}.answer-lines{margin:0;padding-left:20px}.answer-lines li{margin:2px 0}
code{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.legend{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px 22px;margin:10px 0 0;padding:14px;border:1px solid var(--rule);border-radius:8px;background:var(--surface)}
.key{display:flex;gap:10px;align-items:flex-start;font-size:13.5px}.key .sw{flex:0 0 64px;width:64px;height:36px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.chip{font:inherit;font-size:13px;border:1px solid var(--rule);background:var(--surface);color:var(--fg);border-radius:999px;padding:3px 10px;cursor:pointer}
.chip[aria-pressed="true"]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
.pill{display:inline-block;font-size:11px;font-weight:700;border-radius:4px;padding:0 5px;margin-right:5px;color:var(--on-tag);vertical-align:1px}
.pill.R{background:var(--r)}.pill.B{background:var(--b)}
figure{margin:0}.frame{overflow-x:auto;border:1px solid var(--rule);border-radius:8px;background:var(--surface)}
svg.sd{display:block;width:100%;height:auto}
figcaption{font-size:13.5px;color:var(--muted);margin:8px 2px 0;max-width:80ch}
.narrow{display:none}figure.scrolls .narrow{display:inline}
.hl{font-size:14px;margin:8px 0}.hl li{margin:2px 0}
.detail{margin:12px 0;padding:12px 14px;border-left:3px solid var(--accent);background:var(--surface);font-size:14px;min-height:46px}
.detail h3{margin:0 0 4px}.detail .meta{color:var(--muted);font-size:12.5px}.detail ul{margin:6px 0 0;padding-left:18px}
ol.loops{padding-left:0;list-style:none}ol.loops li{margin:10px 0;padding:10px 12px;border:1px solid var(--rule);border-radius:8px;background:var(--surface)}
.trace,.hedge{color:var(--muted);font-size:13.5px;margin-top:3px}
table{border-collapse:collapse;font-size:14px;width:100%}th,td{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid var(--rule);overflow-wrap:anywhere}
details{margin:10px 0;border:1px solid var(--rule);border-radius:8px;background:var(--surface);padding:6px 12px}
summary{cursor:pointer;font-weight:600;padding:4px 0}
footer{margin-top:40px;color:var(--muted);font-size:13px}
.unchecked{color:var(--alert);font-size:12.5px}
svg .stock-box{fill:var(--surface);stroke:var(--fg);stroke-width:1.6}
svg .st-title{font-size:12.5px;font-weight:600;fill:var(--fg)}svg .st-sub{font-size:11px;fill:var(--muted)}
svg .cloud-shape{fill:var(--surface);stroke:var(--muted);stroke-width:1.3}
svg .aux-dot{fill:var(--fg)}svg .const-dot{fill:var(--surface);stroke:var(--fg);stroke-width:1.8}
svg .halo{fill:none;stroke:var(--hyp);stroke-width:1.4}svg .hyp .halo{stroke-dasharray:3 2.5}svg .int .halo{stroke-dasharray:1 2.6;stroke-linecap:round}
svg .lbl{font-size:12px;fill:var(--fg)}svg .link-lbl{font-size:11px;fill:var(--muted);font-style:italic}
svg .shadow-lbl{font-size:12px;fill:var(--muted);font-style:italic}
svg .shadow-ul{stroke:var(--hyp);stroke-width:1.4}svg .shadow.hyp .shadow-ul,svg .shadow.miss .shadow-ul{stroke-dasharray:4 3}svg .shadow.int .shadow-ul{stroke-dasharray:1 3;stroke-linecap:round}
svg text{paint-order:stroke;stroke:var(--halo);stroke-width:4px;stroke-linejoin:round}
svg .pill-sw text{stroke:none;fill:var(--on-tag);font-size:11px;font-weight:700}svg .pill-sw .R{fill:var(--r)}svg .pill-sw .B{fill:var(--b)}
svg .pipe-outer{fill:none;stroke:var(--fg);stroke-width:8}svg .pipe-inner{fill:none;stroke:var(--surface);stroke-width:4}
svg .pipe-head{fill:var(--fg)}svg .valve-shape{fill:var(--surface);stroke:var(--fg);stroke-width:1.5;stroke-linejoin:round}
svg .link-path{fill:none;stroke:var(--fg);stroke-width:1.4}svg .link-head{fill:var(--fg)}
svg .link-hit{fill:none;stroke:transparent;stroke-width:12;pointer-events:stroke}
svg .delay-mark{stroke:var(--fg);stroke-width:1.6}svg .pol{font-size:16px;font-weight:700;fill:var(--fg)}
svg .miss-x{stroke:var(--fg);stroke-width:2}svg .miss-x.sm{stroke-width:1.5}
svg .hyp .link-path,svg .hyp .stock-box{stroke:var(--hyp);stroke-dasharray:5 4}
svg .int .link-path,svg .int .stock-box{stroke:var(--hyp);stroke-dasharray:1.5 3.5;stroke-linecap:round}
svg .miss .link-path{stroke:var(--hyp);stroke-dasharray:5 4}
svg .hyp .pipe-outer,svg .miss .pipe-outer{stroke:var(--hyp);stroke-dasharray:9 5}svg .int .pipe-outer{stroke:var(--hyp);stroke-dasharray:2 5}
svg :is(.hyp,.int,.miss) :is(.link-head,.pipe-head,.aux-dot){fill:var(--hyp)}
svg :is(.hyp,.int,.miss) :is(.valve-shape,.const-dot){stroke:var(--hyp)}
svg .emph :is(.link-path,.stock-box,.pipe-outer,.valve-shape,.const-dot,.miss-x,.delay-mark,.halo,.shadow-ul){stroke:var(--alert)}
svg .emph :is(.link-head,.pipe-head,.aux-dot,.lbl,.st-title,.shadow-lbl),svg .sign.emph .pol,svg .emph-t{fill:var(--alert)}
svg .mark-arc{fill:none;stroke-width:1.8}svg .mark-id{font-size:11px;font-weight:700}svg .mark-id.small{font-size:9px}
svg .loopmark.R .mark-arc{stroke:var(--r)}svg .loopmark.R :is(.mark-head,.mark-id){fill:var(--r)}
svg .loopmark.B .mark-arc{stroke:var(--b)}svg .loopmark.B :is(.mark-head,.mark-id){fill:var(--b)}
svg.sd .el,svg.sd .loopmark{cursor:pointer;transition:opacity .15s}
svg.sd .el:focus-visible,svg.sd .loopmark:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
svg.sd.tracing :is(.el,.sign,.loopmark,.lbl-g):not(.on){opacity:.15}
svg.sd .sel :is(.stock-box,.aux-dot,.valve-shape,.const-dot){stroke:var(--accent);stroke-width:2.6}
@media (prefers-reduced-motion:reduce){svg.sd .el{transition:none}}
@media print{details{border:0}details>*{display:block}.chips{display:none}}
`

const SCRIPT = `
(function(){
var INFO=JSON.parse(document.getElementById('sf-info').textContent);
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function show(fig,id){var i=INFO[id];var p=document.getElementById('detail-'+fig);if(!i||!p)return;
var h='<h3>'+esc(i.t)+'</h3><div class="meta">'+esc(i.k)+(i.s?' · '+esc(i.s):'')+(i.u?' · '+esc(i.u):'')+(i.v?' · value '+esc(i.v):'')+(i.m?' · in '+esc(i.m):'')+(i.l&&i.l.length?' · loops '+esc(i.l.join(', ')):'')+'</div>';
if(i.o)h+='<p>'+esc(i.o)+'</p>';if(i.n)h+='<p><i>'+esc(i.n)+'</i></p>';if(i.h)h+='<p>'+esc(i.h)+'</p>';if(i.d)h+='<p>'+esc(i.d)+'</p>';if(i.c)h+='<p><b>Claim:</b> '+esc(i.c)+'</p>';if(i.w)h+='<p><b>Outside the model:</b> '+esc(i.w)+'</p>';if(i.x)h+='<p><b>Highlighted:</b> '+esc(i.x)+'</p>';
if(i.e&&i.e.length){h+='<ul>'+i.e.map(function(e){return '<li><code>'+esc(e.r)+'</code> “'+esc(e.q)+'”'+(e.u?' <span class="unchecked">(web source, not checked)</span>':'')+(e.f?' <span class="meta">(extract of '+esc(e.f)+')</span>':'')+'</li>'}).join('')+'</ul>'}
p.innerHTML=h;}
document.querySelectorAll('svg.sd').forEach(function(svg){var fig=svg.closest('section').getAttribute('data-fig');
svg.querySelectorAll('.el[data-id]').forEach(function(el){function go(){svg.querySelectorAll('.sel').forEach(function(x){x.classList.remove('sel')});el.classList.add('sel');show(fig,el.getAttribute('data-id'))}
el.addEventListener('click',go);el.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go()}})})});
function trace(fig,id){var sec=document.querySelector('section[data-fig="'+fig+'"]');if(!sec)return;var svg=sec.querySelector('svg.sd');var on=svg.getAttribute('data-trace')!==id;
sec.querySelectorAll('.chip[data-loop]').forEach(function(c){c.setAttribute('aria-pressed',on&&c.getAttribute('data-loop')===id?'true':'false')});
svg.querySelectorAll('.on').forEach(function(x){x.classList.remove('on')});
if(!on){svg.classList.remove('tracing');svg.removeAttribute('data-trace');return}
svg.setAttribute('data-trace',id);svg.classList.add('tracing');
svg.querySelectorAll('[data-loops]').forEach(function(x){if((' '+x.getAttribute('data-loops')+' ').indexOf(' '+id+' ')>=0)x.classList.add('on')});
svg.querySelectorAll('.sign[data-of]').forEach(function(s){var l=svg.querySelector('.el[data-id="'+s.getAttribute('data-of')+'"]');if(l&&l.classList.contains('on'))s.classList.add('on')});}
document.querySelectorAll('.chip[data-loop]').forEach(function(c){c.addEventListener('click',function(){trace(c.getAttribute('data-fig'),c.getAttribute('data-loop'))})});
document.querySelectorAll('.loopmark').forEach(function(m){var fig=m.closest('section').getAttribute('data-fig');function go(){trace(fig,m.getAttribute('data-loop'))}
m.addEventListener('click',go);m.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go()}})});
function hint(){document.querySelectorAll('figure').forEach(function(f){var fr=f.querySelector('.frame');if(fr)f.classList.toggle('scrolls',fr.scrollWidth>fr.clientWidth+2)})}
hint();window.addEventListener('resize',hint);
})();
`

const SOURCES: Rich[] = [
  { html: 'Notation and definitions: J. D. Sterman, <i>Business Dynamics</i> (2000), Table 5-1; D. N. Ford, “A system dynamics glossary”, <i>System Dynamics Review</i> 35(4), 2019, <a href="https://doi.org/10.1002/sdr.1641">doi:10.1002/sdr.1641</a>.', text: 'Notation and definitions: J. D. Sterman, Business Dynamics (2000), Table 5-1; D. N. Ford, "A system dynamics glossary", System Dynamics Review 35(4), 2019, doi:10.1002/sdr.1641.' },
  { html: 'Every feedback loop contains a stock: A. Naugle, S. Langarudi and T. Clancy, “What is (quantitative) system dynamics modeling?”, <i>System Dynamics Review</i> 40(2), 2024, <a href="https://doi.org/10.1002/sdr.1762">doi:10.1002/sdr.1762</a>.', text: 'Every feedback loop contains a stock: A. Naugle, S. Langarudi and T. Clancy, "What is (quantitative) system dynamics modeling?", System Dynamics Review 40(2), 2024, doi:10.1002/sdr.1762.' },
  { html: 'Link and loop polarity, goals and delays: J. D. Sterman, “Fine-Tuning Your Causal Loop Diagrams”, <i>The Systems Thinker</i> 12(5–6), 2001; G. P. Richardson, “Problems in causal loop diagrams revisited”, <i>System Dynamics Review</i> 13(3), 1997.', text: 'Link and loop polarity, goals and delays: J. D. Sterman, "Fine-Tuning Your Causal Loop Diagrams", The Systems Thinker 12(5-6), 2001; G. P. Richardson, "Problems in causal loop diagrams revisited", System Dynamics Review 13(3), 1997.' },
  { html: 'Model boundary: J. Trimble, “Boundary Concepts in System Dynamics”, International System Dynamics Conference, 2014.', text: 'Model boundary: J. Trimble, "Boundary Concepts in System Dynamics", International System Dynamics Conference, 2014.' },
  { html: 'Tests without simulation, and what they cannot show: M. Schwaninger and S. Groesser, “System Dynamics Modeling: Validation for Quality Assurance”, 2009, <a href="https://doi.org/10.1007/978-0-387-30440-3_540">doi:10.1007/978-0-387-30440-3_540</a>; J. W. Forrester and P. M. Senge, “Tests for building confidence in system dynamics models”, 1980.', text: 'Tests without simulation, and what they cannot show: M. Schwaninger and S. Groesser, "System Dynamics Modeling: Validation for Quality Assurance", 2009, doi:10.1007/978-0-387-30440-3_540; J. W. Forrester and P. M. Senge, "Tests for building confidence in system dynamics models", 1980.' },
]

const safeJson = (v: unknown): string => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

export type Rendered = { html: string; readerView: string; layout: Issue[]; legend: string[] }

const GENERATOR_META = '<meta name="generator" content="dynamics">'
/** The start of every page this renderer writes. */
const PAGE_PREFIX = ['<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">', GENERATOR_META].join('\n')
/**
 * Block elements go on lines of their own, so no line of the page grows with the model and the Read tool
 * can read the page back in pages. Whitespace between blocks draws nothing, and the seal ignores it.
 */
const nl = (...parts: string[]): string => parts.filter(Boolean).join('\n')
/**
 * A loop's trace and hedge name every element of the loop, so on the page they put one step, or one
 * clause, per line. The line break stands where a space stood, and reads as one: the text shown is the same.
 */
const stepLines = (s: string): string => esc(s).replace(/ → /g, ' →\n')
const clauseLines = (s: string): string => esc(s).replace(/; /g, ';\n')

/** A web source: cited by address only, so it cannot be checked. */
const isWeb = (e: Evidence): boolean => !!(e.url && !e.path)
/**
 * Where a quote comes from. Root and path are printed exactly as written, since two spaces name another
 * file; the checker refuses a line break in either (E05). The lines are printed as the checker read them.
 */
function evRef(e: Evidence): string {
  if (isWeb(e)) return e.url ?? ''
  const range = e.lines === undefined ? null : parseLines(e.lines)
  const at = range ? `:${range[0] === range[1] ? range[0] : `${range[0]}-${range[1]}`}` : ''
  return `${e.root ? `${e.root}:` : ''}${e.path ?? ''}${at}`
}

// ---- the seal: a page carries the fingerprint of its own content, so whether dynamics wrote it, and
// whether anyone changed it since, is read from the file itself (it travels with git, copies and other
// machines). Whitespace is left out of the fingerprint, so a formatter that only re-indents keeps it.

const SEAL = /<!-- (?:dynamics|stockflow):fp=([0-9a-f]+) -->/g // stockflow was this plugin's name until 2026-10-30
/** Lone surrogate halves become U+FFFD, as a file write stores them, so the seal matches what lands. */
const wellFormed = (s: string): string => s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
const sealOf = (body: string): string => fingerprint(body.replace(/\s+/g, ''))

/** The page with its seal appended. */
export function seal(html: string): string {
  const body = wellFormed(html)
  return `${body}<!-- dynamics:fp=${sealOf(body)} -->\n`
}

/**
 * intact: dynamics wrote it and nothing but whitespace changed since; changed: sealed, then edited (text
 * added after the seal counts); none: no seal anywhere. The last seal is the one dynamics wrote last.
 */
export function sealState(text: string): 'intact' | 'changed' | 'none' {
  let m: RegExpMatchArray | undefined
  for (const x of text.matchAll(SEAL)) m = x
  if (!m || m.index === undefined) return 'none'
  if (/\S/.test(text.slice(m.index + m[0].length))) return 'changed'
  return sealOf(text.slice(0, m.index)) === m[1] ? 'intact' : 'changed'
}

export function render(a: Analysis): Rendered {
  const model = a.model
  if (!model) throw new Error('render needs a parsed model')
  const report = a.report
  const nodeById = new Map(model.nodes.map(n => [n.id, n]))
  const flowById = new Map(model.flows.map(f => [f.id, f]))
  const linkById = new Map(model.links.map(l => [l.id, l]))
  const loopsOf = new Map<string, string[]>()
  for (const lp of report.loops) if (lp.id) for (const mem of lp.members) loopsOf.set(mem, [...(loopsOf.get(mem) ?? []), lp.id])
  for (const n of model.nodes) if (n.kind === 'shadow') {
    const ids = new Set<string>()
    for (const l of model.links) if (l.from === n.id) for (const id of loopsOf.get(l.id) ?? []) ids.add(id)
    loopsOf.set(n.id, [...ids])
  }
  const ctx: Ctx = { name: namer(model), model, report, nodeById, flowById, linkById, loopsOf }
  const L = (id: string) => labelOf(ctx, id)
  const subj = model.subject
  const c = report.counts

  // the page is a list of sections, each in two forms: HTML for the page, plain text for the reader view
  const html: string[] = []
  const text: string[] = []
  const both = (h: string, t: string) => { html.push(h); text.push(t) }
  const details = (title: string, h: string, t: string) => both(nl(`<details><summary>${esc(title)}</summary>`, h, '</details>'), `\n## ${title}\n${t}`)

  const marks = new Set<Mark>()
  const extras = new Set<string>()
  const layout: Issue[] = []
  const observedMeans = subj.kind === 'codebase' || subj.kind === 'mixed'
    ? `Solid marks are what the code${subj.ref ? ` at ${subj.ref}` : ''} does, each with its source.`
    : 'Solid marks are what the cited documents state; they were not checked against the running product.'

  // the short answer: each line the author wrote is its own line on the page and in the reader view
  const answerLines = model.answer.text.split('\n').filter(s => s.trim())
  const answerHtml = (): string => answerLines.length > 1 ? `<ul class="answer-lines">${answerLines.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : `<p>${esc(model.answer.text)}</p>`
  // header
  const eyebrow = `${subj.name} · ${subj.kind}${subj.ref ? ` · ${subj.ref}${subj.dirty ? ' (uncommitted changes)' : ''}` : ''} · sources read ${subj.date}`
  const disclaimer = `A hypothesis read from the structure below, not the result of a simulation.${model.horizon ? ` Time horizon: ${model.horizon}.` : ''}`
  both(
    nl('<header>', `<div class="eyebrow">${esc(eyebrow)}</div>`, `<h1>${esc(model.title)}</h1>`, `<p class="lead prose">${esc(model.question)}</p>`,
      '<div class="answer">', '<h2>Short answer</h2>', answerHtml(), `<p class="muted" style="margin-top:6px">${esc(disclaimer)}</p>`, '</div>',
      model.emphasis ? `<p class="prose"><b>${esc(model.emphasis.name)}</b> marks, in the alert colour: ${esc(model.emphasis.rule)}</p>` : '', '</header>'),
    [`# ${model.title}`, eyebrow, '', `Question: ${model.question}`, (answerLines.length > 1 ? `Short answer:\n${answerLines.map(s => `- ${s}`).join('\n')}` : `Short answer: ${model.answer.text}`), disclaimer, ...(model.emphasis ? [`${model.emphasis.name} marks, in the alert colour: ${model.emphasis.rule}`] : [])].join('\n'),
  )

  // figures are drawn first so the legend knows which marks they use; the legend is placed before them
  const figHtml: string[] = []
  const figText: string[] = []
  for (const fig of model.figures) {
    const d = layoutFigure(ctx, fig.id)
    d.marks.forEach(x => marks.add(x))
    d.extras.forEach(x => extras.add(x))
    layout.push(...d.layout)
    const loops = report.loops.filter(l => l.figure === fig.id)
    const major = loops.filter(l => !l.minor)
    const minor = loops.filter(l => l.minor)
    const chips = loops.length ? nl('<div class="chips" role="group" aria-label="Trace a loop">', ...loops.map(l => `<button class="chip" type="button" data-fig="${esc(fig.id)}" data-loop="${esc(l.id ?? '')}" aria-pressed="false"><span class="pill ${l.type}">${l.type}</span>${esc(l.id ?? '')} ${esc(l.name ?? '')}</button>`), '</div>') : ''
    const modelledN = loops.filter(l => l.modelled).length
    const caption = [fig.caption ?? '', loops.length ? `${loops.length} feedback loop${loops.length > 1 ? 's' : ''}${modelledN ? `, ${modelledN} of them through a modelled part` : ''}. Select a loop to trace it, or any element to see its source.` : 'No feedback loop lies in this figure. Select any element to see its source.'].filter(Boolean).join(' ')
    const goalOf = (l: LoopReport) => {
      if (l.type !== 'B' || l.minor) return ''
      const g = model.loops.find(x => x.id === l.id)?.goal
      return g ? ` Goal: ${nodeById.has(g) ? L(g) : g}.` : ' No explicit goal is named in the sources.'
    }
    const storyOf = (l: LoopReport) => model.loops.find(x => x.id === l.id)?.story ?? ''
    const card = (l: LoopReport) => `<li id="loop-${esc(l.id ?? '')}"><span class="pill ${l.type}">${l.type}</span><b>${esc(l.id ?? '')} ${esc(l.name ?? '')}</b>${l.modelled ? ' <span class="muted">(modelled)</span>' : ''} — ${l.type === 'R' ? 'reinforcing' : 'balancing'}.${esc(goalOf(l))}${storyOf(l) ? `<br>${esc(storyOf(l))}` : ''}\n<div class="trace">Trace: ${stepLines(l.trace)}.</div>${l.hedge ? `\n<div class="hedge">${clauseLines(l.hedge)}</div>` : ''}</li>`
    const minorHtml = minor.length ? `<p class="muted">Routine loops (a stock draining through its own outflow): ${minor.map(l => `<span class="pill ${l.type}">${l.type}</span>${esc(l.id ?? '')} ${esc(l.name ?? '')}${l.modelled ? ' (modelled)' : ''}`).join(';\n')}.</p>` : ''
    const hl = d.highlighted.length ? nl(`<div class="hl"><b>Highlighted in this figure</b>${model.emphasis ? ` (${esc(model.emphasis.name)})` : ''}:`, '<ul>', ...d.highlighted.map(h => `<li>${esc(h)}</li>`), '</ul>', '</div>') : ''
    figHtml.push(nl(`<section data-fig="${esc(fig.id)}" id="fig-${esc(fig.id)}">`, `<h2>${esc(fig.title)}</h2>`, `<p class="prose muted">${esc(fig.question)}</p>`, chips,
      '<figure><div class="frame">', d.svg, '</div>', `<figcaption><span class="narrow">Scroll the figure sideways to see all of it. </span>${esc(caption)}</figcaption></figure>`, hl,
      `<div class="detail" id="detail-${esc(fig.id)}" aria-live="polite"><span class="muted">Select an element to see what it is and the source it rests on.</span></div>`,
      major.length ? nl('<ol class="loops">', ...major.map(card), '</ol>') : '', minorHtml, '</section>'))
    const st = (s: Status) => (s === 'observed' ? '' : `, ${s}`)
    figText.push([
      `\n## Figure: ${fig.title}`, fig.question, caption,
      `Stocks: ${model.nodes.filter(n => n.figure === fig.id && n.kind === 'stock').map(n => `${n.label}${n.units ? ` (${n.units})` : ''}${st(n.status)}${n.emphasis ? ', highlighted' : ''}`).join('; ') || 'none'}`,
      `Flows: ${model.flows.filter(f => f.figure === fig.id).map(f => `${f.label} (${L(f.from)} → ${L(f.to)}${f.units ? `, ${f.units}` : ''}${st(f.status)}${f.emphasis ? ', highlighted' : ''})`).join('; ') || 'none'}`,
      `Variables and constants: ${model.nodes.filter(n => n.figure === fig.id && (n.kind === 'aux' || n.kind === 'constant')).map(n => `${n.label}${n.value ? ` = ${n.value}` : ''} (${n.kind === 'aux' ? 'variable' : 'constant'}${st(n.status)}${n.emphasis ? ', highlighted' : ''})`).join('; ') || 'none'}`,
      `Copies of elements drawn elsewhere: ${model.nodes.filter(n => n.figure === fig.id && n.kind === 'shadow').map(n => {
        const cp = copied(ctx, n)
        const tags = [cp.status === 'observed' ? '' : cp.status, cp.emphasis ? 'highlighted' : ''].filter(Boolean)
        return `<${L(n.id)}>${tags.length ? ` (${tags.join(', ')})` : ''}`
      }).join('; ') || 'none'}`,
      `Links: ${model.links.filter(l => l.figure === fig.id).map(l => `${L(l.id)} (${l.polarity === '-' ? '−' : '+'}${l.delay ? ', read late' : ''}${st(l.status)}${l.label ? `, labelled "${l.label}"` : ''}${l.emphasis ? ', highlighted' : ''})`).join('; ') || 'none'}`,
      ...loops.map(l => [`Loop ${l.id} ${l.name} (${l.type === 'R' ? 'reinforcing' : 'balancing'}${l.minor ? ', routine' : ''}${l.modelled ? ', modelled' : ''}).${goalOf(l)}`, storyOf(l), `Trace: ${l.trace}.`, l.hedge ?? ''].filter(Boolean).join(' ')),
      ...(d.highlighted.length ? [`Highlighted: ${d.highlighted.join('; ')}`] : []),
    ].join('\n'))
  }

  // legend
  if (report.designed.length) extras.add('pill')
  const entries = legend(model, marks, extras)
  both(
    nl('<section>', '<h2>How to read the figures</h2>', `<p class="prose muted">${esc(observedMeans)} Every mark used on this page is explained here.</p>`,
      '<div class="legend">', ...entries.map(e => `<div class="key">${e.swatch}<div>${e.rich.html}</div></div>`), '</div>', '</section>'),
    ['\n## How to read the figures', `${observedMeans} Every mark used on this page is explained here.`, ...entries.map(e => `- ${e.rich.text}`)].join('\n'),
  )
  html.push(...figHtml)
  text.push(...figText)

  // loops that need a part not built
  if (report.designed.length) {
    const more = (c.designed_loops ?? report.designed.length) - report.designed.length
    both(
      nl('<section>', '<h2>Loops that would exist if built</h2>', '<p class="prose muted">Each needs at least one part that is specified but not built, or missing. They are not part of the system as it runs.</p>',
        '<ul>', ...report.designed.map(l => `<li><span class="pill ${l.type}">${l.type}</span>${stepLines(l.trace)}. <span class="muted">${clauseLines(l.hedge ?? '')}</span></li>`), '</ul>', more > 0 ? `<p class="muted">And ${more} more.</p>` : '', '</section>'),
      ['\n## Loops that would exist if built', 'Each needs at least one part that is specified but not built, or missing.', ...report.designed.map(l => `- ${l.type}: ${l.trace}. ${l.hedge ?? ''}`), ...(more > 0 ? [`And ${more} more.`] : [])].join('\n'),
    )
  }

  if (model.reference_modes.length) {
    // a cited path sits in <code>, as in the evidence table, so its spaces show as written
    const rows = model.reference_modes.map(r => {
      const refs = r.evidence.map(e => ({ ref: evRef(e), web: isWeb(e) }))
      const said = r.why ? `: ${r.why}` : ''
      return {
        who: L(r.variable), what: r.pattern,
        html: r.basis === 'data' ? `observed in ${refs.map(x => `<code>${esc(x.ref)}</code>${x.web ? ' (web source, not checked)' : ''}`).join(',\n')}` : esc(`suspected, not observed${said}`),
        text: r.basis === 'data' ? `observed in ${refs.map(x => `${x.ref}${x.web ? ' (web source, not checked)' : ''}`).join(', ')}` : `suspected, not observed${said}`,
      }
    })
    details('Behaviour in question',
      nl('<ul>', ...rows.map(r => `<li><b>${esc(r.who)}</b>: ${esc(r.what)} <span class="muted">(${r.html})</span></li>`), '</ul>', '<p class="muted">The figures show structure that could produce this behaviour; nothing here simulates it.</p>'),
      [...rows.map(r => `- ${r.who}: ${r.what} (${r.text})`), 'The figures show structure that could produce this behaviour; nothing here simulates it.'].join('\n'))
  }

  // a row that lists the whole model puts one item per line, so no line grows with the model; a line
  // break between items reads as the space after the separator
  const listHtml = (items: string[], sep: string): string => items.map(esc).join(`${sep}\n`) || '—'
  const listText = (items: string[], sep: string): string => items.join(`${sep} `) || '—'
  const b = report.boundary
  const bRows: [string, string[], string][] = [
    ['Inside the feedback (driven by the stocks)', b.endogenous.map(x => `${L(x.id)}${x.loops.length ? ` (${x.loops.join(', ')})` : ' (open loop)'}`), ','],
    ['Inputs from outside', b.exogenous.map(L), ','],
    ['Sources and sinks', b.sources_and_sinks.map(x => nodeById.get(x)?.why_outside ?? x), ';'],
    ...(b.not_built.length ? [['Not built (intended or missing)', b.not_built.map(L), ','] as [string, string[], string]] : []),
    ['Left out on purpose', b.excluded.map(x => `${x.name}: ${x.why}`), ';'],
  ]
  details('Model boundary',
    nl('<table>', ...bRows.map(([k, v, sep]) => `<tr><th>${esc(k)}</th><td>${listHtml(v, sep)}</td></tr>`), '</table>', '<p class="muted">The first rows are derived from the links (Sterman 2000; Trimble 2014); the last is the modeller\'s list.</p>'),
    bRows.map(([k, v, sep]) => `${k}: ${listText(v, sep)}`).join('\n'))

  const comps = new Map<string, string[]>()
  for (const x of [...model.nodes, ...model.flows]) if (x.component) comps.set(x.component, [...(comps.get(x.component) ?? []), L(x.id)])
  if (comps.size) details('Components', nl('<table>', ...[...comps].map(([k, els]) => `<tr><th>${esc(k)}</th><td>${listHtml(els, ',')}</td></tr>`), '</table>'), [...comps].map(([k, els]) => `${k}: ${listText(els, ',')}`).join('\n'))

  // evidence: what was checked, honestly counted
  // the counts are the checker's, over one set of quotes (elements and reference modes): never recounted here
  const webOnly = c.quotes_web ?? 0
  const checkedLine = `${c.quotes_verified ?? 0} of ${c.quotes_total ?? 0} quotes were checked against their files when this page was built${webOnly ? `; ${webOnly} web source${webOnly > 1 ? 's' : ''} could not be checked and ${webOnly > 1 ? 'are' : 'is'} marked` : ''}.`
  type Row = { id: string; title: string; kind: string; status: Status; units?: string; value?: string; component?: string; detail?: string; claim?: string; mechanism?: string; note?: string; emphasis?: string; evidence: Evidence[] }
  const rowsData: Row[] = [
    ...model.nodes.filter(n => n.kind !== 'cloud' && n.kind !== 'shadow').map(n => ({ id: n.id, title: n.label, kind: n.kind === 'aux' ? 'variable' : n.kind, status: n.status, units: n.units, value: n.value, component: n.component, detail: n.detail, claim: n.claim, emphasis: n.emphasis, evidence: n.evidence })),
    ...model.flows.map(f => ({ id: f.id, title: f.label, kind: `flow (${L(f.from)} → ${L(f.to)})`, status: f.status, units: f.units, component: f.component, detail: f.detail, claim: f.claim, emphasis: f.emphasis, evidence: f.evidence })),
    ...model.links.map(l => ({ id: l.id, title: L(l.id), kind: `link ${l.polarity === '-' ? '−' : '+'}${l.delay ? ', read late' : ''}`, status: l.status, detail: l.detail, claim: l.claim, mechanism: l.mechanism, note: l.label, emphasis: l.emphasis, evidence: l.evidence })),
  ]
  const rowsHtml = rowsData.map(r => `<tr><td><b>${esc(r.title)}</b><br><span class="muted">${esc([r.kind, r.status, r.units, r.value ? `value ${r.value}` : ''].filter(Boolean).join(' · '))}</span></td><td>${r.note ? `<i>${esc(r.note)}</i><br>` : ''}${r.mechanism ? `${esc(r.mechanism)}<br>` : ''}${r.detail ? `${esc(r.detail)}<br>` : ''}${r.evidence.map(e => `<code>${esc(evRef(e))}</code> “${esc(e.quote)}”${isWeb(e) ? ' <span class="unchecked">(web source, not checked)</span>' : ''}${e.from ? ` <span class="muted">(extract of ${esc(e.from)})</span>` : ''}`).join('<br>\n')}${r.claim ? `${r.evidence.length || r.mechanism || r.detail ? '<br>' : ''}<i>Claim:</i> ${esc(r.claim)}` : ''}${r.emphasis ? `<br><i>Highlighted:</i> ${esc(r.emphasis)}` : ''}</td></tr>`)
  const rowsText = rowsData.map(r => `- ${r.title} (${[r.kind, r.status, r.units, r.value ? `value ${r.value}` : ''].filter(Boolean).join(', ')})${r.note ? `, labelled "${r.note}"` : ''}${r.mechanism ? `: ${r.mechanism}` : ''}${r.detail ? `. ${r.detail}` : ''}${r.evidence.map(e => ` [${evRef(e)}] "${e.quote}"${isWeb(e) ? ' (web source, not checked)' : ''}${e.from ? ` (extract of ${e.from})` : ''}`).join('')}${r.claim ? ` Claim: ${r.claim}` : ''}${r.emphasis ? ` Highlighted: ${r.emphasis}` : ''}`)
  const evIntro = `Paths are relative to ${subj.name}${subj.ref ? ` at ${subj.ref}` : ''}${subj.dirty ? ' (with uncommitted changes)' : ''}. ${checkedLine}`
  details(`Every element and its source (${rowsHtml.length})`, nl(`<p class="muted">${esc(evIntro)}</p>`, '<table>', ...rowsHtml, '</table>'), [evIntro, ...rowsText].join('\n'))

  if (model.notes.length) details('Notes', nl('<ul>', ...model.notes.map(n => `<li>${esc(n)}</li>`), '</ul>'), model.notes.map(n => `- ${n}`).join('\n'))
  const methodText = `Each element was traced to its source, and ${checkedLine.charAt(0).toLowerCase()}${checkedLine.slice(1)} Every feedback loop was found by listing the model's closed causal paths; its type is the product of its link signs, counting a flow + into the stock it fills and − out of the stock it drains, and every live loop contains at least one stock. This is a model of structure: it shows how the parts are wired, not measured behaviour over time.`
  details('Method and sources', nl(`<p class="prose">${esc(methodText)}</p>`, '<ul>', ...SOURCES.map(s => `<li>${s.html}</li>`), '</ul>'), [methodText, ...SOURCES.map(s => `- ${s.text}`)].join('\n'))

  const rv = model.review
  const reviewLine = rv && (rv.rounds ?? 0) === 0
    ? `Review: not reviewed${rv.agreed !== undefined ? ` (0 of ${rv.agreed} rounds agreed)` : ''}.${rv.note ? ` ${rv.note}` : ''}`
    : rv
    ? `Review: ${rv.rounds ?? 0} round${rv.rounds === 1 ? '' : 's'}${rv.agreed !== undefined ? ` of ${rv.agreed} agreed` : ''}, ${rv.independent ? 'by reviewers other than the builder' : 'self-review only'}; ${rv.visual ? 'rendered page inspected' : 'rendered page not visually inspected'}.${rv.note ? ` ${rv.note}` : ''}`
    : 'Review: not recorded.'
  const n = (k: number | undefined, one: string, many: string) => `${k ?? 0} ${(k ?? 0) === 1 ? one : many}`
  const built = `Built with the dynamics plugin from a checked model: ${n(c.stocks, 'stock', 'stocks')}, ${n(c.flows, 'flow', 'flows')}, ${n((c.variables ?? 0) + (c.constants ?? 0), 'variable or constant', 'variables and constants')}, ${n(c.links, 'link', 'links')}, ${n(c.loops, 'live feedback loop', 'live feedback loops')}. Loop types, loop membership, traces, the boundary and the legend are derived from the model. Not machine-checked: ${n(report.not_checked.length, 'kind of claim', 'kinds of claim')}, listed under “What is not machine-checked” above.`
  details(`What is not machine-checked (${report.not_checked.length})`, nl('<ul>', ...report.not_checked.map(s => `<li>${esc(s)}</li>`), '</ul>'), report.not_checked.map(s => `- ${s}`).join('\n'))
  both(nl('<footer>', `<p>${esc(reviewLine)}</p>`, `<p>${esc(built)}</p>`, '</footer>'), `\n${reviewLine}\n${built}`)

  const info: Record<string, unknown> = {}
  const evOut = (list: Evidence[]) => list.map(e => ({ r: evRef(e), q: e.quote, u: isWeb(e), f: e.from }))
  const entryOf = (r: Row) => ({ t: r.title, k: r.kind, s: r.status, u: r.units, v: r.value, m: r.component, n: r.note, h: r.mechanism, d: r.detail, c: r.claim, x: r.emphasis, e: evOut(r.evidence), l: loopsOf.get(r.id) ?? [] })
  const rowById = new Map(rowsData.map(r => [r.id, r]))
  for (const n of model.nodes) if (n.kind === 'shadow') {
    // a copy's panel carries what it copies (status, claim, evidence, highlight), from the same row as the original's
    const of = rowById.get(n.of ?? '')
    info[n.id] = { ...(of ? entryOf(of) : { s: copied(ctx, n).status }), t: `<${L(n.id)}>`, k: 'copy (shadow)', o: `A copy of “${L(n.of ?? '')}”, which is drawn in full elsewhere on this page.`, l: loopsOf.get(n.id) ?? [] }
  } else if (n.kind === 'cloud') info[n.id] = { t: 'Outside the model', k: 'cloud', w: n.why_outside }
  for (const r of rowsData) info[r.id] = entryOf(r)
  // one element per line, for the same reason as nl()
  const infoJson = nl('{', Object.entries(info).map(([k, v]) => `${safeJson(k)}:${safeJson(v)}`).join(',\n'), '}')

  const page = nl(PAGE_PREFIX, `<title>${esc(model.title)}</title>`, `<style>${CSS}</style>`, '</head>', '<body>', '<main class="wrap">', ...html, '</main>',
    `<script type="application/json" id="sf-info">\n${infoJson}\n</script>`, `<script>${SCRIPT}</script>`, '</body>', '</html>') + '\n'
  return { html: seal(page), readerView: wellFormed(text.join('\n')), layout, legend: entries.map(e => e.mark) }
}

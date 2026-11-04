import type { Facts, Lane, Parsed, Row, Settings, Station } from './types.ts'

const LAND = { yes: 0, choice: 1, no: 2 }

// priority: the settings' order, highest first; unknown sorts last
export function orderStops(ids: string[], rows: Row[], f: Facts, priority: string[] = []): string[] {
  // the Maps are built reversed: the first row of an ID wins
  const order = new Map(rows.map((r, i) => [r.id, i] as const).reverse())
  const rank = (r: Row) => { const i = priority.indexOf(r.priority); return i < 0 ? Infinity : i }
  const byId = new Map(rows.map(r => [r.id, r] as const).reverse())
  const left = ids.map(id => byId.get(id)!).filter(Boolean).sort((a, b) =>
    LAND[a.landNow.state] - LAND[b.landNow.state] || (rank(a) === rank(b) ? 0 : rank(a) < rank(b) ? -1 : 1) ||
    order.get(a.id)! - order.get(b.id)!)
  const out: string[] = []
  while (left.length) {
    const i = left.findIndex(r => !(f.before[r.id] ?? []).some(b => left.some(l => l.id === b)))
    out.push(left.splice(i < 0 ? 0 : i, 1)[0].id)
  }
  return out
}

export function computeLanes(s: Settings, p: Parsed, f: Facts): Lane[] {
  const duties = new Set(f.duties)
  const open = p.rows
  const byId = new Map(open.map(r => [r.id, r] as const).reverse())
  const order = new Map(open.map((r, i) => [r.id, i] as const).reverse())
  const prio = s.values.priority ?? []

  // a path beats another when longer, then when its gate opens more, then by file order
  const better = (c: string[], best: string[]) => c.length !== best.length ? c.length > best.length :
    f.opens[c[0]] !== f.opens[best[0]] ? f.opens[c[0]] > f.opens[best[0]] : order.get(c[0])! < order.get(best[0])!

  // longest Waits on path ending at id, first row first; onPath keeps cycles finite
  const memo = new Map<string, string[]>()
  const longest = (id: string, onPath: Set<string>): string[] => {
    const hit = memo.get(id)
    if (hit) return hit
    onPath.add(id)
    let best: string[] = []
    for (const w of byId.get(id)!.waitsOn) {
      if (!byId.has(w) || onPath.has(w)) continue
      const c = longest(w, onPath)
      if (!best.length || better(c, best)) best = c
    }
    onPath.delete(id)
    const path = [...best, id]
    memo.set(id, path)
    return path
  }

  const station = (milestone: string, shared: boolean, doneWhen?: string): Station => {
    const ids = open.filter(r => !duties.has(r.id) && r.milestones.includes(milestone)).map(r => r.id)
    const stops = orderStops(ids, open, f, prio)
    let top: string[] = []
    for (const id of stops) {
      const c = longest(id, new Set())
      if (!top.length || better(c, top)) top = c
    }
    const reached = !open.some(r => r.milestones[0] === milestone) &&
      p.checklists.every(c => c.milestone !== milestone || c.ticked)
    return { milestone, ...(doneWhen === undefined ? {} : { doneWhen }), shared, reached, stops,
      chain: top.length, gate: top.length ? top[0] : null }
  }
  const finish = (path: string, stations: Station[]): Lane =>
    ({ path, stations, next: stations.find(x => !x.reached)?.milestone ?? null })

  if (s.paths.length === 0) {
    const ms = [...new Set(open.flatMap(r => r.milestones))].filter(m => m !== s.none)
    return [finish(s.project, ms.map(m => station(m, false)))]
  }
  const mk = (path: Settings['paths'][number], shared: boolean) =>
    path.milestones.map(m => station(m.name, shared, m.doneWhen))
  const shared = s.paths.filter(x => x.shared).flatMap(x => mk(x, true))
  return s.paths.filter(x => !x.shared).map(x => finish(x.name, [...shared, ...mk(x, false)]))
}

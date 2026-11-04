import type { Facts, FileKey, Parsed, Row, Settings } from './types.ts'

export function computeFacts(s: Settings, p: Parsed): Facts {
  const rows = p.rows
  const known = new Set(rows.map(r => r.id))
  const unlocks: Record<string, string[]> = {}
  for (const r of rows) unlocks[r.id] = []
  for (const r of rows) for (const w of r.waitsOn) if (known.has(w) && w !== r.id) unlocks[w].push(r.id)
  const byId = new Map(rows.map(r => [r.id, r]))
  const waitsOnKnown = (id: string) => byId.get(id)!.waitsOn.filter(w => known.has(w) && w !== id)
  const reach = (start: string, next: (id: string) => string[]) => {
    const seen = new Set<string>()
    const stack = [...next(start)]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id) || id === start) continue
      seen.add(id)
      stack.push(...next(id))
    }
    return seen
  }
  const before: Record<string, string[]> = {}
  const opens: Record<string, number> = {}
  for (const r of rows) {
    before[r.id] = [...reach(r.id, waitsOnKnown)]
    opens[r.id] = reach(r.id, x => unlocks[x]).size
  }

  const closedIds = [...new Set(p.done.flatMap(d => d.ids))].filter(id => !known.has(id))
  const closedSet = new Set(closedIds)
  const duties = rows.filter(r => r.trigger.startsWith(s.duties.triggerPrefix))
  const isDuty = new Set(duties.map(r => r.id))
  const no = rows.filter(r => r.landNow.state === 'no')
  const doors = no.filter(r => r.waitsOn.length > 0 && r.waitsOn.every(w => closedSet.has(w)))
  const isDoor = new Set(doors.map(r => r.id))
  const waitingOnRows = no.filter(r => r.waitsOn.some(w => known.has(w)))
  const isWaiting = new Set(waitingOnRows.map(r => r.id))
  const byHand = no.filter(r => !isWaiting.has(r.id) && !isDoor.has(r.id) && !isDuty.has(r.id))

  const prio = (r: Row) => { const i = s.values.priority?.indexOf(r.priority) ?? -1; return i < 0 ? Infinity : i }
  const mile = (r: Row) => {
    for (const path of s.paths) {
      const i = path.milestones.findIndex(m => m.name === r.milestones[0])
      if (i >= 0) return i
    }
    return Infinity
  }
  // Array.sort is stable, so file order breaks the last ties
  const cmp = (...keys: ((r: Row) => number)[]) => (a: Row, b: Row) => {
    for (const k of keys) { const d = k(a) === k(b) ? 0 : k(a) < k(b) ? -1 : 1; if (d) return d }
    return 0
  }
  const byOpens = (r: Row) => -opens[r.id]
  const landNow = rows.filter(r => r.landNow.state === 'yes' && !isDuty.has(r.id)).sort(cmp(byOpens, prio))
  const queueRows = rows.filter(r => r.landNow.state === 'choice' || r.who === 'owner' || r.who === 'both')
    .sort(cmp(byOpens, mile, prio))

  const tally = (rs: Row[]) => ({
    open: rs.length,
    yes: rs.filter(r => r.landNow.state === 'yes').length,
    choice: rs.filter(r => r.landNow.state === 'choice').length,
    no: rs.filter(r => r.landNow.state === 'no').length,
  })
  const perFile = {} as Facts['counts']['perFile']
  for (const f of ['backlog', 'playbook'] as FileKey[]) {
    perFile[f] = { ...tally(rows.filter(r => r.file === f)), closed: p.done.filter(d => d.file === f).length }
  }
  const t = tally(rows)
  return {
    counts: {
      all: p.done.length + rows.length, closed: p.done.length, ...t, perFile,
      needYou: rows.filter(r => r.who === 'owner' || r.who === 'both').length,
      waitsOnRow: rows.filter(r => r.waitsOn.some(w => known.has(w) && w !== r.id)).length,
      noMilestone: rows.filter(r => r.milestones.length === 1 && r.milestones[0] === s.none).length,
      queue: queueRows.length,
    },
    unlocks, opens, before, closedIds,
    doors: doors.map(r => r.id), duties: duties.map(r => r.id),
    landNow: landNow.map(r => r.id), queue: queueRows.map(r => r.id),
    waitingOnRows: waitingOnRows.map(r => r.id), byHand: byHand.map(r => r.id),
  }
}

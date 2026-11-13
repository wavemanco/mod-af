import type { Facts, Finding, HistoryEntry, Lane, Level, Parsed, Row, Settings } from './types.ts'
import { idsIn } from './parse.ts'
import { lastDones, readsPeriod, realDay } from './brief.ts'

const ORDER: Level[] = ['error', 'warning', 'recommendation']

export function findingsFor(s: Settings, p: Parsed, f: Facts, _lanes: Lane[], history: HistoryEntry[]): Finding[] {
  const out: Finding[] = [...p.findings]
  const warn = (rule: string, r: { file: Finding['file']; line: number }, message: string) =>
    out.push({ level: 'warning', rule, file: r.file, line: r.line, message })
  const rec = (rule: string, message: string) => out.push({ level: 'recommendation', rule, message })
  const known = new Set(p.rows.map(r => r.id))
  const exists = (id: string) => known.has(id) || f.closedIds.includes(id)
  const idForm = s.ids.map(src => new RegExp(`^(?:${src})$`))
  const c = s.columns
  const pathMilestones = new Set(s.paths.flatMap(x => x.milestones.map(m => m.name)))
  const duties = new Set(f.duties)

  for (const r of p.rows) {
    const w = (rule: string, m: string) => warn(rule, r, `${r.id}: ${m}`)
    if (idForm.length && !idForm.some(re => re.test(r.id))) w('id-form', 'the ID matches no ids pattern')
    if (!r.landNow.valid) w('land-now', 'Land now is not yes, "small choice: <why>" or "no: <why>"')
    if (r.landNow.state === 'yes' && r.landNow.valid && (r.who !== 'agent' || r.waitsOn.some(w => known.has(w))))
      w('land-now-yes', 'a yes row needs Who = agent and nothing to wait on')
    if (r.who === 'unknown') w('who', `unknown Who "${r.whoRaw}"`)
    const ms = r.milestones
    if (ms.length === 0) w('milestone', 'Milestone is empty')
    if (new Set(ms).size !== ms.length) w('milestone', 'a milestone is repeated')
    if (ms.includes(s.none) && ms.length > 1) w('milestone', `${s.none} is mixed with another milestone`)
    if (s.paths.length && ms.some(m => m !== s.none && !pathMilestones.has(m))) w('milestone', 'a milestone is on no path')
    // the table of this row: the last pending table of its file that starts at or before it
    const header = p.tables.filter(t => t.file === r.file && t.line <= r.line).pop()?.header ?? []
    const has = (name?: string) => name !== undefined && header.includes(name)
    if (has(c.priority) && s.values.priority && !s.values.priority.includes(r.priority))
      w('value', `Priority "${r.priority}" is not in the list`)
    const tt = c.triggerType ? r.extra[c.triggerType] ?? '' : ''
    if (has(c.triggerType) && s.values.triggerType && !s.values.triggerType.includes(tt))
      w('value', `Trigger type "${tt}" is not in the list`)
    // "before <date>" is a legal Filed: the day is known to be no later
    if (has(c.filed) && !realDay(r.filed.replace(/^before /, ''))) w('filed', `Filed "${r.filed}" is not a real YYYY-MM-DD date`)
    if (duties.has(r.id)) {
      const days = lastDones(r.details)
      for (const d of days) if (!realDay(d)) w('last-done', `Last done "${d}" is not a real YYYY-MM-DD date`)
      if (days.length && !readsPeriod(r.trigger))
        w('duty-period', 'the short view reads no period in this Trigger, so it never says the duty is due: it reads "Every session" and "Every [n] day, week, month, quarter or year", n in digits')
    }
    const words = r.trigger.split(/\s+/).filter(Boolean).length
    if (words === 0) w('trigger', 'Trigger is empty')
    else if (words > 30) w('trigger', `Trigger has ${words} words, 30 at most`)
    for (const id of r.waitsOn) {
      if (id === r.id) w('waits-on', 'waits on itself')
      else if (!exists(id)) w('waits-on', `waits on ${id}, which exists nowhere`)
    }
  }

  // cycles: one finding per set of rows that wait on each other
  const edges = (r: Row) => r.waitsOn.filter(x => known.has(x) && x !== r.id)
  const byId = new Map(p.rows.map(r => [r.id, r]))
  const reach = (start: string) => {
    const seen = new Set<string>(), stack = [...edges(byId.get(start)!)]
    while (stack.length) { const x = stack.pop()!; if (!seen.has(x)) { seen.add(x); stack.push(...edges(byId.get(x)!)) } }
    return seen
  }
  const reported = new Set<string>()
  for (const r of p.rows) {
    const rs = reach(r.id)
    if (!rs.has(r.id)) continue
    const set = [r.id, ...[...rs].filter(x => x !== r.id && reach(x).has(r.id))].sort().join(', ')
    if (!reported.has(set)) { reported.add(set); warn('cycle', r, `these rows wait on each other: ${set}`) }
  }

  for (const l of p.checklists) {
    if (l.ticked) continue
    const at = { file: l.file, line: l.line }
    const gone = l.ids.filter(id => !exists(id))
    if (l.ids.length === 0) warn('checklist-ids', at, 'an unticked line names no ID')
    else if (gone.length) warn('checklist-ids', at, `names ${gone.join(', ')}, which exists nowhere`)
    else if (l.ids.every(id => !known.has(id))) warn('checklist-closed', at, 'every ID it names is closed')
  }

  const w = p.whereWeAre
  if (w) {
    const at = { file: w.file, line: w.line }
    const gone = idsIn(w.text, s).filter(id => !exists(id))
    if (gone.length) warn('where-we-are', at, `names ${gone.join(', ')}, which exists nowhere`)
    const moves = (h: HistoryEntry) => h.opened.length + h.closed.length + h.moved.length + h.gone.length > 0
    const last = history.filter(moves).map(h => h.date.slice(0, 10)).sort().pop()
    const k = history.findLastIndex(moves) // history is oldest first
    if (w.date && last && w.date < last) warn('where-we-are', at, `dated ${w.date}, older than the last change on ${last}`)
    // undated: stale when no commit from the newest one that changed rows, that one included, rewrote it
    else if (!w.date && k >= 0 && !history.slice(k).some(h => h.whereWeAre))
      warn('where-we-are', at, `has no date, and has not changed since the rows changed on ${history[k].date.slice(0, 10)}: rewrite it, with the day`)
  } else rec('where-we-are-missing', 'no where-we-are section')

  if (s.done.some(d => d.milestoneColumn === undefined)) rec('done-milestone', 'a Done table has no milestone column')
  if (s.paths.length === 0) rec('no-paths', 'no paths are set, so there are no routes to draw')
  if (!c.details) rec('details', 'no Details column is set')
  if (!c.filed) rec('filed-column', 'no Filed column is set')
  return out
}

export function formatFindings(fs: Finding[]): string {
  return ORDER.flatMap(l => fs.filter(x => x.level === l))
    .map(x => `${x.level} ${x.rule} ${x.file ? (x.line ? `${x.file}:${x.line}` : x.file) : '-'} ${x.message}`).join('\n')
}

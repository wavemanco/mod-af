import type { PageData } from './types.ts'
import { maskPrivacy } from './privacy.ts'

const MAX = 8000
const EVERY = /^Every\s+(?:(\d+)\s+)?(day|days|week|weeks|month|months|quarter|quarters|year|years)\b/i
const EVERY_SESSION = /^Every session\b/i
const MONTHS: Record<string, number> = { month: 1, quarter: 3, year: 12 }

// The periods the short view computes; check warns on a duty with a Last done and any other.
export const readsPeriod = (trigger: string): boolean => EVERY_SESSION.test(trigger) || EVERY.test(trigger)

// The date n days/weeks/months/quarters/years after an ISO date (UTC, no clock read).
function addInterval(iso: string, n: number, unit: string): string {
  const d = new Date(iso + 'T00:00:00Z'), u = unit.replace(/s$/, '')
  if (MONTHS[u]) d.setUTCMonth(d.getUTCMonth() + n * MONTHS[u])
  else d.setUTCDate(d.getUTCDate() + n * (u === 'week' ? 7 : 1))
  return d.toISOString().slice(0, 10)
}

// A YYYY-MM-DD that is a day of the calendar: the round trip catches 2026-13-01 and a rolled-over 2026-02-30.
export function realDay(day: string): boolean {
  const d = new Date(day + 'T00:00:00Z')
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !isNaN(+d) && d.toISOString().slice(0, 10) === day
}

const LAST_DONE = /Last done:(?:\*\*)?\s*(\d{4}-\d{2}-\d{2})/g
export const lastDones = (details: string): string[] => [...details.matchAll(LAST_DONE)].map(m => m[1])

export function dutyDue(trigger: string, lastDone: string | null, today: string): boolean {
  if (EVERY_SESSION.test(trigger)) return true
  const m = EVERY.exec(trigger)
  if (!m || !lastDone || !realDay(lastDone)) return false
  return addInterval(lastDone, m[1] ? Number(m[1]) : 1, m[2].toLowerCase()) <= today
}

const dutiesLine = (duties: PageData['duties'], today: string) =>
  maskPrivacy(`Duties due: ${duties.filter(x => dutyDue(x.trigger, x.lastDone, today)).map(x => x.id).join(', ')}`)

// A view built with no day has no duties line; one stored keeps its duty rows and gets the day's line here when it is
// served, before its last line, where brief puts it, so a new day needs no rebuild (Phase 3, HK-035)
export function withDuties(view: string, duties: PageData['duties'], today: string): string {
  const lines = view.split('\n')
  lines.splice(-1, 0, dutiesLine(duties, today))
  return lines.join('\n')
}

// mask, then cut: a key or address cut short no longer has its shape, so the mask would miss it
// shortcut: cuts at 120 characters, mid-word; upgrade if items need a word boundary
const short = (t: string) => (t = maskPrivacy(t)).length <= 120 ? t : t.slice(0, 119) + '…'

// What a run read against what is checked out, for the short view, check and map (finding 12; DESIGN 3.4: the
// command's output says when local main is behind a known remote copy)
export const onBranch = (branch: string | undefined, main: string, what: string): string[] =>
  branch && branch !== main ? [`On branch ${branch}; ${what} ${main}.`] : []
export const behind = (n: number | undefined, main: string): string[] =>
  n && n > 0 ? [`Local ${main} is ${n} commits behind its remote copy.`] : []

// The branch's line, after the view's heading. A stored view is kept without one and gets the current branch's when
// it is served (second check, finding 15).
export function withBranch(view: string, branch: string | undefined, main: string): string {
  const [head, ...rest] = view.split('\n')
  const text = [head, ...onBranch(branch, main, 'the map shows').map(maskPrivacy), ...rest].join('\n')
  return text.length > MAX ? text.slice(0, MAX - 1) + '…' : text
}

export function brief(d: PageData, opts: { today?: string; branch?: string; behindRemote?: number; main?: string }): string {
  const main = opts.main ?? 'main'
  const byId = new Map(d.rows.map(r => [r.id, r]))
  const out: string[] = [`# ${d.project}: where we are (${d.commit}, ${d.date})`, ...behind(opts.behindRemote, main)]
  const w = maskPrivacy(d.whereWeAre?.text ?? '')
  if (w) {
    // shortcut: cuts at the last space inside 600 characters, or hard at 600 for one long word
    const cut = w.length <= 600 ? w : w.slice(0, 600).replace(/\s+\S*$/, '') || w.slice(0, 600)
    out.push(cut)
  }
  for (const l of d.lanes) {
    const next = l.stations.find(s => s.milestone === l.next)
    out.push(!l.stations.length ? `${l.path}: no milestone yet`
      : l.next === null || !next ? `${l.path}: all reached`
      : `${l.path}: next ${l.next}, ${next.stops.length} stops, gate ${next.gate ?? 'none'}`)
  }
  out.push('Land now:')
  for (const id of d.landNow.slice(0, 5)) out.push(`${id} ${short(byId.get(id)?.item ?? '')} (opens ${byId.get(id)?.opens ?? 0})`)
  out.push('Needs you:')
  for (const q of d.queue.slice(0, 5)) out.push(`${q.id} ${short(byId.get(q.id)?.item ?? '')} (before ${q.before ?? 'no milestone'}; holds up ${q.holdsUp})`)
  out.push(`Doors just opened: ${d.doors.join(', ')}`)
  if (opts.today) out.push(dutiesLine(d.duties, opts.today))
  out.push(`${d.findings.filter(f => f.level === 'warning').length} warnings, ${d.findings.filter(f => f.level === 'error').length} errors: /housekeeping check`)
  // the short view stays in the person's session: a hit is masked, not blocked
  return withBranch(maskPrivacy(out.join('\n')), opts.branch, main)
}

import type { PageData } from './types.ts'
import { maskPrivacy } from './privacy.ts'

const MAX = 8000
const EVERY = /^Every\s+(?:(\d+)\s+)?(day|days|week|weeks|month|months)\b/i
const EVERY_SESSION = /^Every session\b/i

// The date n days/weeks/months after an ISO date (UTC, no clock read).
function addInterval(iso: string, n: number, unit: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  if (unit.startsWith('month')) d.setUTCMonth(d.getUTCMonth() + n)
  else d.setUTCDate(d.getUTCDate() + n * (unit.startsWith('week') ? 7 : 1))
  return d.toISOString().slice(0, 10)
}

function dutyDue(trigger: string, lastDone: string | null, today: string): boolean {
  if (EVERY_SESSION.test(trigger)) return true
  const m = EVERY.exec(trigger)
  if (!m || !lastDone) return false
  return addInterval(lastDone, m[1] ? Number(m[1]) : 1, m[2].toLowerCase()) <= today
}

// shortcut: cuts at 120 characters, mid-word; upgrade if items need a word boundary
const short = (t: string) => t.length <= 120 ? t : t.slice(0, 119) + '…'

export function brief(d: PageData, opts: { today?: string; branch?: string; behindRemote?: number; main?: string }): string {
  const main = opts.main ?? 'main'
  const byId = new Map(d.rows.map(r => [r.id, r]))
  const out: string[] = [`# ${d.project}: where we are (${d.commit}, ${d.date})`]
  if (opts.branch && opts.branch !== main) out.push(`On branch ${opts.branch}; the map shows ${main}.`)
  if (opts.behindRemote && opts.behindRemote > 0) out.push(`Local ${main} is ${opts.behindRemote} commits behind its remote copy.`)
  const w = d.whereWeAre?.text ?? ''
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
  if (opts.today) {
    out.push(`Duties due: ${d.duties.filter(x => dutyDue(x.trigger, x.lastDone, opts.today!)).map(x => x.id).join(', ')}`)
  }
  out.push(`${d.findings.filter(f => f.level === 'warning').length} warnings, ${d.findings.filter(f => f.level === 'error').length} errors: /housekeeping check`)
  const text = maskPrivacy(out.join('\n')) // the short view stays in the person's session: a hit is masked, not blocked
  return text.length > MAX ? text.slice(0, MAX - 1) + '…' : text
}

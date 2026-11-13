import type { CommitInfo, Facts, Finding, HistoryEntry, Lane, PageData, Parsed, Settings } from './types.ts'
import { TEMPLATE } from './template.ts'
import { lastDones } from './brief.ts'

const PLACEHOLDER = '/*DATA*/null'
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// history comes oldest first, as historyFrom gives it; the page gets it newest first
export function pageData(s: Settings, head: CommitInfo, p: Parsed, f: Facts, lanes: Lane[], history: HistoryEntry[],
  findings: Finding[]): PageData {
  const byId = new Map(p.rows.map(r => [r.id, r]))
  // a Details line (cells break lines with <br>) starting with the word, bold or not
  const dud = new RegExp(`^(?:\\*\\*)?${escapeRe(s.defaultUntilDecided)}(?:\\*\\*)?\\s*(.*)$`)
  const defaultOf = (details: string) => {
    for (const l of details.split(/<br\s*\/?>|\n/i)) { const m = dud.exec(l.trim()); if (m) return m[1].trim() }
    return null
  }
  const firstSeen = (id: string) => {
    const e = history.find(x => x.opened.includes(id))
    return e ? { sha: e.sha, date: e.date, subject: e.subject } : null
  }
  const pathsOf = (m: string) => lanes.filter(l => l.stations.some(st => st.milestone === m)).map(l => l.path)
  return {
    project: s.project, commit: head.sha.slice(0, 7), date: head.date, counts: f.counts, whereWeAre: p.whereWeAre, lanes,
    rows: p.rows.map(r => ({ id: r.id, item: r.item, file: r.file, section: r.section, line: r.line,
      milestones: r.milestones, who: r.who, landNow: r.landNow.state, landNowWhy: r.landNow.why, trigger: r.trigger,
      waitsOn: r.waitsOn, unlocks: f.unlocks[r.id] ?? [], opens: f.opens[r.id] ?? 0, details: r.details,
      filed: r.filed, priority: r.priority, defaultUntilDecided: defaultOf(r.details), firstSeen: firstSeen(r.id) })),
    done: p.done.map(e => ({ ids: e.ids, item: e.item, landed: e.landed, milestone: e.milestone, file: e.file })),
    landNow: f.landNow,
    queue: f.queue.map(id => {
      const m = byId.get(id)!.milestones[0] ?? s.none
      const before = m === s.none ? null : m
      return { id, before, paths: before === null ? [] : pathsOf(before), holdsUp: f.opens[id] ?? 0 }
    }),
    doors: f.doors, waitingOnRows: f.waitingOnRows, byHand: f.byHand,
    duties: f.duties.map(id => {
      const r = byId.get(id)!
      return { id, trigger: r.trigger, lastDone: lastDones(r.details).sort().pop() ?? null } // the latest one
    }),
    checklists: p.checklists, history: [...history].reverse(), findings, notDoing: p.notDoing,
  }
}

export function renderPage(d: PageData, template: string = TEMPLATE): string {
  const parts = template.split(PLACEHOLDER)
  if (parts.length !== 2) throw new Error(`the page template must hold ${PLACEHOLDER} exactly once; it holds it ${parts.length - 1} times`)
  // split and join, not replace: a cell's "$&" or "$1" must not act as a pattern
  const json = JSON.stringify(d).replace(/[<>&\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
  return parts[0] + json + parts[1]
}

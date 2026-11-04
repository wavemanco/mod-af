import type { ChecklistLine, DoneEntry, FileKey, Finding, LandNow, Parsed, Row, Settings } from './types.ts'
import { FENCE, HEADING, normalise, scanTables } from './markdown.ts'

const DATE = /\d{4}-\d{2}-\d{2}/
const KEYS: FileKey[] = ['backlog', 'playbook']

export function idsIn(text: string, s: Settings): string[] {
  if (!s.ids.length) return []
  const re = new RegExp(s.ids.map(src => `(?<![\\w-])(?:${src})(?![\\w-])`).join('|'), 'g')
  return [...new Set(text.match(re) ?? [])]
}

function landNow(raw: string): LandNow {
  if (raw === 'yes') return { state: 'yes', why: '', valid: true }
  const m = /^(small choice|no): (\S.*)$/.exec(raw)
  if (m) return { state: m[1] === 'no' ? 'no' : 'choice', why: m[2], valid: true }
  return { state: 'no', why: raw, valid: false }
}

// The lines of the `##` sections whose title starts with `heading`, fences skipped.
// A `###` heading comes back as { sub: title } so callers can group and break paragraphs.
type SecLine = { line: number; text: string; group: string; sub: boolean }
function sectionLines(text: string, heading: string): SecLine[] {
  const out: SecLine[] = []
  let inSec = false, group = '', fenced = false
  normalise(text).split('\n').forEach((t, i) => {
    if (FENCE.test(t)) { fenced = !fenced; return }
    if (fenced) return
    const h = HEADING.exec(t)
    if (h && h[1].length <= 2) { inSec = h[1] === '##' && h[2].startsWith(heading); group = ''; return }
    if (!inSec) return
    if (h && h[1] === '###') group = h[2]
    out.push({ line: i + 1, text: t, group, sub: !!h })
  })
  return out
}

export function parseFiles(s: Settings, files: Record<FileKey, string | null>): Parsed {
  const out: Parsed = { rows: [], done: [], checklists: [], whereWeAre: null, notDoing: [], findings: [] }
  const nothing = (c: string) => s.values.nothing.includes(c)
  const list = (c: string) => c.split(',').map(x => x.trim()).filter(x => !nothing(x))
  // Milestone keeps `none` (a value there); Waits on has no such value, so it drops it.
  const waits = (c: string) => list(c).filter(x => x !== s.none)
  const text: Record<FileKey, string> = { backlog: '', playbook: '' }
  for (const f of KEYS) {
    if (files[f] === null) out.findings.push({ level: 'error', rule: 'file', file: f, message: `${s.files[f].path} is missing` })
    else text[f] = normalise(files[f] as string)
  }
  const c = s.columns
  const known = new Set(Object.values(c))
  const seen = new Set<string>()

  for (const f of KEYS) {
    const skip = [...s.files[f].skipSections, ...s.done.filter(d => d.file === f).map(d => d.sectionPrefix)]
    for (const t of scanTables(text[f])) {
      if (skip.some(p => t.section.startsWith(p))) continue
      const col = (name: string | undefined) => (name === undefined ? -1 : t.header.indexOf(name))
      if (col(c.id) < 0 || col(c.item) < 0) continue
      for (const r of t.rows) {
        if (r.cells.length !== t.header.length)
          out.findings.push({ level: 'warning', rule: 'columns', file: f, line: r.line,
            message: `row has ${r.cells.length} cells, the header has ${t.header.length}` })
        const cell = (name: string | undefined) => (col(name) < 0 ? '' : (r.cells[col(name)] ?? ''))
        const id = cell(c.id)
        if (id === '') continue
        const whoRaw = cell(c.who)
        const who = (['agent', 'owner', 'both'] as const).find(k => s.values.who[k].includes(whoRaw)) ?? 'unknown'
        const extra: Record<string, string> = {}
        t.header.forEach((h, i) => { if (!known.has(h)) extra[h] = r.cells[i] ?? '' })
        if (seen.has(id)) out.findings.push({ level: 'error', rule: 'id-unique', file: f, line: r.line, message: `${id} appears more than once` })
        seen.add(id)
        const row: Row = { id, item: cell(c.item), file: f, section: t.section, line: r.line,
          milestones: list(cell(c.milestone)), who, whoRaw, landNow: landNow(cell(c.landNow)),
          trigger: cell(c.trigger), waitsOn: waits(cell(c.waitsOn)), details: cell(c.details),
          filed: cell(c.filed), priority: cell(c.priority), extra }
        out.rows.push(row)
      }
    }
  }

  for (const d of s.done) for (const t of scanTables(text[d.file])) {
    if (!t.section.startsWith(d.sectionPrefix)) continue
    for (const r of t.rows) {
      const cells = t.header.map((_, i) => r.cells[i] ?? '')
      const ids = idsIn(cells[d.idColumn] ?? '', s)
      const last = ids[ids.length - 1] ?? ''
      const file = KEYS.find(k => { const p = d.fileByIdPrefix?.[k]; return p !== undefined && last.startsWith(p) }) ?? d.file
      const ms = d.milestoneColumn === undefined ? '' : cells[d.milestoneColumn] ?? ''
      const entry: DoneEntry = { file, line: r.line, cells, ids, item: cells[d.idColumn] ?? '',
        landed: cells[d.landedColumn] ?? '', milestone: nothing(ms) ? null : ms }
      out.done.push(entry)
    }
  }

  for (const k of s.checklists) {
    let cur: ChecklistLine | null = null
    for (const l of sectionLines(text[k.file], k.heading)) {
      const m = /^\s*[-*]\s+\[([ xX])\]\s*(.*)$/.exec(l.text)
      if (m) {
        cur = { file: k.file, heading: k.heading, group: l.group, line: l.line, ticked: m[1] !== ' ',
          text: m[2].trim(), ids: [], ...(k.milestone ? { milestone: k.milestone } : {}) }
        out.checklists.push(cur)
      } else if (cur && !l.sub && /^\s+\S/.test(l.text)) cur.text += ' ' + l.text.trim()
      else cur = null
    }
  }
  for (const l of out.checklists) l.ids = idsIn(l.text, s)

  const nd = s.notDoing
  if (nd) for (const t of scanTables(text[nd.file])) {
    if (!t.section.startsWith(nd.heading)) continue
    for (const r of t.rows) out.notDoing.push({ item: r.cells[0] ?? '', why: r.cells[1] ?? '', reopen: r.cells[2] ?? '' })
  }

  const w = s.whereWeAre
  if (w) {
    const paras: { line: number; text: string }[] = []
    let cur: { line: number; text: string } | null = null
    for (const l of sectionLines(text[w.file], w.heading)) {
      if (l.sub || l.text.trim() === '') cur = null
      else if (cur) cur.text += '\n' + l.text
      else paras.push((cur = { line: l.line, text: l.text }))
    }
    const p = w.marker ? paras.find(x => x.text.startsWith(w.marker as string)) : paras[0]
    if (p) out.whereWeAre = { file: w.file, line: p.line, text: p.text, date: DATE.exec(p.text.slice(0, 80))?.[0] ?? null }
  }
  return out
}

import type { ChecklistLine, DoneEntry, FileKey, Finding, LandNow, Parsed, Row, Settings } from './types.ts'
import { HEADING, normalise, scan, scanTables, stepFence } from './markdown.ts'

const DATE = /\d{4}-\d{2}-\d{2}/
const KEYS: FileKey[] = ['backlog', 'playbook']
const DROPPED = {
  separator: 'the table here is dropped: its separator line has another number of cells than its header',
  closed: 'this line ends the table above, because it does not start with "|", so it and the "|" lines right after it are not read',
  stray: 'a line starting with "|" is in no table, so it and the "|" lines right after it are not read: a blank line ends a table, and a table starts with a header line over a separator line',
}

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

// The ## sections that hold no pending rows: set aside in the settings, Done, checklists, not-doing, where-we-are.
// skipSections, Done and not-doing match as prefixes; a checklist's and where-we-are's heading matches whole.
// own: false leaves out skipSections, giving the sections that another reader reads.
function skipFor(s: Settings, f: FileKey, own = true): (section: string) => boolean {
  const prefixes = [...(own ? s.files[f].skipSections : []), ...s.done.filter(d => d.file === f).map(d => d.sectionPrefix),
    ...(s.notDoing?.file === f ? [s.notDoing.heading] : [])]
  const whole = [...s.checklists.filter(k => k.file === f).map(k => k.heading), ...(s.whereWeAre?.file === f ? [s.whereWeAre.heading] : [])]
  return section => prefixes.some(p => section.startsWith(p)) || whole.includes(section)
}

// The lines of the `##` section whose title is `heading`, fences skipped.
// A `###` heading comes back as { sub: title } so callers can group and break paragraphs.
type SecLine = { line: number; text: string; group: string; sub: boolean }
function sectionLines(text: string, heading: string): SecLine[] {
  const out: SecLine[] = []
  let inSec = false, group = '', fenced: string | null = null
  normalise(text).split('\n').forEach((t, i) => {
    const was = fenced
    fenced = stepFence(fenced, t)
    if (was !== null || fenced !== null) return
    const h = HEADING.exec(t)
    if (h && h[1].length <= 2) { inSec = h[1] === '##' && h[2] === heading; group = ''; return }
    if (!inSec) return
    if (h && h[1] === '###') group = h[2]
    out.push({ line: i + 1, text: t, group, sub: !!h })
  })
  return out
}

// The `##` headings outside fences, with their lines.
function sectionTitles(text: string): { title: string; line: number }[] {
  let fenced: string | null = null
  return normalise(text).split('\n').flatMap((t, i) => {
    const was = fenced
    fenced = stepFence(fenced, t)
    const h = was === null && fenced === null ? HEADING.exec(t) : null
    return h && h[1] === '##' ? [{ title: h[2], line: i + 1 }] : []
  })
}

// upTo: the head commit's day; a where-we-are date after it is ignored.
export function parseFiles(s: Settings, files: Record<FileKey, string | null>, upTo?: string): Parsed {
  const out: Parsed = { rows: [], done: [], checklists: [], whereWeAre: null, notDoing: [], tables: [], findings: [] }
  const nothing = (c: string) => s.values.nothing.includes(c)
  const list = (c: string) => c.split(',').map(x => x.trim()).filter(x => !nothing(x))
  // Milestone keeps `none` (a value there); Waits on has no such value, so it drops it.
  const waits = (c: string) => [...new Set(list(c).filter(x => x !== s.none))]
  const text: Record<FileKey, string> = { backlog: '', playbook: '' }
  for (const f of KEYS) {
    if (files[f] === null) out.findings.push({ level: 'error', rule: 'file', file: f, message: `${s.files[f].path} is not on ${s.mainBranch}` })
    else text[f] = normalise(files[f] as string)
  }
  const c = s.columns
  // Trigger type stays in `extra` (Row has no field for it), so findings can check its values
  const known = new Set(Object.values(c).filter(h => h !== c.triggerType))
  const seen = new Set<string>()

  for (const f of KEYS) {
    const skipped = skipFor(s, f), readElsewhere = skipFor(s, f, false)
    const isDone = (section: string) => s.done.some(d => d.file === f && section.startsWith(d.sectionPrefix))
    const heads: string[][] = []
    const { tables, dropped, unclosed, hiding, fenced } = scan(text[f])
    if (unclosed !== null) // not filtered by section: a fence can open in where-we-are and hide the tables below
      out.findings.push({ level: 'warning', rule: 'fence', file: f, line: unclosed,
        message: 'a fence opens here and never closes, so nothing after it is read' })
    for (const line of hiding) if (line !== unclosed)
      out.findings.push({ level: 'warning', rule: 'fence', file: f, line,
        message: 'a fence opens here and a ## heading falls inside it, so nothing up to the line that closes it is read: a closing fence may be missing above that heading' })
    // a row table inside a fence in a section read for rows: a stray opener a fence in the same section closes (HK-088)
    const said = new Set([unclosed, ...hiding])
    for (const t of fenced) if (!said.has(t.opener) && (!skipped(t.section) || isDone(t.section)) && t.header.includes(c.id) && t.header.includes(c.item)) {
      said.add(t.opener)
      out.findings.push({ level: 'warning', rule: 'fence', file: f, line: t.opener,
        message: `a fence opens here and a table with ${c.id} and ${c.item} columns falls inside it, so its rows are not read: a closing fence may be missing above that table` })
    // no advice on examples here: no one rule fits an intro, a Done section and a row section (HK-093); FORMAT says
    // where a fenced example belongs
    }
    for (const d of dropped) if (!skipped(d.section) || isDone(d.section)) // a Done table's rows are read
      out.findings.push({ level: 'warning', rule: 'row-dropped', file: f, line: d.line, message: DROPPED[d.why] })
    for (const t of tables) {
      const col = (name: string | undefined) => (name === undefined ? -1 : t.header.indexOf(name))
      if (skipped(t.section)) {
        if (!readElsewhere(t.section) && col(c.id) >= 0 && col(c.item) >= 0)
          out.findings.push({ level: 'warning', rule: 'row-skipped', file: f, line: t.line,
            message: `the table here has ${c.id} and ${c.item} columns, but skipSections sets "${t.section}" aside, so its rows are not read` })
        continue
      }
      heads.push(t.header)
      out.tables.push({ file: f, line: t.line, header: t.header })
      if (col(c.id) < 0 || col(c.item) < 0) {
        // a table with neither column is some other table; with one of them, a mistyped header
        if (col(c.id) >= 0 || col(c.item) >= 0)
          out.findings.push({ level: 'warning', rule: 'row-dropped', file: f, line: t.line,
            message: `the table here is dropped: it needs both an "${c.id}" and an "${c.item}" column` })
        continue
      }
      for (const r of t.rows) {
        if (r.cells.length !== t.header.length)
          out.findings.push({ level: 'warning', rule: 'columns', file: f, line: r.line,
            message: `row has ${r.cells.length} cells, the header has ${t.header.length}` })
        const cell = (name: string | undefined) => (col(name) < 0 ? '' : (r.cells[col(name)] ?? ''))
        const id = cell(c.id)
        if (id === '') {
          if (r.cells.some(x => x !== ''))
            out.findings.push({ level: 'warning', rule: 'row-dropped', file: f, line: r.line, message: `the row here has no ${c.id}, so it is dropped` })
          continue
        }
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
    // A required column is missing when no pending table of a file that has tables names it.
    if (heads.length)
      for (const [key, name] of Object.entries(c))
        if (['id', 'item', 'milestone', 'who', 'landNow', 'trigger', 'waitsOn'].includes(key) && !heads.some(h => h.includes(name)))
          out.findings.push({ level: 'error', rule: 'column-missing', file: f,
            message: `no table in ${s.files[f].path} has a "${name}" column` })
  }

  // List items in pending sections belong in a table.
  for (const f of KEYS) {
    const skipped = skipFor(s, f)
    let section: string | null = null, fenced: string | null = null
    text[f].split('\n').forEach((l, i) => {
      const was = fenced
      fenced = stepFence(fenced, l)
      if (was !== null || fenced !== null) return
      const h = HEADING.exec(l)
      if (h && h[1].length <= 2) { section = h[1] === '##' ? h[2] : null; return }
      if (section !== null && !skipped(section) && /^(?:[-*+]|\d+\.)\s/.test(l))
        out.findings.push({ level: 'warning', rule: 'not-in-table', file: f, line: i + 1,
          message: `a list item under "${section}" is in no table` })
    })
  }

  const inDone = new Set<string>()
  for (const d of s.done) for (const t of scanTables(text[d.file])) {
    if (!t.section.startsWith(d.sectionPrefix)) continue
    const itemAt = t.header.indexOf(c.item) < 0 ? d.idColumn : t.header.indexOf(c.item) // the title, else the ID cell
    for (const r of t.rows) {
      const cells = t.header.map((_, i) => r.cells[i] ?? '')
      const ids = idsIn(cells[d.idColumn] ?? '', s)
      // a warning, not an error: a reopened row is legitimate
      for (const id of ids) {
        const twice = seen.has(id) ? 'is open and also in Done' : inDone.has(id) ? 'is in more than one Done entry' : null
        if (twice) out.findings.push({ level: 'warning', rule: 'done-id', file: d.file, line: r.line, message: `${id} ${twice}` })
        inDone.add(id)
      }
      const last = ids[ids.length - 1] ?? ''
      const file = KEYS.find(k => { const p = d.fileByIdPrefix?.[k]; return p !== undefined && last.startsWith(p) }) ?? d.file
      const ms = d.milestoneColumn === undefined ? '' : cells[d.milestoneColumn] ?? ''
      const entry: DoneEntry = { file, line: r.line, cells, ids, item: cells[itemAt] ?? '',
        landed: cells[d.landedColumn] ?? '', milestone: nothing(ms) ? null : ms }
      out.done.push(entry)
    }
  }

  for (const k of s.checklists) {
    const titles = sectionTitles(text[k.file])
    if (files[k.file] !== null && !titles.some(t => t.title === k.heading)) { // a missing file is its own error
      const near = titles.filter(t => t.title.startsWith(k.heading))
      out.findings.push({ level: 'warning', rule: 'checklist-heading', file: k.file, ...(near.length ? { line: near[0].line } : {}),
        message: `the checklist "${k.heading}" matches no ## heading whole, so its lines are not read` +
          (near.length ? `; ${near.map(t => `"${t.title}"`).join(', ')} starts with it: write the heading whole in the settings` : '') })
    }
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
    if (p) out.whereWeAre = { file: w.file, line: p.line, text: p.text, date: p.text.match(new RegExp(DATE, 'g'))?.filter(d => !upTo || d <= upTo).sort().pop() ?? null }
  }
  return out
}

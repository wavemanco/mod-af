import type { BuildInput, BuildOutput, Facts, Finding } from './types.ts'
import { parseFiles } from './parse.ts'
import { computeFacts } from './facts.ts'
import { computeLanes } from './lanes.ts'
import { historyFrom } from './history.ts'
import { findingsFor } from './findings.ts'
import { pageData, renderPage } from './page.ts'
import { brief } from './brief.ts'
import { maskPrivacy, scanPrivacy } from './privacy.ts'

export function partitionLine(f: Facts): string {
  const c = f.counts
  return `${c.all} rows in all = ${c.closed} closed + ${c.open} open; open = ${c.yes} land now + ${c.choice} small choice + ${c.no} not now; ${c.perFile.backlog.open} open in the backlog, ${c.perFile.playbook.open} in the playbook`
}

export function build(i: BuildInput): BuildOutput {
  const parsed = parseFiles(i.settings, i.files, i.head.date.slice(0, 10))
  const facts = computeFacts(i.settings, parsed)
  const lanes = computeLanes(i.settings, parsed, facts)
  // a commit subject cannot be edited, so a hit there is masked; a hit in the files still blocks the page
  const history = historyFrom(i.snapshots).map(e => ({ ...e, subject: maskPrivacy(e.subject) }))
  const findings: Finding[] = findingsFor(i.settings, parsed, facts, lanes, history)
  const data = pageData(i.settings, i.head, parsed, facts, lanes, history, findings)
  let html: string | null = renderPage(data)
  const hits = scanPrivacy(html)
  if (hits.length) {
    // name the rows whose own cells hold a hit, then the other texts by file and line
    const dirty = (t: string) => scanPrivacy(t).length > 0
    const places = [
      ...parsed.rows.filter(r => dirty(JSON.stringify(r))).map(r => r.id),
      ...(parsed.whereWeAre && dirty(parsed.whereWeAre.text) ? [`${parsed.whereWeAre.file} line ${parsed.whereWeAre.line}`] : []),
      ...parsed.done.filter(d => dirty(d.cells.join(' '))).map(d => `${d.file} line ${d.line}`),
      ...parsed.checklists.filter(c => dirty(c.text)).map(c => `${c.file} line ${c.line}`),
    ]
    for (const id of places.length ? places : [`the page (${hits[0].sample})`])
      findings.push({ level: 'error', rule: 'privacy', message: `${id}: holds a personal address or a key-shaped string` })
  }
  // ASCII page, so length is bytes
  if (html && html.length > 1_000_000)
    findings.push({ level: 'warning', rule: 'page-size', message: `the page is ${html.length} bytes, over the 1,000,000 it should stay under` })
  if (findings.some(f => f.level === 'error')) html = null
  return { parsed, facts, lanes, history, findings, data, html, brief: brief(data, {}), partition: partitionLine(facts) }
}

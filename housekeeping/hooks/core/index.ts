import type { BuildInput, BuildOutput, Facts, Finding } from './types.ts'
import { parseFiles } from './parse.ts'
import { computeFacts } from './facts.ts'
import { computeLanes } from './lanes.ts'
import { historyFrom } from './history.ts'
import { findingsFor } from './findings.ts'
import { pageData, renderPage } from './page.ts'
import { brief } from './brief.ts'
import { scanPrivacy } from './privacy.ts'

export function partitionLine(f: Facts): string {
  const c = f.counts
  return `${c.all} rows in all = ${c.closed} closed + ${c.open} open; open = ${c.yes} land now + ${c.choice} small choice + ${c.no} not now; ${c.perFile.backlog.open} open in the backlog, ${c.perFile.playbook.open} in the playbook`
}

export function build(i: BuildInput): BuildOutput {
  const parsed = parseFiles(i.settings, i.files)
  const facts = computeFacts(i.settings, parsed)
  const lanes = computeLanes(i.settings, parsed, facts)
  const history = historyFrom(i.snapshots)
  const findings: Finding[] = findingsFor(i.settings, parsed, facts, lanes, history)
  const data = pageData(i.settings, i.head, parsed, facts, lanes, history, findings)
  let html: string | null = renderPage(data)
  const hits = scanPrivacy(html)
  if (hits.length) {
    // name the rows whose own cells hold a hit; "the page" when only other text does
    const rows = parsed.rows.filter(r => scanPrivacy(JSON.stringify(r)).length > 0).map(r => r.id)
    for (const id of rows.length ? rows : ['the page'])
      findings.push({ level: 'error', rule: 'privacy', message: `${id}: holds a personal address or a key-shaped string` })
  }
  if (findings.some(f => f.level === 'error')) html = null
  return { parsed, facts, lanes, history, findings, data, html, brief: brief(data, {}), partition: partitionLine(facts) }
}

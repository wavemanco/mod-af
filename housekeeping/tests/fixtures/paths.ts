const head = '| ID | Item | Priority | Milestone | Who | Land now | Trigger | Waits on |\n|---|---|---|---|---|---|---|---|\n'
const row = (id: string, ms: string, land: string, waits: string) =>
  `| ${id} | Item ${id} | medium | ${ms} | agent | ${land} | When ready. | ${waits} |\n`

// `done` ids move to the Done table; `over` replaces a row's Waits on
export const backlog = (done: string[] = [], over: Record<string, string> = {}) => {
  const rows: [string, string, string, string][] = [
    ['C-001', 'core-ready', 'yes', '—'], ['C-002', 'core-ready', 'no: needs C-001', 'C-001'],
    ['H-001', 'host-beta', 'no: needs C-002', 'C-002'], ['S-001', 'school-pilot', 'yes', '—'],
    ['L-001', 'solo-launch, host-beta', 'yes', '—'], ['X-001', 'stray', 'yes', '—']]
  const open = rows.filter(r => !done.includes(r[0]))
    .map(r => row(r[0], r[1], r[2], over[r[0]] ?? r[3])).join('')
  return `# Backlog\n\n## Work\n\n${head}${open}\n## Done since the last map\n\n| Item | Landed | Its row |\n|---|---|---|\n` +
    done.map(d => `| Finished (${d}) | 2026-10-01 | Closed |\n`).join('')
}
export const playbook = '# Playbook\n'

export const settings = JSON.stringify({ version: 1, project: 'Paths', files: { backlog: { path: 'backlog.md', skipSections: ['Done since'] }, playbook: { path: 'playbook.md' } },
  columns: { id: 'ID', item: 'Item', milestone: 'Milestone', who: 'Who', landNow: 'Land now', trigger: 'Trigger', waitsOn: 'Waits on', priority: 'Priority' },
  values: { priority: ['high', 'medium', 'low'] },
  ids: ['[CHSLX]-\\d{3}'],
  done: [{ file: 'backlog', sectionPrefix: 'Done since', idColumn: 0, landedColumn: 1 }],
  paths: [
    { name: 'core', shared: true, milestones: [{ name: 'core-ready' }] },
    { name: 'host', milestones: [{ name: 'host-beta' }] },
    { name: 'school', milestones: [{ name: 'school-pilot' }] },
    { name: 'solo', milestones: [{ name: 'solo-launch' }] }],
  checklists: [] })

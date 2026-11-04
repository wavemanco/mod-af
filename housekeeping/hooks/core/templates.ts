// The files /housekeeping init writes into a new repository.
const COLUMNS = ['ID', 'Item', 'Priority', 'Milestone', 'Who', 'Land now', 'Trigger type', 'Trigger', 'Waits on', 'Details', 'Filed']
const row = (cells: string[]) => `| ${cells.join(' | ')} |\n|${cells.map(() => '---').join('|')}|\n`
const OPEN = `## Open\n\n${row(COLUMNS)}`
const DONE = `## Done\n\n${row(['ID', 'Item', 'Milestone', 'Landed'])}`

const BACKLOG = `# Backlog

Work done in the repository: code, tests, prompts, docs, records, and the decisions whose answer is such a change.
A commit closes a backlog row. What happens outside the repository is in the playbook.

## How this file is kept

A row is a line of the Open table. Its ID and Item are written once; Details is written once and added to.
Milestone, Who, Land now, Trigger and Waits on are kept true as things change.
Land now is \`yes\`, \`small choice: <the owner's one choice>\` or \`no: <what it needs>\`.
A trigger is the step that, once it has happened, brings the row back. Write it in plain words.
When a row closes, it moves to the Done table with the day or commit it landed. It keeps its ID.

## Where we are

A new backlog: nothing is filed yet.

${OPEN}
${DONE}`

const PLAYBOOK = `# Playbook

What happens outside the repository: people and roles; accounts, keys, money, budgets and quotes; legal matters;
service and GitHub settings; live runs; standing duties; and milestones. An act in the world closes a playbook row.
Work done in the repository is in the backlog.

${OPEN}
${DONE}`

export function initFiles(project: string, mainBranch: string): { path: string; content: string }[] {
  const done = (file: string) => ({ file, sectionPrefix: 'Done', idColumn: 0, landedColumn: 3, milestoneColumn: 2 })
  const settings = {
    version: 1, project, mainBranch,
    files: { backlog: { path: 'docs/backlog.md' }, playbook: { path: 'docs/playbook.md' } },
    columns: { id: 'ID', item: 'Item', priority: 'Priority', milestone: 'Milestone', who: 'Who', landNow: 'Land now',
      triggerType: 'Trigger type', trigger: 'Trigger', waitsOn: 'Waits on', details: 'Details', filed: 'Filed' },
    ids: ['[A-Z]+-\\d+'],
    done: [done('backlog'), done('playbook')],
    paths: [{ name: project, milestones: [] }],
    whereWeAre: { file: 'backlog', heading: 'Where we are' },
  }
  return [
    { path: 'docs/backlog.md', content: BACKLOG },
    { path: 'docs/playbook.md', content: PLAYBOOK },
    { path: '.housekeeping.json', content: JSON.stringify(settings, null, 2) + '\n' },
    { path: '.gitignore', content: '.housekeeping/\n' },
  ]
}

export const backlog = String.raw`# Backlog

## Plan to all clear

1. Ship the export: B-001, then B-002 (B-004 is closed).

## Launch checklist

### Before the beta

- [x] **Owner.** Merge the export branch. *Settles:* B-004.
- [ ] **Agent.** Rate-limit the export endpoint.
  *Settles:* B-001.
- [ ] **Owner.** Book the beta testers. *Settles:* PB-01.

## Product work

| ID | Item | Status | Priority | Milestone | Who | Land now | Size | Kind | Trigger type | Trigger | Waits on | Details | Files | Filed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B-001 | Rate-limit the export endpoint | open | high | beta | agent | yes | S | fix | milestone | Before the beta. | — | **Why:** one client can exhaust it (a \| b). | src/export.ts | 2026-09-01 |
| B-002 | CSV export of reports | partly | high | beta, launch | both | no: the beta's feedback | M | build | other-row | Once the testers are booked (PB-01). | PB-01 | **Why:** asked for twice. | src/csv/ | 2026-09-02 |
| B-003 | Pick a chart library | open | low | launch | agent | small choice: keep the current library or switch | S | research-decision | owner-decision | When the owner picks one. | — | **Why:** two candidates. | — | 2026-09-03 |
| B-005 | Tidy the build scripts | open | low | none | agent | yes | S | chore | now | Whenever an agent picks it up. | — | **Why:** slow builds. | scripts/ | 2026-09-04 |

## Done since the last map

| Item | Where it landed | Its row |
|---|---|---|
| Merge the export branch (B-004) | 1a2b3c4 | Closed |
| Sign the hosting contract (PB-02) | 2026-09-10 | Closed |
`

export const playbook = String.raw`# Playbook

## 1. People and roles

| ID | Item | Status | Priority | Milestone | Who | Land now | Size | Kind | Trigger type | Trigger | Waits on | Details | Files | Filed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PB-01 | Book five beta testers | open | medium | beta | owner | no: the owner's outreach | S | outside-action | event | When the invite list is ready. | — | **Why:** the beta needs users. | — | 2026-09-05 |

## 2. Outside actions

| ID | Item | Status | Priority | Milestone | Who | Land now | Size | Kind | Trigger type | Trigger | Waits on | Details | Files | Filed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PB-03 | Renew the domain | open | medium | none | owner | no: the renewal notice | S | outside-action | event | When the renewal notice arrives. | — | **Why:** the domain lapses otherwise. | — | 2026-09-06 |
`

export const settings = JSON.stringify({ version: 1, project: 'Small', files: { backlog: { path: 'backlog.md', skipSections: ['Plan to all clear', 'Launch checklist', 'Done since'] }, playbook: { path: 'playbook.md' } },
  columns: { id: 'ID', item: 'Item', milestone: 'Milestone', who: 'Who', landNow: 'Land now', trigger: 'Trigger', waitsOn: 'Waits on', details: 'Details', filed: 'Filed', priority: 'Priority', triggerType: 'Trigger type' },
  values: { priority: ['high', 'medium', 'low'], triggerType: ['now', 'event', 'other-row', 'owner-decision', 'milestone'] },
  ids: [String.raw`B-\d{3}`, String.raw`PB-\d{2}`],
  done: [{ file: 'backlog', sectionPrefix: 'Done since', idColumn: 0, landedColumn: 1, fileByIdPrefix: { playbook: 'PB-' } }],
  paths: [{ name: 'product', milestones: [{ name: 'beta' }, { name: 'launch' }] }],
  whereWeAre: { file: 'backlog', heading: 'Plan to all clear' },
  checklists: [{ file: 'backlog', heading: 'Launch checklist', milestone: 'beta' }] })

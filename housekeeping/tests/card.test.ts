import { expect, test } from 'claude-code/testing'
import { card } from '../hooks/core/card.ts'
import { parseSettings } from '../hooks/core/settings.ts'
import * as small from './fixtures/small.ts'

const settingsOf = (extra: object = {}) => parseSettings(JSON.stringify({ ...JSON.parse(small.settings), ...extra })).settings!

// the lines every card holds, word for word (Phase 3 plan, Task 1)
const LINES = [
  'Before filing, find the highest ID of each pattern in both files, Done tables included, and take the next.',
  'A decision updates the row it settles.',
  'Never read either records file whole: find rows with Grep, then Read only those lines (offset and limit) before an Edit.',
  'After committing, ask the person to run /housekeeping check once the change reaches main.',
]

test('the records card names the two files with the commit test, the columns, the ID patterns, the not-doing table and the decisions folder', () => {
  const c = card(settingsOf({ notDoing: { file: 'playbook', heading: 'Not doing' }, decisions: 'docs/decisions', duties: { triggerPrefix: 'Each' } }))
  expect(c).toContain('The commit test: a row a commit closes goes in the backlog, backlog.md; a row an act in the world closes goes in the playbook, playbook.md.')
  expect(c).toContain('Columns (role "header"): id "ID", item "Item", priority "Priority", milestone "Milestone", who "Who", landNow "Land now", ' +
    'triggerType "Trigger type", trigger "Trigger", waitsOn "Waits on", details "Details", filed "Filed".')
  expect(c).toContain('ID patterns: B-\\d{3}, PB-\\d{2}.')
  expect(c).toContain('Decisions folder: docs/decisions.')
  expect(c).toContain('An item dropped goes to the not-doing table: "Not doing" in playbook.md.')
  expect(c).toContain("A trigger is a step that has happened, never a date; a Trigger starting with 'Each' is a standing duty, for work that recurs only.")
  for (const l of LINES) expect(c.split('\n')).toContain(l)
})

test('with no not-doing table and no decisions folder set, the card says none set', () => {
  const c = card(settingsOf())
  expect(c).toContain('An item dropped goes to the not-doing table: none set.')
  expect(c).toContain('Decisions folder: none set.')
  expect(c).toContain("a Trigger starting with 'Every' is a standing duty")
  for (const l of LINES) expect(c.split('\n')).toContain(l)
})

test('the records card is masked', () => {
  const c = card(settingsOf({ decisions: 'docs/jane.doe@gmail.com', ids: ['sk-ant-FAKEFAKEFAKEFAKEFAKEFAKE'] }))
  expect(c).not.toContain('jane.doe@gmail.com')
  expect(c).not.toContain('FAKEFAKEFAKE')
})

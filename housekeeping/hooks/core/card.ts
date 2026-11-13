import type { Settings } from './types.ts'
import { maskPrivacy } from './privacy.ts'

const ROLES = ['id', 'item', 'priority', 'milestone', 'who', 'landNow', 'triggerType', 'trigger', 'waitsOn', 'details', 'filed'] as const

// The records card (Phase 3 call 9): what an agent filing into the two files needs, from the settings alone. It goes
// to the agent beside the short view, and after `node cli.ts brief`; masked, as the view is.
export function card(s: Settings): string {
  const notDoing = s.notDoing ? `"${s.notDoing.heading}" in ${s.files[s.notDoing.file].path}` : 'none set'
  return maskPrivacy([
    `The commit test: a row a commit closes goes in the backlog, ${s.files.backlog.path}; a row an act in the world closes goes in the playbook, ${s.files.playbook.path}.`,
    `Columns (role "header"): ${ROLES.filter(k => s.columns[k]).map(k => `${k} "${s.columns[k]}"`).join(', ')}.`,
    `ID patterns: ${s.ids.join(', ')}.`,
    `Decisions folder: ${s.decisions ?? 'none set'}.`,
    'Before filing, find the highest ID of each pattern in both files, Done tables included, and take the next.',
    `A trigger is a step that has happened, never a date; a Trigger starting with '${s.duties.triggerPrefix}' is a standing duty, for work that recurs only.`,
    `An item dropped goes to the not-doing table: ${notDoing}.`,
    'A decision updates the row it settles.',
    'Never read either records file whole: find rows with Grep, then Read only those lines (offset and limit) before an Edit.',
    'After committing, ask the person to run /housekeeping check once the change reaches main.',
  ].join('\n'))
}

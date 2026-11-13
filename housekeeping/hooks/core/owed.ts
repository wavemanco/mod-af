// owed (Phase 3, DESIGN 3.9): what a range of commits owes the records, a pure function of what git gave for its base and
// head, with no clock (call 1). The routes read (adapter.ts's readOwed); this module parses and lists.
import type { Row } from './types.ts'

// The audit's start (Phase 3 call 2): the playbook duty row whose Trigger holds "/housekeeping audit" (the first, with a
// warning, if there are more), its latest "Last done: YYYY-MM-DD, through <sha>", where the sha is one commit of main's
// first-parent line (so git verifies it and it is an ancestor of main); else the commit that added the settings; else the
// root. At most 50 first-parent commits after the start are read: head is the range's last commit, the one Last done
// moves through. base null: the range starts at the root.
const AUDIT = '/housekeeping audit'
const THROUGH = /Last done:(?:\*\*)?\s*(\d{4}-\d{2}-\d{2}), through ([0-9a-f]{7,64})\b/gi
export function auditStart(rows: Row[], settingsCommit: string | null, firstParents: string[]): { base: string | null; head: string; warnings: string[] } {
  const duty = rows.filter(x => x.file === 'playbook' && x.trigger.includes(AUDIT)), warnings: string[] = []
  if (duty.length > 1) warnings.push(`more than one playbook row's Trigger holds "${AUDIT}" (${duty.map(x => x.id).join(', ')}): the first, ${duty[0].id}, is read`)
  // the latest by its day, the later in the text on a tie
  const through = [...(duty[0]?.details ?? '').matchAll(THROUGH)].sort((a, b) => a[1].localeCompare(b[1])).at(-1)?.[2].toLowerCase()
  const on = through ? firstParents.filter(c => c.startsWith(through)) : []
  if (through && on.length !== 1) warnings.push(`${duty[0].id}'s Last done names ${through}, which is not one commit of the main branch's first-parent line, so it is not the start`)
  const start = on.length === 1 ? on[0] : settingsCommit && firstParents.includes(settingsCommit) ? settingsCommit : null
  const read = firstParents.slice(start ? firstParents.indexOf(start) + 1 : 0).slice(0, 50)
  return { base: start, head: read.at(-1) ?? start ?? firstParents.at(-1)!, warnings }
}

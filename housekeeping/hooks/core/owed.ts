// owed (Phase 3, DESIGN 3.9): what a range of commits owes the records, a pure function of what git gave for its base and
// head, with no clock (call 1). The routes read (adapter.ts's readOwed); this module parses and lists.
import type { Row } from './types.ts'

// a token's match on an added or removed line, numbered on its own side
export type Hit = { token: string; path: string; line: number; removed: boolean }

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const W = '\\p{L}\\p{N}_'

// The code-name rule (FORMAT, "Code names in a Trigger"): a backticked span, or a word that holds "/" or ends in "." and
// letters once the punctuation around it is dropped; a slash command is none
const SLASH = /^\/[^/\s]+(?:\s|$)/
export function tokens(trigger: string): string[] {
  const words = trigger.replace(/`[^`]*`/g, ' ').split(/\s+/).map(w => w.replace(/^[("'[{<]+|[)"'\]}>,;:!?.]+$/g, ''))
    .filter(w => w.includes('/') || /\.\p{L}+$/u.test(w))
  const all = [...[...trigger.matchAll(/`([^`]+)`/g)].map(m => m[1].trim()), ...words].map(t => t.replace(/^\.\//, ''))
  return [...new Set(all.filter(t => t && !SLASH.test(t)))]
}

// git's C-style quoting of a name, where core.quotePath=false leaves it (a quote, a backslash or a control character)
const unquote = (q: string) => !q.startsWith('"') ? q : q.slice(1, -1).replace(/\\([0-7]{3}|.)/g, (_, c: string) =>
  c.length === 3 ? String.fromCharCode(parseInt(c, 8)) : ({ t: '\t', n: '\n', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v' } as Record<string, string>)[c] ?? c)

/** git diff -U0's added and removed lines that hold a token as a whole word; header lines are not content. */
export function scanDiff(out: string, toks: string[]): Hit[] {
  const res = toks.map(t => [t, new RegExp(`(?<![${W}])${esc(t)}(?![${W}])`, 'u')] as const), hits: Hit[] = []
  let path = '', head = true, old = 0, now = 0
  for (const l of out.split('\n')) {
    if (l.startsWith('diff --git ')) { head = true; path = ''; continue }
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l)
    if (h) { head = false; old = +h[1]; now = +h[2]; continue }
    if (head) {
      // the new side's name, else the old one's (a deleted file); a name with a space ends in a tab
      const n = /^(?:---|\+\+\+) (.*)$/.exec(l)?.[1].replace(/\t$/, '')
      if (n && n !== '/dev/null') path = unquote(n).slice(2)
      continue
    }
    if (l[0] !== '+' && l[0] !== '-') continue
    const removed = l[0] === '-', line = removed ? old++ : now++
    for (const [token, re] of res) if (l.includes(token) && re.test(l.slice(1))) hits.push({ token, path, line, removed })
  }
  return hits
}

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

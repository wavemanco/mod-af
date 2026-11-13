// owed (Phase 3, DESIGN 3.9): what a range of commits owes the records, a function of what git gave for its base, its
// head and main's tip, with no clock (call 1). The routes read (adapter.ts's readOwed); this module parses and lists.
import type { FileKey, Row, Settings } from './types.ts'
import { historyFrom, snapshot } from './history.ts'
import { idsIn, parseFiles } from './parse.ts'
import { maskPrivacy } from './privacy.ts'
import { SHELL_SAFE } from './survey.ts'

type Files = Record<FileKey, string | null>
export type Commit = { sha: string; subject: string; body: string }
// a token's match on an added or removed line, numbered on its own side
export type Hit = { token: string; path: string; line: number; removed: boolean }
// What the routes read for a range: the records at its base, its head and main's tip (null where main's tip is in the
// range or does not resolve); its commits and each one's changed paths; the range's changed paths, both sides of a
// rename; the paths the Read rules deny; the hits in the allowed paths' changed lines; how many paths were not read
export type OwedRead = { base: string; head: string; files: { base: Files; head: Files; main: Files | null }; commits: Commit[];
  paths: Record<string, string[]>; changed: string[]; denied: string[]; hits: Hit[]; notRead: number; notes: string[] }

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
// duty rows are left out: their trigger is a period, not a step
const watched = (s: Settings, rows: Row[]) => rows.filter(r => !r.trigger.startsWith(s.duties.triggerPrefix))
  .map(row => ({ row, tokens: tokens(row.trigger) })).filter(w => w.tokens.length)
/** The tokens the head's open rows wait on, to look for in the changed lines. */
export const watchFor = (s: Settings, head: Files): string[] => [...new Set(watched(s, parseFiles(s, head).rows).flatMap(w => w.tokens))]
const onPath = (t: string, path: string) => path === t || path.endsWith(`/${t}`)

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

// git diff --name-status -z: a status, then one path, or two for a rename or a copy, both kept; an entry cut short is left out
export function parseNames(out: string): string[] {
  const t = out.split('\0'), paths: string[] = []
  t.pop()
  for (let i = 0; i < t.length;) {
    const n = /^[RC]/.test(t[i]) ? 2 : 1
    if (i + n >= t.length) break
    paths.push(...t.slice(i + 1, i + 1 + n))
    i += 1 + n
  }
  return [...new Set(paths)]
}

// git log -z --name-status --format=%H: each commit's sha (a merge's with no paths), then its statuses and paths
export function parseCommitPaths(out: string): Record<string, string[]> {
  const t = out.split('\0').map(x => x.replace(/^\n/, '')), got: Record<string, string[]> = {}
  t.pop()
  let sha = ''
  for (let i = 0; i < t.length;) {
    if (/^[0-9a-f]{40,64}$/.test(t[i])) { sha = t[i++]; got[sha] = []; continue }
    const n = /^[RC]/.test(t[i]) ? 2 : 1
    if (i + n >= t.length) break
    got[sha]?.push(...t.slice(i + 1, i + 1 + n))
    i += 1 + n
  }
  return got
}

// git log -z --format=%H%x09%s%x00%b: sha and subject, then the body; with the log cut short, its last commit is left out
export function parseCommits(out: string, cut: boolean): Commit[] {
  const t = out.split('\0'), got: Commit[] = []
  for (let i = 0; i + 1 < t.length; i += 2) {
    const [sha, ...subject] = t[i].replace(/^\n/, '').split('\t')
    got.push({ sha, subject: subject.join('\t'), body: t[i + 1] })
  }
  if (cut) got.pop()
  return got
}

// trailer lines (Key: value at the body's end) are dropped before matching
const untrailed = (body: string) => {
  const l = body.trimEnd().split('\n')
  while (l.length && /^[A-Za-z][\w-]*:\s/.test(l.at(-1)!)) l.pop()
  return l.join('\n')
}
// the closing words, any case, next to the ID on either side
const CLOSING = '(?:close[sd]?|fix(?:e[sd])?|done|land(?:s|ed)?|resolve[sd]?)'
const closing = (text: string, id: string) => new RegExp(`(?<![${W}])${CLOSING}[^\\p{L}\\p{N}]{1,3}${esc(id)}(?![${W}])|` +
  `(?<![${W}-])${esc(id)}[^\\p{L}\\p{N}]{1,3}${CLOSING}(?![${W}])`, 'iu').test(text)

const MARK = ' (a shell can read this path as commands: put it in no command)'
// each entry on its own line: a control character or a line or paragraph separator is written as \uXXXX
const oneLine = (t: string) => t.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
const marked = (p: string) => SHELL_SAFE.test(p) ? '' : MARK
const shown = (p: string) => oneLine(p) + marked(p)
// a denied path that a subject names whole is hidden, and a longer name that holds it is not
// shortcut: a part of it, such as its file name alone, still shows; widen it if the owner's sitting shows the need
const P = '\\p{L}\\p{N}_/-'
const hider = (denied: Set<string>) => [...denied].sort((a, b) => b.length - a.length)
  .map(p => new RegExp(`(?<![.${P}])${esc(p)}(?![${P}]|\\.[${P}])`, 'gu'))

/** The listing: what the range owes the records. Evidence never holds a line's text, an author or a trailer; masked. */
export function owed(s: Settings, r: OwedRead): string {
  const head = parseFiles(s, r.files.head), base = parseFiles(s, r.files.base)
  const denied = new Set(r.denied), allowed = r.changed.filter(p => !denied.has(p))
  const item = new Map([...base.rows, ...head.rows].map(x => [x.id, x.item]))
  const open = new Set(head.rows.map(x => x.id))
  const row = (id: string) => `- ${id} ${item.get(id) ?? ''}`.trimEnd()

  const fired = watched(s, head.rows).flatMap(({ row: w, tokens: ts }) => {
    const said = ts.flatMap(t => {
      const at = [...r.hits.filter(h => h.token === t).map(h => `${oneLine(h.path)} ${h.removed ? 'removed ' : ''}line ${h.line}${marked(h.path)}`),
        ...allowed.filter(p => onPath(t, p)).map(shown)]
      return at.length ? [`\`${t}\` matched ${at[0]}${at.length > 1 ? ` and ${at.length - 1} more` : ''}`] : []
    })
    return said.length ? [{ id: w.id, text: `${row(w.id)}: ${said.join('; ')}` }] : []
  })

  const named = new Map<string, string[]>(), listed = new Set<string>(), hide = hider(denied)
  const subject = (t: string) => oneLine(hide.reduce((x, re) => x.replace(re, '[a path the Read rules deny]'), t))
  for (const c of r.commits) {
    const body = untrailed(c.body), inSubject = idsIn(c.subject, s)
    for (const id of new Set([...inSubject, ...idsIn(body, s)])) {
      if (!open.has(id)) continue
      listed.add(c.sha)
      const close = closing(c.subject, id) || closing(body, id) ? '; a closing word is next to the ID' : ''
      named.set(id, [...(named.get(id) ?? []), `  - ${c.sha.slice(0, 7)} ${subject(c.subject)} (in the ${inSubject.includes(id) ? 'subject' : 'body'}${close})`])
    }
  }
  const paths = r.commits.filter(c => listed.has(c.sha)).map(c => {
    const all = r.paths[c.sha] ?? [], ok = all.filter(p => !denied.has(p))
    return `- ${c.sha.slice(0, 7)}: ${ok.map(shown).join(', ') || 'none'}${all.length > ok.length ? `; ${all.length - ok.length} excluded` : ''}`
  })
  const ids = new Set([...fired.map(f => f.id), ...named.keys()])
  const checks = head.checklists.filter(c => c.ids.some(id => ids.has(id)))
    .map(c => `- ${s.files[c.file].path}:${c.line} [${c.ticked ? 'x' : ' '}] ${c.ids.join(', ')}`)

  const atBase = snapshot(s, r.files.base)
  const [, d] = historyFrom([{ ...atBase, sha: r.base, date: '', subject: '' }, { ...snapshot(s, r.files.head), sha: r.head, date: '', subject: '' }])
  const tip = r.files.main ? snapshot(s, r.files.main) : null
  const taken = d.opened.flatMap(id => tip && (id in tip.open || tip.closed.includes(id)) ? [`- ${id}: main's tip holds it`]
    : atBase.closed.includes(id) ? [`- ${id}: the base holds it in a Done table`] : [])

  const part = (title: string, lines: string[]) => [title, ...(lines.length ? lines : ['none'])]
  return maskPrivacy([
    `housekeeping owed: ${r.base.slice(0, 7)}..${r.head.slice(0, 7)}, ${r.commits.length} commits, ${r.changed.length} changed paths` +
      `${denied.size ? `; ${denied.size} excluded by the Read rules, never read or named` : ''}${r.notRead ? `; ${r.notRead} not read (cut short or unreadable)` : ''}`,
    ...r.notes,
    ...part('Rows whose Trigger fired:', fired.map(f => f.text)),
    ...part('Rows the commits name by ID:', [...named].flatMap(([id, l]) => [row(id), ...l])),
    ...part('Paths of those commits that the Read rules allow:', paths),
    ...part('Checklist lines that name these rows:', checks),
    ...part('Rows gone over the range (open at the base, absent at the head, in no Done table):', d.gone.map(row)),
    ...part('Rows already settled (moved to Done at the head):', d.closed.map(row)),
    ...part('IDs the branch adds that are already taken:', taken),
    `Last commit read: ${r.head}`,
  ].join('\n'))
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

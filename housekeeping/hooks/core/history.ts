import type { CommitInfo, FileKey, Finding, HistoryEntry, Settings, Snapshot } from './types.ts'
import { parseFiles } from './parse.ts'

// --end-of-options before each revision, so none is ever read as an option; --no-show-signature, so a
// log.showSignature setting never puts gpg lines among the commits (finding 14); "--" after the head's revision,
// so a file named like the branch is not ambiguous (finding 28)
export const headArgs = (main: string): string[] => ['git', 'log', '-1', '--no-show-signature', '--format=%H%x09%cs%x09%s', '--end-of-options', main, '--']

// exits 1 where the repository opens and the name does not resolve, 128 where git cannot open it (finding 28)
export const resolveArgs = (main: string): string[] => ['git', 'rev-parse', '--verify', '--quiet', '--end-of-options', `${main}^{commit}`]

export const logArgs = (s: Settings): string[] =>
  ['git', 'log', '--first-parent', '--reverse', '--no-show-signature', '--format=%H%x09%cs%x09%s', '--end-of-options', s.mainBranch, '--', `:(literal)${s.files.backlog.path}`, `:(literal)${s.files.playbook.path}`]

// git takes a shallow clone's boundary for a root that touched every file, so no history is read there (finding 13)
export const SHALLOW = ['git', 'rev-parse', '--is-shallow-repository']
export const SHALLOW_WARNING: Finding = { level: 'warning', rule: 'shallow',
  message: 'this clone is shallow: it holds part of the history, so none was read (history, Changed since and First seen need a full clone)' }

export const showArgs = (sha: string, path: string): string[] => ['git', 'show', '--end-of-options', `${sha}:${path}`]

// git runs with lazy fetching off: a partial clone is never fetched into (DESIGN 3.4: "never fetches")
export const NO_FETCH = { GIT_NO_LAZY_FETCH: '1' }

// owed's reads (Phase 3), each run with OWED_ENV: no optional locks, so no index refresh is written, and no lazy fetch.
// --end-of-options before every revision; --no-color, so a color setting never reaches a parser.
export const OWED_ENV = { GIT_OPTIONAL_LOCKS: '0', ...NO_FETCH }
export const mergeBaseArgs = (a: string, b: string): string[] => ['git', 'merge-base', '--end-of-options', a, b]
export const ancestorArgs = (a: string, b: string): string[] => ['git', 'merge-base', '--is-ancestor', '--end-of-options', a, b]
// git's empty tree, where an audit from the root starts (Task 3): no merge base, the diffs compare it with the head and
// the logs read all the head holds. shortcut: a SHA-1 repository's; a SHA-256 one names another empty tree, so an
// audit from its root fails at git, said; take git hash-object -t tree of nothing if one is asked for
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const diffSpan = (base: string, head: string) => base === EMPTY_TREE ? [base, head] : [`${base}...${head}`]
const logSpan = (base: string, head: string) => base === EMPTY_TREE ? [head] : [`${base}..${head}`]
// the range's changed paths, both sides of a rename
export const namesArgs = (base: string, head: string): string[] =>
  ['git', 'diff', '--name-status', '-M', '-z', '--no-color', '--end-of-options', ...diffSpan(base, head), '--']
// every commit of the range, merged branches' too: the subject and the body; no author is asked for
export const commitsArgs = (base: string, head: string): string[] =>
  ['git', 'log', '-z', '--no-show-signature', '--no-color', '--format=%H%x09%s%x00%b', '--end-of-options', ...logSpan(base, head), '--']
// each commit's changed paths
export const pathsArgs = (base: string, head: string): string[] =>
  ['git', 'log', '-z', '--name-status', '-M', '--no-show-signature', '--no-color', '--format=%H', '--end-of-options', ...logSpan(base, head), '--']
// the added and removed lines of the paths named: no external diff or textconv runs a program, the prefixes are fixed
// whatever the settings say, and a name is quoted only where git must
export const hunksArgs = (base: string, head: string, paths: string[]): string[] =>
  ['git', '-c', 'core.quotePath=false', 'diff', '-U0', '-M', '--no-color', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/',
    '--end-of-options', ...diffSpan(base, head), '--', ...paths.map(p => `:(literal)${p}`)]

// the audit's start (Phase 3 call 2): main's first-parent line, oldest first, and the commit on it that added the
// settings (a merge that brought them in, where they came from a branch)
export const firstParentArgs = (main: string): string[] => ['git', 'rev-list', '--first-parent', '--reverse', '--end-of-options', main, '--']
export const addedArgs = (main: string): string[] =>
  ['git', 'log', '--first-parent', '--diff-filter=A', '-1', '--no-show-signature', '--format=%H', '--end-of-options', main, '--', ':(literal).housekeeping.json']
// After a failed show: exits 0 when the commit's tree names the path, so its blob is one this clone does not hold
// and the file is not missing (a tied minor of the Phase 2 check); the tree alone answers it, no blob is read.
export const blobArgs = (sha: string, path: string): string[] => ['git', 'rev-parse', '--verify', '--quiet', '--end-of-options', `${sha}:${path}`]
// The stop names the cure, which the person runs (second check, finding 18: the owner's "Keep the stop, add next step").
// -m --first-parent fetches each version the walk reads, a merge's own included, on any checkout (HK-087); the
// settings' names go into the command only when no shell can read them as more than a word (HK-087)
const plain = (...names: string[]) => names.every(n => /^[\w./-]+$/.test(n))
export const unreadable = (s: Settings, sha: string, path: string, said: string): string => {
  const { mainBranch: m, files: { backlog: { path: b }, playbook: { path: p } } } = s
  return `cannot read ${path} at ${sha.slice(0, 7)}, which this clone does not hold: housekeeping never fetches (git said: ${said}). ` +
    (plain(m, b, p)
      ? `To fetch the old versions, run git log -p -m --first-parent ${m} -- ${b} ${p}, then run this again.`
      : 'To fetch the old versions, run git log -p -m --first-parent <main branch> -- <backlog> <playbook> with the settings\' names ' +
        'quoted for your shell (one holds characters a shell may run, so they are not printed here), then run this again.')
}
// Main's own files, where the path is not found: a commit whose tree the clone does not hold, in a shallow treeless
// clone with main not checked out, is a stop, never two missing files (HK-088, HK-075)
export const treeArgs = (sha: string): string[] => ['git', 'cat-file', '-e', `${sha}^{tree}`]
export const treeless = (sha: string, path: string): string =>
  `cannot read ${path} at ${sha.slice(0, 7)}, whose tree this clone does not hold: housekeeping never fetches. ` +
  'Checking out the main branch fetches it; then run this again.'
// A history walk that git stops, in a treeless clone say, is a stop, never an empty history (second check, finding 11).
export const historyUnread = (s: Settings, said: string): string =>
  `cannot read the history of ${s.files.backlog.path} and ${s.files.playbook.path} on ${s.mainBranch}: housekeeping never fetches (git said: ${said})`

export function parseLog(stdout: string): CommitInfo[] {
  return stdout.split('\n').filter(l => l.trim()).map(l => {
    const [sha, date, ...rest] = l.split('\t')
    return { sha, date, subject: rest.join('\t') }
  })
}

export function snapshot(s: Settings, files: Record<FileKey, string | null>): Snapshot {
  const p = parseFiles(s, files)
  return { open: Object.fromEntries(p.rows.map(r => [r.id, r.file])), closed: [...new Set(p.done.flatMap(d => d.ids))],
    whereWeAre: p.whereWeAre?.text ?? null }
}

export function historyFrom(snaps: (Snapshot & CommitInfo)[]): HistoryEntry[] {
  const empty: Snapshot = { open: {}, closed: [], whereWeAre: null }
  return snaps.map((n, i) => {
    const o = i ? snaps[i - 1] : empty
    const ids = Object.keys(n.open), was = Object.keys(o.open)
    return { sha: n.sha.slice(0, 7), date: n.date, subject: n.subject,
      opened: ids.filter(id => !(id in o.open)),
      closed: was.filter(id => !(id in n.open) && n.closed.includes(id)),
      gone: was.filter(id => !(id in n.open) && !n.closed.includes(id)),
      moved: ids.filter(id => id in o.open && o.open[id] !== n.open[id]),
      whereWeAre: n.whereWeAre !== o.whereWeAre }
  })
}

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
// After a failed show: exits 0 when the commit's tree names the path, so its blob is one this clone does not hold
// and the file is not missing (a tied minor of the Phase 2 check); the tree alone answers it, no blob is read.
export const blobArgs = (sha: string, path: string): string[] => ['git', 'rev-parse', '--verify', '--quiet', '--end-of-options', `${sha}:${path}`]
export const unreadable = (sha: string, path: string, said: string): string =>
  `cannot read ${path} at ${sha.slice(0, 7)}, which this clone does not hold: housekeeping never fetches (git said: ${said})`

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

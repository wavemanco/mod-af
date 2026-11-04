// The plugin's reads and writes: git through $.process.run, files through the session's own tools.
import type { EngineInterface } from 'claude-code'
import { formatFindings } from './core/findings.ts'
import { headArgs, logArgs, parseLog, showArgs, snapshot } from './core/history.ts'
import { parseSettings } from './core/settings.ts'
import type { BuildInput, CommitInfo, FileKey, Finding, Snapshot } from './core/types.ts'

type Dollar = EngineInterface
export type Read = { input: BuildInput; branch: string; behindRemote: number; findings: Finding[] } | { error: string }

const TIMEOUT = 60_000
const fail = (message: string): { error: string } => ({ error: formatFindings([{ level: 'error', rule: 'git', message }]) })

export async function readInput($: Dollar, root: string, settingsText: string | null): Promise<Read> {
  if (settingsText === null) return { error: 'housekeeping: no .housekeeping.json here (run /housekeeping init)' }
  const { settings, findings } = parseSettings(settingsText)
  if (!settings) return { error: formatFindings(findings) }
  const git = (argv: string[]) => $.process.run(['git', ...argv], { cwd: root, timeoutMs: TIMEOUT })

  const main = settings.mainBranch
  const last = await git(headArgs(main).slice(1))
  if (last.isStdoutTruncated) return fail('git log was cut short')
  const head: CommitInfo | undefined = last.exitCode === 0 ? parseLog(last.stdout)[0] : undefined
  if (!head) return { error: `housekeeping: no branch '${main}' in ${root}` }

  // a null file is a missing one; a cut-short one must not be read as a short one
  const show = async (sha: string, path: string): Promise<string | null | 'cut'> => {
    const r = await git(showArgs(sha, path).slice(1))
    return r.isStdoutTruncated ? 'cut' : r.exitCode === 0 ? r.stdout : null
  }
  const filesAt = async (sha: string): Promise<Record<FileKey, string | null> | 'cut'> => {
    const b = await show(sha, settings.files.backlog.path), p = await show(sha, settings.files.playbook.path)
    return b === 'cut' || p === 'cut' ? 'cut' : { backlog: b, playbook: p }
  }

  const log = await git(logArgs(settings).slice(1))
  if (log.isStdoutTruncated) return fail('git log was cut short')
  const snapshots: (Snapshot & CommitInfo)[] = []
  for (const c of parseLog(log.stdout)) {
    const f = await filesAt(c.sha)
    if (f === 'cut') return fail(`git show was cut short at ${c.sha.slice(0, 7)}`)
    snapshots.push({ ...snapshot(settings, f), ...c })
  }
  const files = await filesAt(head.sha)
  if (files === 'cut') return fail(`git show was cut short at ${head.sha.slice(0, 7)}`)

  const b = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = b.exitCode === 0 ? b.stdout.trim() : main
  let behindRemote = 0
  if ((await git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${main}`])).exitCode === 0) {
    const n = await git(['rev-list', '--count', `${main}..origin/${main}`])
    behindRemote = n.exitCode === 0 ? Number(n.stdout.trim()) || 0 : 0
  }
  return { input: { settings, files, head, snapshots }, branch, behindRemote, findings }
}

export async function repoKey($: Dollar, root: string): Promise<string> {
  const r = await $.process.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, timeoutMs: TIMEOUT })
  return r.exitCode === 0 && r.stdout.trim() ? r.stdout.trim() : root
}

// null on success, else the deny or error text. The Read comes first so the Write tool accepts an overwrite.
export async function writeFile($: Dollar, path: string, content: string): Promise<string | null> {
  const say = (r: { deny?: string; isError?: boolean; text?: string }) => r.deny ?? (r.isError ? r.text ?? 'error' : null)
  try {
    if (await $.fs.exists(path)) {
      const read = say(await $.tool.call({ tool: 'Read', file_path: path }) as never)
      if (read !== null) return read
    }
    return say(await $.tool.call({ tool: 'Write', file_path: path, content }) as never)
  } catch (err) {
    return String(err)
  }
}

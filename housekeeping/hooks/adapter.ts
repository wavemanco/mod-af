// The plugin's reads and writes: git through $.process.run; the settings and the survey's files through $.fs, the
// survey's only where the person's Read rules allow them ($.tool.check, readTracked); every write through the
// session's own tools, except the plugin's own page (writePage).
import type { EngineInterface } from 'claude-code'
import { formatFindings } from './core/findings.ts'
import { blobArgs, headArgs, logArgs, NO_FETCH, parseLog, resolveArgs, SHALLOW, SHALLOW_WARNING, showArgs, snapshot,
  unreadable } from './core/history.ts'
import { parseSettings } from './core/settings.ts'
import { checkNamed, collect, CUT_LIST, type Skipped, type SurveyFile } from './core/survey.ts'
import type { BuildInput, CommitInfo, FileKey, Finding, Snapshot } from './core/types.ts'

type Dollar = EngineInterface
export type Read = { input: BuildInput; branch: string; behindRemote: number; findings: Finding[] } | { error: string }

const TIMEOUT = 60_000
const fail = (message: string): { error: string } => ({ error: formatFindings([{ level: 'error', rule: 'git', message }]) })

export async function readInput($: Dollar, root: string, settingsText: string | null): Promise<Read> {
  if (settingsText === null) return { error: 'housekeeping: no .housekeeping.json here (run /housekeeping init)' }
  const { settings, findings } = parseSettings(settingsText)
  if (!settings) return { error: formatFindings(findings) }
  const git = (argv: string[]) => $.process.run(['git', ...argv], { cwd: root, timeoutMs: TIMEOUT, env: NO_FETCH })

  const main = settings.mainBranch
  const last = await git(headArgs(main).slice(1))
  if (last.isStdoutTruncated) return fail('git log was cut short')
  const head: CommitInfo | undefined = last.exitCode === 0 ? parseLog(last.stdout)[0] : undefined
  if (!head) {
    // "no branch" only where the repository opens and the name does not resolve; otherwise git's words (finding 28)
    const v = await git(resolveArgs(main).slice(1))
    return { error: v.exitCode === 1 ? `housekeeping: no branch '${main}' in ${root} (the "mainBranch" setting in .housekeeping.json)`
      : `housekeeping: cannot read '${main}' in ${root}: git said: ${(last.stderr || v.stderr).split('\n')[0].trim()}` }
  }

  // a null file is a missing one; a cut-short one must not be read as a short one, nor an unreadable one as missing
  const show = async (sha: string, path: string): Promise<string | null | { error: string }> => {
    const r = await git(showArgs(sha, path).slice(1))
    if (r.isStdoutTruncated) return { error: `git show was cut short at ${sha.slice(0, 7)}` }
    if (r.exitCode === 0) return r.stdout
    return (await git(blobArgs(sha, path).slice(1))).exitCode === 0 ? { error: unreadable(sha, path, r.stderr.split('\n')[0].trim()) } : null
  }
  const filesAt = async (sha: string): Promise<Record<FileKey, string | null> | { error: string }> => {
    const b = await show(sha, settings.files.backlog.path), p = await show(sha, settings.files.playbook.path)
    return typeof b === 'object' && b ? b : typeof p === 'object' && p ? p : { backlog: b, playbook: p }
  }

  const shallow = (await git(SHALLOW.slice(1))).stdout.trim() === 'true'
  if (shallow) findings.push(SHALLOW_WARNING)
  const log = shallow ? null : await git(logArgs(settings).slice(1))
  if (log?.isStdoutTruncated) return fail('git log was cut short')
  const snapshots: (Snapshot & CommitInfo)[] = []
  for (const c of parseLog(log?.stdout ?? '')) {
    const f = await filesAt(c.sha)
    if ('error' in f) return fail(f.error)
    snapshots.push({ ...snapshot(settings, f), ...c })
  }
  const files = await filesAt(head.sha)
  if ('error' in files) return fail(files.error)

  const b = await git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = b.exitCode === 0 ? b.stdout.trim() : main
  let behindRemote = 0
  if ((await git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${main}`])).exitCode === 0) {
    const n = await git(['rev-list', '--count', `${main}..origin/${main}`])
    behindRemote = n.exitCode === 0 ? Number(n.stdout.trim()) || 0 : 0
  }
  return { input: { settings, files, head, snapshots }, branch, behindRemote, findings }
}

// The repository's key: its common git dir. Asked with no --path-format, which a git before 2.31 echoes, so the answer
// may be relative to root, as it is at the top (second check, finding 7); a current git's keys stay as they were.
export const commonDir = (root: string, dir: string): string => /^([A-Za-z]:)?[\\/]/.test(dir) ? dir : `${root}/${dir}`

export async function repoKey($: Dollar, root: string): Promise<string> {
  const r = await $.process.run(['git', 'rev-parse', '--git-common-dir'], { cwd: root, timeoutMs: TIMEOUT })
  return r.exitCode === 0 && r.stdout.trim() ? commonDir(root, r.stdout.trim()) : root
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

// The page is the one file the plugin writes itself, with no Write tool and no Read before it (the owner,
// 2026-11-03): it is git-ignored and never committed. Every other write goes through writeFile.
export const PAGE = '.housekeeping/route-map.html'

// "/" separators, with "." and ".." folded
const fold = (p: string): string => {
  const q = p.replaceAll('\\', '/'), out: string[] = []
  for (const s of q.split('/')) if (s === '..') out.pop(); else if (s !== '.' && s !== '') out.push(s)
  return (q.startsWith('/') ? '/' : '') + out.join('/')
}

/** True when path, resolved under root, is root's own page. */
export const isOwnPage = (root: string, path: string): boolean =>
  fold(/^([A-Za-z]:)?[\\/]/.test(path) ? path : `${root}/${path}`) === fold(`${root}/${PAGE}`)

// null on success, else why not. Refuses any other path, and a page or folder that a link sends out of the root.
export async function writePage($: Dollar, root: string, path: string, html: string): Promise<string | null> {
  const no = `housekeeping: refused to write ${path}: the plugin itself writes only ${PAGE} in the session root`
  if (!isOwnPage(root, path)) return no
  try {
    const at = (p: string) => $.fs.stat(p, { resolve: true }).catch(() => undefined)
    const base = (await at(root))?.realPath
    if (!base) return no
    for (const rel of ['.housekeeping', PAGE]) {
      const s = await at(`${root}/${rel}`)
      if (s && (s.isLink || !s.realPath || fold(s.realPath) !== fold(`${base}/${rel}`))) return no
    }
    await $.fs.write(`${root}/${PAGE}`, html)
    return null
  } catch (err) {
    return String(err)
  }
}

// The survey's reader: the tracked files, under collect's rules. GIT_OPTIONAL_LOCKS=0: the survey writes nothing,
// not even git's index refresh. Each file is first put to the person's Read rules, which the survey obeys (the
// owner, 2026-11-04: "Obey the deny rules"); a check that fails counts as a deny.
// The person's --tracker and --not-tracker paths come back checked, for the inventory. outside: the files counted as
// denied because the engine answered an ask with no rule for a file outside the session's folder: the rules of the
// repository's top are not in force in a session started below it (second check, finding 4: the owner's "Treat 'ask'
// as refused").
export async function readTracked($: Dollar, root: string, named = { tracker: [] as string[], notTracker: [] as string[] }):
  Promise<{ files: SurveyFile[]; skipped: Skipped[]; denied: number; outside: number; named: { tracker: string[]; notTracker: string[] } } | { error: string }> {
  const r = await $.process.run(['git', 'ls-files', '-z'], { cwd: root, timeoutMs: TIMEOUT, env: { GIT_OPTIONAL_LOCKS: '0' } })
  // as the Node command says it; a survey that could not list is no survey (finding 7)
  if (r.exitCode !== 0) return { error: `housekeeping: cannot list the tracked files in ${root}: git said: ${r.stderr.split('\n')[0].trim()}` }
  const paths = r.stdout.split('\0')
  paths.pop() // the empty tail after the last NUL, or the entry the cut left half written
  const n = checkNamed(paths, named.tracker, named.notTracker)
  if ('error' in n) return { error: `housekeeping: ${n.error} (paths are from the top of ${root})` }
  const start = `${fold(await $.session.root())}/`
  let outside = 0
  const allow = (p: string) => $.tool.check({ tool: 'Read', input: { file_path: `${root}/${p}` } }).then(v =>
    v.decision === 'ask' && !v.rule && !fold(`${root}/${p}`).startsWith(start) ? (outside++, false) : v.decision !== 'deny', () => false)
  const got = await collect(paths,
    p => $.fs.stat(`${root}/${p}`).then(s => ({ file: s.kind === 'file' && !s.isLink, size: s.size }), () => null),
    p => $.fs.read(`${root}/${p}`).catch(() => null),
    { first: n.tracker, allow })
  if (r.isStdoutTruncated) got.skipped.push({ path: root, why: CUT_LIST })
  return { ...got, outside, named: n }
}

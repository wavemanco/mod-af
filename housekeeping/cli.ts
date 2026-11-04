// The Node command: reads a repository's files through git, builds with the core, writes or prints.
// Usage: node cli.ts <map|check|brief> [--repo <dir>] [--settings <file>] [--out <file>]
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { build } from './hooks/core/index.ts'
import { brief } from './hooks/core/brief.ts'
import { formatFindings } from './hooks/core/findings.ts'
import { headArgs, logArgs, parseLog, showArgs, snapshot } from './hooks/core/history.ts'
import { parseSettings } from './hooks/core/settings.ts'
import type { CommitInfo, FileKey, Snapshot } from './hooks/core/types.ts'

const USAGE = 'usage: node cli.ts <map|check|brief> [--repo <dir>] [--settings <file>] [--out <file>]'

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv
  const opt: Record<string, string> = {}
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith('--') || rest[i + 1] === undefined) { console.error(USAGE); return 2 }
    opt[rest[i].slice(2)] = rest[i + 1]
  }
  if (!['map', 'check', 'brief'].includes(cmd) || Object.keys(opt).some(k => !['repo', 'settings', 'out'].includes(k))) {
    console.error(USAGE)
    return 2
  }
  const repo = resolve(opt.repo ?? '.')
  const settingsPath = resolve(opt.settings ?? join(repo, '.housekeeping.json'))
  const out = resolve(opt.out ?? join(repo, '.housekeeping', 'route-map.html'))

  let text: string
  try { text = readFileSync(settingsPath, 'utf8') } catch {
    console.log(`housekeeping: cannot read settings file ${settingsPath}`)
    return 1
  }
  const { settings, findings: settingsFindings } = parseSettings(text)
  if (!settings) { console.log(formatFindings(settingsFindings)); return 1 }

  // GIT_OPTIONAL_LOCKS=0 keeps a read from taking the index lock in a checkout someone else is using
  const git = (args: string[]) => execFileSync('git', args, { cwd: repo, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } })
  const main = settings.mainBranch
  let head: CommitInfo
  try {
    head = parseLog(git(headArgs(main).slice(1)))[0]
    if (!head) throw new Error('empty')
  } catch (e) {
    const why = String((e as { stderr?: string }).stderr ?? '').split('\n')[0].trim()
    console.log(`housekeeping: no branch '${main}' in ${repo} (the "mainBranch" setting in ${settingsPath})${why ? `: git said: ${why}` : ''}`)
    return 2
  }
  const show = (sha: string, path: string): string | null => {
    try { return git(showArgs(sha, path).slice(1)) } catch { return null }
  }
  const filesAt = (sha: string): Record<FileKey, string | null> =>
    ({ backlog: show(sha, settings.files.backlog.path), playbook: show(sha, settings.files.playbook.path) })

  const snapshots: (Snapshot & CommitInfo)[] = parseLog(git(logArgs(settings).slice(1)))
    .map(c => ({ ...snapshot(settings, filesAt(c.sha)), ...c })) // the file text is dropped as each commit is done

  const result = build({ settings, files: filesAt(head.sha), head, snapshots })
  const findings = [...settingsFindings, ...result.findings]
  const failed = findings.some(f => f.level === 'error')

  if (cmd === 'check') {
    if (findings.length) console.log(formatFindings(findings))
    return failed ? 1 : 0
  }
  if (cmd === 'map') {
    if (failed || result.html === null) { console.log(formatFindings(findings)); return 1 }
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, result.html)
    console.log(result.partition)
    return 0
  }
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  let behindRemote = 0
  try {
    git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${main}`])
    behindRemote = Number(git(['rev-list', '--count', `${main}..origin/${main}`]).trim())
  } catch { /* no remote copy: nothing is behind */ }
  console.log(brief(result.data, { today: new Date().toISOString().slice(0, 10), branch, behindRemote, main }))
  return 0
}

if (import.meta.main) main(process.argv.slice(2)).then(code => { process.exitCode = code })

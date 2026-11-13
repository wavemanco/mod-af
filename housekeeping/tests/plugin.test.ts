import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import * as small from './fixtures/small.ts'
import { batches, isOwnPage, readTracked } from '../hooks/adapter.ts'
import { failedReply, handPrompt, keep } from '../hooks/register.tsx'
import { card } from '../hooks/core/card.ts'
import { parseSettings } from '../hooks/core/settings.ts'

const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
// the fullscreen layout from 110 columns, where the pane docks beside the transcript with room
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
const SHA = 'abcdef0123456789abcdef0123456789abcdef01'
const BASE = '1234567890123456789012345678901234567890'
const LINE = '8 rows in all = 2 closed + 6 open; open = 2 land now + 1 small choice + 3 not now; 4 open in the backlog, 2 in the playbook'
const ok = (stdout: string, exitCode = 0, isStdoutTruncated = false) =>
  ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated, isStderrTruncated: false } })

type World = {
  hasSettings?: boolean
  truncateShow?: boolean
  noArtifact?: boolean
  readError?: string
  failWrite?: string
  stats?: Record<string, { isLink: boolean; realPath?: string }>
  written?: Record<string, string>
  status?: (string | undefined)[]
  calls?: { tool: string; action?: string; url?: string; file_path?: string; title?: string }[]
  stored?: Record<string, unknown>
  storeFull?: boolean // a write of the short view is refused, as a store over 4 MiB refuses it
  argv?: string[][]
  noBranch?: boolean
  gitFail?: string // git log and rev-parse --verify exit 128 with this stderr: the repository does not open
  shallow?: boolean // rev-parse --is-shallow-repository says true
  blobless?: boolean // git show cannot read a blob the commit's tree names
  branch?: string // the checked-out branch, main by default
  behind?: number // commits local main is behind its remote copy (with remoteSha)
  envs?: (Record<string, string> | undefined)[] // each git call's env
  mainSha?: string
  remoteSha?: string
  now?: string
  placed?: boolean
  start?: string
  top?: string
  paths?: string[]
  failRead?: boolean | (() => boolean) // fs.read throws, at every read or where the function says
  pub?: object
  tracked?: Record<string, string> // the survey's files, by path under /w
  denied?: string[] // tracked paths the person's Read rules deny
  asked?: string[] // tracked paths the engine answers with an ask and no rule, as it does outside the session's folder
  oldGit?: boolean // git rev-parse echoes --path-format, as a git before 2.31 does
  logFail?: string // the history walk's git log exits 128 with this stderr, as in a treeless clone
  noTree?: boolean // the clone holds no tree of main's head: show, the path's rev-parse and cat-file fail
  logThrow?: boolean // the history walk's git log rejects, as process.run does past its time
  lsFail?: boolean // git ls-files exits 128
  lsCut?: boolean // git ls-files output is cut short
  reads?: string[] // every path fs.read was asked for
  backlog?: string // main's backlog.md, small.ts's by default
  settings?: string // .housekeeping.json, small.ts's by default
  gate?: Promise<void> // the history walk's git log waits for it: a slow repository
  badPrompt?: boolean // a procedure file reads as a number, so the command's reply is one the site refuses
  registered?: { description?: string; argumentHint?: string } // what session start registered the command with
  // owed's git, as -z output: the range's changed paths, its commits, their paths; each path's -U0 section, and the
  // paths whose diff is cut short (a batch holding one is cut short)
  owed?: { names: string; log: string; paths: string; diffs: Record<string, string>; cut?: string[] }
}

// the engine may hand a hook a Windows-style path
const posix = (p: string) => p.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '')
// stand-ins for prompts/*.md: the test kit imports code files only, so it cannot read the real ones
// the survey's has a line that names the Node command, as the real one does
const PROMPTS: Record<string, string> = { survey: '# the survey procedure\nRe-run: node <path to housekeeping>/cli.ts survey', plan: '# the plan procedure',
  standin: '# a procedure that reads no tracked files' }
const under = (p: string) => posix(p).replace(/^\/w\//, '')

// The engine stand-ins: git answers from small.ts's files, tools are logged, the store is a map.
function world(on: On, w: World = {}) {
  const files = (): Record<string, string> => ({ 'backlog.md': w.backlog ?? small.backlog, 'playbook.md': small.playbook })
  const stored = (w.stored ??= {})
  const calls = (w.calls ??= [])
  on('command.register', (_, e) => { w.registered = { description: e.description, argumentHint: e.argumentHint }; return { value: { command: e.name } } })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w' }))
  on('session.root', () => ({ value: w.start ?? '/w' }))
  on('clock.now', () => ({ value: Date.parse(w.now ?? '2026-09-12T10:00:00Z') }))
  on('fs.exists', (_, e) => (w.paths?.push(posix(e.path)), { value: w.hasSettings !== false && e.path.endsWith('.housekeeping.json') }))
  on('fs.read', (_, e) => {
    w.reads?.push(posix(e.path))
    if (typeof w.failRead === 'function' ? w.failRead() : w.failRead) throw new Error('EIO')
    const prompt = /\/prompts\/(survey|plan)\.md$/.exec(posix(e.path))
    if (prompt && w.badPrompt) return { value: 42 as never }
    return { value: prompt ? PROMPTS[prompt[1]] : w.tracked?.[under(e.path)] ?? w.settings ?? small.settings }
  })
  on('process.run', (_, e) => {
    w.argv?.push([...e.argv])
    w.envs?.push(e.init?.env)
    const [, a, b] = e.argv
    const o = w.owed
    if (o) {
      // HEAD and main resolve to SHA, their merge base is BASE, and main's tip is in the range
      if (a === 'rev-parse' && b === '--verify' && String(e.argv.at(-1)).endsWith('^{commit}')) return ok(`${SHA}\n`)
      if (a === 'merge-base') return e.argv.includes('--is-ancestor') ? ok('') : ok(`${BASE}\n`)
      if (a === 'diff' && e.argv.includes('--name-status')) return ok(o.names)
      if (a === 'log' && e.argv.includes('--name-status')) return ok(o.paths)
      if (a === 'log' && e.argv.includes('-z')) return ok(o.log)
      if (a === '-c') {
        const ps = e.argv.slice(e.argv.indexOf('--') + 1).map(p => p.replace(':(literal)', ''))
        return ok(ps.map(p => o.diffs[p] ?? '').join(''), 0, ps.some(p => o.cut?.includes(p)))
      }
    }
    if (w.noTree && (a === 'show' || a === 'cat-file' || (b === '--verify' && String(e.argv.at(-1)).includes(':'))))
      return { value: { exitCode: a === 'show' ? 128 : 1, stdout: '', stderr: 'fatal: bad object x\n', isStdoutTruncated: false, isStderrTruncated: false } }
    if (w.blobless && a === 'show') return { value: { exitCode: 128, stdout: '', stderr: 'fatal: bad object x\n', isStdoutTruncated: false, isStderrTruncated: false } }
    if (w.blobless && b === '--verify' && String(e.argv.at(-1)).includes(':')) return ok('5626abf0f72e58d7a153368ba57db4c673c0e171\n')
    if (a === 'ls-files' && w.lsFail) return { value: { exitCode: 128, stdout: '', isStdoutTruncated: false, isStderrTruncated: false,
      stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' } }
    if (a === 'ls-files') return ok(Object.keys(w.tracked ?? {}).map(p => `${p}\0`).join(''), 0, w.lsCut)
    if (w.gitFail && (a === 'log' || b === '--verify')) return { value: { exitCode: 128, stdout: '', stderr: w.gitFail, isStdoutTruncated: false, isStderrTruncated: false } }
    if (a === 'log' && w.logThrow && e.argv.includes('--reverse')) throw new Error('git ran past its time')
    if (a === 'log' && w.logFail && e.argv.includes('--reverse')) return { value: { exitCode: 128, stdout: '', stderr: w.logFail, isStdoutTruncated: false, isStderrTruncated: false } }
    if (a === 'log' && w.gate && e.argv.includes('--reverse')) return w.gate.then(() => ok(`${SHA}\t2026-09-12\thead\n`))
    if (a === 'log') return w.noBranch ? ok('', 128) : ok(`${SHA}\t2026-09-12\thead\n`)
    if (a === 'show') {
      const text = files()[String(e.argv.at(-1)).split(':')[1]]
      if (w.truncateShow) return ok('# cut', 0, true)
      return ok(text ?? '', text === undefined ? 128 : 0)
    }
    if (a === 'rev-parse' && b === '--abbrev-ref') return ok(`${w.branch ?? 'main'}\n`)
    if (a === 'rev-list' && b === '--count') return ok(`${w.behind ?? 0}\n`)
    if (a === 'rev-parse' && b === '--is-shallow-repository') return ok(w.shallow ? 'true\n' : 'false\n')
    if (a === 'rev-parse' && b === '--show-toplevel') return w.top ? ok(w.top + '\n') : ok('', 128)
    if (a === 'rev-parse' && b === '--verify') return w.remoteSha ? ok(w.remoteSha + '\n') : ok('', 1)
    // the common dir, relative at the top as git gives it with no --path-format, absolute with it, and a git before
    // 2.31 (oldGit) echoes the flag it does not know; with --abbrev-ref, then main's commit and the branch
    if (a === 'rev-parse' && e.argv.includes('--git-common-dir')) {
      const dir = !e.argv.includes('--path-format=absolute') ? '.git' : w.oldGit ? '--path-format=absolute\n.git' : `${posix(String(e.init?.cwd))}/.git`
      return ok(e.argv.includes('--abbrev-ref') ? `${dir}\n${w.mainSha ?? SHA}\n${w.branch ?? 'main'}\n` : `${dir}\n`)
    }
    return ok('', 1)
  })
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => {
    if (w.storeFull && e.key.startsWith('brief:')) throw new Error('the store is over 4 MiB')
    stored[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', (_, e) => { delete stored[e.key]; return { value: undefined } })
  on('tool.list', () => ({ value: w.noArtifact ? [{ name: 'Write', description: '', mcp: false }] : [{ name: 'Write', description: '', mcp: false }, { name: 'Artifact', description: '', mcp: false }] }))
  on('ui.open', () => ({ value: { isPlaced: w.placed !== false } }))
  on('ui.status', (_, e) => { w.status?.push(e.text); return { value: undefined } })
  // the root is itself; the page and its folder are missing unless w.stats says otherwise
  on('fs.stat', (_, e) => {
    const t = w.tracked?.[under(e.path)]
    if (t !== undefined) return { value: { kind: 'file', size: t.length, mtimeMs: 0, isLink: false } }
    const s = posix(e.path) === '/w' ? { isLink: false, realPath: '/w' } : w.stats?.[posix(e.path)]
    if (!s) throw new Error(`ENOENT: ${e.path}`)
    return { value: { kind: 'file', size: 1, mtimeMs: 0, ...s } }
  })
  on('fs.write', (_, e) => {
    if (w.failWrite) throw new Error(w.failWrite)
    ;(w.written ??= {})[posix(e.path)] = e.text
    return { value: undefined }
  })
  // the person's Read rules, as the engine's permission decision gives them
  on('tool.check', { tool: 'Read' }, (_, e) => {
    const p = under(String((e.input as { file_path?: string }).file_path))
    return { decision: w.denied?.includes(p) ? 'deny' : w.asked?.includes(p) ? 'ask' : 'allow' }
  })
  on('tool.call', { tool: 'Read' }, (_, e) => { calls.push({ tool: 'Read', file_path: e.file_path }); return { result: 'x' } as never })
  on('tool.call', { tool: 'Write' }, (_, e) => { calls.push({ tool: 'Write', file_path: e.file_path }); return { result: 'ok' } as never })
  on('tool.call', { tool: 'Artifact' }, (_, e) => {
    calls.push({ tool: 'Artifact', action: e.action, url: e.url, title: e.title })
    if (e.action === 'read' && w.readError) return { isError: true, text: w.readError, result: null } as never
    if (e.action === 'publish' && w.pub) return w.pub as never
    return { result: { url: 'https://claude.ai/artifact/abc', path: e.file_path } } as never
  })
}

const run = ($: any, args: string) => $.command.run({ command: 'housekeeping', args, ...RUN })

test('/housekeeping check on the good fixture exits 0', async ($, on) => {
  world(on)
  await $.session.start(START)
  const r = await run($, 'check')
  expect(r.exitCode).toBe(0)
  expect(r.text).toContain('recommendation done-milestone')
})

// finding 15: the short view's due check threw on it, so check, map, plan and the short view all failed
test('an impossible Last done date is a check warning naming the row, and the short view still opens', async ($, on) => {
  const w: World = { status: [], backlog: small.backlog.replace('| Whenever an agent picks it up. | — | **Why:** slow builds. |',
    '| Every 30 days. | — | **Why:** slow builds. Last done: 2026-13-01 |') }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'check')
  expect(r.exitCode).toBe(0)
  expect(r.text).toContain('warning last-done backlog:23 B-005: Last done "2026-13-01" is not a real YYYY-MM-DD date')
  expect((await run($, '')).text).toMatch(/^housekeeping: short view open\./)
  expect(w.status!.at(-1)).toContain('land now')
})

test('/housekeeping map writes the page, publishes it, and says the partition and URL', async ($, on) => {
  const w: World = {}
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(w.calls!.map(c => c.tool + (c.action ? ':' + c.action : ''))).toEqual(['Artifact:publish'])
  expect(Object.keys(w.written!)).toEqual(['/w/.housekeeping/route-map.html'])
  expect(w.written!['/w/.housekeeping/route-map.html']).toContain('window.DATA = {')
  expect(w.calls![0].title).toBe('Small Route Map')
  expect(r.text).toContain(LINE)
  expect(r.text).toContain('https://claude.ai/artifact/abc')
  expect(w.stored!['repo:/w/.git']).toEqual({ url: 'https://claude.ai/artifact/abc', sha: SHA })
})

test('a second map reads the stored artifact, then publishes to its URL', async ($, on) => {
  const w: World = {}
  world(on, w)
  await $.session.start(START)
  await run($, 'map')
  w.calls!.length = 0
  await run($, 'map')
  const arts = w.calls!.filter(c => c.tool === 'Artifact')
  expect(arts.map(c => c.action)).toEqual(['read', 'publish'])
  expect(arts.map(c => c.url)).toEqual(['https://claude.ai/artifact/abc', 'https://claude.ai/artifact/abc'])
})

const KNOWN = { 'repo:/w/.git': { url: 'https://claude.ai/artifact/gone', sha: SHA } }
const FORGOT = 'the stored Route Map link could not be read and was forgotten; run /housekeeping map again to publish a new page'

test('a stored link that is not found is forgotten', async ($, on) => {
  const w: World = { readError: 'Artifact not found', stored: { ...KNOWN } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(r.exitCode).toBe(1)
  expect(r.text).toContain(FORGOT)
  expect('repo:/w/.git' in w.stored!).toBe(false)
  expect(w.calls!.map(c => c.action)).toEqual(['read'])
})

test('a stored link refused for access or permission is kept, not forgotten (HK-033)', async ($, on) => {
  const w: World = {}
  world(on, w)
  await $.session.start(START)
  for (const readError of ['You do not have access to this artifact', 'permission denied', 'Forbidden 403']) {
    Object.assign(w, { readError, stored: Object.assign(w.stored!, KNOWN) })
    const r = await run($, 'map')
    expect(r.exitCode).toBe(1)
    expect(r.text).not.toContain(FORGOT)
    expect(w.stored!['repo:/w/.git']).toEqual(KNOWN['repo:/w/.git'])
  }
})

test('any other read error keeps the link and says how to reset', async ($, on) => {
  const w: World = { readError: 'the server is busy', stored: { ...KNOWN } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(r.exitCode).toBe(1)
  expect(r.text).toContain('the server is busy')
  expect(r.text).toContain('/housekeeping map new')
  expect(w.stored!['repo:/w/.git']).toEqual(KNOWN['repo:/w/.git'])
  expect(w.calls!.map(c => c.action)).toEqual(['read'])
})

test('map new forgets the stored link and publishes a new page', async ($, on) => {
  const w: World = { readError: 'the server is busy', stored: { ...KNOWN } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map new')
  expect(r.exitCode ?? 0).toBe(0)
  expect(w.calls!.map(c => [c.action, c.url])).toEqual([['publish', undefined]])
  expect(w.stored!['repo:/w/.git']).toEqual({ url: 'https://claude.ai/artifact/abc', sha: SHA })
})

test('without an Artifact tool, map says the file path', async ($, on) => {
  const w: World = { noArtifact: true }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(r.text).toContain(LINE)
  expect(r.text).toContain('/w/.housekeeping/route-map.html')
  expect(w.calls!.some(c => c.tool === 'Artifact')).toBe(false)
})

// The owner chose "Directly, that one path only (Recommended)": no Write tool, so no Read first, which a large page failed
test('map overwrites its own page directly, with no Read and no Write tool', async ($, on) => {
  const w: World = { stats: { '/w/.housekeeping': { isLink: false, realPath: '/w/.housekeeping' },
    '/w/.housekeeping/route-map.html': { isLink: false, realPath: '/w/.housekeeping/route-map.html' } } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(r.exitCode ?? 0).toBe(0)
  expect(w.calls!.some(c => c.tool === 'Read' || c.tool === 'Write')).toBe(false)
  expect(Object.keys(w.written!)).toEqual(['/w/.housekeeping/route-map.html'])
})

test('the plugin writes only its own page, resolved under the root', () => {
  for (const p of ['/w/.housekeeping/route-map.html', '/w/./.housekeeping/route-map.html', '.housekeeping/route-map.html'])
    expect(isOwnPage('/w', p)).toBe(true)
  expect(isOwnPage('C:\\w', 'C:\\w\\.housekeeping\\route-map.html')).toBe(true)
  expect(isOwnPage('C:\\w', 'C:/w/.housekeeping/route-map.html')).toBe(true)
  for (const p of ['/w/other.html', '/w/.housekeeping/../x.html', '/w/.housekeeping/route-map.html.bak', '/w/.housekeeping/a/route-map.html',
    '/elsewhere/.housekeeping/route-map.html', '/w/.gitignore', '/w/AGENTS.md', '../.housekeeping/route-map.html'])
    expect(isOwnPage('/w', p)).toBe(false)
})

test('a page or folder that a link sends elsewhere is refused, and nothing is written', async ($, on) => {
  const w: World = {}
  world(on, w)
  await $.session.start(START)
  for (const stats of [{ '/w/.housekeeping/route-map.html': { isLink: true, realPath: '/home/x/.bashrc' } },
    { '/w/.housekeeping': { isLink: true, realPath: '/home/x' } },
    { '/w/.housekeeping': { isLink: false, realPath: '/elsewhere/.housekeeping' } }]) {
    w.stats = stats
    const r = await run($, 'map')
    expect(r.exitCode).toBe(1)
    expect(r.text).toContain('refused to write')
    expect(w.written).toBeUndefined()
    expect(w.calls!.length).toBe(0)
  }
})

// a hook that throws is skipped, so the write rejects as unanswered: still a failed write
test('a failed page write is reported and nothing is published', async ($, on) => {
  const w: World = { failWrite: 'EACCES' }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(r.exitCode).toBe(1)
  expect(r.text).toContain('fs.write')
  expect(w.calls!.some(c => c.tool === 'Artifact')).toBe(false)
})

test('a truncated git show is a git error and nothing is published', async ($, on) => {
  const w: World = { truncateShow: true }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(r.text).toMatch(/^error git /m)
  expect(w.calls!.length).toBe(0)
})

test('every git log and show puts --end-of-options before the revision', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  await $.session.start(START)
  await run($, 'check')
  const reads = w.argv!.filter(a => a[1] === 'log' || a[1] === 'show')
  expect(reads.length).toBeGreaterThan(2)
  for (const a of reads) {
    const at = a.indexOf('--end-of-options')
    expect(at).toBeGreaterThan(1)
    expect(a.slice(2, at).every(x => x.startsWith('-'))).toBe(true)
    expect(a[at + 1].startsWith('-')).toBe(false)
  }
})

test('with no main branch, the error names the mainBranch setting', async ($, on) => {
  world(on, { noBranch: true })
  await $.session.start(START)
  const r = await run($, 'check')
  expect(r.exitCode).toBe(1)
  expect(r.text).toContain("no branch 'main' in /w")
  expect(r.text).toContain('"mainBranch"')
})

// finding 28: dubious ownership, a broken config or no repository all read as "no branch", pointing at a sound setting
test('a repository git cannot open gives git\'s first error line, not "no branch"', async ($, on) => {
  world(on, { gitFail: "fatal: detected dubious ownership in repository at '/w'\nTo add an exception for this directory, call:\n" })
  await $.session.start(START)
  const r = await run($, 'check')
  expect(r.exitCode).toBe(1)
  expect(r.text).toBe("housekeeping: cannot read 'main' in /w: git said: fatal: detected dubious ownership in repository at '/w'")
})

const walks = (w: World) => w.argv!.filter(a => a[1] === 'log' && a.includes('--reverse')).length
const brief = (r: { blocks: { name: string; text: string }[] }) => r.blocks.find(x => x.name === 'housekeeping')?.text ?? ''
// what is under way runs on while the test waits a little, up to a second
const until = async (done: () => boolean) => { for (let i = 0; i < 200 && !done(); i++) await new Promise(r => setTimeout(r, 5)) }
const late = <T>(p: Promise<T>) => Promise.race([p, new Promise<'late'>(r => setTimeout(() => r('late'), 1000))])
// session start's view stored, for the tests of what a prompt then gets
// the stored view, under its repository and settings text (HK-091)
type Kept = { order?: string[]; views?: Record<string, { sha?: string }> }
const kept = (w: World, dir = '/w/.git') => (w.stored ?? {})[`brief:${dir}`] as Kept | undefined
// the latest stored view of the repository (HK-092: one key, a view per settings text)
const entry = (w: World, dir = '/w/.git') => { const k = kept(w, dir); return k?.views?.[k.order?.[0] ?? ''] }
const stored = (w: World, sha = SHA) => until(() => entry(w)?.sha === sha)

test('prompt.context adds the short view', async ($, on) => {
  const w: World = {}
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  const r = await $.prompt.context({ blocks: [{ name: 'currentDate', text: 'today' }] })
  const b = r.blocks.find((x: { name: string }) => x.name === 'housekeeping')
  expect(b.text.startsWith('# Small: where we are')).toBe(true)
})

// finding 20: prompt.context awaited session start's walk, whose time counted against its own budget, so a slow
// history lost the short view for the session
test('prompt.context never awaits the walk: the view is being built, then the stored one, labelled, while a rebuild runs', async ($, on) => {
  let open!: () => void
  const shut = () => new Promise<void>(r => { open = r })
  const w: World = { argv: [], gate: shut() }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  const cold = await late($.prompt.context({ blocks: [] }))
  expect(cold === 'late' ? 'late' : brief(cold)).toBe('housekeeping: the short view is being built and is not ready yet; /housekeeping shows it once it is.')
  open()
  await until(() => !!entry(w))
  const first = brief(await $.prompt.context({ blocks: [] }))
  expect(first.startsWith('# Small: where we are (abcdef0, 2026-09-12)')).toBe(true)
  w.gate = shut()
  w.mainSha = 'f'.repeat(40)
  const stale = await late($.prompt.context({ blocks: [] }))
  expect(stale === 'late' ? 'late' : brief(stale)).toBe(`Stored view of main at abcdef0, shown while a new one is built.\n${first}`)
  open()
  await until(() => walks(w) === 2 && entry(w)?.sha === 'f'.repeat(40))
  expect(walks(w)).toBe(2) // session start's and the rebuild: a prompt starts no second walk of its own
})

// second check, finding 15: the store holds one view per repository, and a view stored on one branch was served on
// another with the first one's line
test('a view stored on one branch and served on another names the second', async ($, on) => {
  const w: World = { argv: [], branch: 'first' }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  const HEAD = '# Small: where we are (abcdef0, 2026-09-12)'
  expect(brief(await $.prompt.context({ blocks: [] })).startsWith(`${HEAD}\nOn branch first; the map shows main.\n`)).toBe(true)
  // the branch is no longer in the stamp: a switch serves the same view with its own line, with no walk and no stale
  // label, and two worktrees on two branches no longer rebuild at every prompt (HK-088)
  const before = walks(w)
  w.branch = 'second'
  const text = brief(await $.prompt.context({ blocks: [] }))
  expect(text.startsWith(`${HEAD}\nOn branch second; the map shows main.\n`)).toBe(true)
  expect(text).not.toContain('On branch first')
  expect(walks(w)).toBe(before)
  w.branch = 'main' // back on main: no branch line
  expect(brief(await $.prompt.context({ blocks: [] }))).not.toContain('On branch')
})

test('with main unchanged, the short view costs one git rev-parse; a new main commit rebuilds it', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  const first = brief(await $.prompt.context({ blocks: [] }))
  w.argv!.length = 0
  expect(brief(await $.prompt.context({ blocks: [] }))).toBe(first)
  expect(w.argv!.every(a => a[1] === 'rev-parse')).toBe(true)
  expect(walks(w)).toBe(0)
  w.mainSha = 'f'.repeat(40)
  w.argv!.length = 0
  expect(brief(await $.prompt.context({ blocks: [] })).endsWith(`\n${first}`)).toBe(true) // the stored one, labelled
  await stored(w, w.mainSha)
  expect(walks(w)).toBe(1)
})

test('a moved remote copy of main rebuilds the short view (HK-034)', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  w.remoteSha = 'a'.repeat(40)
  await $.prompt.context({ blocks: [] })
  await until(() => walks(w) === 2)
  expect(walks(w)).toBe(2)
})

test('a new day with main unchanged does not walk the history again (HK-035)', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  await $.prompt.context({ blocks: [] })
  w.now = '2026-09-13T10:00:00Z'
  await $.prompt.context({ blocks: [] })
  expect(walks(w)).toBe(1)
})

// Phase 3: the stored view keeps the duty rows, and "Duties due" is worked out when the view is served, as the branch
// line is, so a new day shows the duties then due with no walk
const DUTY = small.backlog.replace('| Whenever an agent picks it up. | — | **Why:** slow builds. |',
  '| Every 30 days. | — | **Why:** slow builds. Last done: 2026-10-01 |')
test('duties due are worked out when the view is served, so a day change shows them with no rebuild', async ($, on) => {
  expect(DUTY).not.toBe(small.backlog)
  const w: World = { argv: [], backlog: DUTY, now: '2026-10-15T10:00:00Z', placed: false }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  const due = (t: string) => t.split('\n').find(l => l.startsWith('Duties due:'))
  expect(due(brief(await $.prompt.context({ blocks: [] })))).toBe('Duties due: ')
  w.now = '2026-11-03T10:00:00Z'
  const served = brief(await $.prompt.context({ blocks: [] }))
  expect(due(served)).toBe('Duties due: B-005')
  expect(walks(w)).toBe(1)
  expect((await run($, '')).text).toBe(served) // as a view built that day gives it
})

test('a view stored before the view format was in the stamp is rebuilt once', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  await $.prompt.context({ blocks: [] })
  expect(walks(w)).toBe(1) // a view stored in this format is served as it is
  // as 0.2.0 stored it: the stamp without the format, the day's duties written into the text, no duty rows
  const k = kept(w)!, id = k.order![0], v = k.views![id] as { status?: string }
  w.stored!['brief:/w/.git'] = { order: [id], views: { [id]: { sha: SHA, stamp: [SHA, '', small.settings].join('\n'),
    brief: '# an old view\nDuties due: \n0 warnings', status: v.status } } }
  await $.prompt.context({ blocks: [] })
  await until(() => walks(w) === 2 && Array.isArray((entry(w) as { duties?: unknown })?.duties))
  for (let i = 0; i < 3; i++) await $.prompt.context({ blocks: [] })
  expect(walks(w)).toBe(2)
  expect(brief(await $.prompt.context({ blocks: [] })).startsWith('# Small: where we are')).toBe(true)
})

// finding 13: a shallow clone's boundary reads as a root that touched every file
test('in a shallow clone no history is walked, and check warns that the clone holds part of it', async ($, on) => {
  const w: World = { argv: [], shallow: true }
  world(on, w)
  await $.session.start(START)
  w.argv!.length = 0
  const r = await run($, 'check')
  expect(r.exitCode).toBe(0)
  expect(r.text).toMatch(/^warning shallow - /m)
  expect(walks(w)).toBe(0)
})

const CURE = 'To fetch the old versions, run git log -p -m --first-parent main -- backlog.md playbook.md, then run this again.'
// a tied minor: in a blobless clone git show fetched, and a show that failed read as a missing file
test('git runs with lazy fetching off, and a blob the clone does not hold is reported, not read as a missing file', async ($, on) => {
  const w: World = { blobless: true, argv: [], envs: [] }
  world(on, w)
  await $.session.start(START)
  w.envs!.length = w.argv!.length = 0
  const r = await run($, 'check')
  expect(r.exitCode).toBe(1)
  expect(r.text).toContain(`cannot read backlog.md at ${SHA.slice(0, 7)}, which this clone does not hold: housekeeping never fetches (git said: fatal: bad object x)`)
  // second check, finding 18, at the owner's "Keep the stop, add next step": the stop names the cure
  expect(r.text).toContain(`(git said: fatal: bad object x). ${CURE}`)
  w.argv!.forEach((a, i) => { if (a[1] === 'log' || a[1] === 'show') expect(w.envs![i]?.GIT_NO_LAZY_FETCH).toBe('1') })
})

// second check, finding 11: in a treeless clone the history's git log failed, and check passed with an empty history
test('a history walk that git stops is a git error naming the two files, and nothing is published; a shallow clone walks none', async ($, on) => {
  const w: World = { logFail: 'fatal: unable to read tree (0ff1621)\nmore\n' }
  world(on, w)
  await $.session.start(START)
  const c = await run($, 'check')
  expect(c.exitCode).toBe(1)
  expect(c.text).toBe('error git - cannot read the history of backlog.md and playbook.md on main: housekeeping never fetches (git said: fatal: unable to read tree (0ff1621))')
  expect((await run($, 'map')).exitCode).toBe(1)
  expect(w.written).toBeUndefined()
  expect(w.calls!.length).toBe(0)
  w.shallow = true
  expect((await run($, 'check')).exitCode).toBe(0)
})

// finding 12 and a tied minor: check names the branch it read, and map and check say local main is behind
test('check names the branch it read when HEAD is elsewhere, and map and check say local main is behind', async ($, on) => {
  const w: World = { branch: 'feature', remoteSha: 'a'.repeat(40), behind: 2, noArtifact: true }
  world(on, w)
  await $.session.start(START)
  const BEHIND = 'Local main is 2 commits behind its remote copy.'
  const c = await run($, 'check')
  expect(c.exitCode).toBe(0)
  expect(c.text.split('\n').slice(0, 2)).toEqual(['On branch feature; check read main.', BEHIND])
  expect((await run($, 'map')).text).toBe(`${LINE}\n${BEHIND}\n/w/.housekeeping/route-map.html`)
  Object.assign(w, { branch: 'main', behind: 0 })
  expect((await run($, 'check')).text).not.toMatch(/On branch|behind/)
})

test('a session started in a sub-folder reads the top of the git tree (HK-030)', async ($, on) => {
  const w: World = { start: '/w/sub', top: '/w', paths: [] }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'check')
  expect(r.exitCode).toBe(0)
  expect(w.paths!.every(p => p === '/w/.housekeeping.json')).toBe(true)
})

// second check, finding 7: a git before 2.31 echoed --path-format, so every repository had one store key, and one's
// short view reached another's agent and its map published over the other's page
test('on a git that echoes an unknown --path-format, two repositories keep their own views and Route Map links', async ($, on) => {
  const w: World = { oldGit: true, start: '/a', top: '/a', argv: [], stats: { '/a': { isLink: false, realPath: '/a' }, '/b': { isLink: false, realPath: '/b' } } }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await until(() => !!entry(w, '/a/.git'))
  expect((await run($, 'map')).exitCode ?? 0).toBe(0)
  Object.assign(w, { start: '/b', top: '/b' })
  await $.prompt.context({ blocks: [] })
  await until(() => !!entry(w, '/b/.git'))
  expect((await run($, 'map')).exitCode ?? 0).toBe(0)
  expect(Object.keys(w.stored!).map(k => k.replace(/#.*/, '')).sort()).toEqual(['brief:/a/.git', 'brief:/b/.git', 'repo:/a/.git', 'repo:/b/.git'])
  expect(w.calls!.filter(c => c.tool === 'Artifact').map(c => [c.action, c.url])).toEqual([['publish', undefined], ['publish', undefined]])
  expect(w.argv!.some(a => a.includes('--path-format=absolute'))).toBe(false)
})

test('a command that throws still replies, with exit code 1 (HK-031)', async ($, on) => {
  const w: World = { failRead: true }
  world(on, w)
  await $.session.start(START)
  for (const arg of ['check', '', 'map']) {
    const r = await run($, arg)
    expect(r.exitCode).toBe(1)
    expect(r.text).toContain('housekeeping:')
  }
})

// finding 11: a hook that failed outside its own promise, past its 10 s budget above all, was skipped, so the reply
// was the engine's with exit 0 and a check read as passed. The kit gives a hook no cheap way past 10 s of its own
// time (a 117 s walk of $ calls stayed inside it), so a reply the site refuses stands in: both are a failed hook,
// which the registration's .catch answers.
test('a command hook that fails is answered by its .catch, with exit 1 and the Node command to run', async ($, on) => {
  world(on, { tracked: { ...TRACKED }, badPrompt: true })
  await $.session.start(START)
  const r = await run($, 'survey').catch((err: unknown) => ({ text: String(err), exitCode: undefined }))
  expect(r.exitCode).toBe(1)
  expect(r.text).toMatch(/^housekeeping: \/housekeeping survey failed in the hook \(.+\); run node .+\/cli\.ts survey in the repository instead, which has no time limit$/)
})

// Phase 3: each slash command is named in the usage line, the description and the argument hint; each later task
// adds its own
const COMMANDS = ['map', 'map new', 'check', 'init', 'survey', 'plan', 'owed']
const named = (text: string | undefined, name: string) => new RegExp(`(^|[^a-z])${name}([^a-z]|$)`).test(text ?? '')

test('each slash command is named in the usage line, the description and the argument hint', async ($, on) => {
  const w: World = {}
  world(on, w)
  await $.session.start(START)
  const usage = (await run($, 'nope')).text
  expect(usage).toMatch(/^housekeeping: \[/)
  for (const name of COMMANDS)
    expect([name, named(usage, name), named(w.registered?.description, name), named(w.registered?.argumentHint, name)]).toEqual([name, true, true, true])
})

// the hook failing outside its own promise stands in for one past its 10 s, as above: a run with no presentation
// fails before the command does anything
test('the reply of a hook that fails names each command\'s Node form', async ($, on) => {
  world(on, { tracked: { ...TRACKED } })
  await $.session.start(START)
  for (const [args, node] of [['', 'brief'], ['map', 'map'], ['map new', 'map'], ['check', 'check'], ['survey', 'survey'], ['plan', 'survey']]) {
    const r = await $.command.run({ command: 'housekeeping', args, origin: { kind: 'composer' } } as never) as { text: string; exitCode?: number }
    expect([args, r.exitCode]).toEqual([args, 1])
    expect(r.text).toMatch(new RegExp(`^housekeeping: /housekeeping${args ? ` ${args}` : ''} failed in the hook \\(.+\\); ` +
      `run node .+/cli\\.ts ${node} in the repository instead, which has no time limit$`))
  }
  // owed's Node form ignores the Read rules: a run whose checks did not all finish clear names the slash command
  const r = await $.command.run({ command: 'housekeeping', args: 'owed', origin: { kind: 'composer' } } as never) as { text: string; exitCode?: number }
  expect(r.exitCode).toBe(1)
  expect(r.text).toMatch(new RegExp('^housekeeping: /housekeeping owed failed in the hook \\(.+\\); run /housekeeping owed again: ' +
    "housekeeping's Node command ignores the Read rules, and this run's Read checks did not all finish with nothing excluded$"))
})

test('the failed reply names the Node owed only after a run whose Read checks all finished with nothing excluded', () => {
  expect(failedReply('/h', 'owed --base x', 'ran past the 10 s a hook may take', true)).toEqual({ exitCode: 1,
    text: 'housekeeping: /housekeeping owed --base x ran past the 10 s a hook may take; run node /h/cli.ts owed in the repository instead, which has no time limit' })
  expect(failedReply('/h', 'owed', 'ran past the 10 s a hook may take', false).text).toBe('housekeeping: /housekeeping owed ran past the 10 s a hook ' +
    "may take; run /housekeeping owed again: housekeeping's Node command ignores the Read rules, and this run's Read checks did not all finish with nothing excluded")
})

test('a failed publish still says the partition line and the page path (HK-032)', async ($, on) => {
  const w: World = {}
  world(on, w)
  await $.session.start(START)
  for (const pub of [{ deny: 'not allowed' }, { isError: true, text: 'boom', result: null }]) {
    w.pub = pub
    const r = await run($, 'map')
    expect(r.exitCode).toBe(1)
    expect(r.text).toContain(LINE)
    expect(r.text).toContain('/w/.housekeeping/route-map.html')
  }
})

test('the URL comes from result.url, else the claude.ai link in the text (HK-036)', async ($, on) => {
  const cases: [object, string | null][] = [
    [{ result: { url: 'https://claude.ai/artifact/r1' }, text: 'see https://claude.ai/artifact/t1' }, 'https://claude.ai/artifact/r1'],
    [{ result: null, text: 'Published: https://claude.ai/artifact/t1.' }, 'https://claude.ai/artifact/t1'],
    [{ result: {}, text: 'no link here, only https://example.com/x' }, null],
    [{ result: null, text: 'nothing' }, null],
  ]
  const w: World = {}
  world(on, w)
  await $.session.start(START)
  for (const [pub, url] of cases) {
    w.pub = pub
    const r = await run($, 'map new')
    if (url) { expect(r.exitCode ?? 0).toBe(0); expect(r.text).toContain(url); expect(w.stored!['repo:/w/.git']).toEqual({ url, sha: SHA }) }
    else { expect(r.exitCode).toBe(1); expect(r.text).toContain('no URL') }
  }
})

// Phase 3 call 9: the records card, its own block after the short view, from the settings alone
const CARD = card(parseSettings(small.settings).settings!)
const names = (r: { blocks: { name: string }[] }) => r.blocks.map(b => b.name)
const records = (r: { blocks: { name: string; text: string }[] }) => r.blocks.find(x => x.name === 'housekeeping-records')?.text

test('the records card comes after the short view, also while the view is being built', async ($, on) => {
  let open!: () => void
  const w: World = { argv: [], gate: new Promise<void>(r => { open = r }) }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  const cold = await late($.prompt.context({ blocks: [{ name: 'currentDate', text: 'today' }] }))
  expect(cold === 'late' ? 'late' : names(cold)).toEqual(['currentDate', 'housekeeping', 'housekeeping-records'])
  expect(brief(cold as never)).toBe('housekeeping: the short view is being built and is not ready yet; /housekeeping shows it once it is.')
  expect(records(cold as never)).toBe(CARD)
  open()
  await stored(w)
  const warm = await $.prompt.context({ blocks: [] })
  expect(names(warm)).toEqual(['housekeeping', 'housekeeping-records'])
  expect(records(warm)).toBe(CARD)
})

test('no records card without a settings file', async ($, on) => {
  const w: World = {}
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  expect(records(await $.prompt.context({ blocks: [] }))).toBe(CARD) // with one, there is a card
  w.hasSettings = false
  expect(names(await $.prompt.context({ blocks: [] }))).toEqual([])
})

test('a card that fails to build drops the card only, and the short view is served', async ($, on) => {
  const w: World = {}
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  expect(names(await $.prompt.context({ blocks: [] }))).toEqual(['housekeeping', 'housekeeping-records'])
  let n = 0
  w.failRead = () => ++n === 2 // the view's read of the settings, then the card's, which fails
  const r = await $.prompt.context({ blocks: [] })
  expect(n).toBe(2)
  expect(names(r)).toEqual(['housekeeping'])
  expect(brief(r).startsWith('# Small: where we are')).toBe(true)
})

test('prompt.context adds nothing without a settings file', async ($, on) => {
  world(on, { hasSettings: false })
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  const r = await $.prompt.context({ blocks: [] })
  expect(r.blocks).toEqual([])
})

test('with no pane placed, the short view comes back as text (HK-029)', async ($, on) => {
  world(on, { placed: false })
  await $.session.start(START)
  const r = await run($, '')
  expect(r.text.startsWith('# Small: where we are')).toBe(true)
})

// second check, finding 16: the hook gets the pane's width, not its height, so a docked pane with no room in height
// cut the view with nothing to say so; the docked reply says how to reach the rest and repeats the view's last line
test('no argument opens the pane and sets the status line, and the reply says how to reach the rest and ends with the last line', async ($, on) => {
  const w: World = { status: [] }
  world(on, w)
  await $.session.start(START)
  const r = await run($, '')
  expect(w.status!.at(-1)).toBe('2 land now · 3 need you · next: beta, 3 stops')
  const ui = await $.ui.mount({
    plugin: 'housekeeping', surface: 'terminal', component: 'Pane', requestId: 'housekeeping',
    props: { title: 'housekeeping', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  })
  const md = await ui.find({ type: 'Markdown' })
  expect(md?.props.text).toContain('# Small: where we are')
  const last = String(md?.props.text).split('\n').at(-1)
  expect(last).toMatch(/^\d+ warnings, \d+ errors: \/housekeeping check$/)
  expect(r.text).toBe('housekeeping: short view open. Where the pane is too short for all of it, the wheel, or ctrl+x then Tab, ' +
    `reaches the rest. Its last line:\n${last}`)
  await ui.unmount()
})

const PANE = { plugin: 'housekeeping', surface: 'terminal', component: 'Pane', requestId: 'housekeeping',
  props: { title: 'housekeeping', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} } } as const

// finding 19: on the main screen, and under 110 columns, the pane is placed inline and shows a few lines of the view
test('where the pane has no room to dock, the short view also comes back as text', async ($, on) => {
  const w: World = { status: [] }
  world(on, w)
  await $.session.start(START)
  for (const presentation of [{ isFullscreen: false, columns: 200 }, { isFullscreen: true, columns: 100 }]) {
    const r = await $.command.run({ command: 'housekeeping', args: '', ...RUN, presentation } as never) as { text: string }
    expect(r.text.startsWith('# Small: where we are')).toBe(true)
  }
  expect(w.status!.at(-1)).toContain('land now')
})

// finding 18: the open pane kept the first run's rows and counts
test('a second /housekeeping redraws the open pane with the new view', async ($, on) => {
  const w: World = {}
  world(on, w)
  await $.session.start(START)
  await run($, '')
  const ui = await $.ui.mount(PANE)
  const shown = async () => String((await ui.find({ type: 'Markdown' }))?.props.text)
  expect(await shown()).toContain('B-005 Tidy the build scripts')
  w.backlog = small.backlog.replace('Tidy the build scripts', 'Tidy the build and test scripts')
  await run($, '')
  expect(await shown()).toContain('B-005 Tidy the build and test scripts')
  await ui.unmount()
})

// finding 26: a lane with no stations fell to "all reached", beside a short view saying "no milestone yet"
test('with a path that has no milestone, the status line says no milestone yet', async ($, on) => {
  const settings = small.settings.replace('"milestones":[{"name":"beta"},{"name":"launch"}]', '"milestones":[]')
  expect(settings).not.toBe(small.settings)
  const w: World = { status: [], settings }
  world(on, w)
  await $.session.start(START)
  await run($, '')
  expect(w.status!.at(-1)).toMatch(/ · next: no milestone yet$/)
})

// a made-up repository: one list with ID headings and a box, and a code file
const TRACKED = { 'docs/todo.md': '## T-1 one\n## T-2 two\n- [ ] three\n', 'src/a.ts': 'export const a = 1\n' }

// finding 22: the agent was never told where housekeeping lives, so it guessed the Node command and the format
const WHERE = /^housekeeping is installed at (.+): run its Node command as node \1\/cli\.ts \(survey takes --tracker and --not-tracker\), and read its row format in \1\/FORMAT\.md\.$/
const DENIED_WHERE = new RegExp('^housekeeping is installed at (.+); read its row format in \\1/FORMAT\\.md\\. Not measured counts files ' +
  "the person's Read rules deny, and housekeeping's Node command ignores the Read rules wherever it runs: do not run its survey in " +
  'this session\\. To survey again with --tracker and --not-tracker, ask the person to run /housekeeping survey --tracker <path> ' +
  '--not-tracker <path>, which obeys the rules\\.$')

test('/housekeeping survey hands over the procedure, where housekeeping lives, then the inventory, and writes nothing', async ($, on) => {
  const w: World = { tracked: { ...TRACKED }, reads: [] }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'survey')
  // finding 21: the reply read as the finished result; it says the agent goes on at the next message
  expect(r.text).toBe('housekeeping survey: 2 files read, 1 candidates\nThe agent carries out the survey procedure on your next message, for example "go ahead".')
  expect(r.context[0]).toBe(PROMPTS.survey)
  expect(r.context[1]).toMatch(WHERE)
  expect(w.reads).toContain(posix(`${WHERE.exec(r.context[1])![1]}/prompts/survey.md`))
  expect(r.context[2]).toMatch(/## Candidates.*\n +8\.0 +maybe +docs\/todo\.md: name, 2 ID headings/)
  expect(r.context.length).toBe(3)
  expect(w.written).toBeUndefined()
  expect(w.calls!.length).toBe(0)
})

// Phase 3, the hand-over split: the inventory and the walk are survey's and plan's; another procedure is handed
// with its install sentence and what goes with it, and runs no git. The kit refuses a test's own hooks the $ calls
// their module never makes, so a recording stand-in for $ is the world here.
test('a procedure other than survey and plan is handed with its install sentence and its context, with no ls-files call', async () => {
  const argv: string[][] = [], reads: string[] = []
  const $ = { plugin: { root: '/h' }, session: { root: async () => '/w' },
    fs: { read: async (p: string) => (reads.push(p), PROMPTS[/\/prompts\/(\w+)\.md$/.exec(p)?.[1] ?? ''] ?? '') },
    process: { run: async (a: string[]) => (argv.push(a), { exitCode: 128, stdout: '', stderr: 'fatal: x\n', isStdoutTruncated: false, isStderrTruncated: false }) } } as never
  await readTracked($, '/w') // in the same world the survey's reader lists the tracked files
  expect(argv.map(a => a[1])).toEqual(['ls-files'])
  argv.length = 0
  expect(await handPrompt($, 'standin', 'the install sentence', ['the listing'])).toEqual([PROMPTS.standin, 'the install sentence', 'the listing'])
  expect(reads).toEqual(['/h/prompts/standin.md'])
  expect(argv).toEqual([])
})

test('/housekeeping plan adds the check findings when a .housekeeping.json exists', async ($, on) => {
  const w: World = { tracked: { ...TRACKED } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'plan')
  expect(r.text).toBe('housekeeping plan: 2 files read, 1 candidates\nThe agent carries out the plan procedure on your next message, for example "go ahead".')
  expect(r.context[0]).toBe(PROMPTS.plan)
  expect(r.context[1]).toMatch(WHERE)
  expect(r.context[2]).toContain('docs/todo.md')
  expect(r.context[3]).toContain('recommendation done-milestone')
  w.hasSettings = false
  expect((await run($, 'plan')).context.length).toBe(3)
})

// second check, finding 13 and the two minors that share its cause: the procedure and the install line are hidden
// messages a compaction's summary could drop, and with them the approval rule and the apply rules
const APPROVAL = "Approval is the owner's own message, sent after they have seen the numbered steps."
const MSGS = [{ role: 'user' as const, text: 'go ahead', toolUses: [] }]
const compacts = (on: any) => {
  const told: (string | undefined)[] = []
  on('session.compact', (_: unknown, e: { instructions?: string; messages: unknown[] }) => { told.push(e.instructions); return { messages: e.messages } })
  return told
}

test('after a procedure, each compaction of the conversation is told to keep the install sentence and the approval rule and to re-read the procedure, and goes ahead', async ($, on) => {
  const w: World = { tracked: { ...TRACKED } }
  world(on, w)
  const told = compacts(on)
  await $.session.start(START)
  const where = (await run($, 'plan')).context[1], home = WHERE.exec(where)![1]
  for (const trigger of ['manual', 'auto', 'plugin', 'precompute'] as const) {
    const got = await $.session.compact({ trigger, messages: MSGS, ...(trigger === 'manual' ? { instructions: 'keep the test names' } : {}) })
    expect(got.skip).toBeUndefined()
    expect(got.messages).toEqual(MSGS)
  }
  expect(told.length).toBe(4)
  expect(told[0]!.startsWith('keep the test names\n\n')).toBe(true) // the person's words after /compact stay first
  for (const t of told) {
    expect(t).toContain(`word for word, this sentence: ${where}`)
    expect(t).toContain(APPROVAL)
    expect(t).toContain(`re-read the plan procedure whole, in ${home}/prompts/plan.md, before its next step`)
    expect(t).not.toContain('undefined')
  }
  w.denied = ['docs/todo.md'] // both sent: both named, and the install sentence is the last one sent
  const last = (await run($, 'survey')).context[1]
  await $.session.compact({ trigger: 'auto', messages: MSGS })
  expect(told.at(-1)).toContain(`re-read the plan and survey procedures whole, in ${home}/prompts/plan.md and ${home}/prompts/survey.md`)
  expect(last).toMatch(DENIED_WHERE)
  expect(told.at(-1)).toContain(`this sentence: ${last} Keep`)
  expect(told.at(-1)).not.toContain(where)
  // the file it is sent back to holds the Node lines the denied context had cut (HK-088)
  expect(told.at(-1)).toContain("In this session the survey procedure's lines that name cli.ts do not apply: the survey's re-run is the person's /housekeeping survey.")
  expect(told[0]).not.toContain('do not apply')
})

// Phase 3 call 15: the keep text is in code, by procedure. Survey and plan keep today's bytes (as 0.2.0 wrote them):
// one install sentence, the last sent, or the denied form whenever one was sent; with audit among those sent, each
// procedure's sentence is prefixed with its name.
const OPEN = 'housekeeping is installed at /h: run its Node command.'
const SHUT = 'housekeeping is installed at /h: do not run its survey in this session.'
const AUDIT_AT = 'housekeeping is installed at /h; the audit procedure is /h/prompts/audit.md.'
const RULE = "Keep the procedure's rule on approval: Approval is the owner's own message, sent after they have seen the numbered steps. " +
  'Nothing else is approval, and nothing is written before it.'
const NODE_LINES = " In this session the survey procedure's lines that name cli.ts do not apply: the survey's re-run is the person's /housekeeping survey."
const sentOf = (...e: [string, string][]) => new Map(e.map(([name, install]) => [name, { install }]))
const handed = (names: string, s: string) => `housekeeping: this conversation was handed housekeeping's ${names} procedure${s}. `
const reread = (names: string, s: string, files: string) =>
  `Say in the summary that the agent is to re-read the ${names} procedure${s} whole, in ${files}, before its next step.`

test('the keep text: survey alone, plan alone, both, and survey with a denied file are as 0.2.0 wrote them', () => {
  expect(keep('/h', sentOf(['survey', OPEN]))).toBe(`${handed('survey', '')}Keep in the summary, word for word, this sentence: ${OPEN} ${RULE} ` +
    reread('survey', '', '/h/prompts/survey.md'))
  expect(keep('/h', sentOf(['plan', OPEN]))).toBe(`${handed('plan', '')}Keep in the summary, word for word, this sentence: ${OPEN} ${RULE} ` +
    reread('plan', '', '/h/prompts/plan.md'))
  expect(keep('/h', sentOf(['plan', OPEN], ['survey', SHUT]))).toBe(`${handed('plan and survey', 's')}Keep in the summary, word for word, ` +
    `this sentence: ${SHUT} ${RULE} ${reread('plan and survey', 's', '/h/prompts/plan.md and /h/prompts/survey.md')}${NODE_LINES}`)
  expect(keep('/h', sentOf(['survey', SHUT]))).toBe(`${handed('survey', '')}Keep in the summary, word for word, this sentence: ${SHUT} ${RULE} ` +
    `${reread('survey', '', '/h/prompts/survey.md')}${NODE_LINES}`)
})

test('the keep text keeps the denied form whenever one was sent, even when a sentence that names the Node command came later', () => {
  const t = keep('/h', sentOf(['survey', SHUT], ['plan', OPEN]))
  expect(t).toContain(`this sentence: ${SHUT} Keep`)
  expect(t).not.toContain(OPEN)
  expect(t).toContain(NODE_LINES)
})

test('with audit among those sent, each procedure keeps its own sentence and rule, prefixed with its name', () => {
  expect(keep('/h', sentOf(['plan', OPEN], ['audit', AUDIT_AT]))).toBe(`${handed('plan and audit', 's')}` +
    `In the plan procedure: Keep in the summary, word for word, this sentence: ${OPEN} ${RULE} ` +
    `In the audit procedure: Keep in the summary, word for word, this sentence: ${AUDIT_AT} Keep the procedure's rule on approval: ` +
    "Approval is the owner's own message, sent after they have seen the numbered steps; only clear-cut cases the skeptic agreed with " +
    "are proposed; after this summary, read the audit branch's commits before applying anything, so nothing is applied twice. " +
    reread('plan and audit', 's', '/h/prompts/plan.md and /h/prompts/audit.md'))
  // survey and plan still give one sentence between them, the denied form, beside the audit's
  const three = keep('/h', sentOf(['plan', OPEN], ['survey', SHUT], ['audit', AUDIT_AT]))
  expect(three).toContain(`In the survey procedure: Keep in the summary, word for word, this sentence: ${SHUT} ${RULE} In the audit procedure: `)
  expect(three).not.toContain(OPEN)
  expect(three).not.toContain('In the plan procedure')
})

// the small check of the second round (HK-088, HK-090)
test("with no tree of main's head in the clone, check stops and says so, never two missing files (HK-075)", async ($, on) => {
  world(on, { noTree: true })
  await $.session.start(START)
  const r = await run($, 'check')
  expect(r.exitCode).toBe(1)
  expect(r.text).toContain(`cannot read backlog.md at ${SHA.slice(0, 7)}, whose tree this clone does not hold: housekeeping never fetches. ` +
    'Checking out the main branch fetches it; then run this again.')
})

test('a procedure whose reply the site refuses is not recorded, so a compaction goes on as it came', async ($, on) => {
  world(on, { tracked: { ...TRACKED }, badPrompt: true })
  const told = compacts(on)
  await $.session.start(START)
  await run($, 'plan')
  await $.session.compact({ trigger: 'manual', messages: MSGS, instructions: 'mine' })
  expect(told).toEqual(['mine'])
})

test("a fork's own compaction is told too, since it inherits the procedure; another subagent's is not", async ($, on) => {
  world(on, { tracked: { ...TRACKED } })
  const told = compacts(on)
  const forks: unknown[] = []
  on('agent.spawn', (_: unknown, e: { fork: boolean }) => { forks.push(e.fork); return { model: 'm', agentId: e.fork ? 'f1' : 'a1' } })
  await $.session.start(START)
  await run($, 'plan')
  await ($ as any).agent.spawn({ prompt: 'x', subagentType: 'fork', fork: true })
  await ($ as any).agent.spawn({ prompt: 'x', subagentType: 'general-purpose', fork: false })
  expect(forks).toEqual([true, false])
  await $.session.compact({ trigger: 'auto', messages: MSGS, agentId: 'f1' })
  await $.session.compact({ trigger: 'auto', messages: MSGS, agentId: 'a1' })
  expect(told[0]).toContain(APPROVAL)
  expect(told[1]).toBeUndefined()
})

// the narrow check (HK-091)
test('a fork is told what it inherited, not what the main conversation was handed later; a fork of another subagent is told nothing', async ($, on) => {
  const w: World = { tracked: { ...TRACKED } }
  world(on, w)
  const told = compacts(on)
  let n = 0
  on('agent.spawn', () => ({ model: 'm', agentId: `s${++n}` }))
  await $.session.start(START)
  await run($, 'plan')
  await ($ as any).agent.spawn({ prompt: 'x', subagentType: 'fork', fork: true }) // s1, a fork of main
  await ($ as any).agent.spawn({ prompt: 'x', subagentType: 'general-purpose', fork: false }) // s2
  await ($ as any).agent.spawn({ prompt: 'x', subagentType: 'fork', fork: true, parentAgentId: 's2' }) // s3, a fork of s2
  await ($ as any).agent.spawn({ prompt: 'x', subagentType: 'fork', fork: true, parentAgentId: 's1' }) // s4, a fork of s1
  w.denied = ['docs/todo.md']
  await run($, 'survey') // main is handed the survey too, after the forks
  for (const agentId of ['s1', 's3', 's4']) await $.session.compact({ trigger: 'auto', messages: MSGS, agentId })
  expect(told[0]).toContain("handed housekeeping's plan procedure.")
  expect(told[0]).not.toContain('do not apply')
  expect(told[1]).toBeUndefined()
  expect(told[2]).toContain("handed housekeeping's plan procedure.")
})

test('after a plan alone with a file denied, a compaction says nothing of the Node lines, which the plan was sent whole', async ($, on) => {
  world(on, { tracked: { ...TRACKED }, denied: ['docs/todo.md'] })
  const told = compacts(on)
  await $.session.start(START)
  await run($, 'plan')
  await $.session.compact({ trigger: 'auto', messages: MSGS })
  expect(told[0]).toContain(APPROVAL)
  expect(told[0]).not.toContain('do not apply')
})

test('a rebuild that rejects is said as a failure and is not walked at every prompt', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  Object.assign(w, { mainSha: 'f'.repeat(40), logThrow: true })
  w.argv!.length = 0
  let text = ''
  for (let i = 0; i < 100 && !text.includes('could not be built'); i++) {
    text = brief(await $.prompt.context({ blocks: [] }))
    await new Promise(r => setTimeout(r, 5))
  }
  expect(text).toContain('a new one could not be built: housekeeping: ') // the kit reports a throwing fake as its own rejection
  for (let i = 0; i < 3; i++) await $.prompt.context({ blocks: [] })
  expect(walks(w)).toBe(1)
})

test('two settings texts keep two stored views, so worktrees whose settings differ do not rebuild over each other', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  w.settings = small.settings.replace('"Small"', '"Other"') // the other worktree's settings
  await $.prompt.context({ blocks: [] })
  await until(() => walks(w) === 2)
  await until(() => Object.keys(kept(w)?.views ?? {}).length === 2)
  w.settings = undefined // back: its own view is still stored, so no walk
  w.argv!.length = 0
  expect(brief(await $.prompt.context({ blocks: [] }))).not.toContain('shown while a new one is built')
  expect(walks(w)).toBe(0)
})

// the re-check (HK-092)
test('a repository keeps at most sixteen stored views, the latest settings texts, under one key', async ($, on) => {
  const w: World = { argv: [], stored: { 'brief:/w/.git': { sha: SHA, stamp: 'an older form', brief: 'old', status: '' } } }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await until(() => !!entry(w)) // the start's own build first: two builds at once each write over the other's list
  for (let i = 1; i <= 18; i++) {
    w.settings = small.settings.replace('"Small"', `"P${i}"`)
    await $.prompt.context({ blocks: [] })
    await until(() => walks(w) === i + 1 && (kept(w)?.order?.length ?? 0) === Math.min(i + 1, 16))
  }
  expect(kept(w)!.order!.length).toBe(16)
  expect(Object.keys(kept(w)!.views!).sort()).toEqual([...kept(w)!.order!].sort())
  expect(Object.keys(w.stored!).filter(k => k.startsWith('brief:'))).toEqual(['brief:/w/.git'])
})

test('a refused write of the short view is said, and prompts do not walk again at every turn', async ($, on) => {
  const w: World = { argv: [], storeFull: true }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await until(() => walks(w) === 1)
  let text = ''
  for (let i = 0; i < 100 && !text.includes('could not be stored'); i++) {
    text = brief(await $.prompt.context({ blocks: [] }))
    await new Promise(r => setTimeout(r, 5))
  }
  // the view it built is served, with the reason (HK-093)
  expect(text.startsWith('housekeeping: the short view was built but could not be stored: ')).toBe(true)
  expect(text).toContain('\n# Small: where we are (abcdef0, 2026-09-12)\n')
  for (let i = 0; i < 3; i++) await $.prompt.context({ blocks: [] })
  expect(walks(w)).toBeLessThanOrEqual(2)
})

test('a damaged stored entry is read as none and replaced, never thrown on (HK-093)', async ($, on) => {
  const w: World = { argv: [], stored: { 'brief:/w/.git': { order: 'not a list', views: [1, 2] } } }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  expect(brief(await $.prompt.context({ blocks: [] }))).toContain('# Small: where we are')
  w.stored!['brief:/w/.git'] = { order: ['x'], views: { x: 'a string' } }
  w.mainSha = 'f'.repeat(40)
  await $.prompt.context({ blocks: [] })
  await stored(w, w.mainSha)
})

test("a resumed fork keeps the record it had, not the main conversation's current one", async ($, on) => {
  const w: World = { tracked: { ...TRACKED } }
  world(on, w)
  const told = compacts(on)
  on('agent.spawn', (_: unknown, e: { resume?: { agentId: string } }) => ({ model: 'm', agentId: e.resume?.agentId ?? 'f1' }))
  await $.session.start(START)
  await ($ as any).agent.spawn({ prompt: 'x', subagentType: 'fork', fork: true }) // f1, before any procedure: none
  await run($, 'plan')
  await ($ as any).agent.spawn({ prompt: 'go on', subagentType: 'fork', fork: true, resume: { agentId: 'f1' } })
  await $.session.compact({ trigger: 'auto', messages: MSGS, agentId: 'f1' })
  expect(told[0]).toBeUndefined()
})

test('a compaction with odd input still goes ahead (HK-090)', async ($, on) => {
  world(on, { tracked: { ...TRACKED } })
  const told = compacts(on)
  await $.session.start(START)
  await run($, 'plan')
  for (const e of [{ instructions: '' }, { agentId: '' }, { instructions: 42 }])
    expect((await $.session.compact({ trigger: 'manual', messages: MSGS, ...e } as never)).skip).toBeUndefined()
  expect(told.length).toBe(3)
})

test('a rebuild that fails is said at the next prompt, with its first line, and is not walked again (HK-088)', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await stored(w)
  Object.assign(w, { mainSha: 'f'.repeat(40), logFail: 'fatal: unable to read tree (0ff1621)\n' })
  w.argv!.length = 0
  let text = ''
  for (let i = 0; i < 100 && !text.includes('could not be built'); i++) {
    text = brief(await $.prompt.context({ blocks: [] }))
    await new Promise(r => setTimeout(r, 5))
  }
  expect(text.startsWith('Stored view of main at abcdef0; a new one could not be built: ')).toBe(true)
  expect(text).toContain('fatal: unable to read tree (0ff1621)')
  brief(await $.prompt.context({ blocks: [] }))
  expect(walks(w)).toBe(1)
  // the cure run, a minute on: the next prompt tries again, with main's commit unchanged, and the view comes back
  Object.assign(w, { logFail: undefined, now: '2026-09-12T10:01:01Z' })
  await $.prompt.context({ blocks: [] })
  await stored(w, w.mainSha)
  expect(walks(w)).toBe(2)
  expect(brief(await $.prompt.context({ blocks: [] }))).not.toContain('could not be built')
})

test('with no procedure sent, after a failed one, in a subagent\'s compaction or after /clear, a compaction goes on as it came', async ($, on) => {
  const w: World = { tracked: { ...TRACKED }, lsFail: true }
  world(on, w)
  const told = compacts(on)
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  await $.session.start(START)
  const compact =(e: object = {}) => $.session.compact({ trigger: 'manual', messages: MSGS, instructions: 'mine', ...e })
  expect((await compact()).skip).toBeUndefined()
  await run($, 'check')
  await run($, '')
  expect((await run($, 'plan')).exitCode).toBe(1) // git failed: no procedure went to the agent
  await compact()
  w.lsFail = false
  await run($, 'plan')
  await compact({ agentId: 'a1' }) // a subagent's own transcript never held it
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  await compact()
  expect(told).toEqual(['mine', 'mine', 'mine', 'mine'])
})

// finding 3: the survey read past the person's Read deny rules, and its context carried the denied files' lines
test('the survey reads no file the Read rules deny, names none, and counts them in Not measured', async ($, on) => {
  const w: World = { reads: [], denied: ['secret/plan.md', 'README.md'], tracked: { ...TRACKED,
    'secret/plan.md': '## S-1 hidden one\n## S-2 hidden two\n', 'README.md': 'The backlog is secret/plan.md; the word is swordfish.\n' } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'survey')
  expect(r.text).toContain('2 files read, 1 candidates')
  const inv = r.context.at(-1)
  expect(inv).toContain('\nFiles not read: 2 denied by Read rules.\n')
  for (const word of ['secret', 'hidden', 'swordfish', 'README']) expect(inv).not.toContain(word)
  expect(w.reads!.filter(p => /secret|README/.test(p))).toEqual([])
  // second check, finding 1: the Node command would read the denied files, so the context names none and sends the
  // re-run to the person's slash command; plan keeps its procedure whole
  expect(r.context.join('\n')).not.toContain('cli.ts')
  expect(r.context[0]).toBe('# the survey procedure')
  expect(r.context[1]).toMatch(DENIED_WHERE)
  const plan = await run($, 'plan')
  expect(plan.context[0]).toBe(PROMPTS.plan)
  expect(plan.context[1]).toMatch(DENIED_WHERE)
  // every tracker denied: what was measured, never "nothing to move"
  w.denied = Object.keys(w.tracked!)
  const all = await run($, 'survey')
  expect(all.text).toContain("0 files read, 0 candidates: no file reached the survey's score of 3")
  expect(all.text).not.toContain('nothing to move')
  expect(all.context.at(-1)).toContain('\nFiles not read: 4 denied by Read rules.\n')
})

// second check, finding 4: in a session started in a subfolder the top's deny rules are not in force, and the engine
// answers a file outside that folder with an ask and no rule, which the survey read as allowed
test('in a subfolder session an ask with no rule for a file outside the folder is not read, is counted, and the reply says to start at the top', async ($, on) => {
  const w: World = { start: '/w/docs', top: '/w', reads: [], asked: ['secret.md', 'docs/notes.md'], tracked: {
    'docs/todo.md': TRACKED['docs/todo.md'], 'docs/notes.md': 'TODO: x\n', 'secret.md': '## S-1 hidden one\n## S-2 hidden two\n' } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'survey')
  expect(w.reads!.filter(p => p.includes('secret'))).toEqual([])
  expect(w.reads).toContain('/w/docs/notes.md') // inside the session's folder an ask is read, as before
  // no rule denied it, so it is counted as what it is (HK-088)
  expect(r.context.at(-1)).toContain('\nFiles not read: 1 outside the folder this session started in.\n')
  expect(r.context[1]).toContain("Not measured counts files outside the folder this session started in, where the Read rules of the repository's top are not in force, and")
  expect(r.context.join('\n')).not.toContain('hidden')
  expect(r.text).toBe('housekeeping survey: 2 files read, 1 candidates\n1 files outside the folder this session started in were not read, ' +
    "since the repository's Read rules are not in force here: start the session at the top of the repository, /w, to survey them.\n" +
    'The agent carries out the survey procedure on your next message, for example "go ahead".')
  w.start = '/w' // from the top, the same ask is read
  expect((await run($, 'survey')).text).toBe('housekeeping survey: 3 files read, 2 candidates\nThe agent carries out the survey procedure on your next message, for example "go ahead".')
})

// finding 7: a failed listing or a limit read as "nothing to move", and the reply gave no sign of the stop
test('a failed git listing replies exit 1 with what git said, and a limit that stopped the reading is named in the reply', async ($, on) => {
  const w: World = { lsFail: true, tracked: { ...TRACKED } }
  world(on, w)
  await $.session.start(START)
  for (const arg of ['survey', 'plan']) {
    const r = await run($, arg)
    expect(r.exitCode).toBe(1)
    expect(r.text).toBe('housekeeping: cannot list the tracked files in /w: git said: fatal: not a git repository (or any of the parent directories): .git')
  }
  Object.assign(w, { lsFail: false, lsCut: true })
  const cut = await run($, 'survey')
  expect(cut.exitCode ?? 0).toBe(0)
  expect(cut.text).toContain('; a limit stopped the reading: past the end of a cut-short list of tracked files')
})

// finding 8, re-scoring: the person answers the suspects, and the survey runs again with the answers
test('/housekeeping survey takes --tracker and --not-tracker, repeatable, a quoted path with spaces too', async ($, on) => {
  const w: World = { tracked: { ...TRACKED, 'tasks.yaml': 'items: []\n', 'docs/my list.md': 'TODO: x\n', 'NOTES.md': 'TODO: y\n' } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'survey --tracker tasks.yaml --tracker "docs/my list.md" --not-tracker docs/todo.md --not-tracker NOTES.md')
  expect(r.exitCode ?? 0).toBe(0)
  const inv = r.context.at(-1)
  expect(inv).toContain('\n## Candidates (score, hint, path: signals)\n   0.0  maybe           docs/my list.md: named by --tracker\n' +
    '   0.0  maybe           tasks.yaml: named by --tracker\n\n')
  // second check, finding 12: the not-tracker answers reach the agent, on their one line and nowhere else
  const answers = 'Answers in this run: --tracker docs/my list.md, tasks.yaml; --not-tracker docs/todo.md, NOTES.md.'
  expect(inv.split('\n').filter(l => /docs\/todo\.md|NOTES\.md/.test(l))).toEqual([answers])
  const bad = await run($, 'survey --tracker gone.md')
  expect(bad.exitCode).toBe(1)
  expect(bad.text).toBe('housekeeping: not a tracked file: gone.md (paths are from the top of /w)')
  for (const arg of ['survey --tracker', 'survey --other x', 'plan --tracker tasks.yaml'])
    expect((await run($, arg)).text).toContain('housekeeping: [map | map new | check | init | survey')
})

// finding 8: "nothing to move" is for a repository with no tracked files; otherwise the reply says what was measured
test('with no candidates the survey says no file reached its score of 3, and counts the suspects', async ($, on) => {
  world(on, { tracked: { 'src/a.ts': TRACKED['src/a.ts'], 'NOTES.md': 'TODO: one\n' } })
  await $.session.start(START)
  const r = await run($, 'survey')
  expect(r.text).toContain("2 files read, 0 candidates: no file reached the survey's score of 3 (1 suspects)")
  expect(r.text).not.toContain('nothing to move')
  expect(r.context.at(-1)).toContain('\n## Suspects (below the score of 3, with some sign of pending work)\nNOTES.md: 1 TODOs')
})

test('in a repository with no tracked files, the survey says there is nothing to move', async ($, on) => {
  world(on, { tracked: {} })
  await $.session.start(START)
  const r = await run($, 'survey')
  expect(r.text).toContain('0 files read, 0 candidates: no tracked files, nothing to move; /housekeeping init sets up the pair')
})

// Phase 3, Task 2: /housekeeping owed on the plugin route. B-001 waits on src/a.ts and LIMIT; the range changes
// src/a.ts, secret/key.txt (which the Read rules deny) and big.txt, each holding LIMIT on an added line
const OWED_BACKLOG = small.backlog.replace('Before the beta.', 'When `src/a.ts` or `LIMIT` changes.')
const C1 = 'c'.repeat(40)
const section = (p: string, text: string) => `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n@@ -0,0 +1 @@\n+${text}\n`
const OWED = () => ({
  names: 'M\0src/a.ts\0M\0secret/key.txt\0M\0big.txt\0',
  log: `${C1}\tFix B-001 now\0\0`,
  paths: `${C1}\0\nM\0src/a.ts\0M\0secret/key.txt\0M\0big.txt\0`,
  diffs: { 'src/a.ts': section('src/a.ts', 'const LIMIT = 1'), 'secret/key.txt': section('secret/key.txt', 'LIMIT hidden-value'),
    'big.txt': section('big.txt', 'LIMIT big') },
})
const hunkCalls = (w: World) => w.argv!.filter(a => a[1] === '-c').map(a => a.slice(a.indexOf('--') + 1))

test('/housekeeping owed counts a denied path and never reads or names it, in the reply or the time-out reply; its git runs with no locks and no fetch', async ($, on) => {
  const w: World = { backlog: OWED_BACKLOG, owed: OWED(), denied: ['secret/key.txt'], argv: [], envs: [] }
  world(on, w)
  await $.session.start(START)
  w.argv!.length = 0
  w.envs!.length = 0
  const r = await run($, 'owed')
  expect(r.exitCode ?? 0).toBe(0)
  expect(r.text).toMatch(/^housekeeping owed: 1234567\.\.abcdef0, 1 commits, 3 changed paths; 1 excluded by the Read rules, never read or named\n/)
  expect(r.text).toContain('- B-001 Rate-limit the export endpoint: `src/a.ts` matched src/a.ts; `LIMIT` matched src/a.ts line 1 and 1 more\n')
  expect(r.text).toContain(`- ${C1.slice(0, 7)}: src/a.ts, big.txt; 1 excluded\n`)
  for (const no of ['secret', 'hidden-value']) expect([no, r.text.includes(no)]).toEqual([no, false])
  expect(hunkCalls(w)).toEqual([[':(literal)src/a.ts', ':(literal)big.txt']])
  // each git call only owed makes (the short view's background build, which session start began, makes the others too)
  const only = (a: string[]) => ['merge-base', 'diff', '-c'].includes(a[1]) || (a[1] === 'log' && a.includes('-z')) ||
    (a[1] === 'rev-parse' && String(a.at(-1)).endsWith('^{commit}'))
  const owedEnvs = w.envs!.filter((_, i) => only(w.argv![i]))
  expect(owedEnvs.length).toBe(8) // HEAD, main, the merge base, main's tip in the range, the paths, the commits, theirs, one batch
  for (const env of owedEnvs) expect(env).toEqual({ GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1' })
  // the same run, failing in the hook (a run with no presentation), names no path and offers no Node command
  const t = await $.command.run({ command: 'housekeeping', args: 'owed', origin: { kind: 'composer' } } as never) as { text: string }
  expect(t.text).toContain('run /housekeeping owed again')
  expect(t.text.includes('secret')).toBe(false)
})

test('a batch cut short is read again in halves, so only the path cut short on its own is counted as not read', async ($, on) => {
  const w: World = { backlog: OWED_BACKLOG, owed: { ...OWED(), cut: ['big.txt'] }, argv: [] }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'owed')
  expect(r.exitCode ?? 0).toBe(0)
  expect(r.text).toMatch(/, 3 changed paths; 1 not read \(cut short or unreadable\)\n/)
  expect(r.text).toContain('`LIMIT` matched src/a.ts line 1 and 1 more\n')
  expect(hunkCalls(w).map(c => c.length)).toEqual([3, 1, 2, 1, 1])
  // each pathspec counts 11 characters more than its path (":(literal)" and a space): 12, 13 and 14 here
  expect(batches(['a', 'bb', 'ccc'], 24)).toEqual([['a'], ['bb'], ['ccc']])
  expect(batches(['a', 'bb', 'ccc'], 25)).toEqual([['a', 'bb'], ['ccc']])
  expect(batches(['a', 'bb', 'ccc'], 39)).toEqual([['a', 'bb', 'ccc']])
})

test('owed exits 2 on a usage error and with no settings; a run that finished clear leaves no clear flag for the next one', async ($, on) => {
  const w: World = { backlog: OWED_BACKLOG, owed: OWED() }
  world(on, w)
  await $.session.start(START)
  for (const args of ['owed --bogus x', 'owed --base', 'owed --base a --base b']) {
    const r = await run($, args)
    expect([args, r.exitCode, r.text]).toEqual([args, 2, 'housekeeping: owed [--base <ref>] [--head <ref>]'])
  }
  expect((await run($, 'owed')).exitCode ?? 0).toBe(0) // every Read check finished, nothing excluded
  const t = await $.command.run({ command: 'housekeeping', args: 'owed', origin: { kind: 'composer' } } as never) as { text: string }
  expect(t.text).toContain('run /housekeeping owed again') // the failed run's own checks never ran
  w.hasSettings = false
  const none = await run($, 'owed')
  expect([none.exitCode, none.text]).toEqual([2, 'housekeeping: no .housekeeping.json here (run /housekeeping init)'])
})

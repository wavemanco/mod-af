import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import * as small from './fixtures/small.ts'
import { isOwnPage } from '../hooks/adapter.ts'

const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
// the fullscreen layout from 110 columns, where the pane docks beside the transcript with room
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
const SHA = 'abcdef0123456789abcdef0123456789abcdef01'
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
  failRead?: boolean
  pub?: object
  tracked?: Record<string, string> // the survey's files, by path under /w
  denied?: string[] // tracked paths the person's Read rules deny
  lsFail?: boolean // git ls-files exits 128
  lsCut?: boolean // git ls-files output is cut short
  reads?: string[] // every path fs.read was asked for
  backlog?: string // main's backlog.md, small.ts's by default
  settings?: string // .housekeeping.json, small.ts's by default
  gate?: Promise<void> // the history walk's git log waits for it: a slow repository
  badPrompt?: boolean // a procedure file reads as a number, so the command's reply is one the site refuses
}

// the engine may hand a hook a Windows-style path
const posix = (p: string) => p.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '')
// stand-ins for prompts/*.md: the test kit imports code files only, so it cannot read the real ones
const PROMPTS: Record<string, string> = { survey: '# the survey procedure', plan: '# the plan procedure' }
const under = (p: string) => posix(p).replace(/^\/w\//, '')

// The engine stand-ins: git answers from small.ts's files, tools are logged, the store is a map.
function world(on: On, w: World = {}) {
  const files = (): Record<string, string> => ({ 'backlog.md': w.backlog ?? small.backlog, 'playbook.md': small.playbook })
  const stored = (w.stored ??= {})
  const calls = (w.calls ??= [])
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w' }))
  on('session.root', () => ({ value: w.start ?? '/w' }))
  on('clock.now', () => ({ value: Date.parse(w.now ?? '2026-09-12T10:00:00Z') }))
  on('fs.exists', (_, e) => (w.paths?.push(posix(e.path)), { value: w.hasSettings !== false && e.path.endsWith('.housekeeping.json') }))
  on('fs.read', (_, e) => {
    w.reads?.push(posix(e.path))
    if (w.failRead) throw new Error('EIO')
    const prompt = /\/prompts\/(survey|plan)\.md$/.exec(posix(e.path))
    if (prompt && w.badPrompt) return { value: 42 as never }
    return { value: prompt ? PROMPTS[prompt[1]] : w.tracked?.[under(e.path)] ?? w.settings ?? small.settings }
  })
  on('process.run', (_, e) => {
    w.argv?.push([...e.argv])
    w.envs?.push(e.init?.env)
    const [, a, b] = e.argv
    if (w.blobless && a === 'show') return { value: { exitCode: 128, stdout: '', stderr: 'fatal: bad object x\n', isStdoutTruncated: false, isStderrTruncated: false } }
    if (w.blobless && b === '--verify' && String(e.argv.at(-1)).includes(':')) return ok('5626abf0f72e58d7a153368ba57db4c673c0e171\n')
    if (a === 'ls-files' && w.lsFail) return { value: { exitCode: 128, stdout: '', isStdoutTruncated: false, isStderrTruncated: false,
      stderr: 'fatal: not a git repository (or any of the parent directories): .git\n' } }
    if (a === 'ls-files') return ok(Object.keys(w.tracked ?? {}).map(p => `${p}\0`).join(''), 0, w.lsCut)
    if (w.gitFail && (a === 'log' || b === '--verify')) return { value: { exitCode: 128, stdout: '', stderr: w.gitFail, isStdoutTruncated: false, isStderrTruncated: false } }
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
    // with more arguments: the common dir, then main's commit, then the branch
    if (a === 'rev-parse' && b === '--path-format=absolute') return ok(e.argv.length > 4 ? `/w/.git\n${w.mainSha ?? SHA}\nmain\n` : '/w/.git\n')
    return ok('', 1)
  })
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => { stored[e.key] = e.value; return { value: undefined } })
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
  on('tool.check', { tool: 'Read' }, (_, e) =>
    ({ decision: w.denied?.includes(under(String((e.input as { file_path?: string }).file_path))) ? 'deny' : 'allow' }))
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
  expect((await run($, '')).text).toBe('housekeeping: short view open')
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
const stored = (w: World, sha = SHA) => until(() => (w.stored!['brief:/w/.git'] as { sha?: string } | undefined)?.sha === sha)

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
  await until(() => 'brief:/w/.git' in w.stored!)
  const first = brief(await $.prompt.context({ blocks: [] }))
  expect(first.startsWith('# Small: where we are (abcdef0, 2026-09-12)')).toBe(true)
  w.gate = shut()
  w.mainSha = 'f'.repeat(40)
  const stale = await late($.prompt.context({ blocks: [] }))
  expect(stale === 'late' ? 'late' : brief(stale)).toBe(`Stored view of main at abcdef0, shown while a new one is built.\n${first}`)
  open()
  await until(() => walks(w) === 2 && (w.stored!['brief:/w/.git'] as { sha: string }).sha === 'f'.repeat(40))
  expect(walks(w)).toBe(2) // session start's and the rebuild: a prompt starts no second walk of its own
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

// a tied minor: in a blobless clone git show fetched, and a show that failed read as a missing file
test('git runs with lazy fetching off, and a blob the clone does not hold is reported, not read as a missing file', async ($, on) => {
  const w: World = { blobless: true, argv: [], envs: [] }
  world(on, w)
  await $.session.start(START)
  w.envs!.length = w.argv!.length = 0
  const r = await run($, 'check')
  expect(r.exitCode).toBe(1)
  expect(r.text).toContain(`cannot read backlog.md at ${SHA.slice(0, 7)}, which this clone does not hold: housekeeping never fetches (git said: fatal: bad object x)`)
  w.argv!.forEach((a, i) => { if (a[1] === 'log' || a[1] === 'show') expect(w.envs![i]?.GIT_NO_LAZY_FETCH).toBe('1') })
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

test('no argument opens the pane and sets the status line', async ($, on) => {
  const w: World = { status: [] }
  world(on, w)
  await $.session.start(START)
  const r = await run($, '')
  expect(r.text).toBe('housekeeping: short view open')
  expect(w.status!.at(-1)).toBe('2 land now · 3 need you · next: beta, 3 stops')
  const ui = await $.ui.mount({
    plugin: 'housekeeping', surface: 'terminal', component: 'Pane', requestId: 'housekeeping',
    props: { title: 'housekeeping', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
  })
  const md = await ui.find({ type: 'Markdown' })
  expect(md?.props.text).toContain('# Small: where we are')
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
  // every tracker denied: what was measured, never "nothing to move"
  w.denied = Object.keys(w.tracked!)
  const all = await run($, 'survey')
  expect(all.text).toContain("0 files read, 0 candidates: no file reached the survey's score of 3")
  expect(all.text).not.toContain('nothing to move')
  expect(all.context.at(-1)).toContain('\nFiles not read: 4 denied by Read rules.\n')
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
  // finding 12 of the fix round's check: the not-tracker answers reach the agent, on their one line and nowhere else
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

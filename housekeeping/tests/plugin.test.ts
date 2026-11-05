import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import * as small from './fixtures/small.ts'
import { isOwnPage } from '../hooks/adapter.ts'

const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
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
  reads?: string[] // every path fs.read was asked for
  backlog?: string // main's backlog.md, small.ts's by default
}

// the engine may hand a hook a Windows-style path
const posix = (p: string) => p.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '')
// stand-ins for prompts/*.md: the test kit imports code files only, so it cannot read the real ones
const PROMPTS: Record<string, string> = { survey: '# the survey procedure', plan: '# the plan procedure' }
const under = (p: string) => posix(p).replace(/^\/w\//, '')

// The engine stand-ins: git answers from small.ts's files, tools are logged, the store is a map.
function world(on: On, w: World = {}) {
  const files: Record<string, string> = { 'backlog.md': w.backlog ?? small.backlog, 'playbook.md': small.playbook }
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
    return { value: prompt ? PROMPTS[prompt[1]] : w.tracked?.[under(e.path)] ?? small.settings }
  })
  on('process.run', (_, e) => {
    w.argv?.push([...e.argv])
    const [, a, b] = e.argv
    if (a === 'ls-files') return ok(Object.keys(w.tracked ?? {}).map(p => `${p}\0`).join(''))
    if (a === 'log') return w.noBranch ? ok('', 128) : ok(`${SHA}\t2026-09-12\thead\n`)
    if (a === 'show') {
      const text = files[String(e.argv.at(-1)).split(':')[1]]
      if (w.truncateShow) return ok('# cut', 0, true)
      return ok(text ?? '', text === undefined ? 128 : 0)
    }
    if (a === 'rev-parse' && b === '--abbrev-ref') return ok('main\n')
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

test('prompt.context adds the short view', async ($, on) => {
  world(on)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  const r = await $.prompt.context({ blocks: [{ name: 'currentDate', text: 'today' }] })
  const b = r.blocks.find((x: { name: string }) => x.name === 'housekeeping')
  expect(b.text.startsWith('# Small: where we are')).toBe(true)
})

const walks = (w: World) => w.argv!.filter(a => a[1] === 'log' && a.includes('--reverse')).length
const brief = (r: { blocks: { name: string; text: string }[] }) => r.blocks.find(x => x.name === 'housekeeping')?.text ?? ''

test('prompt.context awaits the load session start began, with no second history walk', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  const r = await $.prompt.context({ blocks: [] })
  expect(brief(r).startsWith('# Small: where we are')).toBe(true)
  expect(walks(w)).toBe(1)
})

test('with main unchanged, the short view costs one git rev-parse; a new main commit rebuilds it', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  const first = brief(await $.prompt.context({ blocks: [] }))
  w.argv!.length = 0
  expect(brief(await $.prompt.context({ blocks: [] }))).toBe(first)
  expect(w.argv!.every(a => a[1] === 'rev-parse')).toBe(true)
  expect(walks(w)).toBe(0)
  w.mainSha = 'f'.repeat(40)
  w.argv!.length = 0
  expect(brief(await $.prompt.context({ blocks: [] }))).toBe(first)
  expect(walks(w)).toBe(1)
})

test('a moved remote copy of main rebuilds the short view (HK-034)', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await $.prompt.context({ blocks: [] })
  w.remoteSha = 'a'.repeat(40)
  await $.prompt.context({ blocks: [] })
  expect(walks(w)).toBe(2)
})

test('a new day with main unchanged does not walk the history again (HK-035)', async ($, on) => {
  const w: World = { argv: [] }
  world(on, w)
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  await $.prompt.context({ blocks: [] })
  w.now = '2026-09-13T10:00:00Z'
  await $.prompt.context({ blocks: [] })
  expect(walks(w)).toBe(1)
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

// a made-up repository: one list with ID headings and a box, and a code file
const TRACKED = { 'docs/todo.md': '## T-1 one\n## T-2 two\n- [ ] three\n', 'src/a.ts': 'export const a = 1\n' }

test('/housekeeping survey hands over the procedure, then the inventory, and writes nothing', async ($, on) => {
  const w: World = { tracked: { ...TRACKED } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'survey')
  expect(r.text).toBe('housekeeping survey: 2 files read, 1 candidates')
  expect(r.context[0]).toBe(PROMPTS.survey)
  expect(r.context[1]).toMatch(/## Candidates.*\n +8\.0 +maybe +docs\/todo\.md: name, 2 ID headings/)
  expect(r.context.length).toBe(2)
  expect(w.written).toBeUndefined()
  expect(w.calls!.length).toBe(0)
})

test('/housekeeping plan adds the check findings when a .housekeeping.json exists', async ($, on) => {
  const w: World = { tracked: { ...TRACKED } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'plan')
  expect(r.text).toBe('housekeeping plan: 2 files read, 1 candidates')
  expect(r.context[0]).toBe(PROMPTS.plan)
  expect(r.context[1]).toContain('docs/todo.md')
  expect(r.context[2]).toContain('recommendation done-milestone')
  w.hasSettings = false
  expect((await run($, 'plan')).context.length).toBe(2)
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

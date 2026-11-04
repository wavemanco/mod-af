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
}

// the engine may hand a hook a Windows-style path
const posix = (p: string) => p.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '')

// The engine stand-ins: git answers from small.ts's files, tools are logged, the store is a map.
function world(on: On, w: World = {}) {
  const files: Record<string, string> = { 'backlog.md': small.backlog, 'playbook.md': small.playbook }
  const stored = (w.stored ??= {})
  const calls = (w.calls ??= [])
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/w' }))
  on('session.root', () => ({ value: '/w' }))
  on('clock.now', () => ({ value: Date.parse('2026-09-12T10:00:00Z') }))
  on('fs.exists', (_, e) => ({ value: w.hasSettings !== false && e.path.endsWith('.housekeeping.json') }))
  on('fs.read', () => ({ value: small.settings }))
  on('process.run', (_, e) => {
    w.argv?.push([...e.argv])
    const [, a, b] = e.argv
    if (a === 'log') return w.noBranch ? ok('', 128) : ok(`${SHA}\t2026-09-12\thead\n`)
    if (a === 'show') {
      const text = files[String(e.argv.at(-1)).split(':')[1]]
      if (w.truncateShow) return ok('# cut', 0, true)
      return ok(text ?? '', text === undefined ? 128 : 0)
    }
    if (a === 'rev-parse' && b === '--abbrev-ref') return ok('main\n')
    if (a === 'rev-parse' && b === '--verify') return ok('', 1)
    if (a === 'rev-parse' && b === '--path-format=absolute') return ok('/w/.git\n')
    return ok('', 1)
  })
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => { stored[e.key] = e.value; return { value: undefined } })
  on('store.delete', (_, e) => { delete stored[e.key]; return { value: undefined } })
  on('tool.list', () => ({ value: w.noArtifact ? [{ name: 'Write', description: '', mcp: false }] : [{ name: 'Write', description: '', mcp: false }, { name: 'Artifact', description: '', mcp: false }] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', (_, e) => { w.status?.push(e.text); return { value: undefined } })
  // the root is itself; the page and its folder are missing unless w.stats says otherwise
  on('fs.stat', (_, e) => {
    const s = posix(e.path) === '/w' ? { isLink: false, realPath: '/w' } : w.stats?.[posix(e.path)]
    if (!s) throw new Error(`ENOENT: ${e.path}`)
    return { value: { kind: 'file', size: 1, mtimeMs: 0, ...s } }
  })
  on('fs.write', (_, e) => {
    if (w.failWrite) throw new Error(w.failWrite)
    ;(w.written ??= {})[posix(e.path)] = e.text
    return { value: undefined }
  })
  on('tool.call', { tool: 'Read' }, (_, e) => { calls.push({ tool: 'Read', file_path: e.file_path }); return { result: 'x' } as never })
  on('tool.call', { tool: 'Write' }, (_, e) => { calls.push({ tool: 'Write', file_path: e.file_path }); return { result: 'ok' } as never })
  on('tool.call', { tool: 'Artifact' }, (_, e) => {
    calls.push({ tool: 'Artifact', action: e.action, url: e.url, title: e.title })
    if (e.action === 'read' && w.readError) return { isError: true, text: w.readError, result: null } as never
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

test('a stored link with no access is forgotten too', async ($, on) => {
  const w: World = { readError: 'You do not have access to this artifact', stored: { ...KNOWN } }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(r.text).toContain(FORGOT)
  expect('repo:/w/.git' in w.stored!).toBe(false)
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

test('prompt.context adds nothing without a settings file', async ($, on) => {
  world(on, { hasSettings: false })
  on('prompt.context', (_, e) => ({ blocks: e.blocks }))
  await $.session.start(START)
  const r = await $.prompt.context({ blocks: [] })
  expect(r.blocks).toEqual([])
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

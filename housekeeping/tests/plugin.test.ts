import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import * as small from './fixtures/small.ts'

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
  denyWrite?: string
  status?: (string | undefined)[]
  calls?: { tool: string; action?: string; url?: string; file_path?: string; title?: string }[]
  stored?: Record<string, unknown>
  argv?: string[][]
}

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
    if (a === 'log') return ok(`${SHA}\t2026-09-12\thead\n`)
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
  on('tool.list', () => ({ value: w.noArtifact ? [{ name: 'Write', description: '', mcp: false }] : [{ name: 'Write', description: '', mcp: false }, { name: 'Artifact', description: '', mcp: false }] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', (_, e) => { w.status?.push(e.text); return { value: undefined } })
  on('tool.call', { tool: 'Read' }, () => ({ result: 'x' }) as never)
  on('tool.call', { tool: 'Write' }, (_, e) => {
    calls.push({ tool: 'Write', file_path: e.file_path })
    return (w.denyWrite ? { deny: w.denyWrite } : { result: 'ok' }) as never
  })
  on('tool.call', { tool: 'Artifact' }, (_, e) => {
    calls.push({ tool: 'Artifact', action: e.action, url: e.url, title: e.title })
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
  expect(w.calls!.map(c => c.tool + (c.action ? ':' + c.action : ''))).toEqual(['Write', 'Artifact:publish'])
  expect(w.calls![0].file_path!.endsWith('.housekeeping/route-map.html')).toBe(true)
  expect(w.calls![1].title).toBe('Small Route Map')
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

test('without an Artifact tool, map says the file path', async ($, on) => {
  const w: World = { noArtifact: true }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(r.text).toContain(LINE)
  expect(r.text).toContain('/w/.housekeeping/route-map.html')
  expect(w.calls!.some(c => c.tool === 'Artifact')).toBe(false)
})

test('a Write deny is reported and nothing is published', async ($, on) => {
  const w: World = { denyWrite: 'not allowed here' }
  world(on, w)
  await $.session.start(START)
  const r = await run($, 'map')
  expect(r.text).toContain('not allowed here')
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

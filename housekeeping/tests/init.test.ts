import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { build } from '../hooks/core/index.ts'
import { initFiles } from '../hooks/core/templates.ts'
import { parseSettings } from '../hooks/core/settings.ts'
import { findingsFor } from '../hooks/core/findings.ts'
import { parseFiles } from '../hooks/core/parse.ts'
import { computeFacts } from '../hooks/core/facts.ts'
import { computeLanes } from '../hooks/core/lanes.ts'
import type { BuildInput } from '../hooks/core/types.ts'

const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const GUIDE = 'At session start, run node <path to housekeeping>/cli.ts brief, or read the Route Map.'

const made = () => {
  const f = Object.fromEntries(initFiles('Empty', 'main').map(x => [x.path, x.content]))
  const settings = parseSettings(f['.housekeeping.json']).settings!
  const input: BuildInput = { settings, files: { backlog: f['docs/backlog.md'], playbook: f['docs/playbook.md'] },
    head: { sha: 'abcdef0123456789', date: '2026-11-03', subject: 'head' }, snapshots: [] }
  return { f, settings, input }
}

test('initFiles gives the four files', () => {
  expect(initFiles('Empty', 'main').map(x => x.path)).toEqual(['docs/backlog.md', 'docs/playbook.md', '.housekeeping.json', '.gitignore'])
})

test('an empty repository builds with no errors and one lane without stations', () => {
  const out = build(made().input)
  expect(out.findings.filter(f => f.level === 'error')).toEqual([])
  expect(out.html).not.toBeNull()
  expect(out.lanes.map(l => [l.path, l.stations.length])).toEqual([['Empty', 0]])
  expect(out.facts.counts.all).toBe(0)
})

test('an empty repository has no warnings and no no-paths recommendation', () => {
  const { settings, input } = made()
  const parsed = parseFiles(settings, input.files)
  const facts = computeFacts(settings, parsed)
  const lanes = computeLanes(settings, parsed, facts)
  const fs = findingsFor(settings, parsed, facts, lanes, [])
  expect(fs.filter(f => f.level === 'warning')).toEqual([])
  expect(fs.some(f => f.rule === 'no-paths')).toBe(false)
})

test('the backlog keeps its how-this-file-is-kept section short', () => {
  const b = made().f['docs/backlog.md']
  expect(b.startsWith('# Backlog')).toBe(true)
  const kept = b.split('## How this file is kept')[1].split('\n## ')[0].trim().split('\n').filter(l => l.trim() !== '')
  expect(kept.length).toBeLessThanOrEqual(10)
  expect(b.indexOf('## Where we are')).toBeGreaterThan(b.indexOf('## How this file is kept'))
  expect(b.indexOf('## Open')).toBeGreaterThan(b.indexOf('## Where we are'))
  expect(b.indexOf('## Done')).toBeGreaterThan(b.indexOf('## Open'))
})

// the engine may hand back Windows-style paths
const rel = (p: string) => p.replaceAll('\\', '/').replace(/^([A-Za-z]:)?\/w\//, '')

type World = { existing?: Record<string, string>; writes?: Record<string, string> }
function world(on: On, w: World) {
  const existing = w.existing ?? {}, writes = (w.writes ??= {})
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/w' }))
  on('clock.now', () => ({ value: Date.parse('2026-11-03T10:00:00Z') }))
  on('fs.exists', (_, e) => ({ value: rel(e.path) in existing }))
  on('fs.read', (_, e) => ({ value: existing[rel(e.path)] }))
  on('ui.status', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('tool.call', { tool: 'Read' }, () => ({ result: 'x' }) as never)
  on('tool.call', { tool: 'Write' }, (_, e) => { writes[rel(e.file_path)] = e.content; return { result: 'ok' } as never })
}
const init = async ($: any) => { await $.session.start(START); return $.command.run({ command: 'housekeeping', args: 'init', ...RUN }) }

test('init in a bare repository writes all four files, lists them, and says there is no guide', async ($, on) => {
  const w: World = {}
  world(on, w)
  const r = await init($)
  expect(Object.keys(w.writes!).sort()).toEqual(['.gitignore', '.housekeeping.json', 'docs/backlog.md', 'docs/playbook.md'])
  expect(w.writes!['.gitignore']).toBe('.housekeeping/\n')
  expect(JSON.parse(w.writes!['.housekeeping.json']).project).toBe('w')
  for (const p of Object.keys(w.writes!)) expect(r.text).toContain(p)
  expect(r.text).toContain('no AGENTS.md')
  expect(r.exitCode ?? 0).toBe(0)
})

test('init leaves an existing backlog as it is and writes the other three', async ($, on) => {
  const w: World = { existing: { 'docs/backlog.md': '# mine\n' } }
  world(on, w)
  const r = await init($)
  expect(Object.keys(w.writes!).sort()).toEqual(['.gitignore', '.housekeeping.json', 'docs/playbook.md'])
  expect(r.text).toMatch(/docs\/backlog\.md.*left as it is/)
})

test('init appends to an existing .gitignore only when the line is missing', async ($, on) => {
  const a: World = { existing: { '.gitignore': 'node_modules/\n' } }
  world(on, a)
  await init($)
  expect(a.writes!['.gitignore']).toBe('node_modules/\n.housekeeping/\n')
})

test('init leaves a .gitignore that already has the line', async ($, on) => {
  const w: World = { existing: { '.gitignore': '.housekeeping/\n' } }
  world(on, w)
  const r = await init($)
  expect('.gitignore' in w.writes!).toBe(false)
  expect(r.text).toMatch(/\.gitignore.*left as it is/)
})

test('init adds the agent-guide line to an AGENTS.md that lacks it', async ($, on) => {
  const w: World = { existing: { 'AGENTS.md': '# Guide\n' } }
  world(on, w)
  await init($)
  expect(w.writes!['AGENTS.md']).toBe(`# Guide\n\n${GUIDE}\n`)
})

test('init leaves an AGENTS.md that already has the line', async ($, on) => {
  const w: World = { existing: { 'AGENTS.md': `# Guide\n${GUIDE}\n` } }
  world(on, w)
  await init($)
  expect('AGENTS.md' in w.writes!).toBe(false)
})

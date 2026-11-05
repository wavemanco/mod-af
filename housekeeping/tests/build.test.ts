import { expect, test } from 'claude-code/testing'
import { parseSettings } from '../hooks/core/settings.ts'
import { build } from '../hooks/core/index.ts'
import { snapshot } from '../hooks/core/history.ts'
import type { BuildInput } from '../hooks/core/types.ts'
import * as small from './fixtures/small.ts'

const settings = parseSettings(small.settings).settings!
const input = (over: Partial<BuildInput['files']> = {}): BuildInput => ({
  settings, files: { backlog: small.backlog, playbook: small.playbook, ...over },
  head: { sha: 'abcdef0123456789', date: '2026-09-12', subject: 'head' }, snapshots: [],
})

test('same input, same page', () => {
  const a = build(input()), b = build(input())
  expect(a.html).not.toBeNull()
  expect(a.html).toBe(b.html)
})

test('partition line', () => {
  expect(build(input()).partition).toBe(
    '8 rows in all = 2 closed + 6 open; open = 2 land now + 1 small choice + 3 not now; 4 open in the backlog, 2 in the playbook')
})

test('privacy blocks the page', () => {
  const b = small.backlog.replace('one client can exhaust it', 'ask jane.doe@gmail.com')
  const o = build(input({ backlog: b }))
  expect(o.html).toBeNull()
  expect(o.findings.some(f => f.level === 'error' && f.rule === 'privacy' && f.message.includes('B-001'))).toBe(true)
})

test('a hit outside the rows is located by file and line', () => {
  const b = small.backlog.replace('- [ ] **Agent.** Rate-limit the export endpoint.', '- [ ] **Agent.** Mail jane.doe@gmail.com.')
  const o = build(input({ backlog: b }))
  expect(o.html).toBeNull()
  const line = b.split('\n').findIndex(l => l.includes('Mail jane')) + 1
  expect(o.findings.some(f => f.rule === 'privacy' && f.message.startsWith(`backlog line ${line}:`))).toBe(true)
})

// a commit subject cannot be edited: a hit there is masked, and the page is built
const withSubject = (subject: string): BuildInput => ({ ...input(), snapshots: [{
  ...snapshot(settings, { backlog: small.backlog, playbook: small.playbook }), sha: '1'.repeat(40), date: '2026-09-01', subject }] })

test('a hit in a commit subject is masked, and the page is built', () => {
  const o = build(withSubject('ask jane.doe@gmail.com about the export'))
  expect(o.findings.filter(f => f.rule === 'privacy')).toEqual([])
  expect(o.html).not.toBeNull()
  expect(o.html!.includes('jane.doe@gmail.com')).toBe(false)
  expect(o.html!.includes('ask ja**************om about the export')).toBe(true)
})

test('a subject like task-add-the-export-endpoint is no hit', () => {
  const o = build(withSubject('Merge branch feature/task-add-the-export-endpoint'))
  expect(o.html).not.toBeNull()
  expect(o.html!.includes('feature/task-add-the-export-endpoint')).toBe(true)
})

// the page writes <, >, & and non-ASCII as \uXXXX and line breaks as \n: the scan reads the text, not those escapes
const KEY = 'sk-ant-FAKEFAKEFAKEFAKEFAKEFAKE'
const decoded = (html: string) => html.replace(/\\u([0-9a-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
const PLAN = '1. Ship the export: B-001, then B-002 (B-004 is closed).'

test('a key after markup, a curly quote, an em dash or a tab, or at a where-we-are line start, is refused', () => {
  for (const before of ['<br>', '<', '>', '&', '“', '—', '\t']) {
    const o = build(input({ backlog: small.backlog.replace('one client can exhaust it', `see${before}${KEY}`) }))
    expect([before, o.html === null]).toEqual([before, true])
    expect([before, o.findings.some(f => f.rule === 'privacy' && f.message.startsWith('B-001:'))]).toEqual([before, true])
  }
  const o = build(input({ backlog: small.backlog.replace(PLAN, `${PLAN}\n${KEY} is the token`) }))
  expect(o.html).toBeNull()
  expect(o.findings.some(f => f.rule === 'privacy' && f.message.startsWith('backlog line 5:'))).toBe(true)
})

test('a dotted at-name after markup, a curly quote or CJK text, or at a line start, builds the page', () => {
  const b = small.backlog.replace('one client can exhaust it', 'ask<br>@jane.doe or “@jane.doe” or 漢字@jane.doe')
    .replace(PLAN, `${PLAN}\n@jane.doe reviews it`)
  const o = build(input({ backlog: b }))
  expect(o.findings.filter(f => f.rule === 'privacy')).toEqual([])
  expect(o.html).not.toBeNull()
})

test('a hit in a commit subject is masked from the decoded subject', () => {
  const o = build(withSubject(`fix “@jane.doe” wording; ask “jane.doe@corp.io”—${KEY}`))
  expect(o.findings.filter(f => f.rule === 'privacy')).toEqual([])
  expect(o.html).not.toBeNull()
  const page = decoded(o.html!)
  expect(page.includes('jane.doe@corp.io')).toBe(false)
  expect(page.includes('FAKEFAKE')).toBe(false)
  expect(page.includes('fix “@jane.doe” wording; ask “ja************io”—sk')).toBe(true)
})

test('a one-line private key in a commit subject is masked whole', () => {
  const o = build(withSubject('add -----BEGIN RSA PRIVATE KEY-----MIIEFAKEFAKEFAKEFAKE-----END RSA PRIVATE KEY----- by mistake'))
  expect(o.html).not.toBeNull()
  const page = decoded(o.html!)
  expect(page.includes('FAKE')).toBe(false)
  expect(page.includes('PRIVATE KEY')).toBe(false)
  expect(page.includes(' by mistake')).toBe(true)
})

test('missing playbook blocks the page', () => {
  const o = build(input({ playbook: null }))
  expect(o.html).toBeNull()
  expect(o.findings.some(f => f.level === 'error' && f.rule === 'file')).toBe(true)
})

test('a page over 1,000,000 bytes is written with a page-size warning', () => {
  expect(build(input()).findings.some(f => f.rule === 'page-size')).toBe(false)
  const big = small.backlog.replace('one client can exhaust it', 'word '.repeat(250000))
  const o = build(input({ backlog: big }))
  expect(o.html).not.toBeNull()
  expect(o.findings.some(f => f.level === 'warning' && f.rule === 'page-size')).toBe(true)
})

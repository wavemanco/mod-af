import { expect, test } from 'claude-code/testing'
import { parseSettings } from '../hooks/core/settings.ts'
import { parseFiles } from '../hooks/core/parse.ts'
import { backlog, playbook, settings } from './fixtures/small.ts'

const s = parseSettings(settings).settings!
const good = () => parseFiles(s, { backlog, playbook })

test('the fixture settings are valid', () => {
  expect(parseSettings(settings).findings).toEqual([])
})

test('reads the rows in file order', () => {
  const p = good()
  expect(p.findings).toEqual([])
  expect(p.rows.map(r => r.id)).toEqual(['B-001', 'B-002', 'B-003', 'B-005', 'PB-01', 'PB-03'])
  const b2 = p.rows[1]
  expect(b2.milestones).toEqual(['beta', 'launch'])
  expect(b2.waitsOn).toEqual(['PB-01'])
  expect(b2.who).toBe('both')
  expect(p.rows[2].landNow).toEqual({ state: 'choice', why: 'keep the current library or switch', valid: true })
  expect(p.rows[3].milestones).toEqual(['none'])
  expect(p.rows[0].extra.Size).toBe('S')
})

test('keeps cells word for word', () => {
  expect(good().rows[0].details).toContain('(a | b)')
})

test('reads Done entries', () => {
  const d = good().done
  expect(d.length).toBe(2)
  expect([d[0].ids, d[0].file]).toEqual([['B-004'], 'backlog'])
  expect([d[1].ids, d[1].file]).toEqual([['PB-02'], 'playbook'])
})

test('reads the checklist with its continuation', () => {
  const c = good().checklists
  expect(c.length).toBe(3)
  expect(c.filter(l => l.ticked).length).toBe(1)
  expect(c[1].ids).toEqual(['B-001'])
  expect(c[0].group).toBe('Before the beta')
})

test('reads where we are', () => {
  const w = good().whereWeAre!
  expect(w.text).toContain('Ship the export')
  expect(w.date).toBe(null)
})

test('CRLF and BOM parse the same', () => {
  expect(parseFiles(s, { backlog: '﻿' + backlog.replace(/\n/g, '\r\n'), playbook })).toEqual(good())
})

test('an invalid Land now becomes no', () => {
  const p = parseFiles(s, { backlog: backlog.replace('| small choice: keep the current library or switch |', '| maybe |'), playbook })
  expect(p.rows[2].landNow).toEqual({ state: 'no', why: 'maybe', valid: false })
})

test('a missing file is a finding', () => {
  const p = parseFiles(s, { backlog, playbook: null })
  expect(p.findings.some(f => f.level === 'error' && f.rule === 'file')).toBe(true)
  expect(p.rows.length).toBe(4)
})

test('short rows are padded and flagged; duplicate IDs are flagged', () => {
  const p = parseFiles(s, { backlog: backlog.replace('| B-005 |', '| B-001 |'), playbook: playbook.replace(/\| 2026-09-05 \|/, '|') })
  expect(p.findings.map(f => f.rule)).toEqual(['id-unique', 'columns'])
  expect(p.rows.find(r => r.id === 'PB-01')!.filed).toBe('')
})

test('fenced text is not read', () => {
  const p = parseFiles(s, { backlog: '## Work\n\n```\n' + backlog + '\n```\n', playbook })
  expect(p.rows.map(r => r.id)).toEqual(['PB-01', 'PB-03'])
})

test('reads the not-doing table', () => {
  const nd = '## Not doing\n\n| Item | Why | Reopen if |\n|---|---|---|\n| A thing | too big | users ask |\n| Other | no need | never |\n'
  const s2 = { ...s, notDoing: { file: 'backlog' as const, heading: 'Not doing' } }
  expect(parseFiles(s2, { backlog: backlog + nd, playbook }).notDoing).toEqual([
    { item: 'A thing', why: 'too big', reopen: 'users ask' }, { item: 'Other', why: 'no need', reopen: 'never' }])
  expect(parseFiles(s2, { backlog, playbook }).notDoing).toEqual([])
  expect(parseFiles(s2, { backlog, playbook }).findings).toEqual([])
})

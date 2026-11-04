import { expect, test } from 'claude-code/testing'
import { parseSettings } from '../hooks/core/settings.ts'
import { parseFiles } from '../hooks/core/parse.ts'
import { backlog, playbook, settings } from './fixtures/small.ts'
import { once } from './fixtures/page-data.ts'

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
  expect(p.findings.filter(f => f.level === 'error' && f.rule === 'file').map(f => f.message)).toEqual(['playbook.md is not on main'])
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

// GFM: each separator cell is :?-+:?, and the separator has as many cells as the header
test('short separators open a table; one with another cell count does not', () => {
  const sep = '|' + '---|'.repeat(15)
  const ids = (line: string) => parseFiles(s, { backlog: once(backlog, sep, line), playbook }).rows.map(r => r.id)
  const all = ['B-001', 'B-002', 'B-003', 'B-005', 'PB-01', 'PB-03']
  expect(ids('|' + '-|'.repeat(15))).toEqual(all)
  expect(ids('| :-- '.repeat(15) + '|')).toEqual(all)
  expect(ids('-|'.repeat(14) + ':-:')).toEqual(all)
  expect(ids('|' + '-|'.repeat(14))).toEqual(['PB-01', 'PB-03'])
})

test('a separator line inside a table is not a row', () => {
  const stray = backlog.replace('| B-003 |', '|---|---|\n| B-003 |')
  const p = parseFiles(s, { backlog: stray, playbook })
  expect(p.rows.map(r => r.id)).toEqual(['B-001', 'B-002', 'B-003', 'B-005', 'PB-01', 'PB-03'])
  expect(p.findings).toEqual([])
})

// HK-006
test('tables under the checklist and not-doing headings are not pending rows', () => {
  const extra = '\n## Checks\n\n| ID | Item |\n|---|---|\n| B-900 | a check |\n\n## Not doing\n\n| ID | Item | Why |\n|---|---|---|\n| B-901 | a thing | no |\n'
  const s2 = { ...s, checklists: [...s.checklists, { file: 'backlog' as const, heading: 'Checks' }],
    notDoing: { file: 'backlog' as const, heading: 'Not doing' } }
  expect(parseFiles(s2, { backlog: backlog + extra, playbook }).rows.map(r => r.id)).toEqual(good().rows.map(r => r.id))
})

// HK-013
test('a fence closes only with its own character and at least its length', () => {
  const only = ['PB-01', 'PB-03']
  expect(parseFiles(s, { backlog: '## Work\n\n````\n```\n' + backlog + '\n````\n', playbook }).rows.map(r => r.id)).toEqual(only)
  expect(parseFiles(s, { backlog: '## Work\n\n```\n~~~\n' + backlog + '\n```\n', playbook }).rows.map(r => r.id)).toEqual(only)
  expect(parseFiles(s, { backlog: '```\ntext\n```\n' + backlog, playbook }).rows.length).toBe(6)
})

// HK-014
test('an ID repeated in Waits on counts once', () => {
  const p = parseFiles(s, { backlog: once(backlog, '| Once the testers are booked (PB-01). | PB-01 |', '| Once the testers are booked (PB-01). | PB-01, PB-01 |'), playbook })
  expect(p.rows[1].waitsOn).toEqual(['PB-01'])
})

// HK-018
test('a dropped table, a dropped row and a mistyped header are warned about', () => {
  const sep = '|' + '---|'.repeat(15)
  const dropped = (b: string) => parseFiles(s, { backlog: b, playbook }).findings.filter(f => f.rule === 'row-dropped')
  const t = dropped(once(backlog, sep, '|' + '---|'.repeat(14)))
  expect(t.map(f => [f.level, f.file, f.line])).toEqual([['warning', 'backlog', 18]])
  const r = dropped(once(backlog, '| B-005 |', '|  |'))
  expect(r.map(f => [f.level, f.file, f.line])).toEqual([['warning', 'backlog', 23]])
  const h = dropped(once(backlog, '| ID | Item | Status', '| ID | Itme | Status'))
  expect(h.map(f => [f.file, f.line])).toEqual([['backlog', 18]])
  expect(dropped(backlog)).toEqual([])
})

// HK-020
test('a date after the head commit does not make where-we-are look fresh', () => {
  const b = once(backlog, '(B-004 is closed).', '(B-004 is closed). Checked 2026-10-01; due 2027-01-01.')
  expect(parseFiles(s, { backlog: b, playbook }).whereWeAre!.date).toBe('2027-01-01')
  expect(parseFiles(s, { backlog: b, playbook }, '2026-11-04').whereWeAre!.date).toBe('2026-10-01')
})

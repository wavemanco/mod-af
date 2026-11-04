import { expect, test } from 'claude-code/testing'
import { parseSettings } from '../hooks/core/settings.ts'

const cols = { id: 'ID', item: 'Item', milestone: 'Milestone', who: 'Who', landNow: 'Land now', trigger: 'Trigger', waitsOn: 'Waits on' }
const base = () => ({
  version: 1, project: 'X',
  files: { backlog: { path: 'b.md' }, playbook: { path: 'p.md' } },
  columns: { ...cols }, ids: ['B-\d{3}'], paths: [],
})
const parse = (o: unknown) => parseSettings(JSON.stringify(o))

test('fills defaults', () => {
  const r = parse(base())
  expect(r.findings).toEqual([])
  const s = r.settings!
  expect(s.mainBranch).toBe('main')
  expect(s.none).toBe('none')
  expect(s.duties.triggerPrefix).toBe('Every')
  expect(s.defaultUntilDecided).toBe('Default until decided:')
  expect(s.values.nothing).toEqual(['—', '-', ''])
  expect(s.values.who.owner).toEqual(['owner'])
  expect(s.files.backlog.skipSections).toEqual([])
  expect(s.checklists).toEqual([])
  expect(s.done).toEqual([])
})

test('rejects bad JSON', () => {
  const r = parseSettings('{')
  expect(r.settings).toBe(null)
  expect(r.findings).toHaveLength(1)
  expect(r.findings[0].level).toBe('error')
  expect(r.findings[0].rule).toBe('settings')
})

test('names a missing required column', () => {
  const b = base()
  delete (b.columns as Record<string, string>).waitsOn
  const r = parse(b)
  expect(r.settings).toBe(null)
  expect(r.findings[0].level).toBe('error')
  expect(r.findings[0].message).toContain('waitsOn')
})

test('rejects an ID pattern that is not a regex', () => {
  const r = parse({ ...base(), ids: ['B-('] })
  expect(r.findings[0].level).toBe('error')
  expect(r.findings[0].message).toContain('B-(')
})

test('rejects version 2', () => {
  const r = parse({ ...base(), version: 2 })
  expect(r.settings).toBe(null)
  expect(r.findings[0].rule).toBe('settings')
})

test('an unknown key is a recommendation, not an error', () => {
  const r = parse({ ...base(), colour: 'red' })
  expect(r.settings).not.toBe(null)
  expect(r.findings).toHaveLength(1)
  expect(r.findings[0].level).toBe('recommendation')
  expect(r.findings[0].message).toContain('colour')
})

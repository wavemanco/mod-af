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

const bad = (patch: object) => parse({ ...base(), ...patch })
const names = (r: ReturnType<typeof parse>, text: string) => {
  expect(r.settings).toBe(null)
  expect(r.findings.some(f => f.level === 'error' && f.rule === 'settings' && f.message.includes(text))).toBe(true)
}

// git would read "--output=<file>" as an option and write that file
test('rejects an empty mainBranch, or one that starts with "-"', () => {
  for (const m of ['', '-x', '--output=x.txt']) names(bad({ mainBranch: m }), 'mainBranch')
})
test('rejects an empty done entry', () => names(bad({ done: [{}] }), 'done[0]'))
test('rejects a non-integer done column', () =>
  names(bad({ done: [{ file: 'backlog', sectionPrefix: '## Done', idColumn: '0', landedColumn: 1 }] }), 'done[0].idColumn'))
test('rejects a bad fileByIdPrefix', () =>
  names(bad({ done: [{ file: 'backlog', sectionPrefix: 'D', idColumn: 0, landedColumn: 1, fileByIdPrefix: { x: 'B-' } }] }), 'fileByIdPrefix'))
test('rejects a checklist with an unknown file', () => names(bad({ checklists: [{ file: 'x', heading: 'H' }] }), 'checklists[0].file'))
test('rejects whereWeAre with an unknown file', () => names(bad({ whereWeAre: { file: 'x', heading: 'H' } }), 'whereWeAre.file'))
test('rejects notDoing without a heading', () => names(bad({ notDoing: { file: 'backlog' } }), 'notDoing.heading'))
test('rejects a path milestone without a name', () =>
  names(bad({ paths: [{ name: 'P', milestones: [{}] }] }), 'paths[0].milestones[0].name'))
test('accepts well-formed nested shapes', () => {
  const r = bad({
    done: [{ file: 'backlog', sectionPrefix: 'Done', idColumn: 0, landedColumn: 2, milestoneColumn: 1, fileByIdPrefix: { backlog: 'B-' } }],
    checklists: [{ file: 'playbook', heading: 'Launch', milestone: 'M1' }],
    whereWeAre: { file: 'backlog', heading: 'Where we are', marker: 'x' }, notDoing: { file: 'backlog', heading: 'Not doing' },
    paths: [{ name: 'P', shared: true, milestones: [{ name: 'M1', doneWhen: 'x' }] }],
  })
  expect(r.findings).toEqual([])
  expect(r.settings).not.toBe(null)
})

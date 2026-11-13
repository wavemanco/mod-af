import { expect, test } from 'claude-code/testing'
import { addedArgs, firstParentArgs } from '../hooks/core/history.ts'
import { auditStart, owed, type OwedRead, parseCommitPaths, parseCommits, parseNames, scanDiff, tokens } from '../hooks/core/owed.ts'
import { once } from './fixtures/page-data.ts'
import { parseFiles } from '../hooks/core/parse.ts'
import { parseSettings } from '../hooks/core/settings.ts'
import * as small from './fixtures/small.ts'

const s = parseSettings(small.settings).settings!
// main's first-parent line, oldest first: c00..c79
const fp = (n: number) => Array.from({ length: n }, (_, i) => `c${String(i).padStart(2, '0')}`.padEnd(40, 'a'))
// the playbook with the audit's duty row, its Details given
const AUDIT_ROW = (details: string) => small.playbook +
  `| PB-04 | Audit the records against the commits | none | medium | none | agent | no: a standing duty | S | duty | event | Every 2 weeks: /housekeeping audit | — | ${details} | — | 2026-09-07 |\n`
const rowsWith = (playbook: string) => parseFiles(s, { backlog: small.backlog, playbook }).rows

// the audit's readers: main's first-parent line, and the commit on it that added the settings (a merge that brought
// them in from a branch, under --first-parent), each with --end-of-options before the branch
test('the audit\'s git readers', () => {
  expect(firstParentArgs('main')).toEqual(['git', 'rev-list', '--first-parent', '--reverse', '--end-of-options', 'main', '--'])
  expect(addedArgs('main')).toEqual(['git', 'log', '--first-parent', '--diff-filter=A', '-1', '--no-show-signature', '--format=%H',
    '--end-of-options', 'main', '--', ':(literal).housekeeping.json'])
})

// Phase 3 call 2: the audit starts at its duty row's latest "Last done: ..., through <sha>", else at the commit that
// added the settings, else at the root; at most 50 first-parent commits after the start are read
test('the audit starts at the duty row\'s latest Last done sha, and reads to main\'s tip', () => {
  const line = fp(30)
  const r = auditStart(rowsWith(AUDIT_ROW(`Last done: 2026-09-01, through ${line[3].slice(0, 7)}. Last done: 2026-10-01, through ${line[10].slice(0, 9)}`)), line[1], line)
  expect(r).toEqual({ base: line[10], head: line[29], warnings: [] })
})

test('a Last done sha not on main\'s first-parent line is not the start: the settings commit is, with a warning', () => {
  const line = fp(30)
  const r = auditStart(rowsWith(AUDIT_ROW('Last done: 2026-10-01, through 1234567')), line[5], line)
  expect([r.base, r.head]).toEqual([line[5], line[29]])
  expect(r.warnings).toEqual(["PB-04's Last done names 1234567, which is not one commit of the main branch's first-parent line, so it is not the start"])
})

test('with no duty row, the audit starts at the commit that added the settings', () => {
  const line = fp(12)
  expect(auditStart(rowsWith(small.playbook), line[4], line)).toEqual({ base: line[4], head: line[11], warnings: [] })
})

test('with neither, the audit reads the oldest commits from the root', () => {
  const line = fp(12)
  expect(auditStart(rowsWith(small.playbook), null, line)).toEqual({ base: null, head: line[11], warnings: [] })
  expect(auditStart(rowsWith(small.playbook), null, fp(80))).toEqual({ base: null, head: fp(80)[49], warnings: [] })
})

test('more than 50 first-parent commits after the start: the oldest 50 are read, and the head is the last of them', () => {
  const line = fp(80)
  expect(auditStart(rowsWith(AUDIT_ROW(`Last done: 2026-10-01, through ${line[2].slice(0, 7)}`)), null, line))
    .toEqual({ base: line[2], head: line[52], warnings: [] })
  // a second duty row: the first is read, with a warning
  const two = AUDIT_ROW(`Last done: 2026-10-01, through ${line[2].slice(0, 7)}`) +
    '| PB-05 | Audit again | none | low | none | agent | no: a standing duty | S | duty | event | Every month: /housekeeping audit | — | — | — | 2026-09-08 |\n'
  const r = auditStart(rowsWith(two), null, line)
  expect(r.base).toBe(line[2])
  expect(r.warnings).toEqual(['more than one playbook row\'s Trigger holds "/housekeeping audit" (PB-04, PB-05): the first, PB-04, is read'])
})

// The code-name rule (Phase 3 call 13, FORMAT's "Code names in a Trigger"): a backticked span, or a word that holds "/"
// or ends in "." and letters once the punctuation around it is dropped; a slash command is none
test('the tokens of a Trigger: backticked spans and path-like words, punctuation dropped, slash commands left out', () => {
  expect(tokens('When `PRICES_CHECKED` changes.')).toEqual(['PRICES_CHECKED'])
  expect(tokens('When src/prices.ts changes.')).toEqual(['src/prices.ts'])
  expect(tokens('Once prices.ts, or (README.md), changes.')).toEqual(['prices.ts', 'README.md'])
  expect(tokens('When it lands in scripts/route-map.ts.')).toEqual(['scripts/route-map.ts'])
  expect(tokens('When ./a.ts or `a.ts` changes.')).toEqual(['a.ts'])
  expect(tokens('After /loose-ends files it, or `/housekeeping audit` runs.')).toEqual([])
  expect(tokens('When the owner decides. Before the beta.')).toEqual([])
  expect(tokens('When the v1.2 tag lands.')).toEqual([])
})

const DIFF = [
  'diff --git a/src/a.ts b/src/a.ts', 'index 1..2 100644', '--- a/src/a.ts', '+++ b/src/a.ts',
  '@@ -3 +3,2 @@', '-const PRICES_CHECKED = 1', '+const PRICES_CHECKED = 2', '+const PRICES_CHECKED_AT = 3',
  '@@ -10,0 +12 @@', '+// see prices.ts', '\\ No newline at end of file',
  'diff --git a/s p.ts b/s p.ts', '--- a/s p.ts\t', '+++ b/s p.ts\t', '@@ -1 +1 @@', '-x', '+PRICES_CHECKED',
  'diff --git "a/q\\"t.ts" "b/q\\"t.ts"', 'deleted file mode 100644', '--- "a/q\\"t.ts"', '+++ /dev/null', '@@ -7 +0,0 @@', '-old PRICES_CHECKED',
  'diff --git a/+++ b/PRICES_CHECKED.ts b/+++ b/PRICES_CHECKED.ts', 'new file mode 100644', '--- /dev/null', '+++ b/+++ b/PRICES_CHECKED.ts',
  'Binary files /dev/null and b/PRICES_CHECKED.png differ',
].join('\n')

test('a token is a whole word on an added or removed line, numbered on its own side; header lines are not content', () => {
  expect(scanDiff(DIFF, ['PRICES_CHECKED', 'prices.ts'])).toEqual([
    { token: 'PRICES_CHECKED', path: 'src/a.ts', line: 3, removed: true },
    { token: 'PRICES_CHECKED', path: 'src/a.ts', line: 3, removed: false },
    { token: 'prices.ts', path: 'src/a.ts', line: 12, removed: false },
    { token: 'PRICES_CHECKED', path: 's p.ts', line: 1, removed: false },
    { token: 'PRICES_CHECKED', path: 'q"t.ts', line: 7, removed: true },
  ])
})

// What owed lists (Phase 3, Task 2): a base and a head of the small fixture's records, and what git gave for the range
const line2 = (text: string, id: string) => text.split('\n').find(l => l.startsWith(`| ${id} `))!
const HEAD_BACKLOG = once(once(once(once(small.backlog,
  // B-001 settled: moved to Done
  `${line2(small.backlog, 'B-001')}\n`, ''), '| Sign the hosting contract (PB-02) | 2026-09-10 | Closed |\n',
  '| Sign the hosting contract (PB-02) | 2026-09-10 | Closed |\n| Rate-limit the export (B-001) | 2026-09-11 | Closed |\n'),
  // B-003 gone: absent, in no Done table; B-006 opened, which main's tip also holds
  `${line2(small.backlog, 'B-003')}\n`, '| B-006 | Cache the prices | open | low | none | agent | yes | S | chore | now | When an agent picks it up. | — | — | — | 2026-09-12 |\n'),
  // B-005 waits on two code names; a checklist line names it
  'Whenever an agent picks it up.', 'When `PRICES_CHECKED` or prices.ts changes.')
  .replace('- [ ] **Owner.** Book the beta testers. *Settles:* PB-01.', '- [ ] **Owner.** Book the beta testers. *Settles:* PB-01.\n- [ ] **Agent.** Check the prices. *Settles:* B-005.')
// PB-03 is a duty row whose Trigger names prices.ts: it never fires
const HEAD_PLAYBOOK = small.playbook.replace('When the renewal notice arrives.', 'Every month: check `prices.ts`.')
const MAIN_TIP = small.backlog.replace('| B-005 |', '| B-006 | Cache the rates | open | low | none | agent | yes | S | chore | now | Later. | — | — | — | 2026-09-12 |\n| B-005 |')
const sha = (c: string) => c.repeat(40)
const READ: OwedRead = {
  base: sha('b'), head: sha('e'),
  files: { base: { backlog: small.backlog, playbook: small.playbook }, head: { backlog: HEAD_BACKLOG, playbook: HEAD_PLAYBOOK },
    main: { backlog: MAIN_TIP, playbook: small.playbook } },
  commits: [
    { sha: sha('1'), subject: 'Fix B-005 in the price check', body: '' },
    // B-002 only in the body; PB-01 only in a trailer, beside an address and a name
    { sha: sha('2'), subject: 'Tidy the CSV code', body: 'Prep for B-002.\n\nRefs: PB-01\nSigned-off-by: A Person <someone@example.com>\n' },
    { sha: sha('3'), subject: 'Unrelated', body: 'Mentions B-001, now settled.' },
  ],
  paths: { [sha('1')]: ['src/prices.ts', 'src/$(x).ts', 'secret.txt'], [sha('2')]: ['src/csv/a.ts'], [sha('3')]: ['x.ts'] },
  changed: ['src/prices.ts', 'src/myprices.ts', 'src/$(x).ts', 'secret.txt', 'src/csv/a.ts', 'backlog.md'],
  denied: ['secret.txt'],
  hits: [{ token: 'PRICES_CHECKED', path: 'src/a.ts', line: 4, removed: true }],
  notRead: 1, notes: [],
}
const MARK = ' (a shell can read this path as commands: put it in no command)'

test('owed lists each group, ends with the last commit read, and counts what it did not read', () => {
  const t = owed(s, READ).split('\n')
  expect(t[0]).toBe('housekeeping owed: bbbbbbb..eeeeeee, 3 commits, 6 changed paths; 1 excluded by the Read rules, never read or named; 1 not read (cut short or unreadable)')
  const after = (title: string) => t.slice(t.indexOf(title) + 1, t.findIndex((l, i) => i > t.indexOf(title) && !/^ *- |^none$/.test(l)))
  // the path matches on a "/" boundary only (src/prices.ts, not src/myprices.ts); the line, with its side and number
  expect(after('Rows whose Trigger fired:')).toEqual(['- B-005 Tidy the build scripts: `PRICES_CHECKED` matched src/a.ts removed line 4; `prices.ts` matched src/prices.ts'])
  expect(after('Rows the commits name by ID:')).toEqual([
    '- B-005 Tidy the build scripts', '  - 1111111 Fix B-005 in the price check (in the subject; a closing word is next to the ID)',
    '- B-002 CSV export of reports', '  - 2222222 Tidy the CSV code (in the body)'])
  expect(after('Paths of those commits that the Read rules allow:')).toEqual([`- 1111111: src/prices.ts, src/$(x).ts${MARK}; 1 excluded`, '- 2222222: src/csv/a.ts'])
  expect(after('Checklist lines that name these rows:')).toEqual(['- backlog.md:15 [ ] B-005'])
  expect(after('Rows gone over the range (open at the base, absent at the head, in no Done table):')).toEqual(['- B-003 Pick a chart library'])
  expect(after('Rows already settled (moved to Done at the head):')).toEqual(['- B-001 Rate-limit the export endpoint'])
  expect(after('IDs the branch adds that are already taken:')).toEqual(["- B-006: main's tip holds it"])
  expect(t.at(-1)).toBe(`Last commit read: ${sha('e')}`)
})

test('owed shows no trailer, address, author or denied path, and no line\'s text', () => {
  const t = owed(s, READ)
  for (const no of ['PB-01 Book', 'Refs', 'Signed-off-by', 'someone@example.com', 'A Person', 'secret.txt', 'const ', 'Prep for'])
    expect([no, t.includes(no)]).toEqual([no, false])
  // a duty row whose Trigger names a changed path does not fire
  expect(t).not.toContain('- PB-03')
})

// the Phase 3 check: a newline in a path forged listing lines that showed a denied path as an allowed one
test('a control character in a path or a subject stays on its entry\'s line, written as \\uXXXX, with the path\'s mark', () => {
  const forged = 'odd/zz\n- 1111111: secret.txt\nRows already settled (moved to Done at the head): x'
  const t = owed(s, { ...READ, commits: [{ sha: sha('1'), subject: 'Fix B-005\u001b[2K in the check', body: '' }],
    paths: { [sha('1')]: [forged] }, changed: [forged, 'secret.txt'], hits: [{ token: 'PRICES_CHECKED', path: forged, line: 2, removed: false }] }).split('\n')
  expect(t.filter(l => l.startsWith('Rows already settled')).length).toBe(1)
  expect(t.some(l => l.startsWith('- 1111111: secret'))).toBe(false)
  const one = 'odd/zz\\u000a- 1111111: secret.txt\\u000aRows already settled (moved to Done at the head):\\u2028x'
  expect(t).toContain(`- 1111111: ${one}${MARK}`)
  expect(t).toContain(`- B-005 Tidy the build scripts: \`PRICES_CHECKED\` matched ${one} line 2${MARK}`)
  expect(t).toContain('  - 1111111 Fix B-005\\u001b[2K in the check (in the subject; a closing word is next to the ID)')
})

test('a denied path that a subject names whole is hidden; a longer name that holds it is not', () => {
  const t = owed(s, { ...READ, commits: [{ sha: sha('1'), subject: 'Fix B-005: rotate secret.txt, then secret.txt. Keep secret.txt.bak and mysecret.txt', body: '' }] })
  expect(t).toContain('  - 1111111 Fix B-005: rotate [a path the Read rules deny], then [a path the Read rules deny]. Keep secret.txt.bak and mysecret.txt (in the subject')
})

// the Phase 3 check's owed findings (HK-102)
test("a trailer is dropped only as git's own block, a paragraph of its own; a Key: value line inside prose is read", () => {
  const t = owed(s, { ...READ, commits: [
    { sha: sha('1'), subject: 'Tidy', body: 'Done here.\nCloses: B-002\n' },
    { sha: sha('2'), subject: 'Tidy more', body: 'Prep.\n\nCloses: B-005\nSigned-off-by: A Person <someone@corp.io>\n' }] })
  expect(t).toContain('  - 1111111 Tidy (in the body; a closing word is next to the ID)')
  expect(t).not.toContain('2222222')
})

test('a trailer in the subject\'s own paragraph is cut from it, so no co-author is shown', () => {
  const t = owed(s, { ...READ, commits: [{ sha: sha('1'), subject: 'Close B-005 Co-authored-by: Pat Example <someone@corp.io>', body: '' }] })
  expect(t).toContain('  - 1111111 Close B-005 (in the subject; a closing word is next to the ID)')
  expect(t).not.toContain('Pat Example')
})

test('an unterminated private key marker in one subject masks its own line only', () => {
  const t = owed(s, { ...READ, commits: [{ sha: sha('1'), subject: 'Fix B-005 -----BEGIN OPENSSH PRIVATE KEY----- FAKEFAKE', body: '' },
    { sha: sha('2'), subject: 'Tidy the CSV code', body: 'Prep for B-002.' }] }).split('\n')
  expect(t).toContain('  - 2222222 Tidy the CSV code (in the body)')
  expect(t.at(-1)).toBe(`Last commit read: ${sha('e')}`)
})

test('with the commits cut short, the listing names no last commit read, so Last done stays where it is', () => {
  expect(owed(s, { ...READ, commitsCut: true }).split('\n').at(-1))
    .toBe('Last commit read: none: the commits of the range were cut short, so Last done stays where it is')
})

test('a denied path\'s file name alone in a subject is hidden too', () => {
  const t = owed(s, { ...READ, denied: ['config/private-keys.env'], commits: [{ sha: sha('1'), subject: 'Fix B-005: rotate private-keys.env', body: '' }] })
  expect(t).toContain('  - 1111111 Fix B-005: rotate [a path the Read rules deny] (in the subject')
})

test('a path in bold, in italics or as a Markdown link in a Trigger is a token', () => {
  expect(tokens('When **src/prices.ts** or _docs/a.md_ changes, or [the guide](docs/guide.md).')).toEqual(['src/prices.ts', 'docs/a.md', 'docs/guide.md'])
  expect(tokens('When __init__.py changes.')).toEqual(['__init__.py'])
})

test('an ID the base holds in a Done table is taken; with nothing to list, each group says none', () => {
  const reused = once(small.backlog, '| B-005 |', '| B-004 | Reuse an ID | open | low | none | agent | yes | S | chore | now | Later. | — | — | — | 2026-09-12 |\n| B-005 |')
  const t = owed(s, { ...READ, files: { base: READ.files.base, head: { backlog: reused, playbook: small.playbook }, main: null },
    commits: [], paths: {}, changed: [], denied: [], hits: [], notRead: 0 }).split('\n')
  expect(t[0]).toBe('housekeeping owed: bbbbbbb..eeeeeee, 0 commits, 0 changed paths')
  expect(t).toContain('- B-004: the base holds it in a Done table')
  expect(t.filter(l => l === 'none').length).toBe(6)
})

test('the parsers: both sides of a rename, a merge with no paths, and a cut-short entry left out', () => {
  expect(parseNames('M\0a.ts\0R100\0old.ts\0new.ts\0A\0cut')).toEqual(['a.ts', 'old.ts', 'new.ts'])
  expect(parseCommitPaths(`${sha('1')}\0${sha('2')}\0\nM\0a.ts\0R090\0o.ts\0n.ts\0${sha('3')}\0\nA\0b.ts\0`))
    .toEqual({ [sha('1')]: [], [sha('2')]: ['a.ts', 'o.ts', 'n.ts'], [sha('3')]: ['b.ts'] })
  const log = `${sha('1')}\tone\tsubject\0body one\n\0${sha('2')}\ttwo\0\0`
  expect(parseCommits(log, false)).toEqual([{ sha: sha('1'), subject: 'one\tsubject', body: 'body one\n' }, { sha: sha('2'), subject: 'two', body: '' }])
  expect(parseCommits(log, true).length).toBe(1)
})

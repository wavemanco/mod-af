import type { On } from 'claude-code'
import { expect, test, type Engine } from 'claude-code/testing'
import {
  argPath, asksSte, checkReport, joinPath, leadsTo, linkedPath, MAX_LINK_FILES, movesOf, parseVoice, referenceFileOf,
  pathFrom, projectNameOf, reportHead, requestOf, resolveTyped, rewriteRequest, section, utcDate, voiceText,
} from '../hooks/register.ts'

// The engine stand-ins. The plugin reads every file through the Read tool and writes its report
// through the Write tool, so the world serves those two tools, answers permission questions, and
// stands in for the file system and the session's folder. The checks run on the real word lists
// (hooks/data.ts). prompt.md has the same markers as the real one: the test kit imports code files
// only, so it cannot read the real prompt.md.
const PROMPT = [
  'intro for people who paste it',
  '<!-- method:start -->',
  '# Rewrite a document so a named reader can understand it',
  'the method body',
  '<!-- method:end -->',
  '<!-- lenses:start -->',
  '## Reviewer briefs',
  '<!-- lens:accuracy-reviewer:start -->',
  'accuracy brief',
  '<!-- lens:accuracy-reviewer:end -->',
  '<!-- lens:cold-reader:start -->',
  'cold reader brief',
  '<!-- lens:cold-reader:end -->',
  '<!-- lenses:end -->',
  '<!-- voice:start -->',
  '## Plain replies',
  'Write every reply for this reader: {reader}. Keep {reader} in mind.',
  '<!-- voice:end -->',
  '<!-- ste:start -->',
  'Write about 80% of the way to STE.',
  '<!-- ste:end -->',
  '## In the paste form',
  'paste-form text',
].join('\n')

type Files = Record<string, string>
type Spec = Record<string, unknown>
type World = {
  files: Files
  reads?: string[]
  writes?: Files
  logs?: string[]
  commands?: Spec[]
  tools?: Spec[]
  agents?: Spec[]
  /** path suffixes the Read tool refuses, in the words a deny rule gets */
  denyRead?: string[]
  /** path suffix → words the Read tool fails with (a PreToolUse hook's reason, say) */
  readFails?: Record<string, string>
  /** the most lines one Read call may return before the tool refuses it as too large */
  pageCap?: number
  writeError?: string
  toolVerdict?: { decision: 'allow' | 'ask' | 'deny'; rule?: string; reason?: string }
  agentsFail?: boolean
  toolFails?: boolean
  /** the name the engine gives the check tool (the real one: mcp__<plugin>__<name>) */
  toolName?: string
  /** the session's working folder (default /w) */
  cwd?: string
  /** [prefix, real prefix]: real places start with another prefix (the working folder is itself a link, as /tmp is on macOS) */
  realRoot?: [string, string]
  /** path → where it points: a symbolic link; a link to a folder covers everything under it */
  links?: Record<string, string>
  /** a path the Read tool finds gone, once: the file is removed as the Read call is made */
  goneOnRead?: string
  /** [path, target]: as the Read call is made, the file at path is swapped for a link to target */
  linkOnRead?: [string, string]
  /** paths whose fs.stat a hook above answers with no value */
  nullStat?: string[]
  /** paths whose fs.stat answer a hook above sends without its link flag */
  noIsLink?: string[]
  /** paths whose fs.stat answer a hook above sends without its time and size */
  noTimes?: string[]
  /** folders whose fs.list a hook above answers with no value */
  badList?: string[]
  /** folders whose fs.list a hook above answers with entries that are not entries, beside the real ones */
  junkEntries?: string[]
  /** folders whose fs.list fails */
  failList?: string[]
  /** [path, field]: fs.stat of that path answers without that one field */
  dropField?: [string, string]
  /** filled with how many times fs.stat looked at each path */
  looks?: Map<string, number>
  /** [path, n]: the nth fs.stat of that path finds nothing (a file replaced between two looks) */
  vanishAt?: [string, number]
  /** path → modification time, for the stand-in fs.stat (default 0) */
  mtimes?: Record<string, number>
  /** what the person answers in the ask dialog; undefined: no one to ask */
  answer?: string
  /** what the settings hooks beneath jargone answer at Stop */
  stop?: (e: { last_assistant_message?: string }) => { block?: string; preventContinuation?: true; stopReason?: string }
}

function world(on: On, w: World) {
  const links = w.links ?? {}
  // every link followed, as the real stat and Read do; a loop is an error there (ELOOP), so throws here
  const resolve = (p: string): string => {
    for (let step = 0; step < 40; step++) {
      const k = Object.keys(links).sort((a, b) => b.length - a.length).find(l => p === l || p.startsWith(`${l}/`))
      if (k === undefined) return p
      p = links[k] + p.slice(k.length)
    }
    throw new Error(`ELOOP ${p}`)
  }
  const isDir = (p: string) => Object.keys(w.files).some(f => f.startsWith(`${p.replace(/\/$/, '')}/`))
  on('command.register', (_, e) => { w.commands?.push(e as unknown as Spec); return { value: { command: e.name } } })
  on('tool.register', (_, e) => {
    if (w.toolFails) throw new Error('refused')
    w.tools?.push(e as unknown as Spec)
    return { value: { tool: w.toolName ?? `mcp__jargone__${e.name}` } }
  })
  on('agent.register', (_, e) => {
    if (w.agentsFail) throw new Error('refused')
    w.agents?.push(e as unknown as Spec)
    return { value: { agent: `jargone:${e.name}` } }
  })
  // the plugin reads only prompt.md with $.fs.read; everything else goes through the Read tool
  on('fs.read', (_, e) => {
    if (e.path.endsWith('/prompt.md') && '/plugin/prompt.md' in w.files) return { value: w.files['/plugin/prompt.md'] }
    throw new Error(`ENOENT ${e.path}`)
  })
  on('fs.exists', (_, e) => ({ value: resolve(e.path) in w.files || isDir(resolve(e.path)) }))
  const stats = w.looks ?? new Map<string, number>()
  on('fs.stat', (_, e) => {
    const n = (stats.get(e.path) ?? 0) + 1
    stats.set(e.path, n)
    if (w.nullStat?.includes(e.path)) return { value: null } as never
    if (w.noIsLink?.includes(e.path)) return { value: { kind: 'file', size: 1, mtimeMs: 0 } } as never
    if (w.noTimes?.includes(e.path)) return { value: { kind: 'file', isLink: false } } as never
    if (w.dropField && w.dropField[0] === e.path) {
      const v: Record<string, unknown> = { kind: 'file', isLink: false, mtimeMs: 1, size: (w.files[e.path] ?? '').length }
      delete v[w.dropField[1]]
      return { value: v } as never
    }
    if (w.vanishAt && w.vanishAt[0] === e.path && w.vanishAt[1] === n) throw new Error(`ENOENT ${e.path}`)
    const r = resolve(e.path)
    const isLink = e.path in links
    // as the real stat: a link to nothing is there, as "other", with isLink set
    if (!(r in w.files) && !isDir(r)) {
      if (isLink) return { value: { kind: 'other' as const, size: 0, mtimeMs: 0, isLink } }
      throw new Error(`ENOENT ${e.path}`)
    }
    return { value: { kind: r in w.files ? 'file' as const : 'dir' as const, size: (w.files[r] ?? '').length, mtimeMs: w.mtimes?.[r] ?? 0, isLink, ...(e.resolve ? { realPath: realOf(r) } : {}) } }
  })
  on('fs.list', (_, e) => {
    if (w.badList?.includes(e.path)) return { value: null } as never
    if (w.failList?.includes(e.path)) throw new Error(`EACCES ${e.path}`)
    // as the real listing: a folder reached through a link is listed; one that is not there is an error
    const dir = resolve(e.path.replace(/\/$/, ''))
    if (!isDir(dir) && !Object.keys(links).some(l => l.startsWith(`${dir}/`))) throw new Error(`ENOENT ${e.path}`)
    const kinds = new Map<string, 'file' | 'dir' | 'other'>()
    for (const p of Object.keys(w.files)) {
      if (!p.startsWith(`${dir}/`)) continue
      const rest = p.slice(dir.length + 1).split('/')
      kinds.set(rest[0] as string, rest.length > 1 ? 'dir' : 'file')
    }
    // a link is listed as itself: kind "other", isLink set; a folder holding only links is still a folder
    for (const l of Object.keys(links)) {
      if (!l.startsWith(`${dir}/`)) continue
      const rest = l.slice(dir.length + 1).split('/')
      if (rest.length === 1) kinds.set(rest[0] as string, 'other')
      else if (!kinds.has(rest[0] as string)) kinds.set(rest[0] as string, 'dir')
    }
    const entries = [...kinds].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: kind === 'other' }))
    const junk = [null, 7, { name: 7 }, { name: '..', kind: 'dir' }, { name: '', kind: 'dir' }, { name: '.', kind: 'dir' }, { name: '../plugin/prompt.md', kind: 'file' }, { name: 'notes\\guide.md', kind: 'file' }, { name: 'nokind' }]
    return { value: w.junkEntries?.includes(e.path) ? [...junk, ...entries] as never : entries }
  })
  on('session.cwd', () => ({ value: w.cwd ?? '/w' }))
  const realOf = (r: string) => (w.realRoot && (r === w.realRoot[0] || r.startsWith(`${w.realRoot[0]}/`)) ? w.realRoot[1] + r.slice(w.realRoot[0].length) : r)
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 31, 12) }))
  // the person's rule for jargone's own tool: what jargone's own query ($.tool.check, no tool_use_id) gets;
  // the engine's check of the call itself allows it, as a plugin's tool shows no prompt of its own
  on('tool.check', (_, e) => (e.tool_use_id === undefined && w.toolVerdict ? w.toolVerdict : { decision: 'allow' as const }))
  on('ui.log', (_, e) => { w.logs?.push(e.text); return { value: undefined } })
  // the engine's question dialog: $.ui.ask is a call of the AskUserQuestion tool
  on('tool.call', { tool: 'AskUserQuestion' }, (_, e) => {
    if (w.answer === undefined) throw new Error('no one to ask')
    const q = (e as unknown as { questions: { question: string }[] }).questions[0]!.question
    return { result: { questions: (e as unknown as { questions: unknown[] }).questions, answers: { [q]: w.answer } } } as never
  })
  // the engine's Read tool, beneath its permission check: whole lines, and a page over pageCap lines refused as too large
  on('tool.call', { tool: 'Read' }, (_, e) => {
    const p = e.file_path
    w.reads?.push(p)
    if ((w.denyRead ?? []).some(d => p.endsWith(d))) return { result: [], isError: true, text: '<tool_use_error>File is in a directory that is denied by your permission settings.</tool_use_error>' } as never
    const fails = Object.entries(w.readFails ?? {}).find(([d]) => p.endsWith(d))?.[1]
    if (fails) return { result: [], isError: true, text: fails } as never
    if (w.goneOnRead === p) { delete w.files[p]; w.goneOnRead = undefined }
    if (w.linkOnRead?.[0] === p) { delete w.files[p]; links[p] = w.linkOnRead[1]; w.linkOnRead = undefined }
    const t = w.files[resolve(p)]
    if (t === undefined) return { result: [], isError: true, text: 'File does not exist.' } as never
    const lines = t.split('\n')
    const offset = e.offset ?? 1
    const slice = lines.slice(offset - 1, offset - 1 + (e.limit ?? lines.length))
    if (w.pageCap !== undefined && slice.length > w.pageCap) return { result: [], isError: true, text: `<tool_use_error>File content (${slice.length * 1000} tokens) exceeds maximum allowed tokens (25000). Use offset and limit parameters to read specific portions of the file.</tool_use_error>` } as never
    return { result: { type: 'text', file: { filePath: p, content: slice.join('\n'), numLines: slice.length, startLine: offset, totalLines: lines.length } } } as never
  })
  // the engine's Write tool, beneath its permission check
  on('tool.call', { tool: 'Write' }, (_, e) => {
    if (w.writeError) return { result: [], isError: true, text: w.writeError } as never
    // as the real one, it writes where a link leads
    const target = resolve(e.file_path)
    w.files[target] = e.content
    if (w.writes) w.writes[target] = e.content
    return { result: { type: 'create', filePath: e.file_path } } as never
  })
  on('classic.Stop', (_, e) => (w.stop ? w.stop(e) : {}))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

// The document checked: a README in /w/widget, so its project's name is "widget" (rated 5.6, below the
// 6.0 cut-off, so J04 flags it in any other file's opening). "kubelet" is on no list and is used twice
// before it is explained (J01); "utilize" is on the replacement list (J07).
const README = [
  '# Widget',
  '',
  'Widget keeps your notes in one place.',
  '',
  '## Getting started',
  '',
  'The kubelet starts each job. Restart the kubelet when it stops. You can utilize the queue.',
].join('\n')
const ORIGINAL = [
  '# Widget',
  '',
  'Widget keeps your notes in one place.',
  '',
  '## Setup',
  '',
  'The kubelet starts each job. Restart the kubelet when it stops. It holds 42 jobs.',
].join('\n')
const folder = (extra: Files = {}): Files => ({ '/plugin/prompt.md': PROMPT, '/w/widget/README.md': README, ...extra })

const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const FACTS = { model: 'claude-test', promptModel: 'claude-test', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const
const json = (r: { result?: unknown }) => JSON.parse(String(r.result))
const said = (r: { deny?: unknown; text?: unknown; result?: unknown }) => String(r.deny ?? r.text ?? r.result)
const checkTool = (path: string) => ({ tool: 'mcp__jargone__check' as const, path })
type F = { code: string; severity: string; line: number; term?: string; message: string }
const codes = (r: { result?: unknown }) => (json(r).findings as F[]).map(f => `${f.code} ${f.term ?? ''}`.trim())

// ------------------------------------------------------------------------------------ helpers

test('section() reads marked text, with CRLF line ends too, and requestOf() keeps every line', () => {
  expect(section(PROMPT, 'method')).toContain('the method body')
  expect(section(PROMPT.replace(/\n/g, '\r\n'), 'voice')).toContain('{reader}')
  expect(section('no markers here', 'method')).toBe(null)
  expect(requestOf('Base\n<request>\nREADME.md for a new contributor\nand more\n</request>\nfallback')).toBe('README.md for a new contributor\nand more')
  expect(argPath(' "my docs/guide.md" ')).toBe('my docs/guide.md')
})

test('asksSte() finds the flag as a whole word only', () => {
  expect(asksSte('--ste-inspired README.md for a pilot')).toBe(true)
  expect(asksSte('README.md for a pilot --ste-inspired')).toBe(true)
  expect(asksSte('README.md for a pilot')).toBe(false)
  expect(asksSte('README.md for a --ste-inspired-fan')).toBe(false)
})

test('paths: joinPath works out . and .., pathFrom gives the path from the working folder or nothing', () => {
  expect(joinPath('/w', './docs/../widget/README.md')).toBe('/w/widget/README.md')
  expect(pathFrom('/w', '/w/widget/README.md')).toBe('widget/README.md')
  expect(pathFrom('/w/', '/w/widget/README.md')).toBe('widget/README.md')
  expect(pathFrom('/w', '/wx/README.md')).toBe(undefined)
  expect(pathFrom('/w', '/w')).toBe(undefined)
  // Windows: drive letters and backslashes
  expect(joinPath('C:\\proj', 'docs\\..\\widget\\README.md')).toBe('C:/proj/widget/README.md')
  expect(pathFrom('C:/proj/', 'C:/proj/widget/README.md')).toBe('widget/README.md')
  // ".." stops at the drive
  expect(joinPath('C:/proj', '../../x.md')).toBe('C:/x.md')
  expect(pathFrom('/', '/etc/x')).toBe('etc/x')
})

test('resolveTyped() reads a typed path by the rules of the system the working folder is on', () => {
  expect(resolveTyped('/w', 'C:/x.md')).toBe('/w/C:/x.md')
  expect(resolveTyped('/w', 'a\\b.md')).toBe('/w/a\\b.md')
  expect(resolveTyped('/w', './docs/../x.md')).toBe('/w/x.md')
  expect(resolveTyped('/w', '/etc/x')).toBe('/etc/x')
  expect(resolveTyped('C:/proj', 'docs\\a.md')).toBe('C:/proj/docs/a.md')
  expect(resolveTyped('C:/proj', 'D:/x.md')).toBe('D:/x.md')
})

test('UNC paths (a Windows share, or WSL from Windows) are read by Windows rules, not as POSIX paths', () => {
  expect(resolveTyped('//server/share/proj', 'README.md')).toBe('//server/share/proj/README.md')
  expect(pathFrom('//server/share/proj', '//server/share/proj/docs/x.md')).toBe('docs/x.md')
  // ".." stops at the share, as Windows stops it
  expect(joinPath('//server/share/proj', '../../../x.md')).toBe('//server/share/x.md')
  // a POSIX folder spelled with "//" stays POSIX when the system is given
  expect(resolveTyped('//home/u', 'a\\b.md', true)).toBe('/home/u/a\\b.md')
})

test('linkedPath() resolves a link as GitHub does, and leadsTo() knows a folder link opens its README', () => {
  expect(linkedPath('docs/guide.md', '../widget/README.md')).toBe('widget/README.md')
  expect(linkedPath('docs/guide.md', '/widget/README.md')).toBe('widget/README.md')
  expect(linkedPath('docs/guide.md', '<../my%20notes.md?plain=1>')).toBe('my notes.md')
  expect(linkedPath('docs/guide.md', 'https://example.com/README.md')).toBe(undefined)
  expect(linkedPath('docs/guide.md', '../../outside.md')).toBe(undefined)
  expect(leadsTo('widget', 'widget/README.md')).toBe(true)
  expect(leadsTo('widget', 'widget/guide.md')).toBe(false)
  expect(leadsTo('widget/README.md', 'widget/README.md')).toBe(true)
  // a folder link opens a README, but a #fragment reaches a heading only in a Markdown one
  expect(leadsTo('widget', 'widget/readme.markdown')).toBe(true)
  expect(leadsTo('widget', 'widget/README.txt')).toBe(false)
  expect(projectNameOf('/r', 'widget/README.txt').name).toBe('widget')
})

test('projectNameOf(): a README\'s folder, else the working folder, and says which', () => {
  expect(projectNameOf('/home/me/repo', 'widget/README.md')).toEqual({ name: 'widget', from: 'the folder that holds this README' })
  expect(projectNameOf('/home/me/repo', 'README.md')).toEqual({ name: 'repo', from: 'the working folder' })
  expect(projectNameOf('/home/me/repo', 'docs/guide.md')).toEqual({ name: 'repo', from: 'the working folder' })
  // the top of a file system has no name
  expect(projectNameOf('/', 'README.md').name).toBe('')
  expect(projectNameOf('C:/', 'README.md').name).toBe('')
})

test('movesOf() reads the "to" paths once each, and names what is wrong', () => {
  expect(movesOf('{"moves": [{"what": "x", "from": "A", "to": "a-reference.md"}, {"to": "a-reference.md"}]}')).toEqual({ to: ['a-reference.md'], problems: [] })
  expect(movesOf('{"moves": [{"what": "x"}]}').problems).toEqual(['entry 1 has no "to" path'])
  expect(movesOf('[]').problems[0]).toContain('no "moves" list')
  expect(movesOf('{').problems[0]).toContain('not valid JSON')
})

test('parseVoice(): on needs "for" and a reader; flags anywhere; off; status; anything else is refused', () => {
  expect(parseVoice('')).toEqual({ action: 'status' })
  expect(parseVoice(' off ')).toEqual({ action: 'off' })
  expect(parseVoice('on for a new  contributor')).toEqual({ action: 'on', reader: 'a new contributor', rewrite: false, ste: false })
  expect(parseVoice('on --rewrite for "a nurse" --ste-inspired')).toEqual({ action: 'on', reader: 'a nurse', rewrite: true, ste: true })
  expect(parseVoice('on').action).toBe('error')
  expect(parseVoice('on for').action).toBe('error')
  expect(parseVoice('on a nurse').action).toBe('error')
  expect((parseVoice('on for a nurse --rewite') as { message: string }).message).toContain('"--rewite" is not an option')
  expect(parseVoice('off now').action).toBe('error')
  expect(parseVoice('maybe').action).toBe('error')
})

test('voiceText() fills every {reader}, adds the ste line only when asked, and is null when a section is missing', () => {
  expect(voiceText(PROMPT, { reader: 'a nurse', ste: false })).toBe('## Plain replies\nWrite every reply for this reader: a nurse. Keep a nurse in mind.')
  expect(voiceText(PROMPT, { reader: '$& $1', ste: false })).toContain('reader: $& $1. Keep $& $1')
  expect(voiceText(PROMPT, { reader: 'a nurse', ste: true })).toContain('\n\nWrite about 80% of the way to STE.')
  expect(voiceText(PROMPT.replace(/<!-- ste:start -->[\s\S]*<!-- ste:end -->/, ''), { reader: 'a nurse', ste: true })).toBe(null)
  expect(voiceText('nothing', { reader: 'a nurse', ste: false })).toBe(null)
})

test('rewriteRequest() names the reader, lists the findings it is given, and counts the rest', () => {
  const f = { code: 'J01' as const, severity: 'error' as const, line: 2, term: 'ZQA', message: '"ZQA" is not written out.' }
  const t = rewriteRequest('a nurse', [f], 3)
  expect(t).toContain('for this reader: a nurse')
  expect(t).toContain('- Line 2: "ZQA" is not written out.')
  expect(t).toContain('- and 3 more.')
  expect(rewriteRequest('a nurse', [f], 0)).not.toContain('more.')
})

test('utcDate() gives the UTC date, or nothing for a time Date cannot write as one; the report formats it and says UTC only beside a date', () => {
  expect(utcDate(Date.UTC(2026, 9, 31, 3, 0))).toBe('2026-10-31')
  expect(utcDate(Date.UTC(2026, 9, 30, 23, 59))).toBe('2026-10-30')
  expect(utcDate(Number.NaN)).toBe(undefined)
  expect(utcDate(1e17)).toBe(undefined) // past what Date can hold
  expect(utcDate(3e14)).toBe(undefined) // past the year 9999
  expect(utcDate(-1e14)).toBe(undefined) // before the year 0
  expect(checkReport('a.md', Date.UTC(2026, 9, 30, 23, 59), { summary: 's', findings: [] }, [])).toContain('on 2026-10-30 (UTC).')
  expect(checkReport('a.md', Number.NaN, { summary: 's', findings: [] }, [])).toContain('on an unknown date. It changed')
})

test('referenceFileOf(): the one file content may move to, <name>-reference.md beside the document', () => {
  expect(referenceFileOf('widget/README.md')).toBe('widget/README-reference.md')
  expect(referenceFileOf('README.md')).toBe('README-reference.md')
  expect(referenceFileOf('docs/notes.txt')).toBe('docs/notes-reference.md')
  expect(referenceFileOf('NOTES')).toBe('NOTES-reference.md')
})

test('reportHead() is one line for any file name, and is the report\'s first line', () => {
  expect(reportHead('notes\nv2.md')).toBe('# jargone check: notes v2.md')
  expect(checkReport('notes\nv2.md', 0, { summary: 's', findings: [] }, []).split('\n')[0]).toBe(reportHead('notes\nv2.md'))
})

test('checkReport() lists each finding with its line, check and kind, and the notes', () => {
  const r = checkReport('README.md', Date.UTC(2026, 9, 31, 12), { summary: '1 error and 0 warnings (J01: 1).', findings: [{ code: 'J01', severity: 'error', line: 3, term: 'kubelet', message: 'm1', suggestion: ['node agent', '(omit)'] }] }, ['a note'])
  expect(r).toContain('# jargone check: README.md')
  expect(r).toContain('2026-10-31')
  expect(r).toContain('- **Line 3, J01 (error):** m1 Plainer options: "node agent".')
  expect(r).toContain('## Notes\n\n- a note')
  expect(checkReport('a.md', 0, { summary: 'No findings.', findings: [] }, [])).toContain('No findings.')
  // a line break in a note (a folder's name, say) stays inside its list item
  expect(checkReport('a.md', 0, { summary: 's', findings: [] }, ['in x\n## Findings']).split('\n').filter(l => l === '## Findings').length).toBe(1)
  // and so does one in a finding's message (a code span may run over two lines)
  const f = { code: 'J05' as const, severity: 'error' as const, line: 1, message: 'Lost:\n## Findings' }
  expect(checkReport('a.md', 0, { summary: 's', findings: [f] }, []).split('\n').filter(l => l === '## Findings').length).toBe(1)
})

// --------------------------------------------------------------------------------- registration

test('the session registers both commands, the check tool and both reviewer agents, with briefs from prompt.md', async ($, on) => {
  const w: World = { files: folder(), commands: [], tools: [], agents: [] }
  world(on, w)
  await $.session.start(START)
  expect(w.commands!.map(c => c.name)).toEqual(['jargone-check', 'jargone-voice'])
  expect(w.tools!.map(t => t.name)).toEqual(['check'])
  expect((w.tools![0]!.inputSchema as { required: string[] }).required).toEqual(['path'])
  const agents = Object.fromEntries(w.agents!.map(a => [a.name as string, a]))
  expect(agents['accuracy-reviewer']!.tools).toEqual(['Read', 'Grep', 'Glob'])
  expect(agents['accuracy-reviewer']!.prompt).toBe('accuracy brief')
  expect(agents['cold-reader']!.tools).toEqual([])
  expect(agents['cold-reader']!.prompt).toBe('cold reader brief')
})

// ------------------------------------------------------------------------------- the /jargone skill

const SKILL_TEXT = (req: string) => `Base directory for this skill: /plugin/skills/jargone\n\nWhat to rewrite and for whom, as typed after /jargone:\n\n<request>\n${req}\n</request>\n\nIf you can read this paragraph, fallback text`

test('/jargone injects the request, the tool and agents that registered, the method and the briefs', async ($, on) => {
  world(on, { files: folder() })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  await $.session.start(START)
  const r = await $.skill.prompt({ skill: 'jargone:jargone', text: SKILL_TEXT('README.md for a new contributor') })
  expect(r.text).toContain('README.md for a new contributor')
  expect(r.text).toContain('Tool: `mcp__jargone__check` { path }')
  expect(r.text).toContain('`jargone:accuracy-reviewer`, `jargone:cold-reader`')
  expect(r.text).toContain('the method body')
  expect(r.text).toContain('accuracy brief')
  expect(r.text).toContain('cold reader brief')
  expect(r.text).not.toContain('fallback text')
  expect(r.text).not.toContain('paste-form text')
  expect(r.text).not.toContain('Write about 80% of the way to STE.')
})

test('/jargone adds the ste line only when the request has --ste-inspired', async ($, on) => {
  world(on, { files: folder() })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  await $.session.start(START)
  const r = await $.skill.prompt({ skill: 'jargone:jargone', text: SKILL_TEXT('--ste-inspired README.md for a pilot') })
  expect(r.text).toContain('Write about 80% of the way to STE.')
})

test('/jargone says what did not register, and still carries the briefs', async ($, on) => {
  world(on, { files: folder(), agentsFail: true, toolFails: true })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  await $.session.start(START)
  const r = await $.skill.prompt({ skill: 'jargone:jargone', text: SKILL_TEXT('README.md for a nurse') })
  expect(r.text).toContain('The check tool did not register')
  expect(r.text).toContain('No reviewer agents registered')
  expect(r.text).toContain('cold reader brief')
  expect(r.text).not.toContain('`jargone:cold-reader`')
})

test('/jargone treats a check tool registered under another name as missing, since nothing answers that name', async ($, on) => {
  world(on, { files: folder(), toolName: 'mcp__jargone-dev__check' })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  await $.session.start(START)
  const r = await $.skill.prompt({ skill: 'jargone:jargone', text: SKILL_TEXT('README.md for a nurse') })
  expect(r.text).toContain('did not register as `mcp__jargone__check` in this session (a tool registered as `mcp__jargone-dev__check`, which nothing answers: do not call it). Do not search for it.')
  expect(r.text).not.toContain('Tool: `')
})

test('/jargone says the plugin is installed incorrectly, and injects no method, when prompt.md is missing or lacks the briefs', async ($, on) => {
  const files = folder()
  world(on, { files })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  await $.session.start(START)
  files['/plugin/prompt.md'] = PROMPT.replace(/<!-- lenses:start -->[\s\S]*<!-- lenses:end -->/, '')
  const noLenses = await $.skill.prompt({ skill: 'jargone:jargone', text: SKILL_TEXT('README.md for a nurse') })
  expect(noLenses.text).toContain('installed incorrectly')
  expect(noLenses.text).not.toContain('the method body')
  delete files['/plugin/prompt.md']
  expect((await $.skill.prompt({ skill: 'jargone:jargone', text: SKILL_TEXT('x') })).text).toContain('installed incorrectly')
})

// ------------------------------------------------------------------------------------ the check

test('the check tool reads the file through the Read tool and returns its findings and scores as JSON', async ($, on) => {
  const reads: string[] = []
  world(on, { files: folder(), reads })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('widget/README.md'))
  const out = json(r)
  expect(out.file).toBe('widget/README.md')
  expect(codes(r)).toEqual(['J01 kubelet', 'J07 utilize'])
  expect(out.summary).toContain('1 error and 1 warning')
  expect(out.summary).toContain('J05 did not run: there is no saved original.')
  expect(typeof out.scores.flesch).toBe('number')
  expect(reads).toContain('/w/widget/README.md')
  // the project's name is the README's folder, so J04 passes "Widget" in the opening, and the note says so
  expect(out.notes.join(' ')).toContain('"widget", the name of the folder that holds this README')
  // nothing is said of files that are simply not there: no glossary, no saved original
  expect(out.notes.length).toBe(1)
})

test('the project\'s name rule decides J04: the same opening in a file that is not a README fails on "Widget"', async ($, on) => {
  world(on, { files: folder({ '/w/widget/guide.md': README }) })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('/w/widget/guide.md'))
  expect(codes(r)).toContain('J04 Widget')
  expect(json(r).notes.join(' ')).toContain('"w", the name of the working folder')
})

test('with no project name to be had (a working folder at /), the note says so instead of naming an empty one', async ($, on) => {
  world(on, { files: { '/plugin/prompt.md': PROMPT, '/README.md': README }, cwd: '/' })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('README.md'))
  expect(json(r).notes.join(' ')).toContain('No project name was found (the working folder has no name), so J04 accepts no name in the opening.')
  expect(codes(r)).toContain('J04 Widget')
})

test('the check tool honours the glossary: a known term is not flagged', async ($, on) => {
  const reads: string[] = []
  world(on, { files: folder({ '/w/.jargone/glossary.json': '{"known": ["kubelet"], "colour": 1}' }), reads })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('widget/README.md'))
  expect(codes(r)).toEqual(['J07 utilize'])
  expect(reads).toContain('/w/.jargone/glossary.json')
  // a glossary problem is reported, not dropped
  expect(json(r).notes.join(' ')).toContain('"colour" is not a glossary field')
})

test('a glossary the Read tool refuses is not used, and the result says so', async ($, on) => {
  world(on, { files: folder({ '/w/.jargone/glossary.json': '{"known": ["kubelet"]}' }), denyRead: ['glossary.json'] })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('widget/README.md'))
  expect(codes(r)).toContain('J01 kubelet')
  expect(json(r).notes.join(' ')).toContain('.jargone/glossary.json could not be read, so the defaults were used')
})

test('with a saved original, J05 reads the moved-to files and the links to the document from other Markdown files', async ($, on) => {
  const reads: string[] = []
  world(on, {
    reads,
    files: folder({
      '/w/.jargone/originals/widget/README.md': ORIGINAL,
      '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"what": "the job count", "from": "Setup", "to": "widget/README-reference.md"}]}',
      '/w/widget/README-reference.md': '# Widget reference\n\nIt holds 42 jobs.',
      '/w/docs/guide.md': 'See [setup](../widget/README.md#setup) and [the top](../widget/README.md).',
      '/w/node_modules/pkg/README.md': '[x](../../widget/README.md#setup)',
      '/w/.jargone/reports/old.md': '[x](../../widget/README.md#setup)',
      '/w/.JARGONE/old.md': '[x](../widget/README.md#setup)',
    }),
  })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('widget/README.md'))
  const j05 = (json(r).findings as F[]).filter(f => f.code === 'J05')
  // 42 moved to the reference file, so it is not lost; the renamed heading breaks the guide's link
  expect(j05.map(f => f.message).join('\n')).not.toContain('42')
  expect(j05.length).toBe(1)
  expect(j05[0]!.message).toContain('The link from docs/guide.md to "#setup"')
  expect(reads).toContain('/w/widget/README-reference.md')
  expect(reads).toContain('/w/docs/guide.md')
  // never searched: installed packages and jargone's own folder
  expect(reads).not.toContain('/w/node_modules/pkg/README.md')
  expect(reads).not.toContain('/w/.jargone/reports/old.md')
  // one rule for jargone's folder, in any case
  expect(reads).not.toContain('/w/.JARGONE/old.md')
})

test('without the moves file, what moved counts as lost (J05 compares against the original alone)', async ($, on) => {
  world(on, { files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/widget/README-reference.md': 'It holds 42 jobs.' }) })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  const j05 = (r.findings as F[]).filter(f => f.code === 'J05')
  expect(j05.some(f => f.message.includes('The number 42'))).toBe(true)
  // a moves file that is not there is not a problem to report
  expect(r.notes.join(' ')).not.toContain('moves file')
})

test('content counts as moved only to <name>-reference.md beside the document: any other listed path is not read, the saved original included', async ($, on) => {
  const reads: string[] = []
  world(on, {
    reads,
    files: folder({
      '/w/.jargone/originals/widget/README.md': ORIGINAL,
      '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"to": ".jargone/originals/widget/README.md"}, {"to": ".Jargone/originals/widget/README.md"}, {"to": "docs/copy.txt"}]}',
      '/w/docs/copy.txt': ORIGINAL,
    }),
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect((r.findings as F[]).some(f => f.code === 'J05' && f.message.includes('The number 42'))).toBe(true)
  const notes = r.notes.join(' ')
  for (const t of ['.jargone/originals/widget/README.md', '.Jargone/originals/widget/README.md', 'docs/copy.txt']) {
    expect(notes).toContain(`The moves file lists ${t}, but content moves only to widget/README-reference.md, the reference file beside the document, so ${t} was not read.`)
  }
  expect(reads).not.toContain('/w/docs/copy.txt')
})

test('the reference file counts with whatever it holds, as SPEC section 4 says (content it already held included)', async ($, on) => {
  world(on, {
    files: folder({
      '/w/.jargone/originals/widget/README.md': ORIGINAL,
      '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"to": "widget/README-reference.md"}]}',
      // a reference file that already held the job count before this rewrite
      '/w/widget/README-reference.md': `# Widget reference\n\n${ORIGINAL}\n`,
    }),
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect((r.findings as F[]).some(f => f.code === 'J05' && f.message.includes('The number 42'))).toBe(false)
  expect(r.notes.join(' ')).not.toContain('README-reference.md')
})

test('a reference file that is a link (here, into .jargone/) is not read, and what moved there counts as lost', async ($, on) => {
  const reads: string[] = []
  world(on, {
    reads,
    files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"to": "widget/README-reference.md"}]}' }),
    links: { '/w/widget/README-reference.md': '/w/.jargone/originals/widget/README.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect((r.findings as F[]).some(f => f.code === 'J05' && f.message.includes('The number 42'))).toBe(true)
  expect(r.notes.join(' ')).toContain('The moved-to file widget/README-reference.md is a link, not a file of its own, so it was not read and what moved there counts as lost')
  // the link search may read it as a linked Markdown file (that can only add findings); the moves check did not
  expect(reads.filter(p => p === '/w/widget/README-reference.md').length).toBeLessThanOrEqual(1)
})
test('a reference file named in another case is not the reference file', async ($, on) => {
  world(on, {
    files: folder({
      '/w/.jargone/originals/widget/README.md': ORIGINAL,
      '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"to": "widget/readme-reference.md"}]}',
      '/w/widget/readme-reference.md': ORIGINAL,
    }),
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect((r.findings as F[]).some(f => f.code === 'J05' && f.message.includes('The number 42'))).toBe(true)
  expect(r.notes.join(' ')).toContain('The moves file lists widget/readme-reference.md, but content moves only to widget/README-reference.md')
})
test('a document reached through a linked folder keeps its own reference file, and a path listed twice is read once', async ($, on) => {
  const reads: string[] = []
  world(on, {
    reads,
    files: folder({
      '/repos/widget/README.md': README,
      '/repos/widget/README-reference.md': 'It holds 42 jobs.',
      '/w/.jargone/originals/packages/widget/README.md': ORIGINAL,
      '/w/.jargone/moves/packages/widget/README.md.json': '{"moves": [{"to": "packages/widget/README-reference.md"}, {"to": "./packages/widget/README-reference.md"}, {"to": "/w/packages/widget/README-reference.md"}]}',
    }),
    links: { '/w/packages/widget': '/repos/widget' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('packages/widget/README.md')))
  expect((r.findings as F[]).some(f => f.code === 'J05' && f.message.includes('The number 42'))).toBe(false)
  expect(reads.filter(p => p === '/w/packages/widget/README-reference.md').length).toBe(1)
})

test('a heading moved to the reference file is found there, as the rewrite links to it by that file\'s name', async ($, on) => {
  const original = '# Widget\n\nWidget keeps your notes in one place.\n\nSee [the options](#options).\n\n## Options\n\nThe options are plain.'
  const rewrite = '# Widget\n\nWidget keeps your notes in one place.\n\nSee [the options](README-reference.md#options).'
  world(on, {
    files: {
      '/plugin/prompt.md': PROMPT,
      '/w/widget/README.md': rewrite,
      '/w/.jargone/originals/widget/README.md': original,
      // listed with a leading ./ ; J05 finds the heading by the file's name, which the rewrite links to
      '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"to": "./widget/README-reference.md"}]}',
      '/w/widget/README-reference.md': '# Widget reference\n\n## Options\n\nThe options are plain.',
    },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect((r.findings as F[]).filter(f => f.code === 'J05')).toEqual([])
})

test('a reference file that is a link to nothing is a link, not a missing file', async ($, on) => {
  world(on, {
    files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"to": "widget/README-reference.md"}]}' }),
    links: { '/w/widget/README-reference.md': '/w/gone.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect(r.notes.join(' ')).toContain('The moved-to file widget/README-reference.md is a link, not a file of its own')
})

test('a missing reference file is reported, and what moved there counts as lost', async ($, on) => {
  world(on, { files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"to": "widget/README-reference.md"}]}' }) })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect(r.notes.join(' ')).toContain('The moved-to file widget/README-reference.md could not be read, so what moved there counts as lost: /w/widget/README-reference.md does not exist.')
  expect((r.findings as F[]).some(f => f.code === 'J05' && f.message.includes('The number 42'))).toBe(true)
})

test('a document that is itself a link keeps the reference file written beside it', async ($, on) => {
  const files = folder({
    '/w/shared/README.md': README,
    '/w/widget/README-reference.md': 'It holds 42 jobs.',
    '/w/.jargone/originals/widget/README.md': ORIGINAL,
    '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"to": "widget/README-reference.md"}]}',
  })
  delete files['/w/widget/README.md']
  world(on, { files, links: { '/w/widget/README.md': '/w/shared/README.md' } })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect((r.findings as F[]).some(f => f.code === 'J05' && f.message.includes('The number 42'))).toBe(false)
})
test('links to the document are looked for in at most MAX_LINK_FILES other files, and the result says how many were skipped', async ($, on) => {
  const extra: Files = { '/w/.jargone/originals/widget/README.md': README }
  for (let i = 0; i < MAX_LINK_FILES + 3; i++) extra[`/w/notes/n${String(i).padStart(3, '0')}.md`] = 'nothing here'
  const reads: string[] = []
  world(on, { files: folder(extra), reads })
  await $.session.start(START)
  const notes = json(await $.tool.call(checkTool('widget/README.md'))).notes.join(' ')
  expect(notes).toContain(`the first ${MAX_LINK_FILES} of ${MAX_LINK_FILES + 3} other Markdown files`)
  expect(reads.filter(p => p.startsWith('/w/notes/')).length).toBe(MAX_LINK_FILES)
})

test('a file read in pages: the Read tool\'s size refusals shrink the page, and the whole file is checked', async ($, on) => {
  const long = ['# Notes', '', 'These notes are plain.', ...Array.from({ length: 300 }, (_, i) => `Line ${i} is plain.`), 'You can utilize the queue.'].join('\n')
  world(on, { files: folder({ '/w/long.md': long }), pageCap: 50 })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('long.md')))
  expect((r.findings as F[]).find(f => f.code === 'J07')?.line).toBe(304)
})

test('the check tool refuses a file outside the working folder, a missing path, a missing file, and a deny rule for itself', async ($, on) => {
  const w: World = { files: folder({ '/elsewhere/a.md': 'x' }) }
  world(on, w)
  await $.session.start(START)
  expect(said(await $.tool.call(checkTool('/elsewhere/a.md')))).toContain('is not inside the working folder (/w)')
  expect(said(await $.tool.call(checkTool('../elsewhere/a.md')))).toContain('is not inside the working folder')
  expect(said(await $.tool.call(checkTool('  ')))).toContain('check needs { path }')
  expect(said(await $.tool.call(checkTool('nope.md')))).toContain('/w/nope.md does not exist')
  w.toolVerdict = { decision: 'deny', rule: 'mcp__jargone__check', reason: 'not here' }
  expect(said(await $.tool.call(checkTool('widget/README.md')))).toContain('the person\'s settings deny mcp__jargone__check: not here')
})

test('when the person\'s settings ask before the check tool runs, jargone asks, and runs it only on "Allow it"', async ($, on) => {
  const w: World = { files: folder(), toolVerdict: { decision: 'ask', rule: 'mcp__jargone__check' } }
  world(on, w)
  await $.session.start(START)
  expect(said(await $.tool.call(checkTool('widget/README.md')))).toContain('ask before mcp__jargone__check runs, and it was not allowed')
  w.answer = 'Do not allow it'
  expect(said(await $.tool.call(checkTool('widget/README.md')))).toContain('it was not allowed')
  w.answer = 'Allow it'
  expect(codes(await $.tool.call(checkTool('widget/README.md')))).toEqual(['J01 kubelet', 'J07 utilize'])
})

test('/jargone-check writes its findings through the Write tool to .jargone/reports/<file>.check.md', async ($, on) => {
  const writes: Files = {}
  world(on, { files: folder(), writes })
  await $.session.start(START)
  const r = await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  const path = '/w/.jargone/reports/widget/README.md.check.md'
  expect(Object.keys(writes)).toEqual([path])
  expect(writes[path]).toContain('# jargone check: widget/README.md')
  expect(writes[path]).toContain('on 2026-10-31 (UTC).')
  expect(writes[path]).toContain('J01 (error):** "kubelet"')
  expect(writes[path]).toContain('J07 (warning):** "utilize"')
  expect(r.text).toContain('jargone-check widget/README.md: 1 error and 1 warning')
  expect(r.text).toContain('Findings: .jargone/reports/widget/README.md.check.md')
})

test('/jargone-check reads an earlier report before replacing it, and gives the findings when the write fails', async ($, on) => {
  const reads: string[] = []
  const w: World = { files: folder({ '/w/.jargone/reports/widget/README.md.check.md': '# jargone check: widget/README.md\n\nold' }), reads }
  world(on, w)
  await $.session.start(START)
  await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(reads).toContain('/w/.jargone/reports/widget/README.md.check.md')
  w.writeError = 'File is in a directory that is denied by your permission settings.'
  const r = await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(r.text).toContain('was not written: File is in a directory that is denied')
  expect(r.text).toContain('Line 7, J01 (error)')
  expect((await $.command.run({ command: 'jargone-check', args: '', ...RUN })).text).toContain('name the file')
})

test('/jargone-check says why when an earlier report cannot be read first, and writes nothing', async ($, on) => {
  const writes: Files = {}
  world(on, { files: folder({ '/w/.jargone/reports/widget/README.md.check.md': 'old' }), writes, denyRead: ['README.md.check.md'] })
  await $.session.start(START)
  const r = await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(r.text).toContain('was not written: an earlier report is there, and it could not be read before replacing it: the Read tool could not read')
  expect(r.text).toContain('Line 7, J01 (error)')
  expect(writes).toEqual({})
})

// ---------------------------------------------------------------------------------- session mode

const voice = ($: Engine, args: string) => $.command.run({ command: 'jargone-voice', args, ...RUN })
const composed = async ($: Engine, facts: Record<string, unknown> = {}) =>
  (await $.prompt.compose({ ...FACTS, ...facts } as never)).sections.find(s => s.id === 'jargone:voice')

test('/jargone-voice turns session mode on and off, and alone says whether it is on', async ($, on) => {
  world(on, { files: folder() })
  await $.session.start(START)
  expect((await voice($, '')).text).toContain('jargone-voice: off.')
  expect((await voice($, 'on for a new contributor')).text).toBe('jargone-voice: on for a new contributor. Each reply is checked, and a note is shown after it; warn-only.')
  expect((await voice($, '')).text).toContain('on for a new contributor')
  expect((await voice($, '')).text).toContain('warn-only')
  expect((await voice($, 'on for a nurse --rewrite --ste-inspired')).text).toContain('a reply that fails is rewritten once')
  expect((await voice($, '')).text).toContain('ASD-STE100-inspired style on')
  expect((await voice($, 'off')).text).toBe('jargone-voice: off.')
  expect((await voice($, 'off')).text).toBe('jargone-voice: already off.')
})

test('/jargone-voice on needs a reader, and refuses an unknown option, changing nothing', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }] }))
  world(on, { files: folder() })
  await $.session.start(START)
  expect((await voice($, 'on')).text).toContain('Name the reader after "for"')
  expect((await voice($, 'on for a nurse --rewite')).text).toContain('is not an option')
  expect(await composed($)).toBe(undefined)
})

test('/jargone-voice on refuses when prompt.md lacks the voice section, or the ste section it was asked for', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }] }))
  const files = folder()
  world(on, { files })
  await $.session.start(START)
  files['/plugin/prompt.md'] = PROMPT.replace(/<!-- ste:start -->[\s\S]*<!-- ste:end -->/, '')
  expect((await voice($, 'on for a nurse --ste-inspired')).text).toContain('installed incorrectly')
  expect(await composed($)).toBe(undefined)
  files['/plugin/prompt.md'] = PROMPT.replace(/<!-- voice:start -->[\s\S]*<!-- voice:end -->/, '')
  expect((await voice($, 'on for a nurse')).text).toContain('installed incorrectly')
})

test('prompt.compose adds the voice section only while on, with the reader filled in, last and on the session side', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }] }))
  const files = folder()
  world(on, { files })
  await $.session.start(START)
  expect(await composed($)).toBe(undefined)
  await voice($, 'on for a new contributor')
  const all = (await $.prompt.compose(FACTS as never)).sections
  expect(all.map(s => s.id)).toEqual(['intro', 'jargone:voice'])
  expect(all[1]).toEqual({ id: 'jargone:voice', scope: 'session', text: '## Plain replies\nWrite every reply for this reader: a new contributor. Keep a new contributor in mind.' })
  // the instruction was built when session mode was turned on, so it does not depend on prompt.md after that
  delete files['/plugin/prompt.md']
  expect((await composed($))?.text).toContain('a new contributor')
  await voice($, 'off')
  expect(await composed($)).toBe(undefined)
})

test('prompt.compose adds the ste line only with --ste-inspired, and leaves a teammate\'s prompt alone', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }] }))
  world(on, { files: folder() })
  await $.session.start(START)
  await voice($, 'on for a pilot')
  expect((await composed($))!.text).not.toContain('STE')
  await voice($, 'on for a pilot --ste-inspired')
  expect((await composed($))!.text).toContain('a pilot.')
  expect((await composed($))!.text).toContain('\n\nWrite about 80% of the way to STE.')
  expect(await composed($, { traits: ['teammate'] })).toBe(undefined)
})

test('prompt.compose keeps one jargone:voice section, its own, when one already reached it', async ($, on) => {
  // a section id is unique in one list; a stale copy beneath (say, from a module loaded twice) is replaced, not repeated
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }, { id: 'jargone:voice', text: 'stale', scope: 'session' as const }] }))
  world(on, { files: folder() })
  await $.session.start(START)
  await voice($, 'on for a pilot')
  const all = (await $.prompt.compose(FACTS as never)).sections
  expect(all.filter(s => s.id === 'jargone:voice').map(s => s.text)).toEqual(['## Plain replies\nWrite every reply for this reader: a pilot. Keep a pilot in mind.'])
})

test('the conflict notice: once after turning on, naming the output style and other plugins\' sections, never jargone\'s or the engine\'s', async ($, on) => {
  const logs: string[] = []
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }, { id: 'tidy:rules', text: 'be terse', scope: 'session' as const }] }))
  world(on, { files: folder(), logs })
  await $.session.start(START)
  await composed($, { outputStyle: { name: 'Explanatory', isKeepingCodingInstructions: true } })
  expect(logs).toEqual([])
  await voice($, 'on for a nurse')
  // /context measures the prompt and sends nothing: it does not use up the notice
  await composed($, { outputStyle: { name: 'Explanatory', isKeepingCodingInstructions: true }, traits: ['analysis'] })
  expect(logs).toEqual([])
  await composed($, { outputStyle: { name: 'Explanatory', isKeepingCodingInstructions: true } })
  await composed($, { outputStyle: { name: 'Explanatory', isKeepingCodingInstructions: true } })
  expect(logs.length).toBe(1)
  expect(logs[0]).toContain('the output style "Explanatory"')
  expect(logs[0]).toContain('(tidy:rules)')
  expect(logs[0]).not.toContain('intro')
  expect(logs[0]).not.toContain('jargone:voice')
  // turning it on again is a new start, so the notice is due again
  await voice($, 'on for a pilot')
  await composed($)
  expect(logs.length).toBe(2)
  expect(logs[1]).not.toContain('output style')
})

test('the conflict notice reads the whole prompt, so a plugin whose hook runs above jargone\'s is named too', async ($, on) => {
  const logs: string[] = []
  let calls = 0
  // jargone's own hook sees only what is beneath it; its composition through every other hook also has
  // the section a plugin above adds (here: the second call, which the notice makes)
  on('prompt.compose', () => {
    calls++
    return { sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }, ...(calls > 1 ? [{ id: 'above:style', text: 'x', scope: 'session' as const }] : [])] }
  })
  world(on, { files: folder(), logs })
  await $.session.start(START)
  await voice($, 'on for a nurse')
  await composed($)
  expect(logs.length).toBe(1)
  expect(logs[0]).toContain('(above:style)')
})

test('the conflict notice falls back to what reached jargone, and says so, when the whole prompt cannot be composed', async ($, on) => {
  const logs: string[] = []
  let calls = 0
  on('prompt.compose', () => {
    if (++calls > 1) throw new Error('compose failed')
    return { sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }, { id: 'tidy:rules', text: 'x', scope: 'session' as const }] }
  })
  world(on, { files: folder(), logs })
  await $.session.start(START)
  await voice($, 'on for a nurse')
  expect((await composed($))?.id).toBe('jargone:voice')
  expect(logs.length).toBe(1)
  expect(logs[0]).toContain('(tidy:rules), and possibly others jargone could not see')
})

test('no conflict notice when there is no output style and no other plugin section', async ($, on) => {
  const logs: string[] = []
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }] }))
  world(on, { files: folder(), logs })
  await $.session.start(START)
  await voice($, 'on for a nurse')
  await composed($)
  expect(logs).toEqual([])
})

// A reply with 12 undefined abbreviations (J01) and one long sentence (J03).
const BAD_REPLY = `We set up ${Array.from({ length: 12 }, (_, i) => `ZQ${String.fromCharCode(65 + i)}`).join(', ')} today. Then ${Array.from({ length: 34 }, () => 'word').join(' ')}.`

test('in warn-only mode a reply gets a note the model does not read, and is never sent back', async ($, on) => {
  const logs: string[] = []
  world(on, { files: folder(), logs })
  await $.session.start(START)
  // off: nothing
  expect(await $.classic.Stop({ stop_hook_active: false, last_assistant_message: BAD_REPLY })).toEqual({})
  expect(logs).toEqual([])
  await voice($, 'on for a nurse')
  const r = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: BAD_REPLY })
  expect(r.block).toBe(undefined)
  expect(logs).toEqual(['jargone: 12 undefined terms, longest sentence 35 words'])
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Done. The file is saved.' })
  expect(logs[1]).toBe('jargone: nothing to flag')
  // off again: no note
  await voice($, 'off')
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: BAD_REPLY })
  expect(logs.length).toBe(2)
})

test('with --rewrite a failing reply is sent back once, with at most 10 findings and the count of the rest', async ($, on) => {
  const logs: string[] = []
  world(on, { files: folder(), logs })
  await $.session.start(START)
  await voice($, 'on for a nurse --rewrite')
  const r = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: BAD_REPLY })
  expect(r.block).toContain('for this reader: a nurse')
  expect(r.block!.split('\n').filter(l => l.startsWith('- Line')).length).toBe(10)
  expect(r.block).toContain('- and 3 more.')
  expect(logs[0]).toBe('jargone: 12 undefined terms, longest sentence 35 words (asked Claude to rewrite the reply once)')
  // the rewrite's own Stop arrives with stop_hook_active: never sent back again, but still noted
  const again = await $.classic.Stop({ stop_hook_active: true, last_assistant_message: BAD_REPLY })
  expect(again.block).toBe(undefined)
  expect(logs[1]).toBe('jargone: 12 undefined terms, longest sentence 35 words')
  // a clean reply is not sent back
  expect((await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Done. The file is saved.' })).block).toBe(undefined)
})

test('the reply check leaves subagents alone, and keeps a block from a hook beneath it', async ($, on) => {
  const logs: string[] = []
  // a settings hook beneath that sends this reply back for its own reason
  world(on, { files: folder(), logs, stop: e => (e.last_assistant_message?.startsWith('Their turn.') ? { block: 'their reason' } : {}) })
  await $.session.start(START)
  await voice($, 'on for a nurse --rewrite')
  expect((await $.classic.Stop({ stop_hook_active: false, last_assistant_message: BAD_REPLY, agent_id: 'a1' })).block).toBe(undefined)
  expect(logs).toEqual([])
  // the reply fails jargone's check too, but their request stands alone: the reply is not final yet
  const r = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: `Their turn. ${BAD_REPLY}` })
  expect(r.block).toBe('their reason')
  expect(logs).toEqual(['jargone: 12 undefined terms, longest sentence 35 words'])
})

test('the reply check asks for no rewrite when a hook beneath it stops the session', async ($, on) => {
  const logs: string[] = []
  world(on, { files: folder(), logs, stop: () => ({ preventContinuation: true, stopReason: 'their stop' }) })
  await $.session.start(START)
  await voice($, 'on for a nurse --rewrite')
  const r = await $.classic.Stop({ stop_hook_active: false, last_assistant_message: BAD_REPLY })
  expect(r.block).toBe(undefined)
  expect(r.preventContinuation).toBe(true)
  expect(logs).toEqual(['jargone: 12 undefined terms, longest sentence 35 words'])
})

test('the reply check honours the glossary, reading it again only when the file changes, and shows its problems in the note', async ($, on) => {
  const logs: string[] = []
  const reads: string[] = []
  const G = '/w/.jargone/glossary.json'
  const w: World = { files: folder({ [G]: '{"known": ["ZQA", "ZQB"]}' }), logs, reads, mtimes: { [G]: 1 } }
  world(on, w)
  await $.session.start(START)
  // turning session mode on reads the glossary; replies after that do not read it again
  await voice($, 'on for a nurse')
  expect(reads.filter(p => p === G).length).toBe(1)
  const REPLY = 'We set up ZQA, ZQB and ZQC today.'
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: REPLY })
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: REPLY })
  expect(logs).toEqual(['jargone: 1 undefined term', 'jargone: 1 undefined term'])
  expect(reads.filter(p => p === G).length).toBe(1)
  // a change of time is read again, and the glossary's problems go into the note
  w.files[G] = '{"known": ["ZQA", "ZQB", "ZQC"], "knwon": []}'
  w.mtimes![G] = 2
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: REPLY })
  expect(reads.filter(p => p === G).length).toBe(2)
  expect(logs[2]).toBe('jargone: nothing to flag Glossary: "knwon" is not a glossary field, so it was ignored.')
  // so is a change of size alone
  w.files[G] = '{"known": ["ZQA"]}'
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: REPLY })
  expect(reads.filter(p => p === G).length).toBe(3)
  expect(logs[3]).toBe('jargone: 2 undefined terms')
})

test('a glossary the Read tool refuses is asked about once, not after every reply, until it changes or session mode is turned on again', async ($, on) => {
  const logs: string[] = []
  const reads: string[] = []
  const G = '/w/.jargone/glossary.json'
  const w: World = { files: folder({ [G]: '{"known": ["ZQA"]}' }), logs, reads, denyRead: ['glossary.json'], mtimes: { [G]: 1 } }
  world(on, w)
  await $.session.start(START)
  expect((await voice($, 'on for a nurse')).text).toContain('Glossary: .jargone/glossary.json could not be read, so the defaults were used')
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'We set up ZQA today.' })
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'We set up ZQA today.' })
  expect(reads.filter(p => p === G).length).toBe(1)
  expect(logs[0]).toContain('jargone: 1 undefined term Glossary: .jargone/glossary.json could not be read')
  expect(logs[0]).toContain('It is tried again when it changes, or when session mode is turned on again.')
  w.denyRead = []
  await voice($, 'on for a nurse')
  expect(reads.filter(p => p === G).length).toBe(2)
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'We set up ZQA today.' })
  expect(logs[2]).toBe('jargone: nothing to flag')
})

test('a glossary path that is not a file is reported in session mode, as the check tool reports it', async ($, on) => {
  const logs: string[] = []
  world(on, { files: folder({ '/w/.jargone/glossary.json/x': 'x' }), logs })
  await $.session.start(START)
  expect((await voice($, 'on for a nurse')).text).toContain('Glossary: .jargone/glossary.json could not be read, so the defaults were used: /w/.jargone/glossary.json is not a regular file.')
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Done.' })
  expect(logs[0]).toContain('is not a regular file.')
  expect(json(await $.tool.call(checkTool('widget/README.md'))).notes.join(' ')).toContain('/w/.jargone/glossary.json is not a regular file.')
})

test('session mode is on only with its instruction: a stored value marked on but with no text is off everywhere', async ($, on) => {
  const logs: string[] = []
  // a value an earlier version of the module stored, before the instruction was kept with it
  on('state.get', (_, e, next) => (e.key === 'voice' ? { value: { value: { on: true, reader: 'a nurse', rewrite: true, ste: false, text: '' }, version: 1 } } as never : next(e)))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }] }))
  world(on, { files: folder(), logs })
  await $.session.start(START)
  expect((await voice($, '')).text).toContain('jargone-voice: off.')
  expect(await composed($)).toBe(undefined)
  expect((await $.classic.Stop({ stop_hook_active: false, last_assistant_message: BAD_REPLY })).block).toBe(undefined)
  expect(logs).toEqual([])
})

test('when turning session mode on fails part way, it stays off', async ($, on) => {
  on('state.set', (_, e, next) => {
    if (e.key === 'replyGlossary' && (e.value as { stamp: string }).stamp !== '') return { deny: 'store failed' }
    return next(e)
  })
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' as const }] }))
  world(on, { files: folder({ '/w/.jargone/glossary.json': '{}' }) })
  await $.session.start(START)
  expect((await voice($, 'on for a nurse')).text).toContain('jargone-voice crashed')
  expect((await voice($, '')).text).toContain('jargone-voice: off.')
  expect(await composed($)).toBe(undefined)
})

test('turning session mode on again keeps the glossary it had when the fresh read fails part way', async ($, on) => {
  const reads: string[] = []
  const G = '/w/.jargone/glossary.json'
  let failWrites = false
  on('state.set', (_, e, next) => (failWrites && e.key === 'replyGlossary' && (e.value as { stamp: string }).stamp !== '' ? { deny: 'store failed' } : next(e)))
  world(on, { files: folder({ [G]: '{"known": ["ZQA"]}' }), reads, mtimes: { [G]: 1 } })
  await $.session.start(START)
  await voice($, 'on for a nurse')
  expect(reads.filter(p => p === G).length).toBe(1)
  failWrites = true
  expect((await voice($, 'on for a pilot')).text).toContain('jargone-voice crashed')
  expect(reads.filter(p => p === G).length).toBe(2)
  // still on for the first reader, and the glossary it kept is used without another read
  expect((await voice($, '')).text).toContain('on for a nurse')
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'We set up ZQA today.' })
  expect(reads.filter(p => p === G).length).toBe(2)
})

test('a fresh read with no glossary there is kept, so a refusal held from before is not reused when the file comes back', async ($, on) => {
  const reads: string[] = []
  const G = '/w/.jargone/glossary.json'
  const w: World = { files: folder({ [G]: '{"known": ["ZQA"]}' }), reads, denyRead: ['glossary.json'], mtimes: { [G]: 1 } }
  world(on, w)
  await $.session.start(START)
  await voice($, 'on for a nurse')
  expect(reads.filter(p => p === G).length).toBe(1)
  const kept = w.files[G]!
  delete w.files[G]
  await voice($, 'on for a nurse')
  // moved back unchanged (same time and size), and now readable
  w.files[G] = kept
  w.denyRead = []
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'We set up ZQA today.' })
  expect(reads.filter(p => p === G).length).toBe(2)
})

test('a glossary that disappears between replies is recorded, so a refusal held from before is not reused when it comes back', async ($, on) => {
  const reads: string[] = []
  const G = '/w/.jargone/glossary.json'
  const w: World = { files: folder({ [G]: '{"known": ["ZQA"]}' }), reads, denyRead: ['glossary.json'], mtimes: { [G]: 1 } }
  world(on, w)
  await $.session.start(START)
  await voice($, 'on for a nurse')
  const kept = w.files[G]!
  delete w.files[G]
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Done.' })
  w.files[G] = kept
  w.denyRead = []
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'We set up ZQA today.' })
  expect(reads.filter(p => p === G).length).toBe(2)
})

test('the reply glossary is judged from one look: its stamp and its read see the same moment', async ($, on) => {
  const G = '/w/.jargone/glossary.json'
  const looks = new Map<string, number>()
  world(on, { files: folder({ [G]: '{"known": ["ZQA"]}' }), mtimes: { [G]: 1 }, looks })
  await $.session.start(START)
  await voice($, 'on for a nurse')
  expect(looks.get(G)).toBe(1)
})

test('a glossary gone just as the Read tool reads it is filed as nothing there, by a second look, not by the tool\'s words', async ($, on) => {
  const logs: string[] = []
  const G = '/w/.jargone/glossary.json'
  const text = '{"known": ["ZQA"]}'
  const w: World = { files: folder({ [G]: text }), logs, mtimes: { [G]: 1 }, goneOnRead: G }
  world(on, w)
  await $.session.start(START)
  await voice($, 'on for a nurse')
  // back unchanged (same time and size): it is read, not taken for the failed read under the same stamp
  w.files[G] = text
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'We set up ZQA today.' })
  expect(logs).toEqual(['jargone: nothing to flag'])
})

test('/jargone-check writes nothing through a report that is a link, so the file it points at is safe', async ($, on) => {
  const writes: Files = {}
  const w: World = { files: folder(), writes, links: { '/w/.jargone/reports/widget/README.md.check.md': '/w/widget/README.md' } }
  world(on, w)
  await $.session.start(START)
  const r = await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(r.text).toContain('.jargone/reports/widget/README.md.check.md is a link, not a file of its own, so nothing was written through it.')
  expect(writes).toEqual({})
  expect(w.files['/w/widget/README.md']).toBe(README)
})

test('a saved original that is a link (to the document itself, say) is not followed, and J05 says it did not run', async ($, on) => {
  world(on, { files: folder(), links: { '/w/.jargone/originals/widget/README.md': '/w/widget/README.md' } })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect(r.notes.join(' ')).toContain('The saved original could not be read, so J05 (nothing lost) did not run: /w/.jargone/originals/widget/README.md is a link, not a file of its own.')
})

test('a reference file swapped for a link as it is read is reported as a link', async ($, on) => {
  world(on, {
    files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/.jargone/moves/widget/README.md.json': '{"moves": [{"to": "widget/README-reference.md"}]}', '/w/widget/README-reference.md': 'It holds 42 jobs.' }),
    linkOnRead: ['/w/widget/README-reference.md', '/w/gone.md'],
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect(r.notes.join(' ')).toContain('The moved-to file widget/README-reference.md is a link, not a file of its own')
})

test('a look a hook above answers with no value counts as nothing there, not as a crash', async ($, on) => {
  world(on, { files: folder({ '/w/.jargone/glossary.json': '{"known": ["kubelet"]}' }), nullStat: ['/w/.jargone/glossary.json'] })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('widget/README.md'))
  expect(said(r)).not.toContain('crashed')
  expect(codes(r)).toContain('J01 kubelet')
})

test('a moves file that is a link is not followed either', async ($, on) => {
  world(on, {
    files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/elsewhere.json': '{"moves": [{"to": "widget/README-reference.md"}]}', '/w/widget/README-reference.md': 'It holds 42 jobs.' }),
    links: { '/w/.jargone/moves/widget/README.md.json': '/w/elsewhere.json' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect(r.notes.join(' ')).toContain('The moves file could not be read, so no moved-to file was read: /w/.jargone/moves/widget/README.md.json is a link, not a file of its own.')
})

test('/jargone-check fails closed: when the report path cannot be looked at but something is there, nothing is written', async ($, on) => {
  const writes: Files = {}
  const report = '/w/.jargone/reports/widget/README.md.check.md'
  const w: World = { files: folder(), writes, links: { [report]: '/w/widget/README.md' }, nullStat: [report] }
  world(on, w)
  await $.session.start(START)
  const r = await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(r.text).toContain('.jargone/reports/widget/README.md.check.md is there but could not be looked at, and it is a link, so it was not replaced.')
  expect(writes).toEqual({})
  expect(w.files['/w/widget/README.md']).toBe(README)
})

test('/jargone-check replaces only a report it wrote: a file there that is not one (a hard link to the document, say) is left alone', async ($, on) => {
  const writes: Files = {}
  const w: World = { files: folder({ '/w/.jargone/reports/widget/README.md.check.md': README }), writes }
  world(on, w)
  await $.session.start(START)
  const r = await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(r.text).toContain('.jargone/reports/widget/README.md.check.md does not read as the jargone check report for widget/README.md, so it was not replaced.')
  expect(writes).toEqual({})
})

test('/jargone-check writes nothing through a report path that is a link loop, or whose look comes back without its link flag', async ($, on) => {
  const writes: Files = {}
  const report = '/w/.jargone/reports/widget/README.md.check.md'
  const w: World = { files: folder(), writes, links: { [report]: report } }
  world(on, w)
  await $.session.start(START)
  expect((await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })).text).toContain('is there but could not be looked at, and it is a link, so it was not replaced.')
  // now a link to the document, whose look a hook above sends without isLink
  w.links![report] = '/w/widget/README.md'
  w.noIsLink = [report]
  expect((await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })).text).toContain('is there but could not be looked at, and it is a link, so it was not replaced.')
  expect(writes).toEqual({})
  expect(w.files['/w/widget/README.md']).toBe(README)
})

test('/jargone-check does not replace the report of another document found at its report path', async ($, on) => {
  const writes: Files = {}
  world(on, { files: folder({ '/w/.jargone/reports/widget/README.md.check.md': '# jargone check: other.md\n\nits findings' }), writes })
  await $.session.start(START)
  const r = await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(r.text).toContain('does not read as the jargone check report for widget/README.md, so it was not replaced.')
  expect(writes).toEqual({})
})

test('a listing a hook above answers with no value does not crash /jargone-check', async ($, on) => {
  const writes: Files = {}
  const report = '/w/.jargone/reports/widget/README.md.check.md'
  world(on, { files: folder(), writes, nullStat: [report], badList: ['/w/.jargone/reports/widget'] })
  await $.session.start(START)
  const r = await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(r.text).not.toContain('crashed')
  expect(Object.keys(writes)).toEqual([report])
})

test('a look without its time and size counts as failed, so the reply glossary is not kept under a stamp that never changes', async ($, on) => {
  const logs: string[] = []
  const G = '/w/.jargone/glossary.json'
  world(on, { files: folder({ [G]: '{"known": ["ZQA"]}' }), logs, noTimes: [G] })
  await $.session.start(START)
  await voice($, 'on for a nurse')
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'We set up ZQA today.' })
  expect(logs).toEqual(['jargone: 1 undefined term'])
})

test('a malformed listing during the link search does not crash the check', async ($, on) => {
  world(on, { files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL }), badList: ['/w'] })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('widget/README.md'))
  expect(said(r)).not.toContain('crashed')
  expect(json(r).notes.join(' ')).toContain('1 folder could not be listed, so Markdown files in it were not searched for links to this file: the working folder itself.')
})

test('the fail-closed write compares exact names: a sibling named in another case does not block it', async ($, on) => {
  const writes: Files = {}
  const report = '/w/.jargone/reports/widget/README.md.check.md'
  world(on, { files: folder({ '/w/.jargone/reports/widget/README.md.CHECK.md': 'theirs' }), writes, nullStat: [report] })
  await $.session.start(START)
  await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(Object.keys(writes)).toEqual([report])
})

test('/jargone-check replaces a report only when its first line is exactly the heading, a BOM or CRLF line ends aside', async ($, on) => {
  const writes: Files = {}
  const report = '/w/.jargone/reports/widget/README.md.check.md'
  const w: World = { files: folder({ [report]: '# jargone check: widget/README.md (old copy)\n\nx' }), writes }
  world(on, w)
  await $.session.start(START)
  expect((await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })).text).toContain('does not read as the jargone check report for widget/README.md')
  expect(writes).toEqual({})
  w.files[report] = '\uFEFF# jargone check: widget/README.md\r\n\r\nold'
  await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(Object.keys(writes)).toEqual([report])
  // CR alone ends a line too
  delete writes[report]
  w.files[report] = '# jargone check: widget/README.md\r\rold'
  await $.command.run({ command: 'jargone-check', args: 'widget/README.md', ...RUN })
  expect(Object.keys(writes)).toEqual([report])
})

for (const field of ['kind', 'isLink', 'mtimeMs', 'size']) {
  test(`a look without its ${field} counts as failed: the reply glossary is not used under a stamp that could stand still`, async ($, on) => {
    const logs: string[] = []
    const G = '/w/.jargone/glossary.json'
    world(on, { files: folder({ [G]: '{"known": ["ZQA"]}' }), logs, dropField: [G, field] })
    await $.session.start(START)
    await voice($, 'on for a nurse')
    await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'We set up ZQA today.' })
    expect(logs).toEqual(['jargone: 1 undefined term'])
  })
}

test('a listing with entries that are not entries (no name, "..", "", or a slash) does not crash the check or lead it out of the folder', async ($, on) => {
  const reads: string[] = []
  world(on, { files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/docs/guide.md': 'See [setup](../widget/README.md#setup).' }), junkEntries: ['/w'], reads })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('widget/README.md'))
  expect(said(r)).not.toContain('crashed')
  expect(reads.filter(p => !p.startsWith('/w/'))).toEqual([])
  const notes = json(r).notes.join(' ')
  // "" and "." would have the folder listed again and again; the left-out names are said
  expect(notes).not.toContain('more than')
  expect(notes).toContain('8 entries in the working folder could not be searched for links to this file (a link leading outside the working folder, into a folder the search skips, or somewhere that could not be had; an entry of unknown kind; or a name that cannot be part of a path: none, empty, ".", ".." or holding a slash): an entry with no name in the working folder, an entry with no name in the working folder, an entry with no name in the working folder, .., "", …')
  // the real entries are still searched
  expect((json(r).findings as F[]).some(f => f.message.includes('The link from docs/guide.md'))).toBe(true)
})

test('a folder that cannot be listed is named in the notes, and the check goes on', async ($, on) => {
  world(on, { files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/docs/guide.md': 'x' }), failList: ['/w/docs'] })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('widget/README.md'))
  expect(said(r)).not.toContain('crashed')
  expect(json(r).notes.join(' ')).toContain('1 folder could not be listed, so Markdown files in it were not searched for links to this file: docs.')
})

test('a folder named "C:" stays inside the working folder: its document\'s reference file is found there', async ($, on) => {
  const reads: string[] = []
  world(on, {
    reads,
    files: {
      '/plugin/prompt.md': PROMPT,
      '/w/C:/x.md': README,
      '/w/C:/x-reference.md': 'It holds 42 jobs.',
      '/w/.jargone/originals/C:/x.md': ORIGINAL,
      // written as the method writes paths: from the working folder, no leading ./
      '/w/.jargone/moves/C:/x.md.json': '{"moves": [{"to": "C:/x-reference.md"}]}',
    },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('C:/x.md')))
  expect((r.findings as F[]).some(f => f.code === 'J05' && f.message.includes('The number 42'))).toBe(false)
  expect(reads).toContain('/w/C:/x-reference.md')
  expect(reads.filter(p => !p.startsWith('/w/'))).toEqual([])
})
test('a link is not a page: one to a folder or Markdown file outside the working folder is named, others are ignored', async ($, on) => {
  const reads: string[] = []
  world(on, {
    reads,
    files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/elsewhere/guide.md': 'See [setup](../widget/README.md#setup).', '/elsewhere/more/x.md': 'x', '/elsewhere/rc': 'x' }),
    // a linked folder named like Markdown is a folder; a link to a file of another kind cannot hold links
    links: { '/w/docs/guide.md': '/elsewhere/guide.md', '/w/docs/more': '/elsewhere/more', '/w/docs/api.md': '/elsewhere/more', '/w/.prettierrc': '/elsewhere/rc', '/w/node_modules': '/elsewhere/more', '/w/docs/gone.md': '/w/nothing.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  const notes = r.notes.join(' ')
  expect(notes).toContain('3 entries in the working folder could not be searched for links to this file')
  expect(notes).toContain(': docs/api.md, docs/guide.md, docs/more.')
  expect(reads.filter(p => !p.startsWith('/w/'))).toEqual([])
  expect(reads).not.toContain('/w/docs/guide.md')
  expect(notes).not.toContain('could not be read')
  expect(notes).not.toContain('.prettierrc')
  // a folder the search skips by name is skipped as a link too; a link to nothing says nothing
  expect(notes).not.toContain('node_modules')
  expect(notes).not.toContain('gone.md')
})
test('a linked file that is the document itself is not read as another file, so its links are not counted twice', async ($, on) => {
  const original = '# Widget\n\nWidget keeps your notes in one place.\n\nSee [s](README.md#setup).\n\n## Setup\n\nIt holds 42 jobs.'
  const rewrite = '# Widget\n\nWidget keeps your notes in one place.\n\nSee [s](README.md#setup).\n\n## Getting started\n\nIt holds 42 jobs.'
  world(on, {
    files: { '/plugin/prompt.md': PROMPT, '/w/widget/README.md': rewrite, '/w/.jargone/originals/widget/README.md': original },
    links: { '/w/widget/alias.md': '/w/widget/README.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  const from = (r.findings as F[]).filter(f => f.message.startsWith('The link from'))
  expect(from.map(f => f.message.slice(0, 40))).toEqual(['The link from widget/README.md to "#setu'])
})
test('the replies keep each finding, the file\'s name and the report\'s path on one line', async ($, on) => {
  world(on, { files: folder({ '/w/a\nb.md': README }), writeError: 'denied' })
  await $.session.start(START)
  const r = await $.command.run({ command: 'jargone-check', args: 'a\nb.md', ...RUN })
  const lines = r.text!.split('\n')
  expect(lines[0]).toContain('jargone-check a b.md: ')
  expect(lines.slice(1).every(l => l.startsWith('  Line '))).toBe(true)
  // a failure, on one line
  expect((await $.command.run({ command: 'jargone-check', args: 'a\nmissing.md', ...RUN })).text).toBe('jargone-check: /w/a missing.md does not exist.')
})

test('the success reply keeps the report\'s path on one line', async ($, on) => {
  world(on, { files: folder({ '/w/a\nb.md': README }) })
  await $.session.start(START)
  const r = await $.command.run({ command: 'jargone-check', args: 'a\nb.md', ...RUN })
  expect(r.text!.split('\n').length).toBe(1)
  expect(r.text).toContain('Findings: .jargone/reports/a b.md.check.md')
})

test('a document that is itself a link: the file it leads to is not read as another file', async ($, on) => {
  const original = '# Widget\n\nWidget keeps your notes in one place.\n\nSee [s](/README.md#setup).\n\n## Setup\n\nIt holds 42 jobs.'
  const rewrite = '# Widget\n\nWidget keeps your notes in one place.\n\nSee [s](/README.md#setup).\n\n## Getting started\n\nIt holds 42 jobs.'
  world(on, {
    files: { '/plugin/prompt.md': PROMPT, '/w/docs/README.md': rewrite, '/w/.jargone/originals/README.md': original },
    links: { '/w/README.md': '/w/docs/README.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('README.md')))
  // read once, from the page GitHub shows (the file the link leads to), reported under the name checked
  const from = (r.findings as F[]).filter(f => f.message.startsWith('The link from')).map(f => f.message.slice(0, 26))
  expect(from).toEqual(['The link from README.md to'])
})

test('when the document is a link, a link to the file it leads to is a link to the document', async ($, on) => {
  const original = '# Widget\n\nWidget keeps your notes in one place.\n\n## Setup\n\nIt holds 42 jobs.'
  const rewrite = '# Widget\n\nWidget keeps your notes in one place.\n\n## Getting started\n\nIt holds 42 jobs.'
  world(on, {
    files: { '/plugin/prompt.md': PROMPT, '/w/docs/README.md': rewrite, '/w/.jargone/originals/README.md': original, '/w/guide.md': 'See [s](docs/README.md#setup).' },
    links: { '/w/README.md': '/w/docs/README.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('README.md')))
  expect((r.findings as F[]).some(f => f.message.startsWith('The link from guide.md to "#setup"'))).toBe(true)
})

test('a link to another Markdown file in the folder is read once, so one broken link is reported once', async ($, on) => {
  world(on, {
    files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/docs/guide.md': 'See [setup](/widget/README.md#setup).' }),
    links: { '/w/guide.md': '/w/docs/guide.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect((r.findings as F[]).filter(f => f.message.startsWith('The link from')).length).toBe(1)
})

test('a linked folder that leads back inside the working folder is searched there, and not named as left out', async ($, on) => {
  world(on, {
    files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/packages/x/guide.md': 'x' }),
    links: { '/w/pkg': '/w/packages/x' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('widget/README.md')))
  expect(r.notes.join(' ')).not.toContain('could not be searched')
})

test('a link counts as leading to a Markdown file by the name of what it leads to', async ($, on) => {
  world(on, {
    files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/elsewhere/guide.md': 'x', '/elsewhere/x.txt': 'x' }),
    links: { '/w/notes': '/elsewhere/guide.md', '/w/x.md': '/elsewhere/x.txt' },
  })
  await $.session.start(START)
  const notes = json(await $.tool.call(checkTool('widget/README.md'))).notes.join(' ')
  expect(notes).toContain('1 entry in the working folder could not be searched for links to this file')
  expect(notes).toContain(': notes.')
})

test('a working folder named "C:" on Linux or macOS is an ordinary name, so it is the project\'s name', () => {
  expect(projectNameOf('/srv/C:', 'notes.md')).toEqual({ name: 'C:', from: 'the working folder' })
})

test('the reply to /jargone-voice on and the note after a reply stay on one line, whatever a refusal says', async ($, on) => {
  const logs: string[] = []
  world(on, { files: folder({ '/w/.jargone/glossary.json': '{}' }), logs, readFails: { 'glossary.json': 'Blocked.\nAsk your admin.' } })
  await $.session.start(START)
  const r = await voice($, 'on for a nurse')
  expect(r.text!.split('\n').length).toBe(1)
  await $.classic.Stop({ stop_hook_active: false, last_assistant_message: 'Done.' })
  expect(logs[0]!.split('\n').length).toBe(1)
})

const SETUP_ORIGINAL = '# Widget\n\nWidget keeps your notes in one place.\n\n## Setup\n\nIt holds 42 jobs.'
const SETUP_REWRITE = '# Widget\n\nWidget keeps your notes in one place.\n\n## Getting started\n\nIt holds 42 jobs.'

test('a link written to an alias of the document (a linked file, or a linked folder) is a link to the document', async ($, on) => {
  world(on, {
    files: {
      '/plugin/prompt.md': PROMPT,
      '/w/packages/x/README.md': SETUP_REWRITE,
      '/w/.jargone/originals/packages/x/README.md': SETUP_ORIGINAL,
      '/w/CONTRIBUTING.md': 'See [setup](README.md#setup).',
      '/w/guide.md': 'See [setup](pkg/README.md#setup).',
    },
    links: { '/w/README.md': '/w/packages/x/README.md', '/w/pkg': '/w/packages/x' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('packages/x/README.md')))
  const from = (r.findings as F[]).filter(f => f.message.startsWith('The link from')).map(f => f.message.split(' to ')[0])
  expect(from.sort()).toEqual(['The link from CONTRIBUTING.md', 'The link from guide.md'])
})

test('a link into a folder the search skips (node_modules, say) is named, since nothing searches it', async ($, on) => {
  world(on, {
    files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/node_modules/@org/docs/guide.md': 'x' }),
    links: { '/w/docs': '/w/node_modules/@org/docs' },
  })
  await $.session.start(START)
  const notes = json(await $.tool.call(checkTool('widget/README.md'))).notes.join(' ')
  expect(notes).toContain('could not be searched for links to this file')
  expect(notes).toContain(': docs.')
})

test('the document\'s own entry, when it is a link leading outside, is not named as unsearched', async ($, on) => {
  world(on, {
    files: { '/plugin/prompt.md': PROMPT, '/elsewhere/README.md': SETUP_REWRITE, '/w/.jargone/originals/README.md': SETUP_ORIGINAL },
    links: { '/w/README.md': '/elsewhere/README.md' },
  })
  await $.session.start(START)
  const notes = json(await $.tool.call(checkTool('README.md'))).notes.join(' ')
  expect(notes).not.toContain('could not be searched')
})

test('a working folder whose name holds a backslash, on Linux or macOS, keeps its files inside it', async ($, on) => {
  world(on, { files: { '/plugin/prompt.md': PROMPT, '/srv/a\\b/README.md': README }, cwd: '/srv/a\\b' })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('README.md'))
  expect(said(r)).not.toContain('not inside the working folder')
  expect(json(r).file).toBe('README.md')
})

test('a folder link counts when the README GitHub opens in that folder is an alias of the document', async ($, on) => {
  world(on, {
    files: { '/plugin/prompt.md': PROMPT, '/w/docs/guide.md': SETUP_REWRITE, '/w/.jargone/originals/docs/guide.md': SETUP_ORIGINAL, '/w/CONTRIBUTING.md': 'See [s](docs/#setup).' },
    links: { '/w/docs/README.md': '/w/docs/guide.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('docs/guide.md')))
  expect((r.findings as F[]).some(f => f.message.startsWith('The link from CONTRIBUTING.md to "#setup"'))).toBe(true)
})

test('another name for the document leading outside is not named as unsearched, and links written to it count', async ($, on) => {
  world(on, {
    files: { '/plugin/prompt.md': PROMPT, '/shared/index.md': SETUP_REWRITE, '/w/.jargone/originals/README.md': SETUP_ORIGINAL, '/w/guide.md': 'See [s](docs/README.md#setup).' },
    links: { '/w/README.md': '/shared/index.md', '/w/docs/README.md': '/shared/index.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('README.md')))
  expect(r.notes.join(' ')).not.toContain('could not be searched')
  expect((r.findings as F[]).some(f => f.message.startsWith('The link from guide.md to "#setup"'))).toBe(true)
})

test('a link through a workspace link in node_modules to the document counts, though node_modules is never listed', async ($, on) => {
  world(on, {
    files: { '/plugin/prompt.md': PROMPT, '/w/packages/widget/README.md': SETUP_REWRITE, '/w/.jargone/originals/packages/widget/README.md': SETUP_ORIGINAL, '/w/docs/usage.md': 'See [s](../node_modules/@org/widget/README.md#setup).' },
    links: { '/w/node_modules/@org/widget': '/w/packages/widget' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('packages/widget/README.md')))
  expect((r.findings as F[]).some(f => f.message.startsWith('The link from docs/usage.md to "#setup"'))).toBe(true)
})

test('a working folder spelled with a leading "//" on Linux or macOS is still read by POSIX rules', async ($, on) => {
  world(on, { files: folder(), cwd: '//w' })
  await $.session.start(START)
  const r = await $.tool.call(checkTool('/w/widget/README.md'))
  expect(said(r)).not.toContain('not inside the working folder')
  expect(json(r).file).toBe('widget/README.md')
})

test('when the working folder is itself a link (real places under another prefix), aliases and inside links still resolve', async ($, on) => {
  world(on, {
    files: {
      '/plugin/prompt.md': PROMPT,
      '/w/packages/x/README.md': SETUP_REWRITE,
      '/w/.jargone/originals/packages/x/README.md': SETUP_ORIGINAL,
      '/w/CONTRIBUTING.md': 'See [setup](README.md#setup).',
    },
    links: { '/w/README.md': '/w/packages/x/README.md', '/w/pkg': '/w/packages/x' },
    realRoot: ['/w', '/private/w'],
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('packages/x/README.md')))
  expect((r.findings as F[]).some(f => f.message.startsWith('The link from CONTRIBUTING.md to "#setup"'))).toBe(true)
  // pkg leads back inside the working folder (by real places), so it is not named
  expect(r.notes.join(' ')).not.toContain('could not be searched')
})

test('when the document is a link, its own relative links are read from the file it leads to, as GitHub shows that file', async ($, on) => {
  const original = '# Widget\n\nWidget keeps your notes in one place.\n\nSee [s](../README.md#setup).\n\n## Setup\n\nIt holds 42 jobs.'
  const rewrite = '# Widget\n\nWidget keeps your notes in one place.\n\nSee [s](../README.md#setup).\n\n## Getting started\n\nIt holds 42 jobs.'
  world(on, {
    files: { '/plugin/prompt.md': PROMPT, '/w/docs/README.md': rewrite, '/w/.jargone/originals/README.md': original },
    links: { '/w/README.md': '/w/docs/README.md' },
  })
  await $.session.start(START)
  const r = json(await $.tool.call(checkTool('README.md')))
  expect((r.findings as F[]).some(f => f.message.startsWith('The link from README.md to "#setup"'))).toBe(true)
})

test('a link that leads to the working folder itself is inside it, so it is not named as unsearched', async ($, on) => {
  world(on, { files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL }), links: { '/w/docs/repo': '/w' } })
  await $.session.start(START)
  const notes = json(await $.tool.call(checkTool('widget/README.md'))).notes.join(' ')
  expect(notes).not.toContain('could not be searched')
})

test('a link to a file target asks for no README inside it: one look per target', async ($, on) => {
  const looks = new Map<string, number>()
  world(on, { files: folder({ '/w/.jargone/originals/widget/README.md': ORIGINAL, '/w/a.md': 'See [x](b.md#y). And [z](b.md#q).', '/w/b.md': 'x' }), looks })
  await $.session.start(START)
  await $.tool.call(checkTool('widget/README.md'))
  expect(looks.get('/w/b.md/README.md')).toBe(undefined)
  // one look to read b.md as a file of the search, one (kept) to judge both links to it
  expect(looks.get('/w/b.md')).toBe(2)
})

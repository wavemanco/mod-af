import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { EXAMPLE_FILES, EXAMPLE_MODEL } from '../hooks/example.ts'
import { render, sealState } from '../hooks/render.ts'
import { check, MAX_SOURCE_BYTES } from '../hooks/spec.ts'
import { argPath, requestOf, section, utf8Bytes } from '../hooks/register.ts'

// The engine stand-ins. The plugin reads every file through the Read tool and writes the page through
// the Write tool, so the world serves those two tools (with paging and size caps like the real Read),
// answers permission questions from per-path lists, and stands in for the file system, symbolic links
// and the session's folder. prompt.md has the same markers as the real one (the test kit imports code
// files only, so it cannot read the real prompt.md).
const PROMPT = [
  'intro',
  '<!-- method:start -->',
  '# Build a stock-and-flow model of a system, grounded in its sources',
  'the method body',
  '<!-- method:end -->',
  '<!-- lenses:start -->',
  '## Review lens briefs',
  '<!-- lens:facts-reviewer:start -->',
  'facts lens brief',
  '<!-- lens:facts-reviewer:end -->',
  '<!-- lens:sd-reviewer:start -->',
  'sd lens brief',
  '<!-- lens:sd-reviewer:end -->',
  '<!-- lens:reader-reviewer:start -->',
  'reader lens brief',
  '<!-- lens:reader-reviewer:end -->',
  '<!-- lenses:end -->',
].join('\n')

/** The real Read tool's cap per call, in tokens; at two characters a token (as it counted a page), in characters. */
const TOKEN_CAP = 25_000
const CHAR_CAP = 50_000

type Files = Record<string, string>
type World = {
  files: Files
  /** path → where it points; a link to a folder covers everything under it */
  links?: Record<string, string>
  /** Read and Write verdicts, by path suffix. A Read deny rule is answered as the real engine answers it: the
   *  Read tool's call errs in its own words, and only a verdict query says deny */
  denyRead?: string[]
  askRead?: string[]
  denyWrite?: string[]
  askWrite?: string[]
  /** path suffix → the Read tool's error text */
  readFails?: Record<string, string>
  /** path suffixes whose Read verdict query fails */
  verdictFails?: string[]
  /** Tools the session does not have (the person's settings deny them outright): calls and queries reject. */
  noTool?: string[]
  /** path suffix → a PreToolUse hook's refusal of Read (a secrets guard), in its own words */
  guardRead?: Record<string, string>
  /** a PreToolUse hook that refuses only the nth Read call of a file: [path suffix, n, its words] */
  guardReadAt?: [string, number, string]
  /** the most lines one Read call may return before the tool refuses the call as too large */
  pageCap?: number
  /** the Read tool's token cap per call (default TOKEN_CAP), as CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS sets it */
  tokenCap?: number
  /** the most characters one Read call may return (default two a token): the tool's token cap, as characters */
  charCap?: number
  /** the most bytes one Read call may select from a file larger than that (the real one: the token cap × 128) */
  byteCap?: number
  /** the Read tool's refusal of a page over its cap, if not in its usual words (which give the token counts) */
  capWords?: string
  /** path suffixes the Read tool reads whole, whatever offset and limit say (as it does a notebook) */
  noPaging?: string[]
  /** path suffix → what the Read tool returns instead of text ('notebook', 'pdf', 'image') */
  readTypes?: Record<string, string>
  /** the engine's verdict on the plugin's own tools */
  toolVerdict?: { decision: 'allow' | 'ask' | 'deny'; rule?: string; reason?: string }
  /** a PostToolUse-style rewrite of whatever the Write tool writes */
  rewriteOnWrite?: (text: string) => string
  writeError?: string
  devices?: string[]
  agentsFail?: boolean
  cwd?: { value: string }
  writes?: Files
  reads?: string[]
  /** every Read call: the page asked for, and whether the tool refused it as too large (and for its bytes) */
  pages?: { path: string; offset: number; limit: number; refused: boolean; bytes?: boolean }[]
  /** path suffix → a file that grows as it is read: each call returns one line and one more is always there */
  endless?: string
}

function world(on: On, w: World) {
  const links = w.links ?? {}
  const cwd = w.cwd ?? { value: '/w' }
  const resolve = (p: string): string => {
    for (const k of Object.keys(links).sort((a, b) => b.length - a.length)) if (p === k || p.startsWith(`${k}/`)) return links[k] + p.slice(k.length)
    return p
  }
  const isDir = (p: string) => Object.keys(w.files).some(f => f.startsWith(`${p.replace(/\/$/, '')}/`))
  // a file's lines, split once per text (a large file is read in many calls)
  const split = new Map<string, { text: string; lines: string[]; bytes: number }>()
  const parsed = (p: string, t: string) => {
    const c = split.get(p)
    if (c && c.text === t) return c
    const d = { text: t, lines: t.split('\n'), bytes: utf8Bytes(t) }
    split.set(p, d)
    return d
  }
  const cap = w.tokenCap ?? TOKEN_CAP
  const tokensOf = (text: string, lineCount: number) => Math.max(w.pageCap ? Math.ceil(cap * lineCount / w.pageCap) : 0, Math.ceil(cap * text.length / (w.charCap ?? 2 * cap)))
  const overCap = (tokens: number) => ({ result: [], isError: true, text: `<tool_use_error>${w.capWords ?? `File content (${tokens} tokens) exceeds maximum allowed tokens (${cap}). Use offset and limit parameters to read specific portions of the file, or search for specific content instead of reading the whole file.`}</tool_use_error>` }) as never
  const ends = (list: string[] | undefined, p: string) => (list ?? []).some(d => p.endsWith(d))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__stockflow__${e.name}` } }))
  on('agent.register', (_, e) => { if (w.agentsFail) throw new Error('refused'); return { value: { agent: `stockflow:${e.name}` } } })
  // the plugin reads only prompt.md with $.fs.read; everything else goes through the Read tool
  on('fs.read', (_, e) => {
    if (e.path.endsWith('/prompt.md') && '/plugin/prompt.md' in w.files) return { value: w.files['/plugin/prompt.md'] }
    throw new Error(`ENOENT ${e.path}`)
  })
  on('fs.exists', (_, e) => ({ value: resolve(e.path) in w.files }))
  on('fs.stat', (_, e) => {
    const r = resolve(e.path)
    const device = (w.devices ?? []).includes(r)
    if (!(r in w.files) && !isDir(r) && !device) throw new Error(`ENOENT ${e.path}`)
    const kind = device ? 'other' as const : r in w.files ? 'file' as const : 'dir' as const
    return { value: { kind, size: utf8Bytes(w.files[r] ?? ''), mtimeMs: 0, isLink: e.path in links, ...(e.resolve ? { realPath: r } : {}) } }
  })
  on('fs.list', (_, e) => {
    const dir = e.path.replace(/\/$/, '')
    const names = new Set<string>()
    for (const p of [...Object.keys(w.files), ...Object.keys(links)]) if (p.startsWith(`${dir}/`)) names.add(p.slice(dir.length + 1).split('/')[0])
    return { value: [...names].map(name => ({ name, kind: 'file' as const, size: 0, mtimeMs: 0, isLink: `${dir}/${name}` in links })) }
  })
  on('session.cwd', () => ({ value: cwd.value }))
  on('tool.list', () => ({ value: ['Read', 'Write', 'Bash', 'mcp__stockflow__check', 'mcp__stockflow__render'].filter(t => !w.noTool?.includes(t)).map(name => ({ name, description: name, mcp: name.startsWith('mcp__') })) }))
  on('tool.check', (_, e) => {
    if (w.noTool?.includes(e.tool)) throw new Error(`no tool named "${e.tool}" in this session`)
    if (e.tool === 'mcp__stockflow__check' || e.tool === 'mcp__stockflow__render') return w.toolVerdict ?? { decision: 'allow' }
    const p = String((e.input as { file_path?: string }).file_path ?? '')
    // like Read, the real Write tool refuses a path its deny rules cover with its own error (below); only a
    // query gets the deny
    if (e.tool === 'Write' && ends(w.denyWrite, p)) return { decision: e.tool_use_id === undefined ? 'deny' : 'allow', rule: `Edit(${p})` }
    if (e.tool === 'Write') return { decision: ends(w.askWrite, p) ? 'ask' : 'allow' }
    // the real Read tool refuses a path its deny rules cover in its own input check, before the permission
    // check, so a call reaches the tool (below); only a query ($.tool.check, with no tool_use_id) gets the deny
    if (e.tool === 'Read' && e.tool_use_id === undefined && ends(w.verdictFails, p)) throw new Error('no verdict')
    if (e.tool === 'Read' && ends(w.denyRead, p)) return { decision: e.tool_use_id === undefined ? 'deny' : 'allow', rule: `Read(${p})` }
    if (e.tool === 'Read') return { decision: ends(w.askRead, p) ? 'ask' : 'allow' }
    return { decision: 'allow' }
  })
  const readsOf = new Map<string, number>()
  on('classic.PreToolUse', (_, e) => {
    if (e.tool !== 'Read') return {}
    const p = String((e as { file_path?: unknown }).file_path ?? '')
    const n = (readsOf.get(p) ?? 0) + 1
    readsOf.set(p, n)
    const at = w.guardReadAt
    const why = Object.entries(w.guardRead ?? {}).find(([d]) => p.endsWith(d))?.[1] ?? (at && p.endsWith(at[0]) && n === at[1] ? at[2] : undefined)
    return why ? { deny: why } : {}
  })
  // the engine's Read tool, beneath its permission check. Like the real one it returns whole lines, and
  // refuses a call whose page is over its token cap, here counted from the page's lines (pageCap) and
  // characters (charCap), so one long line is refused however few lines are asked for
  on('tool.call', { tool: 'Read' }, (_, e) => {
    if (w.noTool?.includes('Read')) throw new Error('no tool named "Read" in this session')
    const p = e.file_path
    w.reads?.push(p)
    if (ends(w.denyRead, p)) return { result: [], isError: true, text: '<tool_use_error>File is in a directory that is denied by your permission settings.</tool_use_error>' } as never
    const fail = Object.entries(w.readFails ?? {}).find(([d]) => p.endsWith(d))?.[1]
    if (fail) return { result: [], isError: true, text: `<tool_use_error>${fail}</tool_use_error>` } as never
    const type = Object.entries(w.readTypes ?? {}).find(([d]) => p.endsWith(d))?.[1]
    if (type) return { result: { type, file: { filePath: p } } } as never
    const t = w.files[resolve(p)]
    if (t === undefined) return { result: [], isError: true, text: 'File does not exist.' } as never
    const offset = e.offset ?? 1
    if (w.endless && p.endsWith(w.endless)) {
      w.pages?.push({ path: p, offset, limit: e.limit ?? 0, refused: false })
      return { result: { type: 'text', file: { filePath: p, content: `log line ${offset}`, numLines: 1, startLine: offset, totalLines: offset + 1 } } } as never
    }
    const d = parsed(p, t)
    // like the real one, it knows a notebook by its extension alone and reads it whole, whatever offset and
    // limit say: over 256 KB, or over the token cap, it refuses the whole notebook; else it returns cells
    if (/\.ipynb$/i.test(p)) {
      const tokens = tokensOf(t, d.lines.length)
      w.pages?.push({ path: p, offset, limit: e.limit ?? 0, refused: d.bytes > 262_144 || tokens > cap })
      if (d.bytes > 262_144) return { result: [], isError: true, text: `<tool_use_error>Notebook content (${(d.bytes / 1_048_576).toFixed(1)}MB) exceeds maximum allowed size (256KB). Use Bash with jq to read specific portions.</tool_use_error>` } as never
      if (tokens > cap) return overCap(tokens)
      return { result: { type: 'notebook', file: { filePath: p, cells: [] } } } as never
    }
    const whole = (w.noPaging ?? []).some(x => p.endsWith(x))
    const slice = whole ? d.lines : d.lines.slice(offset - 1, offset - 1 + (e.limit ?? d.lines.length))
    const content = slice.join('\n')
    // the byte cap is checked as the lines are selected, before they are counted, and only for a file larger than it
    const bytes = w.byteCap !== undefined && d.bytes > w.byteCap && utf8Bytes(content) > w.byteCap
    const tokens = tokensOf(content, slice.length)
    w.pages?.push({ path: p, offset, limit: e.limit ?? d.lines.length, refused: bytes || tokens > cap, ...(bytes ? { bytes } : {}) })
    if (bytes) return { result: [], isError: true, text: `<tool_use_error>The requested line range contains over ${Math.round(w.byteCap! / 1024)}KB of text, more than a read can return. Use a smaller limit — or, if a single line is this large, no limit will fit it: search for specific content instead.</tool_use_error>` } as never
    if (tokens > cap) return overCap(tokens)
    return { result: { type: 'text', file: { filePath: p, content, numLines: slice.length, startLine: whole ? 1 : offset, totalLines: d.lines.length } } } as never
  })
  // the engine's Write tool, beneath its permission check
  on('tool.call', { tool: 'Write' }, (_, e) => {
    if (w.noTool?.includes('Write')) throw new Error('no tool named "Write" in this session')
    if (ends(w.denyWrite, e.file_path)) return { result: [], isError: true, text: '<tool_use_error>File is in a directory that is denied by your permission settings.</tool_use_error>' } as never
    // like the real one, the Write tool also refuses a path a Read deny rule covers, while a Write query allows it
    if (ends(w.denyRead, e.file_path)) return { result: [], isError: true, text: '<tool_use_error>File is covered by a Read deny rule in your permission settings and cannot be written.</tool_use_error>' } as never
    if (w.writeError) return { result: [], isError: true, text: w.writeError } as never
    const r = resolve(e.file_path)
    const text = w.rewriteOnWrite ? w.rewriteOnWrite(e.content) : e.content
    w.files[r] = text
    if (w.writes) w.writes[r] = text
    return { result: { type: 'create', filePath: e.file_path } } as never
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

function folder(): Files {
  // absolute paths: in the test kit a relative path resolves against the plugin's folder
  const files: Files = { '/plugin/prompt.md': PROMPT, '/w/m/model.json': JSON.stringify(EXAMPLE_MODEL) }
  for (const [k, v] of Object.entries(EXAMPLE_FILES)) files[`/w/m/src/${k}`] = v
  return files
}
const START = { cwd: '/w', surface: 'terminal', isInteractive: true } as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const json = (r: { result?: unknown }) => JSON.parse(String(r.result))
const said = (r: { deny?: unknown; text?: unknown; result?: unknown }) => String(r.deny ?? r.text ?? r.result)
const checkTool = (path: string, extra: Record<string, unknown> = {}) => ({ tool: 'mcp__stockflow__check' as const, path, ...extra })
const renderTool = (path: string, extra: Record<string, unknown> = {}) => ({ tool: 'mcp__stockflow__render' as const, path, ...extra })

// ------------------------------------------------------------------------------------ helpers

test('section() reads marked text, with CRLF line ends too', () => {
  expect(section(PROMPT, 'method')).toContain('the method body')
  expect(section(PROMPT.replace(/\n/g, '\r\n'), 'method')).toContain('the method body')
  expect(section(PROMPT, 'lenses')).toContain('reader lens brief')
  expect(section('no markers here', 'method')).toBe(null)
})

test('requestOf() keeps every line, and tags inside the request', () => {
  const wrap = (req: string) => `Base directory: /p\n\nWhat to model, as typed after /stockflow:\n\n<request>\n${req}\n</request>\n\nIf you can read this paragraph, ...`
  expect(requestOf(wrap('the billing service\nQuestion: why do refunds pile up?'))).toBe('the billing service\nQuestion: why do refunds pile up?')
  expect(requestOf(wrap('model the <request> parser and its </request> handling'))).toBe('model the <request> parser and its </request> handling')
  expect(requestOf('<request>\n\n</request>')).toBe('')
})

test('argPath() drops one pair of quotes around a typed path', () => {
  expect(argPath(' "my models/model.json" ')).toBe('my models/model.json')
  expect(argPath("'m/model.json'")).toBe('m/model.json')
  expect(argPath('m/model.json')).toBe('m/model.json')
})

test('utf8Bytes() counts what lands on disk', () => {
  expect(utf8Bytes('aé€😀')).toBe(1 + 2 + 3 + 4)
})

// ------------------------------------------------------------------------- the /stockflow skill

test('/stockflow injects the request, the method, the lens briefs, the field reference and the example', async ($, on) => {
  world(on, { files: folder() })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  await $.session.start(START)
  const r = await $.skill.prompt({ skill: 'stockflow:stockflow', text: 'Base directory for this skill: /plugin/skills/stockflow\n\nWhat to model, as typed after /stockflow:\n\n<request>\nthe job runner\nQuestion: why does the queue stay long?\n</request>\n\nIf you can read this paragraph, fallback text' })
  expect(r.text).toContain('the job runner\nQuestion: why does the queue stay long?')
  expect(r.text).toContain('the method body')
  expect(r.text).toContain('facts lens brief')
  expect(r.text).toContain('reader lens brief')
  expect(r.text).toContain('`stockflow:facts-reviewer`')
  expect(r.text).toContain('# The stockflow/1 model format')
  expect(r.text).toContain('"spec": "stockflow/1"')
  expect(r.text).not.toContain('fallback text')
})

test('/stockflow still carries the lens briefs, and says so, when no review agent registered', async ($, on) => {
  world(on, { files: folder(), agentsFail: true })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  await $.session.start(START)
  const r = await $.skill.prompt({ skill: 'stockflow:stockflow', text: '<request>\nx\n</request>' })
  expect(r.text).toContain('No review agents registered')
  expect(r.text).toContain('facts lens brief')
  expect(r.text).not.toContain('`stockflow:facts-reviewer`')
})

test('/stockflow says so, and injects no method, when prompt.md is missing or lacks the lens briefs', async ($, on) => {
  const files = folder()
  world(on, { files })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  await $.session.start(START)
  files['/plugin/prompt.md'] = PROMPT.replace(/<!-- lenses:start -->[\s\S]*<!-- lenses:end -->/, '')
  const noLenses = await $.skill.prompt({ skill: 'stockflow:stockflow', text: '<request>\nx\n</request>' })
  expect(noLenses.text).toContain('installed incorrectly')
  delete files['/plugin/prompt.md']
  const missing = await $.skill.prompt({ skill: 'stockflow:stockflow', text: '<request>\nx\n</request>' })
  expect(missing.text).toContain('installed incorrectly')
  expect(missing.text).not.toContain('# The stockflow/1 model format')
})

// ------------------------------------------------------------------- reading through the Read tool

test('the check tool reports the example clean, and returns the reader view when asked', async ($, on) => {
  const reads: string[] = []
  world(on, { files: folder(), reads })
  await $.session.start(START)
  const report = json(await $.tool.call(checkTool('/w/m/model.json', { reader_view: true })))
  expect(report.ok).toBe(true)
  expect(report.counts.quotes_verified).toBe(21)
  expect(report.model_path).toBe('/w/m/model.json')
  expect(report.reader_view).toContain('Short answer:')
  expect(reads).toContain('/w/m/model.json')
  expect(reads).toContain('/w/m/src/worker.py')
})

test('a cited file the person\'s settings deny is refused in the engine\'s words (E07)', async ($, on) => {
  world(on, { files: folder(), denyRead: ['alerting.py'] })
  await $.session.start(START)
  const report = json(await $.tool.call(checkTool('/w/m/model.json')))
  expect(report.ok).toBe(false)
  expect(report.errors.every((i: { code: string }) => i.code === 'E07')).toBe(true)
})

test('a cited file the person would be asked about is refused when no one can answer (E07)', async ($, on) => {
  world(on, { files: folder(), askRead: ['alerting.py'] })
  await $.session.start(START)
  const report = json(await $.tool.call(checkTool('/w/m/model.json')))
  expect(report.errors.every((i: { code: string }) => i.code === 'E07')).toBe(true)
})

test('a file the person\'s deny rules cover is their refusal (E07) whatever kind of file it is, though the Read tool answers it with an error of its own', async ($, on) => {
  const files = folder()
  const denied = ['one.pdf', 'shot.png', 'small.ipynb', 'notes.txt']
  citing(files, denied.map(f => [f, 'MAX_WORKERS = 8', 'MAX_WORKERS = 8', 1] as [string, string, string, number]))
  const reads: string[] = []
  world(on, { files, reads, denyRead: denied })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { code: string; message: string }[]
  expect(errors.length).toBe(denied.length)
  for (const f of denied) {
    const e = errors.find(i => i.message.includes(`/w/m/src/${f})`))!
    expect(e.code).toBe('E07')
    expect(e.message).toContain('was refused: File is in a directory that is denied by your permission settings.')
    // the case is reached: the call reached the Read tool, which answered with an error, not a deny
    expect(reads).toContain(`/w/m/src/${f}`)
  }
  const all = errors.map(i => i.message).join('\n')
  for (const advice of ['pdftotext', 'nbconvert', 'images cannot be quoted', 'The Read tool also said']) expect(all).not.toContain(advice)
  // as the model file too
  expect(said(await $.tool.call(checkTool('/w/m/src/one.pdf')))).toBe('check: reading the model file /w/m/src/one.pdf was refused: File is in a directory that is denied by your permission settings.')
})

test('a cited PDF or image whose path leads nowhere is reported in the Read tool\'s words, as any missing file is', async ($, on) => {
  const files = folder()
  citing(files, ['one.PDF', 'Shot.PNG'].map(f => [f, '', 'MAX_WORKERS = 8', 1] as [string, string, string, number]))
  delete files['/w/m/src/one.PDF']
  delete files['/w/m/src/Shot.PNG']
  const missing = (near: string) => `File does not exist. Note: your current working directory is /w. Did you mean ${near}?`
  world(on, { files, readFails: { 'one.PDF': missing('one.pdf'), 'Shot.PNG': missing('shot.png') } })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { message: string }[]
  const of = (f: string) => errors.find(i => i.message.includes(`/w/m/src/${f})`))!.message
  expect(of('one.PDF')).toBe(`cannot read "one.PDF" (/w/m/src/one.PDF): ${missing('one.pdf')}`)
  expect(of('Shot.PNG')).toBe(`cannot read "Shot.PNG" (/w/m/src/Shot.PNG): ${missing('shot.png')}`)
  const all = errors.map(i => i.message).join('\n')
  for (const advice of ['pdftotext', 'images cannot be quoted']) expect(all).not.toContain(advice)
})

test('a Read error whose verdict cannot be had is left as the tool\'s', async ($, on) => {
  const files = folder()
  citing(files, [['fake.pdf', 'MAX_WORKERS = 8', 'MAX_WORKERS = 8', 1]])
  world(on, { files, readFails: { 'fake.pdf': 'File is not a valid PDF (missing %PDF- header): /w/m/src/fake.pdf' }, verdictFails: ['fake.pdf'] })
  await $.session.start(START)
  const e = (json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { code: string; message: string }[]).find(i => i.message.includes('fake.pdf'))!
  expect(e.code).toBe('E02')
  expect(e.message).toContain('The Read tool also said: File is not a valid PDF (missing %PDF- header): /w/m/src/fake.pdf.')
})

test('a file the Read tool cannot read gives its own reason (E02)', async ($, on) => {
  world(on, { files: folder(), readFails: { 'alerting.py': 'File is in a directory that is denied by your permission settings.' } })
  await $.session.start(START)
  const report = json(await $.tool.call(checkTool('/w/m/model.json')))
  expect(report.errors[0].code).toBe('E02')
  expect(report.errors[0].message).toContain('denied by your permission settings')
})

test('the model file is read the same way, and its content is never echoed', async ($, on) => {
  const files = folder()
  files['/w/m/bad.json'] = 'SECRET-TOKEN-123 is not JSON'
  world(on, { files, denyRead: ['/w/m/model.json'] })
  await $.session.start(START)
  expect(said(await $.tool.call(checkTool('/w/m/model.json')))).toContain('reading the model file /w/m/model.json was refused')
  const bad = await $.tool.call(checkTool('/w/m/bad.json'))
  expect(said(bad)).not.toContain('SECRET')
  expect(json(bad).errors[0].code).toBe('S00')
})

test('a relative path follows the session\'s current folder, not the one it started in', async ($, on) => {
  const cwd = { value: '/w' }
  world(on, { files: folder(), cwd, denyRead: ['/w/m/model.json'] })
  await $.session.start(START)
  cwd.value = '/w/m'
  expect(said(await $.tool.call(checkTool('model.json')))).toContain('/w/m/model.json')
})

test('a path that starts with "~" is refused with what to give instead, never read under the working folder', async ($, on) => {
  const reads: string[] = []
  const writes: Files = {}
  world(on, { files: folder(), reads, writes })
  await $.session.start(START)
  expect(said(await $.tool.call(checkTool('~/m/model.json')))).toContain('give the path without ~: absolute, or relative to the working folder')
  expect((await $.command.run({ command: 'stockflow-check', args: '~/m/model.json', ...RUN })).text).toContain('give the path without ~')
  expect(reads).toEqual([])
  expect(said(await $.tool.call(renderTool('/w/m/model.json', { out: '~/page.html' })))).toContain('give the path without ~: absolute, or relative to the model\'s folder')
  expect(writes).toEqual({})
})

test('a device is never opened, and an oversize file is refused', async ($, on) => {
  const m = JSON.parse(JSON.stringify(EXAMPLE_MODEL))
  m.subject.roots.dev = '/dev'
  m.nodes.find((n: { id: string }) => n.id === 'dead').evidence.push({ root: 'dev', path: 'zero', lines: '1', quote: 'zero bytes' })
  const files = folder()
  files['/w/m/model.json'] = JSON.stringify(m)
  const reads: string[] = []
  world(on, { files, devices: ['/dev/zero'], reads })
  await $.session.start(START)
  const report = json(await $.tool.call(checkTool('/w/m/model.json')))
  expect(report.errors.find((i: { code: string }) => i.code === 'E02').message).toContain('not a regular file')
  expect(reads).not.toContain('/dev/zero')
  // lines short enough to read: the size is judged once the first page has been read
  files['/w/m/model.json'] = `${'x'.repeat(99)}\n`.repeat(MAX_SOURCE_BYTES / 100 + 1)
  expect(said(await $.tool.call(checkTool('/w/m/model.json')))).toContain(`over ${MAX_SOURCE_BYTES / 1_000_000} MB`)
})

/** The example model, with one more quote on the "dead" node from each file given: [name, text, quote, line]. */
function citing(files: Files, cited: [string, string, string, number][]) {
  const m = JSON.parse(JSON.stringify(EXAMPLE_MODEL))
  for (const [name, text, quote, line] of cited) {
    files[`/w/m/src/${name}`] = text
    m.nodes.find((n: { id: string }) => n.id === 'dead').evidence.push({ path: name, lines: String(line), quote })
  }
  files['/w/m/model.json'] = JSON.stringify(m, null, 1)
}

/** The example twice over: every element copied with an "_2" id, 3.5 rows lower in the same figure. */
function doubled() {
  type El = { id: string; from?: string; to?: string; of?: string; at?: number[] }
  const m = JSON.parse(JSON.stringify(EXAMPLE_MODEL)) as { nodes: El[]; flows: El[]; links: El[]; loops: { id: string; path: string[]; goal?: string }[] }
  const ids = new Set([...m.nodes, ...m.flows, ...m.links].map(x => x.id))
  const two = (id: string) => (ids.has(id) ? `${id}_2` : id)
  const copy = (x: El): El => {
    const y = { ...x, id: `${x.id}_2` }
    for (const k of ['from', 'to', 'of'] as const) if (y[k]) y[k] = two(y[k]!)
    if (x.at) y.at = [x.at[0], x.at[1] + 3.5]
    return y
  }
  m.nodes.push(...m.nodes.map(copy))
  m.flows.push(...m.flows.map(copy))
  m.links.push(...m.links.map(copy))
  const count = { R: m.loops.filter(l => l.id[0] === 'R').length, B: m.loops.filter(l => l.id[0] === 'B').length }
  m.loops.push(...m.loops.map(l => {
    const kind = l.id[0] as 'R' | 'B'
    return { ...l, id: `${kind}${++count[kind]}`, path: l.path.map(two), ...(l.goal ? { goal: two(l.goal) } : {}) }
  }))
  return m
}

test('a refusal says who refused, in their own words (E07)', async ($, on) => {
  world(on, { files: folder(), guardRead: { 'alerting.py': 'secrets-guard: alerting.py holds the pager key' } })
  await $.session.start(START)
  const report = json(await $.tool.call(checkTool('/w/m/model.json')))
  expect(report.errors.length).toBeGreaterThan(0)
  for (const i of report.errors) {
    expect(i.code).toBe('E07')
    expect(i.message).toContain('secrets-guard: alerting.py holds the pager key')
  }
})

test('a refusal never reveals the size of the file refused', async ($, on) => {
  const files = folder()
  const big = `${'x'.repeat(99)}\n`.repeat(MAX_SOURCE_BYTES / 100 + 1)
  files['/w/m/big.json'] = big
  files['/w/m/src/alerting.py'] = `${EXAMPLE_FILES['alerting.py']}\n${big}`
  world(on, { files, denyRead: ['big.json'], guardRead: { 'alerting.py': 'secrets-guard: no' } })
  await $.session.start(START)
  const model = said(await $.tool.call(checkTool('/w/m/big.json')))
  expect(model).toContain('reading the model file /w/m/big.json was refused')
  expect(model).not.toContain('MB')
  const source = JSON.stringify(json(await $.tool.call(checkTool('/w/m/model.json'))).errors)
  expect(source).toContain('secrets-guard: no')
  expect(source).not.toContain('MB')
})

type Pages = NonNullable<World['pages']>
/** The Read calls made on one file: how many, how many the tool refused as too large, and the lines each asked for. */
const callsOn = (pages: Pages, f: string) => {
  const mine = pages.filter(x => x.path.endsWith(f))
  const refusedAt = mine.flatMap((x, i) => (x.refused ? [i] : []))
  return { calls: mine.length, refused: refusedAt.length, refusedAt, limits: mine.map(x => x.limit) }
}
/** After a refusal of R lines at offset o, every later page that starts before o + R asks for fewer than R lines. */
const keepsBelowRefused = (pages: Pages, f: string, total: number) => {
  const mine = pages.filter(x => x.path.endsWith(f))
  return mine.every((x, i) => {
    const span = Math.min(x.limit, total - x.offset + 1)
    return !x.refused || mine.slice(i + 1).every(y => y.offset >= x.offset + span || y.limit < span)
  })
}
/** The fewest calls the Read tool's cap allows for a text, in the world's count of two characters a token. */
const fewest = (text: string) => Math.ceil(Math.ceil(TOKEN_CAP * text.length / CHAR_CAP) / TOKEN_CAP)

test('a line too long for one Read call: the plugin says what to cite instead, for a source and for the model', async ($, on) => {
  const files = folder()
  citing(files, [['settings.min.json', `{"pad":"${'z'.repeat(120_000)}","maxWorkers":8}`, '"maxWorkers":8', 1]])
  const notes = Array.from({ length: 3000 }, () => 'A note for the reader.')
  files['/w/m/flat.json'] = JSON.stringify({ ...EXAMPLE_MODEL, notes })
  world(on, { files })
  await $.session.start(START)
  const e02 = json(await $.tool.call(checkTool('/w/m/model.json'))).errors.find((i: { code: string }) => i.code === 'E02')
  expect(e02.message).toContain('a line in /w/m/src/settings.min.json is too long for Claude Code\'s Read tool, which reads whole lines; cite a line-broken extract made with a tool (for JSON: a pretty-printed copy) and record the command in "from"')
  expect(e02.message).not.toContain('offset and limit')
  expect(said(await $.tool.call(checkTool('/w/m/flat.json')))).toContain('is too long for Claude Code\'s Read tool, which reads whole lines; write the model file with line breaks (indented JSON)')
  files['/w/m/flat.json'] = JSON.stringify({ ...EXAMPLE_MODEL, notes }, null, 1)
  expect(said(await $.tool.call(checkTool('/w/m/flat.json')))).not.toContain('cannot read the model file')
})

test('a file whose lines each fit is read, however few of them fit in one call', async ($, on) => {
  const files = folder()
  // 25 of these lines are over the cap together; each one alone is not
  citing(files, [['wide.txt', Array.from({ length: 40 }, (_, i) => `wide ${i + 1} ${'y'.repeat(3000)}`).join('\n'), 'wide 40', 40]])
  world(on, { files })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
})

test('a page refused as too large in other words than the usual is still read, in smaller pages', async ($, on) => {
  const files = folder()
  citing(files, [
    ['even.txt', Array.from({ length: 6000 }, (_, i) => `row ${String(i + 1).padStart(6, '0')} ${'u'.repeat(18)}`).join('\n'), 'row 005999', 5999],
    ['min.json', `{"pad":"${'z'.repeat(120_000)}","maxWorkers":8}`, '"maxWorkers":8', 1],
  ])
  const pages: Pages = []
  world(on, { files, pages, capWords: 'File content exceeds maximum allowed size. Read less at a time.' })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors
  expect(errors.length).toBe(1)
  expect(errors[0].message).toContain('a line in /w/m/src/min.json is too long for Claude Code\'s Read tool')
  // with no count, a refusal bounds only the pages that overlap its lines; past them pages grow again
  expect(keepsBelowRefused(pages, 'even.txt', 6000)).toBe(true)
  const c = callsOn(pages, 'even.txt')
  expect(c.limits[c.refusedAt[0] + 2]).toBe(500)
  expect(Math.max(...c.limits.slice(c.refusedAt[0] + 2))).toBeGreaterThan(500)
})

/** A file under 2 MB with a dense head, then 1.4 million empty lines, then the line cited; returns its line count. */
function denseHeadEmptyTail(files: Files) {
  const head = Array.from({ length: 400 }, (_, i) => `h${i + 1} ${'z'.repeat(400)}`)
  const text = [...head, ...Array.from({ length: 1_400_000 }, () => ''), 'the last line'].join('\n')
  expect(utf8Bytes(text)).toBeLessThanOrEqual(MAX_SOURCE_BYTES)
  citing(files, [['tail.txt', text, 'the last line', 1_400_401]])
  return 1_400_401
}

for (const [what, words] of [
  ['no count', 'File content exceeds maximum allowed size. Read less at a time.'],
  ['the byte cap\'s words', 'The requested line range contains over 625KB of text, more than a read can return. Use a smaller limit — or, if a single line is this large, no limit will fit it: search for specific content instead.'],
] as [string, string][]) {
  test(`refusals with ${what}: a file under 2 MB with a dense head and a long run of empty lines is read in full pages after the head`, { timeoutMs: 30_000 }, async ($, on) => {
    const files = folder()
    const total = denseHeadEmptyTail(files)
    const pages: Pages = []
    world(on, { files, pages, capWords: words })
    await $.session.start(START)
    expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
    const c = callsOn(pages, 'tail.txt')
    expect(c.refused).toBeGreaterThan(0)
    expect(keepsBelowRefused(pages, 'tail.txt', total)).toBe(true)
    // full pages for the empty lines, plus the head's refusals and the doublings back to 2,000 lines
    expect(c.calls).toBeLessThanOrEqual(Math.ceil(total / 2000) + 30)
    expect(c.limits.slice(-3)).toEqual([2000, 2000, 2000])
  })
}

test('under a lowered Read cap, a page over the byte cap is refused in other words, and a 1 MB file is still read', { timeoutMs: 30_000 }, async ($, on) => {
  const files = folder()
  const text = Array.from({ length: 2500 }, (_, i) => `wide ${i + 1} ${'w'.repeat(400)}`).join('\n')
  expect(utf8Bytes(text)).toBeGreaterThan(1_000_000)
  citing(files, [['wide.txt', text, 'wide 2500', 2500]])
  const pages: Pages = []
  // CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS=5000: 5,000 tokens a call, and 640,000 bytes selected from a larger file
  world(on, { files, pages, tokenCap: 5000, byteCap: 640_000 })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
  // the case is reached: the first page was refused for its bytes, with no count
  const first = pages.find(x => x.path.endsWith('wide.txt'))!
  expect(first.limit).toBe(2000)
  expect(first.bytes).toBe(true)
  // the next refusal has a count again, and the pages are sized from it: as many 411-character lines as fit in
  // 0.8 of the lowered cap (10,000 characters at two a token), plus the two refused pages and the one line
  const c = callsOn(pages, 'wide.txt')
  expect(c.refused).toBe(2)
  expect(c.calls).toBeLessThanOrEqual(Math.ceil(2500 / Math.floor(0.8 * 10_000 / 411)) + 3)
})

test('a notebook, a PDF or an image is named for what it is, with what to cite instead', async ($, on) => {
  const files = folder()
  citing(files, ['tune.ipynb', 'runbook.pdf', 'shot.png'].map(f => [f, 'not text', 'MAX_WORKERS = 8', 1] as [string, string, string, number]))
  world(on, { files, readTypes: { 'tune.ipynb': 'notebook', 'runbook.pdf': 'pdf', 'shot.png': 'image' } })
  await $.session.start(START)
  const said3 = json(await $.tool.call(checkTool('/w/m/model.json'))).errors.map((i: { message: string }) => i.message).join('\n')
  expect(said3).toContain('/w/m/src/tune.ipynb is a Jupyter notebook. stockflow cites lines and a notebook has cells, so cite a text extract (for example: jupyter nbconvert --to script /w/m/src/tune.ipynb) and record the command in "from".')
  expect(said3).not.toContain('the Read tool returns its cells')
  expect(said3).toContain('/w/m/src/runbook.pdf is a PDF; the Read tool returns its pages, not its lines. Cite a text extract made with pdftotext')
  expect(said3).toContain('/w/m/src/shot.png is an image, and images cannot be quoted')
  expect(said3).not.toContain('not a text file')
})

test('a notebook is named as one whether the Read tool returns its cells or refuses it as too large, never blamed on a line', async ($, on) => {
  const files = folder()
  // a notebook's JSON has short lines; the Read tool reads it whole, so mid is over the token cap and big over 256 KB
  const notebook = (cells: number) => JSON.stringify({ cells: Array.from({ length: cells }, (_, i) => ({ cell_type: 'code', source: [`MAX_WORKERS = ${i}`] })) }, null, 1)
  citing(files, [
    ['small.ipynb', notebook(10), 'MAX_WORKERS = 8', 1],
    ['mid.ipynb', notebook(1500), 'MAX_WORKERS = 8', 1],
    ['big.ipynb', notebook(6000), 'MAX_WORKERS = 8', 1],
    ['Tune.IPYNB', notebook(1500), 'MAX_WORKERS = 8', 1],
  ])
  const pages: Pages = []
  world(on, { files, pages })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { message: string }[]
  expect(errors.length).toBe(4)
  for (const f of ['small.ipynb', 'mid.ipynb', 'big.ipynb', 'Tune.IPYNB']) {
    const e = errors.find(i => i.message.includes(`/w/m/src/${f})`))!
    expect(e.message).toContain(`/w/m/src/${f} is a Jupyter notebook. stockflow cites lines and a notebook has cells, so cite a text extract (for example: jupyter nbconvert --to script /w/m/src/${f}) and record the command in "from".`)
    expect(e.message).not.toContain('too long')
    // the first answer decides it: no smaller page is asked for
    expect(callsOn(pages, f).calls).toBe(1)
  }
  // the cases are reached: refused by the token count, and by size
  expect(callsOn(pages, 'mid.ipynb').refused).toBe(1)
  expect(callsOn(pages, 'big.ipynb').refused).toBe(1)
  // named as a notebook as the model file too, and not as something the tool returned
  expect(said(await $.tool.call(checkTool('/w/m/src/big.ipynb')))).toContain('cannot read the model file /w/m/src/big.ipynb: the Read tool reads /w/m/src/big.ipynb as "notebook", not as lines of text.')
})

test('a file the Read tool will not read in parts is said to be one, in the tool\'s words; a one-line file is still too long', async ($, on) => {
  const files = folder()
  citing(files, [
    ['export.dat', Array.from({ length: 3000 }, (_, i) => `row ${i + 1} ${'d'.repeat(30)}`).join('\n'), 'row 2999', 2999],
    ['min.json', `{"pad":"${'z'.repeat(120_000)}","maxWorkers":8}`, '"maxWorkers":8', 1],
  ])
  const pages: Pages = []
  world(on, { files, pages, noPaging: ['export.dat'] })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { message: string }[]
  const dat = errors.find(i => i.message.includes('export.dat'))!.message
  expect(dat).toContain('the Read tool would not read part of /w/m/src/export.dat (File content (')
  expect(dat).toContain('exceeds maximum allowed tokens (25000)); cite a text extract made with a tool and record the command in "from".')
  expect(dat).not.toContain('too long')
  expect(dat).not.toContain('offset and limit')
  // the bigger page, one line, and the next line all weigh the same: three calls
  expect(callsOn(pages, 'export.dat').calls).toBe(3)
  // one line weighs what the whole one-line file did, yet the next line comes back: that line is too long
  expect(errors.find(i => i.message.includes('min.json'))!.message).toContain('a line in /w/m/src/min.json is too long for Claude Code\'s Read tool')
  expect(callsOn(pages, 'min.json').calls).toBe(3)
})

test('a PDF or an image refused as too large is named for what it is, never blamed on a line, as is one read as lines', async ($, on) => {
  const files = folder()
  citing(files, ['manual.pdf', 'scan.PNG', 'notes.pdf'].map(f => [f, 'MAX_WORKERS = 8', 'MAX_WORKERS = 8', 1] as [string, string, string, number]))
  world(on, { files, readFails: { 'manual.pdf': 'PDF file exceeds maximum allowed size of 20MB.', 'scan.PNG': 'Image file exceeds maximum allowed size of 20MB.' } })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { message: string }[]
  const said3 = errors.map(i => i.message).join('\n')
  expect(said3).toContain('/w/m/src/manual.pdf is a PDF; the Read tool returns its pages, not its lines. Cite a text extract made with pdftotext')
  expect(said3).toContain('/w/m/src/scan.PNG is an image, and images cannot be quoted')
  expect(said3).not.toContain('too long')
  // decided once, from the path: a PDF is cited through an extract even if the tool were to return its lines
  expect(said3).toContain('/w/m/src/notes.pdf is a PDF')
  expect(errors.length).toBe(3)
})


test('a PDF, an image or a notebook the Read tool refuses is named for what it is, whatever the refusal says; the tool\'s words are added only when they say something else is wrong, never its remedy', async ($, on) => {
  const files = folder()
  const refusals: Record<string, string> = {
    // the real Read tool's whole-PDF refusals; their remedy, the pages parameter, is not one a citation can use
    'many.pdf': 'This PDF has 12 pages, which is too many to read at once. Use the pages parameter to read specific page ranges (e.g., pages: "1-5"). Maximum 20 pages per request.',
    'unknown.pdf': 'This PDF\'s page count is unknown (pdfinfo was not found). At 3.2MB it may be too long to read whole. Use the pages parameter to read specific page ranges (e.g., pages: "1-5"). Maximum 20 pages per request.',
    'full.pdf': 'Reading full PDFs is not supported with this model. Use a newer model (Sonnet 3.5 v2 or later), or use the pages parameter to read specific page ranges (e.g., pages: "1-5", maximum 20 pages per request). Page extraction requires poppler-utils: install with `brew install poppler` on macOS or `apt-get install poppler-utils` on Debian/Ubuntu.',
    'remote.pdf': 'This PDF (31.5MB) is larger than can be returned whole from this machine to the calling session (at most 10MB). Use the pages parameter with at most 20 pages per call (for example pages: 1-3, which come back as images), or read the file where the session runs.',
    'big.png': 'File is too large to read as an image (the limit is 3.75MB): /w/m/src/big.png. If it is an image, resize it or export a smaller copy, then read that.',
    // made-up words whose first sentence is the pages remedy itself
    'paged.pdf': 'Use the pages parameter for this PDF.',
    // the real Read tool's words when the file is not what its name says
    'fake.png': 'File has an image extension but its content is not a valid PNG/JPEG/GIF/WebP. Detected: unrecognized bytes (hex: 4d 41 58 5f 57 4f 52 4b). This usually means a download saved an error/login page instead of the image. Use `file "/w/m/src/fake.png"` to confirm, or read it as text with Bash (e.g. `head -c 500`).',
    'fake.pdf': 'File is not a valid PDF (missing %PDF- header): /w/m/src/fake.pdf',
    // made-up words over two lines, the first with no full stop: only the first line is told
    'odd.ipynb': 'Notebook could not be parsed\nUse Bash with jq to read specific portions.',
  }
  citing(files, Object.keys(refusals).map(f => [f, 'MAX_WORKERS = 8', 'MAX_WORKERS = 8', 1] as [string, string, string, number]))
  const reads: string[] = []
  world(on, { files, reads, readFails: refusals })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { code: string; message: string }[]
  expect(errors.length).toBe(Object.keys(refusals).length)
  const of = (f: string) => errors.find(i => i.message.includes(`/w/m/src/${f})`))!
  const pdf = (f: string) => `/w/m/src/${f} is a PDF; the Read tool returns its pages, not its lines. Cite a text extract made with pdftotext (for example: pdftotext /w/m/src/${f}) and record the command in "from".`
  for (const f of ['many.pdf', 'unknown.pdf', 'full.pdf', 'remote.pdf', 'paged.pdf']) {
    expect(of(f).code).toBe('E02')
    // said as for a PDF the tool returns, with nothing of the tool's words
    expect(of(f).message).toBe(`cannot read "${f}" (/w/m/src/${f}): ${pdf(f)}`)
  }
  expect(of('big.png').message).toBe('cannot read "big.png" (/w/m/src/big.png): /w/m/src/big.png is an image, and images cannot be quoted; cite a text source for what it shows.')
  expect(of('fake.png').message).toContain('/w/m/src/fake.png is an image, and images cannot be quoted; cite a text source for what it shows. The Read tool also said: File has an image extension but its content is not a valid PNG/JPEG/GIF/WebP.')
  expect(of('fake.pdf').message).toContain(`${pdf('fake.pdf')} The Read tool also said: File is not a valid PDF (missing %PDF- header): /w/m/src/fake.pdf.`)
  expect(of('odd.ipynb').message).toContain('so cite a text extract (for example: jupyter nbconvert --to script /w/m/src/odd.ipynb) and record the command in "from". The Read tool also said: Notebook could not be parsed.')
  const all = errors.map(i => i.message).join('\n')
  // the tool's remedies never reach the message
  for (const remedy of ['pages parameter', 'pages:', 'newer model', 'head -c', 'download saved', 'jq', 'resize']) expect(all).not.toContain(remedy)
  expect(all).not.toContain('too long')
  // the path decides it: one call each
  for (const f of Object.keys(refusals)) expect(reads.filter(p => p.endsWith(f)).length).toBe(1)
  // as the model file too
  expect(said(await $.tool.call(checkTool('/w/m/src/many.pdf')))).toBe('check: cannot read the model file /w/m/src/many.pdf: the Read tool reads /w/m/src/many.pdf as "pdf", not as lines of text.')
})

test('a refusal is classed by its words, never by the path it quotes', async ($, on) => {
  const files = folder()
  // folders named in the words that class a refusal; each refusal quotes the path as the real Read tool does
  const refusals: Record<string, string> = {
    'too large/fake.pdf': 'File is not a valid PDF (missing %PDF- header): /w/m/src/too large/fake.pdf',
    'exceeds maximum allowed/locked.txt': 'EACCES: permission denied, open \'/w/m/src/exceeds maximum allowed/locked.txt\'',
  }
  citing(files, Object.keys(refusals).map(f => [f, 'MAX_WORKERS = 8', 'MAX_WORKERS = 8', 1] as [string, string, string, number]))
  const reads: string[] = []
  world(on, { files, reads, readFails: refusals })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { message: string }[]
  const of = (f: string) => errors.find(i => i.message.includes(`/w/m/src/${f})`))!.message
  expect(of('too large/fake.pdf')).toContain('The Read tool also said: File is not a valid PDF (missing %PDF- header): /w/m/src/too large/fake.pdf.')
  // not paged as a size refusal: failed at once, in the tool's words
  expect(of('exceeds maximum allowed/locked.txt')).toBe('cannot read "exceeds maximum allowed/locked.txt" (/w/m/src/exceeds maximum allowed/locked.txt): EACCES: permission denied, open \'/w/m/src/exceeds maximum allowed/locked.txt\'.')
  expect(reads.filter(p => p.endsWith('locked.txt')).length).toBe(1)
})

test('a refusal is classed and told by its first sentence: what the tool quotes after it never decides, and a ". " in the path does not end it', async ($, on) => {
  const files = folder()
  const refusals: Record<string, string> = {
    // the real Read tool's words for an image whose bytes are JSON: the bytes it quotes say "too large"
    'json.png': 'File has an image extension but its content is not a valid PNG/JPEG/GIF/WebP. Detected: JSON/text (starts with "{"error":"file too large","code":413}"). This usually means a download saved an error/login page instead of the image. Use `file "/w/m/src/json.png"` to confirm, or read it as text with Bash (e.g. `head -c 500`).',
    // a working folder whose name is in the size words, quoted after the first sentence
    'gone.txt': 'File does not exist. Note: your current working directory is /w/exceeds maximum allowed.',
    'v2. final/fake.pdf': 'File is not a valid PDF (missing %PDF- header): /w/m/src/v2. final/fake.pdf',
  }
  citing(files, [
    ...Object.keys(refusals).map(f => [f, 'MAX_WORKERS = 8', 'MAX_WORKERS = 8', 1] as [string, string, string, number]),
    // a file the tool will not read in parts, refused in made-up words that count it and quote its path
    ['v2. final/export.dat', Array.from({ length: 3000 }, (_, i) => `row ${i + 1} ${'d'.repeat(30)}`).join('\n'), 'row 2999', 2999],
  ])
  delete files['/w/m/src/gone.txt']
  const capWords = 'File content (30000 tokens) exceeds maximum allowed tokens (25000) in /w/m/src/v2. final/export.dat. Use offset and limit parameters to read specific portions of the file.'
  const reads: string[] = []
  world(on, { files, reads, readFails: refusals, noPaging: ['export.dat'], capWords })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { message: string }[]
  const of = (f: string) => errors.find(i => i.message.includes(`/w/m/src/${f})`))!.message
  expect(of('json.png')).toBe('cannot read "json.png" (/w/m/src/json.png): /w/m/src/json.png is an image, and images cannot be quoted; cite a text source for what it shows. The Read tool also said: File has an image extension but its content is not a valid PNG/JPEG/GIF/WebP.')
  // failed at once in the tool's words, not paged and blamed on a line
  expect(of('gone.txt')).toBe(`cannot read "gone.txt" (/w/m/src/gone.txt): ${refusals['gone.txt']}`)
  expect(reads.filter(p => p.endsWith('gone.txt')).length).toBe(1)
  expect(of('v2. final/fake.pdf')).toContain('The Read tool also said: File is not a valid PDF (missing %PDF- header): /w/m/src/v2. final/fake.pdf.')
  expect(of('v2. final/export.dat')).toContain('the Read tool would not read part of /w/m/src/v2. final/export.dat (File content (30000 tokens) exceeds maximum allowed tokens (25000) in /w/m/src/v2. final/export.dat);')
})

for (const [what, words] of [
  ['', 'File content exceeds maximum allowed size. Read less at a time.'],
  // a count is read from the first sentence alone, never from a working folder the tool quotes after it
  [' in its first sentence', 'File content exceeds maximum allowed size. Note: your current working directory is /w/(1 tokens) exceeds maximum allowed tokens (1).'],
] as [string, string][]) {
  test(`with no count${what}, a file of two long lines is blamed on a line, never said to be one the tool will not read in parts`, async ($, on) => {
    const files = folder()
    citing(files, [['two.txt', `${'q'.repeat(120_000)}\n${'q'.repeat(120_000)}`, 'q', 1]])
    const pages: Pages = []
    world(on, { files, pages, capWords: words })
    await $.session.start(START)
    const e = (json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { message: string }[]).find(i => i.message.includes('two.txt'))!.message
    expect(e).toContain('a line in /w/m/src/two.txt is too long for Claude Code\'s Read tool')
    expect(e).not.toContain('would not read part of')
    // the case is reached: the bigger page and the one line were both refused, with no count
    expect(callsOn(pages, 'two.txt')).toEqual({ calls: 2, refused: 2, refusedAt: [0, 1], limits: [2000, 1] })
  })
}

test('a refused probe read is reported as the person\'s refusal, never as a line too long (E07)', async ($, on) => {
  const files = folder()
  citing(files, [['export.dat', Array.from({ length: 3000 }, (_, i) => `row ${i + 1} ${'d'.repeat(30)}`).join('\n'), 'row 2999', 2999]])
  const pages: Pages = []
  // the third Read of export.dat is the probe of the next line
  world(on, { files, pages, noPaging: ['export.dat'], guardReadAt: ['export.dat', 3, 'third read: no'] })
  await $.session.start(START)
  const e = (json(await $.tool.call(checkTool('/w/m/model.json'))).errors as { code: string; message: string }[]).find(i => i.message.includes('export.dat'))!
  expect(e.code).toBe('E07')
  expect(e.message).toContain('was refused: third read: no')
  expect(e.message).not.toContain('too long')
  // the case is reached: the bigger page and the one line were refused alike before the probe was refused
  expect(callsOn(pages, 'export.dat')).toEqual({ calls: 2, refused: 2, refusedAt: [0, 1], limits: [2000, 1] })
})
test('a large file is read in few Read calls: each page is sized from the tool\'s own token count', async ($, on) => {
  const files = folder()
  // even lines, 2000 of them over the cap; a dense head and a long thin tail; a file shorter than the
  // first page asked for, and over the cap; one line over the cap
  const even = Array.from({ length: 6000 }, (_, i) => `row ${String(i + 1).padStart(6, '0')} ${'u'.repeat(18)}`)
  const dense = [...Array.from({ length: 100 }, (_, i) => `head ${i + 1} ${'x'.repeat(1000)}`), ...Array.from({ length: 9900 }, (_, i) => `tail ${i + 101}`)]
  citing(files, [
    ['even.txt', even.join('\n'), 'row 005999', 5999],
    ['dense.txt', dense.join('\n'), 'tail 9999', 9999],
    ['short.txt', Array.from({ length: 1000 }, (_, i) => `short ${i + 1} ${'v'.repeat(50)}`).join('\n'), 'short 1000', 1000],
    ['min.json', `{"pad":"${'z'.repeat(120_000)}","maxWorkers":8}`, '"maxWorkers":8', 1],
  ])
  const reads: string[] = []
  world(on, { files, reads })
  await $.session.start(START)
  const errors = json(await $.tool.call(checkTool('/w/m/model.json'))).errors
  expect(errors.map((i: { where: string }) => i.where)).toEqual(['node "dead".evidence[4]'])
  const calls = (f: string) => reads.filter(p => p.endsWith(f)).length
  expect(calls('even.txt')).toBeLessThanOrEqual(7)
  expect(calls('dense.txt')).toBeLessThanOrEqual(20)
  expect(calls('short.txt')).toBeLessThanOrEqual(5)
  expect(calls('min.json')).toBeLessThanOrEqual(3)
})

test('a short title line before long paragraphs does not shrink the pages: few Read calls', async ($, on) => {
  const files = folder()
  const doc = ['# Notes', ...Array.from({ length: 200 }, (_, i) => `paragraph ${i + 2} ${'w'.repeat(1000)}`)]
  citing(files, [['notes.md', doc.join('\n'), 'paragraph 150', 150]])
  const pages: Pages = []
  world(on, { files, pages })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
  expect(callsOn(pages, 'notes.md').calls).toBeLessThanOrEqual(12)
})

test('a 1.5 MB file with a short head and a long dense tail is read to its end in a bounded number of calls', async ($, on) => {
  const files = folder()
  const all = [...Array.from({ length: 300 }, () => '    # row group'), ...Array.from({ length: 5500 }, (_, i) => `    row(${i + 301}, '${'r'.repeat(256)}')`)]
  const text = all.join('\n')
  expect(text.length).toBeGreaterThan(1_500_000)
  citing(files, [['fixtures.py', text, 'row(5781,', 5781]])
  const pages: Pages = []
  world(on, { files, pages })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
  // the cap allows 31 calls at the fewest; pages are sized to 0.8 of it, plus the refused first page and
  // the one line that gives the file's length: at most 40
  expect(fewest(text)).toBe(31)
  expect(callsOn(pages, 'fixtures.py').calls).toBeLessThanOrEqual(40)
})

test('a dense head then a long sparse tail: the pages shrink for the head and grow back for the tail', async ($, on) => {
  const files = folder()
  const all = [...Array.from({ length: 150 }, (_, i) => `head ${i + 1} ${'x'.repeat(800)}`), ...Array.from({ length: 20_000 }, (_, i) => `tail ${i + 151}`)]
  citing(files, [['thin.txt', all.join('\n'), 'tail 20149', 20_149]])
  const pages: Pages = []
  world(on, { files, pages })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
  const c = callsOn(pages, 'thin.txt')
  expect(c.calls).toBeLessThanOrEqual(25)
  expect(Math.min(...c.limits)).toBeLessThan(100)
  expect(c.limits.slice(-3)).toEqual([2000, 2000, 2000])
  // after the last refusal, each page grows at most twofold
  const after = c.limits.slice(c.refusedAt[c.refusedAt.length - 1] + 1)
  for (let i = 1; i < after.length; i++) expect(after[i]).toBeLessThanOrEqual(2 * after[i - 1])
})

test('a uniformly dense file settles at a page size that fits: one refusal, never refusal and success in turn', async ($, on) => {
  const files = folder()
  const text = Array.from({ length: 6000 }, (_, i) => `d${String(i + 1).padStart(5, '0')} ${'u'.repeat(192)}`).join('\n')
  citing(files, [['dense.txt', text, 'd05999', 5999]])
  const pages: Pages = []
  world(on, { files, pages })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
  const c = callsOn(pages, 'dense.txt')
  expect(c.refused).toBe(1)
  // pages sized to 0.8 of the cap, plus the refused first page and the one line that gives the file's length
  expect(c.calls).toBeLessThanOrEqual(Math.ceil(fewest(text) / 0.8) + 2)
})

test('a page that fits never makes the next page smaller: a light first count, then a heavier tail', async ($, on) => {
  const files = folder()
  // the first count covers light lines; the tail's pages weigh more than 0.8 of the cap and still fit
  const all = [...Array.from({ length: 2000 }, (_, i) => `light ${String(i + 1).padStart(5, '0')} ${'a'.repeat(87)}`), ...Array.from({ length: 6000 }, (_, i) => `heavy ${String(i + 2001).padStart(5, '0')} ${'b'.repeat(107)}`)]
  citing(files, [['tail.txt', all.join('\n'), 'heavy 07999', 7999]])
  const pages: Pages = []
  world(on, { files, pages })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
  const c = callsOn(pages, 'tail.txt')
  expect(c.refused).toBe(1)
  for (let i = 1; i < c.limits.length; i++) if (!c.refusedAt.includes(i - 1)) expect(c.limits[i]).toBeGreaterThanOrEqual(c.limits[i - 1])
  expect(c.calls).toBeLessThanOrEqual(24)
})

test('a page of a model twice the example\'s size is read in a refused page, one line and pages that fit', { timeoutMs: 30_000 }, async ($, on) => {
  const files = folder()
  files['/w/m/model.json'] = JSON.stringify(doubled(), null, 1)
  const pages: Pages = []
  world(on, { files, pages })
  await $.session.start(START)
  const first = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(first.rendered).toBe(true)
  expect(first.note).toBeUndefined()
  expect(first.bytes).toBeGreaterThan(1.5 * utf8Bytes(render(await exampleAnalysis()).html))
  // the real Read tool counted this page at 2.09 characters a token and read it in 4 calls; the world
  // counts 2, which leaves the page's last 12 lines for a third page
  const read = callsOn(pages, 'model.html')
  expect(read.refused).toBe(1)
  expect(read.calls).toBeLessThanOrEqual(5)
  pages.length = 0
  // the next render reads it twice: to confirm its seal, then to read it back
  expect(json(await $.tool.call(renderTool('/w/m/model.json'))).rendered).toBe(true)
  expect(callsOn(pages, 'model.html').calls).toBeLessThanOrEqual(10)
})

test('a refused page of a few lines, each of which fits, is read on: only a one-line page is too long', async ($, on) => {
  const files = folder()
  // ten short lines, then lines that fit only a few to a call
  const all = [...Array.from({ length: 10 }, (_, i) => `a${i + 1} ${'y'.repeat(500)}`), ...Array.from({ length: 20 }, (_, i) => `wide row ${i + 11} ${'y'.repeat(6000)}`)]
  citing(files, [['few.txt', all.join('\n'), 'wide row 30', 30]])
  const pages: Pages = []
  world(on, { files, pages })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
  // the case is reached: the tool refused a page of 2 to 25 lines
  expect(pages.some(x => x.path.endsWith('few.txt') && x.refused && x.limit >= 2 && x.limit <= 25)).toBe(true)
})

test('a file within the size limit is read to its end, however many calls its short lines take', { timeoutMs: 30_000 }, async ($, on) => {
  const files = folder()
  // close to MAX_SOURCE_BYTES of empty lines: 2000 lines a call, 1000 calls
  const text = `${'\n'.repeat(1_999_980)}the last line`
  expect(utf8Bytes(text)).toBeLessThanOrEqual(MAX_SOURCE_BYTES)
  citing(files, [['blank.txt', text, 'the last line', 1_999_981]])
  const pages: Pages = []
  world(on, { files, pages })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).errors).toEqual([])
  expect(callsOn(pages, 'blank.txt').calls).toBe(1000)
})

test('a file that never ends is stopped, and the stop is said for what it is', { timeoutMs: 30_000 }, async ($, on) => {
  const files = folder()
  citing(files, [['app.log', 'log line 1', 'log line 1', 1]])
  const pages: Pages = []
  world(on, { files, pages, endless: 'app.log' })
  await $.session.start(START)
  const e02 = json(await $.tool.call(checkTool('/w/m/model.json'))).errors.find((i: { code: string }) => i.code === 'E02')
  expect(e02.message).toContain(`stopped after ${callsOn(pages, 'app.log').calls} Read calls before the end of /w/m/src/app.log`)
  expect(e02.message).not.toContain('too long')
})

test('a long file is read in pages when one Read call would be too large', async ($, on) => {
  const files = folder()
  const lines = Array.from({ length: 3000 }, (_, i) => `line ${i + 1}`)
  files['/w/m/src/worker.py'] = `${EXAMPLE_FILES['worker.py']}\n${lines.join('\n')}`
  const m = JSON.parse(JSON.stringify(EXAMPLE_MODEL))
  m.nodes.find((n: { id: string }) => n.id === 'dead').evidence.push({ path: 'worker.py', lines: String(28 + 2900), quote: 'line 2900' })
  files['/w/m/model.json'] = JSON.stringify(m)
  const reads: string[] = []
  world(on, { files, pageCap: 600, reads })
  await $.session.start(START)
  const report = json(await $.tool.call(checkTool('/w/m/model.json')))
  expect(report.errors).toEqual([])
  expect(report.counts.quotes_verified).toBe(22)
  expect(reads.filter(p => p.endsWith('worker.py')).length).toBeGreaterThan(5)
})

// ------------------------------------------------------------------------------ the plugin's own tools

test('the person\'s explicit rules for the plugin\'s own tools are honoured', async ($, on) => {
  world(on, { files: folder(), toolVerdict: { decision: 'deny', reason: 'blocked by a rule' } })
  await $.session.start(START)
  expect(said(await $.tool.call(checkTool('/w/m/model.json')))).toContain('deny mcp__stockflow__check')
})

test('an ask rule for the plugin\'s tool is put to the person; with no answer the tool does not run', async ($, on) => {
  const reads: string[] = []
  world(on, { files: folder(), toolVerdict: { decision: 'ask', rule: 'mcp__stockflow__check' }, reads })
  on('tool.call', { tool: 'AskUserQuestion' }, () => { throw new Error('no one to ask') })
  await $.session.start(START)
  expect(said(await $.tool.call(checkTool('/w/m/model.json')))).toContain('ask before mcp__stockflow__check runs')
  expect(reads).toEqual([])
})

test('the mode\'s own ask (no rule) does not stop the tool: each read and write is asked about instead', async ($, on) => {
  world(on, { files: folder(), toolVerdict: { decision: 'ask' } })
  await $.session.start(START)
  expect(json(await $.tool.call(checkTool('/w/m/model.json'))).ok).toBe(true)
})

// ------------------------------------------------------------------------------- rendering

test('the render tool writes one sealed page beside the model and returns the reader view', async ($, on) => {
  const writes: Files = {}
  world(on, { files: folder(), writes })
  await $.session.start(START)
  const out = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(out.rendered).toBe(true)
  expect(Object.keys(writes)).toEqual(['/w/m/model.html'])
  expect(sealState(writes['/w/m/model.html'])).toBe('intact')
  expect(out.bytes).toBe(utf8Bytes(writes['/w/m/model.html']))
  expect(out.reader_view).toContain('Short answer:')
  expect(json(await $.tool.call(renderTool('/w/m/model.json'))).rendered).toBe(true)
})

test('a page changed after stockflow wrote it is not overwritten; a re-indented one is', async ($, on) => {
  const files = folder()
  world(on, { files })
  await $.session.start(START)
  await $.tool.call(renderTool('/w/m/model.json'))
  files['/w/m/model.html'] = files['/w/m/model.html'].replace('</main>', '\n\n  </main>')
  expect(json(await $.tool.call(renderTool('/w/m/model.json'))).rendered).toBe(true)
  files['/w/m/model.html'] = files['/w/m/model.html'].replace('</main>', '<p>my notes</p></main>')
  expect(said(await $.tool.call(renderTool('/w/m/model.json')))).toContain('changed after stockflow wrote it')
})

test('a sealed page from another machine is replaced; a file with no seal never is', async ($, on) => {
  const files = folder()
  const a = await check(JSON.stringify(EXAMPLE_MODEL), '/w/m/model.json', { read: async p => (p in files ? { text: files[p] } : { failed: 'File does not exist.' }) })
  files['/w/m/ours.html'] = render(a).html
  files['/w/m/notes.html'] = '<p>my notes</p><meta name="generator" content="stockflow">'
  world(on, { files })
  await $.session.start(START)
  expect(json(await $.tool.call(renderTool('/w/m/model.json', { out: 'ours.html' }))).rendered).toBe(true)
  const none = said(await $.tool.call(renderTool('/w/m/model.json', { out: 'notes.html' })))
  expect(none).toContain('/w/m/notes.html exists without stockflow\'s seal, so stockflow cannot confirm it wrote the page and will not replace it (a hook may have removed the seal as the page was written, for example one that strips comments). Delete or move the file, or give the render tool another "out".')
  expect(none).not.toContain('not written by stockflow')
})

test('a hook that rewrites the page as it is written is reported', async ($, on) => {
  world(on, { files: folder(), rewriteOnWrite: t => t.replace('<main', '<main data-x="1"') })
  await $.session.start(START)
  const out = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(out.rendered).toBe(true)
  expect(out.note).toContain('a hook rewrote it')
})

test('a page with a line too long for one Read call is never replaced, and the render that wrote it says so', async ($, on) => {
  const writes: Files = {}
  // one long line, as a hook that joins lines would leave it: over the cap for one Read call
  world(on, { files: folder(), writes, charCap: 20_000, rewriteOnWrite: t => t.replace(/\n/g, ' ') })
  await $.session.start(START)
  const first = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(first.rendered).toBe(true)
  expect(first.note).toContain('The page could not be read back through the Read tool (a line in /w/m/model.html is too long for Claude Code\'s Read tool')
  expect(first.note).toContain('the next render may not be able to replace it')
  delete writes['/w/m/model.html']
  expect(said(await $.tool.call(renderTool('/w/m/model.json')))).toContain('/w/m/model.html exists and cannot be read to confirm stockflow wrote it: a line in /w/m/model.html is too long')
  expect(writes).toEqual({})
})

test('a page broken into short lines is read back in pages, and the next render replaces it', async ($, on) => {
  const reads: string[] = []
  world(on, { files: folder(), reads, charCap: 20_000, rewriteOnWrite: t => t.replace(/></g, '>\n<') })
  await $.session.start(START)
  const first = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(first.rendered).toBe(true)
  expect(first.note).toBeUndefined()
  expect(json(await $.tool.call(renderTool('/w/m/model.json'))).rendered).toBe(true)
  expect(reads.filter(p => p.endsWith('model.html')).length).toBeGreaterThan(2)
})

test('an existing page that cannot be read through the Read tool is never overwritten: refused, or too long', async ($, on) => {
  const files = folder()
  const a = await check(JSON.stringify(EXAMPLE_MODEL), '/w/m/model.json', { read: async p => (p in files ? { text: files[p] } : { failed: 'File does not exist.' }) })
  files['/w/m/denied.html'] = render(a).html
  files['/w/m/long.html'] = render(a).html.replace(/\n/g, ' ')
  const writes: Files = {}
  world(on, { files, writes, charCap: 20_000, guardRead: { 'denied.html': 'secrets-guard: no' } })
  await $.session.start(START)
  expect(said(await $.tool.call(renderTool('/w/m/model.json', { out: 'denied.html' })))).toContain('denied.html exists and cannot be read to confirm stockflow wrote it: reading it was refused: secrets-guard: no')
  expect(said(await $.tool.call(renderTool('/w/m/model.json', { out: 'long.html' })))).toContain('long.html exists and cannot be read to confirm stockflow wrote it: a line in /w/m/long.html is too long')
  expect(writes).toEqual({})
})

for (const [what, rewrite] of [
  ['edits', (t: string) => t.replace('<main', '<main data-x="1"')],
  ['adds after the seal', (t: string) => `${t}<!-- formatted by hook -->\n`],
] as [string, (t: string) => string][]) {
  test(`a page a hook ${what} as it is written: the render that wrote it says what the next render will`, async ($, on) => {
    world(on, { files: folder(), rewriteOnWrite: rewrite })
    await $.session.start(START)
    const first = json(await $.tool.call(renderTool('/w/m/model.json')))
    expect(first.note).toContain('a hook rewrote it')
    expect(first.note).toContain('the next render will refuse to replace it')
    const next = said(await $.tool.call(renderTool('/w/m/model.json')))
    expect(next.startsWith('render: /w/m/model.html')).toBe(true)
    expect(first.note).toContain(next.slice('render: '.length))
  })
}

const STRIPPED = 'A hook removed stockflow\'s seal from the page as it was written (for example a formatter that strips comments). The page on disk can no longer be confirmed as stockflow\'s, so delete it before rendering again; while that hook runs, each new page loses its seal too, so also exclude the page from the hook.'

test('a page a hook strips the seal from as it is written: the render that wrote it names the hook, and the next refuses with advice both callers can follow', async ($, on) => {
  const writes: Files = {}
  // a formatter that strips comments, the seal with them
  world(on, { files: folder(), writes, rewriteOnWrite: t => t.replace(/<!--[\s\S]*?-->/g, '') })
  await $.session.start(START)
  const first = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(first.rendered).toBe(true)
  expect(first.note).toBe(STRIPPED)
  delete writes['/w/m/model.html']
  const advice = 'Delete or move the file, or give the render tool another "out".'
  const next = said(await $.tool.call(renderTool('/w/m/model.json')))
  expect(next).toContain('a hook may have removed the seal as the page was written')
  expect(next).toContain(advice)
  const command = (await $.command.run({ command: 'stockflow-check', args: '/w/m/model.json', ...RUN })).text
  expect(command).toContain('Not rendered: /w/m/model.html exists without stockflow\'s seal')
  expect(command).toContain(advice)
  expect(writes).toEqual({})
})

test('after a hook stripped the seal, turning the hook off is not enough: the next render still refuses until the page is deleted, as the note says', async ($, on) => {
  const files = folder()
  const w: World = { files, rewriteOnWrite: t => t.replace(/<!--[\s\S]*?-->/g, '') }
  world(on, w)
  await $.session.start(START)
  const first = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(first.note).toBe(STRIPPED)
  // the note does not offer excluding the page from the hook as an alternative to deleting it
  expect(first.note).not.toMatch(/exclude the page from (that|the) hook, or delete/)
  expect(first.note.indexOf('delete it before rendering again')).toBeLessThan(first.note.indexOf('also exclude the page from the hook'))
  w.rewriteOnWrite = undefined
  expect(said(await $.tool.call(renderTool('/w/m/model.json')))).toContain('/w/m/model.html exists without stockflow\'s seal')
  delete files['/w/m/model.html']
  const after = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(after.rendered).toBe(true)
  expect(after.note).toBeUndefined()
  expect(sealState(files['/w/m/model.html'])).toBe('intact')
})

test('the page stays inside the model\'s folder: relative "out", missing folders, links, .html only', async ($, on) => {
  const files = folder()
  files['/elsewhere/sub/x.txt'] = 'x'
  world(on, { files, links: { '/w/m/evil.html': '/etc/evil.html', '/w/m/sub': '/elsewhere/sub' } })
  await $.session.start(START)
  const call = (out: string) => $.tool.call(renderTool('/w/m/model.json', { out }))
  expect(json(await call('second.html')).page).toBe('/w/m/second.html')
  expect(said(await call('/w/elsewhere/page.html'))).toContain('does not exist')
  expect(said(await call('../page.html'))).toContain('inside the model')
  expect(said(await call('evil.html'))).toContain('symbolic link')
  expect(said(await call('sub/page.html'))).toContain('inside the model')
  expect(said(await call('page.txt'))).toContain('.html')
})

test('the Write tool is given the path as spelled, so a rule on a linked folder\'s name applies', async ($, on) => {
  const files: Files = { '/plugin/prompt.md': PROMPT, '/w/real/model.json': JSON.stringify(EXAMPLE_MODEL) }
  for (const [k, v] of Object.entries(EXAMPLE_FILES)) files[`/w/real/src/${k}`] = v
  const writes: Files = {}
  world(on, { files, links: { '/w/m': '/w/real' }, denyWrite: ['/w/m/model.html'], writes })
  await $.session.start(START)
  const out = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(out.rendered).toBe(false)
  expect(out.why).toContain('writing /w/m/model.html was refused: File is in a directory that is denied by your permission settings.')
  expect(out.why).not.toContain('failed')
  expect(writes).toEqual({})
})

test('a page path a Read deny rule covers is the person\'s refusal of the write, not a failure', async ($, on) => {
  const writes: Files = {}
  world(on, { files: folder(), writes, denyRead: ['/w/m/model.html'] })
  await $.session.start(START)
  const out = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(out.rendered).toBe(false)
  expect(out.why).toContain('writing /w/m/model.html was refused: File is covered by a Read deny rule in your permission settings and cannot be written.')
  expect(out.why).not.toContain('failed')
  expect(writes).toEqual({})
})

test('a session whose settings remove the Read or the Write tool reports the person\'s refusal', async ($, on) => {
  world(on, { files: folder(), noTool: ['Write'] })
  await $.session.start(START)
  const out = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(out.rendered).toBe(false)
  expect(out.why).toContain('writing /w/m/model.html was refused: this session has no Write tool')
  expect(out.why).not.toContain('HooksError')
})

test('a session with no Read tool says so for the model file', async ($, on) => {
  world(on, { files: folder(), noTool: ['Read'] })
  await $.session.start(START)
  const text = said(await $.tool.call(checkTool('/w/m/model.json')))
  expect(text).toContain('this session has no Read tool')
  expect(text).not.toContain('HooksError')
})

test('a write that fails for another reason is said to have failed, in the tool\'s words', async ($, on) => {
  const writes: Files = {}
  world(on, { files: folder(), writes, writeError: 'EROFS: read-only file system' })
  await $.session.start(START)
  const out = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(out.rendered).toBe(false)
  expect(out.why).toContain('writing /w/m/model.html failed: EROFS: read-only file system')
})

test('a write the person does not approve is not made, and is reported', async ($, on) => {
  const writes: Files = {}
  world(on, { files: folder(), writes, askWrite: ['/w/m/model.html'] })
  await $.session.start(START)
  const asked = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(asked.rendered).toBe(false)
  expect(asked.why).toContain('writing /w/m/model.html was refused')
  expect(writes).toEqual({})
})

test('a Write tool error is reported, not taken for success', async ($, on) => {
  world(on, { files: folder(), writeError: 'EACCES: permission denied' })
  await $.session.start(START)
  const out = json(await $.tool.call(renderTool('/w/m/model.json')))
  expect(out.rendered).toBe(false)
  expect(out.why).toContain('EACCES')
})

// ------------------------------------------------------------------------- /stockflow-check

test('/stockflow-check re-renders a clean model, from a quoted path relative to the current folder', async ($, on) => {
  const writes: Files = {}
  const cwd = { value: '/w' }
  world(on, { files: folder(), writes, cwd })
  await $.session.start(START)
  cwd.value = '/w/m'
  const r = await $.command.run({ command: 'stockflow-check', args: '"model.json"', ...RUN })
  expect(r.text).toContain('OK:')
  expect(r.text).toContain('Rendered /w/m/model.html')
})

for (const [what, extra] of [
  ['is a symbolic link', { links: { '/w/m/model.html': '/w/other.html' } }],
  ['cannot be read', { guardRead: { 'model.html': 'secrets-guard: no' } }],
  ['has no seal', {}],
] as [string, Partial<World>][]) {
  test(`/stockflow-check, which has no "out", is told what it can do when the page's file ${what}`, async ($, on) => {
    const files = folder()
    files['/w/m/model.html'] = '<p>my notes</p>'
    const writes: Files = {}
    world(on, { files, writes, ...extra })
    await $.session.start(START)
    const r = (await $.command.run({ command: 'stockflow-check', args: '/w/m/model.json', ...RUN })).text
    expect(r).toContain('Not rendered: /w/m/model.html ')
    expect(r).toContain('Delete or move the file, or give the render tool another "out".')
    expect(r).not.toContain('choose another "out"')
    expect(writes).toEqual({})
  })
}

test('/stockflow-check reads and writes under the same settings as the tools', async ($, on) => {
  const writes: Files = {}
  world(on, { files: folder(), writes, denyRead: ['alerting.py'] })
  await $.session.start(START)
  const r = await $.command.run({ command: 'stockflow-check', args: '/w/m/model.json', ...RUN })
  expect(r.text).toContain('E07')
  expect(writes).toEqual({})
})

// -------------------------------------------------------------------------------- the page

async function exampleAnalysis(patch?: (m: typeof EXAMPLE_MODEL) => void) {
  const m = JSON.parse(JSON.stringify(EXAMPLE_MODEL))
  if (patch) patch(m)
  return check(JSON.stringify(m), '/w/model.json', { read: async p => { const t = EXAMPLE_FILES[p.replace('/w/src/', '')]; return t === undefined ? { failed: 'File does not exist.' } : { text: t } } })
}

test('the legend lists exactly the marks drawn', async () => {
  const a = await exampleAnalysis()
  const page = render(a)
  const m = a.model!
  const want = new Set<string>()
  for (const n of m.nodes) if (n.kind === 'stock' || n.kind === 'aux' || n.kind === 'constant') want.add(`${n.kind}|${n.status}|${n.emphasis ? 'emph' : 'plain'}`)
  for (const f of m.flows) want.add(`flow|${f.status}|${f.emphasis ? 'emph' : 'plain'}`)
  for (const l of m.links) want.add(`link|${l.status}|${l.emphasis ? 'emph' : 'plain'}`)
  for (const n of m.nodes) if (n.kind === 'shadow') want.add('shadow|observed')
  want.add('cloud'); want.add('delay'); want.add('loop')
  expect([...page.legend].sort()).toEqual([...want].sort())
})

test('the example lays out with no layout warnings', async () => {
  expect(render(await exampleAnalysis()).layout).toEqual([])
})

test('a modelled or intended constant is drawn with a halo and explained', async () => {
  const a = await exampleAnalysis(m => {
    Object.assign(m.nodes.find(n => n.id === 'retry_limit') as Record<string, unknown>, { status: 'modelled', claim: 'assumed to be 5 as in worker.py' })
  })
  expect(a.report.ok).toBe(true)
  const page = render(a)
  expect(page.legend).toContain('constant|modelled|plain')
  expect(page.html).toContain('class="halo"')
  expect(page.html).toContain('with a dashed halo')
  expect(page.readerView).toContain('retry limit = 5 (constant, modelled)')
})

test('an emphasised flow gets its own legend entry, with the rule', async () => {
  const a = await exampleAnalysis(m => {
    ;(m as Record<string, unknown>).emphasis = { name: 'Defect', rule: 'drawn where a review found a defect' }
    ;(m.flows.find(f => f.id === 'requeued') as Record<string, unknown>).emphasis = 'requeues ignore backoff'
  })
  expect(a.report.ok).toBe(true)
  const page = render(a)
  expect(page.legend).toContain('flow|observed|emph')
  expect(page.html).toContain('drawn where a review found a defect')
  expect(page.html).toContain('requeues ignore backoff')
})

test('web sources are marked unchecked, and the page prints the checker\'s own quote counts', async () => {
  const a = await exampleAnalysis(m => {
    ;(m.flows.find(f => f.id === 'resolved') as { evidence?: unknown[] }).evidence = [{ url: 'https://status.example.com/oncall', quote: 'Pages are closed by the on-call engineer.' }]
    ;(m as Record<string, unknown>).reference_modes = [{ variable: 'queue', pattern: 'grows during outages', basis: 'data', evidence: [{ url: 'https://grafana.example.com/d/runner', quote: 'queue length' }] }]
  })
  expect(a.report.ok).toBe(true)
  expect(a.report.counts.quotes_total).toBe(23)
  const page = render(a)
  expect(page.html).toContain('(web source, not checked)')
  expect(page.readerView).toContain('21 of 23 quotes were checked')
  expect(page.readerView).toContain('2 web sources could not be checked')
  expect(page.readerView).toContain('https://grafana.example.com/d/runner (web source, not checked)')
})

test('rendering is deterministic, escapes once, and the page stays inert', async () => {
  const a = await exampleAnalysis(m => {
    ;(m.nodes.find(n => n.id === 'queue') as Record<string, unknown>).detail = '</script><script>alert(1)</script>'
    ;(m as Record<string, unknown>).notes = ['<img src=x onerror=alert(1)>']
    ;(m as { review: Record<string, unknown> }).review.note = 'Fixed "R1" & B2.'
  })
  const one = render(a)
  const two = render(a)
  expect(one.html).toBe(two.html)
  expect(one.html).not.toContain('<script>alert(1)')
  expect(one.html).not.toContain('<img src=x')
  expect(one.html).toContain('Fixed &quot;R1&quot; &amp; B2.')
  expect(one.html).not.toContain('&amp;quot;')
  expect(one.html).toContain('overflow-x:auto')
})

test('the reader view carries what the page says: answer, disclaimer, statuses, notes and limits', async () => {
  const a = await exampleAnalysis(m => { ;(m as Record<string, unknown>).notes = ['A note for the reader.'] })
  const t = render(a).readerView
  expect(t).toContain('Short answer:')
  expect(t).toContain('not the result of a simulation')
  expect(t).toContain('resolved (Open pages → outside the model, pages/minute, modelled)')
  expect(t).toContain('A note for the reader.')
  expect(t).toContain('Not machine-checked:')
  expect(t).toContain('Copies of elements drawn elsewhere: <Queued jobs>')
})

// ------------------------------------------------------------------- renderer fixes, pinned

test('a route with no corner is drawn straight and warned about, never as an empty figure', async () => {
  const a = await exampleAnalysis(m => { ;(m.flows.find(f => f.id === 'submitted') as Record<string, unknown>).route = 'vh' })
  const page = render(a)
  expect(page.html).not.toMatch(/NaN|Infinity/)
  expect(page.layout.map(i => i.code)).toContain('G08')
})

test('designed loops alone get the R/B tag entry, never the loop-marker entry', async () => {
  const a = await exampleAnalysis(m => {
    m.links = m.links.filter(l => !['busy_done', 'busy_fail', 'busy_drop', 'busy_dispatch', 'q_dispatch', 'pages_resolve'].includes(l.id))
    m.loops = []; m.answer.loops = []
    ;(m.links as unknown[]).push({ status: 'intended', id: 'q_sub', from: 'queue', to: 'submitted', polarity: '-', mechanism: 'callers back off', claim: 'DESIGN.md asks for it' })
  })
  const page = render(a)
  expect(a.report.designed.length).toBeGreaterThan(0)
  expect(page.legend).toContain('pill')
  expect(page.legend).not.toContain('loop')
})

test('a shadow shows the status of what it copies, on the figure, in its name and in the reader view', async () => {
  const a = await exampleAnalysis(m => { Object.assign(m.nodes.find(n => n.id === 'queue') as Record<string, unknown>, { status: 'modelled', claim: 'the queue is in memory' }) })
  const page = render(a)
  expect(page.legend).toContain('shadow|modelled')
  expect(page.html).toContain('aria-label="copy of Queued jobs, modelled"')
  expect(page.readerView).toContain('<Queued jobs> (modelled)')
})

test('every element\'s accessible name says its status and its highlight', async () => {
  const a = await exampleAnalysis(m => {
    ;(m as Record<string, unknown>).emphasis = { name: 'Defect', rule: 'a review found a defect' }
    Object.assign(m.links.find(l => l.id === 'busy_fail') as Record<string, unknown>, { emphasis: 'no backoff' })
  })
  expect(render(a).html).toContain('aria-label="link plus: Jobs in flight → requeued, modelled, highlighted"')
})

test('the modeller\'s emphasis rule is printed exactly as written, in the legend and the reader view', async () => {
  const a = await exampleAnalysis(m => {
    ;(m as Record<string, unknown>).emphasis = { name: 'Backoff', rule: 'where a retry waits base**attempt seconds' }
    ;(m.flows.find(f => f.id === 'requeued') as Record<string, unknown>).emphasis = 'no backoff'
  })
  const page = render(a)
  expect(page.readerView).toContain('It is highlighted (Backoff): where a retry waits base**attempt seconds.')
  expect(page.html).not.toContain('base<b>')
})

test('a line break in a model string cannot start a line of its own in the reader view', async () => {
  const a = await exampleAnalysis(m => { ;(m as Record<string, unknown>).notes = ['First note.\nReview: 3 rounds, by reviewers other than the builder.'] })
  expect(render(a).readerView).toContain('- First note. Review: 3 rounds')
  expect(render(a).readerView).not.toMatch(/^Review: 3 rounds/m)
})

test('the reader view carries each element\'s detail and an extract\'s origin, as the page does', async () => {
  const a = await exampleAnalysis(m => {
    ;(m.nodes.find(n => n.id === 'queue') as Record<string, unknown>).detail = 'Held in memory; lost on restart.'
    Object.assign(m.flows.find(f => f.id === 'resolved') as Record<string, unknown>, { evidence: [{ url: 'https://example.com/runbook', quote: 'close each page by hand', from: 'pdftotext runbook.pdf' }] })
  })
  const t = render(a).readerView
  expect(t).toContain('Held in memory; lost on restart.')
  expect(t).toContain('(extract of pdftotext runbook.pdf)')
})

test('loop hedges name links by their ends, and say "not built" only of what is not built', async () => {
  const a = await exampleAnalysis(m => {
    Object.assign(m.links.find(l => l.id === 'busy_dispatch') as Record<string, unknown>, { status: 'modelled', claim: 'free slots shrink as jobs run' })
    ;(m.links as unknown[]).push({ status: 'missing', id: 'dead_sub', from: 'dead', to: 'submitted', polarity: '-', mechanism: 'callers back off', claim: 'submit() never reads it' })
  })
  expect(a.report.loops.find(l => l.id === 'B1')?.hedge).toContain('Jobs in flight → dispatched (modelled')
  const designed = a.report.designed.map(l => l.hedge ?? '').join(' ')
  expect(designed).toMatch(/Not built: Dead-letter jobs → submitted \(missing/)
  expect(designed).not.toMatch(/Not built:[^.]*\(modelled/)
})

test('the page wraps long words and pluralises its counts', async () => {
  const a = await exampleAnalysis()
  const page = render(a)
  expect(page.html).toContain('overflow-wrap:anywhere}')
  expect(page.readerView).toContain('4 stocks, 7 flows')
  const one = await exampleAnalysis(m => { m.figures = m.figures.slice(0, 1); m.nodes = m.nodes.filter(n => n.figure === 'f1'); m.loops = m.loops.filter(l => l.id !== 'B6') })
  expect(render(one).readerView).not.toContain('1 stocks')
})

test('a missing flow\'s cross sits clear of its valve, and labels avoid arrowheads', async () => {
  const a = await exampleAnalysis(m => {
    Object.assign(m.flows.find(f => f.id === 'completed') as Record<string, unknown>, { status: 'missing', claim: 'nothing records completions', valve: 0.25 })
    m.loops = m.loops.filter(l => l.id !== 'B3')
    Object.assign(m.links.find(l => l.id === 'busy_done') as Record<string, unknown>, { status: 'missing', claim: 'c' })
  })
  const page = render(a)
  const g = /data-id="completed"[\s\S]*?<\/g>/.exec(page.html)![0]
  const valve = /class="valve-shape" d="M[^"]*? L[^"]*? L([\d.]+),([\d.]+)/.exec(g)!
  const x = /class="miss-x" d="M([\d.]+),([\d.]+)/.exec(g)!
  expect(Math.hypot(Number(x[1]) + 6 - Number(valve[1]), Number(x[2]) + 6 - Number(valve[2]))).toBeGreaterThan(18)
})

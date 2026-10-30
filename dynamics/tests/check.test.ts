import { describe, expect, test } from 'claude-code/testing'
import { EXAMPLE_FILES, EXAMPLE_MODEL } from '../hooks/example.ts'
import { render } from '../hooks/render.ts'
import { check, readingOf, type Io } from '../hooks/spec.ts'
import { SECTIONS } from '../hooks/fields.ts'
import { asciiDigits, numbersIn, numberTokens, splitLines } from '../hooks/text.ts'

// Every must-refuse case is the worked example plus one small change, so the clean example makes
// each expected code the only one: if a rule is removed, its case goes red.

type M = typeof EXAMPLE_MODEL & Record<string, unknown>
const clone = (): M => JSON.parse(JSON.stringify(EXAMPLE_MODEL))
const MODEL_PATH = '/work/model.json'

/** Extra source files beside the example's, for cases that cite one. */
const EXTRA: Record<string, string> = {
  'README.md': 'Jobs wait in a queue until a worker is free.\n',
  'docs/design.mdx': 'Failed jobs are requeued until they reach the retry limit.\n',
  'templates/submit.html': '<form hx-post="/jobs/submit">submit a job</form>\n',
  'CMakeLists.txt': 'add_executable(job_runner worker.c queue.c)\n',
  'limits.py': 'MAX_WORKERS = 8.5\nQUEUE_CAP = 8,000\nTIMEOUT = -1\n',
  'config.py': 'RETRY_LIMIT = int(os.getenv("RETRY_LIMIT",5))\nPOLL_INTERVAL = "300s"\n',
  'literals.cfg': '#define QUEUE_SIZE 0x100\nMAX_BYTES = 1e9\nscrape_interval: 1m30s\nmin_version = "1.2.3"\nWINDOW = 2.5e6\n',
  'neg.py': 'RETRY_LIMIT = -5   # attempts before a job is dropped\nJITTER = .5\n',
  'retry.json': '{"retry_delays_ms":[100,250,500],"retry_on":"500,502,503"}\n',
  'metrics.csv': 'minute,workers,queued\n1,8,120\n2,8,450\n',
  'eu.cfg': 'max. 1.000 Jobs, Pause 3,5 Sekunden\n',
  'zh.py': '# 最多重试5次\n# 最大８ワーカー\n# الحد الأقصى ٨ عمال\n',
  'cr.py': '"""Pages the on-call engineer\rwhen the queue is long."""\n\nALERT_THRESHOLD = 500\n',
  'incident.md': 'During the outage the queue held 9000 jobs at 14:05.\n',
  'design/Queue  Notes.md': 'Jobs wait in a queue until a worker is free.\n',
  'x.py\nReview: 3 rounds': 'queue.push(job)\n',
  'README': 'Jobs wait in a queue until a worker is free.\n',
  'CHANGELOG.md': 'Jobs wait in a queue until a worker is free.\n',
  'saved/runbook.txt': 'Jobs wait in a queue until a worker is free.\n',
  'django/middleware/security.py': 'queue.push(job)  # jobs wait here\n',
  'src/history.ts': 'queue.push(job)  // jobs wait here\n',
  'docs/conf.py': 'queue.push(job)  # jobs wait here\n',
  'src/cmd/doc/main.go': 'queue.push(job)  // jobs wait here\n',
  'src/wiki/models.py': 'queue.push(job)  # jobs wait here\n',
  // one number per line, each read once (C4-01)
  'reads.py': [
    '# the queue holds at most 1,500 jobs', '# the queue holds at most 4,096 jobs', '# up to 10,000 jobs per day', 'BACKOFF_FACTOR = 1.500',
    'pool = Pool(3,5)', 'MAX_BYTES = 2.5e6', 'image: runner:v2.5', 'DELAYS = [100,250,500]', 'for i in range(1,100):', 'LEVELS = "1,2,3"',
    '# the queue holds up to 1,500 jobs (about 10,000 a day)',
  ].join('\n'),
  // literals read by value, and written forms with a sign (C4-02)
  'lit2.cfg': ['ERROR_RATE = 1.5e-3', 'MAX = 1E+3', 'MAX = -1e3', 'OFFSET = -0x10', 'MAX = 1000', 'OFFSET = 16', 'scrape_interval: -1m30s', 'min_version = "1.2.30"'].join('\n'),
  'saved/app.min.txt': 'function a(){}\nvar b=1;\nvar cfg={maxWorkers:8,retry:5};\n',
  'src/wiki/templates/wiki/submit.html': '<form hx-post="/jobs/submit">submit a job</form>\n',
  'docs/runbook.txt': 'Jobs wait in a queue until a worker is free.\n',
  'app/views/news.html.erb': '<form hx-post="/jobs/submit">submit a job</form>\n',
  'ar.txt': 'TIMEOUT = 12.5\nالحد ١٬٥٠٠ مهمة\n',
  // lists in code, quoted groupings and prose in brackets, each read the same on the page (C5-01 to C5-03)
  'lists.py': [
    "rows = db.execute('SELECT * FROM jobs WHERE status IN (500,502,503)')", 'frame = cv2.resize(frame, (640,480))', 'x = x.reshape((128,256))',
    'int codes[] = { 500,502,503 };', 'RETRY_ON = (500,502,503)', 'RETRY_ON = [500,502,503]', 'RETRY_DELAYS_MS = [100,250,500]',
    'PLAN_LIMITS = ["1,000", "5,000", "10,000"]  # shown on the pricing page', 'LIMITS = {"pro": "10,000"}', 'SIZES = [', '    100,250,500', ']',
    '# a batch holds (up to 1,500 jobs)', '# the default limit (1,500)', '# overflow costs: (1,500)', 'log("over 1,500 jobs")', '"retry_on": "500,502,503"',
    "raise ValueError('a plan allows 1,000, 5,000 or 10,000 jobs, one of 1,000, 5,000, 10,000')",
    // a quote cut out of a call reads alone as a grouping; the file reads the call's arguments
    'n = clamp(1,500)', 'm = clamp(n,1,500)',
  ].join('\n'),
  // a written value's sign (C5-04)
  'signs.yaml': 'jitter: -1m30s, interval: 1m30s\ninterval: −1m30s\n',
  // a quote lends what the file says where it was found, read in context (C6-01)
  'wrapped.py': 'limit = clamp(n,\n              1,500)\nn = clamp(1,500)  # 1,500 at most\n',
  'q.sql': 'SELECT id FROM jobs\nWHERE status IN (\n    500,502,503\n)\n',
  // a written value is looked for where its quote was found, sign before it included (C6-02)
  'cut.yaml': 'interval: -1m30s\n',
  // a value written as a bracketed list of groupings (C6-03)
  'plans.py': 'PLAN_LIMITS = [1000, 5000, 10000]\n',
  // a comment inside a bracket is prose, and code after it is code again (C7-01)
  'retry.go': 'package retry\n\nfunc Backoff(attempt int) int {\n\t// waits 500, 1,000, 2,000 ms, then gives up\n\treturn delays[attempt]\n}\n',
  'retry_delays.py': 'RETRY_DELAYS_MS = [\n    # back off 1,000, 2,000, 4,000 ms, then give up\n    1000, 2000, 4000,\n]\n',
  'sched.py': 'def schedule(\n    queue,\n    batch=1000,  # one of 1,000, 5,000, 10,000\n):\n    pass\n',
  'config.ts': 'export const config = {\n  // page sizes: 100, 1,000, 10,000, 100,000\n  pageSizes: [100, 1000, 10000, 100000],\n}\n',
  'sizes.c': 'int sizes[] = {\n    // sizes: 500, 1,000, 2,000\n    1, 100,250,500,\n    /* 500, 1,000,\n       2,000 */ 1, 600,700,\n};\n',
  // a document's name decides even with .txt; another .txt goes by its kind (C5-05)
  'HISTORY.txt': 'queue.push(job)  # jobs wait here\n',
  'notes.txt': 'queue.push(job)  # jobs wait here\n',
}

/** Suffix → what reading it gives instead of its text: the engine refused, or it failed. */
type Unreadable = Record<string, { refused: string } | { failed: string }>

function io(unreadable: Unreadable = {}): Io {
  return {
    read: async p => {
      const special = Object.entries(unreadable).find(([suffix]) => p.endsWith(suffix))?.[1]
      if (special) return special
      const k = p.replace('/work/src/', '')
      if (k in EXAMPLE_FILES) return { text: EXAMPLE_FILES[k] }
      if (k in EXTRA) return { text: EXTRA[k] }
      return { failed: 'File does not exist.' }
    },
  }
}

async function run(m: unknown, unreadable: Unreadable = {}) {
  const text = typeof m === 'string' ? m : JSON.stringify(m)
  return (await check(text, MODEL_PATH, io(unreadable))).report
}
const codes = (list: { code: string }[]) => [...new Set(list.map(i => i.code))].sort()

const node = (m: M, id: string) => m.nodes.find(n => n.id === id) as Record<string, unknown>
const flow = (m: M, id: string) => m.flows.find(f => f.id === id) as Record<string, unknown>
const link = (m: M, id: string) => m.links.find(l => l.id === id) as Record<string, unknown>
const loop = (m: M, id: string) => m.loops.find(l => l.id === id) as Record<string, unknown>
const evOf = (m: M, id: string) => node(m, id).evidence as Record<string, unknown>[]

describe('the worked example', () => {
  test('passes with no errors and no warnings', async () => {
    const r = await run(EXAMPLE_MODEL)
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.counts.quotes_verified).toBe(21)
    expect(r.counts.quotes_total).toBe(21)
    expect(r.loops.map(l => `${l.id}:${l.type}`)).toEqual(['R1:R', 'B1:B', 'B2:B', 'B3:B', 'B4:B', 'B5:B', 'B6:B'])
    expect(r.loops.find(l => l.id === 'R1')?.modelled).toBe(true)
    expect(r.loops.find(l => l.id === 'B1')?.modelled).toBe(false)
  })

  test('derives the boundary instead of reading it', async () => {
    const r = await run(EXAMPLE_MODEL)
    expect(r.boundary.exogenous.sort()).toEqual(['alert_threshold', 'max_workers', 'retry_limit', 'submitted'])
    expect(r.boundary.sources_and_sinks.sort()).toEqual(['alerts', 'callers', 'closed', 'done'])
    expect(r.boundary.endogenous.find(x => x.id === 'paged')?.loops).toEqual([])
  })

  test('writes traces from the signs, starting where the author started', async () => {
    const r = await run(EXAMPLE_MODEL)
    expect(r.loops.find(l => l.id === 'B2')?.trace).toBe('more Queued jobs → more dispatched (+) → less Queued jobs (dispatched drains it): balancing')
  })
})

const shadowSelf = (m: M) => {
  m.nodes.push(
    { id: 'pressure', kind: 'aux', figure: 'f1', at: [0.5, 0], label: 'pressure', status: 'modelled', claim: 'c' } as never,
    { id: 'pressure_s', kind: 'shadow', figure: 'f1', at: [1, 0], of: 'pressure' } as never,
  )
  m.links.push(
    { id: 'p_self', from: 'pressure_s', to: 'pressure', polarity: '+', mechanism: 'pressure = pressure * 2', status: 'modelled', claim: 'c' } as never,
    { id: 'p_disp', from: 'pressure', to: 'dispatched', polarity: '+', mechanism: 'm', status: 'modelled', claim: 'c' } as never,
  )
  return m
}

const ERROR_CASES: [string, (m: M) => unknown, string[]][] = [
  ['S00 the file is not JSON', () => '{ "spec": ', ['S00']],
  ['S01 a required field is missing', m => { delete (m as Record<string, unknown>).answer; return m }, ['S01']],
  ['S01 a material delay on a link', m => { link(m, 'seen_page').delay = 'material'; return m }, ['S01']],
  ['S01 "lines" that are not a line or a range', m => { evOf(m, 'max_workers')[0].lines = -3; return m }, ['S01']],
  ['S01 "lines" holding a line break', m => { evOf(m, 'max_workers')[0].lines = '1\n'; return m }, ['S01']],
  ['S01 "lines" holding a line separator', m => { evOf(m, 'max_workers')[0].lines = '1\u2028'; return m }, ['S01']],
  ['S02 one id used twice', m => { flow(m, 'submitted').id = 'queue'; return m }, ['S02']],
  ['S02 ids differ only in case', m => { flow(m, 'submitted').id = 'Queue'; return m }, ['S02']],
  ['S01 a node with no status', m => { delete node(m, 'queue').status; return m }, ['S01']],
  ['S01 a misspelt status is not read as observed', m => { const l = link(m, 'q_dispatch'); delete l.status; l.staus = 'missing'; return m }, ['S01']],
  ['S03 a flow from nowhere', m => { flow(m, 'submitted').from = 'nowhere'; return m }, ['S03']],
  ['N01 a flow out of a constant', m => { flow(m, 'submitted').from = 'max_workers'; return m }, ['N01']],
  ['N02 a stock with no flow', m => { m.nodes.push({ status: 'observed', id: 'orphan', kind: 'stock', figure: 'f1', at: [0, 3], label: 'Orphans', units: 'jobs', evidence: [{ path: 'worker.py', lines: '8', quote: 'queue.push(job)' }] } as never); return m }, ['N02']],
  ['N03 a link into a stock', m => { link(m, 'q_dispatch').to = 'in_flight'; return m }, ['N03']],
  ['N03 a variable reading itself through its own shadow', shadowSelf, ['N03']],
  ['N04 a shadow of a cloud', m => { node(m, 'queue_seen').of = 'callers'; return m }, ['N04']],
  ['N05 a link across figures', m => { link(m, 'threshold_page').from = 'max_workers'; return m }, ['N05']],
  ['N07 a cloud with no reason', m => { delete node(m, 'done').why_outside; return m }, ['N07']],
  ['N08 the same link twice', m => { m.links.push({ ...link(m, 'q_dispatch'), id: 'q_dispatch2' } as never); return m }, ['N08']],
  ['N10 a value on a stock', m => { node(m, 'queue').value = '12'; return m }, ['N10']],
  ['N12 too many elements in one figure', m => {
    for (let i = 0; i < 40; i++) m.nodes.push({ id: `c${i}`, kind: 'constant', figure: 'f1', at: [i % 8, 4 + Math.floor(i / 8)], label: `c${i}`, status: 'modelled', claim: 'c' } as never)
    return m
  }, ['N12']],
  ['E01 observed with no evidence', m => { node(m, 'queue').evidence = []; return m }, ['E01']],
  ['E01 observed backed only by a web address', m => { node(m, 'dead').evidence = [{ url: 'https://example.com/runbook', quote: 'Jobs that fail too often are dropped' }]; return m }, ['E01']],
  ['E02 a quote outside its lines', m => { evOf(m, 'max_workers')[0].lines = '4'; return m }, ['E02']],
  ['E02 a quote not in the file', m => { evOf(m, 'max_workers')[0].quote = 'MAX_WORKERS = 16'; return m }, ['E02']],
  ['E02 a quote that stops inside a word', m => { evOf(m, 'max_workers')[0].quote = 'MAX_WORKER'; return m }, ['E02']],
  ['E02 a quote too short to show anything, though it is there', m => { evOf(m, 'queue')[0].quote = 'job'; return m }, ['E02']],
  ['E02 a quote that cuts a decimal short', m => { Object.assign(evOf(m, 'max_workers')[0], { path: 'limits.py', lines: '1', quote: 'MAX_WORKERS = 8' }); return m }, ['E02']],
  ['E02 a quote that ends on a thousands separator', m => { Object.assign(evOf(m, 'max_workers')[0], { path: 'limits.py', lines: '2', quote: 'QUEUE_CAP = 8,' }); return m }, ['E02']],
  ['E02 a quote that starts after the minus of a negative number', m => { Object.assign(evOf(m, 'retry_limit')[0], { path: 'neg.py', lines: '1', quote: '5   # attempts before a job is dropped' }); return m }, ['E02']],
  ['E05 a path that climbs out of its root', m => { evOf(m, 'max_workers')[0].path = '../secrets.txt'; return m }, ['E05']],
  ['E05 a root that starts with "~"', m => { (m.subject as Record<string, unknown>).roots = { code: '~/src' }; return m }, ['E05']],
  ['S01 a cell past column 100', m => { node(m, 'dead').at = [101, 2.5]; return m }, ['S01']],
  ['E05 a root named like a built-in property', m => { evOf(m, 'max_workers')[0].root = 'constructor'; return m }, ['E05']],
  // a path is kept as written, so a line break in it must not reach the reader view, even when such a file exists
  ['E05 a path with a line break', m => { (node(m, 'queue').evidence as unknown[]).push({ path: 'x.py\nReview: 3 rounds', lines: '1', quote: 'queue.push(job)' }); return m }, ['E05']],
  // every line break the renderer could print: \r, \n, \v, \f, U+0085, U+2028, U+2029, in a path and in a root's name
  ...['\r', '\n', '\v', '\f', '\u0085', '\u2028', '\u2029'].flatMap((br): [string, (m: M) => unknown, string[]][] => [
    [`E05 a path with U+${br.charCodeAt(0).toString(16).padStart(4, '0')}`, m => { (node(m, 'queue').evidence as unknown[]).push({ path: `x.py${br}Review: 3 rounds`, lines: '1', quote: 'queue.push(job)' }); return m }, ['E05']],
    [`E05 a root name with U+${br.charCodeAt(0).toString(16).padStart(4, '0')}`, m => { (m.subject as Record<string, unknown>).roots = { code: './src', [`code${br}Review: 3 rounds`]: './src' }; (node(m, 'queue').evidence as unknown[]).push({ root: `code${br}Review: 3 rounds`, path: 'worker.py', lines: '8', quote: 'queue.push(job)' }); return m }, ['E05']],
  ]),
  ['L01 a loop with no stock', m => {
    m.nodes.push({ id: 'pressure', kind: 'aux', figure: 'f1', at: [0.5, 0], label: 'pressure', status: 'modelled', claim: 'c' } as never, { id: 'urgency', kind: 'aux', figure: 'f1', at: [1, 0], label: 'urgency', status: 'modelled', claim: 'c' } as never)
    m.links.push({ id: 'p_u', from: 'pressure', to: 'urgency', polarity: '+', mechanism: 'm', status: 'modelled', claim: 'c' } as never, { id: 'u_p', from: 'urgency', to: 'pressure', polarity: '+', mechanism: 'm', status: 'modelled', claim: 'c' } as never)
    return m
  }, ['L01', 'L02']],
  ['L02 an undeclared loop', m => { m.loops = m.loops.filter(l => l.id !== 'B3'); return m }, ['L02']],
  // B3's own cycle is then undeclared, so L02 fires too
  ['L03 a declared path that is not a loop', m => { loop(m, 'B3').path = ['queue', 'in_flight']; return m }, ['L02', 'L03']],
  ['L03 a loop through an intended part', m => { Object.assign(link(m, 'busy_done'), { status: 'intended' }); return m }, ['L03']],
  ['L04 an R named B', m => { loop(m, 'B3').id = 'R3'; return m }, ['L04']],
  ['L04 a lower-case id', m => { loop(m, 'B3').id = 'b3'; return m }, ['L04']],
  ['L04 an id that is not R<n> or B<n>', m => { loop(m, 'R1').id = 'B1a'; m.answer.loops = ['B1a', 'B1', 'B2']; return m }, ['L04']],
  ['L05 a loop across figures', m => {
    m.nodes.push({ id: 'pages_seen', kind: 'shadow', figure: 'f1', at: [1, 0], of: 'pages' } as never)
    m.links.push({ id: 'pages_slow', from: 'pages_seen', to: 'dispatched', polarity: '-', mechanism: 'm', status: 'modelled', claim: 'c' } as never)
    return m
  }, ['L02', 'L05']],
  ['L09 "minor" on a loop that is not a routine drain', m => { m.answer.loops = ['R1', 'B2']; loop(m, 'B1').minor = true; return m }, ['L09']],
  ['U01 units that do not match', m => { flow(m, 'dispatched').units = 'jobs/hour'; return m }, ['U01']],
  ['P01 an answer citing no loop', m => { m.answer.loops = ['R9']; return m }, ['P01']],
  ['P01 an answer citing a routine loop', m => { m.answer.loops = ['R1', 'B1', 'B2', 'B3']; return m }, ['P01']],
  ['P02 data with no evidence', m => { (m as Record<string, unknown>).reference_modes = [{ variable: 'queue', pattern: 'grows after an outage', basis: 'data', evidence: [] }]; return m }, ['P02']],
  ['P02 a suspected behaviour with no one suspecting it', m => { (m as Record<string, unknown>).reference_modes = [{ variable: 'queue', pattern: 'grows after an outage', basis: 'hypothesised' }]; return m }, ['P02']],
  ['P03 a highlight with no rule', m => { node(m, 'queue').emphasis = 'it matters'; return m }, ['P03']],
  ['P03 a highlight on a cloud', m => { (m as Record<string, unknown>).emphasis = { name: 'Defect', rule: 'a review found a defect' }; node(m, 'done').emphasis = 'x'; return m }, ['P03']],
]

describe('each rule refuses its own case', () => {
  for (const [name, patch, expected] of ERROR_CASES) {
    test(name, async () => {
      const r = await run(patch(clone()))
      expect(codes(r.errors)).toEqual(expected)
    })
  }
  test('E07 a file the engine refused to read, in its own words', async () => {
    const r = await run(clone(), { 'alerting.py': { refused: "Claude requested permissions to read from alerting.py, but you haven't granted it yet." } })
    expect(codes(r.errors)).toEqual(['E07'])
    expect(r.errors[0].message).toContain("you haven't granted it yet")
  })
  test('E02 a file that could not be read, in the engine\'s own words', async () => {
    const r = await run(clone(), { 'alerting.py': { failed: 'File is in a directory that is denied by your permission settings.' } })
    expect(codes(r.errors)).toEqual(['E02'])
    expect(r.errors[0].message).toContain('denied by your permission settings')
  })
  test('E05 a "~" root that no quote uses is refused where it is declared', async () => {
    const m = clone()
    ;(m.subject as Record<string, unknown>).roots = { code: './src', notes: '~/notes' }
    const r = await run(m)
    expect(r.errors.map(i => `${i.code} ${i.where}`)).toEqual(['E05 subject.roots.notes'])
  })
  test('a parse error does not echo the file', async () => {
    const r = await run('{ "title": "SECRET-TOKEN-123')
    expect(codes(r.errors)).toEqual(['S00'])
    expect(JSON.stringify(r)).not.toContain('SECRET-TOKEN')
  })
})

const pagesThroughLog = (m: M) => {
  // pages reach their own drain only through another stock: no information path from the stock
  m.links = m.links.filter(l => l.id !== 'pages_resolve')
  m.nodes.push(
    { status: 'modelled', id: 'log', kind: 'stock', figure: 'f2', at: [3.5, 2.4], label: 'Logged pages', units: 'pages', claim: 'c' } as never,
    { id: 'logsrc', kind: 'cloud', figure: 'f2', at: [2.5, 2.4], why_outside: 'the logger' } as never,
  )
  m.flows.push({ status: 'modelled', id: 'logged', from: 'logsrc', to: 'log', label: 'logged', units: 'pages/minute', claim: 'c' } as never)
  m.links.push(
    { status: 'modelled', id: 'pages_log', from: 'pages', to: 'logged', polarity: '+', mechanism: 'm', claim: 'c' } as never,
    { status: 'modelled', id: 'log_resolve', from: 'log', to: 'resolved', polarity: '+', mechanism: 'm', claim: 'c' } as never,
  )
  m.loops = m.loops.filter(l => l.id !== 'B6')
  m.loops.push({ id: 'B6', name: 'Logged pages get closed', path: ['pages', 'logged', 'log', 'resolved'], story: 'More open pages → more logged → more closed → fewer open pages.' } as never)
  return m
}

const WARNING_CASES: [string, (m: M) => unknown, string][] = [
  ['S05 an unknown field', m => { node(m, 'queue').colour = 'blue'; return m }, 'S05'],
  ['S05 a misspelt field, with the likely one named', m => { link(m, 'seen_page').dealy = true; return m }, 'S05'],
  ['S06 a date that is not YYYY-MM-DD', m => { (m.subject as Record<string, unknown>).date = 'last Tuesday'; return m }, 'S06'],
  ['E02 a whole-file range around a short quote', m => { evOf(m, 'max_workers')[0].lines = '1-28'; return m }, 'E02'],
  ['E03 a web source', m => { (link(m, 'q_dispatch').evidence as unknown[]).push({ url: 'https://example.com', quote: 'a batch is bounded' }); return m }, 'E03'],
  ['E04 a number with no source in a label', m => { node(m, 'max_workers').label = 'max 9 workers'; return m }, 'E04'],
  ['E04 a modelled value its claim does not give', m => { Object.assign(node(m, 'retry_limit'), { status: 'modelled', claim: 'assumed', value: '7' }); return m }, 'E04'],
  ['E04 a number in the short answer', m => { m.answer.text += ' Up to 40 jobs wait.'; return m }, 'E04'],
  ['E04 a number in a loop story', m => { loop(m, 'R1').story += ' About 7% of jobs fail.'; return m }, 'E04'],
  ['E04 a number in a mechanism', m => { link(m, 'q_dispatch').mechanism = 'a batch is at most 64 jobs'; return m }, 'E04'],
  ['E04 a decimal point is not a thousands separator', m => { node(m, 'max_workers').label = 'max 0.8 workers'; return m }, 'E04'],
  ['E04 a number with a unit glued on', m => { link(m, 'seen_page').label = 'polled every 900s'; return m }, 'E04'],
  ['E04 a sign is part of the number', m => { Object.assign(node(m, 'retry_limit'), { value: '1', evidence: [{ path: 'limits.py', lines: '3', quote: 'TIMEOUT = -1' }] }); return m }, 'E04'],
  ['E04 a number in an observed element\'s claim', m => { node(m, 'queue').claim = 'about 40% of jobs fail on their first attempt'; return m }, 'E04'],
  ['E04 a number only in a suspected behaviour\'s reason is not a source for the answer', m => {
    ;(m as Record<string, unknown>).reference_modes = [{ variable: 'queue', pattern: 'grows during outages', basis: 'hypothesised', why: 'the team saw 9000 jobs queued in the last outage' }]
    m.answer.text += ' The queue reached 9000 jobs.'
    return m
  }, 'E04'],
  ['E04 a number in a caption', m => { (m.figures[0] as Record<string, unknown>).caption = 'At most 64 jobs run at once.'; return m }, 'E04'],
  ['E04 a number in a note', m => { (m as Record<string, unknown>).notes = ['Built from 12 files.']; return m }, 'E04'],
  ['E04 a number in a cloud\'s reason', m => { node(m, 'callers').why_outside = 'about 30 callers submit jobs'; return m }, 'E04'],
  ['E04 a number in a detail', m => { node(m, 'queue').detail = 'holds up to 4096 jobs'; return m }, 'E04'],
  ['E04 a number in an emphasis note', m => { (m as Record<string, unknown>).emphasis = { name: 'Defect', rule: 'a review found a defect' }; node(m, 'queue').emphasis = 'found in 3 incidents'; return m }, 'E04'],
  ['E04 a number in what is left out', m => { m.boundary.excluded[0].name = 'the 3 legacy cron jobs'; return m }, 'E04'],
  ['E04 a number in a loop story that none of its elements gives', m => { loop(m, 'B6').story = 'More open pages → 8 more closed → fewer open pages.'; loop(m, 'B6').minor = false; return m }, 'E04'],
  ['E06 observed code backed only by docs (by its kind)', m => { evOf(m, 'queue')[0].kind = 'doc'; return m }, 'E06'],
  ['E06 observed code backed only by docs (by the file type)', m => { node(m, 'queue').evidence = [{ path: 'README.md', lines: '1', quote: 'Jobs wait in a queue' }]; return m }, 'E06'],
  ['E06 a document labelled code is still a document', m => { node(m, 'queue').evidence = [{ path: 'README.md', lines: '1', quote: 'Jobs wait in a queue', kind: 'code' }]; return m }, 'E06'],
  ['E06 an .mdx design note is a document', m => { flow(m, 'requeued').evidence = [{ path: 'docs/design.mdx', lines: '1', quote: 'Failed jobs are requeued' }]; return m }, 'E06'],
  ['L01 a loop that would exist if built has no stock', m => {
    m.nodes.push({ status: 'intended', id: 'target', kind: 'aux', figure: 'f1', at: [0.5, 3], label: 'target batch', claim: 'specified' } as never, { status: 'intended', id: 'backoff', kind: 'aux', figure: 'f1', at: [1.5, 3], label: 'backoff', claim: 'specified' } as never)
    m.links.push(
      { status: 'intended', id: 't_b', from: 'target', to: 'backoff', polarity: '+', mechanism: 'm', claim: 'specified' } as never,
      { status: 'intended', id: 'b_t', from: 'backoff', to: 'target', polarity: '+', mechanism: 'm', claim: 'specified' } as never,
      { status: 'intended', id: 't_d', from: 'target', to: 'dispatched', polarity: '+', mechanism: 'm', claim: 'specified' } as never,
    )
    return m
  }, 'L01'],
  ['T02 more than three figures', m => { for (const id of ['f3', 'f4']) m.figures.push({ id, title: `Figure ${id}`, question: 'q' } as never); return m }, 'T02'],
  ['L06 a goal that looks like a misspelt id', m => { loop(m, 'B1').goal = 'max_wrokers'; return m }, 'L06'],
  ['X01 nothing stops a drain', m => { m.links = m.links.filter(l => l.id !== 'busy_done'); m.loops = m.loops.filter(l => l.id !== 'B3'); return m }, 'X01'],
  ['X01 a drain reached only through another stock', pagesThroughLog, 'X01'],
  ['X01 a drain reached only through net − links', m => {
    m.links = m.links.filter(l => l.id !== 'pages_resolve')
    m.nodes.push({ id: 'pressure', kind: 'aux', figure: 'f2', at: [3.5, 0.3], label: 'page pressure', status: 'modelled', claim: 'c' } as never)
    m.links.push(
      { id: 'pages_pressure', from: 'pages', to: 'pressure', polarity: '+', mechanism: 'm', status: 'modelled', claim: 'c' } as never,
      { id: 'pressure_resolve', from: 'pressure', to: 'resolved', polarity: '-', mechanism: 'm', status: 'modelled', claim: 'c' } as never,
    )
    m.loops = m.loops.filter(l => l.id !== 'B6')
    m.loops.push({ id: 'R7', name: 'Pressure slows closing', path: ['pages', 'pressure', 'resolved'], story: 'More open pages → more pressure → fewer closed → more open pages.' } as never)
    return m
  }, 'X01'],
  ['X02 a stock signed − into its own drain', m => { link(m, 'busy_done').polarity = '-'; Object.assign(loop(m, 'B3'), { id: 'R3', minor: false, story: 'More jobs in flight → fewer completed → more jobs in flight.' }); return m }, 'X02'],
  ['X03 a delay on a loop', m => { link(m, 'q_dispatch').delay = true; return m }, 'X03'],
  ['C01 one cloud for two flows', m => { flow(m, 'completed').to = 'callers'; return m }, 'C01'],
  ['B01 a constant that affects nothing', m => { m.nodes.push({ status: 'observed', id: 'unused', kind: 'constant', figure: 'f1', at: [0, 3], label: 'unused', value: '3', evidence: [{ path: 'worker.py', lines: '3', quote: 'MAX_WORKERS' }] } as never); return m }, 'B01'],
  ['T01 a long title', m => { m.title = 'The Dynamics Of A Small Job Runner'; return m }, 'T01'],
  ['E04 a number only in a web quote, which the check cannot verify', m => { (node(m, 'queue').evidence as unknown[]).push({ url: 'https://example.com/status', quote: 'the queue holds up to 4096 jobs' }); node(m, 'queue').detail = 'holds up to 4096 jobs'; return m }, 'E04'],
  ['E04 a number in a cloud\'s label', m => { node(m, 'callers').label = 'about 3000 API callers'; return m }, 'E04'],
  ['E04 a number in the highlight\'s name', m => { (m as Record<string, unknown>).emphasis = { name: 'Top 3 risks', rule: 'a review found a defect' }; node(m, 'queue').emphasis = 'unbounded'; return m }, 'E04'],
  ['E04 a number in Chinese prose', m => { node(m, 'queue').detail = '队列最多可容纳4096个任务'; return m }, 'E04'],
  ['E04 a fullwidth digit in a Japanese label', m => { node(m, 'max_workers').label = '最大９ワーカー'; return m }, 'E04'],
  ['E04 an Arabic-Indic digit', m => { node(m, 'max_workers').label = 'max ٩ workers'; return m }, 'E04'],
  ['E04 a data pattern\'s number only in its "why", which the page does not print', m => { (m as Record<string, unknown>).reference_modes = [{ variable: 'queue', pattern: 'climbed to 9000 jobs during the outage', basis: 'data', why: 'the dashboard showed 9000', evidence: [{ path: 'alerting.py', lines: '3', quote: 'ALERT_THRESHOLD = 500' }] }]; return m }, 'E04'],
  ['E04 a data pattern\'s number only in its variable\'s claim', m => {
    flow(m, 'resolved').claim = 'on-call closes about 12 pages an hour; how is outside the code'
    ;(m as Record<string, unknown>).reference_modes = [{ variable: 'resolved', pattern: 'falls to 12 an hour at night', basis: 'data', evidence: [{ path: 'alerting.py', lines: '4', quote: 'POLL_SECONDS = 300' }] }]
    return m
  }, 'E04'],
  ['E04 a data pattern\'s number only in another element\'s quote', m => { (m as Record<string, unknown>).reference_modes = [{ variable: 'queue', pattern: 'stays under 500 jobs', basis: 'data', evidence: [{ path: 'worker.py', lines: '3', quote: 'MAX_WORKERS = 8' }] }]; return m }, 'E04'],
  ...([['1', 'QUEUE_SIZE 0x100', '0x200'], ['2', 'MAX_BYTES = 1e9', '1e8'], ['3', 'scrape_interval: 1m30s', '2m45s'], ['4', 'min_version = "1.2.3"', '1.2.9'], ['5', 'WINDOW = 2.5e6', '7.5e6']] as const).map(([lines, quote, value]): [string, (m: M) => unknown, string] =>
    [`E04 a value its quote does not give, written as ${value}`, m => { Object.assign(node(m, 'max_workers'), { value, evidence: [{ path: 'literals.cfg', lines, quote }] }); return m }, 'E04']),
  ['E06 a saved extract of a web page is a document', m => { for (const x of [node(m, 'dead'), flow(m, 'dropped')]) x.evidence = [{ path: 'saved/runbook.txt', lines: '1', quote: 'Jobs wait in a queue', from: 'https://wiki.example.com/runbook (curl | html2text)' }]; return m }, 'E06'],
  ['E06 a README with no extension is a document', m => { node(m, 'queue').evidence = [{ path: 'README', lines: '1', quote: 'Jobs wait in a queue' }]; return m }, 'E06'],
  ['E06 a CHANGELOG.md is a document', m => { node(m, 'queue').evidence = [{ path: 'CHANGELOG.md', lines: '1', quote: 'Jobs wait in a queue' }]; return m }, 'E06'],
  ['E04 a leading-dot decimal is not a whole number', m => { (node(m, 'queue').evidence as unknown[]).push({ path: 'neg.py', lines: '2', quote: 'JITTER = .5' }); node(m, 'queue').detail = 'waits up to 5 seconds'; return m }, 'E04'],
  ['E06 a .txt under docs/, with no kind, is a document', m => { node(m, 'queue').evidence = [{ path: 'docs/runbook.txt', lines: '1', quote: 'Jobs wait in a queue' }]; return m }, 'E06'],
  ['E06 a document\'s name decides even with .txt, whatever kind says (HISTORY.txt, config)', m => { flow(m, 'submitted').evidence = [{ path: 'HISTORY.txt', lines: '1', quote: 'queue.push(job)', kind: 'config' }]; return m }, 'E06'],
]

describe('warnings', () => {
  for (const [name, patch, code] of WARNING_CASES) {
    test(name, async () => {
      const r = await run(patch(clone()))
      expect(codes(r.errors)).toEqual([])
      expect(codes(r.warnings)).toContain(code)
    })
  }
  const MUST_PASS: [string, (m: M) => unknown][] = [
    ['"lines" as a number', m => { evOf(m, 'max_workers')[0].lines = 3; return m }],
    ['a singular stock with a plural flow ("job", "jobs/minute")', m => { node(m, 'queue').units = 'job'; return m }],
    ['plurals made with -s on a word ending in -e ("case", "cases/minute")', m => { node(m, 'pages').units = 'case'; flow(m, 'paged').units = 'cases/minute'; flow(m, 'resolved').units = 'cases per minute'; return m }],
    ['a modelled value given in its claim', m => { Object.assign(node(m, 'retry_limit'), { status: 'modelled', claim: 'assumed to be 7 attempts', value: '7' }); return m }],
    ['a number after a comma in code ("RETRY_LIMIT",5)', m => { Object.assign(node(m, 'retry_limit'), { evidence: [{ path: 'config.py', lines: '1', quote: 'int(os.getenv("RETRY_LIMIT",5))' }] }); return m }],
    ['a number with a unit glued on, in the source ("300s")', m => { Object.assign(link(m, 'seen_page'), { evidence: [{ path: 'config.py', lines: '2', quote: 'POLL_INTERVAL = "300s"' }, { path: 'alerting.py', lines: '8', quote: 'if len(queue) > ALERT_THRESHOLD:' }] }); return m }],
    ['an ISO date in a note', m => { (m as Record<string, unknown>).notes = ['Sources read on 2026-10-22.']; return m }],
    ['a guard that is documented but not built stops X01', m => { Object.assign(link(m, 'busy_done'), { status: 'intended', claim: 'DESIGN.md asks for it' }); m.loops = m.loops.filter(l => l.id !== 'B3'); return m }],
    ['an .html template is not a document', m => { flow(m, 'submitted').evidence = [{ path: 'templates/submit.html', lines: '1', quote: 'hx-post="/jobs/submit"' }]; return m }],
    ['CMakeLists.txt is not a document', m => { node(m, 'queue').evidence = [{ path: 'CMakeLists.txt', lines: '1', quote: 'add_executable(job_runner worker.c queue.c)' }]; return m }],
    ...['django/middleware/security.py', 'src/history.ts', 'docs/conf.py', 'src/cmd/doc/main.go', 'src/wiki/models.py'].map((path): [string, (m: M) => unknown] =>
      [`code is code wherever it lives and whatever it is called (${path})`, m => { node(m, 'queue').evidence = [{ path, lines: '1', quote: 'queue.push(job)', kind: 'code' }]; return m }]),
    ['a file name with two spaces is cited as written', m => { (node(m, 'queue').evidence as unknown[]).push({ path: 'design/Queue  Notes.md', lines: '1', quote: 'Jobs wait in a queue' }); return m }],
    ['a two-letter unit with its plural ("PR", "PRs/minute")', m => { for (const id of ['queue', 'in_flight', 'dead']) node(m, id).units = 'PR'; for (const f of m.flows) if (f.units === 'jobs/minute') flow(m, f.id).units = 'PRs/minute'; return m }],
    ['a two-letter unit with its plural ("VMs", "VM/minute")', m => { for (const id of ['queue', 'in_flight', 'dead']) node(m, id).units = 'VMs'; for (const f of m.flows) if (f.units === 'jobs/minute') flow(m, f.id).units = 'VM/minute'; return m }],
    ['a guard recorded as intended through a variable stops X01', m => {
      m.links = m.links.filter(l => l.id !== 'pages_resolve')
      m.loops = m.loops.filter(l => l.id !== 'B6')
      m.nodes.push({ status: 'intended', id: 'worklist', kind: 'aux', figure: 'f2', at: [3.5, 0.3], label: 'pages to work', claim: 'the runbook says on-call keeps a list of open pages' } as never)
      m.links.push(
        { status: 'intended', id: 'pages_list', from: 'pages', to: 'worklist', polarity: '+', mechanism: 'the list holds every open page', claim: 'runbook' } as never,
        { status: 'intended', id: 'list_resolve', from: 'worklist', to: 'resolved', polarity: '+', mechanism: 'on-call closes pages from the list', claim: 'runbook' } as never,
      )
      return m
    }],
    ['a guard with a missing first hop and a modelled second stops X01', m => {
      m.links = m.links.filter(l => l.id !== 'pages_resolve')
      m.loops = m.loops.filter(l => l.id !== 'B6')
      m.nodes.push({ status: 'modelled', id: 'worklist', kind: 'aux', figure: 'f2', at: [3.5, 0.3], label: 'pages to work', claim: 'on-call keeps a list' } as never)
      m.links.push(
        { status: 'missing', id: 'pages_list', from: 'pages', to: 'worklist', polarity: '+', mechanism: 'nothing fills the list from the open pages', claim: 'no code reads the open pages' } as never,
        { status: 'modelled', id: 'list_resolve', from: 'worklist', to: 'resolved', polarity: '+', mechanism: 'on-call closes pages from the list', claim: 'how on-call works' } as never,
      )
      return m
    }],
    ['a suspected pattern\'s number given in its printed "why"', m => { (m as Record<string, unknown>).reference_modes = [{ variable: 'queue', pattern: 'climbed to 9000 jobs during the outage', basis: 'hypothesised', why: 'the team saw 9000 jobs queued in the last outage' }]; return m }],
    ['the answer cites a number from a data pattern\'s checked quote', m => {
      ;(m as Record<string, unknown>).reference_modes = [{ variable: 'queue', pattern: 'climbed to 9000 jobs during the outage', basis: 'data', evidence: [{ path: 'incident.md', lines: '1', quote: 'the queue held 9000 jobs at 14:05' }] }]
      m.answer.text += ' In the last outage the queue held 9000 jobs.'
      return m
    }],
    ['a value written as hex, scientific notation, a compound duration or a version, as its source writes it', m => {
      Object.assign(node(m, 'max_workers'), { value: '0x100', evidence: [{ path: 'literals.cfg', lines: '1', quote: 'QUEUE_SIZE 0x100' }] })
      Object.assign(node(m, 'retry_limit'), { value: '1.2.3', evidence: [{ path: 'literals.cfg', lines: '4', quote: 'min_version = "1.2.3"' }] })
      Object.assign(node(m, 'alert_threshold'), { value: '1m30s', evidence: [{ path: 'literals.cfg', lines: '3', quote: 'scrape_interval: 1m30s' }] })
      return m
    }],
    ['a list in code or data without spaces gives each of its numbers', m => {
      Object.assign(node(m, 'queue'), { detail: 'waits 100, 250, then 500 ms', evidence: [...evOf(m, 'queue'), { path: 'retry.json', lines: '1', quote: '{"retry_delays_ms":[100,250,500],"retry_on":"500,502,503"}' }] })
      ;(m as Record<string, unknown>).reference_modes = [{ variable: 'queue', pattern: 'grew from 120 to 450 queued jobs while 8 workers ran', basis: 'data', evidence: [{ path: 'metrics.csv', lines: '2-3', quote: '1,8,120 2,8,450' }] }]
      return m
    }],
    ['a leading-dot decimal in a source', m => {
      Object.assign(node(m, 'queue'), { detail: 'jitter 0.5', evidence: [...evOf(m, 'queue'), { path: 'neg.py', lines: '2', quote: 'JITTER = .5' }] })
      return m
    }],
    // a comma run that cannot be a grouping, or that is an item of a list in code, gives its parts; a grouping elsewhere is its whole
    ...([['8', 'DELAYS = [100,250,500]', 'waits 100, 250, then 500 ms'], ['9', 'for i in range(1,100):', 'from 1 to 100'], ['10', 'LEVELS = "1,2,3"', 'levels 1, 2 and 3'],
      ['1', '# the queue holds at most 1,500 jobs', 'holds at most 1500 jobs'], ['11', '# the queue holds up to 1,500 jobs (about 10,000 a day)', 'about 10000 a day'],
      ['6', 'MAX_BYTES = 2.5e6', 'at most 2500000 bytes']] as const).map(([lines, quote, detail]): [string, (m: M) => unknown] =>
      [`"${detail}" from "${quote}"`, m => { Object.assign(node(m, 'queue'), { detail, evidence: [...evOf(m, 'queue'), { path: 'reads.py', lines, quote }] }); return m }]),
    // a list in code gives its items wherever it stands, and a quoted grouping is one number (C5-01, C5-03)
    ...([['1', 'WHERE status IN (500,502,503)', 'Jobs that failed with 502 are retried.'], ['2', 'cv2.resize(frame, (640,480))', 'Frames are scaled to 640 by 480.'],
      ['3', 'x.reshape((128,256))', 'A batch is a 128 by 256 matrix.'], ['4', 'int codes[] = { 500,502,503 };', 'Retries on 502.'], ['5', 'RETRY_ON = (500,502,503)', 'Retries on 502.'],
      ['10-12', 'SIZES = [\n    100,250,500\n]', 'Sizes are 100, 250 and 500.'],
      ['8', 'PLAN_LIMITS = ["1,000", "5,000", "10,000"]', 'Plans allow 1,000, 5,000 or 10,000 queued jobs.']] as const).map(([lines, quote, detail]): [string, (m: M) => unknown] =>
      [`"${detail}" from "${quote}"`, m => { Object.assign(link(m, 'q_dispatch'), { detail, evidence: [{ path: 'lists.py', lines, quote }] }); return m }]),
    // a page that copies its cited code is read as the code is (C5-02)
    ['a detail that repeats a list in code', m => { Object.assign(link(m, 'q_dispatch'), { detail: 'A failed batch is retried after RETRY_DELAYS_MS = [100,250,500] milliseconds.', evidence: [{ path: 'lists.py', lines: '7', quote: 'RETRY_DELAYS_MS = [100,250,500]' }] }); return m }],
    ['a detail that repeats a padded list wrapped over lines (the model\'s line breaks are read as spaces)', m => { Object.assign(link(m, 'q_dispatch'), { detail: 'SIZES = [\n  100,250,500\n]', evidence: [{ path: 'lists.py', lines: '10-12', quote: 'SIZES = [ 100,250,500 ]' }] }); return m }],
    ...([['[500,502,503]', '6', 'RETRY_ON = [500,502,503]'], ['10,000', '9', 'LIMITS = {"pro": "10,000"}'], ['[100,250,500]', '7', 'RETRY_DELAYS_MS = [100,250,500]']] as const).map(([value, lines, quote]): [string, (m: M) => unknown] =>
      [`a value "${value}" copied from "${quote}"`, m => { Object.assign(node(m, 'max_workers'), { value, evidence: [{ path: 'lists.py', lines, quote }] }); return m }]),
    // a written value passes on any occurrence that carries its sign, not only the first (C5-04)
    ['a written value whose first occurrence is negated and whose second is not', m => { Object.assign(node(m, 'max_workers'), { value: '1m30s', evidence: [{ path: 'signs.yaml', lines: '1', quote: 'jitter: -1m30s, interval: 1m30s' }] }); return m }],
    ['a .txt not named like a document, declared config, is not a document', m => { flow(m, 'submitted').evidence = [{ path: 'notes.txt', lines: '1', quote: 'queue.push(job)', kind: 'config' }]; return m }],
    ['a value in hex or scientific notation matches the same value written plainly', m => {
      Object.assign(node(m, 'max_workers'), { value: '1e3', evidence: [{ path: 'lit2.cfg', lines: '5', quote: 'MAX = 1000' }] })
      Object.assign(node(m, 'retry_limit'), { value: '0x10', evidence: [{ path: 'lit2.cfg', lines: '6', quote: 'OFFSET = 16' }] })
      return m
    }],
    ['a .txt extract of minified code, declared code, is code', m => { node(m, 'max_workers').evidence = [{ path: 'saved/app.min.txt', lines: '3', quote: 'maxWorkers:8', kind: 'code', from: 'dist/app.min.js (fold -w 100 dist/app.min.js)' }]; return m }],
    ['a template named like a document, with an extension no document has, is code (news.html.erb)', m => { flow(m, 'submitted').evidence = [{ path: 'app/views/news.html.erb', lines: '1', quote: 'hx-post="/jobs/submit"' }]; return m }],
    ['an .html template under a wiki folder, declared code, is code', m => { flow(m, 'submitted').evidence = [{ path: 'src/wiki/templates/wiki/submit.html', lines: '1', quote: 'hx-post="/jobs/submit"', kind: 'code' }]; return m }],
    ['an Arabic decimal separator: "١٢٫٥" is 12.5', m => { Object.assign(node(m, 'max_workers'), { detail: 'ينتظر ١٢٫٥ ثانية', evidence: [...evOf(m, 'max_workers'), { path: 'ar.txt', lines: '1', quote: 'TIMEOUT = 12.5' }] }); return m }],
    ['a loop story\'s number from its goal\'s quote', m => { Object.assign(loop(m, 'B6'), { minor: false, goal: 'alert_threshold', story: 'More open pages → more closed → fewer open pages, paged above 500 queued jobs.' }); return m }],
    ['an answer\'s number from the claim of a part that is not observed', m => {
      flow(m, 'resolved').claim = 'on-call engineers close about 12 pages an hour; how is outside the code'
      m.answer.text += ' On-call closes about 12 pages an hour.'
      return m
    }],
    ['a + guard recorded as missing answers X01, beside a net − path that is built', m => {
      m.links = m.links.filter(l => l.id !== 'pages_resolve')
      m.loops = m.loops.filter(l => l.id !== 'B6')
      m.nodes.push({ id: 'pressure', kind: 'aux', figure: 'f2', at: [3.5, 0.3], label: 'page pressure', status: 'modelled', claim: 'c' } as never)
      m.links.push(
        { id: 'pages_pressure', from: 'pages', to: 'pressure', polarity: '+', mechanism: 'm', status: 'modelled', claim: 'c' } as never,
        { id: 'pressure_resolve', from: 'pressure', to: 'resolved', polarity: '-', mechanism: 'm', status: 'modelled', claim: 'c' } as never,
        { id: 'pages_guard', from: 'pages', to: 'resolved', polarity: '+', mechanism: 'nothing stops closing at zero open pages', status: 'missing', claim: 'no code stops resolving when no page is open' } as never,
      )
      m.loops.push({ id: 'R7', name: 'Pressure slows closing', path: ['pages', 'pressure', 'resolved'], story: 'More open pages → more pressure → fewer closed → more open pages.' } as never)
      return m
    }],
    ['a number in Chinese, Japanese (fullwidth) or Arabic-Indic digits in a source', m => {
      Object.assign(node(m, 'retry_limit'), { evidence: [{ path: 'zh.py', lines: '1', quote: '最多重试5次' }] })
      Object.assign(node(m, 'max_workers'), { label: '最大８ワーカー', evidence: [{ path: 'zh.py', lines: '2', quote: '最大８ワーカー' }, { path: 'zh.py', lines: '3', quote: 'الحد الأقصى ٨ عمال' }] })
      node(m, 'queue').detail = 'up to 8 jobs run at once (max_workers)'
      ;(node(m, 'queue').evidence as unknown[]).push({ path: 'zh.py', lines: '3', quote: 'الحد الأقصى ٨ عمال' })
      return m
    }],
    ['a sourced number in Chinese prose', m => { node(m, 'max_workers').detail = '最多同时运行8个任务'; return m }],
    ['a lone CR stays inside its line, as the Read tool numbers lines', m => { Object.assign(evOf(m, 'alert_threshold')[0], { path: 'cr.py', lines: '3', quote: 'ALERT_THRESHOLD = 500' }); (node(m, 'pages').evidence as unknown[]).push({ path: 'cr.py', lines: '1', quote: 'Pages the on-call engineer when the queue is long' }); return m }],
  ]
  for (const [name, patch] of MUST_PASS) {
    test(`passes: ${name}`, async () => {
      const r = await run(patch(clone()))
      expect(r.errors).toEqual([])
      expect(r.warnings.filter(i => !(i.code === 'E01' && /should cite/.test(i.message)))).toEqual([])
    })
  }
  test('"lines": null is no lines: the quote is looked for in the whole file', async () => {
    const m = clone()
    evOf(m, 'max_workers')[0].lines = null
    const r = await run(m)
    expect(r.errors).toEqual([])
    expect(r.warnings.map(i => i.message)).toEqual(['quote found at line 3; add "lines": "3".'])
  })
  test('numbers in the title, question and horizon are the modeller\'s framing, not checked', async () => {
    const m = clone()
    m.title = 'Job Runner 2026'
    m.question = 'Why does the queue pass 900 jobs?'
    m.horizon = 'the next 6 hours'
    const r = await run(m)
    expect(r.warnings).toEqual([])
  })
  test('a loop closed only by an intended link is listed as designed, not live', async () => {
    const m = clone()
    m.links.push({ id: 'pages_slow', from: 'queue_seen', to: 'resolved', polarity: '+', mechanism: 'm', status: 'intended', claim: 'docs say on-call drains faster when the queue is long' } as never)
    const r = await run(m)
    expect(r.errors).toEqual([])
    expect(r.loops.length).toBe(7)
  })
  test('designed loops are all counted, and the page says how many are not listed', async () => {
    const m = clone()
    // six "a" rules each feeding six "b" rules: 36 loops of in_flight → a → b → dispatched, none built
    const names = ['one', 'two', 'three', 'four', 'five', 'six']
    for (const [i, n] of names.entries()) {
      m.nodes.push({ id: `ra${i}`, kind: 'aux', figure: 'f1', at: [i, 4], label: `rule a ${n}`, status: 'intended', claim: 'specified, not built' } as never, { id: `rb${i}`, kind: 'aux', figure: 'f1', at: [i, 5], label: `rule b ${n}`, status: 'intended', claim: 'specified, not built' } as never)
      m.links.push({ id: `in_ra${i}`, from: 'in_flight', to: `ra${i}`, polarity: '+', mechanism: 'm', status: 'intended', claim: 'specified' } as never, { id: `rb${i}_d`, from: `rb${i}`, to: 'dispatched', polarity: '-', mechanism: 'm', status: 'intended', claim: 'specified' } as never)
      for (const j of names.keys()) m.links.push({ id: `ra${i}_rb${j}`, from: `ra${i}`, to: `rb${j}`, polarity: '+', mechanism: 'm', status: 'intended', claim: 'specified' } as never)
    }
    const a = await check(JSON.stringify(m), MODEL_PATH, io())
    expect(a.report.errors).toEqual([])
    expect(a.report.counts.designed_loops).toBe(36)
    expect(a.report.designed.length).toBe(30)
    expect(render(a).readerView).toContain('And 6 more.')
  })
  test('undeclared loops come with their route and a declaration to complete, with no verdict', async () => {
    const m = clone()
    m.loops = []
    m.answer.loops = []
    const r = await run(m)
    const key = (p: unknown) => [...(p as string[])].sort().join()
    const found = (path: string[]) => r.undeclared.find(u => key(u.declare?.path) === key(path))
    const stub = (path: string[]) => found(path)?.declare as Record<string, unknown> | undefined
    expect(stub(['queue', 'dispatched', 'in_flight', 'requeued'])).toMatchObject({ id: '', name: '', story: '' })
    const route = found(['queue', 'dispatched', 'in_flight', 'requeued'])?.route ?? ''
    expect(route).toContain('reads it: a batch is at most the queue length')
    expect(route).not.toMatch(/reinforcing|balancing|\(\+\)|\(−\)/)
    expect(r.errors.find(i => i.code === 'L02')?.message).toContain('next free: R1, B1')
    // no stub carries a verdict: a routine drain gets a story to fill like any other; the message says it may be minor
    for (const u of r.undeclared) expect(u.declare).toEqual({ id: '', name: '', path: u.path, story: '' })
    expect(stub(['in_flight', 'completed'])).toEqual({ id: '', name: '', path: ['in_flight', 'completed'], story: '' })
    expect(r.errors.find(i => i.code === 'L02')?.message).toContain('may be declared "minor"')
  })
  test('the next free loop id is free among every id, whatever its case', async () => {
    const m = clone()
    m.nodes.push({ status: 'observed', id: 'r1', kind: 'constant', figure: 'f1', at: [0, 3], label: 'replica one slots', value: '8', evidence: [{ path: 'worker.py', lines: '3', quote: 'MAX_WORKERS = 8' }] } as never)
    m.links.push({ status: 'observed', id: 'r1_dispatch', from: 'r1', to: 'dispatched', polarity: '+', mechanism: 'the batch is bounded by the replica', evidence: [{ path: 'worker.py', lines: '12', quote: 'free = MAX_WORKERS - len(in_flight)' }] } as never)
    m.loops = m.loops.filter(l => l.id !== 'R1')
    m.answer.loops = ['B1', 'B2']
    const r = await run(m)
    expect(r.errors.find(i => i.code === 'L02')?.message).toContain('next free: R2, B7')
  })
  test('a misspelt field names the field it is likely to be', async () => {
    const m = clone()
    link(m, 'seen_page').dealy = true
    const r = await run(m)
    expect(r.warnings.find(i => i.code === 'S05')?.message).toContain('did you mean "delay"?')
  })
  test('a loop story is checked against its own elements and what links into them, whatever the order of links', async () => {
    const build = (first: boolean) => {
      const m = clone()
      m.nodes.push({ status: 'observed', id: 'free', kind: 'aux', figure: 'f1', at: [2.5, 0.5], label: 'free slots', evidence: [{ path: 'worker.py', lines: '12', quote: 'free = MAX_WORKERS - len(in_flight)' }] } as never)
      link(m, 'busy_dispatch').to = 'free'
      link(m, 'max_dispatch').to = 'free'
      const fd = { status: 'observed', id: 'free_dispatch', from: 'free', to: 'dispatched', polarity: '+', mechanism: 'a batch is at most the free slots', evidence: [{ path: 'worker.py', lines: '13', quote: 'min(free, len(queue))' }] }
      if (first) m.links.unshift(fd as never)
      else m.links.push(fd as never)
      loop(m, 'B1').path = ['in_flight', 'free', 'dispatched']
      // 8 is in max_workers' quote, two links from B2's loop: out of its scope
      loop(m, 'B2').story = 'More queued jobs → more dispatched, at most the 8 free slots → fewer queued jobs.'
      return m
    }
    const last = await run(build(false))
    const first = await run(build(true))
    expect(last.errors).toEqual([])
    expect(last.warnings.map(i => `${i.code} ${i.where}`)).toEqual(['E04 loop "B2"'])
    expect(first.warnings).toEqual(last.warnings)
  })
  test('a document cannot be made code by its kind, for the element as for the quote', async () => {
    const m = clone()
    node(m, 'queue').evidence = [{ path: 'README.md', lines: '1', quote: 'Jobs wait in a queue', kind: 'code' }]
    const r = await run(m)
    expect(r.warnings.filter(i => i.code === 'E06').map(i => i.where).sort()).toEqual(['node "queue"', 'node "queue".evidence[0]'])
    expect(r.warnings.find(i => i.where === 'node "queue"')?.message).toContain('every source is a document')
  })
  test('what is not built cannot be fed by a built flow, nor read by a built link', async () => {
    const m = clone()
    Object.assign(node(m, 'dead'), { status: 'intended', claim: 'the design asks for a dead-letter queue; nothing stores dropped jobs' })
    m.nodes.push({ status: 'modelled', id: 'dead_seen', kind: 'aux', figure: 'f1', at: [5.5, 3.5], label: 'dead-letter backlog', claim: 'an operator would look' } as never)
    m.links.push({ status: 'observed', id: 'dead_read', from: 'dead', to: 'dead_seen', polarity: '+', mechanism: 'reads the dead-letter count', evidence: [{ path: 'worker.py', lines: '23', quote: 'dead.append(job)' }] } as never)
    const r = await run(m)
    expect(r.errors).toEqual([])
    const e01 = r.warnings.filter(i => i.code === 'E01')
    expect(e01.map(i => i.where).sort()).toEqual(['flow "dropped"', 'link "dead_read"'])
    expect(e01.find(i => i.where === 'flow "dropped"')?.message).toContain('its target "dead" is intended')
  })
  test('units, component names, unread number forms and locale formats are listed as not checked', async () => {
    const r = await run(EXAMPLE_MODEL)
    expect(r.not_checked.join('; ')).toContain('units, component names')
    expect(r.not_checked.join('; ')).toContain('compound durations (1m30s) or versions with more than two parts (1.2.3)')
    expect(r.not_checked.join('; ')).toContain('hex, octal, binary and scientific forms (0x10, 1e3) are compared by value')
    expect(r.not_checked.join('; ')).toContain('"1.000" is 1, "3,5" is 3 and 5 and "1 500" is 1 and 500')
  })
  /** The numbers E04 flags on one element, as the message quotes them. */
  const flagged = (r: Awaited<ReturnType<typeof run>>, where: string) => r.warnings.filter(i => i.code === 'E04' && i.where === where).map(i => /^the (?:number|value) "?([^ "]+)"?/.exec(i.message)?.[1])
  test('a source number is read once, by its form: never as its parts, a locale reading, a mantissa or a version', async () => {
    const cases: [string, string, string, string[]][] = [
      ['1', '# the queue holds at most 1,500 jobs', 'holds at most 500 jobs', ['500']],
      ['2', '# the queue holds at most 4,096 jobs', 'holds 4 or 96 jobs', ['4', '96']],
      ['3', '# up to 10,000 jobs per day', 'drains to 0 at night', ['0']],
      ['4', 'BACKOFF_FACTOR = 1.500', 'backs off for 1500 ms', ['1500']],
      ['5', 'pool = Pool(3,5)', 'about 3.5 workers are busy', ['3.5']],
      ['6', 'MAX_BYTES = 2.5e6', 'each job may carry 2.5 GB', ['2.5']],
      ['7', 'image: runner:v2.5', 'about 2.5 jobs per worker', ['2.5']],
      ['11', '# the queue holds up to 1,500 jobs (about 10,000 a day)', 'drains 0 or 10 a day', ['0', '10']],
    ]
    for (const [lines, quote, detail, numbers] of cases) {
      const m = clone()
      Object.assign(node(m, 'queue'), { detail, evidence: [...evOf(m, 'queue'), { path: 'reads.py', lines, quote }] })
      const r = await run(m)
      expect(r.errors).toEqual([])
      expect([quote, flagged(r, 'node "queue"')]).toEqual([quote, numbers])
    }
  })
  test('a page is read as its sources are: a false number is flagged whether the source holds a list, a quoted grouping or prose in brackets', async () => {
    const cases: [string, string, string, string[]][] = [
      // C5-01: a quoted grouping lends no parts
      ['8', 'PLAN_LIMITS = ["1,000", "5,000", "10,000"]', 'Plans allow 5 or 10 queued jobs.', ['5', '10']],
      // C5-03's prose counter-cases keep the grouping
      ['13', '# a batch holds (up to 1,500 jobs)', 'A batch holds 500 jobs.', ['500']],
      ['14', '# the default limit (1,500)', 'The limit is 500.', ['500']],
      ['15', '# overflow costs: (1,500)', 'Overflow costs 500.', ['500']],
      ['16', 'log("over 1,500 jobs")', 'It logs over 500 jobs.', ['500']],
      // known limit: a quoted list string is one number
      ['17', '"retry_on": "500,502,503"', 'Retries on 502.', ['502']],
      // a list item on the page is flagged as itself
      ['6', 'RETRY_ON = [500,502,503]', 'Retries on RETRY_ON = [500,502,509].', ['509']],
      // a list of numbers inside a string is prose: its groupings lend no parts
      ['18', "raise ValueError('a plan allows 1,000, 5,000 or 10,000 jobs, one of 1,000, 5,000, 10,000')", 'A plan allows 5 jobs or none (0).', ['5', '0']],
    ]
    for (const [lines, quote, detail, numbers] of cases) {
      const m = clone()
      Object.assign(link(m, 'q_dispatch'), { detail, evidence: [{ path: 'lists.py', lines, quote }] })
      const r = await run(m)
      expect(r.errors).toEqual([])
      expect([quote, flagged(r, 'link "q_dispatch"')]).toEqual([quote, numbers])
    }
  })
  test('a checked quote lends what its file says where it was found, read in context', async () => {
    // "(1,500)" cut out of "clamp(1,500)" reads alone as 1500, but the file says 1 and 500 there, and
    // that is what it lends (C6-01: by position, so 500 is lent and 1,500 is not)
    const cut = clone()
    Object.assign(link(cut, 'q_dispatch'), { detail: 'The limit is 1,500, never 500.', evidence: [{ path: 'lists.py', lines: '19', quote: '(1,500)' }] })
    const r1 = await run(cut)
    expect(r1.errors).toEqual([])
    expect(flagged(r1, 'link "q_dispatch"')).toEqual(['1,500'])
    // the whole call lends its arguments
    const whole = clone()
    Object.assign(link(whole, 'q_dispatch'), { detail: 'Clamped between 1 and 500.', evidence: [{ path: 'lists.py', lines: '19', quote: 'n = clamp(1,500)' }] })
    expect(flagged(await run(whole), 'link "q_dispatch"')).toEqual([])
    // a constant's value is read as the page is: "1,500" is one number, and the file says 1 and 500;
    // "500,502,503" alone is one number too, so a list value is written as a list
    for (const [value, lines, quote] of [['1,500', '20', 'm = clamp(n,1,500)'], ['500,502,503', '6', 'RETRY_ON = [500,502,503]']]) {
      const m = clone()
      Object.assign(node(m, 'max_workers'), { value, evidence: [{ path: 'lists.py', lines, quote }] })
      const r = await run(m)
      expect([value, r.warnings.filter(i => i.code === 'E04' && i.where === 'node "max_workers"').length]).toEqual([value, 1])
    }
  })
  test('a quote lends the file\'s reading of its span: a call or list opened on an earlier line, and no value lent by coincidence (C6-01)', async () => {
    const lent = async (detail: string, ev: Record<string, unknown>) => {
      const m = clone()
      Object.assign(link(m, 'q_dispatch'), { detail, evidence: [ev] })
      const r = await run(m)
      expect(r.errors).toEqual([])
      return flagged(r, 'link "q_dispatch"')
    }
    // clamp(n,\n 1,500) is clamp(n, 1, 500): the same place lends 1 and 500 whether "lines" is "2" or
    // "1-2", or absent
    for (const ev of [{ path: 'wrapped.py', lines: '2', quote: '1,500)' }, { path: 'wrapped.py', lines: '1-2', quote: 'clamp(n, 1,500)' }, { path: 'wrapped.py', quote: 'n, 1,500)' }]) {
      expect([ev, await lent('At most 1,500 jobs.', ev)]).toEqual([ev, ['1,500']])
      expect([ev, await lent('Clamped between 1 and 500.', ev)]).toEqual([ev, []])
    }
    // "(1,500)" reads alone as 1500, and the line's comment says 1,500, but the quote stands on the call:
    // nothing is lent by value from elsewhere on the line
    expect(await lent('At most 1,500 jobs.', { path: 'wrapped.py', lines: '3', quote: '(1,500)' })).toEqual(['1,500'])
    expect(await lent('At most 1,500 jobs.', { path: 'wrapped.py', lines: '3', quote: 'clamp(1,500) # 1,500 at most' })).toEqual([])
    // items on their own line, inside a list opened on the line before, are items
    expect(await lent('Retried on 503.', { path: 'q.sql', lines: '3', quote: '500,502,503' })).toEqual([])
    expect(await lent('Retried on 503.', { path: 'q.sql', lines: '2-4', quote: 'IN ( 500,502,503 )' })).toEqual([])
    // whether a quote cuts a number short is judged on the same reading: "500,502," ends between two
    // items, so it is found, and it lends 500 and 502 but not 503
    expect(await lent('Retried on 502, not 503.', { path: 'q.sql', lines: '3', quote: '500,502,' })).toEqual(['503'])
  })
  test('a cited file is read once: its numbers are worked out on first use and kept (C6-01)', () => {
    const r = readingOf('a = [1,500]\nb = clamp(n,\n  1,500)\r\n')
    expect(r.tokens()).toBe(r.tokens())
    expect(r.text).toBe('a = [1,500]\nb = clamp(n,\n  1,500)\n')
    expect(r.tokens().map(t => [t.value, r.text.slice(t.start, t.end)])).toEqual([[1, '1'], [500, '500'], [1, '1'], [500, '500']])
  })
  test('a value not read as a number is looked for where its quote was found, in the file, with the sign before it (C6-02)', async () => {
    // a quote cut just after the minus is found, but the file writes the value signed
    for (const [path, lines] of [['cut.yaml', '1'], ['signs.yaml', '2']]) {
      const m = clone()
      Object.assign(node(m, 'max_workers'), { value: '1m30s', evidence: [{ path, lines, quote: '1m30s' }] })
      const r = await run(m)
      expect(r.errors).toEqual([])
      expect([path, flagged(r, 'node "max_workers"')]).toEqual([path, ['1m30s']])
    }
    // the written match is in the element's own sources only: another element's quote, checked before
    // or after it, does not back it
    for (const other of ['queue', 'retry_limit']) {
      const m = clone()
      node(m, 'max_workers').value = '1m30s'
      ;(node(m, other).evidence as unknown[]).push({ path: 'literals.cfg', lines: '3', quote: 'scrape_interval: 1m30s' })
      const r = await run(m)
      expect(r.errors).toEqual([])
      expect([other, flagged(r, 'node "max_workers"')]).toEqual([other, ['1m30s']])
      expect(flagged(r, `node "${other}"`)).toEqual([])
    }
    // the docs say where it is looked for
    expect((await run(EXAMPLE_MODEL)).not_checked.join('; ')).toContain('must appear whole, and with its sign, where its quote was found in the file (or in its claim, when not observed)')
    expect(SECTIONS.node.fields.find(f => f.name === 'value')?.doc).toContain('not after a minus sign it lacks, where its quote was found in the file (or in its claim, when not observed)')
  })
  test('an observed element\'s claim is no source: a value written only there is warned, and every doc that names the claim says so (C7-02)', async () => {
    const said = async (status: string) => {
      const m = clone()
      Object.assign(node(m, 'max_workers'), { value: '1m30s', status, claim: 'the scrape interval is 1m30s' })
      const r = await run(m)
      expect(r.errors).toEqual([])
      return flagged(r, 'node "max_workers"')
    }
    expect(await said('observed')).toEqual(['1m30s'])
    expect(await said('modelled')).toEqual([])
    const r = await run(EXAMPLE_MODEL)
    for (const d of [...r.not_checked, ...Object.values(SECTIONS).flatMap(s => [s.doc, ...s.fields.map(f => f.doc)])])
      if (d.includes('in its claim')) expect(d).toContain('in its claim, when not observed')
  })
  test('brackets on the page are read as code: "[1,500]" is 1 and 500, and a split item is shown with its list (C6-03)', async () => {
    // documented behaviour: the answer's "[1,500]" is two numbers, each in some checked quote
    const m = clone()
    m.answer.text = 'Alerts fire past [1,500] queued jobs.'
    ;(node(m, 'retry_limit').evidence as unknown[]).push({ path: 'worker.py', lines: '19', quote: 'job.attempts += 1' })
    const r = await run(m)
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.not_checked.join('; ')).toContain('digits in [ ] or { } on the page are list items ("[1,500]" in the answer is 1 and 500')
    // a list of groupings in brackets splits; each message names the list the item came from
    const v = clone()
    Object.assign(node(v, 'max_workers'), { value: '[1,000, 5,000, 10,000]', evidence: [{ path: 'plans.py', lines: '1', quote: 'PLAN_LIMITS = [1000, 5000, 10000]' }] })
    const rv = await run(v)
    const e04 = rv.warnings.filter(i => i.code === 'E04' && i.where === 'node "max_workers"')
    expect(flagged(rv, 'node "max_workers"')).toEqual(['1', '000', '5', '10'])
    for (const i of e04) expect(i.message).toContain('(an item of the list [1,000, 5,000, 10,000]: digits in brackets are read as a list in code')
    // a number that is no list item is named alone
    const p = clone()
    node(p, 'queue').detail = 'holds 9,999 jobs'
    expect((await run(p)).warnings.find(i => i.code === 'E04')?.message).toMatch(/^the number 9,999 in "detail"/)
    // the value doc's advice is a list of plain numbers
    expect(SECTIONS.node.fields.find(f => f.name === 'value')?.doc).toContain('write a list as a list of plain numbers, e.g. [1000, 5000]')
  })
  test('the number-reading docs state the bracket rule whole: an opening bracket, a bracket inside a string, a call after a closing bracket (C6-04)', async () => {
    const r = await run(EXAMPLE_MODEL)
    const said = r.not_checked.join('; ')
    expect(said).toContain('( after =, a comma, an opening bracket, a call\'s name')
    expect(said).toContain('a bracket written inside a string still opens a list ("see [1,000, 5,000]" gives 1, 0, 5 and 0)')
    expect(said).toContain('a ( after a closing bracket is prose (the (1,500) of handlers[0](1,500) or make_clamp(n)(1,500) is 1500)')
    // the retired forms: "another bracket" (only an opening one counts), and "outside any string" with no word
    // that a bracket inside a string still splits
    const docs = [...r.not_checked, ...Object.values(SECTIONS).flatMap(s => [s.doc, ...s.fields.map(f => f.doc)])]
    for (const d of docs) {
      expect([d, d.includes('another bracket')]).toEqual([d, false])
      if (d.includes('outside any string')) expect(d).toContain('inside a string still')
    }
    // and the behaviour they describe
    expect(numbersIn('"see [1,000, 5,000]"')).toEqual([1, 0, 5, 0])
    expect(numbersIn('handlers[0](1,500)')).toEqual([0, 1500])
    expect(numbersIn('make_clamp(n)(1,500)')).toEqual([1500])
  })
  test('a comment is prose, as a string is: a page that copies it passes and one that misstates it is flagged (C7-01)', async () => {
    // [file, line, quote, the page copying the comment, a misstatement that matches a split fragment, what it flags]
    const cases: [string, string, string, string, string, string[]][] = [
      ['retry.go', '4', '// waits 500, 1,000, 2,000 ms, then gives up', 'waits 500, 1,000, 2,000 ms, then gives up', 'the first wait is 1 s', ['1']],
      ['retry_delays.py', '2', '# back off 1,000, 2,000, 4,000 ms, then give up', 'back off 1,000, 2,000, 4,000 ms, then give up', 'gives up after 2 back-offs', ['2']],
      ['sched.py', '3', 'batch=1000, # one of 1,000, 5,000, 10,000', 'one of 1,000, 5,000, 10,000', 'a batch is 5 or 10 jobs', ['5', '10']],
      ['config.ts', '2', '// page sizes: 100, 1,000, 10,000, 100,000', 'page sizes: 100, 1,000, 10,000, 100,000', 'a page holds 10 rows', ['10']],
    ]
    for (const [path, lines, quote, copy, wrong, numbers] of cases) {
      for (const [detail, want] of [[copy, []], [wrong, numbers]] as const) {
        const m = clone()
        Object.assign(node(m, 'max_workers'), { detail, evidence: [...evOf(m, 'max_workers'), { path, lines, quote }] })
        const r = await run(m)
        expect(r.errors).toEqual([])
        expect([path, detail, flagged(r, 'node "max_workers"')]).toEqual([path, detail, want])
      }
    }
    // a comment ends at its line's end or at its closer: the code after it is a list again
    for (const [lines, quote, detail] of [['3', '1, 100,250,500,', 'Sizes are 1, 100, 250 and 500.'], ['5', '1, 600,700,', 'Then 1, 600 and 700.']]) {
      const m = clone()
      Object.assign(link(m, 'q_dispatch'), { detail, evidence: [{ path: 'sizes.c', lines, quote }] })
      const r = await run(m)
      expect(r.errors).toEqual([])
      expect([quote, flagged(r, 'link "q_dispatch"')]).toEqual([quote, []])
    }
    // the docs say comments are prose, how they are guessed, and what a wrong guess does
    const said = (await run(EXAMPLE_MODEL)).not_checked.join('; ')
    expect(said).toContain('not in a string or a comment opened after that bracket')
    expect(said).toContain('a comment is read as prose, as a string is, and is guessed by its marker alone, outside a string (#, // or -- to the end of the line; /* to */)')
    expect(said).toContain('a marker that is no comment (Python\'s floor division //, a # that is not a comment, a decrement --) makes the items after it, in a bracket opened before it, read as prose')
    expect(said).toContain('a page that gives its items gets a false warning')
    expect(said).toContain('quote marks inside it are not counted')
    expect(said).toContain('a Lua --[[ ]] block is read as code on every line')
    expect(said).toContain('a /* that opens no comment stops the count of quote marks until the next */')
    // retired: it said the marker turned all the code after it into prose
    expect(said).not.toContain('makes the code after it read as prose')
  })
  test('a quote mark inside a comment does not open a string, so the rest of the comment stays prose (C8-01)', () => {
    // a quotation wrapping across two comment lines, and two apostrophes in comments of one body
    expect(numbersIn('func Backoff(attempt int) int {\n\t// RFC 9110 says clients "should retry\n\t// with back-off"; we wait 500, 1,000, 2,000 ms, then give up.\n\treturn delays[attempt]\n}\n')).toEqual([9110, 500, 1000, 2000])
    expect(numbersIn("void f() {\n  // the clients' queue\n  // the workers' waits are 500, 1,000, 2,000 ms\n  g();\n}\n")).toEqual([500, 1000, 2000])
    // a real string after a comment is still a string, and a list after it is still a list
    expect(numbersIn('x = {\n  // the "fast" path\n  "label": "1,500 jobs",\n  "sizes": [100,250,500],\n}\n')).toEqual([1500, 100, 250, 500])
  })
  test('a written value after a U+2212 minus it lacks is not written so (C5-04)', async () => {
    const m = clone()
    Object.assign(node(m, 'max_workers'), { value: '1m30s', evidence: [{ path: 'signs.yaml', lines: '2', quote: 'interval: −1m30s' }] })
    const r = await run(m)
    expect(r.errors).toEqual([])
    expect(flagged(r, 'node "max_workers"')).toEqual(['1m30s'])
  })
  test('the kind doc and the E06 messages state the rule the code applies: a document\'s name decides even with .txt (C5-05)', async () => {
    const kindDoc = SECTIONS.evidence.fields.find(f => f.name === 'kind')?.doc ?? ''
    expect(kindDoc).toContain('with no extension, a document one or .txt, are documents whatever "kind" says')
    expect(kindDoc).toContain('For any other .txt or .html file "kind" decides')
    // the retired form said "kind" decides for every .txt
    expect(kindDoc).not.toContain('For a .txt or .html file "kind" decides')
    const m = clone()
    flow(m, 'submitted').evidence = [{ path: 'HISTORY.txt', lines: '1', quote: 'queue.push(job)', kind: 'config' }]
    const r = await run(m)
    const e06 = r.warnings.filter(i => i.code === 'E06')
    expect(e06.map(i => i.where).sort()).toEqual(['flow "submitted"', 'flow "submitted".evidence[0]'])
    const element = e06.find(i => i.where === 'flow "submitted"')?.message ?? ''
    expect(element).toContain('a document\'s name such as README or HISTORY counts with .txt too; for any other .txt or .html file by its "kind"')
    expect(element).not.toContain('; for a .txt or .html file by its "kind"')
    expect(e06.find(i => i.where === 'flow "submitted".evidence[0]')?.message).toContain('decides even with .txt')
  })
  test('European formats are read as English: "1.000" is 1, "3,5" is 3 and 5', async () => {
    const m = clone()
    Object.assign(node(m, 'queue'), { detail: 'at most 1000 jobs, with a 3.5 second pause', evidence: [...evOf(m, 'queue'), { path: 'eu.cfg', lines: '1', quote: 'max. 1.000 Jobs, Pause 3,5 Sekunden' }] })
    expect(flagged(await run(m), 'node "queue"')).toEqual(['1000', '3.5'])
  })
  test('a literal is read whole, by its value and with its sign', async () => {
    const cases: [string, string, string, string[]][] = [
      ['1', 'ERROR_RATE = 1.5e-3', '1.5', ['1.5']],
      ['2', 'MAX = 1E+3', '3', ['3']],
      ['2', 'MAX = 1E+3', '1', ['1']],
      ['3', 'MAX = -1e3', '1e3', ['1e3']],
      ['4', 'OFFSET = -0x10', '0x10', ['0x10']],
      ['7', 'scrape_interval: -1m30s', '1m30s', ['1m30s']],
      ['8', 'min_version = "1.2.30"', '1.2.3', ['1.2.3']],
    ]
    for (const [lines, quote, value, numbers] of cases) {
      const m = clone()
      Object.assign(node(m, 'max_workers'), { value, evidence: [{ path: 'lit2.cfg', lines, quote }] })
      const r = await run(m)
      expect(r.errors).toEqual([])
      expect([quote, value, flagged(r, 'node "max_workers"')]).toEqual([quote, value, numbers])
    }
    const m = clone()
    Object.assign(node(m, 'max_workers'), { value: '0x10', evidence: [{ path: 'literals.cfg', lines: '1', quote: 'QUEUE_SIZE 0x100' }] })
    expect(flagged(await run(m), 'node "max_workers"')).toEqual(['0x10'])
  })
  test('Arabic thousands separators group: "١٬٥٠٠" is 1500 and lends no 500', async () => {
    const m = clone()
    Object.assign(node(m, 'queue'), { detail: 'holds up to 500 jobs', evidence: [...evOf(m, 'queue'), { path: 'ar.txt', lines: '2', quote: 'الحد ١٬٥٠٠ مهمة' }] })
    expect(flagged(await run(m), 'node "queue"')).toEqual(['500'])
  })
  test('a number next to Thai, Lao, Khmer or Myanmar letters is read', async () => {
    for (const detail of ['คิวรับงานได้สูงสุด4096งาน', 'ສູງສຸດ4096ວຽກ', 'ការងារ4096', 'အလုပ်က4096ခု']) {
      const m = clone()
      node(m, 'queue').detail = detail
      expect([detail, flagged(await run(m), 'node "queue"')]).toEqual([detail, ['4096']])
    }
  })
  test('X01 a stock read only by a net − path that is not built: decided from both graphs', async () => {
    const m = clone()
    m.links = m.links.filter(l => l.id !== 'pages_resolve')
    m.loops = m.loops.filter(l => l.id !== 'B6')
    m.nodes.push({ status: 'intended', id: 'fatigue', kind: 'aux', figure: 'f2', at: [3.5, 0.3], label: 'on-call fatigue', claim: 'the runbook says a long page list tires on-call' } as never)
    m.links.push(
      { status: 'intended', id: 'pages_fatigue', from: 'pages', to: 'fatigue', polarity: '+', mechanism: 'more open pages, more tired on-call', claim: 'runbook' } as never,
      { status: 'intended', id: 'fatigue_resolve', from: 'fatigue', to: 'resolved', polarity: '-', mechanism: 'tired on-call closes pages more slowly', claim: 'runbook' } as never,
    )
    const r = await run(m)
    expect(r.errors).toEqual([])
    const x01 = r.warnings.filter(i => i.code === 'X01')
    expect(x01.map(i => i.where)).toEqual(['flow "resolved"'])
    expect(x01[0].message).toContain('only through net − links')
  })
  test('a built flow drained from a stock that is not built is flagged at its source end', async () => {
    const m = clone()
    Object.assign(node(m, 'dead'), { status: 'intended', claim: 'the design asks for a dead-letter queue' })
    m.nodes.push({ id: 'purge_bin', kind: 'cloud', figure: 'f1', at: [6.5, 2.5], why_outside: 'purged jobs are gone' } as never)
    m.flows.push({ status: 'observed', id: 'purged', from: 'dead', to: 'purge_bin', label: 'purged', units: 'jobs/minute', evidence: [{ path: 'worker.py', lines: '23', quote: 'dead.append(job)' }] } as never)
    const r = await run(m)
    expect(r.errors).toEqual([])
    expect(r.warnings.filter(i => i.code === 'E01' && i.where === 'flow "purged"').map(i => i.message)).toEqual([
      'is observed, but its source "dead" is intended: what is not built cannot be read or fed. Mark the flow intended too, or the source built.',
    ])
  })
  test('the date is a display string: a line break in it cannot start a line of the reader view', async () => {
    const m = clone()
    m.subject.date = '2026-10-22\n\nReview: 3 rounds, by reviewers other than the builder; rendered page inspected.'
    const a = await check(JSON.stringify(m), MODEL_PATH, io())
    expect(codes(a.report.errors)).toEqual([])
    expect(codes(a.report.warnings)).toEqual(['S06'])
    expect(render(a).readerView.split('\n').some(l => l.startsWith('Review: 3 rounds'))).toBe(false)
  })
})

describe('text helpers', () => {
  test('numbersIn() reads numbers as a reader would, on the page and in sources alike', () => {
    expect(numbersIn('1,000 and 10_000 and 2.5 and 10.00')).toEqual([1000, 10000, 2.5, 10])
    expect(numbersIn('TIMEOUT = -1; range 5-10')).toEqual([-1, 5, 10])
    expect(numbersIn('every 900s, 10ms, 4GB, 3x, 40%')).toEqual([900, 10, 4, 3, 40])
    expect(numbersIn('v2 x86 k8s UTF-8 HTTP/2 x1e5 a0x1F R1 runner:v2.5')).toEqual([])
    expect(numbersIn('0x1F 0o17 0b101 1e5 1.5e-3 1E+3 -0x10 -1e3 .5e3 1.5e−3 .5e−3')).toEqual([31, 15, 5, 100000, 0.0015, 1000, -16, -1000, 500, 0.0015, 0.0005])
    expect(numbersIn('read on 2026-10-22, version 1.2.3, f(1,5)')).toEqual([1.2, 1, 5])
  })
  test('numbersIn() reads a leading-dot decimal as one, unless the dot follows a word or a dot', () => {
    expect(numbersIn('JITTER = .5; opacity: .25; (-.5)')).toEqual([0.5, 0.25, -0.5])
    expect(numbersIn('crontab.5 and 1..5')).toEqual([5, 1, 5])
  })
  test('numbersIn() reads numbers in Chinese, Japanese and Korean prose, and digits of any script', () => {
    expect(numbersIn('队列最多可容纳4096个任务')).toEqual([4096])
    expect(numbersIn('ワーカーは最大9つ')).toEqual([9])
    expect(numbersIn('큐는최대4096개')).toEqual([4096])
    expect(numbersIn('温度为-5度')).toEqual([-5])
    // a Latin unit glued on ends where the Chinese resumes
    expect(numbersIn('超时5ms以内处理完毕')).toEqual([5])
    expect(numbersIn('最多5GB的数据')).toEqual([5])
    expect(numbersIn('最大９ワーカー')).toEqual([9])
    expect(numbersIn('٩ عمال, ۸ و १० और ๓')).toEqual([9, 8, 10, 3])
    expect(numbersIn('١٢٫٥ و ١٬٥٠٠ و ۱۲٫۵')).toEqual([12.5, 1500, 12.5])
    expect(numbersIn('สูงสุด4096งาน ສູງສຸດ4096ວຽກ ការងារ4096 အလုပ်က4096ခု')).toEqual([4096, 4096, 4096, 4096])
    expect(numbersIn('maximum4096 v2')).toEqual([])
  })
  test('asciiDigits() folds every decimal digit of the Basic Multilingual Plane, keeping positions', () => {
    for (let c = 0; c <= 0xffff; c++) {
      const ch = String.fromCharCode(c)
      if (/\p{Nd}/u.test(ch)) expect(asciiDigits(ch)).toMatch(/^[0-9]$/)
    }
    expect(asciiDigits('最大９ワーカー').length).toBe('最大９ワーカー'.length)
  })
  test('numbersIn() is one reading for the page and the sources: a comma grouping is one number unless it is an item of a list in code', () => {
    const cases: [string, number[]][] = [
      ['"retry_delays_ms":[100,250,500]', [100, 250, 500]],
      ['range(1,100)', [1, 100]],
      ['Pool(3,5)', [3, 5]],
      ['[-1,500]', [-1, 500]],
      ['1,2,3 and 100,25 and 1,8,120 and 1,500,25', [1, 2, 3, 100, 25, 1, 8, 120, 1, 500, 25]],
      ['retry_on: 500,502,503', [500502503]],
      ['8,120', [8120]],
      ['1,500 and 4,096 and 10,000', [1500, 4096, 10000]],
      ['f(1,500)', [1, 500]],
      ['SIZES = [1_000,2_000]', [1000, 2000]],
      ['max. 1.000 Jobs, Pause 3,5 Sekunden', [1, 3, 5]],
      ['JITTER = .5', [0.5]],
      ['MAX_BYTES = 2.5e6; image: runner:v2.5', [2500000]],
      ['الحد ١٬٥٠٠ مهمة', [1500]],
      // a quote mark is never a list boundary: a quoted string is prose (C5-01)
      ['PLAN_LIMITS = ["1,000", "5,000", "10,000"]', [1000, 5000, 10000]],
      ['{"max": "1,500"}', [1500]],
      ['{"retry_on": "500,502,503"}', [500502503]],
      ['"10,000"', [10000]],
      // a "(" opens a list after =, a comma, a bracket, a call's name, IN or VALUES; items may be padded or wrapped (C5-03)
      ['WHERE status IN (500,502,503)', [500, 502, 503]],
      ["VALUES (1,500,'x')", [1, 500]],
      ['cv2.resize(frame, (640,480))', [640, 480]],
      ['x.reshape((128,256))', [128, 256]],
      ['int codes[] = { 500,502,503 };', [500, 502, 503]],
      ['RETRY_ON = (500,502,503)', [500, 502, 503]],
      ['sizes = (100,250,500)', [100, 250, 500]],
      ['clamp(n, 1,500) and clamp(n,1,500)', [1, 500, 1, 500]],
      ['[ 500,502,503 ]', [500, 502, 503]],
      ['X = [\n  500,502,503\n]', [500, 502, 503]],
      // prose keeps its grouping, and so does a "(" after a name and a space or after lower-case "in"
      ['(up to 1,500 jobs)', [1500]],
      ['the default limit (1,500)', [1500]],
      ['costs: (1,500)', [1500]],
      ['log("over 1,500 jobs")', [1500]],
      ['return (1,500)', [1500]],
      ['where status in (500,502,503)', [500502503]],
      ['[1,500 jobs]', [1500]],
      // a list of numbers inside a string is prose; a quote mark counts unless escaped or an apostrophe
      ["raise ValueError('one of 1,000, 5,000, 10,000')", [1000, 5000, 10000]],
      ['log("the queue\'s limits: 1,000, 5,000, 10,000")', [1000, 5000, 10000]],
      ["log(f'one of 1,000, 5,000, 10,000')", [1000, 5000, 10000]],
      ['log(`one of 1,000, 5,000, 10,000`)', [1000, 5000, 10000]],
      ["VALUES ('x', 1,500)", [1, 500]],
      ['["it\'s", 1,500]', [1, 500]],
      ['f("a\\"b", 1,500)', [1, 500]],
      // a quote mark is never a boundary, even where an escaped backslash leaves the strings miscounted
      ['["a\\\\", "1,500"]', [1500]],
      // an item ends at a comma or its own bracket's closer
      ['[1,500)', [1500]],
      // a comment opened after the bracket is prose, to its line's end or its closer (C7-01)
      ['{ // waits 500, 1,000, 2,000 ms\n}', [500, 1000, 2000]],
      ['X = [\n  # back off 500, 1,000, 2,000\n  1, 100,250,500\n]', [500, 1000, 2000, 1, 100, 250, 500]],
      ['f(a, -- 500, 1,000, 2,000\n  b, 1,500)', [500, 1000, 2000, 1, 500]],
      ['[ /* 500, 1,000, 2,000 */ 1, 100,250 ]', [500, 1000, 2000, 1, 100, 250]],
      ['[ /* 500, 1,000,\n 2,000, 4,000 */ 1, 100,250 ]', [500, 1000, 2000, 4000, 1, 100, 250]],
      ['[/*/ 500, 1,000, 2,000 */]', [500, 1000, 2000]],
      // each marker restarts its kind, so a comment after a bracket opened inside another is still prose
      ['[ # a [ # 500, 1,000, 2,000\n] ]', [500, 1000, 2000]],
      // a marker inside a string opens no comment
      ['f("#", 1,500)', [1, 500]],
      ["f('//', 1,500)", [1, 500]],
      ['f("/*", 1,500, "*/")', [1, 500]],
      // a bracket inside a comment still opens a list; a marker that is no comment reads code as prose
      ['[ # see [1,000, 5,000]\n]', [1, 0, 5, 0]],
      ['f(n // 2, 1,500)', [2, 1500]],
      ['[i--, 1,500]', [1500]],
    ]
    for (const [s, v] of cases) expect([s, numbersIn(s)]).toEqual([s, v])
    // a list too long to be read as one number is still a list
    const codes = Array.from({ length: 120 }, (_, i) => 100 + i)
    expect(numbersIn(`CODES = [${codes.join(',')}]`)).toEqual(codes)
    // U+2212 is a minus on the page as in a source (C5-04)
    expect(numbersIn('−40')).toEqual([-40])
    // each item keeps its own text and place, so a message names it and a quote may end between items
    expect(numberTokens('x = [-1,500]').map(t => [t.text, t.start, t.end])).toEqual([['-1', 5, 7], ['500', 8, 11]])
  })
  test('a long list after a long run of spaces is read in linear time', { timeoutMs: 30_000 }, () => {
    const s = `x =${' '.repeat(50_000)}(${'1,500, '.repeat(10_000)}1)`
    const t0 = performance.now()
    expect(numbersIn(s).length).toBe(20_001)
    expect(performance.now() - t0).toBeLessThan(2_000)
  })
  test('splitLines() numbers lines as the Read tool does: \\n and \\r\\n end a line, a lone \\r does not', () => {
    expect(splitLines('a\r\nb\rc\nd')).toEqual(['a', 'b\rc', 'd'])
  })
})

import { describe, expect, test } from 'claude-code/testing'
import {
  anchorsOf, checkText, DEFAULT_GLOSSARY, linksIn, loadLists, parseGlossary, replyNote,
  type CheckInput, type Code, type Finding, type Glossary,
} from '../hooks/check.ts'

// The checker (hooks/check.ts) against small inline lists, so no test reads a file or the real data.
// Each test was shown to fail when the code it pins was removed or broken, in a scratch copy.

const COMMON = `a an the and or but if so to of in on at by for with from as is are was be it its this that
these those we you they our your their what when who how why where which not no all any each every
one two some more most many few first next last new old good safe fast slow plain long short
word words file files read reads write run runs use uses used make made check checks checked test
see show look keep give get set put start stop end open add move moved change name names step steps
page line lines part parts thing time way day days people reader team code text number numbers link
links heading section document guide work works job jobs task tasks queue queues worker workers wait
waits fix copy again also only then there here up down out over after before about into same other
own able can will would should must may do does done have has had help helps tell mean means group
full target often level service like daily said asked review machine main report reports note
title list hold holds pass objective`

const familiarity = (extra: string[] = []) =>
  ['word\trating', ...COMMON.split(/\s+/).filter(Boolean).map(w => `${w}\t7.0`), ...extra].join('\n')

const REPLACEMENTS = JSON.stringify([
  { from: 'utilize', to: ['use'], source: 'test' },
  { from: 'in order to', to: ['to', '(omit)'], source: 'test' },
  { from: 'implement', to: ['carry out'], source: 'test' },
  { from: 'additional', to: ['more'], source: 'test', unless: 'it means added' },
])

// "throttle" is in the list but below the 6.0 cut-off; "utilize" is above it.
const LISTS = loadLists(familiarity(['throttle\t5.2', 'utilize\t6.1']), REPLACEMENTS, '# words a swap would change\nimplement\n')

const run = (text: string, more: Partial<CheckInput> = {}) => checkText({ text, lists: LISTS, ...more })
const only = (code: Code, text: string, more: Partial<CheckInput> = {}) => run(text, { codes: [code], ...more }).findings
const termsOf = (fs: Finding[]) => fs.map(f => f.term)
const glossary = (g: Partial<Glossary>): Glossary => ({ ...DEFAULT_GLOSSARY, ...g })

describe('loadLists', () => {
  test('reads the familiarity list: a header row, lower case, and the higher of two ratings', () => {
    const l = loadLists('word\trating\napi\t5.5\nAPI\t4.0\n\nqueue\t6.0', '[]', '')
    expect([...l.familiarity.entries()]).toEqual([['api', 5.5], ['queue', 6]])
  })

  test('reads the replacements and exceptions; comments and blank lines are not exceptions', () => {
    const l = loadLists('', '[{"from": " utilize ", "to": ["use"], "source": "s", "unless": "u"}]', '# note\n\nImplement\n')
    expect(l.replacements).toEqual([{ from: 'utilize', to: ['use'], source: 's', unless: 'u' }])
    expect([...l.exceptions]).toEqual(['implement'])
  })

  test('a malformed line or entry stops the load instead of being skipped', () => {
    expect(() => loadLists('word\trating\nqueue\tsix', '[]', '')).toThrow('line 2')
    expect(() => loadLists('queue\t9.0', '[]', '')).toThrow('line 1')
    expect(() => loadLists('', '{', '')).toThrow('not valid JSON')
    expect(() => loadLists('', '[{"from": "x"}]', '')).toThrow('entry 1')
  })
})

describe('parseGlossary', () => {
  test('reads every field', () => {
    const r = parseGlossary('{"known": ["API"], "same": [["job", "task"]], "max_words": 25, "max_words_in_steps": 15, "cutoff": 5.5}')
    expect(r).toEqual({ glossary: { known: ['API'], same: [['job', 'task']], max_words: 25, max_words_in_steps: 15, cutoff: 5.5 }, problems: [] })
  })

  test('a missing field keeps its default', () => {
    expect(parseGlossary('{}')).toEqual({ glossary: { ...DEFAULT_GLOSSARY }, problems: [] })
  })

  test('checkText fills in the fields a hand-built glossary leaves out', () => {
    const partial = { same: [['job', 'task']] } as unknown as Glossary
    expect(run('A job waits. The task runs.', { glossary: partial }).findings.map(f => f.code)).toEqual(['J02'])
  })

  test('each wrong field is named and keeps its default', () => {
    const r = parseGlossary('{"known": "API", "same": [["job"]], "max_words": 0, "max_words_in_steps": 2.5, "cutoff": 9, "known_words": []}')
    expect(r.glossary).toEqual({ ...DEFAULT_GLOSSARY })
    expect(r.problems).toHaveLength(6)
    expect(r.problems.join(' ')).toMatch(/"known_words" is not a glossary field/)
  })

  test('text that is not JSON, or not an object, gives the defaults and says so', () => {
    expect(parseGlossary('{known: [}').problems[0]).toMatch(/not valid JSON/)
    expect(parseGlossary('["API"]').problems[0]).toMatch(/must be a JSON object/)
  })
})

describe('reading prose: what is skipped', () => {
  // "kubelet" is in no list, so any two uses of it outside the skipped part make it a J01 term.
  const skips: [string, string][] = [
    ['fenced code', 'We check the queue.\n\n~~~\nkubelet kubelet\n~~~\n'],
    ['indented code', 'We check the queue.\n\n    kubelet kubelet\n'],
    ['inline code', 'Run `kubelet kubelet kubelet kubelet` now.'],
    ['inline code holding a backtick', 'Run `` x ` kubelet kubelet kubelet `` now.'],
    ['<code> and <kbd> elements', 'Run <code>kubelet</code> or press <kbd>kubelet</kbd> now.'],
    ['an HTML comment block', '<!--\nkubelet kubelet\n\nkubelet\n-->\n\nWe check the queue.'],
    ['front matter', '---\ntitle: kubelet kubelet\n---\n\nWe check the queue.'],
    ['direct quotations', 'They said "kubelet kubelet" and “kubelet”, then ‘kubelet’.'],
    ['link targets and titles', 'See [the guide](<kubelet kubelet>) and [this](docs/x.md (kubelet kubelet)).'],
    ['images', 'See ![kubelet kubelet kubelet kubelet](a.png) here.'],
  ]
  for (const [what, text] of skips) {
    test(`${what} is skipped`, () => {
      expect(only('J01', text)).toEqual([])
    })
  }

  test('a quotation in straight single quotes ends at its line, so a stray apostrophe hides nothing', () => {
    expect(termsOf(only('J01', "We 'kubelet the jobs\nand the kubelet' waits."))).toEqual(['kubelet'])
  })

  test('link text is prose and is read', () => {
    expect(termsOf(only('J01', 'See [kubelet](a.md) and [kubelet](b.md).'))).toEqual(['kubelet'])
  })

  test('HTML tags are skipped, the text between them is read', () => {
    // J04 reads every word of the opening, so a tag read as words would fail it
    expect(only('J04', '# x\n\n<p align="center">We check the <b>queue</b>.</p>')).toEqual([])
  })

  test('line numbers count every line, skipped ones included', () => {
    const text = ['---', 'title: x', '---', '', '```', 'code', '```', '', 'We check the', 'SLO here.'].join('\n')
    expect(only('J01', text).map(f => f.line)).toEqual([10])
  })

  test('words that look like names are skipped: capitalised in mid-sentence', () => {
    expect(only('J01', 'We run Kubernetes daily. Then Kubernetes stops.')).toEqual([])
  })

  test('a sentence\'s first word written as a name elsewhere is a name too', () => {
    expect(only('J01', 'Kubernetes runs jobs. Kubernetes stops jobs. We like Kubernetes.')).toEqual([])
  })

  test('a first name is a name: the word after it is written as a name', () => {
    expect(only('J01', 'Andrej Karpathy wrote it.\n\n| Who | What |\n|---|---|\n| Andrej Karpathy, a post | the idea |')).toEqual([])
  })

  test('words shaped like identifiers are skipped: camelCase, snake_case, a dot, a slash, a leading dash', () => {
    const s = 'Set maxJobs and max_jobs, then open queue.ts or src/queue and pass --fast.'
    expect(only('J01', `${s} ${s}`)).toEqual([])
  })

  test('words are compared after removing a plural or verb ending, list or no list', () => {
    expect(termsOf(only('J01', 'We throttle jobs. Throttled jobs wait.'))).toEqual(['throttle'])
    expect(termsOf(only('J01', 'A kubelet waits. Two kubelets wait.'))).toEqual(['kubelet'])
  })

  test('a hyphenated word is read part by part; a prefix such as "re-" is not a word of its own', () => {
    expect(only('J01', 'We re-read the file and re-check the list.')).toEqual([])
    expect(only('J04', '# Guide\n\nWe re-read the file.')).toEqual([])
    expect(termsOf(only('J01', 'A kubelet-run job waits. The kubelet-made list grows.'))).toEqual(['kubelet'])
    expect(termsOf(only('J01', 'See the ASD-STE100 rules.'))).toEqual(['ASD', 'STE100'])
  })

  test('a full stop ends a sentence, but not after a title such as "Dr."', () => {
    const g = glossary({ max_words: 8 })
    expect(only('J03', 'We read the file. Then we read the list.', { glossary: glossary({ max_words: 6 }) })).toEqual([])
    expect(only('J03', 'We asked Dr. Lee to read the file and the list.', { glossary: g }).map(f => f.message)).toEqual([
      'A sentence has 11 words; the limit is 8. Split it.',
    ])
  })
})

describe('J01 terms used before they are defined', () => {
  test('an acronym is a term even when used once, and is an error', () => {
    expect(only('J01', 'We check the SLO.')).toEqual([{
      code: 'J01', severity: 'error', line: 1, term: 'SLO',
      message: '"SLO" is not written out where it first appears. Write it out there or in the next sentence, for example "Full Name (SLO)", or add it to "known" in .jargone/glossary.json if every reader knows it.',
    }])
  })

  test('a word used once is not a term; used twice it is', () => {
    expect(only('J01', 'We check idempotent jobs.')).toEqual([])
    expect(termsOf(only('J01', 'Idempotent jobs are safe. We like idempotent jobs.'))).toEqual(['Idempotent'])
  })

  test('common words, the glossary\'s known terms and the project name are not terms', () => {
    expect(only('J01', 'We check the queue. The queue waits.')).toEqual([])
    expect(only('J01', 'We check the SLO.', { glossary: glossary({ known: ['SLO'] }) })).toEqual([])
    expect(only('J01', 'jargone checks jobs. Then jargone stops.', { projectName: 'jargone' })).toEqual([])
  })

  const forms: [string, string][] = [
    ['Full Name (TERM)', 'We set a service level objective (SLO) for each job.'],
    ['term (meaning)', 'We set an SLO (a target for how often a job works) for each job.'],
    ['term — meaning', 'We set an SLO — a target for how often a job works.'],
    ['term is …', 'An SLO is a target for how often a job works.'],
    ['term means …', 'SLO means a target for how often a job works.'],
  ]
  for (const [form, sentence] of forms) {
    test(`a definition of the form "${form}" counts`, () => {
      expect(only('J01', `${sentence} Each day we check the SLO.`)).toEqual([])
    })
  }

  test('without a definition the same text fails', () => {
    expect(termsOf(only('J01', 'We set an SLO for each job. Each day we check the SLO.'))).toEqual(['SLO'])
  })

  test('"is" counts as a definition only when the sentence opens with the term', () => {
    expect(termsOf(only('J01', 'We think the SLO is too strict. Each day we check the SLO.'))).toEqual(['SLO'])
  })

  test('a definition in the next sentence counts; two sentences later it does not', () => {
    expect(only('J01', 'We set an SLO. An SLO is a target. Each day we check the SLO.')).toEqual([])
    expect(termsOf(only('J01', 'We set an SLO. Each day we check it. An SLO is a target.'))).toEqual(['SLO'])
  })

  test('the glossary\'s cut-off decides which words are common', () => {
    const text = 'We throttle jobs. Throttled jobs wait.'
    expect(only('J01', text, { glossary: glossary({ cutoff: 5.0 }) })).toEqual([])
  })

  test('a quoted mention can be the first use that a definition follows', () => {
    expect(only('J01', 'A "kubelet" is a helper on each machine. Each kubelet reports to the main kubelet.')).toEqual([])
  })
})

describe('J02 one thing, one name', () => {
  const g = glossary({ same: [['job', 'task'], ['pull request', 'merge request']] })

  test('two names the glossary declares the same are an error when both appear', () => {
    expect(only('J02', 'A job waits.\n\nThen the task runs.', { glossary: g })).toEqual([{
      code: 'J02', severity: 'error', line: 3, term: 'task',
      message: '"job" and "task" name the same thing (the glossary\'s "same" list). Use one name throughout: "job" first on line 1, "task" first on line 3.',
    }])
  })

  test('one name alone, in any form, is fine', () => {
    expect(only('J02', 'A job waits. Jobs run.', { glossary: g })).toEqual([])
  })

  test('names of more than one word are matched as a whole', () => {
    expect(termsOf(only('J02', 'Open a pull request. Then review the merge request.', { glossary: g }))).toEqual(['merge request'])
    expect(only('J02', 'Pull the request. Then merge it.', { glossary: g })).toEqual([])
  })
})

describe('J03 long sentences', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 ? 'jobs' : 'queue')).join(' ')

  test('a sentence over 30 words is a warning; 30 is not', () => {
    expect(only('J03', `${words(31)}.`)).toEqual([{ code: 'J03', severity: 'warning', line: 1, message: 'A sentence has 31 words; the limit is 30. Split it.' }])
    expect(only('J03', `${words(30)}.`)).toEqual([])
  })

  test('inside a numbered step the limit is 20, in a bullet it is not', () => {
    expect(only('J03', `1. ${words(21)}.`).map(f => f.message)).toEqual(['A sentence in a numbered step has 21 words; the limit there is 20. Split it.'])
    expect(only('J03', `- ${words(21)}.`)).toEqual([])
  })

  test('the longest sentence is reported even when the scores are not asked for', () => {
    expect(run(`${words(12)}. We check it.`, { codes: ['J03'] }).summary).toBe('No findings. Longest sentence: 12 words.')
  })

  test('the glossary changes both limits', () => {
    const g = glossary({ max_words: 10, max_words_in_steps: 5 })
    expect(only('J03', `${words(11)}.\n\n1. ${words(6)}.`, { glossary: g }).map(f => f.line)).toEqual([1, 3])
  })

  test('headings and table cells are not sentences for J03 or the scores', () => {
    const text = `# ${words(31)}\n\n| a | b |\n|---|---|\n| ${words(31)} | x |\n\nWe check the queue.`
    expect(only('J03', text)).toEqual([])
    expect(run(text).scores.longestSentence).toBe(4)
  })
})

describe('J04 the opening', () => {
  test('an uncommon word in the first paragraph is an error, even when explained there', () => {
    const r = run('# Guide\n\nWe check the SLO (service level objective).', { codes: ['J01', 'J04'] })
    expect(r.findings.map(f => [f.code, f.severity, f.term, f.line])).toEqual([['J04', 'error', 'SLO', 3]])
  })

  test('only the first paragraph is read', () => {
    expect(only('J04', '# Guide\n\nWe check the queue.\n\nWe check the SLO.')).toEqual([])
  })

  test('badges, images and a line of only links are skipped to find the opening', () => {
    const text = '# jargone\n\n[![CI](https://ci/badge.svg)](https://ci)\n\n[Docs](docs.md) · [Blog](blog.md)\n\nWe check the queue.'
    expect(only('J04', text)).toEqual([])
  })

  test('the project name and known words pass', () => {
    expect(only('J04', '# jargone\n\njargone checks the SLO.', { projectName: 'jargone', glossary: glossary({ known: ['SLO'] }) })).toEqual([])
    expect(termsOf(only('J04', '# jargone\n\njargone checks the queue.'))).toEqual(['jargone'])
  })

  test('a plainer word from the replacement list is suggested', () => {
    expect(only('J04', '# Guide\n\nWe implement the queue.', { lists: loadLists(familiarity(), REPLACEMENTS, '') })[0].suggestion).toEqual(['carry out'])
  })

  test('no swap is offered for a word on the technical-exceptions list, by J04 or J01, as by J07', () => {
    // LISTS has "implement" on both the replacement list and the exceptions list
    const j04 = only('J04', '# Guide\n\nWe implement the queue.')
    expect(termsOf(j04)).toEqual(['implement'])
    expect(j04[0].suggestion).toBe(undefined)
    const j01 = only('J01', 'We implement jobs. We implement tasks.')
    expect(termsOf(j01)).toEqual(['implement'])
    expect(j01[0].suggestion).toBe(undefined)
    // the same text without the exception: the swap is offered, so the test above is not empty
    expect(only('J01', 'We implement jobs. We implement tasks.', { lists: loadLists(familiarity(), REPLACEMENTS, '') })[0].suggestion).toEqual(['carry out'])
  })
})

describe('J05 nothing lost', () => {
  const j05 = (original: string, text: string, more: Partial<CheckInput> = {}) =>
    run(text, { original, codes: ['J05'], ...more }).findings

  test('a number from the original must appear unchanged', () => {
    expect(j05('A queue holds 1,500 jobs.', 'A queue holds 1500 jobs.').map(f => [f.code, f.severity, f.term, f.line])).toEqual([['J05', 'error', '1,500', 1]])
    expect(j05('A queue holds 1,500 jobs.', 'Up to 1,500 jobs wait.')).toEqual([])
  })

  test('content in a file the detail moved to counts', () => {
    const original = 'A queue holds 1,500 jobs.\n\nOld jobs wait 30 days.'
    expect(termsOf(j05(original, 'A queue holds 1,500 jobs.'))).toEqual(['30'])
    expect(j05(original, 'A queue holds 1,500 jobs.', { moved: [{ path: 'README-reference.md', text: 'Old jobs wait 30 days.' }] })).toEqual([])
  })

  test('inline code must appear unchanged', () => {
    expect(termsOf(j05('Run `npm test` first.', 'Run `npm run test` first.'))).toEqual(['npm test'])
    expect(j05('Run `npm test` first.', 'First, run `npm test`.')).toEqual([])
  })

  test('a code block must appear unchanged, wherever its indent puts it', () => {
    const block = '```\nmake all\nmake test\n```'
    expect(j05(block, '```\nmake  all\nmake test\n```').map(f => f.message)).toEqual(['The code block on line 1 of the original is missing or changed. Keep code exactly as it was.'])
    expect(j05(block, '1. Build it:\n\n   ```\n   make all\n   make test\n   ```')).toEqual([])
  })

  test('a link target must appear unchanged', () => {
    expect(termsOf(j05('See [the guide](docs/guide.md).', 'See the guide.'))).toEqual(['docs/guide.md'])
  })

  test('a link to a heading of the document must still lead to it', () => {
    const r = j05('# Setup\n\nSee [setup](#setup).', '# Getting ready\n\nSee [setup](#setup).')
    expect(r.map(f => [f.term, f.line])).toEqual([['#setup', 3]])
  })

  test('a heading that moved is found through the rewrite\'s link to the moved file', () => {
    const original = '# Guide\n\nSee [options](#options).\n\n## Options\n\nA list.'
    const moved = [{ path: 'README-reference.md', text: '## Options\n\nA list.' }]
    expect(j05(original, '# Guide\n\nSee [options](README-reference.md#options).', { moved })).toEqual([])
  })

  test('a link from another file to a reworded heading is an error; one already broken is not', () => {
    const inbound = [{ from: 'docs/a.md', fragment: 'setup' }, { from: 'docs/b.md', fragment: 'gone' }, { from: 'docs/c.md' }]
    const r = j05('# Setup\n\nWe check the queue.', '# Getting ready\n\nWe check the queue.', { inbound })
    expect(r.map(f => [f.term, f.line])).toEqual([['#setup', 1]])
    expect(r[0].message).toMatch(/docs\/a\.md/)
  })

  test('a definition title on its own line is not prose', () => {
    expect(run('See [x][r].\n\n[r]: https://e.com\n  "Title"\n\nWe check it.').scores.sentences).toBe(2)
  })

  test('a fragment is compared as a browser does: escapes decoded, any case', () => {
    const r = j05('# Intro\n\n## Café menu\n\nWe check the queue.', '# Intro\n\n## Menu\n\nWe check the queue.', { inbound: [{ from: 'docs/a.md', fragment: 'Caf%C3%A9-menu' }] })
    expect(r.map(f => [f.term, f.line])).toEqual([['#Caf%C3%A9-menu', 3]])
    const original = '# Guide\n\nSee [the menu](#caf%C3%A9-menu).\n\n## Café menu\n\nA list.'
    const moved = [{ path: 'README-reference.md', text: '## Café menu\n\nA list.' }]
    expect(j05(original, '# Guide\n\nSee [the menu](README-reference.md#Caf%C3%A9-Menu).', { moved })).toEqual([])
  })

  test('a link already broken in the original is not blamed on the rewrite', () => {
    expect(j05('See [x](#nowhere).', 'See [x](#nowhere).')).toEqual([])
  })

  test('without a saved original J05 does not run, and the summary says so', () => {
    const r = run('See [x](#nowhere). We hold 5 jobs.', { codes: ['J05'] })
    expect(r.findings).toEqual([])
    expect(r.summary).toMatch(/J05 did not run: there is no saved original/)
  })
})

describe('J06 scores, for information', () => {
  test('Flesch reading ease, Flesch-Kincaid grade and sentence lengths follow the formulas and the syllable rule', () => {
    // reading 2 + takes 2 + time 1, plain 1 + words 1 + help 1: 8 syllables, 6 words, 2 sentences
    expect(run('Reading takes time. Plain words help.').scores).toEqual({ flesch: 91, grade: 1.3, avgSentence: 3, longestSentence: 3, words: 6, sentences: 2 })
  })

  test('scores are never a finding, and the summary gives them before and after', () => {
    const long = `${Array.from({ length: 60 }, () => 'incomprehensibilities').join(' ')}.`
    const r = run(long, { codes: ['J06'], original: 'We check the queue.' })
    expect(r.findings).toEqual([])
    expect(r.summary).toMatch(/^No findings\. Scores, for information only: reading ease -?\d+(\.\d)?, .* longest 60 words; before the rewrite, reading ease /)
  })
})

describe('J07 a plainer word is available', () => {
  test('a word on the replacement list is a warning with its replacements', () => {
    expect(only('J07', 'Utilize the queue.')).toEqual([{
      code: 'J07', severity: 'warning', line: 1, term: 'Utilize', suggestion: ['use'],
      message: '"Utilize" has a plainer option: try "use". This is a suggestion only: keep the word if a swap would change the meaning.',
    }])
  })

  test('other forms of the word, and phrases, match', () => {
    expect(termsOf(only('J07', 'We utilized it in order to help.'))).toEqual(['utilized', 'in order to'])
  })

  test('an entry written with a prefix matches only that form', () => {
    const lists = loadLists(familiarity(), JSON.stringify([{ from: 're-run', to: ['run again'], source: 'test' }]), '')
    expect(only('J07', 'We run it.', { lists })).toEqual([])
    expect(termsOf(only('J07', 'We re-run it.', { lists }))).toEqual(['re-run'])
  })

  test('a word on the exceptions list or the glossary\'s known list is left alone', () => {
    expect(only('J07', 'We implement the queue.')).toEqual([])
    expect(only('J07', 'Utilize the queue.', { glossary: glossary({ known: ['utilize'] }) })).toEqual([])
  })

  test('the other forms of a word on the exceptions list are left alone too', () => {
    const text = 'We implemented the queue. It implements the rest.'
    expect(only('J07', text)).toEqual([])
    // without the exception both forms are flagged, so the line above is not empty by accident
    expect(termsOf(only('J07', text, { lists: loadLists(familiarity(), REPLACEMENTS, '') }))).toEqual(['implemented'])
  })

  test('an advice note and an "unless" note are passed on; every line is named', () => {
    expect(only('J07', 'In order to help.')[0].message).toBe('"In order to" has a plainer option: try "to". (omit) This is a suggestion only: keep the word if a swap would change the meaning.')
    expect(only('J07', 'Additional jobs wait.\n\nAdditional jobs run.')[0].message).toBe('"Additional" has a plainer option: try "more". Keep it if it means added. This is a suggestion only: keep the word if a swap would change the meaning. Also on line 3.')
  })
})

describe('anchorsOf, GitHub\'s heading anchors', () => {
  test('lower case, punctuation dropped, spaces to hyphens, repeats numbered', () => {
    const md = '# Hello, World!\n\n## Hello, World!\n\n## 🚀 Features\n\n## The `foo()` call\n\n## [Linked](x) *Emphasis*\n'
    expect(anchorsOf(md)).toEqual(['hello-world', 'hello-world-1', '-features', 'the-foo-call', 'linked-emphasis'])
  })

  test('setext headings and HTML ids count; a "#" line in code does not', () => {
    expect(anchorsOf('Title\n=====\n\nSub part\n--------\n\n```\n# not a heading\n```\n\n<a id="here"></a>')).toEqual(['title', 'sub-part', 'here'])
    expect(anchorsOf('<h1 id="top-id">Name</h1>\n\n## A <a name="x"></a> b')).toEqual(['a--b', 'top-id', 'x'])
  })
})

describe('linksIn', () => {
  test('every kind of link, split at "#", with its line', () => {
    const md = 'See [a](docs/a.md#part) and ![b](img.png).\n\n<https://x.org> and https://y.org/p.\n\n[ref]: ../c.md\n\n<a href="d.html">d</a> [e](#e)'
    expect(linksIn(md)).toEqual([
      { target: 'img.png', line: 1 },
      { target: 'docs/a.md', fragment: 'part', line: 1 },
      { target: 'https://x.org', line: 3 },
      { target: 'https://y.org/p', line: 3 },
      { target: '../c.md', line: 5 },
      { target: '', fragment: 'e', line: 7 },
      { target: 'd.html', line: 7 },
    ])
  })
})

describe('replyNote, session mode', () => {
  const long = `Queue ${Array.from({ length: 40 }, () => 'queue').join(' ')}.`

  test('the note counts undefined terms and gives the longest sentence', () => {
    const r = replyNote(`We check the SLO, the API and the CPU. ${long}`, LISTS)
    expect(r).toMatchObject({ ok: false, note: 'jargone: 3 undefined terms, longest sentence 41 words', more: 0 })
    expect(r.findings.map(f => f.code)).toEqual(['J01', 'J01', 'J01', 'J03'])
  })

  test('a plainer word is named in the note; a clean reply is ok', () => {
    expect(replyNote('Utilize the queue.', LISTS).note).toBe('jargone: 1 word has a plainer option')
    expect(replyNote('We check the queue.', LISTS)).toEqual({ ok: true, note: 'jargone: nothing to flag', findings: [], more: 0 })
  })

  test('at most `cap` findings, errors first, and the rest counted', () => {
    const r = replyNote('Utilize the queue.\n\nWe check the SLO, API, CPU, RAM and GPU.', LISTS, undefined, 2)
    expect(r.findings.map(f => f.term)).toEqual(['SLO', 'API'])
    expect(r.more).toBe(4)
  })

  test('the cap is 10 when not given', () => {
    const r = replyNote('We check AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL and AM.', LISTS)
    expect([r.findings.length, r.more]).toEqual([10, 2])
  })

  test('code and quotations in a reply are skipped', () => {
    expect(replyNote('Run `SLO API` and "CPU", then:\n\n```\nGPU RAM\n```', LISTS).ok).toBe(true)
  })

  test('only J01, J03 and J07 run on a reply', () => {
    const g = glossary({ same: [['job', 'task']] })
    expect(replyNote('We check idempotent jobs. A task waits.', LISTS, g).ok).toBe(true)
  })
})

import { describe, expect, test } from 'claude-code/testing'
import {
  anchorsOf, checkText, DEFAULT_GLOSSARY, DEFAULT_KNOWN, definedTerms, filterKnown, linksIn, loadLists, parseGlossary,
  passes, replyNote, wordsOf,
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
  { from: 'it is', to: ['(omit)'], source: 'test' },
  { from: 'identical', to: ['same'], source: 'test' },
])

// "throttle" is in the list but below the 6.0 cut-off; "utilize" is above it.
const LISTS = loadLists(familiarity(['throttle\t5.2', 'utilize\t6.1']), REPLACEMENTS, '# words a swap would change\nimplement\n')

const run = (text: string, more: Partial<CheckInput> = {}) => checkText({ text, lists: LISTS, ...more })
const only = (code: Code, text: string, more: Partial<CheckInput> = {}) => run(text, { codes: [code], ...more }).findings
const termsOf = (fs: Finding[]) => fs.map(f => f.term)
const glossary = (g: Partial<Glossary>): Glossary => ({ ...DEFAULT_GLOSSARY, ...g })
/** n words, none of them a verb that opens a step. */
const words = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 ? 'jobs' : 'queue')).join(' ')

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

describe('severity, and what passes', () => {
  test('J01, J04 and J07 find hints, J03 warnings, J02 and J05 errors', () => {
    const text = `# Guide\n\nWe utilize the SLO.\n\nA job waits. The task runs.\n\n${words(31)}.`
    const r = run(text, { original: 'We hold 5 jobs.', glossary: glossary({ same: [['job', 'task']] }) })
    const by = new Map(r.findings.map(f => [f.code, f.severity]))
    expect([...by.entries()].sort()).toEqual([['J01', 'hint'], ['J02', 'error'], ['J03', 'warning'], ['J04', 'hint'], ['J05', 'error'], ['J07', 'hint']])
  })

  test('a check passes when it has no errors: warnings and hints never make it fail', () => {
    const soft = run(`We utilize the SLO.\n\n${words(31)}.`)
    expect(soft.findings.map(f => f.severity).sort()).toEqual(['hint', 'hint', 'hint', 'warning'])
    expect(passes(soft.findings)).toBe(true)
    expect(soft.summary).toMatch(/^Passes: 0 errors, 1 warning and 3 hints \(J01: 1, J03: 1, J04: 1, J07: 1\)\./)
    const hard = run('A job waits. The task runs.', { glossary: glossary({ same: [['job', 'task']] }) })
    expect(passes(hard.findings)).toBe(false)
    expect(hard.summary).toMatch(/^Does not pass: 1 error, 0 warnings and 0 hints \(J02: 1\)\./)
    expect(passes([])).toBe(true)
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
    ['a quotation holding a quotation', 'He wrote "they call it "kubelet mode" because the kubelet waits" and left.'],
    ['a > block quote', '> The kubelet waits. The kubelet runs.\n\nWe check the queue.'],
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

  test('a quotation inside a quotation does not end the outer one early', () => {
    // with the inner quotation's closing mark taken as the outer one's, "spec" and "LLMs" were read as prose
    const text = 'He asks for "80% of the way" in "plain words, since "the kubelet is strict" for ZQX, and ZQX reads the kubelet" today.'
    expect(only('J01', text)).toEqual([])
    expect(termsOf(only('J01', 'We read the kubelet. It waits for ZQX, and ZQX reads the kubelet.'))).toEqual(['kubelet', 'ZQX'])
  })

  test('a line that carries on a quoted paragraph without its ">" is still the quotation', () => {
    expect(only('J01', '> The kubelet waits\nand the kubelet runs and the kubelet stops.')).toEqual([])
    expect(only('J04', '# Guide\n\n> Quoted kubelet\nstill quoted kubelet.\n\nWe check the queue.')).toEqual([])
    // an inline tag or an autolink carries it on too
    expect(only('J01', '> here\n<kbd>x</kbd> kubelet kubelet')).toEqual([])
    expect(only('J01', '> here\n<https://x.y> kubelet kubelet')).toEqual([])
    // a line that starts a block of its own ends the quotation: a list item of any number, or a block-level tag
    expect(termsOf(only('J01', '> The queue waits.\n- The kubelet runs. The kubelet stops.'))).toEqual(['kubelet'])
    expect(termsOf(only('J01', '> here\n2. kubelet kubelet'))).toEqual(['kubelet'])
    expect(termsOf(only('J01', '> here\n<div>kubelet kubelet</div>'))).toEqual(['kubelet'])
    // a "[!NOTE]" line inside a quotation, after a lazy line, does not open an alert
    expect(only('J01', '> The queue waits\nand runs.\n> [!NOTE]\n> The kubelet stops. The kubelet ends.')).toEqual([])
    // and a setext underline cannot be lazy, so the quotation is not a heading
    expect(anchorsOf('> Title\n===')).toEqual([])
  })

  test('a GitHub alert keeps its text across a line without ">", and a `>` inside it is a quotation', () => {
    expect(termsOf(only('J04', '# Guide\n\n> [!WARNING]\nDeprecated since zqx.\n\nWe check the queue.'))).toEqual([])
    expect(termsOf(only('J01', '> [!NOTE]\n> The queue waits\nand runs.\n>\n> The kubelet stops. The kubelet ends.'))).toEqual(['kubelet'])
    expect(only('J01', '# T\n\n> [!NOTE]\n> > kubelet said kubelet\n\ndone.')).toEqual([])
    // the text that starts without ">" and the ">" lines after it are one paragraph of the alert
    expect(run('# T\n\n> [!NOTE]\nDeprecated since the\n> queue and the jobs.', { codes: ['J03'] }).summary).toMatch(/Longest sentence: 7 words\./)
  })

  test('the line right after "[!NOTE]" is the alert\'s text even when indented: it is not code', () => {
    expect(termsOf(only('J01', '# T\n\nWe read the file.\n\n> [!NOTE]\n    Kubelet kubelet runs.\n'))).toEqual(['Kubelet'])
    expect(termsOf(only('J01', '# T\n\nWe read the file.\n\n> [!NOTE]\n>     Kubelet kubelet runs.\n'))).toEqual(['Kubelet'])
    // a deeper quotation that opens there may hold indented code, as anywhere else
    expect(wordsOf('> [!NOTE]\n> >     kubelet runs\n').size).toBe(0)
  })

  test('only the line right after "[!NOTE]" can carry an alert\'s text without ">"; GitHub opens an alert only at the first level', () => {
    expect(termsOf(only('J04', '# Guide\n\n> [!NOTE]\n> ## Heads up\nWe check the zqx.'))).toEqual(['zqx'])
    expect(termsOf(only('J04', '# Guide\n\n> [!NOTE]\n> Heads up.\n>\nWe check the zqx.'))).toEqual(['zqx'])
    expect(only('J01', '> > [!NOTE]\n> > Note text.\n>\n> The kubelet said the kubelet runs.')).toEqual([])
  })

  test('a `>` block quote is a quotation for J01, J03 and J07; a GitHub alert is the writer\'s own note', () => {
    const quote = `> The kubelet restarts each job. The kubelet then utilizes the queue and ${words(30)}.`
    expect(run(quote, { codes: ['J01', 'J03', 'J07'] }).findings).toEqual([])
    const alert = `> [!NOTE]\n${quote}`
    expect(run(alert, { codes: ['J01', 'J03', 'J07'] }).findings.map(f => f.code)).toEqual(['J01', 'J03', 'J07'])
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

  test('a hyphenated word is one word: a prefix such as "re-" makes no word of its own, and a common word stays common', () => {
    expect(only('J01', 'We re-read the file and re-check the list.')).toEqual([])
    expect(only('J04', '# Guide\n\nWe re-read the file.')).toEqual([])
    // "set-ups" is not split into "set" and "ups": every part is common, so it is not a term
    expect(only('J01', 'The set-ups differ. Two set-ups wait.')).toEqual([])
    expect(termsOf(only('J01', 'A kubelet-run job waits. The kubelet-run list grows.'))).toEqual(['kubelet-run'])
    // a word inside a compound is not that word: "identical" in "byte-identical" is not offered a swap
    expect(only('J07', 'The files are byte-identical.')).toEqual([])
  })

  test('a hyphenated word whose parts are known (the glossary, DEFAULT_KNOWN, the project\'s name) or common is known', () => {
    const g = glossary({ known: ['kubelet'] })
    expect(only('J01', 'The kubelet-made job waits. The kubelet-made queue runs.', { glossary: g })).toEqual([])
    expect(only('J04', '# Guide\n\nWe run kubelet-made jobs.', { glossary: g })).toEqual([])
    expect(only('J04', '# Guide\n\nWe run API-made jobs.')).toEqual([])
    expect(only('J04', '# Guide\n\nWe run jargone-made jobs.', { projectName: 'jargone' })).toEqual([])
    // a known part does not make an unknown part known
    expect(termsOf(only('J04', '# Guide\n\nWe run kubelet-zqx jobs.', { glossary: g }))).toEqual(['kubelet-zqx'])
    // and common parts alone do not make a word known, so J07 still reads it
    const lists = loadLists(familiarity(), JSON.stringify([{ from: 're-run', to: ['run again'], source: 'test' }]), '')
    expect(termsOf(only('J07', 'We re-run it.', { lists }))).toEqual(['re-run'])
  })

  test('a hyphenated name with a digit or an inner capital is one name or identifier, not a term', () => {
    expect(only('J01', 'CB-001 failed. Then CB-001 ran. We read ASD-STE100 twice: ASD-STE100. The iso-24495 rules and iso-24495 tests.')).toEqual([])
    // an inner capital alone is enough, even where a capital opens a sentence
    expect(only('J01', 'E-USEFUL failed. E-USEFUL ran.')).toEqual([])
  })

  test('a full stop ends a sentence, but not after a title such as "Dr."', () => {
    const g = glossary({ max_words: 8 })
    expect(only('J03', 'We read the file. Then we read the list.', { glossary: glossary({ max_words: 6 }) })).toEqual([])
    expect(only('J03', 'We asked Dr. Lee to read the file and the list.', { glossary: g }).map(f => f.message)).toEqual([
      'A sentence has 11 words; the limit is 8. Split it.',
    ])
  })

  test('a full stop ends a sentence even when the next word starts with a small letter', () => {
    expect(only('J03', `We read the queue and the jobs and ${words(13)}. jargone then reads ${words(17)}.`)).toEqual([])
    expect(run(`We read ${words(18)}. jargone reads it.`, { codes: ['J03'] }).summary).toMatch(/Longest sentence: 20 words\./)
  })

  test('"e.g." and "i.e." never end a sentence; "etc." ends one only before a capital', () => {
    const g = glossary({ max_words: 6 })
    expect(only('J03', 'We run jobs, e.g. the queue and the list.', { glossary: g }).map(f => f.message)).toEqual(['A sentence has 9 words; the limit is 6. Split it.'])
    expect(only('J03', 'We run jobs, i.e. the queue and the list.', { glossary: g })).toHaveLength(1)
    expect(only('J03', 'Queues, jobs, etc. are in the same list.', { glossary: g })).toHaveLength(1)
    expect(only('J03', 'Queues, jobs, etc. Then we read the list.', { glossary: g })).toEqual([])
  })

  test('a line that is one bold span is a title: it does not join the sentence after it', () => {
    const text = `- **The queue and the jobs and the list**\n  ${words(25)}.`
    expect(only('J03', text, { glossary: glossary({ max_words: 25 }) })).toEqual([])
    expect(run(text, { codes: ['J03'] }).summary).toMatch(/Longest sentence: 25 words\./)
  })
})

describe('J01 terms used before they are defined', () => {
  test('an acronym is a term even when used once, and is a hint', () => {
    expect(only('J01', 'We check the SLO.')).toEqual([{
      code: 'J01', severity: 'hint', line: 1, term: 'SLO',
      message: '"SLO" is not written out where it first appears. A hint, not an error: if the reader may not know it, write it out there or in the next sentence, for example "Full Name (SLO)". If every reader knows it, add it to "known" in .jargone/glossary.json.',
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

  test('the everyday acronyms of DEFAULT_KNOWN are known to J01, J04 and J07 without a glossary', () => {
    expect(DEFAULT_KNOWN).toEqual(expect.arrayContaining(['PR', 'API', 'CSV', 'ID', 'URL', 'PDF', 'UI', 'FAQ', 'LLM', 'README']))
    expect(only('J01', 'Open a PR for the API. Read the README and the READMEs.')).toEqual([])
    expect(only('J04', '# Guide\n\nRead the README.')).toEqual([])
    expect(termsOf(only('J01', 'Open a ZQ for the ZQX.'))).toEqual(['ZQ', 'ZQX'])
  })

  const forms: [string, string][] = [
    ['Full Name (ACRONYM)', 'We set a service level objective (SLO) for each job.'],
    ['term (meaning)', 'We set an SLO (a target for how often a job works) for each job.'],
    ['term — meaning', 'We set an SLO — a target for how often a job works.'],
    ['term is …', 'An SLO is a target for how often a job works.'],
    ['term means …', 'SLO means a target for how often a job works.'],
    ['X is called TERM', 'A target for how often a job works is called an SLO.'],
    ['called TERM', 'We set a target, called the SLO, for each job.'],
  ]
  for (const [form, sentence] of forms) {
    test(`a definition of the form "${form}" counts`, () => {
      expect(only('J01', `${sentence} Each day we check the SLO.`)).toEqual([])
    })
  }

  test('the full name before "(ACRONYM)" may be a quotation, but one with no words', () => {
    expect(only('J01', 'We track a "service level objective" (SLO) for each job. Each day we check the SLO.')).toEqual([])
    expect(definedTerms('A "pod group" (PG) runs.')).toEqual(['PG'])
    expect(definedTerms('Run "—" (SLO) daily. We check the SLO.')).toEqual([])
  })

  test('"called" after "we", "it" or another subject is an action, not a definition', () => {
    expect(termsOf(only('J01', 'We called the SLO twice. Each day we check the SLO.'))).toEqual(['SLO'])
    // "it's called" is "it is called": a name given
    expect(only('J01', "It's called the SLO for short. Each day we check the SLO.")).toEqual([])
    expect(definedTerms("They're called RAD. RAD runs.")).toEqual(['RAD'])
    // but "we've called" and "he'd called" are still actions
    expect(definedTerms("We've called the deploy script twice. He'd called the Payment Service.")).toEqual([])
  })

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

describe('the glossary\'s known list', () => {
  test('an entry with code in it is compared as written: its words are not known', () => {
    expect(termsOf(only('J01', 'The kubelet waits. The kubelet runs.', { glossary: glossary({ known: ['`zq` kubelet'] }) }))).toEqual(['kubelet'])
  })

  test('an entry is read as filterKnown reads it: a number is part of the phrase', () => {
    const g = glossary({ known: ['zqx 2'] })
    expect(termsOf(only('J01', 'We use zqx here. Then zqx runs.', { glossary: g }))).toEqual(['zqx'])
    expect(only('J01', 'We use zqx 2 here. Then zqx 2 runs.', { glossary: g })).toEqual([])
    expect(filterKnown(['zqx'], new Set(), g)).toEqual(['zqx'])
    expect(filterKnown(['zqx 2'], new Set(), g)).toEqual([])
  })

  test('an entry of several words is one phrase: it silences that phrase, not its words on their own', () => {
    const g = glossary({ known: ['idempotent consumer', 'it is'] })
    expect(only('J01', 'An idempotent consumer waits. The idempotent consumer runs.', { glossary: g })).toEqual([])
    expect(termsOf(only('J01', 'An idempotent job waits. The idempotent job runs.', { glossary: g }))).toEqual(['idempotent'])
    expect(only('J04', '# Guide\n\nAn idempotent consumer waits.', { glossary: g })).toEqual([])
    expect(termsOf(only('J04', '# Guide\n\nAn idempotent job waits.', { glossary: g }))).toEqual(['idempotent'])
    expect(only('J07', 'It is saved. It is done.', { glossary: g })).toEqual([])
    expect(termsOf(only('J07', 'It is saved.'))).toEqual(['It is'])
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
  test('a sentence over 30 words is a warning; 30 is not', () => {
    expect(only('J03', `${words(31)}.`)).toEqual([{ code: 'J03', severity: 'warning', line: 1, message: 'A sentence has 31 words; the limit is 30. Split it.' }])
    expect(only('J03', `${words(30)}.`)).toEqual([])
  })

  test('the limit is 20 in a numbered step that opens with a verb; in a bullet, or a numbered item that is not a step, it is 30', () => {
    expect(only('J03', `1. Check ${words(20)}.`).map(f => f.message)).toEqual(['A sentence in a numbered step has 21 words; the limit there is 20. Split it.'])
    expect(only('J03', `1. Then run ${words(19)}.`)).toHaveLength(1)
    expect(only('J03', `1. **Open** ${words(20)}.`)).toHaveLength(1)
    expect(only('J03', `- Check ${words(20)}.`)).toEqual([])
    // a numbered list of findings, questions or options is not a procedure
    expect(only('J03', `1. ${words(21)}.\n2. Why ${words(25)}?`)).toEqual([])
    // a bullet inside a step is not the step
    expect(only('J03', `1. Open the file.\n   - ${words(22)}.`)).toEqual([])
  })

  test('the longest sentence is reported even when the scores are not asked for', () => {
    expect(run(`${words(12)}. We check it.`, { codes: ['J03'] }).summary).toBe('Passes: no findings. Longest sentence: 12 words.')
    expect(run('Queue.', { codes: ['J03'] }).summary).toBe('Passes: no findings. Longest sentence: 1 word.')
  })

  test('the glossary changes both limits', () => {
    const g = glossary({ max_words: 10, max_words_in_steps: 5 })
    expect(only('J03', `${words(11)}.\n\n1. Check ${words(5)}.`, { glossary: g }).map(f => f.line)).toEqual([1, 3])
  })

  test('table cells are sentences for J03 and the scores; headings and a table\'s header row are not', () => {
    const cell = `| a | b |\n|---|---|\n| ${words(31)}. | x |`
    expect(only('J03', cell).map(f => [f.line, f.message])).toEqual([[3, 'A sentence has 31 words; the limit is 30. Split it.']])
    expect(run(cell).scores.longestSentence).toBe(31)
    const labels = `# ${words(31)}\n\n| ${words(31)} | b |\n|---|---|\n| x | y |\n\nWe check the queue.`
    expect(only('J03', labels)).toEqual([])
    expect(run(labels).scores.longestSentence).toBe(4)
  })
})

describe('J04 the opening', () => {
  test('an uncommon word in the first paragraph is a hint, even when explained there', () => {
    const r = run('# Guide\n\nWe check the SLO (service level objective).', { codes: ['J01', 'J04'] })
    expect(r.findings.map(f => [f.code, f.severity, f.term, f.line])).toEqual([['J04', 'hint', 'SLO', 3]])
  })

  test('only the first paragraph is read', () => {
    expect(only('J04', '# Guide\n\nWe check the queue.\n\nWe check the SLO.')).toEqual([])
  })

  test('the opening is the first paragraph after the title: a line above the title is not it', () => {
    expect(termsOf(only('J04', 'Status: draft.\n\n# Guide\n\nWe check the kubelet.'))).toEqual(['kubelet'])
    // with no level-1 title first, the opening is the document's first paragraph
    expect(termsOf(only('J04', 'We check the kubelet.\n\n## Part\n\nWe check the queue.'))).toEqual(['kubelet'])
  })

  test('a GitHub alert is not the opening: J04 reads the first paragraph after it', () => {
    expect(termsOf(only('J04', '# Guide\n\n> [!WARNING]\n> Deprecated since kubelet two.\n\nWe check the zqx.'))).toEqual(['zqx'])
  })

  test('a byte-order mark before the title changes nothing: the title keeps its anchor, the opening is the paragraph after it', () => {
    expect(only('J04', '\uFEFF# Guide\n\nWe check the kubelet.').map(f => [f.term, f.line])).toEqual([['kubelet', 3]])
    expect(anchorsOf('\uFEFF# Guide\n\n## Setup')).toEqual(['guide', 'setup'])
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

  test('a number counts only in the rewrite\'s prose: not in a list marker, a link target, a web address, an HTML comment, code or front matter', () => {
    const lost = (rewrite: string) => termsOf(j05('Old jobs wait 3 days.\n\n1. Read.\n2. Run.', rewrite))
    expect(lost('Old jobs wait.\n\n1. Read.\n2. Run.\n3. Stop.')).toEqual(['3'])
    expect(lost('Old jobs wait. See [the list](https://e.com/3).\n\n1. Read.\n2. Run.')).toEqual(['3'])
    expect(lost('Old jobs wait. See https://e.com/3 for more.\n\n1. Read.\n2. Run.')).toEqual(['3'])
    expect(lost('Old jobs wait. <!-- 3 -->\n\n1. Read.\n2. Run.')).toEqual(['3'])
    expect(lost('Old jobs wait. Run `sleep 3`.\n\n1. Read.\n2. Run.')).toEqual(['3'])
    expect(lost('---\ndays: 3\n---\nOld jobs wait.\n\n1. Read.\n2. Run.')).toEqual(['3'])
    // the control: the number in prose is kept
    expect(lost('Old jobs wait three days, 3 in all.\n\n1. Read.\n2. Run.')).toEqual([])
  })

  test('numbers are counted: a number the original uses twice must be there twice', () => {
    const r = j05('It retries 3 times.\n\nIt waits 3 seconds.', 'It retries 3 times.')
    expect(r.map(f => [f.term, f.line])).toEqual([['3', 1]])
    expect(r[0].message).toBe('The number 3 is in the original 2 times (lines 1, 3), but once in the rewrite. Each use is a fact to keep.')
    expect(j05('It retries 3 times.\n\nIt waits 3 seconds.', 'It waits 3 seconds and retries 3 times.')).toEqual([])
  })

  test('a code span inside an HTML comment counts on neither side', () => {
    expect(termsOf(j05('Run `npm i tool` now.', 'Run it now. <!-- `npm i tool` -->'))).toEqual(['npm i tool'])
    expect(j05('Run it now. <!-- `npm i tool` -->', 'Run it now.')).toEqual([])
    // but a comment inside a code span is code
    expect(termsOf(j05('Write `<!-- x -->` there.', 'Write it there.'))).toEqual(['<!-- x -->'])
  })

  test('content in a file the detail moved to counts', () => {
    const original = 'A queue holds 1,500 jobs.\n\nOld jobs wait 30 days.'
    expect(termsOf(j05(original, 'A queue holds 1,500 jobs.'))).toEqual(['30'])
    expect(j05(original, 'A queue holds 1,500 jobs.', { moved: [{ path: 'README-reference.md', text: 'Old jobs wait 30 days.' }] })).toEqual([])
  })

  test('only what the reference file gained since before the rewrite counts as moved', () => {
    const original = 'A queue holds 1,500 jobs.\n\nOld jobs wait 30 days. Run `npm test`. See [the list](list.md).'
    const ref = '# Reference\n\nOld jobs wait 30 days. Run `npm test`. See [the list](list.md).'
    const moved = [{ path: 'README-reference.md', text: ref }]
    expect(j05(original, 'A queue holds 1,500 jobs.', { moved, referenceBefore: '' })).toEqual([])
    // the same content, already there before: it stands in for nothing
    expect(termsOf(j05(original, 'A queue holds 1,500 jobs.', { moved, referenceBefore: ref }))).toEqual(['30', 'npm test', 'list.md'])
    // counted: one 30 there before, and a second one gained, which counts
    const more = [{ path: 'README-reference.md', text: `${ref}\n\nNew jobs wait 30 days.` }]
    expect(termsOf(j05(original, 'A queue holds 1,500 jobs.', { moved: more, referenceBefore: ref }))).toEqual(['npm test', 'list.md'])
  })

  test('the summary says what moved, and when the reference file\'s earlier text was not given', () => {
    const original = 'A queue holds 1,500 jobs.\n\nOld jobs wait 30 days.'
    const moved = [{ path: 'README-reference.md', text: 'Old jobs wait 30 days.' }]
    expect(run('A queue holds 1,500 jobs.', { original, codes: ['J05'], moved, referenceBefore: '' }).summary)
      .toBe('Passes: no findings. J05 counted as moved to the reference file, so they are no longer in the document: 1 number.')
    expect(run('A queue holds 1,500 jobs.', { original, codes: ['J05'], moved }).summary)
      .toMatch(/J05 counted everything in the reference file as new, since its text from before the rewrite was not given\.$/)
  })

  test('a copy of the whole original in the reference file is not a move: what the rewrite dropped is still lost', () => {
    const original = '# Guide\n\nThis guide holds 5 rules.\n\nOld jobs wait 30 days.\n\nRun `npm test` first.'
    const moved = [{ path: 'README-reference.md', text: `# Reference\n\n${original}` }]
    const r = j05(original, '# Guide\n\nThis guide holds rules. See the reference.', { moved, referenceBefore: '' })
    expect(r.map(f => f.term)).toEqual(['README-reference.md', '5', '30', 'npm test'])
    expect(r[0].message).toMatch(/^The reference file README-reference\.md gained a copy of the original: its opening paragraph and 4 of its 4 lines, unchanged\./)
    expect(r[1].message).toBe('The number 5 on line 3 of the original is not in the rewrite (the copy of the original in the reference file does not count).')
    // the copy counted for nothing, so the summary does not say everything in it counted as new
    expect(run('# Guide\n\nThis guide holds rules.', { original, codes: ['J05'], moved }).summary).not.toMatch(/counted everything in the reference file/)
    // moving the detail, not the whole, is a move
    const detail = [{ path: 'README-reference.md', text: 'Old jobs wait 30 days.\n\nRun `npm test` first.' }]
    expect(j05(original, '# Guide\n\nThis guide holds 5 rules. See the reference.', { moved: detail, referenceBefore: '' })).toEqual([])
  })

  test('a copy needs the original\'s opening: moving a long table unchanged under a new opening is a move', () => {
    const rows = Array.from({ length: 20 }, (_, i) => `| rule ${i + 1} | ${i + 100} |`).join('\n')
    const original = `# Guide\n\nThis guide lists the rules.\n\n| Rule | Limit |\n|---|---|\n${rows}`
    const moved = [{ path: 'README-reference.md', text: `| Rule | Limit |\n|---|---|\n${rows}` }]
    expect(j05(original, '# Guide\n\nThese rules keep jobs safe. See the reference.', { moved, referenceBefore: '' })).toEqual([])
  })

  test('a copy needs 9 in 10 of the original\'s lines: the opening and some detail is a move', () => {
    const original = '# Guide\n\nThis guide holds 5 rules.\n\nOld jobs wait 30 days.\n\nNew jobs wait 2 days.\n\nRun `npm test` first.'
    const moved = [{ path: 'README-reference.md', text: 'This guide holds 5 rules.\n\nOld jobs wait 30 days.\n\nNew jobs wait 2 days.' }]
    expect(termsOf(j05(original, '# Guide\n\nThe rules. Run `npm test` first.', { moved, referenceBefore: '' }))).toEqual([])
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

  test('a heading written with emphasis keeps the anchor GitHub gives it, so rewording it breaks a link', () => {
    const original = '# Guide\n\nSee [setup](#setup-guide).\n\n## _Setup_ guide\n\nWe check the queue.'
    const r = j05(original, '# Guide\n\nSee [setup](#setup-guide).\n\n## Getting ready\n\nWe check the queue.', { inbound: [{ from: 'docs/a.md', fragment: 'setup-guide' }] })
    expect(r.map(f => [f.term, f.line])).toEqual([['#setup-guide', 3], ['#setup-guide', 5]])
  })

  test('a heading that moved is found through the rewrite\'s link to the moved file', () => {
    const original = '# Guide\n\nSee [options](#options).\n\n## Options\n\nA list.'
    const moved = [{ path: 'README-reference.md', text: '## Options\n\nA list.' }]
    expect(j05(original, '# Guide\n\nSee [options](README-reference.md#options).', { moved })).toEqual([])
  })

  test('a link counts as moved only to a heading the reference file gained, not one it held before', () => {
    const original = '# Guide\n\nSee [options](#options).\n\n## Options\n\nA list.'
    const moved = [{ path: 'README-reference.md', text: '## Options\n\nOld.' }]
    const rewrite = '# Guide\n\nSee [options](README-reference.md#options).'
    expect(j05(original, rewrite, { moved, referenceBefore: '' })).toEqual([])
    expect(termsOf(j05(original, rewrite, { moved, referenceBefore: '## Options\n\nOld.' }))).toEqual(['#options'])
  })

  test('a heading moved beside one of the same name that the reference file already held still counts as moved', () => {
    const original = '# Guide\n\nSee [setup](#setup).\n\n## Setup\n\nRun it.'
    const moved = [{ path: 'ref.md', text: '## Setup\n\nRun it.\n\n## Setup\n\nOld.' }]
    expect(j05(original, '# Guide\n\nSee [setup](ref.md#setup).', { moved, referenceBefore: '## Setup\n\nOld.' })).toEqual([])
  })

  test('a link to an HTML id counts as moved only when the reference file gained that id', () => {
    const original = 'See [x](#here).\n\n<a id="here"></a>Some text.'
    const moved = [{ path: 'ref.md', text: '<a id="here"></a>Old text.' }]
    expect(j05(original, 'See [x](ref.md#here).', { moved, referenceBefore: '' })).toEqual([])
    expect(termsOf(j05(original, 'See [x](ref.md#here).', { moved, referenceBefore: '<a id="here"></a>Old text.' }))).toEqual(['#here'])
  })

  test('a link to a heading in a copy of the original does not count as moved', () => {
    const original = '# Guide\n\nSee [options](#options).\n\n## Options\n\nA list.'
    const moved = [{ path: 'README-reference.md', text: original }]
    expect(termsOf(j05(original, '# Guide\n\nSee [options](README-reference.md#options).', { moved, referenceBefore: '' }))).toEqual(['README-reference.md', '#options'])
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

  test('without a saved original J05 does not run, and the summary says none was read, not that none exists', () => {
    const r = run('See [x](#nowhere). We hold 5 jobs.', { codes: ['J05'] })
    expect(r.findings).toEqual([])
    expect(r.summary).toMatch(/J05 did not run: no saved original was read\./)
    expect(r.summary).not.toMatch(/there is no saved original/)
  })
})

describe('plain text', () => {
  test('an indented paragraph is prose, not code: J01, J03 and the scores read it, and rewording it loses no code', () => {
    const original = `Release notes\n\n\tWe utilize a kubelet cache. The kubelet keeps ${words(35)}.`
    const asText = run(original, { format: 'text', codes: ['J01', 'J03', 'J07'] })
    expect(asText.findings.map(f => f.code)).toEqual(['J01', 'J03', 'J07'])
    expect(asText.scores.longestSentence).toBe(38)
    expect(run(original, { codes: ['J01', 'J03', 'J07'] }).findings).toEqual([]) // as Markdown it is an indented code block
    expect(run('Release notes\n\n\tWe use a cache. It keeps values.', { format: 'text', original, codes: ['J05'] }).findings).toEqual([])
  })

  test('the first line is the title when it stands alone with no closing punctuation: J04 reads the paragraph after it', () => {
    expect(termsOf(only('J04', 'Kubelet notes\n\nWe check the queue.', { format: 'text' }))).toEqual([])
    expect(termsOf(only('J04', 'Kubelet notes\n\nWe check the kubelet.', { format: 'text' }))).toEqual(['kubelet'])
    expect(termsOf(only('J04', 'We check the kubelet.\n\nWe check the queue.', { format: 'text' }))).toEqual(['kubelet'])
  })

  test('no Markdown is read: a "#" line is a paragraph, and brackets and backticks are text', () => {
    const r = run('# Kubelet notes\n\nSee [the queue](kubelet.md) and the kubelet.', { format: 'text', codes: ['J01'] })
    expect(termsOf(r.findings)).toEqual(['Kubelet'])
    // an indented line's number is prose in plain text: dropping it loses a number, not a code block
    const lost = run('We hold 5 jobs.', { format: 'text', original: 'We hold 5 jobs.\n\n    3 more wait.', codes: ['J05'] }).findings
    expect(lost.map(f => [f.term, f.line])).toEqual([['3', 3]])
  })

  test('a wrapped line that starts with a number is not a list item: its number is prose', () => {
    const original = 'The limit is\n30. After that we stop.'
    expect(termsOf(run('The limit is high. After that we stop.', { format: 'text', original, codes: ['J05'] }).findings)).toEqual(['30'])
    expect(run('The limit is\n30. After that we stop.', { format: 'text', original, codes: ['J05'] }).findings).toEqual([])
  })

  test('numbered lines are items, and a step that opens with a verb has the step limit', () => {
    expect(only('J03', `Steps\n\n1. Open ${words(20)}.\n2. ${words(21)}.`, { format: 'text' }).map(f => f.line)).toEqual([3])
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
    expect(r.summary).toMatch(/^Passes: no findings\. Scores, for information only: reading ease -?\d+(\.\d)?, .* longest 60 words; before the rewrite, reading ease /)
  })
})

describe('J07 a plainer word is available', () => {
  test('a word on the replacement list is a hint with its replacements', () => {
    expect(only('J07', 'Utilize the queue.')).toEqual([{
      code: 'J07', severity: 'hint', line: 1, term: 'Utilize', suggestion: ['use'],
      message: '"Utilize" has a plainer option: try "use". A hint, not an error: keep the word if a swap would change the meaning.',
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
    expect(only('J07', 'In order to help.')[0].message).toBe('"In order to" has a plainer option: try "to". (omit) A hint, not an error: keep the word if a swap would change the meaning.')
    expect(only('J07', 'Additional jobs wait.\n\nAdditional jobs run.')[0].message).toBe('"Additional" has a plainer option: try "more". Keep it if it means added. A hint, not an error: keep the word if a swap would change the meaning. Also on line 3.')
  })
})

describe('anchorsOf, GitHub\'s heading anchors', () => {
  test('lower case, punctuation dropped, spaces to hyphens, repeats numbered', () => {
    const md = '# Hello, World!\n\n## Hello, World!\n\n## 🚀 Features\n\n## The `foo()` call\n\n## [Linked](x) *Emphasis*\n'
    expect(anchorsOf(md)).toEqual(['hello-world', 'hello-world-1', '-features', 'the-foo-call', 'linked-emphasis'])
  })

  test('made from the rendered text: emphasis marks go, code and words with underscores keep theirs, an image adds nothing', () => {
    const md = '## _Setup_ guide\n\n## __Bold__ and *it*\n\n## ~~Old~~ new\n\n## snake_case_name here\n\n## The `__init__` call\n\n## Project ![badge](b.svg)\n\n## ![logo](l.png) Title'
    expect(anchorsOf(md)).toEqual(['setup-guide', 'bold-and-it', 'old-new', 'snake_case_name-here', 'the-__init__-call', 'project-', '-title'])
    // a character the parser uses to hold code aside, written in the heading itself, is not mistaken for that code
    expect(anchorsOf('## x\u{F0000} `y`')).toEqual(['x--y'])
  })

  test('setext headings and HTML ids count; a "#" line in code does not', () => {
    expect(anchorsOf('Title\n=====\n\nSub part\n--------\n\n```\n# not a heading\n```\n\n<a id="here"></a>')).toEqual(['title', 'sub-part', 'here'])
    expect(anchorsOf('<h1 id="top-id">Name</h1>\n\n## A <a name="x"></a> b')).toEqual(['a--b', 'top-id', 'x'])
  })

  test('a data-id attribute is not an id', () => {
    expect(anchorsOf('<div data-id="foo" id="bar"></div>')).toEqual(['bar'])
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

  test('data-src and data-href are not links', () => {
    expect(linksIn('<img data-src="lazy.png" src="real.png"> <a data-href="https://x.y/z" href="h.md">x</a>')).toEqual([
      { target: 'real.png', line: 1 },
      { target: 'h.md', line: 1 },
    ])
  })
})

describe('robustness', () => {
  test('many unclosed "](" are read in linear time: 10,000 of them in under a second', () => {
    const text = '[a]('.repeat(10000)
    const t = Date.now()
    replyNote(text, LISTS)
    checkText({ text, lists: LISTS })
    expect(Date.now() - t).toBeLessThan(1000)
  })

  test('a link destination still ends at the bracket that closes it, with balanced brackets inside kept', () => {
    expect(linksIn('[a](x(1)y) [b](p(q)r(s)t) [c](u(v) [d](w x) [e](y)')).toEqual([
      { target: 'x(1)y', line: 1 },
      { target: 'p(q)r(s)t', line: 1 },
      { target: 'y', line: 1 },
    ])
  })
})

describe('replyNote, session mode', () => {
  const long = `Queue ${Array.from({ length: 40 }, () => 'queue').join(' ')}.`

  test('the note reports only the long sentences and how many hints there are', () => {
    const r = replyNote(`We check the SLO, the TLA and the CPU. ${long}`, LISTS)
    expect(r).toMatchObject({ ok: true, note: 'jargone: 1 long sentence (longest 41 words), 3 hints', more: 0 })
    expect(r.findings.map(f => f.code)).toEqual(['J03', 'J01', 'J01', 'J01'])
  })

  test('a reply never fails on these checks: they find warnings and hints, not errors', () => {
    expect(replyNote('Utilize the queue.', LISTS)).toMatchObject({ ok: true, note: 'jargone: 1 hint' })
    expect(replyNote('We check the queue.', LISTS)).toEqual({ ok: true, note: 'jargone: nothing to flag', findings: [], more: 0 })
  })

  test('at most `cap` findings, warnings first, and the rest counted', () => {
    const r = replyNote(`Utilize the queue.\n\nWe check the SLO, TLA, CPU, RAM and GPU.\n\n${long}`, LISTS, undefined, 2)
    expect(r.findings.map(f => f.code)).toEqual(['J03', 'J07'])
    expect(r.more).toBe(5)
  })

  test('the cap is 10 when not given', () => {
    const r = replyNote('We check AB, AC, AD, AE, AF, AG, AH, AJ, AK, AL, AM and AP.', LISTS)
    expect([r.findings.length, r.more]).toEqual([10, 2])
  })

  test('code and quotations in a reply are skipped', () => {
    expect(replyNote('Run `SLO TLA` and "CPU", then:\n\n```\nGPU RAM\n```', LISTS).note).toBe('jargone: nothing to flag')
  })

  test('only J01, J03 and J07 run on a reply', () => {
    const g = glossary({ same: [['job', 'task']] })
    expect(replyNote('# Kubelet\n\nWe check idempotent jobs. A task waits.', LISTS, g).note).toBe('jargone: nothing to flag')
  })
})

describe('the person\'s own words, terms defined earlier, and the model reader\'s list', () => {
  // a phrase's key, as wordsOf writes it: the longest key wordsOf gives for the phrase alone
  const keyOf = (phrase: string) => [...wordsOf(phrase)].sort((a, b) => b.length - a.length)[0]

  test('wordsOf holds each word with its endings removed, and each run of up to 6 words as a phrase', () => {
    const w = wordsOf('I opened the Pull Requests. We ran the stop hook, then "the cold read".')
    for (const p of ['open', 'opens', 'pull', 'request', 'pull request', 'pull requests', 'stop hook', 'the stop hook', 'cold read']) expect([p, w.has(keyOf(p))]).toEqual([p, true])
    expect(w.has(keyOf('hook then'))).toBe(true) // a phrase runs on past a comma within its sentence
    expect(w.has(keyOf('requests we'))).toBe(false) // but not into the next sentence
    expect(w.has(keyOf('I opened the Pull Requests we'))).toBe(false)
    expect(w.has(keyOf('I opened the Pull Requests'))).toBe(true)
  })

  test('wordsOf records phrases of up to 6 words, and no longer', () => {
    const lengths = [...wordsOf('one two three four five six seven')].map(k => k.split(' ').length)
    expect(Math.max(...lengths)).toBe(6)
    expect(lengths.filter(n => n === 6)).toHaveLength(2)
  })

  test('wordsOf leaves out code and link targets, and keeps a token with digits as written', () => {
    const w = wordsOf('Run `kubelet` and see [the page](docs/zqx.md), then commit 6ea9c81.')
    expect(w.has('kubelet')).toBe(false)
    expect(w.has('zqx')).toBe(false)
    expect(w.has('6ea9c81')).toBe(true)
    expect(wordsOf('> The kubelet waits.').has('kubelet')).toBe(true) // a quotation is still the person's own reading
  })

  test('definedTerms lists the terms a text defines, in the forms J01 accepts, each once', () => {
    const text = 'The project is called RAD. An SLO is a target. We set a service level objective (SLO). ' +
      'The kubelet (an agent) runs. We called the API. We keep a list called the moves file, one per document. A "cold read" means a fresh look. ' +
      'The record is called "the exception ledger". It is late, and this is called often.'
    // "objective" in "service level objective (SLO)" is the full name, not a term defined there
    expect(definedTerms(text)).toEqual(['project', 'RAD', 'SLO', 'kubelet', 'moves file', 'cold read', 'record', 'the exception ledger'])
  })

  test('after "called" a term is a quotation, a capitalised name or acronym, or words after "the"; a bare word in lower case is not', () => {
    expect(definedTerms('The hook is called often.')).toEqual(['hook'])
    expect(definedTerms('The hook is called automatically when a file is saved. It is called directly by the runner, once per request.')).toEqual(['hook'])
    expect(definedTerms('A pass called the last read, which checks it.')).toEqual(['last read'])
    expect(definedTerms('We run a step called First Look today.')).toEqual(['First Look'])
    expect(definedTerms('The mode is called "last resort".')).toEqual(['mode', 'last resort'])
  })

  test('definedTerms counts a definition only where J01 would: in the sentence of first use or the next', () => {
    expect(definedTerms('Restart the kubelet. Then wait. See the kubelet (below).')).toEqual([])
    expect(definedTerms('Restart the kubelet. The kubelet (a helper) waits.')).toEqual(['kubelet'])
  })

  test('filterKnown drops terms the person used or the glossary knows, a phrase only as a phrase', () => {
    const known = wordsOf('I opened the pull requests and checked the stop hook. See 6ea9c81. A kubelet runs.')
    const g = glossary({ known: ['idempotent consumer', 'SLO'] })
    const terms = ['pull request', 'stop hook', 'hook stop', 'SLO', 'Kubelets', '6ea9c81', 'idempotent', 'idempotent consumer', ' ', 'SLOs', 'Hook Stops', 'idempotent']
    expect(filterKnown(terms, known, g)).toEqual(['hook stop', 'idempotent'])
  })

  test('filterKnown reads a term the way wordsOf read the person\'s text: numbers kept, brackets passed over', () => {
    const known = wordsOf('We run the Python 3 runtime here. The SLO (service level objective) holds.')
    expect(filterKnown(['Python 3 runtime', 'SLO (service level objective)', 'Python 4 runtime', 'service level'], known)).toEqual(['Python 4 runtime'])
  })

  test('quotations and `>` block quotes are read as prose is: numbers kept, code ends a run, a sentence ends a phrase', () => {
    const keyOf = (phrase: string) => [...wordsOf(phrase)].sort((a, b) => b.length - a.length)[0]
    expect(filterKnown(['zqx 2'], wordsOf('We use "zqx 2" here.'))).toEqual([])
    expect(filterKnown(['zqx 2'], wordsOf('> We use zqx 2 here.'))).toEqual([])
    expect(wordsOf('> step 3 done').has(keyOf('step done'))).toBe(false)
    expect(filterKnown(['run now'], wordsOf('> Run `x` now.'))).toEqual(['run now'])
    expect(filterKnown(['run now'], wordsOf('Run `x` now.'))).toEqual(['run now'])
    expect(wordsOf('> I opened the Pull Requests. We ran it.').has(keyOf('requests we'))).toBe(false)
  })

  test('a term that runs over a sentence\'s end, or holds code, has no key the person\'s words can match', () => {
    expect(filterKnown(['Stop. Go'], wordsOf('Stop go now.'))).toEqual(['Stop. Go'])
    expect(filterKnown(['kubectl\n\n    apply it'], wordsOf('kubectl apply it'))).toEqual(['kubectl\n\n    apply it'])
    // not even text written with stray backticks
    expect(filterKnown(['`kubectl`'], wordsOf('see ``kubectl` here'))).toEqual(['`kubectl`'])
  })

  test('a quotation joins the run around it only when it reads as part of the sentence', () => {
    const keyOf = (phrase: string) => [...wordsOf(phrase)].sort((a, b) => b.length - a.length)[0]
    expect(wordsOf('We "run `x`" now').has(keyOf('run now'))).toBe(false)
    expect(filterKnown(['done then'], wordsOf('Say "done." Then we go.'))).toEqual(['done then'])
    expect(wordsOf('the "—" sign here').has(keyOf('the sign'))).toBe(true)
    expect(wordsOf('the "cold read" step').has(keyOf('the cold read step'))).toBe(true)
    // a full stop that ends no sentence ("vs.", "e.g.") does not stop it joining, as in prose
    expect(filterKnown(['the vs. operator'], wordsOf('Use the "vs." operator.'))).toEqual([])
  })

  test('a term with code in it is never known from the person\'s words; a quotation in it is read as words', () => {
    expect(filterKnown(['`kubectl` apply', 'run `x` now'], wordsOf('Please apply it. Then run `x` now.'))).toEqual(['`kubectl` apply', 'run `x` now'])
    expect(filterKnown(['the "cold read" step'], wordsOf('We did the "cold read" step.'))).toEqual([])
  })

  test('filterKnown with terms defined earlier, through wordsOf', () => {
    const earlier = 'An SLO is a target. A step called the cold read checks it.'
    expect(filterKnown(['SLO', 'cold read', 'kubelet'], wordsOf(definedTerms(earlier).join('\n\n')))).toEqual(['kubelet'])
  })

  test('DEFAULT_KNOWN quiets hints only: it does not filter the model reader\'s terms', () => {
    expect(filterKnown(['API', 'README'], new Set())).toEqual(['API', 'README'])
  })
})

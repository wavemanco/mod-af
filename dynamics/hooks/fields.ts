// The dynamics/1 model format, declared once. The checker validates shapes from this table and
// the field reference the model reads is generated from it, so the two cannot disagree.

export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'cell' | 'strings' | 'map' | 'lines'

export type Field = {
  name: string
  type: FieldType
  /** Allowed values, for strings. */
  enum?: readonly string[]
  /** true: always required. A string: required only when that condition holds (checked by a rule). */
  required?: true | string
  default?: string
  /** For arrays and objects: the section that describes each item / the object. */
  of?: SectionName
  doc: string
}

export type SectionName =
  | 'model' | 'subject' | 'answer' | 'figure' | 'node' | 'flow' | 'link' | 'loop'
  | 'evidence' | 'reference_mode' | 'boundary' | 'excluded' | 'emphasis' | 'review'

export const STATUS_DOC =
  'observed: the subject has it (for a codebase: code, config or tests do it; for docs or a product: the docs state it). ' +
  'modelled: your inference about how it works, believed to operate; give the claim. ' +
  'intended: specified or documented but not built; give the claim and cite the spec. Not part of any live loop. ' +
  'missing: should exist and does not; the absence is the finding (links and flows only). Not part of any live loop.'

export const SECTIONS: Record<SectionName, { title: string; doc: string; fields: readonly Field[] }> = {
  model: {
    title: 'The model file',
    doc: 'One JSON object. Write it with your file tool; the check and render tools take its path.',
    fields: [
      { name: 'spec', type: 'string', enum: ['dynamics/1'], required: true, doc: 'Always "dynamics/1".' },
      { name: 'title', type: 'string', required: true, doc: 'Page title, two to four words ("Job Runner Dynamics").' },
      { name: 'subject', type: 'object', of: 'subject', required: true, doc: 'What is modelled and where its sources are.' },
      { name: 'question', type: 'string', required: true, doc: 'The question the model answers, in the person\'s words or your proposal.' },
      { name: 'answer', type: 'object', of: 'answer', required: true, doc: 'The short answer: the dynamic hypothesis the structure suggests, not a simulation result.' },
      { name: 'horizon', type: 'string', doc: 'Time horizon: minutes, days, releases.' },
      { name: 'time_unit', type: 'string', doc: 'The unit flows are counted per ("minute", "day"). Turns on the units check.' },
      { name: 'audience', type: 'string', doc: 'Who will read the page.' },
      { name: 'reference_modes', type: 'array', of: 'reference_mode', doc: 'How key variables move over time, if known. Leave out rather than invent.' },
      { name: 'boundary', type: 'object', of: 'boundary', required: true, doc: 'What is deliberately left out.' },
      { name: 'emphasis', type: 'object', of: 'emphasis', required: 'when any element has "emphasis"', doc: 'The rule for the highlight colour.' },
      { name: 'figures', type: 'array', of: 'figure', required: true, doc: 'One to three figures, each answering one sub-question (more is flagged). At most 40 elements per figure (stocks, variables, constants, shadows and flows).' },
      { name: 'nodes', type: 'array', of: 'node', required: true, doc: 'Stocks, variables, constants, clouds and shadows.' },
      { name: 'flows', type: 'array', of: 'flow', required: true, doc: 'Rates that fill or drain stocks.' },
      { name: 'links', type: 'array', of: 'link', required: true, doc: 'Information links: "the target reads the source".' },
      { name: 'loops', type: 'array', of: 'loop', required: true, doc: 'Every live feedback loop, declared. The check lists any you missed, each with a declaration to complete.' },
      { name: 'review', type: 'object', of: 'review', doc: 'How the model was reviewed; shown in the page footer.' },
      { name: 'notes', type: 'strings', doc: 'Anything else the page must say.' },
    ],
  },
  subject: {
    title: 'subject',
    doc: 'Evidence paths are relative to one of the roots. Saved copies of web pages or text extracted from PDFs go in a root of their own (for example "saved").',
    fields: [
      { name: 'name', type: 'string', required: true, doc: 'The subject\'s name ("acme-api").' },
      { name: 'kind', type: 'string', enum: ['codebase', 'docs', 'product', 'mixed'], required: true, doc: 'What the sources are. It decides what "observed" means on the page.' },
      { name: 'roots', type: 'map', required: true, doc: 'Named folders, e.g. {"code": "../acme-api", "saved": "./sources"}. Absolute, or relative to the model file. The first is the default for evidence.' },
      { name: 'ref', type: 'string', doc: 'The commit, tag or document version read.' },
      { name: 'dirty', type: 'boolean', doc: 'True when the working tree had uncommitted changes.' },
      { name: 'date', type: 'string', required: true, doc: 'The date the sources were read, as YYYY-MM-DD.' },
    ],
  },
  answer: {
    title: 'answer',
    doc: 'Shown under the question. Behaviour claims belong here, labelled as a hypothesis, never in loop stories.',
    fields: [
      { name: 'text', type: 'string', required: true, doc: 'Two to five plain sentences answering the question from the structure, each on its own line (each line is shown as its own line). Name the loops that carry the answer, or say that none does.' },
      { name: 'loops', type: 'strings', required: true, doc: 'Ids of the declared loops the answer rests on (may be empty).' },
    ],
  },
  boundary: {
    title: 'boundary',
    doc: 'Endogenous and exogenous lists are derived; only what is left out is written here.',
    fields: [{ name: 'excluded', type: 'array', of: 'excluded', required: true, doc: 'What is deliberately left out ([] if nothing).' }],
  },
  excluded: {
    title: 'boundary.excluded[]',
    doc: '',
    fields: [
      { name: 'name', type: 'string', required: true, doc: 'What is left out.' },
      { name: 'why', type: 'string', required: true, doc: 'Why it does not matter to the question.' },
    ],
  },
  emphasis: {
    title: 'emphasis',
    doc: 'One highlight, one rule. Elements opt in with their own "emphasis" text.',
    fields: [
      { name: 'name', type: 'string', required: true, doc: 'What the highlight is called ("Defect").' },
      { name: 'rule', type: 'string', required: true, doc: 'One sentence: what earns the highlight. Shown in the legend and the header.' },
    ],
  },
  review: {
    title: 'review',
    doc: '',
    fields: [
      { name: 'rounds', type: 'number', doc: 'Review rounds run.' },
      { name: 'agreed', type: 'number', doc: 'Review rounds the person has agreed to (asked at the start, raised only with their yes). A review without it, or with more rounds run than agreed, is warned about (V01).' },
      { name: 'independent', type: 'boolean', doc: 'True when reviewers other than the builder ran them.' },
      { name: 'visual', type: 'boolean', doc: 'True when rendered screenshots were inspected.' },
      { name: 'note', type: 'string', doc: 'The review note, shown in the footer: every gap in the review, as the method\'s step 7 defines it. Add to it; never drop an earlier item.' },
    ],
  },
  figure: {
    title: 'figures[]',
    doc: 'Plan figures around stocks: a stock\'s inflows, outflows and the links into them live in its figure, and a loop must lie in one figure.',
    fields: [
      { name: 'id', type: 'string', required: true, doc: 'Unique id.' },
      { name: 'title', type: 'string', required: true, doc: 'Figure heading.' },
      { name: 'question', type: 'string', required: true, doc: 'The one sub-question this figure answers.' },
      { name: 'caption', type: 'string', doc: 'Extra caption text.' },
    ],
  },
  node: {
    title: 'nodes[]',
    doc: 'Positions are grid cells: column and row, half steps allowed. Main stock chains read left to right; inputs sit above or below.',
    fields: [
      { name: 'id', type: 'string', required: true, doc: 'Unique across everything in the model; letters, digits, _ - .' },
      { name: 'kind', type: 'string', enum: ['stock', 'aux', 'constant', 'cloud', 'shadow'], required: true, doc: 'stock: accumulates (last value + inflows − outflows). aux: a variable computed now from others. constant: a setting or limit fixed over the horizon. cloud: a source or sink outside the boundary. shadow: a copy of a variable defined in another figure.' },
      { name: 'figure', type: 'string', required: true, doc: 'Figure id.' },
      { name: 'at', type: 'cell', required: true, doc: '[column, row], numbers from 0 to 100.' },
      { name: 'label', type: 'string', required: 'except clouds and shadows', doc: 'A quantity that can go up or down ("Queued jobs"), not a verb or a component.' },
      { name: 'units', type: 'string', doc: 'Stocks: what is counted ("jobs").' },
      { name: 'value', type: 'string', doc: 'Constants only: the sourced value ("8"). It is read as the page and its sources are read, and its numbers must be in a checked quote (or the claim, when not observed), compared by value with their sign: 0x100, 256 and 2.56e2 are the same number, and 8 is not -8. "500,502,503" alone is one number, so write a list as a list of plain numbers, e.g. [1000, 5000]: digits joined by commas inside brackets are list items, so [1,000, 5,000] is 1, 0, 5 and 0. A value the check does not read as a number (1m30s, 1.2.3) must appear whole, as written and not after a minus sign it lacks, where its quote was found in the file (or in its claim, when not observed).' },
      { name: 'component', type: 'string', doc: 'The module, service or doc section it lives in; listed in a components table.' },
      { name: 'detail', type: 'string', doc: 'One or two sentences shown when the element is selected.' },
      { name: 'status', type: 'string', enum: ['observed', 'modelled', 'intended'], required: 'except clouds and shadows', doc: STATUS_DOC },
      { name: 'claim', type: 'string', required: 'when status is not observed', doc: 'What you inferred, or what is specified but not built, and why.' },
      { name: 'evidence', type: 'array', of: 'evidence', required: 'when status is observed', doc: 'Where it shows, with exact quotes.' },
      { name: 'emphasis', type: 'string', doc: 'Why this element is highlighted under the emphasis rule. Not on clouds or shadows: a shadow shows the highlight of the element it copies.' },
      { name: 'of', type: 'string', required: 'for shadows', doc: 'Shadows: the id of the stock, variable, constant or flow it copies.' },
      { name: 'why_outside', type: 'string', required: 'for clouds', doc: 'Clouds: what lies outside and why it does not matter to the question.' },
      { name: 'label_at', type: 'string', enum: ['below', 'above', 'left', 'right'], doc: 'Variables and constants: where the label goes (left out: chosen to avoid overlaps).' },
    ],
  },
  flow: {
    title: 'flows[]',
    doc: 'A flow is a rate of events that add or remove (jobs dispatched per minute), never the function that does it. Its figure is its stocks\' figure.',
    fields: [
      { name: 'id', type: 'string', required: true, doc: 'Unique id.' },
      { name: 'from', type: 'string', required: true, doc: 'The stock or cloud it drains.' },
      { name: 'to', type: 'string', required: true, doc: 'The stock or cloud it fills.' },
      { name: 'label', type: 'string', required: true, doc: 'The rate ("dispatched").' },
      { name: 'units', type: 'string', doc: 'Stock units per time_unit ("jobs/minute").' },
      { name: 'component', type: 'string', doc: 'Where it lives.' },
      { name: 'detail', type: 'string', doc: 'Shown when selected.' },
      { name: 'status', type: 'string', enum: ['observed', 'modelled', 'intended', 'missing'], required: true, doc: STATUS_DOC },
      { name: 'claim', type: 'string', required: 'when status is not observed', doc: 'As for nodes.' },
      { name: 'evidence', type: 'array', of: 'evidence', required: 'when status is observed', doc: 'Cite the code that adds or removes.' },
      { name: 'emphasis', type: 'string', doc: 'As for nodes; paints pipe and valve together.' },
      { name: 'valve', type: 'number', default: '0.5', doc: 'Where the valve sits along the longest run of its pipe, 0.15 to 0.85; if that would put it on the stock or cloud at either end, it moves along the run to the nearest point clear of both. On another pipe\'s valve or arrowhead it moves the same way, clear of those too, the later id first and an earlier one when the later cannot; where its run has no such point, G03 says so.' },
      { name: 'route', type: 'string', enum: ['straight', 'hv', 'vh', 'under', 'over'], doc: 'Pipe shape. Left out, the cheapest shape that fits: straight (level or plumb through the height or width the two ends share, when that band is at least the pipe\'s width), then hv (horizontal first), vh (vertical first), under, over, and last a straight slant, which always comes with G08. A shape fits when, as drawn, the run into the target starts at least 16 px outside it (room for the arrowhead) and the arrowhead\'s whole base lands on the target, not past its corner; every later run keeps 8 px from the source and every earlier run 8 px from the target; and the valve touches neither end. "under" runs below both ends and "over" above them; when one end lies above the other (their widths overlap), "under" goes round their right side and "over" their left. All flows between the same two ends are routed together, by id and never by their order in the file. The combination drawn has, in this order: the fewest pipes drawn on top of each other; the fewest shapes that do not fit (a slant is drawn that does not fit only when each shape that does would be drawn on top of another pipe); the fewest places where one pipe runs along or touches another, runs through its valve, arrowhead or ×, or has its valve on its valve or arrowhead (each a G03); the fewest shapes that come with a G08 (a refused route, a slant); then, of two named routes that want the same pipe, the earlier id keeps its own; then the fewest crossings, which are accepted; then the lowest total cost (a detour costs more than two elbows), the earlier id taking the cheaper shape in a tie. Two pipes cross where two of their runs cross with every run end at least 9 px from the other run; a run that ends within 9 px of another pipe, crossing it or not, touches it. Above four such flows, they are decided one at a time, named routes first, then by id. A named route is kept when it fits and, kept, adds none of the G03 faults above between the same ends; otherwise the cheapest shape that does is drawn, with G08 saying why. One kept while it still meets such a pipe gets a G08 saying so. "straight" between ends that share no band is drawn as a slant.' },
      { name: 'label_at', type: 'string', enum: ['below', 'above', 'left', 'right'], doc: 'Where the rate label goes (left out: chosen to avoid overlaps).' },
    ],
  },
  link: {
    title: 'links[]',
    doc: 'Draw a link only where the target reads the source: the line of code, or the doc sentence. Links end on variables and flows, never on stocks, constants, clouds or shadows. Its figure is its ends\' figure; to use a variable from another figure, draw a shadow of it.',
    fields: [
      { name: 'id', type: 'string', required: true, doc: 'Unique id.' },
      { name: 'from', type: 'string', required: true, doc: 'Source: a stock, variable, constant, flow or shadow.' },
      { name: 'to', type: 'string', required: true, doc: 'Target: a variable or a flow.' },
      { name: 'polarity', type: 'string', enum: ['+', '-'], required: true, doc: '+: if the source rises, the target is higher than it would otherwise have been; −: lower (Sterman 2000, Table 5-1). Never "same direction". A link from a stock to its own outflow is usually +: the drain\'s − is already counted by the pipe.' },
      { name: 'mechanism', type: 'string', required: true, doc: 'One sentence: how the target reads the source ("batch = min(free, len(queue))").' },
      { name: 'label', type: 'string', doc: 'Short text drawn on the link, if it helps a reader.' },
      { name: 'delay', type: 'boolean', doc: 'true: an information delay, where a value is read late (polling, caching, reporting). Things waiting in a batch or a review queue are material in transit: draw them as a stock instead.' },
      { name: 'detail', type: 'string', doc: 'Shown when selected.' },
      { name: 'status', type: 'string', enum: ['observed', 'modelled', 'intended', 'missing'], required: true, doc: STATUS_DOC },
      { name: 'claim', type: 'string', required: 'when status is not observed', doc: 'As for nodes.' },
      { name: 'evidence', type: 'array', of: 'evidence', required: 'when status is observed', doc: 'The line where the target reads the source.' },
      { name: 'emphasis', type: 'string', doc: 'As for nodes.' },
      { name: 'bend', type: 'number', doc: 'Curvature, −1 to 1, as a share of the link\'s length. Left out: chosen to avoid overlaps.' },
    ],
  },
  loop: {
    title: 'loops[]',
    doc: 'Trace a change around the loop first, from the mechanisms, decide R or B, then name it R1/B1 and check: a disagreement means a sign or the trace is wrong. A loop the check finds undeclared comes with its route and a declaration to complete (id, name, story), with no verdict: you decide it.',
    fields: [
      { name: 'id', type: 'string', required: true, doc: 'R1, R2… for reinforcing, B1, B2… for balancing, nothing else: the letter is drawn in the loop marker. Decide it from your own trace; the check compares it with the signs.' },
      { name: 'name', type: 'string', required: true, doc: 'What the loop does, in a few words ("Retry churn").' },
      { name: 'path', type: 'strings', required: true, doc: 'Node and flow ids in loop order, any starting point. A flow sits between the stock that reads into it and the stock it fills or drains.' },
      { name: 'story', type: 'string', required: 'unless minor', doc: 'An all-else-equal trace: "more X → more Y → fewer X". No claims about behaviour over time.' },
      { name: 'minor', type: 'boolean', doc: 'true only for a routine loop, a stock draining through its own outflow with a + link (checked): listed compactly, no story needed. Not for a loop the answer cites.' },
      { name: 'goal', type: 'string', doc: 'Balancing loops: the node id of the goal or limit, or a short phrase such as "empty (0)". Leave out if the sources name none.' },
      { name: 'marker_at', type: 'cell', doc: 'Where to put the loop marker; it must lie inside the loop as drawn. Left out: chosen automatically.' },
    ],
  },
  evidence: {
    title: 'evidence[]',
    doc: 'The check opens every cited file and confirms the quote is in the cited lines, as whole words: a run of spaces, tabs or line breaks may be longer or shorter, but none may be added or dropped. An observed element needs at least one quote checked this way; a web address alone is not enough.',
    fields: [
      { name: 'root', type: 'string', doc: 'Which subject root the path is under (left out: the first).' },
      { name: 'path', type: 'string', required: 'unless url', doc: 'Relative path, forward slashes, no "..", no line breaks; taken exactly as written (two spaces are two spaces).' },
      { name: 'lines', type: 'lines', doc: '"12" or "12-20", or a line number. Strongly recommended; without it the quote is looked for in the whole file.' },
      { name: 'quote', type: 'string', required: true, doc: 'The exact text that shows it: at least a few words, copied, not paraphrased.' },
      { name: 'kind', type: 'string', enum: ['code', 'config', 'test', 'doc', 'data', 'other'], doc: 'Optional. The file\'s extension or name decides when it can: a code or config extension (.py, .go, .ts, .yaml, .json…) is code wherever it lives; .md, .mdx, .rst, .adoc, .pdf and the like, and a document\'s name (README, CHANGELOG, HISTORY, NEWS, AUTHORS, SECURITY…) with no extension, a document one or .txt, are documents whatever "kind" says. For any other .txt or .html file "kind" decides; with no "kind", it is a document under docs/, wiki/, adr/ or rfc/, or when it has "from" (a saved extract). "kind": "doc" also marks a code file as documentation. In a codebase, an observed element backed only by documents is flagged.' },
      { name: 'url', type: 'string', doc: 'A web source. It cannot be checked, so it never makes an element observed on its own: save a text extract and cite it by path.' },
      { name: 'from', type: 'string', doc: 'For a saved extract: the original (URL, document, page) and the command that made the extract (e.g. curl + html-to-text, pdftotext). Never a WebFetch summary or a hand transcription.' },
    ],
  },
  reference_mode: {
    title: 'reference_modes[]',
    doc: 'Only behaviour you have a basis for. "hypothesised" is shown as suspected, not observed.',
    fields: [
      { name: 'variable', type: 'string', required: true, doc: 'A stock, variable or flow id.' },
      { name: 'pattern', type: 'string', required: true, doc: 'How it moves: grows, drains, oscillates, overshoots…' },
      { name: 'basis', type: 'string', enum: ['data', 'hypothesised'], required: true, doc: 'data needs evidence (a log, a metric, a report); hypothesised needs "why".' },
      { name: 'why', type: 'string', required: 'when basis is hypothesised', doc: 'Who suspects this behaviour and on what grounds (an incident, an issue, the person\'s own words). Never your own guess.' },
      { name: 'evidence', type: 'array', of: 'evidence', required: 'when basis is data', doc: 'Where the data is.' },
    ],
  },
}

const TYPE_TEXT: Record<FieldType, string> = {
  string: 'text', number: 'number', boolean: 'true/false', object: 'object', array: 'list', cell: '[column, row]', strings: 'list of text', map: 'object of name → path', lines: 'text or number',
}

/** The field reference injected into the session: generated, so it matches the checker. */
export function fieldReference(): string {
  const out: string[] = ['# The dynamics/1 model format', '', 'Generated from the checker\'s own field table. "Required" conditions are enforced by the check.', '']
  for (const [, s] of Object.entries(SECTIONS)) {
    out.push(`## ${s.title}`)
    if (s.doc) out.push(s.doc)
    out.push('', '| field | type | required | meaning |', '|---|---|---|---|')
    for (const f of s.fields) {
      const type = f.enum ? f.enum.map(v => `"${v}"`).join(' / ') : TYPE_TEXT[f.type]
      const req = f.required === true ? 'yes' : f.required ? f.required : f.default !== undefined ? `no (default ${f.default})` : 'no'
      out.push(`| ${f.name} | ${type} | ${req} | ${f.doc.replace(/\|/g, '\\|')} |`)
    }
    out.push('')
  }
  return out.join('\n')
}

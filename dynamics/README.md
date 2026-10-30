# dynamics

A system-dynamics picture of a codebase, a repository or a set of product docs that you can trust: a
stock-and-flow model in which every observed part points at the line of code or the sentence it
comes from and every inferred part is marked as modelled, every feedback loop is found and typed
mechanically, and the page explains every mark it draws.

`/dynamics <what to model> — <the question>` produces:

- **A page** with the question and a short answer first, then a legend in plain words ("a box is
  something that piles up…"), then one to three figures in stock-and-flow notation. Select any element
  to see its source; select a loop to trace it.
- **The model file** (`model.json`), the single source everything on the page is derived from.
- **A plain-text reader view** of the page, for reviewing without a browser (returned by the tools, not
  written to disk).
- **A short record** of how it was reviewed, what was accepted as a known limit, and what was not
  checked.

It is written for people who have never seen system dynamics, and it is a model of **structure**: it
shows what is wired to what, not how the numbers will move over time. It never presents a simulation
result, because it runs none.

## How it works

1. **Ask the question, and decide whether to model at all.** A model answers a question; it is not an
   inventory. Run `/dynamics` with nothing after it and it proposes two or three questions for the
   current repo. If nothing accumulates and nothing feeds back, it says so and stops (or offers a plain
   architecture map). It also asks how many review rounds you want (2 by default; see step 5).
2. **Survey from three angles, then map.** One pass follows a single unit of work (the engine), one what
   accumulates over time (growth and memory), one the gates, budgets and incentives (control); each
   also notes missing feedback. Accumulations become stocks, rates become flows, settings become
   constants, and "the code reads X to decide Y" becomes a link, each with an exact quote of where it
   shows. Something documented but not built, or missing, is drawn as such and kept out of the live
   loops. Where a guess carries the answer, it looks for evidence and cites it.
3. **Check.** The `check` tool opens every cited file and confirms each quote is there (in the cited
   lines, when given), enforces the notation, finds every closed causal path (feedback loop) and works
   out whether it reinforces or balances, checks numbers and units, and derives the model boundary. A loop the model forgot is
   reported with its route (each step's mechanism) and a declaration to complete: the modeller traces
   it and decides whether it reinforces or balances, and the check compares that with the signs.
4. **Render.** The `render` tool lays the figures out, avoids overlaps where it can and reports where
   it cannot, and builds the legend from the marks actually drawn.
5. **Review, converging, with you deciding.** A draft is shown first. Then independent reviewers check
   it through three lenses: facts against the sources, system-dynamics rules, and a cold reader who sees
   only the page. You set the number of rounds up front (2 by default: one full round, then one on
   the fixes and what they touched). The agreed number ends the review: it stops early when a round
   finds nothing serious, and it never runs a round you did not agree to. If serious findings remain,
   it recommends more rounds, says why and what they cost, and waits for your answer. The page footer
   shows rounds run against rounds agreed, and the fixes no round reviewed. A later correction is
   reviewed only if you say yes. The full rule is steps 7 and 9 of [`prompt.md`](./prompt.md).
6. **Report.** The one-line answer, the page, the model file and the record, plus what the structure
   suggests, each marked as a hypothesis: the two or three leverage points, the missing feedback, and,
   where a reference mode gives a basis, which loop likely dominates when, with what would test it.

`/dynamics-check <model.json>` re-checks a model you edited by hand and re-renders its page.

## What it checks, and what it does not

Checked mechanically, with the source for each rule (see [`REFERENCES.md`](./REFERENCES.md)):

| Area | Rules |
|---|---|
| Notation | Flows run between stocks and clouds; every stock has a flow; links never end on a stock, constant, cloud or shadow; one sign per link, + or −; clouds say why they are outside; every element states its status, so a misspelt field cannot turn something into "observed"; ids are unique regardless of case (Ford 2019; MIT D-4498; Sterman 2001; Richardson 1997) |
| Evidence | Every observed element has at least one exact quote that the check finds in its cited file, as whole words and whole numbers, in the cited lines when they are given (lines are recommended, and a warning says where the quote sits); a web address alone is not enough; inferred parts carry a claim; a number the page states as fact that is in no checked quote or modelled claim is flagged, the page and its sources being read by one reader and a quote lending only the numbers its file gives inside the quote, the file read as a whole (so a quote cut from a call or list opened on an earlier line lends that call's or list's items) (an element's own text against its own sources; a loop's name and story against the elements on the loop and those that link into them; a behaviour pattern against its own checked quotes, and a suspected one's "why"; page-wide prose, cloud labels included, against the whole model; title, question, horizon, loop goals, units and component names excepted); observed code backed only by documents is flagged, judged by the file's extension or name (a document's name such as README, CHANGELOG or HISTORY counts with no extension, a document extension or .txt, whatever "kind" says), and for any other .txt or .html file by its declared "kind", or with none by its folder or a saved extract's "from"; a file Claude Code refuses to read is reported in its words, except that a notebook, PDF or image is named for what it is, with the tool's first sentence when it names another problem; a person's refusal is reported in their words (Shreckengost; Naugle 2024) |
| Loops | Every closed causal path is a declared loop; a loop the model missed is reported with its route and no verdict, so the modeller traces it first; loop ids are R1… or B1…, and the letter must match the type, which is the product of the signs with a flow + into the stock it fills and − out of the one it drains; every loop contains a stock; loops through parts that are not built are listed separately; at most 40 loops a figure (Naugle 2024; Sterman 2000; Sterman 2001; Ford 2019; Johnson 1975) |
| Structure tests without simulation | What stops each outflow when its stock is empty (a net + path from the stock to its outflow, built or recorded as intended or missing; a stock that reaches its outflow only through net − paths, built or not, is flagged); information delays on loops, which hide a stock; units of flows against their stocks; elements that affect nothing; variables with no inputs (Forrester & Senge 1980; Schwaninger & Groesser 2009; Sterman 2001; Trimble 2014) |
| Page | The legend lists exactly the marks drawn, one entry per combination; a copy of an element (a shadow) shows that element's status and highlight, and selecting it shows the claim and sources of what it copies; layout warnings for overlaps and crossings; a figure that cannot be drawn is not written |

Not machine-checked, and said so on every run: whether a quote supports what is drawn (the facts
review does that), whether prose is true, whether a text extract of a web page or PDF matches the
original (the method requires a tool-made extract and records the command), whether a number in
page-wide prose comes from the element it is about, numbers in prose written as compound durations
or versions with more than two parts (hex and scientific forms are compared by value), numbers in a
locale's own format (every number is read the English way: "1.000" is 1, "3,5" is 3 and 5), digits
in brackets on the page, which are read as a list in code ("[1,500]" is 1 and 500), which text in a
source is a comment (guessed by its marker, `#`, `//`, `--` or `/*`, and read as prose), and
anything about behaviour over time. Most of these checks are warnings: the model must resolve each one
or say why it stands.

Numbers are read one way on the page and in its sources, and a checked quote lends the numbers its
file gives inside the quote, the file read as a whole. Digits joined by commas in threes are one
number, quoted or not, unless they are an item of a list in code: between commas or brackets (spaces
and line breaks allowed) inside `[ ]`, `{ }`, or a `(` that follows `=`, a comma, an opening bracket, a
name with no space (a call), or SQL's `IN` or `VALUES` in capitals, and not inside a string or a
comment opened after that bracket. A comment is read as prose, as a string is, and is guessed by its
marker alone, outside a string: `#`, `//` or `--` to the end of the line, and `/*` to `*/`; quote
marks inside a comment are not counted. So
`[100,250,500]`, `range(1,100)` and `IN (500,502,503)` give their items, while "(up to 1,500 jobs)",
`limit (1,500)` and `log("over 1,500 jobs")` give 1500, and `// waits 500, 1,000, 2,000 ms` inside a
function body gives 500, 1000 and 2000. The page is read the same way: "[1,500]" in the answer is 1
and 500, and a warning for such an item names the list it came from; write one number outside
brackets, and a list as plain numbers (`[1000, 5000]`). Known limits: a CSV row `8,120` reads as 8120;
a list held in a string (`"retry_on": "500,502,503"`) is one number; a bracket written inside a string
or a comment still opens a list (`"see [1,000, 5,000]"` gives 1, 0, 5 and 0, and a Lua `--[[ ]]` block
is read as code on every line); a marker that is no comment (Python's floor division `//`, a `#` that
is not a comment, a decrement `--`) makes the items after it, in a bracket opened before it, read as
prose to the end of its line (after `/*`, to the next `*/`), so such a list is one number; a `/*` that
opens no comment stops the count of quote marks until the next `*/`, so a string after it may be read
as code; a `(` after a name and a space (`return (1,500)`, `x (1,500)`), after a colon, after
lower-case `in` or after a closing bracket (`handlers[0](1,500)`, `make_clamp(n)(1,500)`) is prose, so
its digits are one number. A page number taken from any of these is flagged (E04); accept the warning
and say why.

## When to use it, and when to use something else

Use `dynamics` when the question is **why something keeps happening over time**: why a backlog keeps
growing, why each round of fixes produces new defects, why costs creep up, why adoption stalls. It
maps what accumulates, what fills and drains it, and the feedback loops that push the behaviour
forward or hold it back, with a sign on every link and each loop typed as reinforcing or balancing.
Every observed part points at the line of code or sentence it comes from, and the checker confirms
each quote is really there; anything inferred is marked modelled and says what was assumed.

Use an architecture or flow diagramming tool (for example
[Archify](https://github.com/tt-a1i/archify)) when the question is **what the parts are and how they
connect**: a service map, a request path, a sequence, a data flow, a plan. Those tools draw
topology and paths, often from a plain description; they do not model accumulation or feedback, and a
connection there means "is connected to" (calls, sends data to, moves to, contains), not "more of this
causes more (or less) of that". Archify can also cite a repository: its nodes carry file and line
ranges pinned to a commit, which it checks exist, and its explainer pages answer questions in prose
and diagrams. `dynamics` checks the quoted words themselves, cites every observed link and flow (marking the rest modelled), signs every
link and types every loop, which is what lets it name the reinforcing loop behind a runaway problem,
the leverage points and the missing feedback. The two work well together: the architecture map shows
what is wired, the dynamics map shows why it behaves as it does.

It is the wrong tool for a stateless utility or a one-off script, and it says so.

## Install

```
/plugin install dynamics --marketplace wavemanco/mod-af
```

The plugin's two tools (`mcp__dynamics__check`, `mcp__dynamics__render`) work under your own
permission settings:
- Every file they read, the model included, is read through Claude Code's own Read tool, and the page
  is written through its Write tool. Your rules, permission mode, hooks and dialogs therefore decide
  each read and write exactly as they would for Claude's own calls: in default mode you are asked
  before the page is written; in accept-edits mode it is written.
- `render` writes only where the page lands inside the model file's folder, never onto a symbolic link,
  and never over a
  file dynamics did not write or one changed since. The page carries a fingerprint of its own
  content, so this holds on any machine and after a git checkout; reformatting that only changes
  whitespace is not counted as a change. A hook that strips comments from the page as it is written
  removes the fingerprint; the render says so, and later renders will not replace that page until it
  is deleted. While such a hook runs, each new page loses its fingerprint too, so also exclude the page
  from the hook.
- An explicit allow, ask or deny rule for the tools themselves is honoured (an ask rule is put to you
  as a question). Known limit: a PreToolUse hook that matches the tools' own names
  (`mcp__dynamics__…`) is not run for them, because a plugin's own tool is answered by the plugin;
  hooks on Read and Write still run for every file the tools touch.
- Nothing is read past 2 MB or from anything but a regular file. One Read call returns about 25,000
  tokens by default (`CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` changes it) and dynamics asks for at
  most 2,000 lines, so a large file takes several calls (a
  1.5 MB file of mostly 270-character lines took 30 in a real session; a file of very short lines takes one
  call per 2,000 lines). In default mode a file outside the working folder is asked about on each Read
  call; adding its folder with `/add-dir` avoids that.
- Known limits of reading through the Read tool: it reads whole lines, so a file with a very long line
  (minified JSON, a one-line bundle) cannot be read, and it returns PDFs and images as non-text.
  Notebooks are cited through an extract by choice: dynamics cites line numbers, which a notebook's
  cells do not have and a script extract does. Cite a text extract made with a tool instead (a
  pretty-printed copy, `jupyter nbconvert --to script`, `pdftotext`), and record the command in the
  evidence's `from`.

A headless browser is optional: with one, the model inspects screenshots of the page in light and
dark mode and at phone width; without one, it reviews the reader view and says the page was not
inspected visually.

## Or use the prompt

Prefer not to install? [`prompt.md`](./prompt.md) is the same method as a copy-paste prompt for any
chat. Without the plugin there is no checker or renderer, so it keeps the model as tables and runs the
checks by hand.

## Where it comes from

`dynamics` merges two plugins built for this collection in October 2026. Its base, checker, renderer
and tests come from `stockflow` (its review history is in [`REVIEW-LOG.md`](./REVIEW-LOG.md)). From the
earlier `dynamics` prototype (branch `add-dynamics-plugin`, never merged) it takes the three survey
angles, reference modes named as patterns, the "should this be modelled at all?" check, the research
step for key guesses, and the report's leverage points, missing feedback and which loop likely dominates (as a hypothesis). That prototype cited no
sources; the attributions below are this plugin's.

The method generalizes a stock-and-flow model of a research codebase, built and reviewed in
October 2026 over 21 review rounds. Most of that review effort went into hand-checking things this
plugin now derives or checks mechanically: loop types, which elements belong to which loop, the
legend, and whether each cited quote is real. What stayed manual is what only a reader can judge: is the
cited source saying what the diagram claims? The review rounds are agreed with you because a diagram does not need
production-code rigour. The system-dynamics rules come from the literature cited in
[`REFERENCES.md`](./REFERENCES.md), with each source's verification status. How the plugin itself was
reviewed, and what each round caught, is in [`REVIEW-LOG.md`](./REVIEW-LOG.md).

### Sources, and what each one gave the plugin

Full citations and how far each was read are in [`REFERENCES.md`](./REFERENCES.md). "Rule" means the
checker or the method enforces it; "guided" means it shaped a step without being enforced.

| Source | What `dynamics` takes from it |
|---|---|
| Sterman 2000, *Business Dynamics* (read via Siddiqi 2011's MIT reproduction) | Rule: link polarity judged against "what it would otherwise have been", flows + into the stock they fill and − out of the one they drain. Guided: the order of the method (articulate the problem, dynamic hypothesis, formulate, test) and the boundary list. |
| Sterman 2001, "Fine-Tuning Your Causal Loop Diagrams" | Rules: + and − signs, never s and o; loop type from counting negative links and from tracing a change around the loop; actual versus perceived kept apart; delay marks; named and numbered loops; no single diagram holding every loop (figure size limits, with the plugin's own thresholds). Guided: a balancing loop names its goal; links are causal, not correlational. |
| Ford 2019, "A system dynamics glossary" | Rules: what a stock, flow, auxiliary, connector, cloud, conserved flow and delay are; loop polarity as the product of link signs. Guided: reference mode and dynamic hypothesis. |
| Naugle, Langarudi & Clancy 2024 | Rules: every feedback loop contains a stock; every part states the source of, and confidence in, its structure (the observed and modelled statuses). Guided: the four building blocks. |
| Richardson 1997 (and 1986, background) | Why + and − are used rather than s and o for flows into and out of stocks. |
| Schaffernicht 2007 | The worked example behind defining polarity against the counterfactual. |
| MIT D-4498, "Road Maps Glossary" | Rules: stocks change only through flows; links reach variables and flows, never stocks. |
| Hines, MIT 15.879 "Standard Method" | Guided: the order of elicitation (variables, reference modes, problem, hypotheses), and naming a variable as something that can go up or down (the checker requires only a label). |
| Trimble 2014 | Rule: exogenous inputs (on the boundary) and excluded items (outside it) are kept as separate lists. |
| Vensim and Stella (isee) documentation | Rule: a shadow (ghost) copy of an element adds no structure and nothing points into it. |
| Forrester & Senge 1980 (read through two secondary accounts, Shreckengost's reproduction among them) | Rules: the structure tests that need no simulation, among them the extreme-condition test (what stops each outflow when its stock is empty), boundary adequacy, and dimensional consistency (flows counted in their stock's units per time unit). |
| Shreckengost, MIT D-4463 | Rule: "every element of the model should have a real-world counterpart", the reason every observed element carries evidence and every inferred one a claim. |
| Schwaninger & Groesser 2009 | The line between what the plugin checks (structure) and what it states only as a labelled hypothesis with a test (behaviour, sensitivity, loop dominance, which need simulation). |
| Barlas 1996; Lane 2008 | Guided: structure is validated first, and a diagram alone does not establish behaviour, so every page says it is not a simulation. |
| Richardson 2011 | Rule (a warning): the endogenous point of view: a behaviour explained from outside the model is flagged. |
| Martinez-Moyano & Richardson 2013 | Background only: practice organised by modelling stage. |
| Abdel-Hamid & Madnick 1991; Abdel-Hamid 1989; Rahmandad & Weiss 2009; Madachy 2007; Franco et al. 2016 | Guided: the survey guide's examples of what accumulates and feeds back in software projects (staffing, rework, concurrent development, technical debt). |
| Johnson 1975; Tarjan 1972 | The algorithms the checker uses to find every feedback loop (elementary circuits, via strongly connected components). |
| Meadows 1999, "Leverage Points: Places to Intervene in a System" | Guided: the term and idea of leverage points in the report. The prototype used the term without a citation; added here unverified (not re-read). The leverage points are offered as hypotheses read from the model's own structure, and nothing is checked against this source. |

Rules with no external source (for example "requirement is not supply", the figure size limits and
the agreed review rounds) are listed as plugin rules in [`REFERENCES.md`](./REFERENCES.md).

# dynamics

`dynamics` explains why a software system or product behaves the way it does over time: why a
backlog keeps growing, why each round of fixes produces new defects, why costs creep up, why adoption
stalls. It does this by building a system-dynamics model of the system from its code or documents,
checking the model against those sources, and drawing it.

## What system dynamics is

System dynamics, developed by Jay Forrester at MIT, explains behaviour over time by a system's
structure rather than by individual events. A model has three kinds of part:
- **Stocks:** quantities that accumulate, such as jobs waiting in a queue, open bugs or active users.
  A stock changes only through its flows.
- **Flows:** the rates that fill or drain a stock, such as jobs arriving per minute or bugs fixed per
  week.
- **Causal links:** one quantity affecting another, marked + (more of A makes B higher than it would
  otherwise be) or − (lower).

When a chain of links and flows leads from a stock back to its own flows, it forms a **feedback
loop**. A **reinforcing** loop amplifies change: more of something produces still more of it. A
**balancing** loop pushes toward a limit or a goal. The method's premise is that growth, stalls and
overshoot come mainly from these loops, and from which of them dominates at a given time, rather than
from any single part.

## What the plugin does

You ask a question about a codebase, a repository or a set of product documents. `dynamics` reads
the sources, builds the model that answers the question, checks it and renders it as a web page.
- **Grounded in the sources.** Each part that the sources show to exist quotes the exact words of
  the code or document it comes from (usually with line numbers), and the checker opens the file and
  confirms the quote is there. A part
  that is inferred is labelled *modelled* and says what was assumed. A part that is documented but not
  built, or missing, is labelled as such and kept out of the working loops.
- **Loops found mechanically.** The checker finds the feedback loops in the model, reports any the
  model did not declare, and works out from the signs of its links whether each one reinforces or
  balances.
- **A readable page.** The page starts with the question and a short answer naming the loops that
  carry it, then the diagrams, with a legend that explains every symbol in plain words.

**Example** (the worked example that ships with the plugin). Asked "Why can failures keep the queue
long even though the workers are busy?" about a small job runner, the model finds:
- a reinforcing loop: more jobs in flight mean more failures, and each failure under the retry limit
  puts a job back in the queue;
- balancing loops: the worker limit caps how fast jobs leave the queue.

So requeued jobs compete with new ones for the same worker slots. It also shows that paging watches
the queue but feeds nothing back into the runner: a missing feedback loop.

**What it does not do.** It models structure only. It runs no simulation and makes no numerical
forecast. The short answer, the suggested leverage points (places where a change would act on a loop
the answer rests on) and any view on which loop dominates are stated as hypotheses, each with what
would test it.

## When to use it, and when to use something else

Use `dynamics` when the question is **why something keeps happening over time**, and the answer is
likely to lie in accumulation and feedback.

Use an architecture or flow diagramming tool (for example
[Archify](https://github.com/tt-a1i/archify)) when the question is **what the parts are and how they
connect**: a service map, a request path, a sequence, a data flow. In those diagrams a connection
means "is connected to" (calls, sends data to, contains). In a `dynamics` model a link means "more of
this causes more, or less, of that", which is what lets it find reinforcing and balancing loops,
leverage points and missing feedback. Archify can also cite a repository, with file and line ranges
pinned to a commit; `dynamics` checks the quoted words themselves. The two work well together: the
architecture map shows what is wired, the dynamics model shows why it behaves as it does.

It is the wrong tool for a stateless utility or a one-off script, and it says so.

## Usage

```
/dynamics <what to model> — <the question>
```

Run `/dynamics` with nothing after it and it proposes two or three questions for the current
repository. `/dynamics-check <model.json>` re-checks a model you edited by hand and re-renders its
page.

You get:
- **a page** with the question, the short answer, a plain-language legend and one to three diagrams.
  Select any part to see its source; select a loop to trace it;
- **the model file** (`model.json`), the single source everything on the page is derived from;
- **a plain-text reader view** of the page, for reviewing without a browser (returned by the tools,
  not written to disk);
- **a short record** of how the model was reviewed, what was accepted as a known limit, and what was
  not checked.

## How it works

1. **Ask the question, and decide whether to model at all.** A model answers a question; it is not an
   inventory. If nothing accumulates and nothing feeds back, it says so and stops (or offers a plain
   architecture map). It also asks how many review rounds you want (step 5).
2. **Survey, then map.** It reads the sources from three angles: how a single unit of work moves
   through the system, what accumulates over time, and the gates, budgets and incentives that control
   it. Accumulations become stocks, rates become flows, settings become constants, and "the code reads
   X to decide Y" becomes a link, each with an exact quote of where it shows.
3. **Check.** The `check` tool confirms every quote is in its cited file, enforces the notation, finds
   every feedback loop and its type, and checks numbers and units. A loop the model missed is reported
   with its route, for the modeller to trace and declare.
4. **Render.** The `render` tool lays out the diagrams and builds the legend from the symbols actually
   drawn.
5. **Review, with you deciding how much.** You choose the number of review rounds at the start (2 by
   default). Independent reviewers check the facts against the sources, the system-dynamics rules, and
   whether someone new to the method can read the page. Later rounds check only the fixes. It never
   runs more rounds than you agreed: if serious problems remain, it recommends more and waits for your
   answer. The page footer shows how the model was reviewed and anything left unreviewed. The full rule
   is steps 7 and 9 of [`prompt.md`](./prompt.md).
6. **Report.** The one-line answer, the page, the model file and the record, plus what the structure
   suggests, each marked as a hypothesis: two or three leverage points, the missing feedback and, where
   the sources describe a pattern over time, which loop likely dominates when.

## What is checked

The checker tests, with a published source for each rule (a few findings are errors; most are
warnings that the model must resolve or explain):
- **notation:** flows run between stocks; links never end on a stock; every link has one sign;
- **evidence:** every quote is found in its cited file, and any number the page states as fact comes
  from a checked quote or a labelled assumption;
- **loops:** every feedback loop is found, declared and typed correctly, and every loop contains a
  stock;
- **structure tests that need no simulation:** what stops a stock from draining below empty, units,
  parts that affect nothing, and inputs with no source;
- **the page:** the legend lists exactly the symbols drawn.

Not machine-checked, and said so on every run: whether a quote supports what is drawn (a reviewer
checks that), whether prose is true, and anything about behaviour over time. The full rules, how
numbers in quotes are read, and their known limits are in [`DETAILS.md`](./DETAILS.md).

## Install

```
/plugin install dynamics --marketplace wavemanco/mod-af
```

The plugin's tools read and write files only through Claude Code's own Read and Write tools, so your
permission settings apply to every file they touch. The details and limits are in
[`DETAILS.md`](./DETAILS.md#permissions-and-file-access).

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

# stockflow — the prompt form

Paste everything below the line into any chat, then name what to model (a codebase, a repo, a set of
product docs) and, if you have one, the question the model should answer. It runs the same method as
the `/stockflow` plugin.

> The installed plugin adds what a pasted prompt cannot: a checker that verifies every cited quote
> against its file, finds every feedback loop and works out its type, and a renderer that draws the
> page with a legend generated from the marks it uses. Pasted, the method runs with the substitutions
> in "In the paste form" at the end, which also lists the sources the rules cite.

---

<!-- method:start -->
# Build a stock-and-flow model of a system, grounded in its sources

You are building a **system-dynamics stock-and-flow model** of the system named above: what accumulates
in it (stocks), what fills and drains those accumulations (flows), what the flows depend on
(variables, constants, information links), and the feedback loops that result. It must be **true to
its sources** (the code, the repository, the product docs) and **readable by someone who has never
seen system dynamics**. It is a model of structure: it shows how the parts are wired, never how the
numbers will move over time (Schwaninger & Groesser 2009; Lane 2008).

Two rules govern everything:
- **Every element points at its evidence**: a file, the lines, and an exact quote. Anything inferred
  rather than read is marked *modelled* and says what was assumed. "Every element of the model should
  have a real-world counterpart" (Shreckengost, after Forrester & Senge 1980).
- **Derive, never retype.** Loop types, loop membership, traces, the boundary and the legend come out of
  the model file. Anything written in two places drifts.

## 0. Set up (a few minutes)

- **What and why.** Confirm what to model and the question. If nothing was named, take the current
  repository, look around briefly, and offer two or three candidate questions; or state the one you
  chose and invite a change. A model answers a question; it is not an inventory of a system.
- **Where.** Work outside the target: the session's scratch folder if you have one, else a folder
  such as `stockflow-<name>/` beside the target. Say the path. Do not edit the target unless asked.
  Producing the diagram is not a change to the target's code.
- **House rules.** Read the target's own instructions (CLAUDE.md, CONTRIBUTING, review rules). If they
  impose a review or iteration process that would apply to this diagram, ask the person once whether
  to apply it or use this method's capped review, and record the answer. Rules written for production
  code do not automatically suit a diagram.
- **Pin what you read.** Record the commit (`git rev-parse HEAD`) and whether the tree had uncommitted
  changes (`git status --porcelain`), or the document versions, and today's date.
- **Say how long.** Tell the person roughly how long a first draft and a review round will take for a
  system this size, then post a one-line note at each step.

## 1. Articulate the problem (Sterman 2000, Fig. 3-1; Hines)

Write down before mapping anything:
- **The question** and, as you go, the **short answer**: two to five plain sentences naming the loops
  that carry it. It is a hypothesis read from the structure (a dynamic hypothesis, Ford 2019), never a
  simulation result. If no loop explains the behaviour, say so: that is a finding.
- **Key variables**, the **time horizon**, the **time unit** flows are counted per.
- **Reference modes** only where there is a basis: *data* (a log, a metric, a report, cited) or a
  stated suspicion, marked *hypothesised*. Do not invent a behaviour pattern to fill the slot.
- **Figures**: one to three, each answering one sub-question. Plan them around stocks: a stock's
  inflows, outflows and the links into them live in its figure, and a feedback loop must lie within
  one figure. To use a variable from another figure, draw a shadow of it. Do not put every loop into one
  diagram (Sterman 2001).

## 2. Survey the sources for structure

Read for accumulations and the rates that change them. In software and product terms:

| In the system | In the model | The mistake it prevents |
|---|---|---|
| A count whose value is last value + additions − removals: queue or backlog length, open issues, rows in a table, a balance, jobs in flight, registered accounts, accumulated debt | **Stock** (Ford 2019) | "It persists" is not the test: config persists and is a constant; a value recomputed on each read is a variable |
| A cache, dashboard, metric or report of a stock, when the gap between it and the real value matters to the question | A separate **perceived stock**, filled after a delay | Treating the reported number as the real one (Sterman 2001) |
| The rate of events that add or remove: enqueued per minute, merges per week, sign-ups per day | **Flow** | Drawing the function or handler as the flow. The handler is the evidence; the code computing "how many per step" supplies the links into the flow |
| A status change (open → in review → closed) | A **conserved flow** between two stocks | Copying, replicating, deriving or forking is not conserved: it is an inflow from a cloud driven by a link |
| `x = …` recomputed each pass | **Variable** (aux) | |
| `x += …`, insert, delete | **Stock** with flows; a reset `x = 0` is a clearing outflow, never a link into the stock | Links that end on stocks |
| Config keys, caps, thresholds, timeouts, flags, literals | **Constant** (a policy lever) | Modelling a setting as caused by the system |
| A guard or threshold test (`if len(q) > LIMIT`) | A **link** from what it reads to the flow it gates, with the limit as a constant | Signs that "depend": if the effect reverses in different regimes, draw two pathways through an intermediate variable |
| Logging, metrics, scoring, reading, reporting | **Information links**, never outflows | Drains that drain nothing |
| Callers and upstream services where work comes from, data deleted for good | **Clouds** at the boundary, one per flow end | A cloud that is both a source and a sink of the same thing hides a stock |
| Polling, or reading a report or cached copy, when only the lag matters and the copy itself does not | An **information delay** on the link | Hiding a perceived stock the question turns on |
| Items waiting for a batch, a review queue, work in transit between steps | A **stock** of what waits, with the flows in and out | "Material delay" drawn on a link: things that wait are a stock |
| How people respond (operators, users, reviewers) | **Modelled**, with a claim; never "observed" from code | |
| Components, services, modules, doc sections | Not elements: record each element's `component` | Boxes for services |

Rules that keep the structure honest (each one caught a real error in the build this method comes from):
1. **A link exists only where the target reads the source.** Find the line where the code reads it, or
   the doc sentence that states it. Read each guard or decision function and list *every* predicate
   it evaluates; its inputs are exactly those. Write the link's **mechanism** in one sentence.
2. **What the code does, not what the docs prescribe.** Documented but not built is *intended*; should
   exist and does not is *missing*. Neither takes part in live loops. For a docs-only or product model,
   *observed* means the docs state it, and the page says so.
3. **Do not merge mechanisms whose conditions differ.** One variable standing for several gates
   manufactures loops that are not there. A sequence of gates that each open once is a chain, not a
   loop; say so rather than force one.
4. **Stocks change only through flows** (Ford 2019; MIT D-4498). A drain must actually remove something.
5. **Perceived is not actual** (Sterman 2001), **and requirement is not supply** (plugin rule): what
   a part needs and what it gets are separate quantities, joined by a link only where the code joins them.
6. **Policies are levers, not effects.** Never close a loop to tell a story the evidence lacks.
7. **Numbers come from the sources**: in a cited quote, or from running the project's own code. Never
   from memory or design intent.
8. **Name variables as quantities that can go up or down** (Hines): "retry queue length", not "retry".
9. **One sign per link, + or −** (Sterman 2001; Richardson 1997). +: if the source rises, the target is
   higher than it would otherwise have been; −: lower (Sterman 2000, Table 5-1). Not "moves in the same
   direction". A stock's link to its own outflow is usually +: the drain's − is already counted by
   the pipe.
10. **A balancing loop seeks a goal** (Sterman 2001): name it when the sources have one (a limit, a
    target, "empty"). Do not invent one.

## 3. Draw the boundary (Sterman 2000; Trimble 2014)

- **Left out on purpose**: each item with why it does not matter to the question.
- **Clouds**: what lies outside and why it is "inconsequential to the behavior of interest" (Ford 2019).
- What is inside the feedback and what is an input from outside are derived from the links. Inputs
  are not the same as what is left out.

## 4. Write the model

Write the model file (the plugin's `stockflow/1` format, indented so it has many short lines, or tables
in the paste form): every element
and link with an id, a label, its status (always written out, "observed" included) and its evidence;
every link with its mechanism.
- **Evidence**: a path relative to one of the subject's roots, the line range, and an **exact quote** of
  those lines. A quote that is not in those lines is a fabrication, however close it is. For PDFs,
  slides, web pages, notebooks or one-line (minified) files, make a text extract **with a tool** (for
  example `curl` and an HTML-to-text converter, `pdftotext`, `jupyter nbconvert --to script`, or a
  pretty-printer), never by retyping it and never from a fetch tool that answers with a summary; save it under a root of its own, record in `from` the original's address and the command
  that made the extract, and cite the extract. The check verifies quotes against the extract only, so
  the extract must be the original's own words.
- **Units**: a flow counts its stock's units per time unit (Forrester & Senge 1980; Ford 2019).
- **Emphasis** (optional, for example defects a review found): state the rule for what earns the
  highlight in one sentence before marking anything. The page shows the rule wherever the colour is.

## 5. Check

Run the check after every edit, and resolve what it reports:
- **Every closed causal path is a loop and must be declared.** The check lists each undeclared one with
  its route (each step's mechanism) and no verdict. Trace a change around it from the mechanisms ("more
  X → more Y → less Z → … → more X"; Sterman 2001's "right way"), decide R (reinforcing: the change
  comes back amplified) or B (balancing: it comes back opposed), then name it R1/B1 (the id is the
  letter drawn in the marker, so nothing else is accepted) with a story. The check computes the type
  from the signs; a disagreement means a sign or the trace is wrong (Ford 2019). Or decide the loop is not real and fix the structure: a merged variable,
  a link the code does not have. A loop of only a stock and its own outflow, where more in the stock
  means more draining out (a routine drain), may be declared `minor`. The check refuses `minor` on
  any other loop and on a loop the short answer cites.
- **Every loop contains a stock** (Naugle 2024). A loop of variables only means something that
  accumulates (a perceived value, a backlog, an in-flight count) is drawn as a variable.
- **What stops each outflow when its stock is empty?** Cite the guard as a link, or record a missing
  link if the code has none (direct extreme-condition test: Forrester & Senge 1980).
- Loops through modelled parts are shown as modelled; loops that need at least one intended or
  missing part are listed separately, as loops that would exist if built.
- Resolve every warning, or say in the record why it stands.

## 6. Render, look, and show a draft

- Render the page. It has the question and short answer first, then a legend that explains every mark
  it uses, then the figures with their loops, then the sources. Writing it is a file write the person
  may be asked to approve; if they decline, say where the page would go and ask, rather than producing
  the page some other way.
- Look at it: screenshots in light and dark mode and at phone width if a headless browser is available;
  otherwise read the reader view (the render tool returns it; the check tool does too, with
  reader_view), and say the page was not inspected visually. Fix overlaps by moving elements on the grid; settle the structure before
  polishing layout.
- **Show the person the draft now**, marked as not yet reviewed (the path, or a private page if you
  can publish), and carry on unless they redirect.

## 7. Review: independent, proportional, then stop

Reviewers who did not build the model check it, read-only, one lens each (the lens briefs follow).
Prefer separate agents; if you have none, do each lens yourself as a separate pass and label the
review "self-review, not independent". The cold reader gets only screenshots or the reader view text, never
the model or the HTML source.

Each finding records: where, what, the evidence, the fix, a severity, whether a reader sees it, and
whether fixing it would widen the scope.
- **high**: a false statement about the system, or wrong structure (a loop that is not there, a missing
  loop, a wrong sign); or a mark on the page nothing explains.
- **medium**: misleading or ambiguous; a quote that does not support what is drawn; a mechanism the
  question needs is missing.
- **low**: wording and layout polish.

Fix every high finding, every in-scope medium finding and every false statement in the model itself,
then check, render, and run **round 2**: each fixed finding re-checked by the lens that raised it
(one reviewer may hold several lenses), plus the cold reader again. **Two rounds by default**; the
person can ask for more. Findings that would add a mechanism, a figure or scope, and wording
preferences, go to the person's triage list unfixed. Stop when a round finds nothing high or medium,
or after the rounds agreed. Hand over the rest as a short list: what it is, whether a reader sees it,
what fixing it costs, your recommendation. The person decides.

## 8. Deliver

End with:
- the one-line answer;
- the page (path, and the private link if you published), the model file, and the record (what each
  review round caught, what was accepted as a known limit, what was not checked);
- how the model was reviewed (rounds, independent or not, visually inspected or not), also written
  into the model so the page footer shows it;
- the triage list, if any.

Offer to publish the page if your environment can share pages. Anything you tell the person about the
model (what a mark means, why a loop exists) is a claim about the system: check it against the model
and the sources before you send it. If they ask what a mark means, the legend failed: fix the legend
as well as answering. Never present behaviour (growth, oscillation, which loop dominates) as a
finding; that needs a calibrated simulation (Schwaninger & Groesser 2009; Barlas 1996).

## 9. Revise

When the person corrects something later ("that arrow is wrong"): change the model, check, render,
run one corrections-only review round, and update the same page and record.
<!-- method:end -->

<!-- lenses:start -->
## Review lens briefs

The plugin registers these as read-only agents. In the paste form, give each brief to a separate
reviewer (or a separate pass of your own), together with the paths it needs.

<!-- lens:facts-reviewer:start -->
You are the facts reviewer for a stockflow model: a system-dynamics stock-and-flow model of a codebase,
repository or set of product documents. You did not build it and you change nothing: read-only.

You are given the model file (JSON), the folders its evidence paths are relative to (the subject's
roots), and usually the rendered page and the check report. Check EVERY statement, not a sample:
- each element and link: does the cited quote say what the element claims, and is the quote really in
  the cited lines? Does the link's mechanism describe what the code or document actually does? Does
  the target really read the source there?
- each label, value and number: does it match the source exactly, with its qualifiers?
- each status: is something drawn "observed" really built (for code) or stated (for docs)? Is a
  documented-but-not-built rule drawn as if it runs?
- each loop's story and the short answer: does every step hold in the sources? Is any behaviour over
  time claimed as fact?
- figure questions, captions and notes.
If you have the check report, its "not checked" list says where the tool cannot help you; spend your
effort there.

Return findings only, one per problem, each with: where (element id or page section), what is wrong,
the evidence (file:line and what it actually says), the fix, a severity (high: a false statement about
the system or wrong structure; medium: misleading, or a quote that does not support what is drawn;
low: wording), whether a reader of the page sees it, and whether fixing it would widen the scope. Say
"no findings" if there are none. Do not review the plugin's code or the record's prose.
<!-- lens:facts-reviewer:end -->

<!-- lens:sd-reviewer:start -->
You are the system-dynamics reviewer for a stockflow model: a stock-and-flow model of a codebase,
repository or set of product documents. You did not build it and you change nothing: read-only. If
you have the stockflow check tool, you may run it on the model file; otherwise trace the loops yourself.

Check the model against system-dynamics practice (Sterman 2000 and 2001; Ford 2019; Naugle et al. 2024;
Richardson 1997):
- Is each stock a real accumulation (last value + inflows − outflows), and each flow a rate of events,
  not a function or a data path? Is anything read, logged or scored drawn as a drain?
- Do links end only on variables and flows? Is each sign right by the counterfactual definition (+:
  higher than it would otherwise be), including a stock's link to its own outflow?
- Are mechanisms with different conditions merged into one variable, manufacturing loops? Are loops
  closed by a story the evidence lacks? Are one-shot gate sequences drawn as loops?
- Does every loop contain a stock? Is each R/B right when you trace a change around it? Does each
  balancing loop name its goal where the sources have one?
- Delays: does each information delay hide a stock the question turns on? Is a material delay drawn as
  a link instead of a stock in transit?
- Boundary: are clouds really inconsequential? Is anything that changes over the horizon treated as a
  fixed input? Is perceived conflated with actual, or requirement with supply?
- For each stock: when it is empty, what stops its outflows? Is that guard cited?
- Is the short answer endogenous, and is it stated as a hypothesis, not a simulation result?

Return findings only, one per problem, each with: where, what is wrong, the evidence, the fix, a
severity (high: wrong structure, a loop that is not there or is missing, a wrong sign; medium:
misleading or ambiguous; low: polish), whether a reader sees it, and whether fixing it would widen the
scope. Say "no findings" if there are none.
<!-- lens:sd-reviewer:end -->

<!-- lens:reader-reviewer:start -->
You are a cold reader: a capable product person who has never heard of system dynamics. You are shown a
page about a software system or product, as screenshots or as its plain-text reader view, and nothing
else. You change nothing.

1. Without reading anything but the page, answer the page's own question in your own words.
2. Make an inventory of every distinct visual mark on the page (each shape, line style, colour, symbol,
   marker and sign) and give the meaning the page gives it. Mark any you cannot decode from the page as
   UNEXPLAINED.
3. List every sentence, label or caption you cannot understand, and anything that misleads you.

Return: your answer to the question; the mark inventory; then findings, one per problem, each with:
where, what is wrong, the fix you would want, a severity (high: an unexplained mark, or you came away
with a wrong answer; medium: confusing; low: polish), and whether fixing it would widen the scope.
<!-- lens:reader-reviewer:end -->
<!-- lenses:end -->

## In the paste form

Without the plugin there is no check tool, no renderer and no review agents. Run the method with these
substitutions:
- **The model** is three tables: elements (id, kind, figure, label, units, status, evidence with an
  exact quote, claim); links (from, to, sign, mechanism, status, evidence); loops (id, path, the trace
  with the type worked out, story).
- **"Run the check"** means these checks by hand, before every review round:
  - Each flow runs between two stocks, or a stock and a cloud. Each stock has at least one flow. No
    link ends on a stock, a constant, a cloud or a shadow.
  - Find every feedback loop: from each stock, follow links and flows until you return. For more than
    a handful of elements, write a short script that lists every elementary cycle (Johnson 1975).
    Every cycle must be declared; every declared loop must be a cycle; every loop contains a stock;
    the type is the product of the signs, counting a flow + into the stock it fills and − out of the
    one it drains.
  - Open each cited file and confirm each quote is in the cited lines. Every number you state comes
    from a quote, or from a claim marked modelled.
- **"Render the page"** means: draw each figure by hand (or in any drawing tool) with a legend that
  explains every mark used, then the loops with their traces, the boundary and the sources. A
  causal-loop sketch (for example in Mermaid) cannot show stocks, valves or clouds: title it
  "causal-loop sketch", not a stock-and-flow diagram.
- **The reader view** for the cold reader is the page's text: the question, the short answer, the
  legend, and each figure described in words (its stocks, flows, links and loops).
- **"Write the review into the model so the page footer shows it"** means: end the page with how it was
  reviewed (rounds, independent or not, inspected visually or not).
- **The review lenses** are the briefs above, each given to a separate reviewer or done as a separate,
  labelled pass of your own.

Sources the rules cite (full list, with what each was read for, in the plugin's `REFERENCES.md`):
- Sterman 2000: J. D. Sterman, *Business Dynamics* (2000); Table 5-1 (link polarity), Fig. 3-1 (process).
- Sterman 2001: J. D. Sterman, "Fine-Tuning Your Causal Loop Diagrams", *The Systems Thinker* 12(5–6).
- Ford 2019: D. N. Ford, "A system dynamics glossary", *System Dynamics Review* 35(4), doi:10.1002/sdr.1641.
- Naugle 2024: A. Naugle, S. Langarudi, T. Clancy, "What is (quantitative) system dynamics modeling?",
  *System Dynamics Review* 40(2), doi:10.1002/sdr.1762.
- Richardson 1997: G. P. Richardson, "Problems in causal loop diagrams revisited", *System Dynamics
  Review* 13(3).
- Trimble 2014: J. Trimble, "Boundary Concepts in System Dynamics", International System Dynamics
  Conference 2014.
- Forrester & Senge 1980: "Tests for building confidence in system dynamics models", TIMS Studies in
  the Management Sciences 14; Shreckengost, "Dynamic simulation models: how valid are they?", MIT D-4463.
- Schwaninger & Groesser 2009: "System Dynamics Modeling: Validation for Quality Assurance",
  doi:10.1007/978-0-387-30440-3_540; Barlas 1996, *System Dynamics Review* 12(3); Lane 2008,
  doi:10.1002/sres.826.
- Hines: J. Hines, "Standard Method", MIT 15.879 (2014). MIT D-4498: "Road Maps Glossary".
- Johnson 1975: D. B. Johnson, "Finding all the elementary circuits of a directed graph", *SIAM Journal
  on Computing* 4(1), doi:10.1137/0204007.
- "Plugin rule": learned while building and reviewing the model this method generalizes; no external
  source.

> **Name.** This plugin was called `stockflow` until 2026-10-30, when it became `dynamics` and absorbed the method of the
> `add-dynamics-plugin` prototype. The rounds below are its review history under the old name.

# How stockflow was reviewed

Each round below was run by reviewers who did not write the code, each with one lens, each working in
its own copy and reproducing every finding through the real path (the tools, the command, the skill,
a real headless Claude Code session, or the page in a browser). In round 1 a second agent then tried
to refute each finding before it was accepted, and in round 3 each high and medium one (the low ones
were accepted on the reviewer's own reproduction); in round 2 the reviewers' own reproduction scripts
were re-run against the fixes. Every accepted finding was fixed or is listed under known limits. From
round 3 on, every fix is pinned by a test that was seen to fail when the fix was reverted in a scratch
copy.

The most useful pattern for the next reader: **22 of round 2's 47 findings, 16 of round 3's 38,
11 of round 4's 16, 9 of round 5's 12, 7 of round 6's 10, 7 of round 7's 10 and 5 of round 8's 8 were
defects introduced by the previous round's fixes** (counted from each round's review record), at the seams between functions (a value
derived in two places that disagreed, a guard reading a stand-in where the real source was in reach).
Fixes need review as much as the first build does.

## Round 1: the first build (57 findings accepted)

Lenses: checker, renderer, method and documents, integration with Claude Code.
4 high, 31 medium, 22 low. The high ones:
- the model file was read without consulting the person's read settings, and parse errors echoed its
  content;
- the session's working folder was captured once, so a later `cd` broke both deny rules and where the
  page was written;
- an "ask" permission verdict was treated as "allow";
- an observed element backed only by a web address passed, and the page claimed every quote had been
  checked.

Found while fixing round 1, in a real session: `render` wrote files with no permission prompt at all,
because a plugin's own tool is answered before Claude Code's permission step. Since then, every file is
written through Claude Code's own Write tool.

## Round 2: the round-1 corrections (47 findings accepted, 22 of them regressions)

Lenses: integration, checker and documents, renderer. 6 high, 19 medium, 22 low. The high ones:
- reads were gated by a permission query that runs no PreToolUse hook, so a secrets-guard hook was
  never consulted and the check could be used to test guesses about a blocked file. Since then, every
  read goes through Claude Code's own Read tool;
- a Write rule on a symbolic link's own name was bypassed, because only the resolved path was asked
  about (a regression);
- a misspelt `status` silently made an element "observed". Since then, status is required;
- the plural rule for units refused correct models (a regression);
- a flow route with no corner produced an empty figure;
- the page's count of checked quotes was computed in two places that disagreed (a regression).

## Round 3: the round-2 corrections (38 findings accepted, 16 of them regressions)

Lenses: integration, checker, renderer. 3 high, 16 medium, 19 low after verification (the reviewers
rated 4, 18 and 16); none refuted. The high ones, and one the skeptic rated medium:
- every page put its whole body on one line, so once a page grew past what one Read call returns
  (a model about 1.3 times the worked example) it could not be read back, and so could never be
  replaced; the render that wrote it said nothing (a regression of round 2's switch to the Read
  tool). Since then the page is written in short lines and a failed read-back is reported (round 4
  found rows that still listed the whole model on one line, and split them);
- a behaviour pattern based on data took its numbers from its own "why" and its variable's claim,
  neither of them checked, and the page showed it as observed. Since then its numbers must be in its
  own checked quotes;
- a constant's value written in hex, scientific notation, a compound duration or a long version
  number was never compared with its quote (rated medium after verification). Since then such a value must appear, as written, in a
  checked quote;
- the guard against broken coordinates searched the figure's text for "NaN" and "Infinity", so a
  model whose labels used those words could not be rendered (a regression). Since then the guard
  counts the coordinates themselves.

The other regressions: notebooks, and files with one very long line, could no longer be read, with
messages that were false or could not be acted on; a file outside the working folder was asked about
once per Read call, with too many calls (12 for one 350 KB file; 7 after round 3's fix); a page with text after its
seal got two contradicting messages; a loop story's sources depended on the order of links in the
file; ordinary code files (`security.py`, `history.ts`) were classed as documents, while saved
extracts of web pages no longer were; the page-wide prose check left out reference modes' checked
quotes; a path with two spaces could not be cited; a fixed width cap shrank wide figures below a
legible size; copies of modelled and missing elements looked the same, and a copy's detail panel was
empty; the R/B legend letters carried a text halo; and a missing pipe's × could overlap its arrowhead.

Found while fixing round 3:
- a node at a far-out cell (the checker accepted `[1e306, 0]`) hung the renderer for good. Since then
  the layout's spatial index lists such items separately, and the checker limits cells to 0–100;
- with paths kept as written, a file whose name contained a line break could add a forged line (for
  example "Review: 3 rounds") to the reader view. Since then a line break in a cited path or a root is
  refused (E05) (round 3 also collapsed spaces in printed paths; round 4 undid that, see below);
- a subject root starting with "~" was joined onto the model's folder. Since then it is refused (E05),
  as the model path and `out` already were.

Decisions the fixers narrowed, recorded so they are not mistaken for slips:
- the Read tool is asked for as few as 1 line per call (not 25), so "a line is too long for one Read
  call" is said only when it is true;
- a constant's value is compared as written when it has a digit outside every number the reader
  finds (this catches versions such as `1.2.9`, which read as 1.2);
- X01 stays silent when the guard path from a stock to its outflow is recorded as intended or
  missing, even when that path is net − (retired in round 4: a net − path never silences X01);
- ".5" reads as 0.5 only when the dot follows no digit, dot or letter; a comma reads as a decimal
  point only when the digits after it are not exactly three (retired in round 4: a comma never reads
  as a decimal point, nor a dot as a thousands separator).

## Round 4: the round-3 corrections (16 findings accepted, 11 of them regressions)

Lenses: integration, checker, renderer. 2 high, 5 medium, 9 low; none refuted. The high ones:
- the new Read-call sizing worked out how dense a file is from lines the refusal had not counted (a
  short title line, for instance) and let every page that fitted shrink the next one, so it fell to
  one line per call and stayed there: 134 Read calls for a 200 KB document (each a permission request
  when the file is outside the working folder), and a correct 1.5 MB file refused as "too long to
  read" at the 500-call cap (a regression). Since then a refusal's count is applied to exactly the
  lines it counted (one line is read first when the file's length is not yet known), only a refusal
  shrinks the page, a page grows at most twofold when the last count says it fits, and the cap (4,000
  calls) is above what any file within 2 MB needs at the Read tool's default cap; reaching it says "stopped after N Read calls". In
  real sessions the same document took 5 calls and the 1.5 MB file 30;
- reading source numbers "leniently" added every possible reading of a number, so "1,500" also
  supplied 500, "10,000" supplied 0 and "1.500" supplied 1500: a wrong number on the page passed as
  checked (a regression). Since then each number in a source is read once, the same way as on the
  page; a comma grouping splits into its parts only when it is an item of a list in code; locale
  readings are gone, and locale formats are listed as not checked.

The medium ones:
- a value in scientific or hex notation was compared by its mantissa (`1.5e-3` as 1.5). Since then
  such literals are read whole, by value and with their sign, on both sides;
- X01 was silenced by a recorded path that would not stop the drain (a regression). Since then X01 is
  decided once, from the live and the full graph together;
- the elbow rule applied the arrowhead's clearance to the end that has no arrowhead and never tried
  the other elbow (a regression). Since then only the run into the target needs that room, and the
  other elbow is tried (round 5 replaced these corner rules with one route chooser, below);
- two definitions of "in line" disagreed, so two opposite flows could be drawn on top of each other (a
  regression). Since then one rule decides whether a pipe has a corner, and the pair logic runs after
  it (also replaced in round 5);
- a copy of a missing element had two sizes, so its own outgoing link was reported as crossing it (a
  regression). Since then one rectangle serves both.

The low ones: a hook that stripped the page's seal got a self-contradicting message; several decisions
were not pinned by any test (the 1-line floor among them); the notebook message blamed the Read tool
for the plugin's own choice; a .txt extract of code declared as code was flagged as a document; Arabic
decimal and thousands separators were not read; a cited path with two spaces was printed with one;
and some page lines still grew with the model.

Found while fixing round 4:
- trying the other elbow let a flow and its return share a corner (320 of 3,528 stock-to-cloud
  placements in a sweep). Each pair of ends then recorded the corners and detours already used, and
  refused a corner already taken (round 5 replaced the record: flows between two ends are now routed
  together);
- printing paths as written exposed the "lines" field, which accepted a line break. Since then the
  page prints the line range the checker parsed, and "lines" holding a line break is refused (S01);
- in the number reader: `[1_000,2_000]` read as 0 and 0; the bracket scan was quadratic; a long code
  list overflowed before it was split; `1.5e−3` written with a true minus sign read as 1.5; and the
  leading-dot rule had its own copy of the exponent pattern;
- the test kit does stop a test after 5 seconds, which this log had said it did not; the slowest
  tests now set 30 seconds.

Decisions the fixers narrowed in round 4:
- prose in brackets keeps its grouping ("(up to 1,500 jobs)", `log("over 1,500 jobs")`); only an item
  of a list in code (inside `[ ]`, `{ }` or a call's `( )`, between that bracket, commas or quote
  marks) is split;
- a declared kind "doc" can still mark a code file as a document (it can only add a warning); for a
  .txt or .html file a declared kind decides, so `kind: "code"` also silences E06 for a note saved as
  docs/x.txt;
- a straight pipe runs level or plumb through the band the two ends share, and slants only when that
  band is narrower than the pipe (round 5: the slant is now the last resort, after elbows and
  detours);
- a loop's trace and hedge are written one step per line, like the boundary and component rows;
- with no token count in a refusal the page is quartered and does not grow again (retired in round 5:
  a page that fits grows twofold again, staying below the refused size only while it overlaps the
  refused lines); stockflow asks for at most 2,000 lines per call, though the Read tool accepts more.

## Round 5: the round-4 corrections (12 findings accepted, 9 of them regressions)

Lenses: integration, checker, renderer. No high, 6 medium, 6 low; none refuted. The medium ones:
- a notebook over 25,000 tokens or 256 KB was refused whole by the Read tool and blamed on a line too
  long. Since then a notebook, PDF or image is known by its extension, as the Read tool knows it, and
  named for what it is whether it is returned or refused; when one line weighs what the bigger page
  did, the next line tells a one-line file from a tool that does not page the file;
- the Read tool's second size refusal ("…more than a read can return. Use a smaller limit…") was taken
  as a failure, so with `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` lowered a correct model citing a 1 MB
  file was refused. Since then it is a size refusal without a count;
- the list-in-code rule read sources only and took a quote mark as a list boundary, so a page that
  copied its code was flagged, a quoted "1,000" lent 1 and 0, and `IN (…)`, tuple arguments and padded
  braces were read as one number (regressions). Since then one reader serves the page and the sources;
  a quote mark is never a boundary and a string is prose; and `(` also opens a list after `=`, a
  comma, a bracket, or `IN` or `VALUES`;
- an elbow's corner was judged by where its corner point sat, so a pipe could run 1–7 px along the box
  it leaves with its valve on the box, unwarned; and routes were chosen one flow at a time in file
  order, so a model drew differently with its flows reordered (regressions). Since then one chooser
  judges each candidate shape as drawn (its runs, the arrowhead's room, its valve), and decides all
  flows between the same two ends together, by id; a valve on any stock, cloud, variable or constant,
  its own ends included, is G03.

The low ones: with no token count, pages never grew again, so a 1.56 MB file with a dense head and
1.4 million empty lines hit the 4,000-call stop (now 713 calls); the stripped-seal note offered
excluding the page from the hook as enough, when only deleting it helps; two parts of the sign rule
were not pinned; the kind doc and messages said "kind" decides for any .txt, though a document's name
(README.txt, HISTORY.txt) decides first; and the route doc described rules the code did not follow.

Found while fixing round 5:
- a PDF over the size limit was also blamed on a long line; PDFs and images are now known by their
  extension too;
- skipping spaces between list items let a prose list inside a string split (`raise ValueError('one
  of 1,000, 5,000, 10,000')` lent 5 and 0); an item must now be outside any string (narrowed in round 6: not inside a string opened after its
  bracket). A long list after
  a long run of spaces was quadratic; it is now linear;
- flow labels were also placed in file order; a named route could lose its shape to an earlier
  default flow when more than four flows join the same ends; a named route drawn as a slant that did
  not fit was silent; and the lint's search radius for pipes running along each other was 8 px against
  its own 9 px rule;
- by the lead, after merging: a constant's value had been allowed to pass when its text appeared in a
  quote, before any reading, so "1,500" passed against `clamp(n,1,500)`, where the file says 1 and 500.
  Since then a value is read like everything else, and only digits read as no number (1m30s, 1.2.3)
  are compared as written. And a quote was read alone, so "(1,500)" cut out of `clamp(1,500)` lent
  1500; since then a checked quote lends only the numbers its file gives on the lines where it was
  found (superseded in round 6: that re-read the lines alone; a quote now lends what the whole
  file's reading gives inside it).

Decisions the fixers narrowed in round 5:
- `IN` and `VALUES` open a list only in capitals ("values (1,500)" is common prose);
- an item's right edge must be its own bracket's closer, so `[1,500)` reads as 1500;
- when two named routes ask for the same corner, the later id is drawn as the other elbow (superseded
  in round 6: the earlier id keeps its own, and a kept named route that still meets a sibling gets a
  G08);
- a detour costs more than two elbows, and the earlier id takes the cheaper shape in a tie.

## Round 6: the round-5 corrections (10 findings accepted, 7 of them regressions)

Lenses: integration, checker, renderer. No high, 3 medium, 7 low; none refuted. The medium ones:
- a PDF of more than 10 pages, one whose page count is unknown, or one the model cannot read whole was
  refused in the Read tool's words, whose remedy (the pages parameter) a citation cannot use, while a
  1-page PDF was told to cite a pdftotext extract. Since then the path decides first: any refusal of a
  notebook, PDF or image is named for what the file is, and the tool's first sentence is added only
  when it says something other than that the file is too large to read whole (an invalid image, a PDF
  with no `%PDF-` header);
- the round-5 lending re-read only the matched lines, so a quote from the continuation line of a
  wrapped call lent 1500 where the file says 1 and 500, and one place lent differently under "lines"
  "2" and "1-2". Since then each file is read once, as a whole, and a quote lends the numbers that
  start inside its matched span; whether a quote cuts a number is judged on that same reading;
- the route chooser counted a pipe drawn on top of a sibling as one clash, no worse than a crossing,
  so three or four flows between two ends could be drawn as one pipe (a regression). Since then one
  predicate serves the chooser and the lint, graded: drawn on top, then running along or through a
  valve, arrowhead or ×, then a shape that comes with a G08, then a crossing, which is accepted
  (round 7 narrowed what a crossing is and added a shape's own fault and valves meeting, below).

The low ones: two branches of the next-line probe were not pinned; the paging rule was stated in two
places that disagreed (it is now stated once, at `SIZE_REFUSAL`); a value not read as a number was
matched against the quote's own text, so a quote cut after the minus backed an unsigned value (it is
now matched where the quote was found, sign included); page text in brackets is read as code, as
decided, and now says so, with an item's E04 naming its list; the documents left out two number
reading limits; ties between named routes went to a stand-in's cost, not the id; and a straight pipe
was judged by the band's width, not the arrowhead's base, which could hang past the target's corner.

Found while fixing round 6:
- a refusal's words were classed with the file's path in them, so a folder named "too large" or
  "exceeds maximum allowed" decided the class; refusals are now classed without the path (narrowed in round 7: by their first sentence, with
  stockflow's spelling of the path masked; other text the tool quotes is not removed);
- the first own-sources pin passed its mutant because nodes are checked in file order;
- the arrowhead check's forward line was too short for slants; the lint's along test read three run
  ends and so depended on id order; the chooser ignored a missing flow's ×; the G08 explanation named
  the first sibling, not the one drawn on top.

Decisions the fixers narrowed in round 6:
- only the Read tool's first sentence is added to a typed file's message, never its advice; a
  person's own refusal of a notebook, PDF or image stays an E07 in their words;
- `findQuote` judges whether a quote cuts a number on the file's own reading, so a quote ending between
  two list items (`500,502,` in an `IN (` list) is found;
- a shape that always comes with a G08 (a slant, a refused route) ranks below a crossing, so a third
  flow crosses a sibling rather than slant to avoid it.

## Round 7: the round-6 corrections (10 findings accepted, 7 of them regressions)

Lenses: integration, checker, renderer. No high, 5 medium, 5 low; none refuted. The medium ones:
- a Read deny rule reaches stockflow as the Read tool's own error, not as a deny, so a denied PDF,
  image or notebook was told to extract the file the person denied (a regression). Since then any
  Read or Write error is put to the engine's verdict for the same call, and a deny there is the
  person's refusal (E07, or "writing … was refused"), for every file and the model file;
- since round 6 a cited file is read as a whole, so a comment inside any open bracket (a function
  body, a list, a call) was read as code: `// waits 500, 1,000, 2,000 ms` gave 500, 1, 0 and 2000, a
  page copying it was warned, and "the first wait is 1 s" passed (a regression). Since then a comment
  opened after the innermost bracket is read as prose, as a string is; it is guessed by its marker
  alone (round 8 found that a quote mark inside a comment was still counted, so a quotation wrapping
  across comment lines turned the rest of a comment back into code; see round 8);
- a crossing was any two runs within 9 px that did not lie along each other, so pipes leaving an end
  6 px apart, which paint as one pipe that forks, were reported clean (a regression). Since then two
  pipes cross only where their runs cross with every run end at least 9 px from the other run; any
  other approach touches (G03), and the chooser avoids it;
- the chooser never counted a shape's own fault, so a refused route could be drawn as a slant whose
  valve covered both ends while elbows fit, and its G08 said "no other shape does" without looking.
  Since then a shape that does not fit is drawn only when each shape that fits would be drawn on top
  of another pipe, and the G08 says which is true;
- valves were tested against runs only, so overlapping valves were reported clean. Since then a valve
  on another's valve or arrowhead moves along its run, and what cannot move is avoided or reported (G03
  "its valve sits on the valve of").

The low ones: a missing PDF or image was named for its type and lost the tool's "Did you mean";
a refusal was classed on all its words but told by its first sentence (now one value, the first
sentence with the path masked); the paging statement left out the one-line length read; the value doc
said an unread value may be written in an observed element's claim, which is no source; and the
grading above four flows was not pinned.

Found while fixing round 7:
- the Write tool answers a deny rule the same way as Read, so a denied page write was said to have
  "failed"; it now goes through the same verdict (by the lead, after merging);
- the token count and the next-line probe also read all of a refusal's words, and `notPaged` cut its
  own first sentence; both now read the one value;
- a code list right after an in-bracket comment, with no comma between, reads as one number, as
  before; recorded as a known limit rather than skipping comments at item boundaries, which would turn
  a wrong comment guess into splitting;
- the kept-route G08 read the chooser's valves, not the drawn ones; only the later of two valves
  moved; a slide can land a valve on a third node (reported, G03).

Decisions the fixers narrowed in round 7:
- a shape's own fault ranks right after "drawn on top", not first: first, it drew two pipes on top of
  each other;
- the five-flow pin uses two placements from a sweep, because the reviewer's level case has only three
  distinct shapes, which both mutants draw alike.

## Round 8: the round-7 corrections (8 findings accepted, 5 of them regressions)

Scope: the round-7 corrections only, and older defects only if high. No high, 1 medium, 7 low; none
refuted. The medium one: a quote mark inside a comment was still counted, so one quotation wrapping
across two comment lines (or two apostrophes in the comments of one body) left a string "open" and the
rest of a comment was read as code again; in a sample of 400 Go files, 19 comment lines inside
brackets were read so. The round-7 log claimed a wrong guess could never read prose as code. Since then
quote marks inside an open comment are not counted. The cost, stated where readers meet it: a `/*`
that opens no comment stops the count until the next `*/`, so a string after it may be read as code
(in a fuzz of 200,000 random strings about 1,000 changed this way; in 1,792 real files, none).

The low ones, fixed by the lead after the round:
- the Write tool also refuses a page path a Read deny rule covers, while a Write query allows it, so
  that refusal was said to have "failed"; a write's error is now put to both verdicts the Write tool
  applies;
- a session whose settings deny Read or Write outright has no such tool, so every call and query
  rejects; that is now reported as the person's refusal ("this session has no Write tool"), using the
  session's own tool list, not as a failure in the plugin API's words;
- the comment limits misdescribed a Lua `--[[ ]]` block (read as code on every line: its `[[` is a
  list bracket) and what a marker that is no comment does (only items in a bracket opened before it
  turn to prose);
- this log miscounted regressions in rounds 4, 6 and 7 and listed round 3's severities before the
  skeptics' verdicts; all counts above are now taken from the review records;
- the route doc's rule for keeping a named route listed the faults by hand and missed "valve on a
  valve"; it now refers to the faults above;
- the G08 for a kept named route that reads the drawn valves was not pinned; it is, with the
  reviewer's case;
- a valve on another pipe's arrowhead was told to "set its valve", which cannot help (an arrowhead
  stays at its target and the valve's whole run was already tried); it is now told to set a route or
  move an end.

Not pinned, and why: the lint's exact finder for two marks that meet matters only when a grid edge
falls within half a pixel between two valves that cannot move; no such case could be built.

These last fixes were checked by the lead (each fix's test fails when the fix is reverted) and by the
test suite, but a ninth independent round was not run: see "Where the review stopped" below.

## Where the review stopped

Eight rounds were run. The findings fell from 57 to 8, and from round 5 on none was high. Every round
still found something, most of it in the previous round's own fixes, which is this log's main lesson.
The stopping rule set before round 7 was: stop after the first round with no high or medium finding,
fixing its low ones. Round 8 had one medium, a one-line change (quote marks in comments) to a residual
already known, plus seven lows. The lead fixed all eight, checked that each fix's test fails when the
fix is reverted, and stopped there rather than run a ninth round: a departure from the rule, made
because the remaining fixes were small and the findings had fallen to one medium. So the round-8 fixes
have not had an independent review of their own; the next change to this plugin should start with one.

## Known limits, accepted

- A PreToolUse hook that matches the plugin's own tool names (`mcp__dynamics__…`) is not run for
  them: Claude Code answers a plugin's own tool through the plugin. Hooks on Read and Write still run
  for every file the tools touch, and explicit allow, ask and deny rules for the tools are honoured.
- Numbers in page-wide prose (the answer, captions, notes) are checked against every checked quote
  and modelled claim in the model, not against the element the sentence is about.
- The test kit imports code files only, so the plugin's tests use a stand-in for `prompt.md` with the
  real markers; the real file's sections are checked outside the kit. The kit stops a test after 5
  seconds (the slowest tests here set 30), but it cannot stop a test stuck in a synchronous loop, so
  reverting the layout's far-out-cell guard hangs the suite instead of failing a test.
- A file with one line too long for one Read call (minified code, single-line JSON) cannot be read at
  any size, and PDFs and images are not read as lines: such sources are cited through a tool-made
  text extract. Revisit if the Read tool gains a way to read part of a line.
- Notebooks are cited through an extract by choice: dynamics cites line ranges, and the Read tool's
  view of a notebook is cells with no line numbers. Revisit when a model must cite a notebook and an
  extract will not do.
- A refusal with no token count cannot tell a line too long for one call from a Read tool that does
  not page the file; dynamics blames the line. With `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` lowered
  to about 5,000, a file near 2 MB of long lines in pairs between runs of short ones can need more than
  the 4,000-call stop. Revisit if either is met in a real model.
- A size refusal in words dynamics does not know fails at once in the tool's words (E02), so a correct
  model citing a large file is refused; and a file with no extension that the Read tool sniffs as an
  image is known as one only when the tool returns it. Revisit if the Read tool's wording changes.
- The page is read as code too: digits in `[ ]` or `{ }` on the page are list items, so "[1,500]" in
  the answer is 1 and 500 (the E04 for an item names its list). Inside an open bracket, a comment is
  read as prose, as a string is, but it is known by its marker alone (`#`, `//` or `--` to the end of
  the line, `/*` to `*/`, outside a string), and quote marks inside it are not counted. So prose inside
  any enclosing bracket that is in a comment of another syntax (`;`, `%`, the later lines of
  `<!-- -->`), or in a document after a bracket left open, still splits a comma run of groupings; a Lua
  `--[[ ]]` block is read as code on every line, its `[[` being a list bracket. A marker that is no
  comment (Python's floor division `//`, a `#` that is not a comment, a decrement `--`) makes the items
  after it, in a bracket opened before it, read as prose to the end of its line (after `/*`, to the next
  `*/`), so such a list is one number and a page that gives its items is warned; a bracket opened after
  the marker is still read as code. A `/*` that opens no comment stops the count of quote marks until
  the next `*/`, so a string after it may be read as code. A code item right after a comment, with no
  comma between them, is read as one number. Revisit when one of these is met in a real model.
- A refusal is classed by its first sentence with only dynamics's spelling of the path masked: a
  working folder, a file's first bytes or the path spelled another way still decide the class when
  they fall in that sentence.
- A valve is tested as a 22 px square: the bowtie reaches 7 px along its pipe, so valves 14–22 px
  apart along their pipes are moved apart or reported though they do not touch, and on a slant its
  corners reach 2 px past the square; a valve moved off another's mark can land on a node other than
  its ends (G03); runs that cross away from their ends are a crossing however shallow the angle above
  the along test's 3°, so pipes crossing at 5° paint as one for about 90 px; and a valve over another
  pipe's × is not tested. Revisit when one of these is reported.
- The layout lint boxes an arrowhead as a 16 px square around its tip, which misses a pipe crossing
  the drawn arrowhead 9–12 px behind the tip. Boxing the drawn arrowhead shifts the worked example's
  link bends, so it waits; revisit when such a crossing is reported.
- A list held in a string is read as prose, so `"retry_on": "500,502,503"` is one number; and a list
  bracket written inside a string or a comment (`"see [1,000, 5,000]"`) still splits. A `(` after a name and a
  space, a colon, lower-case `in` or a closing bracket (`handlers[0](1,500)`, `make_clamp(n)(1,500)`)
  is read as prose.
- A quote in Chinese, Japanese, Thai, Lao, Khmer or Myanmar must start and end at punctuation or a
  space in the source, because the whole-word rule treats those letters as word characters.
- Digits joined by commas in threes are one number unless they are an item of a list in code (`[ ]`,
  `{ }`, or `(` after `=`, a comma, an opening bracket, a call's name, or `IN`/`VALUES` in capitals; not
  inside a string or a comment opened after that bracket), so a CSV row `8,120` reads as 8120 and a page number taken from it is flagged (E04).
- A file of very short lines takes one Read call per 2,000 lines (2 MB of empty lines, 1,000 calls).
  Revisit if that many permission requests outside the working folder becomes a problem: the Read
  tool accepts more than 2,000 lines per call.

## The merge into `dynamics` (2026-10-30): one review round, as agreed

**What changed.** `stockflow` became `dynamics` and took the earlier prototype's method: three survey
angles, reference modes as patterns, the "should this be modelled at all?" check, the research step,
and leverage points, missing feedback and a dominance hypothesis in the report. Review rounds are now
agreed with the person up front. The page draws figures at about natural size in a wider column,
folds the not-machine-checked list under its own heading, and shows an answer written on several
lines one line each.

**The round.** One independent round was agreed, with three reviewers (the method, the code and
tests, the documentation), read-only. It found 34 issues: 3 high, 13 medium, 18 low.
- **High:**
  - the review agents' own briefs still said to re-check everything in every round;
  - step 9 ran a review of a correction without asking;
  - the page footer pointed to a "check report" nothing delivered.
- **Medium,** among them:
  - the last agreed round's fixes were not disclosed as unreviewed;
  - the house-rules question and the rounds question could contradict;
  - research findings were kept in unchecked claims rather than checked evidence;
  - the report's hypotheses were written after the review, where no reviewer saw them;
  - missing feedback had two homes;
  - the paste form was not updated;
  - 0 rounds showed "self-review only";
  - nothing warned when more rounds ran than were agreed;
  - the answer splitter guessed sentence ends from punctuation;
  - the Archify comparison left out Archify's own source pinning;
  - "every part is quote-checked" overclaimed;
  - the sketch-mode spec's key test had no rule to give it teeth, and its trigger could not be
    counted;
  - the walk-through spec counted only − links, missing the drains that make most loops balancing.

**Fixed.** All highs and mediums, and every low but one. The new tests were each shown to fail with
their fix undone, in a scratch copy:
- the not-checked list folded on the page;
- the "not reviewed" footer;
- V01 (rounds against agreed);
- pages sealed under the old name;
- answer lines.

365 tests pass, and `claude plugin validate` passes.

**Not reviewed.** Under the method's own rule, these fixes were not reviewed again: one round was
agreed, and a further round needs the maintainer's yes.

**Known limit (low).** A model with a `review` block but no `agreed` count draws no "of N agreed" and
is not warned about. Revisit if delivered models omit it.

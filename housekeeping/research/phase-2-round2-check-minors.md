# The small check of the second round

The owner chose a small check of the second Phase 2 fix round ("Small check", 2026-11-12). It ran at the tip
38b9a2d over `b5e884b..38b9a2d`: five lenses (privacy, reads, git, parsing, procedures), each in its own clone,
one completeness look, one merge of duplicates, one skeptic per serious finding, and one report. It used 12
agents of the 25 its script allowed, in 50 minutes, and ran no live session. The gate at the tip passed (254
kit tests, 35 Node tests, validate with its two usual warnings). The full report stays in the local raw notes.

Of the 18 findings the round answered and finding 13's two minors:
- **Hold:** 5, 7, 8 and 12.
- **Hold with a limit:** 1, 3, 4, 6, 9, 10, 11, 13 and its two minors, 15, 16 and 17.
- **Untried, because they need a live session:** 2 and 14.
- **Does not hold:** 18 (HK-087), fixed after the check in db75b1b, with tests; no check has run on that fix.

How to read a line: the place is the file and line the check gave, under `housekeeping/`. **Open** means
nothing settled it. **Fixed** names the commit. "Disclosed" means a row or a minors list already held the
class and the check shows more. No skeptic tried these minors.

## Confirmed (HK-087, fixed)

- **Fixed** (db75b1b). `hooks/core/history.ts:28-31`: the blobless stop's line to paste is built from the settings'
  branch and paths, so a hidden command in either runs when it is pasted (finding 18).
- **Fixed** (db75b1b). `hooks/core/history.ts:31`, `README.md:42`, `DESIGN.md` 3.4 and section 9: the cure it names does not
  cure a main with merge commits, and `git backfill` does not cure it on a branch behind main (finding 18).

## Parked minors (HK-088, fixed)

- **Fixed** (b315b83). `hooks/core/privacy.ts:19`: a private key block under the older label `BEGIN PGP SECRET KEY BLOCK`
  still reaches the page, the commit-subject mask and the survey (finding 6).
- **Fixed** (this records pass). `BACKLOG.md`, HK-086: the new false stop also hits Thai and other scripts
  written without spaces, and an accented word just before a dotted at-name (finding 5; disclosed).
- **Fixed** (b315b83, 9ce5a40). `hooks/core/privacy.ts:5`: the wider local part makes the address scan grow with the square of a
  long run of non-ASCII letters, about 2 s on 20,000 characters; no natural text was found to trigger it
  (finding 5; disclosed).
- **Fixed** (93c8307). `hooks/register.tsx:259`: after a compaction in a survey with a file denied, the hook has the agent
  re-read `prompts/survey.md` whole, whose lines on the Node re-run and `--json` the denied context had cut
  (findings 1 and 13).
- **Fixed** (08ce181). `hooks/core/survey.ts:228`: the shell mark is on Suspects lines only; the same path as a
  candidate, in the answers line, or once answered, is unmarked (finding 3).
- **Fixed** (this records pass). `FORMAT.md:73`: it said the Node survey prints the same inventory; it now
  says the Node survey also reads the files the Read rules deny (finding 1).
- **Fixed** (4302479). `hooks/adapter.ts:147`: in a subfolder session the files outside its folder are told to the agent
  as denied by Read rules when no rule denies them (finding 4; disclosed).
- **Fixed** (93c8307). `hooks/register.tsx:75`: the stored view's stamp still holds the branch. A view the older version
  stored is served with two branch lines at every prompt, not once as HK-083 says, and two worktrees on
  different branches rebuild the same view at every prompt, each marked stale (finding 15).
- **Fixed** (93c8307). `hooks/register.tsx:97`: in a blobless clone after a pull, the agent's context shows the old view
  as one being rebuilt at every prompt, the walk reruns each time, and the stop and its cure never reach the
  agent (finding 18).
- **Fixed** (1c6522e). `cli.ts:95`: in a shallow treeless clone with main not checked out, `check` still says the two
  files are not on main (finding 11; disclosed as HK-075).
- **Fixed** (08ce181). `hooks/core/survey.ts:96`: weak suspects with one status word can fill the 15 shown places by path
  order and push a lone ID table into "and N more" (finding 17; disclosed).
- **Fixed** (08ce181). `hooks/core/survey.ts:249`: path mentions that name no tracked file are added to the rest line's
  machine count, though DESIGN 3.8 says such a mention is not counted (finding 10).
- **Fixed** (08ce181). `hooks/core/survey.ts:147`: in a prose file that is not Markdown, `./` is folded both from the file
  and from the top, so one mention credits a second target of the same name as a machine reader (finding 10).
- **Fixed** (93c8307). `hooks/register.tsx:283`: the record of sent procedures is set even when the reply failed, and it
  lasts until the session ends (finding 13).
- **Fixed** (93c8307, a9068f0). `hooks/register.tsx:296`: a fork's own compaction is passed on as it came, though a fork's
  conversation holds the procedure (finding 13).
- **Fixed** (93c8307). `DESIGN.md:403`: it says a resume starts with no procedure; a resumed conversation may hold one, and
  the hook forgets it on the switch away (finding 13; disclosed in part as HK-084).

## Refuted

- The overrun or failed-hook reply still names the Node survey with a file denied: older than the round,
  narrower since, and already filed (HK-074).
- The fence warning keys on a `##` line, not on a row table: the plan's adopted rule and its stated limit.
  The limit was in no record; `FORMAT.md`'s fence rule now says it (this records pass).

## Not covered

- Every live-session check, under the machine's guard (HK-080 holds the owner's).
- A failure inside the compaction hook itself (HK-090): odd input was tried in the kit and the compaction goes ahead; the hook and the new fork hook pass a failure on (93c8307, a9068f0).
- The second round's records pass (f91e940) beyond its backlog rows: each edit re-read against what holds.
- The name and word searches over the branch, which use lists the check did not have; the controller ran them
  before the push.
- Any system other than Windows.

## Left behind

- The Node specs' fixture folders in the user's temp folder (HK-089): the specs remove theirs since 8067f64; the older ones are the owner's to delete.
- The procedures lens loaded the plugin-authoring skill, which wrote the engine's types into the temp folder
  and created this session's empty folder under the user's dev-mods folder, as in the second check.

## The narrow check of the pass (HK-091, fixed)

The owner chose a narrow check of the pass that fixed HK-087 to HK-090 ("Yes, narrow check", 2026-11-12). It ran
at beb5015 over `daf9264..beb5015`: three lenses (privacy, hooks, survey), each in its own clone, and one skeptic
per serious finding, with a cap of 10 agents. It used 4, in 21 minutes, and ran no live session. It found 12, all
minor once the skeptic rated the one important finding down. The controller reproduced the six marked "the pass's own".

What held, among others: the scan stays linear on every long input tried, 1 MB included; the older PGP label is
refused or masked on every surface; the reference repository gives byte-identical output at the base and the tip;
every gating hook has a .catch; a full run of the Node specs leaves nothing in the temp folder.

- **Fixed** (324aea5; the pass's own). `hooks/core/privacy.ts:39`: the widening steps one UTF-16 unit at a time, so an
  astral letter stops it, and text more than 64 characters left of the @ shows unmasked past it. Fix: step by
  code point.
- **Settled the other way** (84b15f4: the automated security review held that the forward step left an address's non-ASCII first letters on show, so words written straight before an address stay masked with it, as DESIGN 3.4 now says; the pass's own). `hooks/core/privacy.ts:39`: the widening now masks non-ASCII words written straight
  before an address (CJK, Thai, an accented letter), which the pattern never counts as the local part. Fix: after
  widening, step forward to the first ASCII local-part character.
- **Fixed** (dd10190; the pass's own). `hooks/register.tsx:278`: after `/housekeeping plan` with a file denied, or in a
  subfolder session, compactions are told the procedures' lines naming `cli.ts` do not apply, though plan's are
  sent whole (rated important by its lens, minor by its skeptic). Fix: test the survey's own recorded sentence and
  name only the survey.
- **Fixed** (dd10190; the pass's own). `hooks/register.tsx:105`: a retry started at a prompt returns before its rejection
  handler is attached, and a load that rejects records no failure, so it walks at every prompt. Fix: catch where
  the build is made, and record a rejection as a failure.
- **Fixed** (dd10190). `hooks/register.tsx:318`: a fork's compaction is built from what the main conversation was handed
  later, not what the fork inherited. Fix: keep each fork's own copy of the record.
- **Fixed** (dd10190). `hooks/register.tsx:318`: a fork spawned inside a subagent or teammate is told the main conversation's
  procedure. Fix: record a fork only when its parent is the main conversation or a recorded fork.
- **Fixed** (dd10190, which settles HK-083 too). `hooks/register.tsx:78`: two worktrees whose settings differ still rebuild at every prompt and are
  served each other's view as the stand-in; older than the pass, but its commit claimed worktrees rebuild nothing.
  Fix: key the stored view by the settings too.
- **Fixed** (0e1f5db; the pass's own). `hooks/core/survey.ts:156`: a script's `./` loses its reader when any tracked file of
  the same name sits beside the script, and is not kept as a possible use. Fix: keep the single file-relative
  target for prose only, and credit the top fold for code.
- **Fixed** (0e1f5db: init sets the section aside, and the warning says an example belongs in skipSections; the pass's own). `hooks/core/parse.ts:95`: a fenced example row table in a section read for rows is a
  false fence warning, and init's "How this file is kept", where plan.md asks for the row format, is such a
  section. Fix: warn only where the fence is a stray, or have init and plan.md set that section aside.
- **Fixed** (0e1f5db). `hooks/core/markdown.ts:53`: a stray opener between the rows of an open table still hides the rows
  after it with no warning; older than the pass.
- **Fixed** (0e1f5db: the mark is added where the sentence said). `DESIGN.md:366`: says unsafe paths are marked wherever the inventory names them; Skipped, references
  and guide lines are not. Fix: mark them, or narrow the sentence.
- **Fixed** (this records pass). `BACKLOG.md`, HK-075: said twelve Git minors were open and the treeless case
  unchecked.

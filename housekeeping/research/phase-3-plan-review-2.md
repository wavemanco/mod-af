# Second review pass on Phase 3 plan draft 2

Three read-only Goldfish lenses, Blockers and Majors only.

## Lens: readiness

Review of draft 2: <repo>/housekeeping/plans/2026-11-13-phase-3.md (persona: implementation readiness; standard: resources/document_standards/implementation-readiness-standard.md)

Paths: `plan:` is the target file. Code paths are under <repo>/housekeeping/. `d.ts:` is <the engine types, scratch copy>.

## Blockers

**1. Task 3, the check after applying: every first audit fails its own check and deletes its branch (Blocker)**
- Problem: the check expects "closed up by N, open down by N". But when there is no duty row, the audit adds one on the same branch, and the partition counts that row as open and "not now". So open moves by −N+1, and the rule "Any other result: delete the branch" fires.
- Every repository's first audit has no duty row: call 10 adds none to init, and existing repositories have none. The acceptance fixture names no duty row either, so the DESIGN 7 run scores 0.
- Second point: `map` prints no partition line when a finding is an error, such as a privacy hit in a row or an id-unique error. In such a repository the check can never pass.
- Evidence: plan:175-183, plan:190-194; hooks/core/facts.ts:31, 58-63, 68-71 (`open: rs.length` includes duty rows); hooks/core/index.ts:11-14; cli.ts:135.
- Smallest fix:
  - Expect open down by N−1 and the playbook's open count up by 1 when the duty row was added, and say so in audit.md.
  - Add a fixture case with no duty row, and score it.
  - Say that a `map` that exits 1 before applying means "apply nothing, list the cases".

**2. Tasks 2 and 3: the audit's hunk reads cannot be built from owed's output, and its Node lines collide with the deny rule (Blocker; B3 residual)**
- Problem 1: audit.md reads `git show <sha> -- <allowed paths>`, but owed's listing has no per-commit list of allowed paths. A commit that names a row by ID comes with its sha and subject only. To get the paths, the agent must run `git show --name-only`, `--stat` or the whole commit. `--stat` and the whole commit are forbidden, and all three name or show denied files.
- Problem 2: audit.md names `node <home>/cli.ts owed` (the evidence step and the gone-row check) and `node cli.ts map`. Task 2 says that when anything was excluded, no context names the Node owed. The only built way to drop such lines, `withoutNode`, removes every line holding `cli.ts`, and with them the after-apply check, which is the only guard on these writes.
- Problem 3: the install sentence for audit (context[1]) is not given.
- Evidence: plan:132-141, 163-165, 181-183, 187-189; hooks/core/survey.ts:218; hooks/register.tsx:201-207.
- Smallest fix:
  - owed lists, per commit in the range, its changed paths that passed the Read rules (marked where unsafe), with the excluded count.
  - audit.md builds `git show <sha> -- :(literal)<path>...` from that list only.
  - On the slash route audit.md uses the listing it was handed, and never runs the Node owed over the range when the listing excluded paths.
  - Exempt the two records-only commands (`map --settings`, and `owed --base main --head <audit branch>`) by name.
  - Give audit's install sentence verbatim.

## Majors

**3. Task 3, `/housekeeping audit`: the slash route's range code is unspecified (Major)**
- The hook must compute "the range" before it hands over owed's listing, but no file or function is named for that code.
- Also not given: how "through <sha>" is parsed out of Details; what happens with two matching duty rows, a sha not on main, settings never committed, or a shallow clone; and the git commands to use.
- FORMAT.md is not in Task 3's files, yet ", through <sha>" is a new Details convention (FORMAT.md:23 knows only the date).
- Evidence: plan:27, 151-152, 160-162, 187.
- Fix: put an `auditStart()` in hooks/core/history.ts with:
  - the regex;
  - `git log --diff-filter=A -1 --format=%H -- :(literal).housekeeping.json`;
  - `merge-base --is-ancestor`;
  - `rev-list --first-parent --max-count=50`;
  - the fallback to the 50-commit cap;
  - tests.
  Add FORMAT.md to Task 3.

**4. Task 2 against Task 3: owed reads subjects only, while the audit ranks and judges by commit bodies (Major)**
- owed's log is "sha and subject only", so a row named only in a body is never paired. A squash merge typically leaves IDs in the body. audit.md ranks by "then in the body" and accepts a closing word in the body. This weakens the 9-of-10 bar.
- Evidence: plan:122, 163-169.
- Fix: owed matches IDs and closing words over `%s` and `%b`, prints only sha and subject, and the fixture plants one body-only closing.

**5. Tasks 2 and 3: owed marks shell-unsafe paths, but audit.md never keeps them out of commands (Major; B3 residual, injection risk)**
- The survey's mark text says "name it only through /housekeeping survey", which means nothing for an audit. audit.md then puts paths into `git show <sha> -- <path>` and `git show <main>:<path>`.
- Evidence: plan:136-137, 163-169; hooks/core/survey.ts:48-51.
- Fix: owed's mark says the path must not go into a command; audit.md treats any pair involving a marked path as a judgement call; add a test.

**6. Tasks 1, 2 and 3: the time-out replies cannot know whether a path was denied (Major)**
- Task 1's names test puts owed into the `.catch` time-out mapping, which today names the Node command unconditionally. The audit's time-out reply is to omit the Node owed only "unless owed excluded a denied path". After a time-out, that check may not have finished. A slow run of per-path Read checks is exactly when time-outs happen.
- Evidence: plan:111-113, 141, 187-189; hooks/register.tsx:340-346.
- Fix: the hook keeps a flag that is set when a deny is seen and starts set until every check is done; the catch names the Node owed only when the flag is clear. Test both cases.

**7. Task 4, the catch-up: a resumed session is still offered while live (Major; B4 residual)**
- Sequence: session X ends, its record is marked ended, and the person runs `claude --resume X` themselves. X's own first prompt.context skips its record ("other than this session") and never clears it. Any new session Y then offers `claude --resume X` while X is live, which puts two processes on one transcript.
- The owner's reason for the catch-up (sessions that end abruptly, DESIGN.md:716) also now gets no offer, and the plan does not record that.
- Evidence: plan:225-232; d.ts:12111-12124, 12612-12619.
- Fix: at a session's first prompt.context, delete its own record; record the abrupt-end gap in call 4 and in DESIGN 3.10; add a test.

**8. Task 4, the catch-up: false offers, and no lifetime for the marks (Major)**
- A record written at one turn end is never removed when a later turn files. Work, then `/loose-ends`, then exit is the normal path, and it still ends in an offer.
- The in-memory marks are not reset at session.end. Today that hook clears only `sent` and `forks`, so after `/clear` the new conversation inherits them.
- The record holds "counts and shas only", so the 14-day prune has no time to read.
- Evidence: plan:219-227, 232, 237-243; hooks/register.tsx:371.
- Fix:
  - At each main-loop turn end, write the record when work follows the last filing, and delete it otherwise.
  - session.end clears the marks.
  - The record gets `at`.
  - Tests: work then filing gives no offer; a `/clear` gives no inherited marks.

**9. Task 1, keep text with both procedures sent: contradicts the pin and call 12 (Major; B1 residual)**
- "Both ... byte for byte" cannot be both today's text and call 15's prefixed form.
- The plan does not say whether keep() quotes every install sentence or only the last. The pin at tests/plugin.test.ts:750-756 asserts only the last is quoted (`not.toContain(where)`). Quoting both would put plan's "run its Node command" beside the denied survey's "do not run its survey".
- This pin is not listed as changed on purpose, so stop rule 4 makes the builder stop.
- Evidence: plan:37, 40, 80-86; hooks/register.tsx:305-315.
- Fix: keep quoting only the last-sent install sentence; give the exact both-sent paragraph; list plugin.test.ts:750-758 as changed on purpose.

**10. Task 1, the command-names test cannot pass as written (Major)**
- Not every command is in all five places:
  - `init`, `plan` and `map new` are not in cli.ts's list, and audit will never be ("a Node form of the audit" is Not built);
  - `init` is not in the time-out mapping;
  - "map new" is not in the description.
- `OPTIONS` is not exported, and the kit loads code files only.
- Evidence: plan:111-113, 277; hooks/register.tsx:246, 324, 344; cli.ts:16-19; tests/plugin.test.ts:61.
- Fix: per command, name the places it must appear: cli.ts and the time-out mapping only for map, check, survey and owed. Export the list, or make it a Node spec.

**11. Task 4, the nudge's HEAD "under the repository's key" can wipe the Route Map link (Major)**
- `repo:<key>` holds `{url, sha}`. map overwrites it whole and `map new` deletes it.
- A nudge written there, without preserving the link or racing another session, loses the link, and the next publish makes a new page.
- Evidence: plan:222-224; hooks/register.tsx:271-274, 296.
- Fix: store the nudge under its own key, `nudge:<repo key>`.

**12. Task 3: no test pins audit.md's safety rules (Major; missing test for a risky item)**
- Not pinned anywhere: the dirty-tree rule, the restricted-writer rule, the earlier-branch stop, the worktree outside the checkout, never pushing, and the settings copy kept outside the repository.
- audit.md does not say where the settings copy goes, so an agent could write it into the person's checkout.
- Evidence: plan:154-186, 195-196, 288.
- Fix: a Node spec asserting audit.md holds each rule verbatim, including "the settings copy and the scratch file live outside the repository" (as prompts/plan.md:28 says).

**13. Completion criteria: the reference repository's check may be impossible to run (Major)**
- HK-079 records that sessions here could not read the reference repository, and the criterion has no fallback.
- Evidence: plan:289-290; BACKLOG.md:52.
- Fix: "if the reference cannot be read, mark it not run, with the reason, in the task's result".

**14. Task 5, HK-004 is moved to Done without its live check (Major)**
- HK-004 asks for a live test that the short view survives a compaction and is read again. research/live-checks.md does not list it.
- Evidence: BACKLOG.md:14; plan:263-269.
- Fix: add that check to live-checks.md.

## The earlier report's Blockers
- **B1:** partly answered. Markers are gone, the sentences are in code, audit's sentence is verbatim, the install sentence is a field, and the prefix rule is set. The both-sent case is left open (Major 9).
- **B2:** the mechanism is answered (`map --settings` partition lines plus owed for gone rows), but as written it fails on every first audit (Blocker 1).
- **B3:** partly answered. The slash owed obeys the Read rules, hunks are restricted, the skeptic's inputs are limited, and README and FORMAT caveat the Node owed. The rest is Blocker 2 and Majors 5 and 6.
- **B4:** largely answered: per-session keys, `ended` set at session.end, the resume id, the folder named, same repository only, `isInteractive` kept, `$.ui.log`. The resumed-session path remains (Major 7).
- **B5:** answered: one criterion per DESIGN 7 bar, a fixture with decoys, and the owner's sitting. Its audit bar is blocked by Blocker 1 and weakened by Major 4.
- **B6:** answered. The gate runs the name and word searches and the author and committer check before every push, and the rule for pushing before review is cited (root CLAUDE.md:12 confirms it).

Not checked: whether b14fdcf is on main (no git was run), and the manifest's userConfig schema keys (not in d.ts; `claude plugin validate` in the gate would catch them). research/raw was not read.

Blockers left: 2

## Lens: design

Review of <repo>/housekeeping/plans/2026-11-13-phase-3.md (draft 2), REVIEW mode, design lens. I read the persona, the target, the draft 1 review, register.tsx, adapter.ts, cli.ts, core/index.ts, facts.ts, history.ts, brief.ts, templates.ts, settings.ts, prompts/plan.md, tests/plugin.test.ts and tests/init.test.ts, DESIGN.md, FORMAT.md, BACKLOG.md, README.md, plugin.json and the engine types. I did not open research/raw.

## Status of draft 1's Blockers
- **B1 (keep-text markers):** Answered. The markers are gone, the keep text is a table in code, the audit sentence is given word for word, the install sentence is stored as a field, and there are pins plus a hash spec. One gap is left, the case where both survey and plan were sent (Major 1).
- **B2 (after-apply check):** The method is answered: `map --settings <copy>` partition lines, plus owed for gone rows. But the expected numbers are wrong whenever the audit adds its duty row (Blocker 1).
- **B3 (denied files through the audit and the Node owed):** Partly answered. The parts that stop the audit from leaking are missing or contradict each other (Blocker 2).
- **B4 (catch-up offering a live session):** Answered: a key per session, `ended` set from `e.resume.id`, only this repository's records, the root named, pruning with `$.store.keys()`, `isInteractive` kept in memory, and the offer goes out by `$.ui.log`. Some gaps remain (Majors 2 and 3).
- **B5 (completion criteria):** Answered. Two gaps remain (Majors 8 and 9).
- **B6 (pushes before the searches):** Answered. The gate now runs the name and word searches and the author check, and the push rule is cited.

## Blockers

### Blocker 1. Task 3, "The check after applying" (plan:181-183), with "Applying" (plan:175-179)
- **Problem:** The check expects closed up by N and open down by N. "Any other result: delete the branch."
  - The partition counts duty rows as open rows. When there is no duty row, the audit adds one on the branch, so open goes down by N−1 and the total goes up by 1. The check then fails.
  - That is every first audit. init writes no duty row (call 10), and existing repositories have none.
  - It is also the acceptance run, unless the fixture plants a duty row (plan:190-194 says nothing about one). So the only guard on writes made without approval deletes every first audit's branch, and the DESIGN 7 bar scores 0 of 10.
- **Evidence:** hooks/core/facts.ts:59 (`open: rs.length`), 68-71 (`all: p.done.length + rows.length`, with duties in `rows`); hooks/core/index.ts:11-14; hooks/core/templates.ts:27-34 (no duty row).
- **Fix:** In audit.md, state the expected numbers: closed +N, open −N, total unchanged. When the duty row was added: open −N+1 and total +1. Or add the duty row in a final commit after the check. Build the fixture both with and without a duty row.

### Blocker 2. Task 2, "What it lists" and "Read rules" (plan:132-141); Task 3, evidence, check and time-out reply (plan:163-165, 181-183, 187-189); tests (plan:145, 195-196)
- **Problem:** Draft 2 still cannot carry out B3's fix as written:
  - **(a) No allowed-path list.** owed lists paths only for trigger hits. For commits that name an ID it gives only the sha and subject. So `git show <sha> -- <allowed paths>` has no list of allowed paths for most pairs, and the agent will fall back on `git show <sha>`, `--name-only` or `--stat`, which name or show denied files.
  - **(b) The Node owed rule contradicts itself.** audit.md must name `node cli.ts owed` (Completion, plan:288). Its own after-apply gone check also needs it, because the agent cannot run `/housekeeping owed`. But plan:140-141 says that when anything was excluded, no context names the Node owed. There is no withoutNode-style rule for audit.md, so a builder cannot meet both.
  - **(c) The marked-path rule was dropped.** B3's fix also said audit.md puts no marked path into a command; that half is gone. owed marks paths that a shell can read as commands, but nothing stops audit.md from putting one into `git show`.
  - **(d) Tests and the time-out case.** Only owed's reply is tested with a denied path; the audit's context and its time-out reply are not. The `.catch` handler receives only `next.error`, so "unless owed excluded a denied path" cannot be known when the hook fails before its Read checks finish.
- **Evidence:** DESIGN.md:369-371, 375-377, 513-520; hooks/register.tsx:199-207, 340-347; hooks/adapter.ts:147-148.
- **Fix:**
  - owed's listing gives each listed commit's allowed paths, marked as the survey marks them, plus a count of excluded paths.
  - audit.md says: in Claude Code, use the listing handed with this procedure. Run `node cli.ts owed` only for the after-apply check, whose range holds only the audit's own commits on the records. withoutNode strips the evidence-step line when anything was excluded.
  - A pair with a marked path becomes a judgement call and never goes into a command.
  - The time-out reply names the Node owed only when every Read check finished with nothing denied.
  - Kit tests: a denied path's name and lines are absent from the audit's context and from its time-out reply.

## Majors

### Major 1. Task 1, keep text (plan:80-86), against call 12 (plan:37) and call 15 (plan:40)
- **Problem:** The plan contradicts itself for survey and plan sent together:
  - Call 15 prefixes each procedure's sentence and stores each install sentence, while the "both" test is to stay byte for byte.
  - Today's output quotes only the last install sentence, and a pin asserts that the earlier one is absent.
  - If both are quoted, an earlier plan sentence ("run its Node command as node .../cli.ts (survey takes ...)") survives in the summary beside a later denied-survey sentence. The agent could then run the Node survey, which reads denied files.
- **Evidence:** hooks/register.tsx:205-206, 305-311, 338; tests/plugin.test.ts:750-758 (756: `not.toContain(where)`).
- **Fix:** Survey and plan together keep today's bytes: one install sentence, the last one sent. The prefixes apply only when audit is among the procedures sent. Whenever a denied-form sentence was sent, quote only that one.

### Major 2. Call 5 (plan:30) against Task 4, the shell hook and turn end (plan:211-226) and its tests (plan:237-243)
- **Problem:**
  - Call 5 says a commit arms the catch-up and a commit touching the records counts as filing. Task 4's shell hook does neither, and no test covers it.
  - A record written at one turn end is never removed after a later filing (a `/loose-ends` run that edits the records). session.end then marks it ended, and the next session offers a resume for a session that filed everything.
  - "Older than 14 days" needs a time in the record, but the record holds only counts and shas.
  - The in-memory marks are not reset at a `/clear`, which starts a new session id.
- **Fix:**
  - The shell hook marks work on `gitOperation.commit`. It marks filing when `git diff-tree --no-commit-id --name-only -r <sha>` names a records file.
  - At each main-loop turn end with reason `answer`, write the record if work follows the last filing, else delete it.
  - Add a written-at time to the record, and reset the marks at session.end.
  - Add tests for each.

### Major 3. Calls 4 and 5 (plan:29-30); Task 4, session end and the offer (plan:227-232)
- **Problem:**
  - Only sessions whose `session.end` ran get an offer, so a crash or a killed process gets none.
  - That is the case the owner chose the catch-up for: the "Why" of the 2026-11-03 row is that "the catch-up at the next start covers sessions that end abruptly", and "Nudges only" was rejected because "a session that ends abruptly loses items".
  - The change is not among the calls, nor in the DESIGN 10 or 3.10 edits.
- **Evidence:** DESIGN.md:716; engine types 12099-12124.
- **Fix:** Add it to call 4 and to the DESIGN 3.10 and section 10 edits in Task 5. Optionally file a row for abrupt ends.

### Major 4. Task 2, the range (plan:122), against Task 3, evidence and clear-cut (plan:163-169)
- **Problem:**
  - owed reads the log "sha and subject only", so a commit that names an ID only in its body (common after a squash merge) is never paired.
  - Yet the audit ranks pairs "then in the body", and clear-cut allows "subject or body".
  - DESIGN 3.9 says to find the commits that name an ID.
- **Evidence:** DESIGN.md:429, 437.
- **Fix:** Read `%H%x09%s%x00%b`, match IDs in the subject and the body, and print only the sha and subject.

### Major 5. Task 3, "Applying" (plan:173-180) and the check (plan:183)
- **Problem:**
  - The folder for `git worktree add` is not given.
  - No step removes the worktree. `git branch -D` refuses a branch that is checked out in a worktree, so "delete the branch" fails and a failed branch stays.
  - A kept worktree also stops the owner from checking the branch out in their own checkout.
- **Fix:** Name the folder (the scratch or temp folder) and remove the worktree before any branch delete and at the end. Keep the settings copy outside the repository, as prompts/plan.md:28 does.

### Major 6. Call 2 (plan:27); Task 3, range and Last done (plan:160-162, 175-177)
- **Problem:**
  - The range is capped at the last 50 first-parent commits, yet Last done then moves to main's tip.
  - So older commits past the cut are never audited. This happens on the first audit of any repository with more than 50 first-parent commits since the settings commit.
  - The 25-pair carry-over does not cover this cut.
- **Fix:** Take the oldest 50 commits after the start, and set Last done "through" the last commit read, so successive runs walk forward. Or keep the sha whenever the range was cut, as for the pair cap.

### Major 7. Task 1, "The command names" (plan:111-113)
- **Problem:**
  - The test requires every command to appear in the time-out mapping and in cli.ts's list.
  - cli.ts has only map, check, brief and survey. The mapping has no init.
  - audit has no Node form ("Not built", plan:276-278), and DESIGN 3.4 lists no Node init or plan.
  - The test cannot pass without adding commands that stop rule 6 forbids.
- **Evidence:** cli.ts:16-19; hooks/register.tsx:246, 324, 344.
- **Fix:** Scope the test to the usage line, the description and the hint for every command, and the mapping and cli.ts for commands that have a Node form (map, check, brief, survey, owed).

### Major 8. Completion criteria (plan:289-290), against call 13 (plan:38)
- **Problem:** The controller is to run `check` on the reference repository at b14fdcf and at the tip. Call 13 and HK-079 record that sessions here could not read the reference repository, and the plan gives no fallback.
- **Evidence:** BACKLOG.md:52.
- **Fix:** If the reference repository cannot be read, record the check as not run with the reason, and add it to the owner's sitting in research/live-checks.md.

### Major 9. Task 5, live checks and BACKLOG (plan:263-269)
- **Problem:** HK-004 moves to Done, but its own live test is not in research/live-checks.md: the short view survives a compaction and is read again after it. Only "keeps the unfiled items" is listed.
- **Evidence:** BACKLOG.md:14.
- **Fix:** Add "after an automatic compaction, the housekeeping block is in the context" to live-checks.md.

### Major 10. Task 4, compaction (plan:210), against Task 4's Files (plan:200) and Task 5 (plan:255-258)
- **Problem:** "DESIGN 3.8 and 3.10 change in the same commit", but DESIGN.md is not among Task 4's files, and Task 5 edits 3.8 and 3.10. A builder would stop under stop rule 4.
- **Fix:** Add DESIGN.md to Task 4's files for the 3.8 compaction sentence, or drop "in the same commit".

Not checked: I ran no git, so I could not confirm b14fdcf or whether Phase 2 is merged. The manifest schema for the `userConfig` field is not in the engine types, so `claude plugin validate` is the only check on it. The engine facts I relied on all match the types: the tool.call budget stops while `next` and `$` calls run, the `.catch` replay calls the tool only once, and `ui.log`, `prompt.suggest`, `turn.complete`, `session.end` and `resume.id` behave as the plan says.

Blockers left: 2

## Lens: codebase

REVIEW of draft 2 of the Phase 3 plan. Lens: codebase. I read the plan, the draft 1 review, the persona file, register.tsx, adapter.ts, cli.ts, the files under core/ (index, history, brief, templates, settings, parse, facts, findings, types), both prompts, plugin.test.ts, init.test.ts, DESIGN.md, FORMAT.md, BACKLOG.md, README.md, plugin.json, marketplace.json and the engine types.

Path shorthand: everything is under <repo>/housekeeping/ unless given in full.
- "plan" means plans/2026-11-13-phase-3.md.
- "d.ts" means <the engine types, scratch copy>.

## Blockers

**X1. Task 3, the check after applying (Blocker).**
- **Problem:** The first audit of any repository always deletes its own branch. With no duty row, the audit adds one, "the one row it may open" (plan:177). That adds 1 to the open count and 1 to all rows. The check, though, requires "closed up by N, open down by N", and "Any other result: delete the branch" (plan:181-183). The acceptance fixture (plan:190-194) names no duty row, so the scored run would also find 0 of 10.
- **Evidence:** core/index.ts:11-13 (the partition line); core/facts.ts:66-71 (all = Done + rows; open = rows).
- **Fix:** State the arithmetic: closed +N; open −N, or −N+1 when the duty row was added; all rows unchanged, or +1. Or take the "before" line after the duty-row commit.

**X2. Task 2 read rules and Task 3 hand-over and time-out (Blocker; the rest of draft 1's B3).**
- **Problem (a):** The rule "When anything was excluded, no reply or context names the Node owed" (plan:140-141) contradicts the audit's own procedure. prompts/audit.md has to name `node cli.ts owed` and `map`, since it must be followable without Claude Code (plan:288). It is handed whole as the context (plan:187), and the audit's install sentence is not given. The only stripping helper is withoutNode, which drops every line holding "cli.ts" (core/survey.ts:218). That would also drop the after-apply check (plan:181-183), the only guard on writes made without approval. Kept, the evidence step lets the agent run the Node owed over the range. The Node owed reads denied paths, and the agent would then run `git show` on them.
- **Problem (b):** The time-out replies cannot know whether anything was excluded.
  - The `/housekeeping owed` time-out mapping (plan:111-113) names the Node owed with no exclusion condition at all.
  - The audit's reply names it "unless owed excluded a denied path" (plan:188-189). But the `.catch` handler (register.tsx:340-347) runs after a time-out, typically during the per-path Read checks, which are the slow part (DESIGN.md:731: 17-45 s on 3,000 files).
- **Problem (c):** No test covers the audit's context, or either time-out reply, with a denied path (plan:195-196).
- **Fix:**
  - audit.md's evidence step says: "in Claude Code use the listing handed with this procedure; never run owed over the range in this session".
  - Its after-apply owed stays (main..audit branch reads only the records).
  - The audit's install sentence names no Node command when anything was excluded.
  - Both time-out replies name the Node owed only when the hook recorded, in memory, that the Read checks finished with nothing excluded. Otherwise they say to run the slash command again.
  - Add a kit test with a planted denied path covering the audit's context and both replies.

**X3. Task 4, the catch-up offer (Blocker; the rest of draft 1's B4).**
- **Problem:** A resumed session's own record stays "ended", so a third session offers `claude --resume <id>` for a session that is running. That is two processes on one transcript, the harm B4 named.
  - The offer skips "this session" but never clears its record (plan:228-232).
  - Only a later turn-end write replaces the record. A resumed session that only files (the /loose-ends the offer asks for) never writes it.
  - The plan's own live check assumes the ids are equal (plan:265).
- **Evidence:** d.ts:12116-12123 and d.ts:12612-12619 (`resume.id` is the ending session's own id).
- **Fix:** At a session id's first prompt.context, delete `catchup:<key>:<this id>`. Test that a resumed session's record is not offered to another session.

## Majors

**Y1. Calls 12 and 15, Task 1 keep text (Major).**
- **Problem:** The plan contradicts itself. Survey and plan "map to today's keep sentences, byte for byte" (plan:80-81, call 12 at plan:37), yet "with more than one sent, each sentence is prefixed" (plan:84, call 15).
  - Today's output with both sent quotes only the last install sentence, unprefixed.
  - That output is pinned at tests/plugin.test.ts:750-756, including `not.toContain(where)`, which per-procedure install sentences would break. The keep text is built at register.tsx:305-315.
  - The plan neither gives the new bytes nor lists that test as changed on purpose, so the builder must stop (plan:49).
- **Fix:** Give the survey-plus-plan output verbatim and name plugin.test.ts:750-756's new expectation. Or apply the prefixes only when audit is among those sent.

**Y2. Task 1, the records card (Major).**
- **Problem:** The card line "Read single rows by ID with Grep; never read a whole file." (plan:97) sits in every conversation's context. It clashes with:
  - keep()'s "re-read the … procedure whole" (register.tsx:310-311);
  - prompts/survey.md:30 and :38 ("read it whole", "read the guide files … whole");
  - the Edit and Write tools, which need a Read of the file first (DESIGN.md:723). Grep is not a Read, so filing by /loose-ends, a DESIGN 7 bar, is steered toward a refused Edit.
- **Fix:** "Never read either records file whole: find rows with Grep, then Read only those lines (offset and limit) before an Edit."

**Y3. Task 1, the command-names test (Major).**
- **Problem:** The test cannot pass as written.
  - cli.ts's list (cli.ts:16-19) has no `init`, `plan`, `map new` or `audit`, and "a Node form of the audit" is not built (plan:277).
  - The time-out mapping sends `init` to a placeholder and `plan` to `survey` (register.tsx:344).
  - The kit cannot import cli.ts, which pulls in node: modules.
  - cli.ts is also missing from Task 1's Files list, although `node cli.ts brief` must print the card (plan:101). It is missing from Task 3's list too.
- **Fix:**
  - A kit test checks the slash commands in the usage line, the description and the argument hint.
  - A Node spec checks USAGE for map, check, brief, survey, plus owed in Task 2.
  - The time-out reply is tested per command against its stated Node form.
  - Add cli.ts to Task 1's Files.

**Y4. Task 3, the range on the slash route (Major).**
- **Problem:** The hook must compute the start, both to hand over owed's listing and to fill `--base <sha>` (plan:187-189). Draft 2 writes the rules only as procedure prose (plan:160-162), with no code file and no test.
  - brief.ts's LAST_DONE pattern reads no sha (core/brief.ts:26).
  - Call 2 makes 50 commits a cap, not a fallback, so there is no start when neither a duty row nor a committed settings file exists: settings held uncommitted (HK-056, BACKLOG.md:29), or a shallow clone.
- **Fix:**
  - Write a pure range function in hooks/core/owed.ts, falling back to the last 50 first-parent commits.
  - Test five cases: a valid duty row sha, a sha not on main, no row but a settings commit, neither, and more than 50 commits.

**Y5. Task 3, the evidence (Major; address risk).**
- **Problem:** owed reads "sha and subject only" (plan:122). Yet pairs rank IDs found "in the body", and a closing word in the "subject or body" counts as clear-cut (plan:164-168), so owed never sees half of what the audit needs. The agent then reads bodies and runs `git show <sha> -- <paths>`. That command's default header prints the author's name and address, and the message brings its Co-authored-by lines. Addresses therefore reach the agent and, through it, the skeptic.
- **Evidence:** DESIGN.md:265 ("never shows commit authors").
- **Fix:**
  - owed matches IDs and closing words in bodies with the trailers dropped, and prints only the sha, the subject and the matched word.
  - audit.md uses `git show --format= --end-of-options <sha> -- <paths>`.
  - Test that no author or trailer reaches owed's output.

**Y6. Task 3, marked paths in commands (Major; part of draft 1's B3 fix that was dropped).**
- **Problem:** owed marks paths that a shell can read as commands (plan:136-137). But audit.md puts owed's paths into `git show <sha> -- <paths>` and `git show <main>:<path>` (plan:164-168), with no rule for a marked path.
- **Evidence:** prompts/survey.md:36 ("put it in no command line"); DESIGN.md:369-371.
- **Fix:** A pair whose path is marked becomes a judgement call and goes into no command.

**Y7. Call 5 against Task 4's arming of the catch-up (Major).**
- **Problems:**
  - (a) A commit counts as work (plan:30), but the shell hook marks nothing (plan:211-218).
  - (b) A filing made after the record was written never clears it, so a fully filed session is still offered.
  - (c) The record is written only at turn ends whose reason is `answer` (plan:221-226). Work done in a last turn that was interrupted or ended in an error is lost, and those abrupt ends are the reason the owner chose the catch-up (DESIGN.md:716).
  - (d) The record holds "counts and shas only", with no time, so the 14-day prune (plan:232) cannot run.
  - None of these has a test (plan:240-242).
- **Fix:**
  - The shell hook marks work on any commit, and filing on a commit that touches the records.
  - At every main-loop turn end, write the record when work follows filing, and delete it otherwise.
  - Add a time field to the record.
  - Note in DESIGN 3.10 that a killed session gets no offer.
  - Add one test for each.

**Y8. Kit fakes (Major; test infrastructure).**
- **Problem:** The fakes list (plan:70-72) lacks:
  - `session.id`, `store.keys`, `prompt.suggest`, `ui.log` and NotebookEdit;
  - the git calls the turn end makes (log -1 on the records, `rev-list --count <sha>..HEAD`, the uncommitted-edits check);
  - owed's merge-base and diff calls.

  The kit's bottom hook throws on any event no test fakes (d.ts:17661-17662), and unknown git calls exit 1 (tests/plugin.test.ts:116). Every automatic part fails open inside a try, so negative tests such as "never offered", "no line in a subagent" and "not with uncommitted edits" pass whether the code works or not.
- **Fix:** Add these fakes. Make each negative test first show the positive case in the same world.

**Y9. Completion, the reference-repository check (Major).**
- **Problem:** The controller must run check on the reference repository before Task 1 and after Task 5 (plan:289-290). But HK-079 (BACKLOG.md:52) and call 13 (plan:38) say no session here has been able to read it, and no fallback is named.
- **Fix:** If the repository cannot be read, mark the check not run, give the reason, and file a row beside HK-079.

**Y10. Completion, DESIGN 7's "Without Claude Code" bar (Major).**
- **Problem:** The bar "survey runs from its prompt.md and the Node command" (DESIGN.md:667) is replaced by a word test on audit.md (plan:288). No call records the change, although the plan says "One per DESIGN 7 bar".
- **Fix:** Either add the bar as written (a fresh subagent follows prompts/survey.md with `node cli.ts survey` on a fixture), or record the substitution as a call.

**Y11. Task 3, the dirty-tree rule (Major).**
- **Problem:** `git status --porcelain` lists untracked files, so the audit applies nothing in most checkouts. Yet its branch is made in a separate worktree and never touches the checkout (plan:157-158, 173-174). The fixture's clean clone hides this from the acceptance run.
- **Fix:** Check only the two records files: `git status --porcelain -- <backlog> <playbook>`.

**Y12. DESIGN 3.10, the suggestion after a compaction (Major).**
- **Problem:** DESIGN 3.10 suggests /loose-ends at the end of the turn after a compaction (DESIGN.md:472-474). Draft 2 suggests it only after three or more commits (plan:222-224). The drop is not recorded in the calls, in "Not built", or in Task 5's list of DESIGN edits (plan:255-258).
- **Fix:** Record the drop as a call, with HK-084 as the reason, and edit 3.10. Or suggest it once at the first main-loop turn end after a compaction of the main conversation.

## Draft 1's Blockers: does draft 2 answer them?

- **B1 (keep-text markers): answered.** The keep text is in code by procedure; audit's sentence is given verbatim; owed has none; the install sentence is a field; there are five pins and a hash spec. The case with both survey and plan sent is still open (Y1).
- **B2 (the after-apply check): answered in mechanism.** It uses map with a settings copy and owed from main to the audit branch. The arithmetic fails whenever the audit adds its duty row (X1).
- **B3 (denied files reaching the agent): partly answered.**
  - Done: owed's slash route uses readTracked's allow rule, with an ask counted as denied and `:(exclude)` pathspecs; `git show` runs only on allowed paths, never `--stat`; the skeptic gets limited inputs; README and FORMAT say the Node owed ignores the rules; paths are marked; owed's reply has a test.
  - Missing: the audit's context and both time-out replies (X2), marked paths in commands (Y6), and a test of the audit's context.
- **B4 (offering to resume a live session): partly answered.**
  - Done: one key per session; `ended` and the resume id set at session end; offers limited to this repository; the folder named; pruning through `$.store.keys()`; `isInteractive` kept; the offer written to the transcript; the id equality in the live checks.
  - Missing: a resumed session's own record (X3), and the note on abrupt ends (Y7).
- **B5 (completion criteria): mostly answered.**
  - Done: the decoy fixture with a scored run, owed's bar deferred and recorded, the integration bars at the sitting, named tests, no "reason" escape, done only after the sitting, and the type-check row.
  - Missing: the survey "without Claude Code" bar (Y10), and no named test refreshes the status line after a rebuild.
- **B6 (pushes before the searches): answered.** Every gate runs the name searches and the author and committer check before each push, and the plan cites the root CLAUDE.md rule for pushing before review.

The engine types back the plan's other engine claims: `prompt.suggest`, the main loop's `turn.complete`, `e.resume.id`, `ui.log` to debug, `store.keys`, `register(on, options)`, `gitOperation` and `backgroundTaskId` on Bash and PowerShell, a plugin's own `tool.call` opening no dialog, and `.catch` replaying safely.

Not checked: I ran no git, tests or tsc, and did not read research/raw. Whether git diff accepts `--end-of-options`, and whether `claude --resume` keeps the session id, are unverified.

Blockers left: 3

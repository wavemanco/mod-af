# Phase 3 of housekeeping: concepts brief

## The concept in short

Phase 3 adds five things to the housekeeping plugin (the plugin keeps a repository's pending work in a backlog and a playbook):

1. **`/housekeeping audit`.** A prompt-driven procedure. It finds rows that commits closed, opened or moved while nobody updated the records. Each proposed change goes to an independent skeptic. Clear-cut cases are applied on a branch, each with the commit that proves it. Judgement calls are listed for the owner.
2. **`/housekeeping owed [base]`.** From the merge base to the branch, it lists the rows whose Trigger fired, the rows the branch's commits name, and the checklist lines that name those rows.
3. **The automatic parts:**
   - before a compaction, unfiled items are kept word for word;
   - after a commit to the records, the page is rebuilt and published per the cadence, with a nudge to `/loose-ends`;
   - at session start, duties due and a stale-map check;
   - at session end, one quick write, then an offer at the next start to file what that session left.
4. **Integration notes** for loose-ends, route and decide, with no edits to them.
5. **The README and the marketplace entry.**

Constraints:
- The two files are the only source of truth.
- No agent may start a live session.
- Every procedure also ships as a prompt any agent can follow (DESIGN 3.11).

## Lenses

All seven lenses returned: design, codebase, zoomout, comprehension, readiness, structural, inventive. None is marked not run. Every lens only read files; none ran code or git. The line numbers below are the lenses' own, taken from the tree as it was on 2026-11-12. I read and ran nothing.

## Consensus

1. **`keep()` and the `sent` record are written for plan only (7 of 7).**
   - register.tsx:338 records any command reply that carries string context, and takes `context[1]` as "the install sentence".
   - `keep()` (register.tsx:305-315) puts plan's rule, "nothing is written before" approval, into every summary.
   - Audit applies clear-cut cases without asking (DESIGN 3.9; section 10 item 9). So after a compaction the summary would tell the audit's agent to write nothing, and could quote owed's data as the install line.
   - Fix:
     - give each procedure its own keep text;
     - record only the procedures in an explicit list, by name rather than by position;
     - keep survey's and plan's text byte for byte, so HK-080 still tests what the fix round shipped.

2. **The context block the integration depends on is not built (7 of 7).**
   - DESIGN 3.10 (lines 461-464) says the context names the two files, the row format, the paths and where decisions live, and Phase 0 passed with such a block (phase-0-mechanics.md §1).
   - The block that shipped is `brief()` alone (register.tsx:378-383; brief.ts:55-82).
   - `settings.decisions` is parsed (settings.ts:22) and then read nowhere.
   - Fix: a "records card":
     - built from the settings alone, with no history walk;
     - outside the short view's 8,000-character cap;
     - served even while the view says "being built";
     - also printed by `cli.ts brief`;
     - sent only where `.housekeeping.json` exists.

3. **owed has two definitions (7 of 7).**
   - HK-003 (BACKLOG.md:13) says "standing duties and dated checks that are due". DESIGN 3.9 (434-438) says the list from the merge base.
   - "Dated checks" exist nowhere. DESIGN 3.1 (line 143) makes duties' Last done the only date the plugin reads, and §4 bans dates in triggers.
   - Duties due are already in the short view (brief.ts:76-78).
   - All lenses: owed is 3.9's list. It is deterministic for (base, head), exits 0, and HK-003 is reworded.

4. **The after-commit rebuild keys on the wrong event (7 of 7).**
   - The page reads local main (DESIGN 3.4 line 241; adapter.ts:24-25), so a records commit on a branch rebuilds a page identical to the last one.
   - Main moves in ways that never report kind `committed`:
     - a merge is `branch.action: "merged"`, with no sha;
     - a fast-forward or a pull carries no commit at all;
     - `diff-tree` on a merge commit lists no files.
     - Phase 0 saw only `committed` (phase-0-mechanics.md §5; claude-code-tools/index.d.ts:4621-4639).
   - Fix:
     - compare main's sha with the cachedView stamp (register.tsx:93-98);
     - when it has moved, run `git diff --quiet <old> <new> -- :(literal)<backlog> :(literal)<playbook>`;
     - rebuild through cachedView without waiting;
     - the session-start check catches moves made outside Claude Code.

5. **Duties due go stale (7 of 7).**
   - The view's stamp has no day in it (register.tsx:81, the HK-035 shortcut).
   - Fix:
     - store the duties with the view;
     - work out the "Duties due" line when the view is served, the way `withBranch` adds the branch line (brief.ts:47-53);
     - export `dutyDue` (it is at brief.ts:29, not at line 15 as HK-003 says);
     - treat a stored view with no duties field as a miss, rebuilt once.

6. **A forked skeptic is not independent (7 of 7).**
   - A fork inherits the proposer's conversation (register.tsx:349-359).
   - The skeptic is a fresh, non-fork subagent. It gets only the row, the claim, the proving sha and the diff hunk.
   - Outside Claude Code, use a fresh chat, or list the case as a judgement call. Only claims the skeptic agrees with are applied.

7. **"Since the last audit" has nowhere to live (7 of 7).** A marker in `$.store` would be a second source of truth (DESIGN §9, 2026-11-03), and neither the Node route nor another person could see it. Where it should go is disputed (Contradiction 1).

8. **The catch-up as specified does not work (7 of 7).**
   - A session's transcript runs past `$.fs`'s 4 MiB limit and the Read tool's 256 KB (plugin-mechanics.md; DESIGN §9).
   - loose-ends scans "THIS conversation" only (loose-ends/hooks/register.ts:9).
   - session.end is fragile:
     - its 1.5 s budget is shared, and Phase 0 saw another plugin's session-end hook cancelled (phase-0-mechanics.md §4);
     - an abrupt end may never run it;
     - `/clear` raises session.end but no session.start follows (index.d.ts:4487).
   - Parallel worktree sessions overwrite a single slot.
   - The "filing" prompt that DESIGN 3.11 names has no body.

9. **"The short view again after compaction" is already built (6 of 7).** prompt.context fires again after a compaction (register.tsx:378-383; plugin-mechanics.md). It needs a test only; adding a second injection would double the view.

10. **The new compaction instruction changes pinned behaviour (6 of 7).**
    - DESIGN 3.8 (413-415) and tests/plugin.test.ts:959-977 pin that a compaction with no procedure sent "goes on as it came". Change both on purpose.
    - Gate the instruction on `.housekeeping.json`.
    - Name both file paths, so "unfiled" means not yet written into them in this conversation.
    - Fail open (HK-090).

11. **Never wait for the history walk in tool.call (6 of 7).**
    - The walk takes 37-75 s at 300 commits (phase-2-fixes-check-minors.md:82; HK-078).
    - Attach a short delta to the commit's result instead of the full 8,000-character view.
    - Deliver anything slow later. The same mechanism cures HK-069 (a first prompt stuck on "being built").

12. **owed reads the branch's records and needs no walk (7 of 7).**
    - `readInput` pins main and always walks the history (adapter.ts:24-25, 48-58).
    - owed parses the records at HEAD and at the base with `git show`, and marks the rows the branch already handled as settled.
    - `cli.ts:30` rejects positional words, so the Node form is `owed --base <ref>`.
    - Put `--end-of-options` before the base (history.ts:4-10).
    - Stop on `isStdoutTruncated` (adapter.ts:26).
    - Handle no local main (HK-064) and shallow clones (`SHALLOW`).
    - Find IDs with `idsIn` (parse.ts:12).
    - Mask the output (HK-060).

13. **"A code name on a changed line" needs a written rule (6 of 7).**
    - FORMAT.md:49 says backticks mean nothing in cells.
    - Proposed rule: a backticked span or a path-like token in a Trigger, matched as a whole word on `-U0` added and removed lines, outside the two records and the settings file.
    - DESIGN 7 measures owed against the reference repository's script, which no session here could read (HK-079).

14. **The audit can reuse what exists (6 of 7):**
    - `idsIn` over commit messages;
    - `historyFrom`'s `gone` list (history.ts:62-74): rows that vanished with no Done entry, computed today and shown nowhere;
    - the `checklist-closed` warning (findings.ts:78);
    - `facts.doors` (facts.ts:34);
    - the stale where-we-are warning (findings.ts:89-92);
    - owed's matcher.

15. **The cadence is not built, and `userConfig` is global (6 of 7).**
    - plugin.json has no `userConfig`, and `userConfig` holds one value per plugin (plugin-mechanics.md:76). DESIGN 3.3 wants a cadence per repository.
    - Publish only:
      - at the main loop's `turn.complete` (`agentId` undefined, reason `answer`);
      - to a link already stored;
      - in an interactive session, with the Artifact tool allowed;
      - when the page's hash changed;
      - after re-checking the stamp (HK-074).
    - Move the publish block (register.tsx:263-300) into one function that `map` and turn.complete share.

16. **Nudges go to the person, not the agent (5 of 7).** Use `$.prompt.suggest` at turn.complete (it fails mid-turn; plugin-mechanics.md:32). The agent cannot run a slash command (HK-065).

17. **The siblings' gaps (6 of 7):**
    - decide writes a record and never touches a row (decide/hooks/register.ts:37), so DESIGN 7's "/decide updates the row" has no mechanism.
    - loose-ends files "someday" items for review "per release". A Trigger written "Every release..." becomes a standing duty (brief.ts:5) and drops out of Land now and the critical path.
    - init writes no Not doing section, no `notDoing` key and no `decisions` key (templates.ts:7-48).

18. **Stale research on hooking the siblings' commands (7 of 7).**
    - existing-plugins.md:28-35 says housekeeping cannot add to their commands. phase-0-mechanics.md:33-37 found it can, and runs outermost, on one build (2.1.317).
    - DESIGN 3.10 lines 442-443 and 466-468 are out of date.

19. **README line 5 ("no commits") and HK-077 (5 of 7).** The audit commits on its own. HK-077's trigger (BACKLOG.md:50) fires when HK-004's plan is written; a hook built from it would block the audit's writes.

20. **Live checks (7 of 7).** These need a live session:
    - automatic compaction (never triggered, even in Phase 0; phase-0-mechanics.md:59);
    - DESIGN 7's `/loose-ends`, `/route` and `/decide` bars;
    - the publish at turn end;
    - a merge into main being seen;
    - the catch-up offer.

    They go into one owner sitting, folded into HK-080.

21. **Plumbing and release (7 of 7).**
    - Add audit and owed to register.tsx:246 (the usage line), :324 (the description and argument hint) and :344 (the time-out mapping), and to cli.ts:16-19.
    - README:7-15 is out of date.
    - plugin.json is at 0.2.0; bump it.
    - The marketplace entry already exists and lists only map, check, init and the short view, so item 5 is an edit.
    - HK-053 and HK-065's marketplace minor belong to item 5.

## Contradictions between lenses, and how each could be resolved

1. **Where the audit's starting point lives.**
   - The options:
     - a playbook duty row "Every N weeks: /housekeeping audit", with "Last done: YYYY-MM-DD, through <sha>" (design, zoomout, comprehension, readiness, inventive);
     - a commit trailer `Housekeeping-Audit: <from>..<to>` (codebase);
     - no marker at all, using the row-driven loop for closings and "commits since the last records commit" for the rest (structural).
   - Against the trailer: a squash merge drops it (design), and an audit that applies nothing writes no commit (structural).
   - Resolution: the duty row. It is visible in the files, `lastDones`/`dutyDue` make it come due for free, and every audit's branch updates it.
   - With no such row, use structural's row-driven loop over main's messages for closings, and start the rest at the commit that added `.housekeeping.json` (readiness) or at the last 50 first-parent commits (design).

2. **What the audit covers.**
   - "Closed, opened, moved" (HK-002), with "opened" read from diffs or commit wording (design, comprehension, inventive), against closings and ticks only (zoomout, which calls "opened" loose-ends' job).
   - Structural: define "moved" or drop it.
   - Resolution:
     - apply closings and checklist ticks only;
     - list "opened" as judgement calls, never applied, drawn from explicit deferral words in commit messages and never from code TODOs;
     - define "moved" as `historyFrom`'s `gone` entries.

3. **Whether audit gets a Node command.**
   - Structural ships `cli.ts audit`, a listing that extends DESIGN 3.4 to match 3.11. Readiness, design and zoomout want no new command name (stop rule 6).
   - Resolution: `cli.ts owed --base <ref> --head <ref>`. An option, not a command, gives audit its computed half. prompts/audit.md calls it over `<Last done sha>..<main>`.

4. **How much the compaction keeps.**
   - A cap of about 40 lines ending "and N more: run /loose-ends" (design), against no cap with a fixed heading the hook counts (inventive), against one line per item with only the owner's decisions verbatim (comprehension).
   - Separately, an instruction sent whatever procedure was or was not sent (zoomout), against gated on `.housekeeping.json` (readiness, comprehension, structural, codebase).
   - Resolution:
     - gate on the settings file;
     - inside it, send the instruction whether or not a procedure was sent (that is zoomout's point, and it survives HK-084's reused precompute);
     - one fixed heading, one line per item, verbatim for the owner's decisions;
     - a cap with an explicit count. The rest stays in the old transcript, which a resume reaches.
   - The cap changes DESIGN 3.10's "every ... word for word", so it is the owner's (Q6).

5. **The channel to the siblings.**
   - Outermost command.run notes on `/loose-ends`, `/route` and `/decide` (design, comprehension; inventive for `/route` only; readiness as a second channel), against the card alone with no command hooks (structural; zoomout "until a live check shows the context falls short").
   - Resolution: the card alone in Phase 3. It carries the lines the notes would have carried:
     - DROP goes to the not-doing table;
     - no "Every" unless the work recurs;
     - a decision updates its row;
     - read single rows by ID with Grep, never a whole file.

     That last line answers design's `/route` cost.
   - File a row whose trigger is the owner's sitting showing the card falls short.

6. **The catch-up mechanism.**
   - Offer "`claude --resume <id>`, then /loose-ends" using `SessionEndInput.resume` (codebase, zoomout, structural, inventive), against a `prompts/file.md` that reads the transcript in parts, user and assistant text only (design, readiness), against an outer hook adding "also scan <path>" (comprehension).
   - The owner chose transcript reading (DESIGN §9, 2026-11-03).
   - Resolution: resume first; it reads nothing and the unchanged loose-ends does the filing. The transcript read stays as the fallback, for example the desktop app, which has no `--resume` flag (zoomout). This needs the owner's word (Q4).

7. **When the catch-up record is written.**
   - session.end (DESIGN; design, with no `$.process` call) against turn.complete or when a commit is seen (codebase, comprehension, inventive, structural).
   - Resolution: write at turn.complete, only when the record changes. session.end at most sets "ended".

8. **What arms the catch-up.**
   - Options:
     - turns since the last filing (design, via `$.session.turns()`);
     - commits since the last filing (zoomout, structural);
     - a turn with an Edit, a Write or a commit (comprehension);
     - a threshold, or a compaction that kept unfiled items (inventive).
   - Resolution: arm it on a turn with work after the last filing, or on a compaction whose heading had lines. A session of questions alone never brings the offer. The definition of filing all agree on: an Edit or Write on either file, a commit touching them, or a `/loose-ends` run.

9. **How the nudge counts commits.** An in-memory counter (zoomout) against `git rev-list --count <last records commit>..HEAD` (readiness, comprehension). Resolution: git. It survives sessions and keeps no state. Use a fixed N of 3, with no nudge while either file has uncommitted edits.

10. **Which shell results the after-commit check runs on.**
    - Only results with `gitOperation` (design, readiness, codebase), against every shell result so a pull is caught (inventive), against `gitOperation` or a command containing `git` (structural).
    - Resolution: structural's middle option; the session-start check catches the rest.

11. **What is delivered after a commit.**
    - A delta of at most 400 characters (design, comprehension), against the full view re-attached whenever the stamp changes, through one reconciler (inventive, about 2,000 tokens each time).
    - Resolution: the delta on each records-changing move of main. The full view only replaces a "being built" placeholder, once (codebase 21, structural B7).

12. **What tells the plugin a compaction happened.** session.compact (most lenses) against the second prompt.context of a conversation, not counting one after `/clear` (readiness). Resolution: readiness's sign arms the `/loose-ends` suggestion, because a reused precompute may never pass back through session.compact (HK-084).

13. **Duties in owed.**
    - A trailing line that never sets the exit code (design, codebase, zoomout, structural), against none at all (comprehension).
    - Resolution: the Node output stays a pure function of (base, head). The slash reply adds one pointer line to the short view's Duties due (inventive).

14. **The skeptic's batch size.** One per proposal (implied by DESIGN 3.9), one per batch of about 10 (design), or one for all (zoomout). Resolution: one fresh subagent per batch of about 10.

15. **How the audit commits.** One commit per status change, so a wrong one is one `git revert` (readiness), against one audit commit (implied elsewhere). Resolution: one commit per change, plus the duty row's Last done update.

16. **Where the cadence lives.** A global `userConfig` picker (design, zoomout, comprehension, readiness, structural), against a store entry beside the link under `repo:<key>` (one of codebase's options). Resolution: `userConfig`. A per-repository override needs a new argument (stop rule 6), so it is filed as a row.

17. **How much the history walk gets fixed now.** Design: build the brief from main's head files and keep the walk for the page, plus an incremental history cache. Others keep cachedView with `wait=false`. Resolution: Phase 3 keeps cachedView and never waits on it. The cache stays with HK-078.

## Risks, ranked by harm

1. **The tool.call hook can run the person's shell command twice** (readiness, unique).
   - Copying `.catch(($, e, next) => next(e))` (the shape at register.tsx:359) onto a Bash/PowerShell tool.call hook means a throw after `await next(e)` calls `next(e)` again.
   - That runs `git commit` (or any command) a second time.
   - Required: try/catch inside the hook, return the original result, never call next twice. Return at once when there is no `gitOperation`.

2. **The audit applies a wrong status change to the single source of truth.**
   - Passing the test "names the ID and is on main" does not mean the work is done: reverts, "prep for X", partial work, passing mentions (design 11; DESIGN §7, "no applied change wrong").
   - Repository rules broken: in test repository B only the coordinating agent writes the backlog, and test repository A requires an adversarial pass on every correction (test-repositories.md:22, 40).
   - A checkout with uncommitted changes carries them onto the audit branch (comprehension 9).
   - Mitigations:
     - clear-cut means a closing word plus the change still present at main's tip plus the skeptic's agreement;
     - branch from main in a clean tree;
     - one commit per change;
     - where repository rules restrict writes, everything becomes a judgement call;
     - after applying, run `check` and expect closed +N, open -N and no new `gone` (structural E2);
     - write Done rows in the shape of the file's existing Done rows.

3. **Read deny rules bypassed** (comprehension, unique).
   - owed's and audit's diffs would hand a denied file's changed lines to the agent. The survey honours deny rules and treats "ask" as refused in a subfolder session (DESIGN §9, 2026-11-04 and 2026-11-12; adapter.ts:147).
   - Mitigations:
     - put each changed path to `$.tool.check` and exclude denied ones with `:(exclude)`;
     - count them in the reply;
     - audit.md forbids `git show` on them.
   - The other privacy risk: new text surfaces unmasked (HK-070 found the status line unmasked).

4. **The audit silently follows the plan's rules after a compaction** (Consensus 1). It is wrong behaviour that nothing shows as failing.

5. **Duplicate IDs collide across worktrees** (design, readiness, structural).
   - `id-unique` is check's hard error, and an error means no page and no short view on main (index.ts:50).
   - More filing from parallel sessions makes it likelier (templates.ts:44 takes the next `B-\d+`).
   - Mitigations: the card gives the next free ID per pattern; owed reports IDs the branch adds that main already holds.

6. **Unasked publish dialogs.**
   - Phase 2 setups never chose a cadence, so an upgrade would start opening dialogs at turn ends, mid-subagent or before the first prompt (readiness 17; comprehension 21).
   - Mitigations: publish only to a stored link, only interactive, only at the main loop's turn.complete; write the marketplace entry last.

7. **Integration bars fail silently** because the card does not exist (Consensus 2), and the hook order could break unseen under `--plugin-dir` or the siblings' local rework (existing-plugins.md:123-131).

8. **The map goes stale on merges** (Consensus 4).

9. **Token and process costs:**
   - the audit with no pre-filter, rows × commits (design 2);
   - the catch-up's transcript read (design 1);
   - full history walks multiplied, with quadratic lifetime cost (design 3);
   - the full view on every commit, about 30k tokens over 15 commits (design 4);
   - a git spawn on every shell call in every repository under a user-scope install (design 7).

10. **The store breaks on upgrade or rollback** (readiness 6). 0.2.0 reads `brief:{order,views}` and `repo:{url,sha}`. A reshaped key, or a stamp with no format version, serves old views or breaks a rollback.

11. **Silent automatic failures** (codebase 3). Every hook swallows its errors (register.tsx:327, 359, 367, 381), and Phase 3 adds five more silent paths, so a live check cannot tell "worked" from "skipped".

12. **Duties due stale for days** (Consensus 5).

13. **The summary crowded by kept items** (Consensus 10; Contradiction 4).

14. **Completion bars that cannot be measured:**
    - owed against the unread reference script (HK-079);
    - an audit fixture without decoys, which a plain ID grep passes 10 of 10 (design 11, comprehension 6, inventive 5);
    - live-only bars, so only the owner can declare Phase 3 done.

15. **Docs drift.** The command list lives in seven places (structural F1), and the README is organised by phase (structural F2).

## The simplest design that still meets the concept

In build order. This is mostly zoomout's sequence, with the other lenses' consensus fixes added.

**(a) Fix what is built first**
- **Per-procedure keep text.**
  - Each prompt file carries its own keep sentence between markers (structural B1), and `keep()` quotes it:
    - plan: approval, after the numbered steps;
    - survey: writes nothing;
    - audit: only skeptic-agreed clear-cut cases, on a branch, each with its proving commit;
    - owed: nothing to keep.
  - Record only the listed procedures, by name.
  - Survey and plan text unchanged; pin it with a kit test.
- **Split prompt hand-over from the survey's work.** `procedure()` always runs the per-file permission check and, for plan, the walk (register.tsx:188-224; 17-45 s on 3,000 files), inside command.run's 10 s. A shared `handPrompt(name, context)` runs that inventory for survey and plan only (structural B2).
- **The records card.**
  - One core function, settings only: paths, the commit test, columns, ID patterns with the next free ID, the not-doing heading or "none set", the decisions folder or "none set".
  - Fixed lines: "a trigger is a step, never a date, never 'Every' unless it recurs"; "a decision updates its row"; "read rows by ID, never a whole file"; "run /housekeeping check after filing".
  - Served as a second prompt.context block and by `cli.ts brief`.
- **Duties at serve time.** Export `dutyDue` and store the duties with the view.
- **A view-format constant in the stamp** (register.tsx:98), so an upgrade or a rollback rebuilds once. The store only grows; new fields are optional and read tolerantly, as `viewsOf` does.
- **A no-history read path.** `build()` already accepts `snapshots: []` (structural B3). The core exports argv builders, and adapter.ts and cli.ts only run them, so owed does not add a third copy of the git reading (adapter.ts:18-70, cli.ts:79-127).

**(b) owed**
- A pure core function of (rows at base and HEAD, `diff --name-only`, `-U0` lines outside the records and settings, `log %B base..HEAD`).
- It lists rows with evidence ("trigger word X matched path Y", "named by abc1234"), grouped by action (comprehension 13), with rows the branch already settled listed apart.
- It also reports IDs colliding with main.
- Before diffing, put each changed path to `$.tool.check`.
- `--base`, with an optional `--head`; exit 0; stop on a truncated stream; on main, say "give a base, e.g. HEAD~5".
- FORMAT.md defines the code-name rule.

**(c) audit, as prompts/audit.md only**
- **Tier 0** costs no tokens: checklist lines ready to tick, `facts.doors`, `gone` rows.
- **Tier 1** is `owed --base <Last done sha> --head <main>` plus `idsIn` over main's messages, strongest evidence first, at most about 25 pairs per run, with the rest counted.
- **The model tier** reads only those diffs, in --stat and named-path hunks.
- **The skeptic** is a fresh non-fork subagent per batch of about 10; where there is none, every case is a judgement call.
- **Applying:** on a branch from main, in a clean tree, one commit per change, then `check` run against the branch. The audit also updates the duty row's Last done.
- **Judgement calls:** each gets a dated "Audit YYYY-MM-DD: ..." line and a "Default until decided:" line, so the next audit skips it (comprehension 8).
- **"Opened"** is listed only, never applied.

**(d) The automatic parts**
- **Compaction:** the gated paragraph with one fixed heading. Build each instruction separately, so a throw in the settings read cannot lose both (codebase 22).
- **tool.call:**
  - only on `gitOperation` or a command containing `git`;
  - try/catch inside, and next is called once;
  - compare main's sha, then `git diff --quiet` on the records;
  - start the rebuild without waiting, and write the page from the same walk, since `fresh()` throws away the HTML that `build()` makes (codebase 8; index.ts:33);
  - attach the delta to main-loop results only.
- **turn.complete (main loop, reason `answer`):**
  - publish per the cadence and the guards in Consensus 15;
  - `$.prompt.suggest('/loose-ends')` when the git count is 3 or more, or after a compaction that kept items;
  - write the catch-up record when it changed: ids, counts and shas only, in a bounded list keyed by session.
- **The first prompt.context of a new conversation** (also after `/clear`) offers "`claude --resume <id>`, then /loose-ends" once per ended session. It skips a resume of the same id, and runs and CI sessions that were not interactive.
- **Session start:** the stale-map line compares the stored link's sha with main on the records only (`git diff --quiet <sha> <main> -- <records>`, so unrelated commits do not read as stale), plus the duties at serve time. No dialog, and nothing that holds up the first prompt.

**(e) One debug line per automatic firing.** `$.ui.log(text, {to:'debug'})` with the hook, the outcome and its reason, the 7-character sha, the counts and the ms; masked, with no row text and no paths. Not `$.telemetry` (codebase 3).

**(f) Docs and release**
- README by command, plus a section on what runs on its own (when it fires, what it costs, how to turn it off), and line 5 corrected for audit.
- The command list kept in one core table, which feeds register.tsx:246, 324, 344 and cli.ts:16-19.
- DESIGN fixes: 3.8, 3.10's stale lines, the "keeps" wording changed to "is asked to keep" (structural A4), and existing-plugins.md:34 marked superseded.
- HK-003 reworded. The plan also notes that HK-077's trigger fired.
- plugin.json bumped. Never change `version: 1` in settings (settings.ts:20), GUIDE_LINE (register.tsx:149), or the "How this file is kept" heading (templates.ts:41).
- The marketplace description edited last, after the owner's sitting.
- **Live checks:** one script, folded into HK-080. For each check: a scratch repository made with /housekeeping init, the exact keystrokes, and the one observation that means pass.

**Not built in Phase 3:**
- filing after every commit (the owner's choice);
- command hooks on the siblings;
- the HK-077 hook;
- `cli.ts audit`;
- the incremental history cache;
- `$.model.fork`;
- a per-repository cadence.

## Open questions for the owner, each with a recommendation

The owner asked for no stop-and-ask in this run. So each question has a default to build. Where a default crosses a recorded decision or stop rules 3, 6 or 8, it is recorded under DESIGN §10, "Calls Claude made, for the owner to check" (zoomout 19). The safety stops (rules 1, 7, 9 and 10) still hold.

1. **What owed is.** Recommend DESIGN 3.9's list alone: drop "dated checks" and reword HK-003. Why: dated checks do not exist in the format, and duties depend on the clock, so CI's output for one commit would change by the day.
2. **The audit's starting point.** Recommend a playbook duty row "Every 2 weeks: /housekeeping audit", with "Last done: date, through <sha>". Why: it lives in the files, comes due through the existing duty code, and survives squash merges.
3. **The audit's scope.** Recommend applying closings and ticks, listing "opened" only, and defining "moved" as `gone`. Why: DESIGN 7's bar measures closings, and "no applied change is wrong" holds only for evidence that can be checked.
4. **The catch-up mechanism** (this changes the 2026-11-03 decision). Recommend the resume offer first, with transcript reading as the fallback. Why: no reads past the size limits, no new procedure, and the unchanged loose-ends does the filing.
5. **What arms the catch-up** (this changes "any turn after the last filing"). Recommend a turn with work after the last filing, or a compaction that kept items. Why: "any turn" is true in nearly every session, and the owner rejects ceremony (questions-the-map-answers.md).
6. **The compaction cap.** Recommend a fixed heading, one line per item, verbatim for decisions, a cap of 40 with "and N more: run /loose-ends". Why: it keeps the task state in the summary and loses no signal.
7. **The cadence.** Recommend one `userConfig` picker (after the records reach main, the default; off), with a per-repository override filed as a row. Why: `userConfig` is per plugin, and per-repository needs a new argument.
8. **A switch for all automatic parts in userConfig.** Recommend yes, folded into the same picker's "off". Why: a person can roll back without uninstalling (readiness 19).
9. **The siblings' channel.** Recommend the card only, with a row triggered by the sitting. Why: the hook order rests on one undocumented build, and the siblings are being reworked.
10. **init writes `## Not doing`, `notDoing` and `decisions`.** Recommend yes for new repositories; for existing ones, a check recommendation, not an error. Why: DROP items and decide's records otherwise have no home (templates.ts:7-48).
11. **The audit where a repository restricts who writes the records.** Recommend that every case becomes a judgement call. Why: test repositories A and B have such rules.
12. **Sequencing against HK-080.** Recommend pinning today's survey and plan keep text verbatim in a kit test, adding the compaction change as a paragraph only, and holding one combined sitting. Why: HK-080 then still tests what the fix round shipped, and a failure can be traced to one change or the other.
13. **owed's code-name rule.** Recommend writing it in FORMAT.md now, and using the reference script's output as a fixture once HK-079's trigger fires. Why: the plugin's own rule must not depend on a script nobody here can read.
14. **HK-077.** Recommend not building it in Phase 3; the plan says its trigger fired, and any later hook is scoped to plan sessions. Why: as written, it would block the audit's branch.
15. **Debug lines.** Recommend yes, on by default to the debug log only. Why: the debug lines are what make each live check readable.

## What each lens alone raised

- **design:**
  - token budgets for the audit (tiers, about 25 pairs per run, the skeptic per batch of 10);
  - the short view needs history for one warning only, where-we-are staleness (findings.ts:86-92), so it could be built from main's head files;
  - an incremental history cache, and one walk per repository at a time, latest wins;
  - `/route` reading two whole files, about 150k tokens against the reference backlog's 615 KB;
  - no catch-up record for `-p` ends or resumes (index.d.ts:4579-4589);
  - a squash merge drops a trailer;
  - `$.model.fork` as an option the design never considers;
  - a kit test pinning the siblings' command names and reply shape.
- **codebase:**
  - `$.ui.log` debug lines instead of `$.telemetry`;
  - the compaction hook checks its own result through `next(e)`'s messages and re-appends a missing install or approval sentence;
  - `fresh()` throws away the HTML that `build()` makes, so one walk can write the page;
  - `logArgs`' `--first-parent` and two-file filter hide side-branch commits that name IDs (history.ts:12-13);
  - pin the real prompts' sentences in tests, not stand-ins (HK-067; plugin.test.ts:63);
  - the time-out reply must say audit has no Node form.
- **zoomout:**
  - the explicit smallest build order (a) to (f);
  - recording each autonomous default in DESIGN §10 to square the stop rules with the owner's ask;
  - the "at session start" cadence becomes a stale-map line;
  - the instruction sent whatever procedure was sent survives HK-084's reused precompute.
- **comprehension:**
  - the deny-rule bypass through diffs;
  - judgement calls come back at every audit, so a dated line and a default go in the row;
  - owed's output grouped by action, and it prints HEAD's check errors, removing the settings-copy step (README:44, plan.md);
  - a README section on what runs on its own and how to stop it;
  - one-line glosses for the commands;
  - the live-check list with keystrokes and the observation that means pass (this answers the owner's "how do I do these?");
  - the filing prompt pastes loose-ends/prompt.md rather than keeping a third copy;
  - the offer warns that a permission prompt will ask to read a file in the home folder.
- **readiness:**
  - calling next twice re-runs shell commands;
  - the store only grows, with a format constant, and rollback to 0.2.0 keeps working;
  - settings `version` stays 1, GUIDE_LINE and the "How this file is kept" heading never change;
  - the marketplace entry is written last;
  - one commit per audit change;
  - test repository B needs a new clone (phase-2-results.md:26);
  - the second prompt.context as the sign of a compaction;
  - the first audit starts at the commit that added `.housekeeping.json`.
- **structural:**
  - `procedure()` ties handing over a prompt to the survey inventory and the walk within 10 s;
  - `readInput` ties the current-state read to the walk, so owed could stop on a blob it does not need in a blobless clone;
  - the command list lives in seven places;
  - the README is organised by phase;
  - "is asked to keep", not "keeps";
  - the stale-map check compares the records, not main's head;
  - keep sentences sit between markers in the prompt files;
  - store entries never hold item text;
  - Done rows are written in the file's own shape, with the check expectations after applying.
- **inventive:**
  - the compaction as the detector of unfiled work: the hook counts the lines under its heading in the returned summary;
  - a single delivery reconciler for the view;
  - `git diff -G'<alternation>'` keeps the output small (with Windows' roughly 32K command-line limit);
  - a four-bin pre-pass for the audit;
  - the lane stops stored with the view and appended to `/route`, so route's critical path cannot disagree with the map's ("is it 60 or is it 43?");
  - dead triggers reported when a watched name leaves the code (`git grep`; comprehension also).

I checked none of the lenses' line numbers, git behaviour (`diff-tree` on merges, `-G` on Windows) or engine signatures myself. Readiness's next-twice risk and the gitOperation kinds are type and code readings by the lenses, not runs; a plugin test should confirm both before the design relies on them.

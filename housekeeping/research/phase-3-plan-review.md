# Review: housekeeping/plans/2026-11-13-phase-3.md

**Verdict: not ready.** After removing duplicates there are 6 Blockers, 29 Majors and 14 Nits. In the evidence, `plan:` means a line of the plan, `d.ts` means the scratch `claude-code.d.ts`, and `brief` means the Phase 3 concepts brief.

## Reviewer status

| Lens | Status | Verdict as reported | Counts as reported |
|---|---|---|---|
| design | Completed | Not ready | 3 Blockers, 19 Majors, 12 Nits |
| codebase | Completed | Not ready | 3 Blockers, 16 Majors, 12 Nits |
| readiness | Completed | Not ready | 2 Blockers, 14 Majors, 12 Nits |
| comprehension | Completed | No verdict line; 3 findings graded Blocker | 3 Blockers, 16 Majors, 10 Nits |
| structural | Completed | Not ready | 2 Blockers, 21 Majors, 12 Nits |
| zoomout | Completed | Not ready | 3 Blockers, 18 Majors, 14 Nits |
| inventive | Completed | Its persona grades only Major and Nit; 3 Majors marked Blocker-grade | 22 Majors, 8 Nits |

Every reviewer returned. When lenses graded the same finding differently, a harm path kept the higher grade, and the split is noted on the finding.

---

## Blockers

### B1. The keep-text markers cannot meet the byte-for-byte stop rule
- **Lenses:** all seven (design B2, codebase B1, readiness M1, comprehension 1, structural B1, zoomout B3, inventive A7 and A8). Five graded it Blocker; readiness graded it Major and inventive Blocker-grade.
- **Section:** Task 1, "Per-procedure keep text" (plan:50-52), against the stop rule (plan:34) and call 12 (plan:25).
- **Problem:**
  - The `<!-- keep -->` markers would change prompts/survey.md and prompts/plan.md. Both files are sent to the agent whole as context[0], so the markers would reach the agent too.
  - Today's keep text is in neither file. keep() builds it in code ("...Nothing else is approval, and nothing is written before it."). plan.md:23 has a different, longer sentence, and survey.md:42 has older wording. Wrapping text that exists cannot reproduce today's keep text.
  - Copying the approval rule into survey.md would settle HK-082, which is the owner's call.
  - The kit cannot read the real prompts, so a keep read from markers is only ever pinned against stand-ins. keep() would also read files inside the compaction hook, where a failed read fails open.
  - The install sentence is still taken by position (`context[1]`). Quoting every procedure's sentence breaks the pin that only the last install sentence is quoted.
  - When plan and audit are both sent, one summary carries plan's "nothing is written before it" and audit's "apply clear-cut cases", with neither scoped to its procedure.
  - The recorded list is not given (survey, plan, audit; owed?), and audit's own keep sentence has no content.
- **Evidence:** register.tsx:197, 207, 305-315, 338; prompts/plan.md:23; survey.md:42; BACKLOG.md:55; tests/plugin.test.ts:61-63, 713, 723, 731-760 (750-756, 753); node-tests/cli.spec.ts:327.
- **Fix:**
  - Put no markers in survey.md or plan.md. Keep the keep sentences in code, in a table by procedure name (hooks/core/commands.ts).
  - Survey and plan map to today's keep() output byte for byte.
  - Audit gets its own sentence, given verbatim in the plan: only skeptic-agreed clear-cut cases, on its branch, and the branch's commits are checked before anything is re-applied after a compaction. Owed gets none.
  - The recorded list is survey, plan and audit. When more than one was sent, prefix each sentence with "In the <name> procedure:".
  - Record the install sentence as its own field, not by position.
  - Pin with kit tests: survey alone, plan alone, both, survey with a denied file, and plan with audit. Add a Node spec (a hash) showing the prompt files are unchanged.

### B2. The audit's after-apply check cannot be carried out
- **Lenses:** design B3, codebase B2, readiness B2, comprehension 2, structural B2, inventive B2 (Blocker-grade).
- **Section:** Task 3, applying (plan:95-97): "then `check` with closed up and open down by the same count and no new gone rows".
- **Problem:** This is the only guard on writes made without approval, and it can neither pass nor fail truthfully:
  - check reads local main, not the audit branch, so it compares main with main;
  - check prints findings only, never counts (the counts are map's partition line);
  - gone rows are computed but shown only on the HTML page.
- **Evidence:** README.md:29, 44; adapter.ts:24-25; cli.ts:82, 129-133, 138; DESIGN.md:241, 653-654; register.tsx:249; index.ts:11-14; history.ts:62-74; findings.ts:72-99; template.ts:543; brief:122.
- **Fix:**
  - Before and after applying, run `node <home>/cli.ts map --settings <copy whose mainBranch is the audit branch> --out <scratch file>` (the pattern of prompts/plan.md:28) and compare the partition lines.
  - Take gone rows and counts from `owed --base main --head <audit branch>` (see M18). Expect closed up by N, open down by N, and gone unchanged.
  - State the expected numbers in audit.md.

### B3. Denied files reach the agent through the audit and the Node owed
- **Lenses:** all seven (design M4, codebase M2, readiness B1, comprehension 13, structural M8, zoomout B2, inventive B5). Readiness and zoomout graded it Blocker, the others Major. It is graded Blocker here because it breaks the owner's "Obey the deny rules".
- **Section:** Task 2 (plan:80); Task 3 (plan:90-94, 99-100); the command table (plan:64-65).
- **Problem:**
  - Only owed's slash route puts paths to the Read rules. The audit's model tier then reads diffs with the agent's own git (`git show <sha>`, `--stat`), and git ignores those rules.
  - `node cli.ts owed` reads every path, and audit.md or the time-out reply would name it inside a session. The survey's precedent (no Node command when a file is denied) and the brief's mitigation (audit.md forbids git show on denied paths) were both dropped.
  - How an "ask" answer counts is not stated. readTracked counts an ask with no rule outside the start folder as denied.
  - owed prints paths that the agent then puts into shell commands. The inventory marks unsafe paths; owed does not.
  - Nothing limits what the skeptic gets. The brief limits it to the row, the claim, the sha and the hunk.
- **Evidence:** DESIGN.md:369-371, 513-528, 731; register.tsx:194-207, 344; survey.ts:218; survey.md:34-35; adapter.ts:147-148; cli.ts:41-42; brief:77, 271-276.
- **Fix:**
  - owed's slash route reuses readTracked's allow rule.
  - audit.md reads hunks only as `git show <sha> -- <paths owed allowed>` (or with owed's `:(exclude)` pathspecs), never a whole commit and never `--stat`. The skeptic gets only those hunks.
  - When owed excluded anything, neither the context nor the time-out reply names the Node owed (reuse withoutNode).
  - owed marks unsafe paths as the inventory does, and audit.md puts no marked path into a command.
  - README and FORMAT say that `cli.ts owed` ignores the Read rules.
  - Kit test: plant a denied path and check that neither its name nor its lines appear in owed's reply or the audit's context.

### B4. The catch-up can offer to resume a session that is still running
- **Lenses:** all seven (design M13, codebase B3, readiness M7, comprehension 6, structural M1, zoomout M11, inventive A4). Codebase graded it Blocker; the others graded it a Major that can cause harm. Codebase and comprehension name it the biggest risk.
- **Section:** Task 4, the catch-up (plan:113-120); calls 4 and 5 (plan:17-18).
- **Problem:**
  - Nothing marks a session as ended. The record is written at turn.complete, and session.end is not in Task 4, although the brief put the mark there. A session still live in another terminal or worktree would be offered for `claude --resume`, which puts two processes on one transcript.
  - The record is "keyed by session" in a store that is one per user, so one repository's session is offered in another. One bounded list under one key also loses entries when two sessions write at once.
  - Transcripts sit under the session root, so a resume run from another folder may not find the session.
  - "Not for a resume of the same id" assumes that `$.session.id()` equals the id `claude --resume` takes. The types show the resume id only on `SessionEndInput.resume.id`.
  - `isInteractive` exists only on session.start, and /clear raises no session.start.
  - Taking "ended" from session.end loses abrupt ends, which were the owner's reason for having a catch-up.
- **Evidence:** d.ts:2950-2952, 3575-3578, 12102, 12106-12124, 12111-12113, 12612-12620, 12799-12802; plugin-mechanics.md:76; phase-0-mechanics.md:63-64; register.tsx:116-117; DESIGN.md:491, 716; brief:218.
- **Fix:**
  - Use one store key per session, `catchup:<repo key>:<session id>`, holding the session root and an `ended` flag.
  - session.end sets `ended` and stores `e.resume.id`, in one write within its 1.5 s bound.
  - Offer only ended records of this repository, and name the folder to run the resume in. Prune old keys with `$.store.keys()`.
  - Keep `isInteractive` in memory from session.start.
  - Record in DESIGN 3.10 that abrupt ends get no offer, and put the resume-id equality in the live checks.

### B5. The completion criteria leave out DESIGN 7's Phase 3 bars, so the audit has no acceptance test
- **Lenses:** all seven (design B1, codebase M16, readiness M12, comprehension 3, structural M17, zoomout M1, inventive B12). Design and comprehension graded it Blocker, the others Major.
- **Section:** Completion (plan:147-152); the gate (plan:40-42); plan:149.
- **Problem:**
  - These bars are missing:
    - audit finds at least 9 of 10 planted open-but-done rows and applies no wrong change;
    - owed matches the reference script plus the rows named by ID (blocked by HK-079);
    - plugin tests for the summarizer, commits on both shells, the stale-map check, duties due and the status line;
    - the /loose-ends, /route and /decide bars;
    - survey runs from its prompt.md without Claude Code;
    - validate and the type check are clean.
  - No task builds an audit fixture, and a fixture with no decoys is passed by a plain ID grep.
  - No agent may start a live session (plan:32), so nobody in the build can measure the audit, and the plan does not say which bars go to the owner's sitting.
  - "Or a reason in the task's result" (plan:149) lets any test be skipped.
- **Evidence:** DESIGN.md:652-669; brief:309-312; BACKLOG.md:52.
- **Fix:** One criterion per DESIGN 7 bar, each with its measure and who takes it:
  - an audit fixture of 10 planted done rows plus decoys (a revert, "prep for X", partial work, a passing mention, an ID found only on a side branch), run in a subagent or at the owner's sitting and listed in research/live-checks.md;
  - owed's reference bar deferred to HK-079, and the deferral recorded in DESIGN 10;
  - the integration bars at the owner's sitting;
  - the five test areas as named kit tests, with no "reason" escape;
  - the type check added to the gate.
  - Phase 3 counts as done only after the sitting.

### B6. Pushes can come before the name searches and the author and committer check
- **Lenses:** zoomout B1 (Blocker), structural M19 (Major).
- **Section:** Stop rules (plan:32); Completion (plan:151-152).
- **Problem:** "The controller pushes after the gate", and the gate is tests only. The name and word searches run only at completion, and no author or committer check is named. DESIGN requires those checks, and an adversarial check, before any push of code. A leak in pushed history can only be removed by rewriting it, which this repository has had to do twice.
- **Evidence:** DESIGN.md:571-574, 678-679, 729-730, 737.
- **Fix:** Every task's gate runs the name and word searches over the branch's files and commit messages, and the author and committer check (counted, never printed). The controller pushes only after those checks, the narrow check and the adversarial check. The plan names the rule that allows any push before review.

---

## Majors

### M1. The card's "next free ID" causes the collisions it is meant to prevent
- **Lenses:** all seven (design M2, codebase M6, readiness M2, comprehension 4, structural M3, zoomout M2, inventive A6).
- **Section:** Task 1, the records card (plan:55-57).
- **Problem:**
  - A pure function of the settings cannot give the next ID: that needs both files' rows and Done tables, and an arbitrary `ids` regex has no "next".
  - A prompt.context block does not change once sent. Every row filed in the conversation is offered the same ID, and parallel sessions all get the same number.
  - The resulting id-unique error stops the page and the short view on main.
- **Evidence:** d.ts:9140-9142; FORMAT.md:15, 53; settings.ts:49-53; types.ts:14; templates.ts:44; parse.ts:136; index.ts:50; brief:281-284.
- **Fix:** Drop the number. Add the fixed line "Before filing, read the highest ID of each pattern in both files, Done tables included, and take the next." owed catches collisions between branches (M13).

### M2. Two of the card's fixed lines are wrong, and one is missing
- **Lenses:** design M3 and N2, codebase M6 and N12, readiness M2, comprehension 4, zoomout N12, inventive.
- **Section:** Task 1, the records card (plan:57-60).
- **Problem:**
  - "Run /housekeeping check after filing" names a slash command the agent cannot run, and check reads main, so a row just filed is invisible to it.
  - The brief's DROP line ("DROP items go to the not-doing table") is missing.
  - Not given: the block name, its place beside the view, and whether it counts against the 8,000-character cap.
  - "Every" is written into the card instead of taken from the settings' prefix.
- **Evidence:** BACKLOG.md:38 (HK-065); README.md:29; adapter.ts:24-25; DESIGN.md:445-447; brief:202-206; d.ts:9083; FORMAT.md:23; node-tests/cli.spec.ts:213.
- **Fix:**
  - Replace the check line with "after committing, ask the person to run /housekeeping check once it reaches main" (or `node <home>/cli.ts check --settings <copy whose mainBranch is HEAD>`).
  - Add the DROP line, reading "none set" when there is no notDoing.
  - Name the block `housekeeping-records`, take the prefix from `duties.triggerPrefix`, and say how the card stands against the cap.

### M3. Calls 7 and 8: publishing defaults to off, and one switch controls both publishing and the nudges
- **Lenses:** all seven (design M11 and N1, codebase M1, readiness M10, comprehension 10, structural M2, zoomout M9, inventive A1).
- **Section:** calls 7 and 8 (plan:20-21); plan:7.
- **Problem:**
  - "Off" as the default reverses DESIGN 3.7 and DESIGN 10 item 7 (after each commit on main) and the brief's recommendation. Calls 4 and 5 mark their changes; this one is not marked, and plan:7 says each question was settled with its default. The session-start cadence is dropped without a word.
  - Because "off" also stops the nudges, the owner's 2026-11-03 choice ("combination of your recommended approach + users' nudges") ships switched off.
  - The plan does not say which parts "off" stops: the after-commit rebuild, the delta, the page write, the stale-map line, the catch-up offer, the debug lines.
  - The field has no name, type, options or default. userConfig arrives as `register(on, options)`, and register.tsx:317 takes no options. A change reloads the plugin, which wipes `sent` and `forks` in the middle of a conversation.
  - The rejection reason is wrong. DESIGN 3.3 keeps the cadence per person in `$.store` under `repo:<key>`, not in a settings key, and stop rule 6 allows new keys.
- **Evidence:** DESIGN.md:186-191, 322-325, 689-691, 716, 755-757; brief:400-401; d.ts:8196-8208, 10174-10184, 17676-17690; register.tsx:317, 321, 352.
- **Fix:**
  - Use two fields: `publish` ("after the records reach main" or "off", default off) and `nudges` ("on" or "off", default on). The other option is to default publishing to "after the records reach main".
  - Give the manifest JSON. Read the value from register's second argument, and test it with the kit's `options`.
  - Name every part each value stops.
  - Record the change to 3.7 and 10.7 with its reason, correct call 7's rejection reason, file the per-repository option as a store-entry row, and note the reload loss under HK-084.
  - Possible cut (design, readiness): if publishing stays off by default, move turn-end publishing to a row.

### M4. Turn-end publishing re-specifies map's publish step and rests on a premise the types contradict
- **Lenses:** readiness M9, zoomout M8; design N5, codebase N7, structural N4.
- **Section:** Task 4 (plan:113-114).
- **Problem:**
  - The types say a plugin's own `$.tool.call` opens no permission dialog. That contradicts the premise behind "only in an interactive session, at turn end", and undercuts README:5's "so your permissions apply".
  - The step leaves out what map's publish already does: the read first, forgetting a link that is gone, the store update, and the HK-074 stamp re-check. It also gives no turn reason.
  - Not defined: what "Artifact tool allowed" means (listed, or allowed by `$.tool.check`?), how "only when the page changed" is known (`repo:<key>` holds no hash), and what happens while a rebuild is still running.
- **Evidence:** d.ts:3210-3218; DESIGN.md:328-330; plugin-mechanics.md:66, 70; register.tsx:263-300, 269; phase-0-mechanics.md:46-50; brief:136; README.md:5.
- **Fix:**
  - Extract one publish() from command(), shared by map and the turn end.
  - Publish on the main loop only, with reason `answer`, after re-checking the stamp.
  - "Allowed" means `$.tool.check({tool:'Artifact'})` does not answer deny.
  - Store the page hash in `repo:<key>`. Publish only a finished build; one still running publishes at the next turn end.
  - Record the no-dialog fact (choosing the cadence is the consent), add it to the live checks, and drop "so your permissions apply" for writes the plugin makes.

### M5. The /loose-ends suggestion fires at every turn end
- **Lenses:** codebase M8, comprehension 8, zoomout M10, readiness M10, design N3, inventive.
- **Section:** Task 4 (plan:114-116).
- **Problem:**
  - No mechanism and no rate limit are given. Records commits are rare, so "three or more commits since the last records commit" holds on most branches, and the suggestion would come back at every turn end of every session. That is the ceremony the owner rejects.
  - "Last records commit" names no ref (HEAD or main).
  - The engine drops a suggestion while a turn runs or the input box holds text, and it competes with the engine's own suggestion.
- **Evidence:** d.ts:3170-3176, 4383-4393, 10075-10085; brief:398.
- **Fix:**
  - Call `$.prompt.suggest({ text: '/loose-ends' })`, not awaited, at the main loop's turn.complete with reason `answer`, at most once per new HEAD sha.
  - Count with `git rev-list --count <last commit touching the records on HEAD>..HEAD`, and store HEAD at the last nudge under the repository key.
  - Put "the suggestion shows at turn end" in the live checks.

### M6. Output meant for the person goes to the wrong channel, or to none
- **Lenses:** codebase M9, readiness M7 and M9, comprehension 6 and 8, structural M1, zoomout M12, inventive A5. Design N4, codebase N8, structural N3 and zoomout N9 raised the stale-map line.
- **Section:** Task 4 (plan:118-121).
- **Problem:**
  - The `claude --resume` offer goes into prompt.context, which is the model's context. The person sees it only if the agent passes it on, and the agent may run the command in Bash, starting a nested live session.
  - The plan does not say how a new conversation's first prompt.context is told apart from the re-read after a compaction.
  - The stale-map line has no named channel, and putting it in `$.ui.status` would overwrite the status line. Its cost is not stated.
- **Evidence:** d.ts:2455-2470, 4442-4453, 9093-9114; brief:138.
- **Fix:**
  - Send the offer and the stale-map line with `$.ui.log` to the transcript, which is not sent to the model, once per record. If the offer stays in the context, word it "tell the person; never run it yourself".
  - Treat as first the first prompt.context for a session id this process has not seen.
  - The stale-map line costs one `git diff --quiet` and is skipped when the stored sha is unknown.

### M7. The signals that arm the catch-up and the nudge are not defined
- **Lenses:** all seven (design M13 and M15, codebase M7 and M8, readiness M7 and M8, comprehension 7, structural M1, zoomout M11, inventive B7).
- **Section:** call 5 (plan:18); Task 4 (plan:106-108, 115-120).
- **Problem:**
  - "A turn with work (an Edit, a Write or a commit)" needs Edit and Write to be seen, but only Bash and PowerShell are hooked.
  - "Filing" is never defined. The brief's definition includes a /loose-ends run, which needs a hook on the sibling plugin's command, and call 9 rules that out.
  - "A compaction that kept items" has no stated sign:
    - a compaction returns messages, not a summary string;
    - a precompute may be reused later, or never pass back through session.compact;
    - the fixed heading's text is not given;
    - subagent compactions are neither ruled in nor out.
- **Evidence:** d.ts:11813-11846, 11884-11890, 11906-11913; BACKLOG.md:56 (HK-084); plugin-mechanics.md:76; brief:226, 238.
- **Fix:**
  - Filing means an Edit or Write on either records file, or a commit touching them. A /loose-ends run is not seen, and the plan says so.
  - Work means any Edit, Write, NotebookEdit or commit, seen through tool.call hooks that only mark it.
  - Give the heading verbatim, and count its lines in the messages `next(e)` returns, on triggers other than precompute, on the main loop only (`agentId` unset).
  - Possible cut (design, zoomout): arm on work and commits only, and drop compaction-arming.

### M8. The compaction paragraph breaks pinned tests and DESIGN 3.8, and the plan does not say the change is deliberate
- **Lenses:** design M15, codebase M7, readiness M13, structural M14, zoomout M13, inventive B14, comprehension 24 (Nit).
- **Section:** Task 4, compaction (plan:106-108).
- **Problem:** The kit's test world has settings by default, so the new paragraph breaks the pins saying a compaction with no procedure sent "goes on as it came". The plan does not call this a deliberate change, so stop rule plan:35 makes the builder stop. It also does not say whether subagents and forks get the paragraph, or give the heading text.
- **Evidence:** tests/plugin.test.ts:76, 772-779, 781-795, 798-817, 911-922, 959-977; DESIGN.md:413-415; register.tsx:361-367; brief:94-98.
- **Fix:** Say "the main conversation only, every trigger; forks and subagents unchanged". List those tests as changed on purpose, with their new expectations, edit DESIGN 3.8 in the same commit, and give the heading.

### M9. The transcript fallback and DESIGN 3.11's prompt files are promised but never built
- **Lenses:** design M14, codebase M10, readiness M7 and N7, comprehension 5 and 6, structural M16, zoomout M11, inventive B10.
- **Section:** call 4 (plan:17); Task 1's handPrompt (plan:53-54); Task 2's files (plan:71, 81-82); Not built (plan:144-145).
- **Problem:**
  - Call 4 keeps transcript reading as the fallback for the desktop app, but no task builds it and Not built does not list it. Call 4's own reason against transcripts (the 4 MiB and 256 KB limits) applies to the fallback too.
  - DESIGN 3.11 says filing and owed ship as prompt.md files, and neither is planned.
  - Task 1 hands owed a prompt through handPrompt, while Task 2 builds owed as a computed reply with an exit code.
  - The list of recorded procedures is not given.
- **Evidence:** DESIGN.md:500-502; register.tsx:197; brief:89-90.
- **Fix:**
  - owed is a computed command only: no handPrompt, never recorded.
  - Amend 3.11: owed's Node form is the form any agent can run, and filing is loose-ends' own prompt.
  - List the desktop catch-up under Not built, with a row and a DESIGN 10 entry. The desktop app still gets the compaction paragraph and the nudges.

### M10. The after-commit delta has no source and no content
- **Lenses:** all seven (design M12, codebase M11, readiness M6, comprehension 9, structural M15, zoomout M6, inventive B8).
- **Section:** Task 4 (plan:104, 109-112).
- **Problem:**
  - "The rebuild starts without waiting" (the walk takes 37-75 s), yet "a delta is attached" to the same result.
  - The plan does not give the delta's content or source, whether it is masked, or where the old sha comes from.
  - "delta.ts if needed" leaves the choice to the builder.
  - "The original result returned" conflicts with adding context to it.
  - A command run in the background returns before it commits.
- **Evidence:** brief:100-103, 234-236; register.tsx:98, 106-128; d.ts:14250-14265, 22343; HK-070.
- **Fix:**
  - The delta is `historyFrom([snapshot(old), snapshot(new)])` over `git show` of the two files, with no walk: the opened, closed and gone IDs, masked, at most 400 characters.
  - The old sha is the stored view's sha for the current settings. With none stored, there is no delta.
  - Return `{ ...got, context: [...(got.context ?? []), delta] }`, with a kit test that `result` and `ref` survive.
  - Skip results that carry `backgroundTaskId`.
  - Decide the file: put it in owed's core, with no delta.ts.
  - Possible cut (design, comprehension): one fixed, masked line, "the records on <main> changed at <sha7>; /housekeeping shows the new view".

### M11. The automatic page write can land where it should not
- **Lenses:** codebase M11, readiness M6, comprehension 9, structural M15, zoomout M7.
- **Section:** Task 4 (plan:111).
- **Problem:**
  - The page is written whatever the cadence, including in repositories that never ran map, with no guard for a failed build or null html.
  - fresh() is shared by every caller and drops load()'s html.
  - Where .gitignore lacks `.housekeeping/` (set up by hand, or with settings held uncommitted), an agent's `git add -A` would commit the full page.
- **Evidence:** adapter.ts:95-97; index.ts:50; register.tsx:106-128, 263; plan.md:19; HK-056; phase-0-mechanics.md:73.
- **Fix:** Only the fresh() started from tool.call writes the page, through writePage after map's guard. It writes only when html is not null, `git check-ignore -q .housekeeping/route-map.html` exits 0 (otherwise a debug line), and a link is stored or the page already exists. Add a test.

### M12. The shell hook's error handling can be read as running the command twice
- **Lenses:** design M1 (Major, its top-ranked harm); codebase N6, structural N1, zoomout N11, inventive and comprehension 19 graded or noted it as a Nit.
- **Section:** Task 4 (plan:110, 123-124).
- **Problem:** "A try/catch inside, next called once" can be read as wrapping `await next(e)` in the try. A catch that retries then runs the command again, and a catch that returns has no original result. The types also correct the brief's reason:
  - a `.catch` handler's `next` replays the earlier result instead of running again;
  - a hook that fails after `next` keeps that result;
  - returning while `next` is still pending aborts what runs beneath.
  So the real risk is a second `next` call in the hook's own body.
- **Evidence:** d.ts:1212-1236, 4204-4206, 4213-4221, 14845-14846; register.tsx:359; brief:254-257.
- **Fix:** Write the shape out. `const got = await next(e)` runs once, outside any try and before any early return. Only the work after it is wrapped, and any error returns `got`. Register `.catch(($, e, next) => next(e))` as the other hooks do. Kit test: a hook that throws after next shows exactly one run of the shell command and returns the original result.

### M13. owed's base, collision check and exit codes are unstated or wrong
- **Lenses:** all seven (design M9, codebase M5 and N11, readiness M5, comprehension 14, structural M4 and N5, zoomout M3 and N10, inventive B6).
- **Section:** Task 2 (plan:73-82); call 13 (plan:26).
- **Problem:**
  - The slash route has no default base; DESIGN 3.9 says the merge base. Whether the diff is `base...head` or `base..head` is unstated.
  - "IDs the branch adds that the base already holds" checks the merge base, which never holds IDs that main gained after the branch point. That is the parallel-worktree case the check exists for (and a duplicate inside the head is already caught by id-unique).
  - "Settled" is undefined.
  - The exit code on a stop or a git error is unstated, and "exit 0" clashes with cli.ts's exit 2.
  - `--base` is required on the Node route but optional on the slash route, and the plan does not say so.
  - Whether the log uses `--first-parent`, and `--end-of-options` on every ref, are unstated.
- **Evidence:** DESIGN.md:434; brief:281-284, 341; cli.ts:85-90, 110; history.ts:12-13; HK-015.
- **Fix:**
  - The default base is `git merge-base <main> HEAD`, and a given base is also run through merge-base with the head. The diff is `<base>...<head>`.
  - Collisions are IDs the branch adds that main's tip (`git show <main>:<file>`) or the base already holds.
  - Settled means moved to Done at the head.
  - Exit 0 on a listing; exit 2 on a stop, a usage error or a git error.
  - Use `--end-of-options` on every ref. Read the log without `--first-parent`, or say why not.

### M14. owed stops on any range of real size because of the 4 MiB stream cut
- **Lenses:** design M10, codebase M5, readiness M4, comprehension 14, structural M7, inventive A3 (Blocker-grade on large repositories).
- **Section:** Task 2 (plan:78-79); call 2 (plan:15).
- **Problem:** `git diff -U0` over two weeks of main, or over the first audit's range from the settings commit (most of a busy repository's history), passes `$.process.run`'s 4 MiB cut. "A cut-short stream stops it", so tier 1 fails on the first audit, the one that matters most.
- **Evidence:** plugin-mechanics.md:48; d.ts:3733-3734, 8582-8599; adapter.ts:26, 38; brief:464.
- **Fix:** List the changed paths with `--name-only` first. Then run `git log -G'<escaped alternation of trigger tokens>'`, or `-U0` per batch of paths, in batches under Windows' command-line limit of about 32K characters. Leave out binaries. Count a path or batch that is cut short as "not read" instead of stopping. Note that git's regex dialect differs from JavaScript's.

### M15. The code-name rule is undefined, and the audit's own duty row matches it
- **Lenses:** codebase M5 and N1, readiness M5, structural M6, zoomout M16, comprehension 22 (Nit), design N9, inventive.
- **Section:** call 13 (plan:26); Task 2 (plan:83).
- **Problem:**
  - "Path-like token" and "whole word" are undefined, for example for `src/x.ts` or `foo.bar()`.
  - Call 13 matches changed lines only, while Task 2's evidence cites "the path" and DESIGN 3.9 says "names a file the branch touches". Exact, suffix or basename match, and renames, are not covered.
  - FORMAT.md:49 says backticks mean nothing.
  - The duty row's own trigger, "Every 2 weeks: /housekeeping audit", contains `/housekeeping`, so the row fires on any change that mentions housekeeping.
- **Evidence:** DESIGN.md:435; FORMAT.md:49.
- **Fix:** Write the rule into the plan and FORMAT, with test cases:
  - a token is a backticked span, or a word that holds `/` or ends in `.<letters>`;
  - it is matched as a whole word on the `-U0` added and removed lines, and as a path suffix on a `/` boundary against the `--name-only` paths;
  - both sides of a rename go to the Read check;
  - duty rows and slash commands are left out.
  Amend FORMAT.md:49.

### M16. owed's evidence can print secrets and author names
- **Lenses:** comprehension 13, zoomout M17; codebase N10, readiness N5.
- **Section:** Task 2 (plan:74-76).
- **Problem:** The evidence includes "the line it matched". Masking catches only key shapes, so passwords pass, and the Node output lands in CI logs. Commit bodies (`%B`) carry Co-authored-by names, against the rule that commit authors are never shown.
- **Evidence:** DESIGN.md:260-261, 265.
- **Fix:** The evidence is the path, the line number and the matched token, never the line's text. Commits are shown by sha and subject only.

### M17. owed would add a third and a fourth copy of the git readers
- **Lenses:** zoomout M5; readiness M13 (history.ts missing from the files).
- **Section:** Task 2 (plan:71).
- **Problem:** Both routes already have their own readers (show and filesAt), and the brief's "no-history read path" item was dropped.
- **Evidence:** adapter.ts:36-46; cli.ts:93-104; parse.ts:12; brief:336.
- **Fix:** Call the existing readers with the base and head shas, with the git argument builders in hooks/core/history.ts. owed.ts stays pure over snapshot() and idsIn.

### M18. Tier 0 has no data source, doors have no rule, and "moved" is redefined
- **Lenses:** design M7 and M8, codebase M4, readiness B2, comprehension 2 and 20, structural M5, zoomout M4, inventive B1 and B9.
- **Section:** Task 3, tier 0 (plan:90-92); call 3 (plan:16); Task 2 (plan:78).
- **Problem:**
  - "Rows gone with no Done entry" come from the history walk, which takes 37-75 s and would run inside command.run. owed explicitly does no walk, and nothing hands those rows to the audit on either route.
  - "Doors just opened" are neither closings nor ticks, so the plan does not say whether tier 0 applies them, which would change Land now.
  - Call 3 makes "moved" mean gone, but historyFrom and the page use `moved` for a row that changed file. A builder would wire the wrong list.
- **Evidence:** history.ts:62-74 (70-71); adapter.ts:48-58; template.ts:543; DESIGN.md:96, 212; brief:100-103.
- **Fix:**
  - owed reports the gone rows over the range from `historyFrom([snapshot(base), snapshot(head)])`: open at the base, absent at the head, and in no Done table, with no walk. The Node owed prints them too.
  - Doors and closed checklists come from `build({snapshots: []})` and are listed as judgement calls, never applied.
  - Call 3 says "gone", and `moved` keeps its meaning.

### M19. Judgement calls are still writes, even where call 11 forbids writing
- **Lenses:** design M5, readiness M3, comprehension 11, structural M9, zoomout M15, inventive B4.
- **Section:** call 11 (plan:24); Task 3 (plan:96-98).
- **Problem:**
  - Judgement calls get "Audit YYYY-MM-DD:" and "Default until decided:" lines written into their rows, which are writes the owner never saw. In a repository whose rules restrict who writes the records (test repository B), every case becomes a judgement call, so rows are written there anyway. DESIGN 3.9 says judgement calls are listed, not written.
  - "Default until decided:" records a default the owner never chose. Structural notes that it fills a field the owner's queue shows; comprehension notes that an agent row does not reach the owner's queue.
  - A table row is one line, so "a line in the row" needs a cell and a separator.
  - The plan does not say how the agent finds such rules.
- **Evidence:** DESIGN.md:153-154, 285, 431-433; facts.ts:55; FORMAT.md:49; page.ts:15; brief:261, 404.
- **Fix:**
  - Under call 11, the audit writes nothing and makes no branch. It lists every case in its reply and says the range will repeat. It finds the rule in AGENTS, CLAUDE, CONTRIBUTING and the backlog's "How this file is kept".
  - Elsewhere, append only "Audit YYYY-MM-DD: <claim>, left for the owner" to the Details cell with `<br>`, on the audit branch, and list it in the reply too.
  - Drop "Default until decided:", or give its exact text.

### M20. The audit branch: a dirty tree, the person's checkout, re-runs and pushing
- **Lenses:** design M6, codebase M3, comprehension 12, structural M10, inventive B3, readiness N3.
- **Section:** Task 3 (plan:95-96).
- **Problem:** "A branch from main in a clean tree" leaves out:
  - a dirty tree, where an agent may stash, reset or clean away the person's work;
  - whether the person's checkout is switched, and going back to the starting branch;
  - the branch name;
  - an earlier audit branch not yet merged, where a re-run on an unchanged main applies the same closings again (done-id duplicates and conflicts);
  - who pushes.
- **Evidence:** brief:262; prompts/plan.md:30; parse.ts:178.
- **Fix:**
  - If `git status --porcelain` is not empty, apply nothing, list the cases and say why. Never stash, reset, `checkout --` or clean.
  - Make the branch `housekeeping/audit-YYYY-MM-DD` from main in `git worktree add`, or with `git switch -c`, saying the checkout changed and switching back at the end.
  - Stop if an unmerged `housekeeping/audit-*` branch exists.
  - Never push: the branch is the owner's to push and merge.

### M21. The audit's watermark skips the pairs past its cap
- **Lenses:** inventive A2.
- **Section:** call 2 (plan:15); Task 3 (plan:91-93, 96-97).
- **Problem:**
  - Each run caps work at 25 pairs, yet "through <sha>" moves to main's tip, so pairs past the cap are never looked at again.
  - Taking pairs "strongest evidence first" clashes with a watermark that runs in commit order.
  - Call 2's reason against trailers ("an audit that applies nothing writes no commit") applies to the duty row too, since updating Last done is a commit.
- **Fix:** When pairs were left over, Last done keeps its sha and the reply says to run again. Applied rows are closed and judged rows carry their Audit line, so a re-run picks up where it stopped. Say that an audit with nothing to apply still makes a one-commit branch.

### M22. Audit rules are left to the builder, and the time-out reply leaves nothing to run
- **Lenses:** structural M11, readiness N3, design N9 and N11, codebase N12, zoomout N4, inventive B9.
- **Section:** Task 3 (plan:90-100).
- **Problem:**
  - Not given: the list of closing words, the test for "still present at main's tip", the skeptic's inputs, what "pairs" are, a number for "about 10" per batch, and the route outside Claude Code.
  - "No Node form, and the time-out reply says so" leaves a person whose audit timed out with nothing to run, though DESIGN 3.11 requires every procedure to run outside Claude Code.
- **Evidence:** DESIGN.md:500-502; register.tsx:344-346; brief:77.
- **Fix:** Write each rule into Task 3: batches of 10, and the skeptic gets the row, the claim, the sha and the allowed hunk. The time-out reply names prompts/audit.md and `node <home>/cli.ts owed --base <sha> --head <main>`, except when owed excluded paths (see B3).

### M23. The audit duty row: init's row, how it is found, and where the first audit starts
- **Lenses:** all seven (design M16, codebase M3 and M13, readiness M4 and M11, comprehension 12 and 16, structural M12, zoomout M14, inventive B13).
- **Section:** call 2 (plan:15); Task 3 (plan:87-88, 90, 97).
- **Problem:**
  - A row in init's playbook breaks the Phase 1 bar "a map with no rows", DESIGN 3.8's empty tables, FORMAT's section on new repositories, init.test.ts:39 (`counts.all` is 0) and the no-warnings test.
  - Its cells are not given, and they change what the person sees: Land now `yes` counts in the status line, and Who `owner` puts the row in the owner's queue for good.
  - Filed needs a date, and `initFiles` has no clock. At init there is no sha and no Last done, so the duty is never due.
  - Existing repositories have no such row, and adding one is "opened", which call 3 forbids.
  - No rule finds the row or parses "through <sha>": validating the sha, or handling one that is not in the clone or not on main.
  - Settings held uncommitted, or a shallow clone, leave no settings commit to start from. With one, the range can be the whole history.
- **Evidence:** DESIGN.md:419-420, 623; FORMAT.md:60-69; tests/init.test.ts:34-50; facts.ts:55, 58-61, 71; register.tsx:50, 179-180; templates.ts:36; findings.ts:40; brief.ts:32; BACKLOG.md:29 (HK-056); brief:176.
- **Fix:**
  - init's tables stay empty. The first audit adds the duty row on its branch as the one row it may open, or proposes it as a judgement call. Give the row word for word: Who `agent`, Land now `no: a standing duty`, Milestone `none`.
  - The duty row is the one whose Trigger contains "/housekeeping audit". Validate its sha with `git rev-parse --verify --end-of-options <sha>^{commit}`.
  - Start at Last done's sha, or else the settings commit. Cap the range at, and fall back to, the last 50 first-parent commits on main, and say so in the reply.
  - Alternative: keep the row in init, give every cell, add a `today` parameter, and amend DESIGN 7, DESIGN 3.8, FORMAT and init.test.ts on purpose.

### M24. init's new keys have no values, and they break the reference-repository criterion
- **Lenses:** design M17 and N12, codebase M13, readiness M12, comprehension 15 and 16, structural M13 and M18, zoomout M18, inventive B11.
- **Section:** Task 1 (plan:66-67); Completion (plan:150); call 13.
- **Problem:**
  - Not given: the `notDoing` and `decisions` values, the Not doing headings, and whether check warns when the decisions folder is missing.
  - "The reference repository's check gives the same findings as before" contradicts check's new recommendations wherever those keys are missing.
  - No baseline commit, settings copy or runner is named, and HK-079 says sessions here could not read the reference repository.
  - Call 13 cites HK-079 for the fired-triggers script, but HK-079 is about a settings copy's checklist headings.
  - Nobody knows whether the reference settings set both keys, because its copy is under research/raw.
- **Evidence:** BACKLOG.md:52; types.ts:21; FORMAT.md:58.
- **Fix:**
  - Give `{"file":"playbook","heading":"Not doing"}`, `"decisions": "docs/decisions"` and the headings "Item | Why not | What would reopen it".
  - Reword the criterion to "the same findings plus the two new recommendations where the keys are missing".
  - Before Task 1, capture `node cli.ts check` at the base commit into scratch, run by the controller with the local settings copy. If the reference cannot be read, mark the check not run and give the reason.
  - Fix the HK-079 citation.
  - Possible cut (design): drop the new recommendation for existing repositories.

### M25. Task 5 leaves decided text that contradicts what is built
- **Lenses:** design M18, codebase M12, readiness N1, comprehension 17, structural M20, zoomout N5, inventive.
- **Section:** Task 5 (plan:134-136); Task 3 (plan:88).
- **Problem:**
  - The audit commits without per-step approval, but no task changes DESIGN 4 ("never commits on its own") or README:81 ("It never commits, pushes or fetches").
  - Only README line 5 is fixed, and it is fixed twice, in Task 3 and in Task 5.
  - Also missing: DESIGN 3.3 (the per-person store), 3.6 (an updated view rides on the tool call's result), 3.7 (the cadence and its default), 3.9 (`owed [base]` against `--base`), 3.11, section 7, and section 10 item 7.
- **Evidence:** DESIGN.md:186-191, 307-309, 322-325, 434, 500, 510-512, 755-757; README.md:5, 81.
- **Fix:** One task edits README:5, README:81 and DESIGN 4: "apart from the audit's clear-cut cases, on a branch, which the agent commits and the owner merges". Add 3.3, 3.6, 3.7, 3.9, 3.11, section 7 and 10.7 to Task 5.

### M26. The file lists are not exact
- **Lenses:** all seven (design M19, codebase M14, readiness M13, comprehension 18, structural M20, zoomout N5, inventive B14).
- **Section:** every task's Files line (plan:47-48, 71, 87-88, 104, 128-129).
- **Problem:**
  - No task lists a test file or fixture, and changed files are not marked Modify.
  - FORMAT.md is missing from Tasks 1 and 3, though init's output and the backticks rule change.
  - hooks/core/history.ts is missing.
  - hooks/core/commands.ts is missing from Tasks 2 and 3, and Task 1's table advertises audit and owed before they exist, so a task does not end stable.
  - adapter.ts is not listed for the shared publish.
  - `templates.ts` has no folder, and the page's `template.ts` also exists.
  - Task 1 uses the glob `prompts/*.md` for files whose names are known.
  - "A new hooks/core/delta.ts if needed" leaves a decision to the builder.
  - "The marketplace entry" has no path: it is `.claude-plugin/marketplace.json` at the repository root, outside the plugin folder.
  - The new version number is not given.
- **Evidence:** BACKLOG.md:38; FORMAT.md:49, 60-69; research/phase-2-check-minors.md:111; marketplace.json:31-34.
- **Fix:**
  - Give repository-relative paths, marked Create or Modify, per task. Include tests/plugin.test.ts, tests/init.test.ts, tests/brief.test.ts, node-tests/cli.spec.ts, the new tests/owed.test.ts and tests/card.test.ts, and the audit fixture.
  - Add each command's table entry in the task that builds it.
  - Decide delta.ts, and bump the version from 0.2.0 to 0.3.0.

### M27. No test case is named, and the kit's fakes would mislead the new tests
- **Lenses:** codebase M15, readiness M13, comprehension 3, structural M20, design M19, zoomout N14, inventive B14.
- **Section:** the gate (plan:40); every task.
- **Problem:** "A focused test that fails before it" names no case. The current fakes would mislead the new tests:
  - every unknown git call exits 1, which `git diff --quiet` reads as "the records changed";
  - any `rev-list --count` returns `behind`;
  - the prompt stand-in matches only survey and plan, so a read of audit.md returns the settings text;
  - there is no fake for a Bash or PowerShell tool.call.
- **Evidence:** tests/plugin.test.ts:80-82, 106, 116.
- **Fix:** Name cases per task, at least these:
  - keep(): survey, plan, both, survey with a denied file, and plan with audit, each byte for byte.
  - The card: with ID patterns, and with "none set".
  - Views: duties worked out when served, across a day change; the format constant in the stamp; an old-format view rebuilt once; the short view read again after a compaction (HK-004).
  - owed: the default base; a denied path counted; a cut-short stream; no local main; a shallow clone; the whole-word rule; a collision with main.
  - The tool.call hook:
    - runs the command once when it throws before or after next;
    - starts no git process without `git`;
    - handles PowerShell and a merge (`branch.action: "merged"`);
    - does no rebuild when the records are unchanged;
    - adds no delta in a subagent;
    - skips a background command.
  - Compaction: the paragraph appears only where it should, and the procedure paragraph survives a throw in it.
  - Nudges and the catch-up: the suggestion fires once per HEAD; the catch-up is never offered for a live record, a non-interactive run or the same id.
  - Publishing: none with agentId set, with isInteractive false, or with no stored link.
  - Name the fake changes: `diff --quiet`, a counted `rev-list` range, an audit prompt stand-in, and a Bash fake that returns `gitOperation`.

### M28. Engine facts that only a live run can settle are presented as kit-tested
- **Lenses:** readiness M14, comprehension 19, codebase M8 and M9, structural N2, zoomout N8, inventive, design N2.
- **Section:** How the build runs (plan:42-43); Task 5 (plan:138).
- **Problem:** Kit tests answer from fakes the test author wrote. They check the plugin against a reading of the types, not against the engine. The plan relies on these facts:
  - `$.prompt.suggest` shows at turn end;
  - `$.session.id()` after `--resume`;
  - a plugin's `$.tool.call` opens no dialog;
  - context on a tool result reaches the model;
  - `gitOperation` on compound and backgrounded commands;
  - a precompute is reused;
  - a userConfig change reloads the plugin;
  - prompt.context fires for a resumed conversation;
  - `isInteractive` is available only at session.start.
  Task 5 names no live checks.
- **Evidence:** d.ts:3170-3180, 3210-3218, 10075-10085, 10177-10178, 12116-12123, 12612-12620, 12802, 22343; tests/plugin.test.ts:66-154, 727; brief:151-158; BACKLOG.md:14.
- **Fix:** Reword plan:42-43. List each fact in research/live-checks.md with its keystrokes and one passing observation, beside the brief's five checks and HK-004's.

### M29. The marketplace description is edited before the owner's sitting
- **Lenses:** structural M21 (Major), codebase N9 (Nit).
- **Section:** Task 5 (plan:137).
- **Problem:** The brief says the description is edited after the sitting. Editing it first advertises automatic parts nobody has checked live. "Edited last" also gates nothing: the entry's source is `./housekeeping`, so a merge ships the new version whatever the description says.
- **Evidence:** brief:378; marketplace.json:33.
- **Fix:** File the description edit as a row for after the sitting, and reword "edited last".

---

## Nits

- **N1. `git` matched as a substring** (design N6, codebase N3, inventive; plan:109-110). "The command holds git" also matches `.github`, `.gitignore` and `digital`, so git would start on nearly every shell call. Fix: match `\bgit\b`, and check for `.housekeeping.json` before any git call.
- **N2. The debug lines** (codebase N4, readiness N5, zoomout N7, comprehension 23; plan:122, call 15). Say "no row text, no paths" (brief:370). Use `$.ui.log` with `{ to: 'debug' }`, since its default is the transcript (d.ts:15622-15627).
- **N3. Masking, and keeping the card separate** (design N7, structural N9).
  - Pass the card (its settings strings included), the delta and owed's evidence through maskPrivacy (HK-070), as brief.ts:81 does.
  - Build the card in its own block, so a failure building it cannot drop the short view; the prompt.context hook has no `.catch` (register.tsx:378-383).
- **N4. Two overlapping view rules** (readiness N4 and N9, comprehension 28, structural N7, zoomout N2, inventive).
  - "A stored view with no duties field is a miss" (plan:62) does the same job as the format constant (plan:63); keep only the constant.
  - Note as a known shortcut that two sessions on different versions rebuild over each other's view.
- **N5. The command table** (zoomout N1, readiness N4; plan:63-65). It costs more than it saves: one test asserting that each command name appears in all five places would do.
- **N6. Tier 1 wording** (structural N6 and N8, zoomout N3, inventive).
  - "Plus the IDs main's messages name" (plan:91-92) repeats owed's "rows the commits name" (plan:76); cut it.
  - "Tier 0 costs no tokens" reads better as "needs no diff reads".
- **N7. The gate** (codebase N5, readiness N6, design N8).
  - Give the command verbatim, as plans/2026-11-12-phase-2-fixes-2.md:29 does (`node --test housekeeping/node-tests/*.spec.ts`, with TEMP and TMP set).
  - Add the type check (DESIGN.md:668).
  - Say what happens to the narrow check's findings (plan:152; stop rule 3, DESIGN.md:683-685).
- **N8. The branch base** (design N8, readiness N11, comprehension 29, structural N10). "Cut from main at the Phase 2 merge" (plan:39) should name the sha; BACKLOG.md:16 and :26 still say Phase 2 is not merged.
- **N9. Dates** (readiness N10, structural N11). The plan dates the owner's words 2026-11-13 (plan:6, 10; call 15), but the date where the reviewers ran was 2026-11-12. Check it before DESIGN 9 and 10 record it.
- **N10. The rows to file** (design N9, readiness N12, codebase N12). List "rows for what is filed" (plan:140): the per-repository cadence; the card falling short; HK-077 limited to plan sessions; the desktop catch-up; owed against the reference script, waiting on HK-079.
- **N11. Backlog references** (comprehension 21 and 25, readiness N2).
  - Call 14 misreads HK-077, which is already limited to plan sessions (BACKLOG.md:50); the real risk is a conversation that holds both procedures.
  - Update HK-080 (BACKLOG.md:53) when Phase 3's checks are folded in.
  - Include HK-053 (BACKLOG.md:26), as the brief asked (brief:165), or say why not.
- **N12. Terms a fresh reader cannot place** (comprehension 26 and 27, structural N12).
  - "Elephant-Goldfish model" and "lenses" (plan:5), "the controller" (plan:32, 43), "kit test", "the narrow check" (plan:152) and "the commit test" (plan:56) are never defined.
  - "The gate" is used at plan:32 but defined only at plan:40-42.
  - Stop rule plan:35's "the agent stops it ... and goes on" reads better as "leaves the larger fix undone, files a row, and goes on".
- **N13. Structure** (structural N12).
  - Bullet lead-ins are bold in Tasks 1 and 4, plain in Tasks 2 and 3, and code in Task 5.
  - Files lines mix paths with prose, and the H2 at plan:10 has a long parenthetical.
  - There is no per-task acceptance, and no Test plan or File boundary section, which the standard requires.
  - Say that the latest of the duty row's Last done lines gives the sha (FORMAT.md:23).
- **N14. The status line** (comprehension 28). DESIGN 7's status-line bar needs `$.ui.status` refreshed when the after-commit rebuild lands; today it is set only at session start (register.tsx:327).

---

## What the reviewers agreed holds

- The objective is clear, the order of the five tasks is sound, and most of the fifteen calls are sound (design, zoomout). The gaps are acceptance, steps that cannot be carried out as written, and choices left to the builder that the zero-decision rule forbids.
- The plan's account of the built system matches the code, including its known gaps: keep() written for plan alone, no card, duties going stale, and the after-commit rebuild keyed on the wrong event (comprehension).
- Keeping survey's and plan's procedure and keep text unchanged is the right aim. The lenses objected only to the markers.
- "Next called once" is the right rule, and the existing `.catch(($, e, next) => next(e))` shape is safe by the types (comprehension, structural, zoomout, inventive).
- Most fixes can reuse what is built, with no history walk:
  - `snapshot()` with `historyFrom()` over two refs gives gone, closed and the delta;
  - `map --settings <copy>` gives the partition counts (prompts/plan.md:28);
  - readTracked's allow rule and withoutNode give the deny handling.
- No lens asked to widen call 3's limit (closings and checklist ticks only, on a branch); several asked to narrow it further.
- The heading order and the four-column calls table are well formed (structural).

---

I wrote this from the seven reports alone and read and ran nothing myself. No reviewer ran code, git or tests or read research/raw, and their engine claims rest on the supplied types only.
Unconfirmed: whether Phase 2 is merged into main, and whether the reference settings already set `notDoing` and `decisions`, which decides M24.
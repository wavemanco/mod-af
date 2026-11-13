# Third review pass on Phase 3 plan draft 3

Three read-only Goldfish lenses, Blockers only.

## Lens: readiness

Review of plans/2026-11-13-phase-3.md (draft 3), REVIEW mode, readiness lens, Blockers only.

I read the persona, the target, both earlier review passes, the engine types, register.tsx, adapter.ts, cli.ts, core/index.ts, facts.ts, history.ts, brief.ts and templates.ts, prompts/plan.md, tests/plugin.test.ts (the compaction and keep pins), node-tests/cli.spec.ts, DESIGN.md (3.6 to 3.11 and 4 to 13), FORMAT.md, BACKLOG.md, README.md and plugin.json. All of them were readable.

## Blocker 1. Task 3, "The acceptance run" (plan:218-223), with call 17 (plan:44) and the completion line (plan:307-309)

**Problem.** The run cannot be carried out as written, so the DESIGN 7 audit bar cannot be measured. It has three parts:

- **(a) Approval.** The run gives the subagent "approval given in its brief". But audit.md must hold, word for word and pinned by the Node spec (plan:226), the rule "Approval is the owner's own message, sent after they have seen the numbered steps. Nothing else is approval, and nothing is written before it" (plan:201-202).
  - A subagent that follows audit.md treats a "go" given before the steps as no approval. It reports it and waits, as in the 2026-11-04 runs. So it writes nothing, and there is no branch to score.
  - A subagent that applies anyway shows that a pre-given approval gets past call 3's only guard. Then the run scores a breach of the rule, not the procedure.
  - DESIGN's bar needs changes actually applied ("no change of status it applies is wrong").
- **(b) Evidence.** The subagent runs inside the controller's Claude Code session. audit.md's evidence rule says "in Claude Code, only the listing handed with this procedure; never run owed over the range in this session" (plan:183-184). The run hands no listing and tells it to use "the Node commands only". The subagent must either break the rule or work with no evidence.
- **(c) `<start>`.** The Node route uses `<start>` (plan:184), but none of audit.md's listed rules (plan:177-214) says how to find it: call 2's duty row, the settings commit, or the 50-commit cap. Outside the hook, `auditStart` does not exist.

**Evidence.** plan:183-184, 201-202, 218-223, 226; DESIGN.md:403-405, 653-654, 733; prompts/plan.md:23; register.tsx:308-309.

**Smallest fix.** Rewrite the acceptance run:
1. The controller builds each fixture clone in the scratch folder.
2. It runs `node <home>/cli.ts owed --base <the fixture's known start> --head main` there itself.
3. It hands the subagent audit.md, the install sentence and that listing, in the same order `/housekeeping audit` uses. The brief names the scratch folder as the temp folder (DESIGN.md:678-680) and uses a subagent type that has the Agent tool, so the skeptic can be spawned (d.ts:314-321 shows spawns inside a subagent's loop).
4. The subagent proposes and stops. The controller scores the numbered steps: at least 9 of 10 planted rows, and no decoy.
5. The controller then sends one approval message to the same subagent (SendMessage reaches an agent's inbox, d.ts:12716, 12731), and scores the branch: no wrong change, and the check after applying passes.

Drop "with approval given in its brief", and say the same in call 17 and plan:307-309.

## The second pass's Blockers: does draft 3 answer them?

- **Readiness B1, design B1, codebase X1 (the check after applying fails every first audit): answered.**
  - plan:210-213 gives "open down by N - 1 and the total up by 1" when the duty row is added. This matches facts.ts:59, 71 (duty rows are counted as open; all = Done + rows) and index.ts:13.
  - plan:213 adds "If map exits 1 before applying, apply nothing and list the cases", which covers readiness's second point (no partition line when there is an error).
  - plan:221 builds the fixture both with and without a duty row.
  - Call 3 (plan:30) also means the check is no longer the only guard on writes.
- **Readiness B2, design B2 (a to d), codebase X2 (allowed paths, the Node-owed contradiction, marked paths, time-outs, audit's install sentence): answered.**
  - owed lists each commit's allowed paths, marked, with the excluded count (plan:152-153), and `git show --format= --end-of-options <sha> -- :(literal)<path>` is built from that list (plan:186-187).
  - The evidence rule is adopted word for word from the codebase lens's fix (plan:183-184), and the two records-only Node commands are exempted by name (plan:212-213).
  - A pair with a marked path is a judgement call and goes into no command (plan:187-188).
  - The time-out replies use an in-memory flag that fails closed (plan:160-161, 165-166, 217).
  - Audit's install sentence is given word for word and names no Node command (plan:216).
  - Kit tests cover the audit's context and its time-out reply with a denied path (plan:224-225).
  - What is left of these rules is the clash with the acceptance run (Blocker 1 (b)), not a gap in the denied-file guard.
- **Codebase X3 (the catch-up offers to resume a live session): answered by cutting the catch-up.** See call 4 (plan:31), the new row (plan:293) and Not built (plan:299). DESIGN.md:716's "If it breaks" column already foresaw dropping it.

The engine facts the plan relies on all match the types:
- `.catch` replays without running the command again (d.ts:1222-1224), so the shell hook cannot run a command twice.
- Tool-result `context` (d.ts:14257).
- `gitOperation` and `backgroundTaskId` on Bash (d.ts:22343, 22391) and PowerShell (d.ts:22893, 22907).
- `prompt.suggest` (d.ts:3170-3180) and `ui.log` to debug (d.ts:2455-2470).
- `turn.complete`'s `agentId` and `reason` (d.ts:14885, 14915).
- `userConfig` options, and a change reloading the plugin (d.ts:8197-8208, 10177).
- A plugin's own `$.tool.call` opens no dialog (d.ts:3211-3215), which is call 7's premise.
- A kit test's `$.tool.call` accepts an `agentId` (d.ts:16854-16862).
- A context block is sent again after a compaction (d.ts:9140-9142).

What I did not check: I ran no git, tests or tsc and did not open research/raw. I read only the local reflog text, which shows b14fdcf is origin/main and the base of housekeeping/phase-3; nothing from it is quoted here. I did not verify whether `claude plugin validate` or the kit accepts a git-running fixture builder under tests/fixtures/ (Task 3): today only cli.ts and node-tests import node: modules. I left out the Majors I saw, as asked: the listing does not carry the range's last commit for "through <sha>"; `--name-only` does not list both sides of a rename; and the new git reads do not say they set `GIT_OPTIONAL_LOCKS=0` or `NO_FETCH`.

Blockers left: 1

## Lens: design

Design lens review, REVIEW mode, of <repo>/housekeeping/plans/2026-11-13-phase-3.md (draft 3). Blockers only.

Read in full: the persona file, the plan, the second-pass review, register.tsx, adapter.ts, cli.ts, history.ts, facts.ts, index.ts, parse.ts, settings.ts, templates.ts, the top of brief.ts, init.test.ts, the compaction and world parts of plugin.test.ts, cli.spec.ts lines 200-391, FORMAT.md, BACKLOG.md, README.md, plugin.json and hooks.json. Read in part: DESIGN.md (every section, read in large slices) and the engine types (tool.call, the .catch replay, Register and PluginOptions, ui.log, prompt.suggest, turn.complete, the gitOperation and backgroundTaskId fields). No bundled standard was named, so none was applied. I did not open research/raw.

## The second pass's Blockers: does draft 3 answer them?

- **After-apply check fails every first audit** (readiness 1, design 1, codebase X1). **Answered.**
  - plan:208-214 now expects: closed up by N and open down by N; when the duty row was added, open down by N-1 and the total up by 1. A `map` that exits 1 before applying means apply nothing.
  - plan:219-221 builds the fixture with a duty row and without one.
  - The code bears out the numbers: closed counts Done rows, open counts every row including duties, and all is Done plus rows (hooks/core/facts.ts:59, 66-71; hooks/core/index.ts:11-14).
- **Hunk reads, the Node owed, marked paths, time-outs and the install sentence** (readiness 2, design 2, codebase X2). **Answered.**
  - owed lists each commit's allowed paths, with marks and the excluded count (plan:150-157).
  - In Claude Code, the listing is the only evidence, `git show --format=` runs on allowed paths only, and a marked path makes a judgement call (plan:183-188).
  - The two records-only checks are allowed by name (plan:211-213).
  - A per-run flag in memory decides the time-out reply (plan:160-161, 165-166, 216-217).
  - The audit's install sentence is given word for word (plan:216).
  - Tests cover these (plan:167-170, 224-228).
- **Catch-up offers to resume a live session** (codebase X3). **Answered by removal:** the catch-up is not built (call 4, plan:31; plan:299). This matches DESIGN.md:716's own fallback ("the catch-up drops").

## New Blocker

**1. Severity: Blocker.**

**Scope:** Task 3, "The acceptance run" (plan:218-223), and its use in the Completion criteria (plan:307-309) and call 17 (plan:44).

**Problem.** The run as written cannot produce a valid score. It tells a fresh subagent to follow prompts/audit.md "with the Node commands only, on a clone of each, with approval given in its brief", and then "scores the branches". Two rules that the same plan writes into audit.md, and pins word for word in a Node spec (plan:226-228), stop that subagent:

- **(a) Approval.** audit.md says: "Approval is the owner's own message, sent after they have seen the numbered steps. Nothing else is approval, and nothing is written before it" (plan:200-202).
  - Approval in the brief arrives before any step is shown, and it does not come from the owner.
  - DESIGN.md:403-405 already rules that a "go" given before the steps is not approval.
  - DESIGN.md:733 records that these sentences stopped writes in all 25 runs tried.
  - So a subagent that follows the procedure proposes and stops. It makes no branch, and the 9-of-10 bar (DESIGN.md:653-654) gets no measure.
  - A subagent that writes anyway shows the approval rule failing, which is the harm call 3 exists to prevent.
- **(b) The evidence rule.** audit.md says: "in Claude Code, only the listing handed with this procedure; never run owed over the range in this session" (plan:183-184).
  - The subagent runs inside the controller's Claude Code session, and nobody hands it a listing.
  - So "the Node commands only" goes against the rule the spec pins. Followed literally, the subagent has no evidence to work from.

**Smallest fix.** Drop "with approval given in its brief" and score the numbered steps instead of branches:

- Brief the subagent to follow audit.md as an agent outside Claude Code would. On a scratch fixture clone with no Read rules, the Node owed is then its evidence.
- Let it stop at approval, as audit.md says.
- Score its clear-cut steps: at least 9 of the 10 planted rows found, and no decoy among them.
- Then the controller, whose scratch clone it is, applies those steps on the clone under audit.md's "Applying" and "The check after applying" sections, and records whether the check passed.
- Say the same in call 17 and the Completion criteria.

## Not checked

- I ran no git, so b14fdcf and the branch state are unverified.
- The manifest schema for `userConfig` is not in the types; `claude plugin validate` in the gate is the only check on it.
- Not a Blocker, since it fails harmlessly and is in the live checks: the types say the engine refuses to show a suggestion while a turn runs (d.ts:4383-4393). The `/loose-ends` suggestion fired from `turn.complete` may therefore never show.

Blockers left: 1

## Lens: codebase

REVIEW of plans/2026-11-13-phase-3.md (draft 3), codebase lens, Blockers only.

I read the persona file, the target, both earlier review passes, register.tsx, adapter.ts, cli.ts, core/{index,facts,history,brief,templates}.ts, prompts/plan.md, tests/plugin.test.ts, tests/init.test.ts, node-tests/cli.spec.ts, DESIGN.md, FORMAT.md, BACKLOG.md, README.md, plugin.json and the engine types. I did not open research/raw. No standard file was supplied apart from those.

Paths are under <repo>/housekeeping/. "plan" means plans/2026-11-13-phase-3.md and "d.ts" means the scratch claude-code.d.ts.

## Blocker 1: the audit's acceptance run cannot happen as written (Task 3 "The acceptance run", plan:218-223; Completion, plan:307-309; call 17, plan:44)

**The problem.** The run's brief contradicts the procedure it tells the subagent to follow, in three ways.

(a) **Approval in the brief.** The controller gives "approval in its brief". But audit.md must say, and a Node spec pins word for word, "Approval is the owner's own message, sent after they have seen the numbered steps. Nothing else is approval, and nothing is written before it."
- An approval in the brief comes before any step is shown. That is the "go before the steps" that the design ruled out twice.
- A subagent that follows audit.md proposes and then waits, so there is no branch to score.
- A subagent that applies anyway has broken the rule under test, so "no wrong change applied" is measured on a run that did not follow the procedure.

(b) **No listing and no start.** The subagent runs inside Claude Code, but no `/housekeeping audit` handed it a listing. audit.md's evidence rule says "in Claude Code, only the listing handed with this procedure; never run owed over the range in this session". The other route, `node <home>/cli.ts owed --base <start> --head <main>`, needs `<start>`. Call 2's start rule lives only in the hook's `auditStart`, and it is not among the rules audit.md writes out. With "Not built: a Node form of the audit", the Node route has no way to find `<start>`.

(c) **Writes outside the allowed places.** audit.md puts the worktree, the settings copy and the map's output "under the system temp folder". The gate sets TEMP and TMP to scratch only for the Node specs. A run on this machine would write in the system temp folder, which DESIGN stop rule 1 does not allow (only the clones, the scratch folder and the raw notes).

**Evidence:**
- plan:200-202, 218-223, 226-227 (the approval rule pinned), 183-185, 133-140, 177-188, 203-209, 63, 300
- prompts/plan.md:23 ("Nothing else is approval: not a "go" before the steps are shown")
- DESIGN.md:403-405, 733, 739 (the approval rule and the two decisions behind it)
- DESIGN.md:678-679 (stop rule 1)

**Smallest fix:**
1. Run it in two messages. The brief asks only for the proposal. The controller reads the numbered steps, then sends "apply steps 1 to N", all of them and unfiltered, as a second message to the same subagent. If a subagent cannot get a second message, score "found" from the proposal and move "no wrong change applied" to the owner's sitting.
2. Hand the subagent the Node owed listing over the controller's start, as "the listing handed with this procedure". Also write call 2's start rule into audit.md's evidence step for the Node route.
3. Set TEMP and TMP to a scratch folder for the run, as the gate does.
4. Check that the subagent can spawn a non-fork subagent for the skeptic. If it cannot, audit.md's own rule ("With no subagent available, every case is a judgement call", plan:195) makes the run score 0.

## The second pass's Blockers: does draft 3 answer them?

- **The after-apply arithmetic** (readiness B1, design B1, codebase X1): **answered.**
  - With the duty row added, open goes down by N−1 and the total up by 1, and a `map` that exits 1 before applying means apply nothing (plan:210-213).
  - The fixture is built both with and without a duty row (plan:219-221).
  - The numbers match how the code counts: facts.ts:58-71 and index.ts:11-14.
- **Hunk reads, the Node owed against the deny rule, marked paths, the time-out reply, the install sentence and the tests** (readiness B2, design B2, codebase X2): **answered.**
  - owed lists each commit's allowed paths, marked, with the excluded count (plan:150-157).
  - An in-memory flag decides whether the time-out reply names the Node owed (plan:158-166).
  - audit.md uses the handed listing, reads only allowed hunks, and makes a marked path a judgement call (plan:183-188).
  - The two commands that read only the records are exempt by name (plan:211-213).
  - audit's install sentence is given word for word, and the time-out rule is set (plan:215-217).
  - The tests cover a denied path in the context and in the time-out reply (plan:167-170, 224-225).
- **The catch-up offering to resume a session that is still running** (codebase X3): **answered by the cut.**
  - The catch-up is not built (call 4, plan:31; Not built, plan:299), and its row is filed in Task 5 (plan:293).
  - The abrupt-end reason is recorded in call 4.

## Not checked, and risks

- The manifest's `userConfig` keys, such as `title`, are not in the engine types. `claude plugin validate` in the gate is the only check on them.
- The types say `$.prompt.suggest` does not show "while a turn runs" (d.ts:3175, 10080). Whether a call made from `turn.complete` shows is left to the live checks.
- I could not check the name and word searches against the lists in research/raw. Plan line 67 names this repository by name, and the plan is in the branch's diff.
- Local main is at 3641a74, while b14fdcf is origin/main. `housekeeping/phase-3` already exists, cut from b14fdcf, so "cut from main at b14fdcf" is already done.
- I ran no git commands or tests.

Blockers left: 1

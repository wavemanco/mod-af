# housekeeping: backlog

The plugin's own list of pending work: the fixes the final check of Phase 1 put off, and the plans for the next
phases. It is kept in the row format of `FORMAT.md` and read by the plugin's own `check`. A trigger is a step
that has happened, never a date; the milestones are `phase-2`, `phase-3` and `later`. Nothing here names a
repository: the reference repository is the one the plugin was first built from.

## Open

| ID | Item | Milestone | Who | Land now | Trigger | Waits on | Details | Filed |
|---|---|---|---|---|---|---|---|---|
| HK-002 | Phase 3 plan: audit | phase-3 | agent | no: Phase 1 is not merged yet | Phase 1 merged | — | Write the plan for `audit`: reading the commits since the last audit and saying which rows their work closed, opened or moved without the records being kept (DESIGN.md section 3.9). 2026-11-04, from the Phase 2 dry runs: both read each item's open or closed status from prose; on test repository B that was a rule-based reading of status words in whichever cell held them, with five hand overrides, and rows that read partly done stayed open. Such a reading is what the audit checks, so try the audit on one. | 2026-11-04 |
| HK-003 | Phase 3 plan: owed | phase-3 | agent | no: Phase 1 is not merged yet | Phase 1 merged | — | Write the plan for `owed`: the list of standing duties and dated checks that are due, from the duties' triggers and their last-done days (DESIGN.md section 3.9). brief.ts already has a small due test (`dutyDue`, line 15) to reuse. | 2026-11-04 |
| HK-004 | Phase 3 plan: the automatic parts | phase-3 | agent | no: Phase 1 is not merged yet | Phase 1 merged | — | Plan the hooks that run with no command: the end-of-session catch-up that files deferrals and action items found only in the conversation, and the nudges (DESIGN.md section 9, 2026-11-03, filing at session end). Include a live test of automatic compaction: that the short view survives a compaction and is read again after it. A session-end hook has 1.5 seconds, so the catch-up runs at the next start. | 2026-11-04 |
| HK-005 | Phase 3 plan: integration notes for loose-ends, route and decide | phase-3 | agent | no: Phase 1 is not merged yet | Phase 1 merged | — | Write the short notes saying how `loose-ends`, `route` and `decide` work beside housekeeping, with no edits to the three plugins (they must keep working alone; DESIGN.md section 3.10 gives the fallback). Each note says which file the other plugin reads and where housekeeping defers to the project's own records. | 2026-11-04 |
| HK-043 | Long titles render in full in every list | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | template.ts line 149 (`.t`) shows a row's whole title, and the stop buttons repeat it in an aria-label (line 458). Smallest fix: clamp titles to three lines with `line-clamp`, and drop the aria-label on stop buttons so the visible text is read once. | 2026-11-04 |
| HK-044 | Choosing a count marker switches the view far off screen | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | template.ts line 379 (`show`) swaps the view and leaves the scroll and focus where they were. Smallest fix: move the focus to the views region after the switch. | 2026-11-04 |
| HK-045 | Accessibility of the tabs and the drawer is half done | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | template.ts lines 246 and 377 mark the tabs with `role="tab"` and `aria-selected` but give no arrow-key movement, and line 258 sets `aria-modal="true"` without containing the focus. Smallest fix: add an h2 per view, use `aria-pressed` buttons in place of the half tab pattern, and drop `aria-modal` or add focus containment. | 2026-11-04 |
| HK-046 | A single lane leaves two empty tracks | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | template.ts line 122 sets the lanes grid to `auto-fill`, so one lane takes a third of the width. Smallest fix: use `auto-fit`. | 2026-11-04 |
| HK-047 | Picking a commit in Changed since drops keyboard focus | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | template.ts line 529 redraws the whole view on change, so the select is replaced and focus is lost. Smallest fix: refocus the select after the redraw. | 2026-11-04 |
| HK-048 | The local page renders in quirks mode | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | page.ts writes the template with no doctype and no charset line (the template starts with `<title>`), so a browser opening the file from disk guesses both. Smallest fix: put `<!doctype html>` and `<meta charset="utf-8">` at the start of the page. | 2026-11-04 |
| HK-049 | Changed since can skip commits the viewer never saw | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | template.ts line 490 stores the newest sha as seen on every load, including a preview or thumbnail render, so 'last seen' can move past unseen commits. Smallest fix: store it only after a real interaction, or when the page is visible. | 2026-11-04 |
| HK-050 | The fonts link is a network read the page says it does not make | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | template.ts line 6 links Google Fonts, while the comment at the top says the page reads no network. Smallest fix: drop the link and use the system fonts already in the font stack, or change the comment to say what it does read. | 2026-11-04 |
| HK-051 | Some lane tests are near-vacuous | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | tests/lanes.test.ts (from line 16) checks that lanes exist but not the chain values, the cycle counts, `waitingOnRows` or `byHand`. Smallest fix: pin those values on the fixtures. | 2026-11-04 |
| HK-052 | The plugin tests never drive the after-first-run or failure branches | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | tests/plugin.test.ts covers the first publish but not the second run (read, then publish to the stored link), a failed read or a failed publish. Smallest fix: one test for each branch with fake tools. | 2026-11-04 |
| HK-053 | The root README has no housekeeping section | later | agent | no: Phase 1 is not merged yet | Phase 2 done | — | README.md at the root lists the other plugins (the Plugins section, line 7) and not housekeeping. Smallest fix: add a short section pointing to housekeeping/README.md. | 2026-11-04 |
| HK-054 | Test repository A's suite was not run before and after its plan | phase-2 | owner | small choice: run A's suite by hand in a new clone with the plan applied again, or settle it when A's plan is applied for real (HK-058) | The Phase 2 close-out reaches the owner | — | DESIGN.md section 7 asks that A's suite give the same result before and after, on the same machine. In the dry run the session's permission rules refused the suite and the validation command (stop rule 5); the linter and a static stand-in for the docs-scanning test gave the same result before and after (research/phase-2-results.md). The clone was deleted at the close-out, so a new one is needed; the commands and the plan's five commits are in the local raw notes (phase-2-dry-run-A.md, sections 1 and 5). | 2026-11-04 |
| HK-055 | A no-reply address at another domain makes map refuse | phase-3 | both | small choice: allow no-reply addresses at any domain, as DESIGN.md section 3.4 words it, or keep the listed domains and reword section 3.4 | The Phase 2 close-out reaches the owner | — | privacy.ts allows only the example domains and the hosting service's no-reply domain: HK-025 dropped the no-reply local part at any domain, because a personal address so named passed. Test repository B's docket holds two no-reply addresses at its own domain; they stayed off the page only because its index copied no cell that holds them. A middle way: a settings key naming a repository's own no-reply domains (settings keys are the builder's). Default until decided: the listed domains only. | 2026-11-04 |
| HK-056 | The settings can live only at the repository's root | later | both | small choice: let a repository keep its settings at another path the plugin also looks in, or keep the root only, so a repository whose guard fails closed maps the file first | The Phase 2 close-out reaches the owner | — | Test repository B's guard fails closed on a path its path map does not name, and that map is a protocol file, so its plan held `.housekeeping.json` uncommitted (the owner's decision there). The Node command takes `--settings`; the plugin reads only the root. A second place to look changes how every caller finds the settings (stop rule 6). prompts/plan.md step 7 now says what to do meanwhile. | 2026-11-04 |
| HK-057 | A checklist kept apart from the pair cannot gate a milestone | later | both | small choice: let the settings name a checklist in a third file, or keep checklists in the two files only | The Phase 2 close-out reaches the owner | — | Test repository B keeps its launch checklist apart by its own rules, so the blockers on it cannot gate the launch milestone on the page. The page is built from the two files only (DESIGN.md section 3.4), so reading a third file is the owner's choice. | 2026-11-04 |
| HK-058 | Housekeep test repository A for real | later | owner | no: the owner's answers to its plan's 17 questions and 4 decisions | The owner chooses to housekeep test repository A | — | DESIGN.md section 4: applying a dry run's plan is a later step for each repository, with the owner. The plan's seven steps and the stand-in's provisional answers are in the local raw notes (phase-2-dry-run-A.md, section 4 and the appendix). Its decisions include the repository's rule that every correction gets an independent review, owed and not run in the dry run. | 2026-11-04 |
| HK-059 | Housekeep test repository B for real | later | owner | no: the owner's answers to its plan's 15 questions and 5 decisions | The owner chooses to housekeep test repository B | — | DESIGN.md section 4, as HK-058. The plan's seven steps on two branches and the stand-in's provisional answers are in the local raw notes (phase-2-dry-run-B.md, section 4 and the appendix). Its decisions include the second file against the repository's one-backlog rule, a file name other than playbook, and the settings file its guard does not map (HK-056). The agent could not tell which of its rows that read partly done are closed. | 2026-11-04 |

## Done

| ID | Item | Milestone | Landed |
|---|---|---|---|
| HK-006 | Not-doing, Where-we-are and checklist sections are read as pending row tables | phase-2 | 351013c |
| HK-011 | A typo in a nested settings key is ignored | phase-2 | 351013c |
| HK-012 | A settings file with a byte order mark is rejected | phase-2 | 351013c |
| HK-013 | A fence closes on any fence line, whatever its character or length | phase-2 | 351013c |
| HK-014 | An ID repeated in a Waits on cell is counted twice | phase-2 | 351013c |
| HK-016 | On a duplicate ID, lookups keep the last row | phase-2 | 351013c |
| HK-017 | init's default ID pattern matches names like UTF-8, ADR-0003 and SHA-256 | phase-2 | 351013c |
| HK-018 | Open rows vanish with no finding, and a table with a mismatched separator is dropped silently | phase-2 | 351013c |
| HK-019 | The value and filed warnings fire on every row of a table without the optional column | phase-2 | 351013c |
| HK-020 | A future date in where-we-are hides its staleness | phase-2 | 351013c |
| HK-021 | Wrong-typed optional settings fall back silently, and an object values.priority crashes the build | phase-2 | 351013c |
| HK-022 | A backslash path in the settings reads both files as missing on Windows | phase-2 | 351013c |
| HK-007 | A yes row that waits only on closed rows still gets a land-now-yes warning | phase-2 | 34710c3 |
| HK-008 | A milestone on the shared path and on a lane appears twice | phase-2 | 34710c3 |
| HK-009 | When every path is shared there are no lanes and no finding | phase-2 | 34710c3 |
| HK-010 | A duty with a path milestone keeps its station unreached for ever | phase-2 | 34710c3 |
| HK-015 | History follows commits of side branches | phase-2 | 34710c3 |
| HK-023 | Every git failure in the Node command reads as no branch | phase-2 | 5e14b33 |
| HK-024 | The Node command's short view counts duties due as of the head commit's date | phase-2 | 5e14b33 |
| HK-025 | The privacy allow list passes any no-reply local part at any domain | phase-2 | 5e14b33 |
| HK-026 | File paths reach git as pathspecs | phase-2 | 5e14b33 |
| HK-027 | The short view is never privacy-scanned | phase-2 | 5e14b33 |
| HK-028 | A privacy hit in non-row text is not located | phase-2 | 5e14b33 |
| HK-029 | The short view says 'open' when no pane was placed | phase-2 | 302b607 |
| HK-030 | The root is where the session started, not the top of the git tree | phase-2 | 302b607 |
| HK-031 | command.run has no catch around load, the repository key, the tool list or the store | phase-2 | 302b607 |
| HK-032 | A failed publish drops the partition line and the page path | phase-2 | 302b607 |
| HK-033 | The GONE pattern can forget a good link | phase-2 | 302b607 |
| HK-034 | The behind-remote warning can go stale | phase-2 | 302b607 |
| HK-035 | The first prompt of each day pays a full history walk | phase-2 | 302b607 |
| HK-036 | The Artifact publish result's shape rests on one live run | phase-2 | 302b607 |
| HK-037 | A new repository's single path reads 'all reached' | phase-2 | 7ce4b00 |
| HK-038 | The short view prints items in full, so the cap cuts its tail lines | phase-2 | 7ce4b00 |
| HK-039 | The page has no size check | phase-2 | 7ce4b00 |
| HK-040 | On a branch, the short view shows main's state, while DESIGN 3.4 says the branch's | phase-2 | 7ce4b00 |
| HK-041 | The page header never says local main is behind a remote copy | phase-2 | 7ce4b00 |
| HK-042 | DESIGN.md still reads as before on the Write-tool rule and on masking | phase-2 | 7ce4b00 |
| — | Phase 1 (see research/phase-1-results.md) | none | 2026-11-04 |
| HK-001 | Phase 2 plan: survey, plan and init dry runs on test repositories A and B | phase-2 | 9a373d2, 2a2c447 and the close-out (research/phase-2-results.md); init is for new repositories (DESIGN.md section 3.8), so the empty test repository C stood for it |

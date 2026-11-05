# housekeeping research

This is the research behind [`../DESIGN.md`](../DESIGN.md), done between 2026-11-02 and 2026-11-03. Each
file says what was read, what state it was in, what was relevant, and what the design gained from it.

**Repositories are described, never named.** The owner, 2026-11-03: "you can describe the state of these
repos instead of naming them. what was relevant for our work and what did we gain from reading these
repos? that's the important bit not their actual names", and "in fcat this goes for any repo the research
mentions, public or private."

**The raw reports stay local.** They come from the readers, researchers, challengers and checkers. They
name the repositories and cite their files, so they sit in `raw/`, which git ignores and which stays on the
machine where the work was done.

| File | What it covers | What the design took from it |
|---|---|---|
| [reference-repository.md](reference-repository.md) | The repository where the backlog and playbook pair and the Route Map were first built: its definitions, its row format, its generator and page, how well the page answers the owner's four questions, and its own assumptions | The germ: the pair of files, the row roles, computed counts, and the page's starting point. It also showed which assumptions become settings, and that "unblocks" was already computed but not shown |
| [test-repositories.md](test-repositories.md) | Test repository A (one long prose backlog plus neighbouring trackers), B (a multi-register docket, five user paths, a live coordination protocol) and C (empty) | Adopt records in place, keep IDs, respect each repository's own rules, never write coordination files, and keep the privacy rules. It also showed that every repository keeps deferred items with an event that brings them back |
| [questions-the-map-answers.md](questions-the-map-answers.md) | The owner's questions, as asked and as counted in the reference repository's conversation record; the 30-question bank; the three challenges | The nine views, the five fields kept true, filing what is only in chat as a step the plugin runs, and the short brief for agents |
| [prior-art-and-views.md](prior-art-and-views.md) | Tools that keep pending work in files, handover practice from other fields, and views that answer status questions | A computed definition of "ready" and its reverse edge, steps rather than dates, and owner kept apart from doer. It also named the traps: an engine that owns the data, and a tracker that works only if agents remember it |
| [plugin-mechanics.md](plugin-mechanics.md) | What a Claude Code plugin can and cannot do, checked against the plugin API of build 2.1.309 | No HTML in a pane, the 1.5-second limit at session end, steering compression, publishing only with the person present, and the store keyed per repository. It also listed what Phase 0 must settle |
| [existing-plugins.md](existing-plugins.md) | `loose-ends`, `route`, `decide`, `detell` and `dynamics`, and the pattern this repository's plugins share | Integration with no change to the three plugins, detell's "last checked" pattern for duties, and dynamics' pattern for a plugin that builds a page |

Section 11 of the design covers what the checks of its first draft changed.

The Phase 1 completion criteria, each marked pass or fail with its evidence, are in [phase-1-results.md](phase-1-results.md).

The Phase 2 completion criteria, from the dry runs on test repositories A, B and C, each marked pass, fail or
not run with its evidence, and what became of each gap the dry runs found, are in
[phase-2-results.md](phase-2-results.md).

The minors that the adversarial check of Phase 2 parked, and those the build's ledger deferred, each with its
place and whether the fix round settled it, are in [phase-2-check-minors.md](phase-2-check-minors.md).

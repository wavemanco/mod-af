# Phase 1 results

Each completion criterion of `DESIGN.md` section 7, marked pass or fail, with its evidence. The reference
repository is described, never named. Test counts are from the build ledger (124 plugin tests and 8 Node
tests passing at the last build commit). The numbers below come from running the Node command on the
reference repository's files at the commit the local notes record.

| Criterion | Result | Evidence |
|---|---|---|
| Counts match the reference generator | Pass | 391 rows in all = 199 closed + 192 open; open = 2 land now + 21 small choice + 169 not now; 130 open in the backlog, 62 in the playbook. The 192 open IDs are the same as the reference page's. The five rows that unblock most (37, 17, 11, 10, 9) and the five that open most (79, 36, 22, 21, 21) match too. One difference, explained below. |
| A hand check of ten warnings finds at most one not real | Pass, after one fix round | The first run gave 22 `filed` warnings and one where-we-are warning that were not useful there (the reference format allows "before <date>", and its where-we-are paragraph reports work later than its marker date). Two rulings fixed the rules; the re-run gives four checklist-closed warnings (all four hand-checked, all real) and one recommendation. Four warnings checked, none not real. |
| `check` behaves as designed | Pass | Exit 0 on the reference repository, with recommendations; exit 1 on a fixture with a duplicate ID (`id-unique`), on a broken column name, and for a missing settings file; exit 2 for a repository with no main branch. |
| The page is deterministic | Pass | Same input gives the same page in the core tests; the Node command and the plugin give byte-identical pages (compared with `cmp`). The page reads no clock, network, CI or chat. |
| Paths draw correctly | Pass | The made-up repository with three paths shows one lane per path, with shared milestones first on every lane (page tests and the stub-DOM draw test). |
| An empty repository works | Pass | `init` wrote its four files, `check` passed, and `map` wrote a page with no rows and one path (scratch run, plus tests for each step). |
| The short view fits | Pass | 6,601 characters on the reference repository, under the 8,000 limit (about 2,000 tokens); a test pins a huge where-we-are text inside the limit. |
| Privacy holds | Pass | A personal email address planted in a row makes `map` refuse and say where; no-reply and example addresses do not; key shapes are found; the matched text is masked. The code never reads a commit author, so none can appear. |
| The page is ready to show: size | Pass | 679,535 bytes on the reference repository, under 1,000,000. |
| The page is ready to show: the Node command gives the same page | Pass | Byte-identical (see determinism). |
| The page is ready to show: light, dark and phone width | Pass by measurement, pending the owner's live check | Both dark selectors are present and the colours switch; at 1280 and 375 pixels no sideways scroll. The built-in browser timed out on every screenshot, so spacing and type were not seen by eye. The visual check is pending the owner's live check. |

## Not run live

These need a live session with the owner present and are pending the owner's live check:

- the pane and the status line in a real session;
- publishing to an artifact (the first publish is the owner's go-ahead, and the real result and refusal shapes are untested);
- the visual check of the page, as above.

The test kit covers their logic only.

## Differences from the reference generator, explained

- **Closed rows per file.** Here 197 closed in the backlog and 2 in the playbook; the reference gives 191 and 8.
  The reference assigns a Done entry to the playbook by a text rule on the entry; this generator uses the
  entry's ID prefix only. The totals (199 closed) and every open count are the same.
- **The pinned commit.** The reference repository's main has moved on since the recorded commit, so the
  local settings pin the main branch to that commit; against its newer main the counts differ by the
  newer commits' rows.
- **A parser rule found by the run.** A stray separator line inside an open table was read as a row. The
  reference generator skips it; so does this one now (fix and test in the parser).
- **Two warning rulings** (owner to confirm): "filed" accepts "before <date>", and the where-we-are date is
  the latest date its paragraph gives.

## Known limits

The commit author is never read; the settings file always writes `main` as the main branch at `init`; an
ID with several segments (such as `X-VAL-4`) is matched only if the repository's `ids` patterns say so.

# Phase 1 results

Each completion criterion of `DESIGN.md` section 7, marked pass or fail, with its evidence. The reference
repository is described, never named. Test counts: 124 plugin tests and 8 Node tests passed at the last build
commit, and 143 and 12 after the final check's fix wave. The numbers below come from running the Node command on the
reference repository's files at the commit the local notes record.

| Criterion | Result | Evidence |
|---|---|---|
| Counts match the reference generator | Pass | 391 rows in all = 199 closed + 192 open; open = 2 land now + 21 small choice + 169 not now; 130 open in the backlog, 62 in the playbook. The 192 open IDs are the same as the reference page's. The five rows that unblock most (37, 17, 11, 10, 9) and the five that open most (79, 36, 22, 21, 21) match too. One difference, explained below. |
| A hand check of ten warnings finds at most one not real | Pass, after one fix round | The first run gave 22 `filed` warnings and one where-we-are warning that were not useful there (the reference format allows "before <date>", and its where-we-are paragraph reports work later than its marker date). Two rulings fixed the rules; the re-run gives four checklist-closed warnings (all four hand-checked, all real) and one recommendation. Four warnings checked, none not real. |
| `check` behaves as designed | Pass | Exit 0 on the reference repository, with recommendations; exit 1 on a fixture with a duplicate ID (`id-unique`), on a broken column name, and for a missing settings file; exit 2 for a repository with no main branch. |
| The page is deterministic | Pass | Same input gives the same page in the core tests; the Node command and the plugin give byte-identical pages (compared with `cmp`). The page reads no clock, network, CI or chat. |
| Paths draw correctly | Pass | The made-up repository with three paths shows one lane per path, with shared milestones first on every lane (page tests and the stub-DOM draw test). |
| An empty repository works | Pass after the final check's fix wave | The first reading passed because the scratch run committed between the steps. The final check found that the next command failed after `init`: on a machine whose git starts new repositories on `master`, `check` said there was no branch `main`, and files not yet committed read as missing, with no word on committing them (finding 5). Now `init` writes the branch it runs on as `mainBranch` and ends by saying to commit the files there; a missing file reads "<path> is not on <mainBranch>", and the no-branch error names the `mainBranch` setting (init, parse, plugin and Node tests). `init` wrote its four files, `check` passed, and `map` wrote a page with no rows and one path. |
| The short view fits | Pass | 6,601 characters on the reference repository, under the 8,000 limit (about 2,000 tokens); a test pins a huge where-we-are text inside the limit. |
| Privacy holds | Pass after the final check's fix wave | The final check found that the key pattern matched the end of ordinary words, so a commit subject such as `.../task-add-the-export-endpoint` blocked the page for good, with only "the page" named (finding 4). Now, at the owner's choice: a personal email address planted in a row makes `map` refuse and name the row; one in a commit subject is masked in the page (two characters at each end) and the page builds; a hit anywhere else blocks the page and gives the masked text. The key pattern needs a word boundary on its left; the no-reply allow list matches `users.noreply.github.com` exactly, with no "+noreply" local-part rule; example addresses pass; key shapes are found. The code never reads a commit author, so none can appear. |
| The page is ready to show: size | Pass | 680,692 bytes on the reference repository after the final check's fix wave (679,535 before it), under 1,000,000. |
| The page is ready to show: readable at the reference size | Fail at first; pass by measurement after the fix wave, pending the owner's live check | The controller's visual check found the Lanes view about 36,000 px tall, every stop of every station listed and a 4,000-character "where we are" filling the first screen (final check, finding 9). Now each station shows its first 5 stops with "and N more" to open the rest, "where we are" is cut at a word inside 600 characters with "more", and a counts line under the title links each number to its view. Drawn on the stub DOM, the reference page's Lanes view shows 49 of its 223 stops and 591 characters of "where we are" before anything is opened (page tests, plus that draw). Not yet seen in a browser. |
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

The commit author is never read; `init` writes the branch it runs on as the main branch, and `main` only
when git cannot name one (outside a repository, or on a detached HEAD); an ID with several segments (such as `X-VAL-4`) is matched only if the repository's `ids` patterns say so.

# Sources

The articles chosen by the plan's rule on 2026-11-15. Their text is not kept on this branch: each is copyrighted.
The checksums let anyone who fetches the same page confirm it is the one tested. Pages change, so a later fetch
may not match. The text was extracted by `scripts/extract.py` and cleaned by `scripts/clean.py`.

| Id | Outlet | Title | Address | In the feed | Retrieved (UTC) | sha256 of the page | Words | sha256 of the text |
|---|---|---|---|---|---|---|---|---|
| L1 | Noema | A Generation Revolts | https://www.noemamag.com/a-generation-revolts | 2026-11-12 | 2026-11-15 11:39:13Z | `3652b2257b783d0fa8034b52e85c5685fed940bded1112ae43ed8465fe6c1993` | 3088 | `69d119ae3295065a8044fa843d5c427f7d582fb4565b915f2f24961be2e9a17a` |
| L2 | Works in Progress | The forgotten formula for lovable cities | https://worksinprogress.co/issue/the-forgotten-formula-for-lovable-cities/ | 2026-11-03 | 2026-11-15 11:39:14Z | `acba0b5b9b03c74412bfadfacff78562f3199e7de396981a121f72fcdcd82fa1` | 3193 | `c80aa0dbff465d2e505eb33f8271f73aadc79751fab9108500ba62fa85f1fad5` |
| L3 | Asterisk | We Are All Playable Characters | https://asteriskmag.com/issues/16/we-are-all-playable-characters | 2026-11-11 | 2026-11-15 11:39:14Z | `c3e527b64bc2fa934a8467e2932388bf58092aa7c26c7c020135d10bf135f7b5` | 2741 | `d5db9df03b474a07430dc0d3b56e1a66a6fcdbd077c008d5a724de89b6f1d1db` |
| L4 | Quanta Magazine | The Evolving Story of How Chemistry Became Biology | https://www.quantamagazine.org/the-evolving-story-of-how-chemistry-became-biology-20261112/ | 2026-11-12 | 2026-11-15 11:39:15Z | `80e844a897a037ff6ffab07e94b18d9be5abb5549a255eb8f209be51b696ed7a` | 6533 | `c42d6e67d6459687a9b87f596edfd42db9035e591fc03355b27df0a73ae1d9b4` |
| L5 | Hakai Magazine | The First First Responders | https://hakaimagazine.com/features/the-first-first-responders/ | 2024-12-24 | 2026-11-15 11:39:16Z | `6836516ec86828dca67850b2c32baa23c51e1d335a257c0e176bbb69dede3e34` | 4521 | `78883c4377e87b36afb101b3dbde7a1b5e9f2608d8593ae6f1d632c2acf4ca4e` |

## How each was chosen

The newest items first, in each outlet's own feed (Works in Progress: `/rss.xml`; Quanta: `/feed/`, since the
feed its home page names was empty). Skipped, with the reason:
- **Noema:** "Serbia's Experiment: Combining Democracy & Meritocracy" (780 words).
- **Works in Progress:** "How should armies fight?" (809 words) and "Soviet disunion" (1,213 words).
- **Quanta:** "Can Network Science Transform Health and Nutrition?" (a podcast transcript, *The Joy of Why*) and "A
  New Era for the Dawn of Life" (a special issue's landing page, with no article text). The article taken has an
  embedded video, but is an article.
- **Hakai Magazine:** "So Long, and Thanks for All the Fish" (453 words). Hakai stopped publishing at the end of
  2024, so its newest article is from then.

## Departures from the plan

- **Knowable Magazine** answered its home page with 403, so it could not be read. The fifth outlet was taken from
  a reserve list fixed, in alphabetical order, before any of its articles were looked at: Atlas Obscura (403),
  then **Hakai Magazine**, whose robots rules allow access.
- **Cleaning,** by explicit rules in `scripts/clean.py`. Each removed block is a byline or bio, a date line, a
  site prompt, a subscription line or related links:
  - L1: the author's bio before the article.
  - L2: the subscription line and the authors' bios after it.
  - L3: the "Further Reading" links.
  - L4: the date line, a prompt about Google, and everything from "Also in Biology" on. Quanta's editor's note on
    funding is kept, as part of the article.
  - L5: a hidden "Article body copy" label.

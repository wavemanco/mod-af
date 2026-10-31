# jargone trial (2026-10-31): version 0.1.0

The trial in build step 5 of [`SPEC.md`](../SPEC.md). The detailed records quote private documents
and a private working session, so they are kept outside this repository. This file gives the totals.

## How it was judged

A finding is a **true problem** when a separate model, playing the named reader and shown only the
original text, said it would not understand the term (J01, J04), or that the suggested swap fits
(J07). Everything else is a **false alarm**, sorted by kind: a name, a term the reader knows, a
quotation, an identifier, or other.

The judge was a model, not a person. Real readers may differ.

## Documents: the full `/jargone` method, run by the real plugin

Three documents, each rewritten for a named reader, with one review round:
- a 5,000-word project review summary, for a product manager who had never seen the project;
- a 1,100-word handover note, for the project's maintainer, who is not a specialist;
- a 280-word plugin README, for a new contributor.

| Checks | Findings on the originals | True | False alarms |
|---|---|---|---|
| J01 undefined term | 59 | 10 | 49 |
| J04 the opening | 5 | 0 | 5 |
| J07 plainer word | 18 | 5 | 13 |
| **All three** | **82** | **15** | **67 (82%)** |

- **What the word lists missed:** in the two shorter documents, J01 and J04 caught **none** of the 34
  terms the model reader said it would not know. In the long one, they caught about 30 of 108. They
  cannot see capitalised terms, terms used once, or ordinary words used in a special sense.
- **The model reader worked:** in every final rewrite, a fresh cold reader found every key point the
  person confirmed.
- **False alarms made the text worse three times:** the writer moved "plugin for Claude Code" out of
  an opening; spelled out "Application Programming Interface (API)" for a reader who knew it; and
  replaced "set-ups" with "settings", which a reviewer then found used in three senses.
- **Meaning:** no claim was made false outright. Small shifts remained, the largest in a fix made
  after the last review round.
- **Cost:** from 169 s and $0.90 (280 words) to 587 s and $3.81 (5,000 words).

## Sessions: the check on each reply, replayed on real replies

The warn-only check on each reply (J01, J03, J07) was replayed on 95 final replies from one long
working session, for the reader who actually read them, a non-specialist maintainer: 60 replies
from non-coding work (research, planning, writing advice) and 35 from coding work.

| Check | Findings | True | False alarms |
|---|---|---|---|
| J01 undefined term | 232 | 8 | 224 (97%) |
| J03 long sentence | 35 | 18 | 17 (49%) |
| J07 plainer word | 88 | 0 | 88 (100%) |
| **All three** | **355** | **26** | **329 (93%)** |

- **Kinds of false alarm:** terms the reader knows 225, names 60, identifiers 11, quotations 4,
  other 29. Twenty-five terms the reader already used made 169 of them, by recurring reply after
  reply.
- **J07 would have harmed:** 47 of its 88 suggested swaps would change the meaning if acted on.
- **J03's false alarms** were numbered lists of options held to the 20-word limit for steps, and
  sentences joined by mistake.
- **Speed:** about 1.5 ms per reply, after a one-time load of about 175 ms. The check itself costs
  nothing noticeable.
- **`--rewrite`, if on:** "any finding" would have sent back 72 of 95 replies, of which 20 held a true
  problem; "errors only" 68, of which 8. Each send-back is an extra model turn over the whole
  conversation.

## What this says

- The cut-off is not the cause: at 5.5, 5.0 and 4.0 the share of true findings barely moves.
- J01's word-list test is a proxy for "does this reader know this word", and a poor one. The
  conversation, and a model briefed as the reader, are closer to the real thing.
- J03 (long sentences) and J05 (nothing lost) earn their place. J07, as built, does not.

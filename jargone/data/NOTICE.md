# Where jargone's word lists come from

jargone's code is under the MIT licence (see `../LICENSE`). Its word lists are not all ours. Each list
keeps the licence of the source it came from, and this file gives the credit each licence asks for.

The three lists ship together in one generated file, `hooks/data.ts`, because the plugin system loads
code files only. The script `scripts/build_data.py` downloads the sources and builds that file. Do
not edit `hooks/data.ts` by hand: change the script and run it again. The counts, dates and
fingerprints at the end of this file are written by the same script.

| List in `hooks/data.ts` | What jargone uses it for | Licence |
|---|---|---|
| `FAMILIARITY` | J01 and J04: which words are common | CC BY 4.0 |
| `REPLACEMENTS` | J07: a plainer word is available | public domain (CC0 1.0), Open Government Licence v3.0 and MIT, by source |
| `EXCEPTIONS` | J01, J04 and J07: words no check suggests swapping | MIT (jargone's own) |

## 1. Familiarity list

**What it is.** How familiar English words are, from 1 (unknown) to 7 (very familiar). A large
language model (GPT-4) made the estimates. The authors compared them with ratings that people gave,
and report that the estimates closely track those ratings.

- **Authors:** Marc Brysbaert, Gonzalo Martínez and Pedro Reviriego.
- **Title and address:** *AI-generated estimates of English word familiarity*, on the Open Science
  Framework: <https://osf.io/c2yef/>. The file used is the cleaned list, "Cleaned list GPT4 estimates
  familiarity and Multilex frequencies.xlsx" (<https://osf.io/download/bafpv/>). The paper that goes
  with it is *Moving beyond word frequency based on tally counting: AI-generated familiarity estimates
  of words and phrases are an interesting additional index of language knowledge*; the copy on the
  project page says it is to be published in *Behavior Research Methods*.
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0),
  <https://creativecommons.org/licenses/by/4.0/>, as stated on the project page.
- **What we took:** each single word and its value in the column `GPT_Fam_probs`, which the authors
  describe as the more precise familiarity value. The cleaned list leaves out the least familiar
  words; the paper says it keeps those rated above 3.5. So a word that is not on the list should
  count as unfamiliar.
- **What we changed:**
  - kept only rows of type `W` (single words), so no phrases and no hyphenated words;
  - kept only entries made of letters, with apostrophes allowed inside a word ("don't"), so no
    numbers, abbreviations with dots, slashes or underscores;
  - left out forms ending in 's ("abbey's", "it's"), since a checker removes a final 's before it
    looks a word up;
  - lower-cased every word. Where two entries became the same word, we kept the rating of the one
    that was already lower case, or else the higher rating;
  - rounded each rating to one decimal place, so a cut-off applies to the rounded value;
  - removed every other column, including the word-frequency column `Multilex_Zipf`, which comes
    from other sources;
  - sorted the words.
- **Credit (required by the licence):**

  > Word familiarity ratings from *AI-generated estimates of English word familiarity* by Marc
  > Brysbaert, Gonzalo Martínez and Pedro Reviriego (2024), <https://osf.io/c2yef/>, licensed under
  > CC BY 4.0 (<https://creativecommons.org/licenses/by/4.0/>). Changed by jargone: single words only,
  > lower-cased, ratings rounded to one decimal place, other columns removed. The licence's
  > disclaimer of warranties applies. The authors do not endorse jargone.

## 2. Replacement list

**What it is.** Words and phrases that have a plainer replacement, merged from four sources into
one list. Each entry has:

- `from`: the word or phrase, in lower case;
- `to`: the suggested replacements. An item in round brackets is advice, not a word to paste in, and
  "(omit)" means "leave it out". `to` is empty when the source names a word to avoid but gives no
  replacement;
- `source`: every source that lists it;
- `unless`: the source's own "unless" note, if it has one, such as "unless it's for a meeting".

**How the sources were merged.** Entries with the same `from` became one entry. Their replacements
were combined in source order, without repeats, and every source name was kept. Curly quotes were
made straight. A line naming several words ("assist, assistance") became one entry per word. A
few lines needed a change or were left out; the build record at the end lists each one and why.

### US Federal Plain Language Guidelines: "Use simple words and phrases"

- **Publisher:** plainlanguage.gov, a joint effort of the Plain Language Action and Information
  Network (PLAIN) and the US General Services Administration.
- **Address:** the page's source file in the site's public repository, at the commit we built from
  (in the build record). The page was at
  <https://www.plainlanguage.gov/guidelines/words/use-simple-words-phrases/>, which now redirects to
  <https://digital.gov/guides/plain-language>.
- **Licence:** a work of the US Government, in the public domain in the United States, and dedicated
  to the public domain worldwide under CC0 1.0
  (<https://creativecommons.org/publicdomain/zero/1.0/>).
- **What we took:** every row of its "Don't say / Say" table.
- **Credit:** none is required. We give it anyway: *Includes word pairs from the US Federal Plain
  Language Guidelines (plainlanguage.gov), public domain.* As the licence asks, this implies no
  endorsement.

### 18F Content Guide: "Words to avoid"

- **Publisher:** 18F, a team in the US federal government.
- **Address:** the page's source file in the public repository `18F/content-guide`, at the commit we
  built from (in the build record).
- **Licence:** a work of the US federal government, in the public domain in the United States, and
  dedicated to the public domain worldwide under CC0 1.0
  (<https://creativecommons.org/publicdomain/zero/1.0/>).
- **What we took:** every item in its "Words to avoid" list. We did not take the examples of
  figures of speech above that list.
- **What we changed:** the note in brackets after each word became replacements (the words after
  "use"), an `unless` note, or advice in brackets. "Omit" or "leave it out" became "(omit)".
- **Credit:** none is required. We give it anyway: *Includes words from the 18F Content Guide,
  public domain.* This implies no endorsement.

### GOV.UK: "Words to avoid"

- **Publisher:** the Government Digital Service, in the A to Z style guide of the GOV.UK content and
  publishing guidance. © Crown copyright.
- **Address:**
  <https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/#words-to-avoid>
- **Licence:** Open Government Licence v3.0,
  <https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/>.
- **What we took:** both lists in the "Words to avoid" entry: the words to avoid and the
  metaphors to avoid.
- **What we changed:** the words in quotation marks became replacements, and an "(unless …)" note
  became `unless`. "Usually not needed" and "usually superfluous" became "(omit)". Where a line
  gives advice but no replacement, the advice was kept in brackets.
- **Credit (required by the licence):**

  > Contains public sector information licensed under the Open Government Licence v3.0
  > (<https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/>).

### The iso-24495 plugin's word lists

- **Author:** Gareth Williams (`GaZmagik` on GitHub).
- **Address:** <https://github.com/GaZmagik/iso-24495>, the files
  `skills/iso-24495-4/scripts/lib/lexicon.ts` and `skills/iso-24495-4/scripts/audit-corpus.ts`, at
  the commit we built from (in the build record). It is a separate plain-language plugin, named
  after the ISO 24495 standard. jargone takes none of the standard's text from it.
- **Licence:** MIT. Its copyright and permission notice must go with any copy; it is at the end of
  this file.
- **What we took:** three lists: `COMPLEX_WORDS` (formal words with an everyday word), and
  `WORDY_PHRASES` and `DOUBLETS` (phrases with a shorter equivalent).
- **What we did not take:** `COMMON_WORDS`. It was built to tell words in capitals from acronyms, and
  it includes technical terms such as "repo", "config" and "endpoint", which jargone must flag.
  Also `LEGALESE`, a list of legal words with no replacements.
- **What we changed:** each pair became an entry. The two doublets that have no replacement in the
  source were left out (listed in the build record).
- **Credit (required by the licence):** the MIT notice at the end of this file.

## 3. Technical-exceptions list

**What it is.** jargone's own list of words whose plain swap would change a precise meaning in
software, law, medicine, statistics or finance. Examples are "implement", "commit", "significant"
and "liability". No check suggests a swap for these words. J01 may still ask for one to be defined,
if the reader may not know it.

- **Licence:** MIT, like the code. We wrote it.
- **Where it lives:** in `scripts/build_data.py`, with the reason for each word next to it. That is
  the only place to change it.
- **Reference:** we looked at the word list in Google's developer documentation style guide
  (<https://developers.google.com/style/word-list>, CC BY 4.0) to see which words are risky. We
  copied none of its text, so no credit is required. We name it to be open about how the list was
  made.
- **Words from the replacement list:** some words on the replacement list are also on this list,
  because swapping them would damage technical writing ("parameters" → "limits", "delete" →
  "drop"). The build record lists them all.

## Sources we chose not to use

- **The Plain English Campaign's "A to Z of alternative words":** the Campaign owns its copyright
  and does not allow copying without its permission.
- **The iso-24495 plugin's `COMMON_WORDS`:** see above.

## Build record

<!-- build:start -->
Built on 2026-10-31 by `scripts/build_data.py`. This part of the file is written by the script; do not edit it by hand.

| Source | Address | Got | Fingerprint (SHA-256) |
|---|---|---|---|
| AI-generated estimates of English word familiarity (cleaned list) | <https://osf.io/download/bafpv/> | downloaded 2026-10-31 | `cd62d3bc71d71e0ba2751cd8d01ef39ec669b1c12e8f33faf28e5ce8bc30f7ef` |
| Federal Plain Language Guidelines: Use simple words and phrases | <https://raw.githubusercontent.com/GSA/plainlanguage.gov/fd7694740f19c0ed20ed71c2dd1dc92699e920fa/_pages/guidelines/words/use-simple-words-phrases.md> | downloaded 2026-10-31 | `cede672a89387c9041ad755e8b1241ec769388103fe012a2d40abc1cd341c452` |
| 18F Content Guide: Use plain language (Words to avoid) | <https://raw.githubusercontent.com/18F/content-guide/1b1723d3d5b8f91d92c16487c88b56265dc0ec3a/_pages/our-approach/plain-language.md> | downloaded 2026-10-31 | `2388895f77cd73e5fbb8b2965d779b2cad6d9f15e8ed42069e2e8b506be71079` |
| GOV.UK A to Z style guide: Words to avoid | <https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/> | downloaded 2026-10-31 | `3b76a561cf70f8ba9c6742a272118c951bf95b0091f43386c19c87f2d9b7dcc5` |
| iso-24495 plugin: lib/lexicon.ts (COMPLEX_WORDS) | <https://raw.githubusercontent.com/GaZmagik/iso-24495/5951eb7d985018459c62428378926c07f4199794/skills/iso-24495-4/scripts/lib/lexicon.ts> | downloaded 2026-10-31 | `84e7bce47649a8e693893a0fc711b24c9a2a635d27220494d7b943bf1224f7bc` |
| iso-24495 plugin: audit-corpus.ts (WORDY_PHRASES, DOUBLETS) | <https://raw.githubusercontent.com/GaZmagik/iso-24495/5951eb7d985018459c62428378926c07f4199794/skills/iso-24495-4/scripts/audit-corpus.ts> | downloaded 2026-10-31 | `1cb16d94e53421657b2ce741a5773ed5087ad678fa34a637f662ae6fa90c292c` |

**Familiarity list:** 146,892 rows read; 59,366 words kept, rated 3.5 to 7.0; 20,220 of them at 6.0 or above (the default cut-off). Left out: 61,804 phrases, 19,783 hyphenated words, 2,482 entries not made of letters (numbers, abbreviations with dots, slashes, underscores), 3,449 forms ending in 's, and 0 rows of another type. 8 words appeared twice once lower-cased; one of each was kept.

**Replacement list:** 336 entries after merging. Entries read from each source (a line naming several words counts once per word): plainlanguage.gov 237; 18F 44; GOV.UK 41; iso-24495 64. 43 entries are listed by more than one source.

**Technical-exceptions list:** 164 words.

**Replacement-list words made exceptions** (65), because their plain swap would damage technical writing (the reason for each is next to the word in `scripts/build_data.py`): accrue, accurate, address, allocate, appropriate, benefit, capability, commit, component, consolidate, counter, deem, delete, deliver, deploy, disclose, drive, employ, equitable, execute, exhibit, feasible, forfeit, forward, function, hub, impacted, implement, indication, initial, interface, key, leverage, magnitude, maintain, maximum, minimize, minimum, monitor, objective, observe, optimum, option, parameters, permit, practicable, remainder, render, request, require, requirement, robust, selection, subject, sufficient, terminate, terminates, transform, transforming, type, utilization, validate, viable, warrant, witnessed.

**Replacement-list entries this script changed or left out:**

- plainlanguage.gov, "a and/or b": the source writes the pattern with letters; the phrase to find is 'and/or'.
- plainlanguage.gov, "for example,______etc.": a pattern ('for example' used with 'etc.'), not a word or phrase to find.
- plainlanguage.gov, "said, some, such": these are everyday words; the source means them only as legal pointing words ('said contract'), which a word list cannot tell apart from everyday use, and the same table offers 'some' as a replacement for 'a number of'.
- plainlanguage.gov, "not later than 10 May": the source gives two dated examples; the phrase is 'not later than'. Only 'by' is kept: the source's 'before 11 May' moves the date by a day, and 'before' alone with the same date would change the deadline.
- plainlanguage.gov, "not later than 1600": merged with the other 'not later than' example.
- plainlanguage.gov, "/ (slash)": a punctuation mark, not a word or phrase.
- plainlanguage.gov, "is responsible for": the source writes '(omit) handles' as one item; it is two suggestions.
- plainlanguage.gov, "minimize": the source's second suggestion, 'method', looks like a mistake and is left out.
- plainlanguage.gov, "notwithstanding": the source's 'inspite of' is spelled 'in spite of'.
- plainlanguage.gov, "time period": the source's '(either one)' means 'time' or 'period'.
- plainlanguage.gov, "this activity, command": the source means 'this activity' or 'this command'.
- GOV.UK, "commit/pledge, use 'plan to x', or 'we're going to x' where 'x' is a specific verb": the source uses 'x' for a specific verb; written here as '(verb)'.
- GOV.UK, "facilitate, say something specific about how you're helping - for example, use 'run' if talking about a workshop": 'run' is the source's example for one case (a workshop), not a general swap, so the whole advice is kept instead.
- GOV.UK, "going/moving forward, use 'from now on' or 'in the future' (it's unlikely we are giving travel directions)": the source means 'going forward' and 'moving forward'.
- GOV.UK, "hub, portal or one-stop shop, use 'website' or 'service' (unless those words are in the name of the website or service)": three words share one line, and the 'unless' note comes at the end.
- iso-24495, "cease and desist": left out; a legal phrase with no plainer replacement in the source (it only asks the writer to check the phrase suits the reader).
- iso-24495, "terms and conditions": left out; a legal phrase with no plainer replacement in the source (it only asks the writer to check the phrase suits the reader).
<!-- build:end -->

## The iso-24495 MIT notice

```
MIT License

Copyright (c) 2026 Gareth Williams

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

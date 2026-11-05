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
| `REPLACEMENTS` | J07: a plainer word is available. It is the only list of swaps, so any check that offers a plainer word takes it from here | public domain (CC0 1.0), Open Government Licence v3.0 and MIT, by source |
| `EXCEPTIONS` | J01, J04 and J07: words no check suggests swapping. The build also refuses to ship a swap for one of them | MIT (jargone's own) |

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

**What it is.** A short list of formal words and wordy phrases, each with a plainer swap that says
the same thing, such as "utilize" → "use" and "prior to" → "before". The four sources below are
read and merged into one list, and then cut down to jargone's own reviewed allowlist. Only the
entries on the allowlist ship. Each entry has:

- `from`: the word or phrase, in lower case;
- `to`: the swaps J07 offers. Each one is a word or phrase to put in its place: never advice, never
  "(omit)", and never empty;
- `source`: every source that lists it;
- `unless`, on a few entries: when to keep the word anyway, such as "prior" used as a noun. It is
  jargone's own note, or else the source's.

**How the sources were merged.** Entries with the same `from` became one entry. Their replacements
were combined in source order, without repeats, and every source name was kept. Curly quotes were
made straight. A line naming several words ("assist, assistance") became one entry per word. A
few lines needed a change or were left out; the build record at the end lists each one and why.

**How the list was cut.** Version 0.1.0 shipped every merged entry. Its trial
([`../research/trial.md`](../research/trial.md)) found the suggestions right in 5 of 18 cases on
documents and in none of 88 on replies, and 47 of those 88 swaps would have changed the meaning if
acted on. Swaps that cut words ("it is" → "(omit)") broke sentences; swaps that depend on the part
of speech fired on the wrong one, because J07 compares words after removing a plural or verb ending
(the entry "evidenced" → "showed" fired on the noun "evidence"); and some swaps changed a precise
meaning. So J07 is now a hint, and the list keeps an entry only when:

- the swap says the same thing in technical and in everyday prose, in every form J07 matches, with
  the same part of speech;
- each swap is a word or phrase to put in, not advice;
- the swap is plainer or shorter, not only different;
- the trial did not find the entry harmful, and the entry is not on the technical-exceptions list.
  A phrase may still hold a word from that list in its everyday sense: "take into consideration"
  holds "consideration", which is on the list for its legal sense.

Each kept entry keeps only the swaps that pass, chosen from its source's own replacements. The
allowlist and the reason for each entry are in `scripts/build_data.py` (`KEEP`), which stops the
build if an entry breaks one of these rules that code can check. The build record at the end lists
every entry kept, with its reason, and every entry left out, grouped by why.

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
- **What we read:** every row of its "Don't say / Say" table. What ships is only the rows on
  jargone's allowlist (see "How the list was cut").
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
- **What we read:** every item in its "Words to avoid" list. We did not take the examples of
  figures of speech above that list. What ships is only the items on jargone's allowlist.
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
- **What we read:** both lists in the "Words to avoid" entry: the words to avoid and the
  metaphors to avoid. What ships is only the items on jargone's allowlist.
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
- **What we read:** three lists: `COMPLEX_WORDS` (formal words with an everyday word), and
  `WORDY_PHRASES` and `DOUBLETS` (phrases with a shorter equivalent). What ships is only the pairs
  on jargone's allowlist.
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
- **Words from the sources' replacement lists:** some words the four sources offer a swap for are on
  this list, because the swap would damage technical writing ("parameters" → "limits", "delete" →
  "drop"). None of them ships on the replacement list: the build stops if the allowlist names one.
  The build record lists them all.

## Sources we chose not to use

- **The Plain English Campaign's "A to Z of alternative words":** the Campaign owns its copyright
  and does not allow copying without its permission.
- **The iso-24495 plugin's `COMMON_WORDS`:** see above.

## Build record

<!-- build:start -->
Built on 2026-10-31 by `scripts/build_data.py`. This part of the file is written by the script; do not edit it by hand.

| Source | Address | Got | Fingerprint (SHA-256) |
|---|---|---|---|
| AI-generated estimates of English word familiarity (cleaned list) | <https://osf.io/download/bafpv/> | local copy (--familiarity) | `cd62d3bc71d71e0ba2751cd8d01ef39ec669b1c12e8f33faf28e5ce8bc30f7ef` |
| Federal Plain Language Guidelines: Use simple words and phrases | <https://raw.githubusercontent.com/GSA/plainlanguage.gov/fd7694740f19c0ed20ed71c2dd1dc92699e920fa/_pages/guidelines/words/use-simple-words-phrases.md> | local copy (--gsa) | `cede672a89387c9041ad755e8b1241ec769388103fe012a2d40abc1cd341c452` |
| 18F Content Guide: Use plain language (Words to avoid) | <https://raw.githubusercontent.com/18F/content-guide/1b1723d3d5b8f91d92c16487c88b56265dc0ec3a/_pages/our-approach/plain-language.md> | local copy (--eighteen-f) | `2388895f77cd73e5fbb8b2965d779b2cad6d9f15e8ed42069e2e8b506be71079` |
| GOV.UK A to Z style guide: Words to avoid | <https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/> | local copy (--govuk) | `3b76a561cf70f8ba9c6742a272118c951bf95b0091f43386c19c87f2d9b7dcc5` |
| iso-24495 plugin: lib/lexicon.ts (COMPLEX_WORDS) | <https://raw.githubusercontent.com/GaZmagik/iso-24495/5951eb7d985018459c62428378926c07f4199794/skills/iso-24495-4/scripts/lib/lexicon.ts> | local copy (--iso-lexicon) | `84e7bce47649a8e693893a0fc711b24c9a2a635d27220494d7b943bf1224f7bc` |
| iso-24495 plugin: audit-corpus.ts (WORDY_PHRASES, DOUBLETS) | <https://raw.githubusercontent.com/GaZmagik/iso-24495/5951eb7d985018459c62428378926c07f4199794/skills/iso-24495-4/scripts/audit-corpus.ts> | local copy (--iso-audit) | `1cb16d94e53421657b2ce741a5773ed5087ad678fa34a637f662ae6fa90c292c` |

**Familiarity list:** 146,892 rows read; 59,366 words kept, rated 3.5 to 7.0; 20,220 of them at 6.0 or above (the default cut-off). Left out: 61,804 phrases, 19,783 hyphenated words, 2,482 entries not made of letters (numbers, abbreviations with dots, slashes, underscores), 3,449 forms ending in 's, and 0 rows of another type. 8 words appeared twice once lower-cased; one of each was kept.

**Replacement list:** 336 entries after merging. Entries read from each source (a line naming several words counts once per word): plainlanguage.gov 237; 18F 44; GOV.UK 41; iso-24495 64. 43 entries are listed by more than one source. **39 are kept** on J07's allowlist and 297 are left out.

**Technical-exceptions list:** 164 words.

**Kept** (39). The swap is the one J07 offers; it is always among the source's own replacements, and the build stops if it is not.

| Word or phrase | Swap | Listed by | Why it is kept | Keep the word if |
|---|---|---|---|---|
| a large number of | "many" | iso-24495 | means 'many' |  |
| a small number of | "a few" | iso-24495 | means 'a few' |  |
| ascertain | "find out" | plainlanguage.gov, iso-24495 | a formal verb; 'find out' says the same in every form |  |
| at the present time | "now" | plainlanguage.gov | means 'now'; the source's 'at present' is left out as barely shorter |  |
| at this moment in time | "now" | iso-24495 | means 'now' |  |
| at this point in time | "now" | iso-24495 | means 'now' |  |
| commence | "start" or "begin" | plainlanguage.gov, iso-24495 | a formal verb with no technical sense; 'commencement' is another word, which J07 does not match |  |
| due to the fact that | "because" | plainlanguage.gov, iso-24495 | means 'because'; the source's 'due to' and 'since' are left out ('since' can also mean time) |  |
| each and every | "each" | iso-24495 | a doublet; 'each' says the same |  |
| end result | "result" | iso-24495 | a doublet; 'result' says the same |  |
| expedite | "speed up" | plainlanguage.gov, iso-24495 | a formal verb; 'speed up' says the same, including 'expedited' |  |
| expend | "spend" | plainlanguage.gov | a formal verb; 'spend' says the same in every form, of money, time or energy |  |
| for a period of | "for" | plainlanguage.gov | means 'for' before a length of time |  |
| general consensus | "consensus" | iso-24495 | a doublet; a consensus is already general |  |
| has the ability to | "can" | iso-24495 | means 'can' |  |
| in an effort to | "to" | plainlanguage.gov | means 'to' before a verb |  |
| in order that | "so" | plainlanguage.gov | means 'so that'; the source's 'for' is left out because it does not fit |  |
| in order to | "to" | plainlanguage.gov, 18F, GOV.UK, iso-24495 | means 'to' before a verb; the source's '(omit)' is left out. Where 'in order' means 'in sequence' the swap is wrong, so the entry says so | "in order" means "in sequence", as in "apply the changes in order to each copy" |
| in regard to | "about" | plainlanguage.gov | means 'about'; the source's 'concerning' and 'on' are left out |  |
| in spite of the fact that | "although" | iso-24495 | means 'although' |  |
| in the absence of | "without" | iso-24495 | means 'without', in medicine and research too |  |
| in the event that | "if" | iso-24495 | means 'if' before a clause; 'in the event of', which needs a noun after it, is not kept |  |
| in the near future | "soon" | plainlanguage.gov, iso-24495 | means 'soon'; the source's 'shortly' is left out |  |
| is able to | "can" | iso-24495 | means 'can' |  |
| is applicable to | "applies to" | plainlanguage.gov | says the same with one verb |  |
| make a decision | "decide" | iso-24495 | means 'decide' in every form J07 matches |  |
| notwithstanding the fact that | "although" | iso-24495 | means 'although' |  |
| numerous | "many" | plainlanguage.gov | a formal adjective; 'many' says the same |  |
| prior to | "before" | plainlanguage.gov, iso-24495 | means 'before' in every field; where 'prior' is a noun (a Bayesian prior) the swap is wrong, so the entry says so | "prior" is a noun, as in "assign a prior to each weight" |
| pursuant to | "under" | plainlanguage.gov | means 'under' a rule, law or contract; the source's 'per' and 'following' are left out ('following' can also mean 'after') |  |
| repeat again | "repeat" | iso-24495 | a doublet; 'repeat' already means doing it again |  |
| revert back | "revert" | iso-24495 | a doublet; 'revert' already means going back |  |
| subsequent to | "after" | iso-24495 | means 'after' in every field |  |
| take into consideration | "consider" | iso-24495 | means 'consider' in every form J07 matches; 'consideration' here is the everyday sense, not the legal one on the exceptions list |  |
| the majority of | "most" | iso-24495 | means 'most' (more than half), in statistics too |  |
| until such time as | "until" | plainlanguage.gov | means 'until' |  |
| utilise | "use" | GOV.UK, iso-24495 | the British spelling of 'utilize' |  |
| utilize | "use" | plainlanguage.gov, 18F, iso-24495 | 'use' says the same in every form (utilizes, utilized, utilizing); the noun 'utilization' is a separate entry and a technical exception |  |
| with regard to | "about" | iso-24495 | means 'about'; J07 also matches 'with regards to' |  |

**Left out** (297), each in the first group that fits:

- **The trial found it harmful** (23):
  - advance: 'in advance' cannot become 'in improve'.
  - aircraft: 'plane' narrows the meaning: aircraft include helicopters.
  - approximate: the adjective 'approximate' cannot become the adverb 'about'.
  - caveat: a caveat is a condition that limits a claim; 'warning' can change the meaning.
  - combined: J07 matched the verb 'combine', and the swap 'joint' is not a verb.
  - contains: J07 matched inside 'self-contained', and 'self-has' is not English.
  - depart: 'departs from' often means 'differs from' (this departs from the standard), not 'leaves'.
  - ensure: the trial's hit was a quoted title, which a swap would misquote.
  - establish: 'set up' does not mean 'shown' or 'proved'.
  - evidenced: J07 matched the noun 'evidence', and the swap 'showed' is a verb.
  - identical: J07 matched inside 'byte-identical', a fixed term, and two identical files are not 'the same file'.
  - identify: the trial's hit was a quoted title, which a swap would misquote; the swaps also change the sense.
  - it appears: 'it appears' often means 'it occurs' (the word appears twice), not 'it seems'.
  - it is: '(omit)' often cannot be applied: where 'it' refers to something, removing 'it is' breaks the sentence.
  - land: 'land a change' and 'where it lands' cannot become 'get' or 'achieve'.
  - progress: 'in progress' is an idiom, and the noun 'progress' cannot become 'work on'.
  - reflect: 'reflect' often means 'are based on' (the scores reflect last year's data), not 'show' or 'say'.
  - relative to: 'relative to' often means 'compared with' (fast relative to disk), not 'about'.
  - remain: J07 matched 'remaining' and 'remains', which often mean 'left' (the remaining tests), not 'stay'.
  - simple: the swaps are longer, not plainer, and 'simple' can be part of a name.
  - there are: '(omit)' often cannot be applied: removing the words leaves no verb.
  - there is: '(omit)' often cannot be applied: removing the words leaves no verb.
  - touchpoint: the only replacement is advice, not a word.
- **On the technical-exceptions list** (65), because a plain swap would change a precise meaning (the reason for each is next to the word in `scripts/build_data.py`): accrue, accurate, address, allocate, appropriate, benefit, capability, commit, component, consolidate, counter, deem, delete, deliver, deploy, disclose, drive, employ, equitable, execute, exhibit, feasible, forfeit, forward, function, hub, impacted, implement, indication, initial, interface, key, leverage, magnitude, maintain, maximum, minimize, minimum, monitor, objective, observe, optimum, option, parameters, permit, practicable, remainder, render, request, require, requirement, robust, selection, subject, sufficient, terminate, terminates, transform, transforming, type, utilization, validate, viable, warrant, witnessed.
- **Advice or "(omit)" only, or no replacement at all** (17): advancing, be advised, disincentivize, focusing, impactful, in the process of, incentivize, innovative, inter alia, on a regular basis, procure, slimming down, tackling, take action to, the month of, the use of, thought leader.
- **Not on the allowlist** (192): the swap depends on the sense or the part of speech, changes a precise meaning in some field, needs the sentence rebuilt, is not plainer, or is for a word nearly every reader knows. J07 matches other forms of a kept word, so the sources' separate entries for those forms ("commenced", "utilizing") are not needed: a number of, accompany, accomplish, accorded, accordingly, additional, addressees, addressees are requested, adjacent to, advance planning, advantageous, adversely impact on, advise, afford an opportunity, aforementioned, agenda, and/or, anticipate, apparent, appreciable, arrive onboard, as a means of, as prescribed by, assist, assistance, attain, attempt, by means of, close proximity, collaborate, combat, combat environment, combating, commenced, commences, comply with, comprise, concerning, consequently, constitutes, convene, countering, currently, demonstrate, designate, desire, determine, dialogue, discontinue, disincentivise, disseminate, drive out, during the period, effect modifications, elect, eliminate, empower, encounter, endeavor, endeavour, enumerate, equipments, evident, expeditious, expertise, expiration, facilitate, facilitates, failed to, females, finalize, first and foremost, focus, for the purpose of, foster, free gift, frequently, full and complete, furnish, future plans, going forward, has a requirement for, henceforth, herein, heretofore, herewith, however, illegal aliens, illegals, immediately, impact, in a timely manner, in accordance with, in addition, in lieu of, in relation to, in the amount of, in the event of, in view of, in view of the above, inasmuch as, incentivise, inception, incumbent upon, indicate, initiate, interpose no objection, is authorized to, is in consonance with, is responsible for, it is essential, it is possible that, it is requested, liaise, liaison, limited number, methodology, modify, moving forward, necessitate, not later than, notify, notwithstanding, null and void, obligate, one-stop shop, operate, overarching, participate, past history, perform, pertaining to, pledge, portal, portion, possess, preclude, previous, previously, prioritize, proceed, proficiency, promote, promulgate, provide, provide assistance, provided that, provides guidance for, purchase, regarding, relocate, remuneration, represents, reside, retain, ring fencing, set forth in, similar to, simply, slim down, solicit, state-of-the-art, streamline, strengthening, submit, subsequent, subsequently, substantial, successfully complete, tackle, the undersigned, thereafter, therefore, therein, thereof, this activity, this command, time period, timely, transmit, true and correct, under the provisions of, unexpected surprise, user testing, utilising, utilizing, vice, whereas, whereby, with reference to, with the exception of, your office.

**Source lines this script read differently, or left out, while merging** (before the allowlist):

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

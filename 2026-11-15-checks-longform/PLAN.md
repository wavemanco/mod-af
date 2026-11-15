# jargone's checks on general-interest long-form articles (plan, fixed before any article was chosen)

Written 2026-11-15, at the maintainer's request, before any outlet's articles were looked at. The earlier tests
used software documents, software-session replies and US government texts. This one asks how J01, J03, J04 and
J07 do on long-form writing for general readers, the kind people draft or want explained in chat. J05 is left
for later: it needs a rewrite of each article, and its fix (JAR-004) has only just landed. J02 and J06 are not
tested, for the reasons in the design note.

## The articles

**Outlets.** Five that allow automated access by Anthropic's agents in their robots rules, checked on
2026-11-15: Noema, Works in Progress, Asterisk, Quanta Magazine and Knowable Magazine. Left out: Aeon (the
maintainer's note that it refuses LLM access), Scientific American and The Conversation (their robots rules
refuse Anthropic's agents by name), Undark (it refused the robots file itself) and the Guardian (it answered the
robots file with a bot challenge, so its rules could not be read). Terms of use were not read in full.

**The rule for choosing, one article per outlet.** The most recent item in the outlet's own feed (or its home
page's list of new articles, if it has no feed) on the day of fetching that is:
- an article, not a podcast, video or newsletter round-up;
- free to read in full without signing in;
- at least 2,500 words of body text.
If the most recent item fails, the next one is taken, and each skip is recorded with its reason.

**What is kept.** The articles are copyrighted, so their text stays off this branch, as the maintainer asked.
Recorded here: each article's address, retrieval time, the sha256 of the page and of the extracted text, and
its word count. The extracted text is the article's body: its paragraphs, headings and block quotations, with no
captions, bylines, navigation or related links.

**The reader,** the same for every article: "a curious adult with no background in the subject of this
article".

## What runs

- **The checker** at commit feb399c of `claude/jargone-spec`, with default settings. J01, J04 and J07 are as
  they were in the government tests; that commit changed only J05.
- **J01 and J04,** judged as in the follow-up: the reader explains each flagged term in its own words, and a
  checker marks each explanation right, partly right, wrong or none (the follow-up's `prompts/explain.txt` and
  `prompts/verify.txt`). A finding is true when the explanation is not marked right.
- **J07,** judged as in the first government test: does the plainer word fit, keeping the meaning, and would the
  swap change the meaning (the first test's `prompts/findings.txt`, swap items only). A finding is true when the
  swap fits.
- **J03, with no model:** every J03 flag is listed. So is every place the checker ends a sentence right after a
  word of one to four letters starting with a capital, after a single letter, or inside a quotation. Claude
  checks each of those places by hand against the text: a false break, or a real end of a sentence.
- Model calls run as before: one call each, from an empty folder, with no tools and no project instructions,
  with the earlier studies' model named at run time; a failed call is retried once. Only the parsed verdicts and
  the reader's short explanations are kept on this branch, not the prompts, which hold the article text.

## Rules

- **J01 and J04:** each is kept as an optional hint for long-form writing if at least half its findings are true,
  and dropped for long-form otherwise.
- **J07:** kept for long-form only if at least half its swaps fit and no more than 1 in 10 would change the
  meaning.
- **Too few to judge:** a check with fewer than 5 findings across the five articles.
- **J03:** if a false break hides or invents a sentence over the limit, the case is added to JAR-003.
- **Across kinds of text** (the maintainer's rule from the design note): a check that fails on every kind of text
  tested so far is proposed for dropping from jargone altogether; one that passes on some kinds is proposed for
  those kinds only. The maintainer decides.
- These thresholds are the earlier tests' thresholds, set by Claude, not the maintainer, and fixed in this
  commit.

## Limits

- One model reader and one model checker, one call per question.
- One article per outlet. The rule, not Claude, picks them.
- "A curious adult" is one reader; other readers may know more or less.

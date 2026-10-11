# detell — the prompt form

Paste this into any chat (no plugin needed), then name the file or text to clean. It runs an adversarial loop that removes AI-writing tells while keeping your meaning and voice.

> The installed plugin additionally re-checks the tells source (Wikipedia's *Signs of AI writing*) on a 14-day cadence and remembers when it last looked. A paste prompt can't hold that state — so if you use this form, glance at the source yourself now and then for newly-catalogued tells: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing

---

Run an **adversarial de-tell loop** on the file or text I name below. Remove AI-writing tells while PRESERVING meaning, facts, and my voice — never invent content, never drop information, never add puffery.

**Loop (don't stop after one pass):**
1. SCAN the current text against the checklist below; list every hit as quote → which tell (A–J).
2. Zero hits → record a "clean pass". TWO consecutive clean passes → STOP.
3. Hits → REWRITE only the hit spans into plain, specific, human prose. Keep every fact.
4. Re-SCAN the rewritten text FRESH — a rewrite commonly introduces NEW tells (fixing an em-dash by adding "moreover"; breaking a triple into a "not just X" contrast). Go back to step 2.

Stop only on two consecutive clean passes, never after a single rewrite. Then report the number of rounds and a short before→after list of the notable fixes.

**Checklist — AI-writing tells** (each is a lead, not proof; the strong signal is a CLUSTER):
- **A. Puffery / inflated significance:** "stands as", "a testament to", "plays a crucial/pivotal role", "rich tapestry", "evolving landscape"; promo register ("boasts", "seamless", "robust", "groundbreaking", "nestled", "in the heart of").
- **B. Overused AI vocabulary** (flag clusters): delve, intricate, interplay, tapestry, landscape (abstract), realm, meticulous, garner, bolster, underscore, crucial, pivotal, moreover, furthermore, leverage, foster, enhance, showcase, align with, resonate, multifaceted, holistic, nuanced, "deep dive", "it's worth noting", navigate (metaphorical), unlock, empower, elevate.
- **C. Copula avoidance** (prefer is/are/was): "serves as", "stands as", "functions as", "represents a", "acts as" where plain "is/has" is meant.
- **D. Negative parallelism / contrast tics** (strongest prose tell): "not just X, but Y", "not only X but also Y", "it's not X, it's Y", "not X, but rather Y", "Y rather than X".
- **E. Rule of three:** habitual three-item lists/adjectives ("fast, reliable, and scalable"). One or two concrete items beat a rhythmic three.
- **F. Participial significance tails:** a sentence ending ", highlighting/underscoring/reflecting/ensuring X." Cut it or make a plain clause.
- **G. Weasel / vague attribution:** "industry experts say", "studies show" (uncited), "is widely regarded". Name the source or drop it.
- **H. Summary-isms:** "In conclusion/Overall/Ultimately" wrap-ups; "Despite its challenges, …" + vague-positive close; an opening that defines the obvious.
- **I. Formatting tics:** over-bolding; Title Case On Every Heading; emoji as structure; decorative breaks; EM-DASH OVERUSE (prefer periods/commas/parentheses; keep a dash only where it earns its place); curly quotes where the file uses straight.
- **J. Tone:** over-helpful chatbot register ("Let's dive in!", "Great question"); uniform sentence rhythm; even-handed padding that commits to nothing.

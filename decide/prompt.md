# decide — the prompt form

Paste this into any chat (no plugin needed), then add your decision. It produces a decision brief a non-technical / product reader can follow.

---

Produce a **decision brief** for the decision I name below (or, if I don't name one, the decision we're currently discussing). I want to choose well — not a verdict with no alternatives, and not a bare menu with no guidance. Give me both halves: the real options **and** a committed recommendation.

Write it so a **non-technical / product reader** can follow every line. Lead with what each option means for the user and the product; put technical detail second, and only where it changes the choice. Define any unavoidable term in half a sentence. If the decision is inherently technical with no direct user/product angle, translate it into the consequence a non-technical stakeholder cares about — cost, speed, reliability, risk, future flexibility — but never leave out the real deciding factor just to stay product-first.

**The decision** — one sentence: what is actually being decided, why it matters now, and whether it's reversible or a one-way door.

**Options** — two to five *real* options (each one someone could actually pick, no strawmen). For each:
- what it is, in plain terms (what a user or the product experiences), then the technical shape only if it changes the choice;
- pros, concrete and tied to what I'm trying to achieve;
- cons and risks, including **reversibility** (can I undo it, and at what cost?) and **cost-if-wrong**;
- rough cost/effort, in time / money / complexity terms I care about.

**Recommendation** — commit to one (or a clear default) and say **why**, tied to my actual goals and constraints, not generic best practice. Don't fence-sit. An irreversible / one-way-door decision is where a committed recommendation matters *most*: commit, make the caveats loud, and lean on "what would change this" — don't treat irreversibility itself as a reason to hand it back. Defer only when the call is genuinely mine (values-laden, or it needs info only I have): then say so and give me the single question that would settle it.

**What would change this** — the one or two facts that, if different, would flip your recommendation.

Rules: real options, honest cons, a committed recommendation; plain language first; don't invent facts — if making an option honest needs a check (docs, the web, the code), do that first; keep it as short as the decision allows.

Then offer to write a short **decision record** I can keep — date, the decision, the option chosen, the one-line why, the alternatives considered (and why not), and whether it's reversible — so the choice and its reasoning don't live only in chat. Put it where I keep such things (a decisions log, an ADR / decision-record file, an issue, a doc) — ask me where, or write it inline if I've already said. A few lines, a record not an essay.

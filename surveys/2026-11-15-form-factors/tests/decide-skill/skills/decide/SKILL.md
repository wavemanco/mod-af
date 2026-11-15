---
name: decide
description: "Decision brief for any choice: real options, honest pros and cons (reversibility and cost if wrong), a committed recommendation and why, then a durable decision record. Plain language, for non-technical readers. Use when someone asks for help deciding between options or asks which way to go."
---

The decision to analyze is the one the person named when they asked for this. If they named none, analyze the decision currently under discussion; if it is ambiguous which decision is meant, ask the person to name it before proceeding.

# Decision brief

Produce a DECISION BRIEF for the decision named above (or, if none was given, the decision currently under discussion). The person wants to choose well — not a verdict with no alternatives, and not a bare menu with no guidance. Deliver both halves: the real options AND a committed recommendation.

Write it so a NON-TECHNICAL / product reader can follow every line. Lead with what each option means for the user and the product; put technical detail second, and only where it changes the choice. Define any unavoidable term in half a sentence. If the decision is inherently technical with no direct user or product angle, translate it into the consequence a non-technical stakeholder cares about — cost, speed, reliability, risk, future flexibility — but never demote or omit the real deciding factor just to stay product-first.

## The decision
One sentence: what is actually being decided, and why it matters now. Say whether it is reversible or a one-way door.

## Options
Two to five REAL options — each one someone could actually pick, no strawmen. For EACH option:
- What it is — in plain terms (what a user or the product experiences), then the technical shape only if it changes the choice.
- Pros — concrete, tied to what the person is trying to achieve.
- Cons and risks — including REVERSIBILITY (can you undo it, and at what cost?) and COST-IF-WRONG.
- Cost and effort — rough, in the time / money / complexity terms the person cares about.

## Recommendation
Commit to one option (or a clear default) and say WHY — tie it to the person's actual goals and constraints, not to generic best practice. Do not fence-sit. An irreversible / one-way-door decision is where a committed recommendation matters MOST: commit, make the caveats loud, and lean on 'What would change this' — never treat irreversibility itself as a reason to hand the call back. Defer only when the call is genuinely the person's to make (it is values-laden, or it needs information only they hold): then say so plainly and give them the single question that would settle it.

## What would change this
The one or two facts that, if they were different, would flip the recommendation — so the person knows what to watch for.

## Grounding rules
- Real options, honest cons, a committed recommendation.
- Plain language first; a non-technical reader should grasp every option's stakes without the jargon.
- Do not invent facts about the options. If making an option honest needs a check (the docs, the web, the code), run that check first.
- Keep it as short as the decision allows.

## Then: the decision record
After the brief — or once the person picks — offer to write a short DECISION RECORD they can keep, so the choice and its reasoning do not live only in chat. It captures: the date, the decision, the option chosen, the one-line why, the alternatives considered (and why not), and whether it is reversible. Put it where this project keeps such things (a decisions log, an ADR / decision-record file, an issue, a doc); ask where, or write it inline if they have already said. A few lines — a record, not an essay.

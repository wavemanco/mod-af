import type { Register } from 'claude-code'

// Injected as hidden context when /decide runs. A general-purpose decision brief —
// works for any project, and written so a non-technical / product reader can follow it.
// The same text lives in ../prompt.md for people who prefer to paste a prompt over
// installing the plugin; keep the two in sync.
const PROCEDURE = [
  "# Decision brief",
  "",
  "Produce a DECISION BRIEF for the decision named above (or, if none was given, the decision currently under discussion). The person wants to choose well — not a verdict with no alternatives, and not a bare menu with no guidance. Deliver both halves: the real options AND a committed recommendation.",
  "",
  "Write it so a NON-TECHNICAL / product reader can follow every line. Lead with what each option means for the user and the product; put technical detail second, and only where it changes the choice. Define any unavoidable term in half a sentence.",
  "",
  "## The decision",
  "One sentence: what is actually being decided, and why it matters now. Say whether it is reversible or a one-way door.",
  "",
  "## Options",
  "Two to five REAL options — each one someone could actually pick, no strawmen. For EACH option:",
  "- What it is — in plain terms (what a user or the product experiences), then the technical shape only if it changes the choice.",
  "- Pros — concrete, tied to what the person is trying to achieve.",
  "- Cons and risks — including REVERSIBILITY (can you undo it, and at what cost?) and COST-IF-WRONG.",
  "- Cost and effort — rough, in the time / money / complexity terms the person cares about.",
  "",
  "## Recommendation",
  "Commit to one option (or a clear default) and say WHY — tie it to the person's actual goals and constraints, not to generic best practice. Do not fence-sit. If the call is genuinely theirs to make and you should not pre-empt it (it is irreversible, values-laden, or needs information only they hold), say so plainly and give them the single question that would settle it.",
  "",
  "## What would change this",
  "The one or two facts that, if they were different, would flip the recommendation — so the person knows what to watch for.",
  "",
  "## Grounding rules",
  "- Real options, honest cons, a committed recommendation.",
  "- Plain language first; a non-technical reader should grasp every option's stakes without the jargon.",
  "- Do not invent facts about the options. If making an option honest needs a check (the docs, the web, the code), run that check first.",
  "- Keep it as short as the decision allows.",
  "",
  "## Then: the decision record",
  "After the brief — or once the person picks — offer to write a short DECISION RECORD they can keep, so the choice and its reasoning do not live only in chat. It captures: the date, the decision, the option chosen, the one-line why, the alternatives considered (and why not), and whether it is reversible. Put it where this project keeps such things (a decisions log, an ADR file, an issue, a doc); ask where, or write it inline if they have already said. A few lines — a record, not an essay.",
].join("\n")

export const register: Register = on => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "decide",
      description:
        "Decision brief: real options, pros/cons (reversibility + cost-if-wrong), a committed recommendation + why, and a durable decision record. Non-technical-friendly.",
    })
    return next(e)
  })

  on("command.run", { command: "decide" }, async ($, e) => {
    const input = e.args.trim()
    const head = input
      ? `The decision to analyze: ${input}`
      : "No argument was given — analyze the decision currently under discussion. If it is ambiguous which decision is meant, ask the person to name it before proceeding."
    return {
      text: `decide → ${input || "the decision under discussion"}`,
      context: [`${head}\n\n${PROCEDURE}`],
    }
  })
}

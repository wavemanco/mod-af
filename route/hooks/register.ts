import type { Register } from 'claude-code'

// Injected as hidden context when /route runs. General-purpose — works for any project.
// The same text lives in ../prompt.md for people who prefer to paste a prompt; keep the
// two in sync.
const PROCEDURE = [
  "# Route to a milestone",
  "",
  "Answer, on grounded footing: what is ACTUALLY left between the current state and the milestone named above (or, if none was given, the milestone currently in focus) — and the fastest real path to it. No vague 'almost there'; name the real gate plainly.",
  "",
  "First GROUND yourself: read whatever actually holds the state here — the code, a tracker, the open work, docs, files, notes, the plan — before answering. Do not answer from impression. If the usual sources are absent, or you cannot determine the current state, say what you would need to check rather than guessing.",
  "",
  "## The milestone",
  "One sentence: what 'done' concretely means here — the condition that, once true, means it is reached.",
  "",
  "## What's actually left",
  "List every open item between here and the milestone. For each:",
  "- what it is, in one line;",
  "- HARD BLOCKER (the milestone genuinely cannot happen without it) vs NICE-TO-HAVE (it improves the result but does not gate it). Be strict — most things people list are not actually blockers;",
  "- DECISION (someone must choose) or WORK (someone must build or do it), and who owns it;",
  "- if it is a decision, note that the decision itself may imply downstream work, and name that work — a decision is rarely done the instant it is made.",
  "",
  "## The real gate",
  "Name the single thing — or the smallest set — that genuinely gates the milestone right now. This is the honest 'the only thing actually in the way is ___'. If the thing people associate with this milestone is really the gate of a LATER, bigger milestone, say so and separate the two.",
  "",
  "## Critical path (only when more than one hard blocker remains)",
  "First state the dependencies between the hard blockers (X cannot start until Y is done). Then trace the LONGEST chain through those dependencies — that chain, not a sorted list, is the critical path, and its length is the real time-to-milestone. List the items NOT on that chain as parallel / slack (they do not extend the timeline). If one item dominates the chain, name it as the long pole.",
  "",
  "## Rules",
  "- Strict about hard-blocker vs nice-to-have; a short honest list beats a long hedged one.",
  "- Ground every claim in the real state, not impression.",
  "- Name the real gate plainly — the person asked precisely because they do not want 'almost there'.",
  "- Do not pad the critical path with work that can run in parallel.",
].join("\n")

export const register: Register = on => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "route",
      description:
        "Route to a milestone: what's actually left, the real gate named plainly, hard-blockers vs nice-to-haves, and the critical path when several things remain.",
    })
    return next(e)
  })

  on("command.run", { command: "route" }, async ($, e) => {
    const input = e.args.trim()
    const head = input
      ? `The milestone to route to: ${input}`
      : "No argument was given — route to the milestone currently in focus. If it is ambiguous which milestone is meant, ask the person to name it before proceeding."
    return {
      text: `route → ${input || "the milestone in focus"}`,
      context: [`${head}\n\n${PROCEDURE}`],
    }
  })
}

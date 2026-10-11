import type { Register } from 'claude-code'

// Injected as hidden context when /loose-ends runs. General-purpose — works for any
// project. The same text lives in ../prompt.md for people who prefer to paste a prompt;
// keep the two in sync.
const PROCEDURE = [
  "# Loose-ends audit",
  "",
  "Scan THIS conversation (and any work done in it) for anything that exists ONLY here and would be lost when the conversation ends: decisions made, ideas worth keeping, commitments and promised follow-ups, bugs or risks noticed in passing, TODOs, and things deferred 'for later'. The goal is that nothing important dies in the transcript.",
  "",
  "Sort every item you find into exactly one of three buckets:",
  "",
  "- IMPLEMENT NOW — small and in-scope enough to just do. Name it, and offer to do it.",
  "- FILE IT — worth keeping, but not now. Give three things:",
  "    1. a one-line description;",
  "    2. a HOME — where it should be recorded: an issue, a task, a backlog, a decisions log, a doc, an ADR (decision-record file), or a code comment, whatever this project already uses;",
  "    3. a TRIGGER — the event or condition that should bring it back. Make it concrete ('next time X is touched', 'before the next release', 'when Y lands'), never a vague 'later'. If an item genuinely has no concrete trigger (a 'someday' idea), say so and file it to a backlog reviewed on a cadence — per release, per sprint — rather than inventing a trigger.",
  "- DROP — it was raised but decided against, or it is now obsolete. Note it in one line so it is not re-litigated.",
  "",
  "Then present the findings grouped under those three headings, most important first.",
  "",
  "## Rules",
  "- Only surface what is genuinely in the conversation. Do not invent work.",
  "- Be honest about uncertainty — flag anything you are not sure belongs.",
  "- If the project has an obvious place for deferred work (an issue tracker, a backlog file, a decisions log), name it as the home; if it has none, say so and suggest one.",
  "- After the list, offer to file the FILE-IT items where they belong and to do the IMPLEMENT-NOW ones.",
].join("\n")

export const register: Register = on => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "loose-ends",
      description:
        "Find everything that exists only in this conversation and should be implemented now or filed with a concrete trigger — so nothing important dies in the transcript.",
    })
    return next(e)
  })

  on("command.run", { command: "loose-ends" }, async ($, e) => {
    const input = e.args.trim()
    const focus = input ? `\n\nFocus especially on: ${input}` : ""
    return {
      text: `loose-ends${input ? ` → focus: ${input}` : ""}`,
      context: [PROCEDURE + focus],
    }
  })
}

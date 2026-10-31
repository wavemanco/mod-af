// jargone's $.state contract: the values it keeps for one session. Only jargone writes them.

/** Session mode, as `/jargone-voice on for <reader> [--rewrite] [--ste-inspired]` set it. On means `on` and a non-empty `text`. */
export type JargoneVoice = {
  /** Whether session mode is on. */
  on: boolean
  /** The named reader, as typed after "for" (spaces collapsed); "" while off. */
  reader: string
  /** `--rewrite`: when a reply fails the check, ask the model once to rewrite it. */
  rewrite: boolean
  /** `--ste-inspired`: add the ASD-STE100-inspired style line to the standing instruction. */
  ste: boolean
  /** The standing instruction, built from prompt.md when session mode was turned on; "" while off. */
  text: string
}

/** What registration returned at the session's start: the names the engine gave, not the names asked for. */
export type JargoneRegistered = {
  /** The check tool as the model calls it (`mcp__jargone__check`), or null when it did not register. */
  tool: string | null
  /** The reviewer agent types that registered (`jargone:accuracy-reviewer`, `jargone:cold-reader`). */
  agents: string[]
}

/** A glossary as the checker reads it (.jargone/glossary.json, defaults filled in). */
export type JargoneGlossary = { known: string[]; same: string[][]; max_words: number; max_words_in_steps: number; cutoff: number }

/** The glossary the check on each reply uses, with the stamp (path, kind, time and size) it was read at. */
export type JargoneReplyGlossary = {
  /** `<path>|<kind>:<time>:<size>` of what was at the path when it was read; "" when nothing was there. */
  stamp: string
  glossary: JargoneGlossary
  /** What is wrong with it, or why it could not be read (then followed by when it is tried again). */
  notes: string[]
}

declare module 'claude-code' {
  interface PluginState {
    jargone: {
      voice: JargoneVoice
      /** True from `/jargone-voice on` until the first system prompt sent after it has been read for other instructions. */
      noticeDue: boolean
      registered: JargoneRegistered
      replyGlossary: JargoneReplyGlossary
    }
  }
}

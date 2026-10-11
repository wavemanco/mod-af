import type { Register } from 'claude-code'

// The evolving source of truth for AI-writing tells. Wikipedia updates this page as
// new tells are discovered, so the mod re-checks it on a preset cadence (not every run).
const SOURCE_URL = 'https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing'
const INTERVAL_DAYS = 14 // how stale the tells list may get before /detell prompts a refresh
const DAY_MS = 86_400_000

// Seeded into $.store on first load; replaced durably by /detell-refresh when the source changes.
const SEED_CHECKLIST = `AI-writing tells — adversarial checklist (each is a lead, not proof; the strong signal is a CLUSTER).
A. Puffery / inflated significance: "stands as", "serves as", "a testament to", "plays a crucial/pivotal/vital role", "underscores", "rich tapestry", "evolving landscape", "leaves an indelible mark"; generic praise standing in for a concrete fact; promo register ("boasts", "vibrant", "seamless", "robust", "groundbreaking", "nestled", "in the heart of", "diverse array").
B. Overused AI vocabulary (flag clusters, prefer plainer words): delve, intricate, interplay, tapestry, landscape (abstract), realm, meticulous, garner, bolster, underscore, crucial, pivotal, additionally (esp. sentence-initial), moreover, furthermore, leverage, foster, enhance, highlight, showcase, align with, resonate, multifaceted, holistic, nuanced, "deep dive", "in today's world", "it's worth noting", navigate (metaphorical), unlock, empower, elevate.
C. Copula avoidance (prefer is/are/was): "serves as", "stands as", "functions as", "operates as", "represents a", "acts as", "boasts/features/offers a" where plain "is/has" is meant.
D. Negative parallelism / contrast tics (strongest prose tell): "not just X, but Y", "not only X but also Y", "it's not X, it's Y", "not X, but rather Y", "Y rather than X", "no gimmicks, no fluff, just …".
E. Rule of three: habitual three-item lists/adjectives ("fast, reliable, and scalable"; "it informs, educates, and inspires"). One or two concrete items beat a rhythmic three.
F. Participial significance tails: a sentence ending "…, highlighting/underscoring/reflecting/ensuring/fostering/contributing to X." Cut or make a plain clause.
G. Weasel / vague attribution: "industry experts say", "observers note", "many argue", "studies show" (uncited), "is widely regarded". Name the source or drop it.
H. Summary-isms / structure: "In conclusion/summary/Overall/Ultimately" wrap-ups; "Despite its challenges, …" + vague-positive close; opening that defines the obvious ("X refers to …"); a section that exists only to editorialize significance.
I. Formatting tics: over-bolding; Title Case On Every Heading; bullets where prose is natural; emoji as structure; decorative "* * *" breaks; EM-DASH OVERUSE (the signature tell — prefer periods/commas/parentheses, keep a dash only where it earns its place); auto curly quotes where the file uses straight.
J. Tone: over-helpful chatbot register ("Let's dive in!", "Great question", "I hope this helps"); uniform sentence rhythm (every sentence 8–20 words, same shape); even-handed padding that commits to nothing.`

function isoDay(ms: number): string {
  try { return new Date(ms).toISOString().slice(0, 10) } catch { return String(ms) }
}

function procedure(target: string, checklist: string, freshnessNote: string): string {
  const where = target ? `the file \`${target}\`` : 'the draft text currently in focus (if it is ambiguous which file, ask before editing)'
  return [
    `# De-tell: adversarial AI-tell removal`,
    ``,
    `## Source freshness`,
    freshnessNote,
    ``,
    `## Task`,
    `Run the ADVERSARIAL de-tell LOOP on ${where}. Remove AI-writing tells while PRESERVING meaning, facts, and the author's voice — never invent content, never drop information, never add puffery.`,
    ``,
    `## Loop (do not stop after one pass)`,
    `1. SCAN the current text against the checklist below; list every hit as line/quote → which tell (A–J).`,
    `2. Zero hits → record a "clean pass". TWO consecutive clean passes → STOP; the text is done.`,
    `3. Hits → REWRITE only the hit spans into plain, specific, human prose. Keep every fact.`,
    `4. Re-SCAN the REWRITTEN text FRESH — a rewrite commonly introduces NEW tells (fixing an em-dash by adding "moreover"; breaking a triple into a "not just X" contrast). Go to step 2.`,
    `Stop only on consecutive clean passes, never after a single rewrite.`,
    ``,
    `## Report when done`,
    `The number of loop rounds, and a short before→after list of the notable fixes.`,
    ``,
    `## Checklist`,
    checklist,
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'detell',
      description: 'Adversarially strip AI-writing tells from a file, looping until a clean pass; re-checks the tells source periodically.',
    })
    await $.command.register({
      name: 'detell-refresh',
      description: 'Persist a re-distilled AI-tells checklist from a file (the model calls this after re-fetching the source).',
    })
    // Seed the checklist + a "never checked" stamp on first load, only if unset (survives hot reload via $.store).
    const existing = await $.store.get('checklist')
    if (typeof existing !== 'string' || existing.trim().length === 0) {
      await $.store.set('checklist', SEED_CHECKLIST)
      await $.store.set('lastCheckedMs', 0)
    }
    return next(e)
  })

  on('command.run', { command: 'detell' }, async ($, e) => {
    const target = e.args.trim()
    const stored = await $.store.get('checklist')
    const checklist = typeof stored === 'string' && stored.trim() ? stored : SEED_CHECKLIST
    const lastMs = Number(await $.store.get('lastCheckedMs')) || 0
    const now = await $.clock.now()
    const due = lastMs === 0 || now - lastMs >= INTERVAL_DAYS * DAY_MS
    const last = lastMs === 0 ? 'never' : isoDay(lastMs)

    const freshnessNote = due
      ? [
          `The AI-tells source may be STALE (last checked: ${last}; refresh cadence: ${INTERVAL_DAYS} days). BEFORE de-telling:`,
          `  1. WebFetch ${SOURCE_URL}.`,
          `  2. Re-distill the current tells into the same A–J shape as the checklist below.`,
          `  3. Write the re-distilled checklist to a temp file and run \`/detell-refresh <that-file>\` — it stores the new checklist and stamps today as the last-checked date (durably, across sessions).`,
          `  4. Then de-tell using the refreshed checklist.`,
          `If the fetch fails, proceed with the checklist below and say the refresh is still pending.`,
        ].join('\n')
      : `The AI-tells source is current (last checked ${last}; next refresh due after ~${INTERVAL_DAYS} days). Use the checklist below as-is; no re-fetch needed.`

    return {
      text: `detell → ${target || 'draft in focus'} (${due ? 'source refresh due' : 'source current'}).`,
      context: [procedure(target, checklist, freshnessNote)],
    }
  })

  on('command.run', { command: 'detell-refresh' }, async ($, e) => {
    const path = e.args.trim()
    if (!path) return { text: 'detell-refresh: pass the path of a file holding the re-distilled checklist.' }
    let text: string
    try {
      text = await $.fs.read(path)
    } catch {
      return { text: `detell-refresh: could not read ${path}.` }
    }
    if (!text.trim()) return { text: `detell-refresh: ${path} is empty — checklist unchanged.` }
    await $.store.set('checklist', text)
    const now = await $.clock.now()
    await $.store.set('lastCheckedMs', now)
    return { text: `detell-refresh: checklist updated from ${path}; last-checked stamped ${isoDay(now)}.` }
  })
}

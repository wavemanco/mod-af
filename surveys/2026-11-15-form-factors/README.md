# Survey: where mod-af's plugins work across Claude (2026-11-15)

Which of mod-af's six plugins (decide, detell, dynamics, housekeeping, loose-ends, route) run on which Claude
surface: Claude Code on a computer (terminal, the desktop app's Code tab, VS Code, JetBrains), Claude Code on the
web, Cowork, and claude.ai chat on the web, desktop and mobile. Requested by the maintainer after jargone was
deferred.

- `survey.html`: the survey, also published as a private claude.ai page.
- `research.json`: what each surface supports, as two research agents found it in Anthropic's documentation on
  2026-11-15, with the page that says so for each claim, and the questions the docs leave open. The key rows were
  checked again by hand against the plugin platform-support page and the cloud-environments page.

The per-plugin facts (what each is built from, and how far each `prompt.md` has drifted from its plugin) come from
this repository's main branch at the time. The "after" column is a proposal from the docs, not a test result.

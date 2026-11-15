# Tests of the plan

The survey proposes changing how mod-af's plugins are built so they work beyond Claude Code. Before
anything changes on main, the parts of that plan that can be tried in one Claude Code cloud session were
tried here, by one agent, on 15 November 2026: Claude Code 2.1.325, Node 22.23, git 2.43. The model
was named at run time and is not written down here. The survey page's "Plan and tests" tab holds the plan
and these results.

| Folder | What it is |
|---|---|
| `decide-skill/` | decide rebuilt as one standard skill, with no mod. `skills/decide/SKILL.md` holds the opening line and the procedure from `decide/hooks/register.ts` on main. `prompt.md` is generated from it. |
| `tools/prompt-md.mjs` | Writes a plugin's `prompt.md` from its skill file. With `--check` it writes nothing and exits 1 when the copy differs. |
| `dynamics-standalone/run.ts` | Runs dynamics' checker and renderer from main as a plain Node script on the plugin's worked example, with no plugin loaded. |
| `runs/` | Each Claude Code run: the prompt, the tool calls, the cost and the reply. Paths, session IDs and model names are left out. |

## How to repeat them

From the repository's top folder:

```
claude -p --plugin-dir surveys/2026-11-15-form-factors/tests/decide-skill "/decide <question>"
node surveys/2026-11-15-form-factors/tests/tools/prompt-md.mjs --check surveys/2026-11-15-form-factors/tests/decide-skill
node surveys/2026-11-15-form-factors/tests/dynamics-standalone/run.ts page.html
node housekeeping/cli.ts survey --repo .
node --test housekeeping/node-tests/cli.spec.ts
```

The runs were made from an empty folder, so the skill had no repository to read.

## Results

- **decide as a skill.** It loaded and ran from `/decide:decide` and from `/decide`. Both gave the full
  brief: The decision, Options, Recommendation, What would change this. Asked "Help me decide: should our
  team move its weekly planning meeting…", Claude called the skill on its own. Asked an opinion question
  ending "Keep it short.", it answered directly and did not use the skill. Each run cost $0.13 to $0.18.
- **The description must be quoted.** Unquoted, it holds ": ", and a strict YAML parser stops with a
  ScannerError. Quoted, it parses.
- **The plugin validates.** The stricter profile used for Anthropic's plugin directory asks only for an
  icon.
- **The drift guard works.** `--check` passes on a fresh copy and exits 1 after a hand edit of
  `prompt.md` or after an edit of the skill file. It passes again once the copy is regenerated. It exits 2
  on a plugin that has no `skills/` folder yet, such as route on main.
- **Found and fixed in the guard.** At first it took the plugin's name from the folder. In a folder named
  `decide-skill` it wrote the wrong title and failed. It now reads the name from
  `.claude-plugin/plugin.json`.
- **dynamics without the plugin.** Its checker and renderer import nothing from the plugin platform.
  On the worked example the check passed, found 7 loops, and rendered a 54,250-byte page titled "Job Runner
  Dynamics". A one-file JavaScript build of the same code, made with bun, gave a byte-identical page.
- **housekeeping's command-line tool in a cloud session.** `survey` needs no settings: it read 115 files
  and listed 7 candidates. `map`, `check` and `brief` stop on mod-af with "cannot read settings file", since
  mod-af has no `.housekeeping.json`. That is expected: the `init` command writes it, and `init` runs only
  in the mod. Of its 25 command-line tests, 22 pass and 1 is skipped. Two fail on this machine. One needs
  `ssh-keygen`, which is not installed here. The other expects git's error to start "fatal:", but git
  2.43 printed a warning line first, and the tool quoted the warning.
- **The mod form runs in a cloud session.** decide from main, loaded with `--plugin-dir`, registered
  `/decide`. Its first reply was the command's count line. On the next message it gave the full brief.
  The same session also had the plugins synced from the claude.ai account. So a plugin can reach a cloud
  session, which the survey had marked as unknown.

## Not tested here

- Cowork; chat on the web, desktop and mobile.
- The desktop app's Code tab.
- Whether mod-af added in claude.ai syncs into cloud sessions the way the account's other plugins did.
- Node in chat's code sandbox.

The plan's checklist says how to test each one.

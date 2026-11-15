// Writes each plugin's prompt.md from its skill file, so the paste-in form cannot drift from the skill.
// Usage: node tools/prompt-md.mjs [--check] <plugin dir>...   With --check, writes nothing and exits 1 if any
// prompt.md differs from what its skill file gives.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
const args = process.argv.slice(2)
const check = args[0] === '--check'
const dirs = check ? args.slice(1) : args
let stale = 0
for (const dir of dirs) {
  // the plugin's name comes from its manifest, not from the folder, which can be named anything
  const manifest = join(dir, '.claude-plugin', 'plugin.json')
  const plugin = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')).name : basename(dir)
  const skillsDir = join(dir, 'skills')
  if (!existsSync(skillsDir)) { console.error(`${plugin}: no skills/ folder`); process.exitCode = 2; continue }
  const main = join(skillsDir, plugin, 'SKILL.md')
  const src = readFileSync(existsSync(main) ? main : join(skillsDir, readdirSync(skillsDir)[0], 'SKILL.md'), 'utf8')
  const m = src.match(/^---\n([\s\S]*?)\n---\n+([\s\S]*)$/)
  if (!m) { console.error(`${plugin}: SKILL.md has no front matter`); process.exitCode = 2; continue }
  const body = m[2].trimEnd() + '\n'
  const want = `# ${plugin} — the prompt form\n\n` +
    `Paste everything below the line into any chat, then say what you want it applied to. It is the same\n` +
    `procedure as the \`${plugin}\` skill, written from that skill's file; do not edit this copy by hand.\n\n---\n\n` + body
  const file = join(dir, 'prompt.md')
  const have = existsSync(file) ? readFileSync(file, 'utf8') : ''
  if (have === want) { console.log(`${plugin}: prompt.md up to date`); continue }
  if (check) { console.log(`${plugin}: prompt.md differs from its skill file`); stale++ }
  else { writeFileSync(file, want); console.log(`${plugin}: prompt.md written`) }
}
if (check && stale) process.exitCode = 1

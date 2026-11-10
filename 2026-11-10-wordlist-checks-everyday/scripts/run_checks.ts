// Run J01, J04 and J07 with default settings on each text, as jargone's checker does.
// Usage: node run_checks.ts <dir with check.ts and data.ts from commit 7eb9cac> <texts dir> <out.json>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const [src, texts, out] = process.argv.slice(2)
const { checkText, loadLists } = await import(pathToFileURL(join(src, 'check.ts')).href)
const { FAMILIARITY, REPLACEMENTS, EXCEPTIONS } = await import(pathToFileURL(join(src, 'data.ts')).href)
const lists = loadLists(FAMILIARITY, REPLACEMENTS, EXCEPTIONS)
const result: Record<string, unknown> = {}
for (const name of readdirSync(texts).sort()) {
  const text = readFileSync(join(texts, name), 'utf8')
  const lines = text.split('\n')
  const r = checkText({ text, lists, codes: ['J01', 'J04', 'J07'], format: name.endsWith('.txt') ? 'text' : 'markdown' })
  result[name] = r.findings.map((f: any) => ({ ...f, lineText: lines[f.line - 1] ?? '' }))
}
writeFileSync(out, JSON.stringify(result, null, 1))
for (const [k, v] of Object.entries(result)) {
  const fs = v as any[]
  console.log(k, fs.length, ['J01', 'J04', 'J07'].map(c => `${c}:${fs.filter(f => f.code === c).length}`).join(' '))
}

// J03 with default limits on each text, plus the sentence scores. Usage: node run_j03.ts <dir with check.ts, data.ts> <texts dir> <out.json>
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
  const r = checkText({ text, lists, codes: ['J03'], format: name.endsWith('.txt') ? 'text' : 'markdown' })
  result[name] = { scores: r.scores, findings: r.findings.map((f: any) => ({ line: f.line, term: f.term, message: f.message })) }
}
writeFileSync(out, JSON.stringify(result, null, 1))

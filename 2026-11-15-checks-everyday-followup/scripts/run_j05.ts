// J05 on each rewrite against its original, no reference file. The format follows the original's extension, as the
// first study's did. Usage: node run_j05.ts <dir with check.ts, data.ts> <originals dir> <rewrites dir> <out.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const [src, originals, rewrites, out] = process.argv.slice(2)
const { checkText, loadLists } = await import(pathToFileURL(join(src, 'check.ts')).href)
const { FAMILIARITY, REPLACEMENTS, EXCEPTIONS } = await import(pathToFileURL(join(src, 'data.ts')).href)
const lists = loadLists(FAMILIARITY, REPLACEMENTS, EXCEPTIONS)
const names: Record<string, string> = { f1: 'f1.md', f2: 'f2.md', f3: 'f3.md', f4: 'f4.md', f5: 'f5.txt' }
const result: Record<string, unknown> = {}
for (const [id, name] of Object.entries(names)) {
  const original = readFileSync(join(originals, name), 'utf8')
  const text = readFileSync(join(rewrites, `${id}.md`), 'utf8')
  const r = checkText({ text, original, lists, codes: ['J05'], format: name.endsWith('.txt') ? 'text' : 'markdown', moved: [], referenceBefore: '' })
  result[id] = r.findings.map((f: any) => ({ line: f.line, term: f.term, message: f.message, severity: f.severity }))
  console.log(id, (result[id] as any[]).length, 'J05 findings')
}
writeFileSync(out, JSON.stringify(result, null, 1))

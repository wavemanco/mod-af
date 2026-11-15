// J05 on each long-form rewrite against its original, no reference file, default settings.
// Usage: node run_j05.ts <dir with check.ts, data.ts at feb399c> <originals dir> <rewrites dir> <out.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const [src, originals, rewrites, out] = process.argv.slice(2)
const { checkText, loadLists } = await import(pathToFileURL(join(src, 'check.ts')).href)
const { FAMILIARITY, REPLACEMENTS, EXCEPTIONS } = await import(pathToFileURL(join(src, 'data.ts')).href)
const lists = loadLists(FAMILIARITY, REPLACEMENTS, EXCEPTIONS)
const result: Record<string, unknown> = {}
for (const id of ['L1', 'L2', 'L3', 'L4', 'L5']) {
  const original = readFileSync(join(originals, `${id}.md`), 'utf8')
  const text = readFileSync(join(rewrites, `${id}.md`), 'utf8')
  const r = checkText({ text, original, lists, codes: ['J05'], format: 'markdown', moved: [], referenceBefore: '' })
  result[id] = r.findings.map((f: any) => ({ line: f.line, term: f.term, message: f.message, severity: f.severity }))
  console.log(id, (result[id] as any[]).length, 'J05 findings')
}
writeFileSync(out, JSON.stringify(result, null, 1))

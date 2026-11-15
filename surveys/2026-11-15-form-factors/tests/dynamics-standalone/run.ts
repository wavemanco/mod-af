// Run dynamics' checker and renderer as a plain script, with no plugin loaded: the worked example's model,
// its files served from memory, the page written to disk.
import { writeFileSync } from 'node:fs'
import { check } from '../../../../dynamics/hooks/spec.ts'
import { render } from '../../../../dynamics/hooks/render.ts'
import { EXAMPLE_FILES, EXAMPLE_MODEL } from '../../../../dynamics/hooks/example.ts'
const io = { read: async (path: string) => {
  const key = Object.keys(EXAMPLE_FILES).find(k => path.endsWith('/' + k) || path === k)
  return key ? { text: EXAMPLE_FILES[key] } : { failed: `not in the example: ${path}` }
} }
const a = await check(JSON.stringify(EXAMPLE_MODEL), '/example/dynamics/model.json', io)
console.log('check ok:', a.report.ok, '| errors:', a.report.issues?.filter((i: any) => i.severity === 'error').length ?? '?', '| loops:', a.report.loops?.length ?? '?')
if (a.report.ok) { const r = render(a); writeFileSync(process.argv[2], r.html); console.log('page bytes:', r.html.length) }
else console.log(JSON.stringify(a.report.issues?.slice(0, 3)))

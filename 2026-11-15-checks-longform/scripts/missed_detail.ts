import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const [src, texts] = process.argv.slice(2)
const { parse } = await import(pathToFileURL(join(src, 'check.ts')).href)
const norm = (w: string) => w.replace(/^[“"‘']+/, '').split(/[’']/)[0].replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
let k = 0
for (const name of readdirSync(texts).sort()) {
  const text = readFileSync(join(texts, name), 'utf8')
  const doc = parse(text, 'markdown')
  for (const mm of text.matchAll(/[.!?][”"’'][ \t]+([“"]?[A-Z][^\s]*)/g)) {
    const line = text.slice(0, mm.index!).split('\n').length
    const first = norm(mm[1])
    const ss = doc.sentences.filter((s: any) => s.line <= line)
    const flat = (s: any) => s.items.flatMap((it: any) => it.t === 'word' ? [norm(it.text)] : it.t === 'quote' ? ['"q"'] : it.t === 'num' ? ['#'] : [])
    if (doc.sentences.some((s: any) => s.line === line && flat(s)[0] === first)) continue
    // the sentence holding the break: the last sentence on this line (or before) whose words include the next word after position 0
    const host = [...doc.sentences].reverse().find((s: any) => s.line <= line && flat(s).indexOf(first) > 0)
    const w = host ? flat(host) : []
    const at = w.indexOf(first)
    k++
    console.log(`${k}. ${name} line ${line}: …${text.slice(Math.max(0, mm.index! - 60), mm.index! + 2 + mm[1].length + 30).replace(/\n/g, ' ')}… | sentence ${host?.words ?? '?'} words, split here: ${at} + ${host ? host.words - at : '?'}`)
  }
}

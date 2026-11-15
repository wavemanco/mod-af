// List each sentence break inside a block where the sentence's last word is short and capitalised (1 to 4 letters),
// a single letter, or where the sentence ends on a quotation. Usage: node breaks.ts <instrumented check.ts dir> <texts dir>
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const [src, texts] = process.argv.slice(2)
const { parse } = await import(pathToFileURL(join(src, 'check.ts')).href)
const wordsOf = (s: any) => s.items.flatMap((it: any) => it.t === 'word' ? [it.text] : it.t === 'quote' ? ['“' + it.words.map((w: any) => w.text).join(' ') + '”'] : it.t === 'num' ? [it.text] : [])
let total = 0
for (const name of readdirSync(texts).sort()) {
  const doc = parse(readFileSync(join(texts, name), 'utf8'), 'markdown')
  const ss = doc.sentences
  for (let i = 0; i < ss.length - 1; i++) {
    if (ss[i].block !== ss[i + 1].block) continue
    total++
    const w = wordsOf(ss[i]); const last = w[w.length - 1] ?? ''
    const lastItem = ss[i].items[ss[i].items.length - 1]
    const why = /^[A-Z][A-Za-z]{0,3}$/.test(last) ? 'short capital' : /^[A-Za-z]$/.test(last) ? 'single letter' : lastItem?.t === 'quote' ? 'ends on a quotation' : ''
    if (why) console.log(`${name} line ${ss[i].line} [${why}] …${w.slice(-4).join(' ')} ‖ ${wordsOf(ss[i + 1]).slice(0, 4).join(' ')}… (${ss[i].words} | ${ss[i + 1].words} words)`)
  }
}
console.log('breaks inside blocks:', total)

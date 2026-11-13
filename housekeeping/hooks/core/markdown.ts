export type Table = { section: string; subsection: string; line: number; header: string[];
  rows: { line: number; cells: string[] }[] }

const OPENER = /^\s*((?:[-*+]|\d+[.)])\s+)?(`{3,}|~{3,})(.*)$/

// One step of fence tracking: the opener while inside a fence, else null. An opener may follow a list marker. A
// fence closes only with the same character, at least as long, and nothing after it; the fence lines count as inside.
export function stepFence(open: string | null, line: string): string | null {
  const m = OPENER.exec(line)
  if (open === null) return m && !(m[2][0] === '`' && m[3].includes('`')) ? m[2] : null
  return m && !m[1] && m[2][0] === open[0] && m[2].length >= open.length && m[3].trim() === '' ? null : open
}
export const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const SEPARATOR = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/ // GFM: any number of dashes per cell

export const normalise = (text: string): string => text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')

export function cellsOf(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') { cur += '|'; i++ }
    else if (t[i] === '|') { cells.push(cur.trim()); cur = '' }
    else cur += t[i]
  }
  cells.push(cur.trim())
  if (cells[cells.length - 1] === '') cells.pop()
  return cells
}

// unclosed: the line of a fence's opener when the file ends inside it; hiding: the openers of fences that hold a
// `##` heading, once each, which a later fence's closer may have closed
// fenced: the tables inside fences, by their fence's opener and its section, so the reader can tell a row table a
// stray opener hides (HK-088)
export type Scan = { tables: Table[]; dropped: { line: number; section: string; why: 'separator' | 'closed' | 'stray' }[];
  unclosed: number | null; hiding: number[]; fenced: { opener: number; section: string; header: string[] }[] }

// dropped, once per break: a pipe line over a pipe separator with another cell count, which GFM reads as no
// table (separator); a line holding `|` that ends a table because it does not start with one (closed); and
// a line starting with `|` in no table (stray). The `|` lines right after a break are part of it.
export function scan(text: string): Scan {
  const lines = normalise(text).split('\n')
  const tables: Table[] = [], dropped: Scan['dropped'] = [], hiding: number[] = [], inFence: Scan['fenced'] = []
  let section = '', subsection = '', fenced: string | null = null, open: Table | null = null, run = false, opener = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const was = fenced
    fenced = stepFence(fenced, line)
    if (was === null && fenced !== null) opener = i + 1
    if (was !== null && fenced !== null && HEADING.exec(line)?.[1] === '##' && hiding[hiding.length - 1] !== opener) hiding.push(opener)
    if (was !== null && fenced !== null && line.includes('|') && SEPARATOR.test(lines[i + 1] ?? '')
      && cellsOf(lines[i + 1]).length === cellsOf(line).length) inFence.push({ opener, section, header: cellsOf(line) })
    // a fence that opens right after a row, while a row table is open, hides the rows after it (HK-091)
    if (was === null && fenced !== null && open) inFence.push({ opener, section: open.section, header: open.header })
    if (was !== null || fenced !== null) { open = null; run = false; continue }
    const h = HEADING.exec(line)
    if (h) {
      open = null; run = false
      if (h[1] === '##') { section = h[2]; subsection = '' } else if (h[1] === '###') subsection = h[2]
      continue
    }
    if (open) {
      if (!line.trimStart().startsWith('|')) {
        open = null
        if (line.includes('|')) { dropped.push({ line: i + 1, section, why: 'closed' }); run = true }
      } else if (!SEPARATOR.test(line)) open.rows.push({ line: i + 1, cells: cellsOf(line) }) // a stray separator is no row
      continue
    }
    const next = lines[i + 1] ?? ''
    if (line.includes('|') && SEPARATOR.test(next)) {
      if (cellsOf(next).length === cellsOf(line).length) {
        open = { section, subsection, line: i + 1, header: cellsOf(line), rows: [] }
        tables.push(open)
        i++
        run = false
        continue
      }
      if (next.includes('|')) { dropped.push({ line: i + 1, section, why: 'separator' }); run = true; continue }
    }
    const piped = line.trimStart().startsWith('|')
    if (piped && !run) dropped.push({ line: i + 1, section, why: 'stray' })
    run = piped
  }
  return { tables, dropped, unclosed: fenced === null ? null : opener, hiding, fenced: inFence }
}
export const scanTables = (text: string): Table[] => scan(text).tables

export type Table = { section: string; subsection: string; line: number; header: string[];
  rows: { line: number; cells: string[] }[] }

export const FENCE = /^\s*(?:```|~~~)/
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

export function scanTables(text: string): Table[] {
  const lines = normalise(text).split('\n')
  const tables: Table[] = []
  let section = '', subsection = '', fenced = false, open: Table | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE.test(line)) { fenced = !fenced; open = null; continue }
    if (fenced) continue
    const h = HEADING.exec(line)
    if (h) {
      open = null
      if (h[1] === '##') { section = h[2]; subsection = '' } else if (h[1] === '###') subsection = h[2]
      continue
    }
    if (open) {
      if (!line.trimStart().startsWith('|')) open = null
      else if (!SEPARATOR.test(line)) open.rows.push({ line: i + 1, cells: cellsOf(line) }) // a stray separator is no row
      continue
    }
    const next = lines[i + 1] ?? ''
    if (line.includes('|') && SEPARATOR.test(next) && cellsOf(next).length === cellsOf(line).length) {
      open = { section, subsection, line: i + 1, header: cellsOf(line), rows: [] }
      tables.push(open)
      i++
    }
  }
  return tables
}

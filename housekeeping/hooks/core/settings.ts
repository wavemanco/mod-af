import type { Finding, Settings } from './types.ts'

const KNOWN = ['version', 'project', 'mainBranch', 'files', 'columns', 'values', 'ids', 'none', 'done', 'paths',
  'whereWeAre', 'checklists', 'notDoing', 'decisions', 'duties', 'defaultUntilDecided']
const REQUIRED_COLUMNS = ['id', 'item', 'milestone', 'who', 'landNow', 'trigger', 'waitsOn']
const FILE_KEYS = ['backlog', 'playbook']

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const strs = (v: unknown): string[] | null => (Array.isArray(v) && v.every(isStr) ? (v as string[]) : null)

export function parseSettings(text: string): { settings: Settings | null; findings: Finding[] } {
  const findings: Finding[] = []
  const err = (message: string) => findings.push({ level: 'error', rule: 'settings', message })
  let raw: unknown
  try { raw = JSON.parse(text) } catch (e) { err(`settings are not valid JSON: ${(e as Error).message}`); return { settings: null, findings } }
  if (!isObj(raw)) { err('settings must be a JSON object'); return { settings: null, findings } }

  if (raw.version !== 1) err(`"version" must be 1, found ${JSON.stringify(raw.version)}`)
  if (!isStr(raw.project) || !raw.project) err('"project" must be a non-empty string')
  for (const k of ['mainBranch', 'none', 'decisions', 'defaultUntilDecided'])
    if (raw[k] !== undefined && !isStr(raw[k])) err(`"${k}" must be a string`)

  // files
  const files = {} as Settings['files']
  if (!isObj(raw.files)) err('"files" must be an object with "backlog" and "playbook"')
  else for (const k of FILE_KEYS) {
    const f = (raw.files as Obj)[k]
    if (!isObj(f) || !isStr(f.path) || !f.path) { err(`"files.${k}.path" must be a non-empty string`); continue }
    const skip = f.skipSections === undefined ? [] : strs(f.skipSections)
    if (!skip) { err(`"files.${k}.skipSections" must be a list of strings`); continue }
    files[k as 'backlog'] = { path: f.path, skipSections: skip }
  }

  // columns
  if (!isObj(raw.columns)) err('"columns" must be an object naming the table columns')
  else {
    for (const c of REQUIRED_COLUMNS) if (!isStr(raw.columns[c]) || !raw.columns[c]) err(`"columns.${c}" is required: the header text of that column`)
    for (const c of ['details', 'filed', 'priority', 'triggerType'])
      if (raw.columns[c] !== undefined && !isStr(raw.columns[c])) err(`"columns.${c}" must be a string`)
  }

  // ids: each a regex source
  const ids = strs(raw.ids)
  if (!ids || ids.length === 0) err('"ids" must be a non-empty list of regex sources')
  else for (const p of ids) {
    try { new RegExp(p) } catch { err(`"ids" has a pattern that is not a regular expression: ${p}`) }
  }

  // nested shapes: every problem names its key path
  const fileKey = (o: Obj, at: string) => { if (!FILE_KEYS.includes(o.file as string)) err(`"${at}.file" must be "backlog" or "playbook"`) }
  const str = (o: Obj, k: string, at: string, optional = false) => {
    if (o[k] === undefined && optional) return
    if (!isStr(o[k]) || (!optional && !o[k])) err(`"${at}.${k}" must be ${optional ? 'a string' : 'a non-empty string'}`)
  }
  const col = (o: Obj, k: string, at: string, optional = false) => {
    if (o[k] === undefined && optional) return
    if (!Number.isInteger(o[k]) || (o[k] as number) < 0) err(`"${at}.${k}" must be a non-negative integer`)
  }
  const list = (k: string, each: (o: Obj, at: string) => void) => {
    const v = raw[k]
    if (v === undefined) return
    if (!Array.isArray(v)) return err(`"${k}" must be a list`)
    v.forEach((o, i) => isObj(o) ? each(o, `${k}[${i}]`) : err(`"${k}[${i}]" must be an object`))
  }
  const located = (k: string, marker: boolean) => {
    const o = raw[k]
    if (o === undefined) return
    if (!isObj(o)) return err(`"${k}" must be an object`)
    fileKey(o, k); str(o, 'heading', k); if (marker) str(o, 'marker', k, true)
  }
  if (!Array.isArray(raw.paths)) err('"paths" must be a list')
  else list('paths', (p, at) => {
    str(p, 'name', at)
    if (p.shared !== undefined && typeof p.shared !== 'boolean') err(`"${at}.shared" must be true or false`)
    if (!Array.isArray(p.milestones)) return err(`"${at}.milestones" must be a list`)
    p.milestones.forEach((m, j) => {
      if (!isObj(m)) return err(`"${at}.milestones[${j}]" must be an object`)
      str(m, 'name', `${at}.milestones[${j}]`); str(m, 'doneWhen', `${at}.milestones[${j}]`, true)
    })
  })
  list('done', (d, at) => {
    fileKey(d, at); str(d, 'sectionPrefix', at); col(d, 'idColumn', at); col(d, 'landedColumn', at); col(d, 'milestoneColumn', at, true)
    const f = d.fileByIdPrefix
    if (f === undefined) return
    if (!isObj(f)) return err(`"${at}.fileByIdPrefix" must be an object`)
    for (const [k, v] of Object.entries(f)) if (!FILE_KEYS.includes(k) || !isStr(v)) err(`"${at}.fileByIdPrefix.${k}" must map "backlog" or "playbook" to a string`)
  })
  list('checklists', (c, at) => { fileKey(c, at); str(c, 'heading', at); str(c, 'milestone', at, true) })
  located('whereWeAre', true)
  located('notDoing', false)
  const v = raw.values === undefined ? {} : raw.values
  if (!isObj(v)) err('"values" must be an object')
  else if (v.who !== undefined && !isObj(v.who)) err('"values.who" must be an object')

  if (findings.length) return { settings: null, findings }

  for (const k of Object.keys(raw))
    if (!KNOWN.includes(k)) findings.push({ level: 'recommendation', rule: 'settings', message: `unknown key "${k}" in settings is ignored` })

  const vals = v as Obj
  const who = (vals.who ?? {}) as Obj
  const duties = isObj(raw.duties) ? raw.duties : {}
  const settings = {
    ...raw,
    version: 1,
    mainBranch: raw.mainBranch ?? 'main',
    files,
    values: {
      ...vals,
      who: { agent: strs(who.agent) ?? ['agent'], owner: strs(who.owner) ?? ['owner'], both: strs(who.both) ?? ['both'] },
      nothing: strs(vals.nothing) ?? ['—', '-', ''],
    },
    none: raw.none ?? 'none',
    done: raw.done ?? [],
    checklists: raw.checklists ?? [],
    duties: { triggerPrefix: isStr(duties.triggerPrefix) ? duties.triggerPrefix : 'Every' },
    defaultUntilDecided: raw.defaultUntilDecided ?? 'Default until decided:',
  } as Settings
  return { settings, findings }
}

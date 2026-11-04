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

  if (!Array.isArray(raw.paths)) err('"paths" must be a list')
  else for (const p of raw.paths)
    if (!isObj(p) || !isStr(p.name) || !Array.isArray(p.milestones) || !p.milestones.every(m => isObj(m) && isStr(m.name)))
      err('each entry of "paths" needs a "name" and a list of "milestones", each with a "name"')

  for (const k of ['done', 'checklists'])
    if (raw[k] !== undefined && !Array.isArray(raw[k])) err(`"${k}" must be a list`)

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

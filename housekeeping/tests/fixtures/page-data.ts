// The page's data on the fixtures, for the page's tests (the plugin's and Node's).
import { parseSettings } from '../../hooks/core/settings.ts'
import { parseFiles } from '../../hooks/core/parse.ts'
import { computeFacts } from '../../hooks/core/facts.ts'
import { computeLanes } from '../../hooks/core/lanes.ts'
import { findingsFor } from '../../hooks/core/findings.ts'
import { historyFrom, snapshot } from '../../hooks/core/history.ts'
import { pageData } from '../../hooks/core/page.ts'
import type { PageData } from '../../hooks/core/types.ts'
import * as small from './small.ts'
import * as paths from './paths.ts'

type Files = { backlog: string; playbook: string }
const commit = (i: number) => ({ sha: `${i}`.repeat(40), date: `2026-09-0${i}`, subject: `step ${i}` })

// The data for the last of `steps`, with one history entry per step, oldest first.
export function data(settings: string, steps: Files[]): PageData {
  const s = parseSettings(settings).settings!
  const p = parseFiles(s, steps[steps.length - 1]), f = computeFacts(s, p), lanes = computeLanes(s, p, f)
  const history = historyFrom(steps.map((x, i) => ({ ...snapshot(s, x), ...commit(i + 1) })))
  return pageData(s, commit(steps.length), p, f, lanes, history, findingsFor(s, p, f, lanes, history))
}

// Replace one string that appears exactly once.
export const once = (text: string, from: string, to: string) => {
  if (text.split(from).length !== 2) throw new Error(`not exactly once: ${from}`)
  return text.replace(from, () => to)
}

// small.ts in two steps: without B-005, then with it.
export const smallData = (b = small.backlog) => {
  const b005 = b.split('\n').find(l => l.startsWith('| B-005 '))! + '\n'
  return data(small.settings, [{ backlog: once(b, b005, ''), playbook: small.playbook }, { backlog: b, playbook: small.playbook }])
}
export const SMALL = smallData()
// paths.ts in two steps: all open, then C-001 closed.
export const PATHS = data(paths.settings, [{ backlog: paths.backlog(), playbook: paths.playbook },
  { backlog: paths.backlog(['C-001']), playbook: paths.playbook }])

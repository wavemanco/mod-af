import type { EngineInterface, Register } from 'claude-code'
import { readInput, repoKey, writeFile } from './adapter.ts'
import { brief } from './core/brief.ts'
import { formatFindings } from './core/findings.ts'
import { build } from './core/index.ts'
import type { BuildOutput } from './core/types.ts'

type Loaded = { root: string; out: BuildOutput; sha: string; text: string; failed: boolean; project: string } | { error: string }

const SETTINGS = '.housekeeping.json'
const PAGE = '.housekeeping/route-map.html'
const say = (r: { deny?: string; isError?: boolean; text?: string }) => r.deny ?? (r.isError ? r.text ?? 'error' : null)

// Reads the repository and builds. The view may read the clock; the page may not.
async function load($: EngineInterface): Promise<Loaded> {
  const root = await $.session.root()
  const file = `${root}/${SETTINGS}`
  const r = await readInput($, root, (await $.fs.exists(file)) ? await $.fs.read(file) : null)
  if ('error' in r) return r
  const out = build(r.input)
  const findings = [...r.findings, ...out.findings]
  const today = new Date(await $.clock.now()).toISOString().slice(0, 10)
  out.brief = brief(out.data, { today, branch: r.branch, behindRemote: r.behindRemote, main: r.input.settings.mainBranch })
  return { root, out, sha: r.input.head.sha, text: formatFindings(findings), failed: findings.some(f => f.level === 'error'), project: r.input.settings.project }
}

function statusLine(out: BuildOutput): string {
  const lane = out.data.lanes[0]
  const next = lane?.stations.find(s => s.milestone === lane.next)
  const where = !lane ? 'no route' : next ? `${next.milestone}, ${next.stops.length} stops` : 'all reached'
  return `${out.data.counts.yes} land now · ${out.data.counts.needYou} need you · next: ${where}`
}

export const register: Register = on => {
  let view = 'housekeeping: run /housekeeping to build the short view.'

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'housekeeping', description: 'Pending work in one place: short view, map, check, init.', argumentHint: '[map|check|init]' })
    const got = await next(e)
    // not awaited: a slow repository must not hold up the session
    load($).then(l => { if (!('error' in l)) $.ui.status(statusLine(l.out)) }).catch(() => {})
    return got
  })

  on('command.run', { command: 'housekeeping' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'init') return { text: 'housekeeping: init arrives in a later task' }
    if (arg !== '' && arg !== 'check' && arg !== 'map') return { text: 'housekeeping: [map | check | init]; no argument opens the short view' }
    const l = await load($)
    if ('error' in l) return { text: l.error, exitCode: 1 }
    if (arg === 'check') return { text: l.text, exitCode: l.failed ? 1 : 0 }
    if (arg === '') {
      view = l.out.brief
      await $.ui.open({ id: 'housekeeping', title: 'housekeeping' })
      $.ui.status(statusLine(l.out))
      return { text: 'housekeeping: short view open' }
    }

    if (l.failed || l.out.html === null) return { text: l.text, exitCode: 1 }
    const path = `${l.root}/${PAGE}`
    const denied = await writeFile($, path, l.out.html)
    if (denied !== null) return { text: denied, exitCode: 1 }
    if (!(await $.tool.list()).some(t => t.name === 'Artifact')) return { text: `${l.out.partition}\n${path}` }

    const key = `repo:${await repoKey($, l.root)}`
    const known = (await $.store.get(key)) as { url?: string } | undefined
    try {
      // the Artifact tool refuses a publish to a page this session has not read
      if (known?.url) {
        const bad = say(await $.tool.call({ tool: 'Artifact', action: 'read', url: known.url }) as never)
        if (bad !== null) return { text: bad, exitCode: 1 }
      }
      const pub = await $.tool.call({
        tool: 'Artifact', action: 'publish', file_path: path, title: `${l.project} Route Map`,
        ...(known?.url ? { url: known.url } : { icon: 'map' }),
      }) as never as { deny?: string; isError?: boolean; text?: string; result: { url?: string } }
      const bad = say(pub)
      if (bad !== null) return { text: bad, exitCode: 1 }
      const url = pub.result.url ?? known?.url
      if (!url) return { text: `${l.out.partition}\nhousekeeping: the publish gave no URL (page at ${path})`, exitCode: 1 }
      await $.store.set(key, { url, sha: l.sha })
      return { text: `${l.out.partition}\n${url}` }
    } catch (err) {
      return { text: String(err), exitCode: 1 }
    }
  })

  on('ui.render', { component: 'Pane', requestId: 'housekeeping' }, ($, e) => {
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={view} />
  })

  on('prompt.context', async ($, e, next) => {
    const got = await next(e)
    const add = async () => {
      if (!(await $.fs.exists(`${await $.session.root()}/${SETTINGS}`))) return got
      const l = await load($)
      return 'error' in l ? got : { ...got, blocks: [...got.blocks, { name: 'housekeeping', text: l.out.brief }] }
    }
    return add().catch(() => got)
  })
}

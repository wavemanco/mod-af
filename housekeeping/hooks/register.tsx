import type { EngineInterface, Register } from 'claude-code'
import { PAGE, readInput, repoKey, writeFile, writePage } from './adapter.ts'
import { brief } from './core/brief.ts'
import { formatFindings } from './core/findings.ts'
import { build } from './core/index.ts'
import { initFiles } from './core/templates.ts'
import type { BuildOutput } from './core/types.ts'

type Loaded = { root: string; out: BuildOutput; sha: string; text: string; failed: boolean; project: string } | { error: string }

const SETTINGS = '.housekeeping.json'
// shortcut: the Artifact tool's not-found and no-access texts are unverified; check them in the owner's live check
const GONE = /not found|no such|does not exist|deleted|no access|not have access|access denied|forbidden|permission|unauthori[sz]ed|\b40[134]\b/i
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

const GUIDE_LINE = 'At session start, run node <path to housekeeping>/cli.ts brief, or read the Route Map.'

// Never overwrites: an existing file is left as it is, except .gitignore and AGENTS.md, which get a line appended when it is missing.
async function init($: EngineInterface): Promise<{ text: string; exitCode?: number }> {
  const root = await $.session.root()
  const wrote: string[] = [], kept: string[] = []
  const said = () => wrote.map(p => `wrote ${p}`)
  const put = async (path: string, content: string) => {
    const denied = await writeFile($, `${root}/${path}`, content)
    if (denied !== null) throw new Error(denied)
    wrote.push(path)
  }
  const nl = (s: string) => (s === '' || s.endsWith('\n') ? '' : '\n')
  // the branch init runs on; symbolic-ref names it even before its first commit
  const sym = await $.process.run(['git', 'symbolic-ref', '--short', 'HEAD'], { cwd: root, timeoutMs: 10_000 }).catch(() => null)
  const branch = sym?.exitCode === 0 && sym.stdout.trim() ? sym.stdout.trim() : 'main'
  try {
    for (const f of initFiles(root.split(/[\\/]/).filter(Boolean).pop() ?? 'project', branch)) {
      const file = `${root}/${f.path}`
      if (!(await $.fs.exists(file))) { await put(f.path, f.content); continue }
      const old = f.path === '.gitignore' ? await $.fs.read(file) : null
      if (old !== null && !old.split(/\r?\n/).some(l => l.trim() === f.content.trim())) await put(f.path, old + nl(old) + f.content)
      else kept.push(f.path)
    }
    let guide = 'no AGENTS.md here, so no agent-guide line was added (init creates no guide file)'
    if (await $.fs.exists(`${root}/AGENTS.md`)) {
      const old = await $.fs.read(`${root}/AGENTS.md`)
      if (old.includes(GUIDE_LINE)) guide = 'AGENTS.md already has the agent-guide line'
      else { await put('AGENTS.md', `${old}${nl(old)}\n${GUIDE_LINE}\n`); guide = 'added the agent-guide line to AGENTS.md' }
    }
    return { text: ['housekeeping: init', ...said(), ...kept.map(p => `${p}: left as it is`), guide,
      `Commit these files on ${branch}: check and map read them from there.`].join('\n') }
  } catch (err) {
    return { text: [...said(), (err as Error).message].join('\n'), exitCode: 1 }
  }
}

export const register: Register = on => {
  let view = 'housekeeping: run /housekeeping to build the short view.'

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'housekeeping', description: 'Pending work in one place: short view, map, check, init.', argumentHint: '[map|map new|check|init]' })
    const got = await next(e)
    // not awaited: a slow repository must not hold up the session
    load($).then(l => { if (!('error' in l)) $.ui.status(statusLine(l.out)) }).catch(() => {})
    return got
  })

  on('command.run', { command: 'housekeeping' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'init') return init($)
    if (!['', 'check', 'map', 'map new'].includes(arg)) return { text: 'housekeeping: [map | map new | check | init]; no argument opens the short view' }
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
    const denied = await writePage($, l.root, path, l.out.html)
    if (denied !== null) return { text: denied, exitCode: 1 }
    if (!(await $.tool.list()).some(t => t.name === 'Artifact')) return { text: `${l.out.partition}\n${path}` }

    const key = `repo:${await repoKey($, l.root)}`
    try {
      if (arg === 'map new') await $.store.delete(key)
      const known = (await $.store.get(key)) as { url?: string } | undefined
      // the Artifact tool refuses a publish to a page this session has not read
      if (known?.url) {
        const read = await $.tool.call({ tool: 'Artifact', action: 'read', url: known.url }) as never as { isError?: boolean }
        const bad = say(read)
        // a page that is gone or not the person's never reads again; any other failure may pass
        if (bad !== null && read.isError && GONE.test(bad)) {
          await $.store.delete(key)
          return { text: 'housekeeping: the stored Route Map link could not be read and was forgotten; run /housekeeping map again to publish a new page', exitCode: 1 }
        }
        if (bad !== null) return { text: `housekeeping: could not read the stored Route Map link ${known.url}: ${bad}\nRun /housekeeping map again later, or /housekeeping map new to forget the link and publish a new page.`, exitCode: 1 }
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

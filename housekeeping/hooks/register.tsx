import type { EngineInterface, Register } from 'claude-code'
import { PAGE, readInput, readTracked, repoKey, writeFile, writePage } from './adapter.ts'
import { behind, brief, onBranch } from './core/brief.ts'
import { formatFindings } from './core/findings.ts'
import { build } from './core/index.ts'
import { parseSettings } from './core/settings.ts'
import { formatInventory, inventory, notRead } from './core/survey.ts'
import { initFiles } from './core/templates.ts'
import type { BuildOutput } from './core/types.ts'

// on: the lines that say which branch check read and whether local main is behind its remote copy (finding 12)
type Loaded = { root: string; out: BuildOutput; sha: string; text: string; failed: boolean; project: string;
  on: { branch: string; behind: string[] } } | { error: string }

const SETTINGS = '.housekeeping.json'
// Only a page that is not there forgets the link; a refusal for access or permission keeps it (HK-033).
// shortcut: the Artifact tool's not-found and deleted texts are unverified; check them in the owner's live check
const GONE = /not found|no such|does not exist|deleted|\b404\b/i
const URL_IN_TEXT = /https:\/\/claude\.ai\/[^\s)\]>"'`]+/
const say = (r: { deny?: string; isError?: boolean; text?: string }) => r.deny ?? (r.isError ? r.text ?? 'error' : null)

// The top of the git tree the session is in, else the folder the session started in (HK-030).
async function repoRoot($: EngineInterface): Promise<string> {
  const start = await $.session.root()
  const r = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { cwd: start, timeoutMs: 10_000 }).catch(() => null)
  return r?.exitCode === 0 && r.stdout.trim() ? r.stdout.trim() : start
}

// Reads the repository and builds. The view may read the clock; the page may not.
async function load($: EngineInterface): Promise<Loaded> {
  const root = await repoRoot($)
  const file = `${root}/${SETTINGS}`
  const r = await readInput($, root, (await $.fs.exists(file)) ? await $.fs.read(file) : null)
  if ('error' in r) return r
  const out = build(r.input)
  const findings = [...r.findings, ...out.findings]
  const today = new Date(await $.clock.now()).toISOString().slice(0, 10)
  const main = r.input.settings.mainBranch
  out.brief = brief(out.data, { today, branch: r.branch, behindRemote: r.behindRemote, main })
  return { root, out, sha: r.input.head.sha, text: formatFindings(findings), failed: findings.some(f => f.level === 'error'), project: r.input.settings.project,
    on: { branch: onBranch(r.branch, main, 'check read').join(''), behind: behind(r.behindRemote, main) } }
}

function statusLine(out: BuildOutput): string {
  const lane = out.data.lanes[0]
  const next = lane?.stations.find(s => s.milestone === lane.next)
  const where = !lane ? 'no route' : next ? `${next.milestone}, ${next.stops.length} stops` : 'all reached'
  return `${out.data.counts.yes} land now · ${out.data.counts.needYou} need you · next: ${where}`
}

type View = { brief: string; status: string }

// The short view and the status line, kept in $.store by repository with what they were built from. While main's
// commit, its remote copy's commit, the branch and the settings are as they were, a few git rev-parse calls are all they cost.
// shortcut: the day is not in the stamp (HK-035), so "Duties due" is as of the day the view was built; it is rebuilt when main, its remote copy, the branch or the settings change.
async function cachedView($: EngineInterface): Promise<View | null> {
  const root = await repoRoot($)
  const file = `${root}/${SETTINGS}`
  if (!(await $.fs.exists(file))) return null
  const text = await $.fs.read(file)
  const main = parseSettings(text).settings?.mainBranch
  if (!main) return null
  // one call: the common git dir (the repository's key), main's commit, then the branch
  const r = await $.process.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir', main, '--abbrev-ref', 'HEAD'], { cwd: root, timeoutMs: 10_000 })
  const [dir, sha, branch] = r.stdout.split('\n').map(x => x.trim())
  const remote = (await $.process.run(['git', 'rev-parse', '--verify', '--quiet', `refs/remotes/origin/${main}`], { cwd: root, timeoutMs: 10_000 }).catch(() => null))?.stdout.trim() ?? ''
  const key = `brief:${dir}`, stamp = [sha, remote, branch, text].join('\n')
  const hit = r.exitCode === 0 && sha ? (await $.store.get(key)) as (View & { sha: string; stamp: string }) | undefined : undefined
  if (hit?.stamp === stamp) return { brief: hit.brief, status: hit.status }
  const l = await load($)
  if ('error' in l) return null
  const v = { brief: l.out.brief, status: statusLine(l.out) }
  if (r.exitCode === 0 && sha) await $.store.set(key, { sha, stamp, ...v })
  return v
}

const GUIDE_LINE = 'At session start, run node <path to housekeeping>/cli.ts brief, or read the Route Map.'

// Never overwrites: an existing file is left as it is, except .gitignore and AGENTS.md, which get a line appended when it is missing.
async function init($: EngineInterface): Promise<{ text: string; exitCode?: number }> {
  const root = await repoRoot($)
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

// survey and plan: the procedure, then the inventory, for the agent to follow; plan adds check's findings when
// there are settings. Neither writes anything.
async function procedure($: EngineInterface, arg: 'survey' | 'plan', named?: { tracker: string[]; notTracker: string[] }):
  Promise<{ text: string; exitCode?: number; context?: string[] }> {
  const root = await repoRoot($)
  const t = await readTracked($, root, named)
  if ('error' in t) return { text: t.error, exitCode: 1 }
  const inv = inventory(t.files, t.skipped, { denied: t.denied, ...t.named })
  // where housekeeping lives, which the procedures need for the Node command and FORMAT.md (finding 22)
  const home = $.plugin.root
  const context = [await $.fs.read(`${home}/prompts/${arg}.md`), `housekeeping is installed at ${home}: run its Node command as ` +
    `node ${home}/cli.ts (survey takes --tracker and --not-tracker), and read its row format in ${home}/FORMAT.md.`, formatInventory(inv)]
  if (arg === 'plan' && (await $.fs.exists(`${root}/${SETTINGS}`))) {
    const l = await load($)
    context.push(`The current /housekeeping check findings:\n${'error' in l ? l.error : l.text || 'none'}`)
  }
  // "nothing to move" only where nothing is tracked; elsewhere what was measured (finding 8)
  const tracked = inv.files || inv.skipped.length || inv.denied
  const none = inv.candidates.length ? '' : tracked ? `: no file reached the survey's score of 3 (${inv.suspects.length} suspects)`
    : ': no tracked files, nothing to move; /housekeeping init sets up the pair'
  const stops = notRead(inv, true)
  const stopped = stops.length ? `; a limit stopped the reading: ${stops.join(', ')}` : ''
  // the command starts no agent turn, so the reply says what comes next (the owner, 2026-11-04: "Say what's next")
  const next = `The agent carries out the ${arg} procedure on your next message, for example "go ahead".`
  return { text: `housekeeping ${arg}: ${inv.files} files read, ${inv.candidates.length} candidates${none}${stopped}\n${next}`, context }
}

// survey's --tracker and --not-tracker, each repeatable, a path in double quotes when it holds a space; null when
// anything else is there
function surveyArgs(rest: string): { tracker: string[]; notTracker: string[] } | null {
  const words = (rest.match(/"[^"]*"|\S+/g) ?? []).map(w => w.replace(/^"(.*)"$/, '$1'))
  const named = { tracker: [] as string[], notTracker: [] as string[] }
  for (let i = 0; i < words.length; i += 2) {
    const k = words[i] === '--tracker' ? 'tracker' : words[i] === '--not-tracker' ? 'notTracker' : null
    if (!k || words[i + 1] === undefined) return null
    named[k].push(words[i + 1])
  }
  return named
}

async function command($: EngineInterface, arg: string, show: (brief: string) => void): Promise<{ text: string; exitCode?: number; context?: string[] }> {
  if (arg === 'init') return init($)
  if (arg === 'plan') return procedure($, arg)
  const named = /^survey(?:\s|$)/.test(arg) ? surveyArgs(arg.slice(6)) : null
  if (named) return procedure($, 'survey', named)
  if (!['', 'check', 'map', 'map new'].includes(arg)) return { text: 'housekeeping: [map | map new | check | init | survey [--tracker <path>] [--not-tracker <path>] | plan]; no argument opens the short view' }
  const l = await load($)
  if ('error' in l) return { text: l.error, exitCode: 1 }
  if (arg === 'check') return { text: [l.on.branch, ...l.on.behind, l.text].filter(Boolean).join('\n'), exitCode: l.failed ? 1 : 0 }
  if (arg === '') {
    show(l.out.brief)
    const pane = await $.ui.open({ id: 'housekeeping', title: 'housekeeping' })
    $.ui.status(statusLine(l.out))
    // no pane placed: the person would see nothing, so the brief comes back as text (HK-029)
    return { text: pane.isPlaced ? 'housekeeping: short view open' : l.out.brief }
  }

  if (l.failed || l.out.html === null) return { text: l.text, exitCode: 1 }
  const path = `${l.root}/${PAGE}`
  const partition = [l.out.partition, ...l.on.behind].join('\n')
  const kept = `${partition}\n${path}`
  const denied = await writePage($, l.root, path, l.out.html)
  if (denied !== null) return { text: denied, exitCode: 1 }
  if (!(await $.tool.list()).some(t => t.name === 'Artifact')) return { text: kept }

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
    }) as never as { deny?: string; isError?: boolean; text?: string; result?: { url?: string } | null }
    const bad = say(pub)
    // the page was written: a refusal still says where it is (HK-032)
    if (bad !== null) return { text: `${kept}\n${bad}`, exitCode: 1 }
    // the tool's result, else the first claude.ai link in its text (HK-036)
    const url = pub.result?.url ?? URL_IN_TEXT.exec(pub.text ?? '')?.[0].replace(/[.,;:]+$/, '') ?? known?.url
    if (!url) return { text: `${partition}\nhousekeeping: the publish gave no URL (page at ${path})`, exitCode: 1 }
    await $.store.set(key, { url, sha: l.sha })
    return { text: `${partition}\n${url}` }
  } catch (err) {
    return { text: `${kept}\n${String(err)}`, exitCode: 1 }
  }
}

export const register: Register = on => {
  let view = 'housekeeping: run /housekeeping to build the short view.'
  let started: Promise<View | null> | null = null // session start's view, which the first prompt.context awaits

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'housekeeping', description: 'Pending work in one place: short view, map, check, init, survey, plan.', argumentHint: '[map|map new|check|init|survey [--tracker <path>] [--not-tracker <path>]|plan]' })
    const got = await next(e)
    // not awaited: a slow repository must not hold up the session
    started = cachedView($)
    started.then(v => { if (v) $.ui.status(v.status) }).catch(() => {})
    return got
  })

  on('command.run', { command: 'housekeeping' }, async ($, e) => {
    // a throw anywhere below still gives the person a reply (HK-031)
    return command($, e.args.trim(), b => { view = b }).catch(err => ({ text: `housekeeping: ${err instanceof Error ? err.message : String(err)}`, exitCode: 1 }))
  })

  on('ui.render', { component: 'Pane', requestId: 'housekeeping' }, ($, e) => {
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={view} />
  })

  on('prompt.context', async ($, e, next) => {
    const got = await next(e)
    const add = async () => {
      // the first one awaits session start's load; later ones (compaction, /clear) ask the cache again
      const pending = started ?? cachedView($)
      started = null
      const v = await pending
      return v ? { ...got, blocks: [...got.blocks, { name: 'housekeeping', text: v.brief }] } : got
    }
    return add().catch(() => got)
  })
}

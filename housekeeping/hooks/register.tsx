import type { EngineInterface, Register } from 'claude-code'
import { commonDir, type Git, PAGE, readAudit, readInput, readOwed, readRule, readTracked, repoKey, writeFile, writePage } from './adapter.ts'
import { OWED_ENV } from './core/history.ts'
import { behind, brief, onBranch, withBranch, withDuties } from './core/brief.ts'
import { card } from './core/card.ts'
import { formatFindings } from './core/findings.ts'
import { build } from './core/index.ts'
import { maskPrivacy } from './core/privacy.ts'
import { parseSettings } from './core/settings.ts'
import { formatInventory, inventory, notRead, withoutNode } from './core/survey.ts'
import { initFiles } from './core/templates.ts'
import type { BuildOutput, PageData, Settings } from './core/types.ts'

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

// Reads the repository and builds. The view may read the clock; the page may not. branchLine false: the view has no
// branch line and no duties line, for the store, which puts both in when it serves the view (second check, finding 15).
async function load($: EngineInterface, branchLine = true): Promise<Loaded> {
  const root = await repoRoot($)
  const file = `${root}/${SETTINGS}`
  const r = await readInput($, root, (await $.fs.exists(file)) ? await $.fs.read(file) : null)
  if ('error' in r) return r
  const out = build(r.input)
  const findings = [...r.findings, ...out.findings]
  const today = new Date(await $.clock.now()).toISOString().slice(0, 10)
  const main = r.input.settings.mainBranch
  out.brief = brief(out.data, { today: branchLine ? today : undefined, branch: branchLine ? r.branch : undefined, behindRemote: r.behindRemote, main })
  return { root, out, sha: r.input.head.sha, text: formatFindings(findings), failed: findings.some(f => f.level === 'error'), project: r.input.settings.project,
    on: { branch: onBranch(r.branch, main, 'check read').join(''), behind: behind(r.behindRemote, main) } }
}

function statusLine(out: BuildOutput): string {
  const lane = out.data.lanes[0]
  const next = lane?.stations.find(s => s.milestone === lane.next)
  // a lane with no stations has none to reach, as the short view says (finding 26)
  const where = !lane ? 'no route' : next ? `${next.milestone}, ${next.stops.length} stops` : lane.stations.length ? 'all reached' : 'no milestone yet'
  return `${out.data.counts.yes} land now · ${out.data.counts.needYou} need you · next: ${where}`
}

// duties: the duty rows a stored view keeps, so the day's are worked out when it is served
type View = { brief: string; status: string; duties?: PageData['duties'] }
// the rebuilds under way, by stamp: one walk however many ask; and the last that failed, with its first line, so a
// prompt is told why and starts no second walk for it (HK-088)
// announced: by store key and settings text, the main commit the after-commit line last named, so one change of the
// records is said once however many git commands follow it (the Phase 3 check)
type Builds = { running: Map<string, Promise<View | null>>; failed: Map<string, { line: string; at: number; view?: View }>; announced: Map<string, string> }
type Kept = View & { sha: string; stamp: string }
type Views = { order: string[]; views: Record<string, Kept> }
// shortcut: more than VIEWS settings texts in use at once (worktrees, say) rebuild at every prompt; raise VIEWS if
// that happens. 16 views of a large repository's short view are about 60 KB of the 4 MiB store (HK-093)
const VIEWS = 16
// a stored entry as it is meant to be, or none: an older form or a damaged one is read as none, never thrown on (HK-093)
const viewsOf = (v: unknown): Views => {
  const o = v as Partial<Views> | null | undefined
  const views = o && typeof o.views === 'object' && o.views && !Array.isArray(o.views) ? o.views : {}
  const ok = (x: unknown): x is string => typeof x === 'string' && typeof views[x]?.stamp === 'string' && typeof views[x]?.brief === 'string' &&
    Array.isArray(views[x]?.duties)
  return { order: Array.isArray(o?.order) ? o!.order.filter(ok) : [], views }
}
// the stored view's form, in its stamp: a new form rebuilds each stored view once (0.2.0's stamp had none)
const VIEW_FORMAT = 'view 2'
const RETRY_MS = 60_000 // a failed rebuild is tried again after this, so the cure the stop names takes effect
// FNV-1a: a short name for a settings text, for the store key
const fnv = (s: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16)
}

const BUILDING = 'housekeeping: the short view is being built and is not ready yet; /housekeeping shows it once it is.'

// The short view and the status line, kept in $.store by repository with what they were built from. While main's
// commit, its remote copy's commit and the settings are as they were, a few git rev-parse calls are all they cost. The
// day is not in the stamp (HK-035): the branch line (HK-088) and "Duties due" (Phase 3) are put in when it is served.
// wait false, for prompt.context (finding 20): the walk is never awaited, since its time would count against that
// hook's budget; the last stored view stands in, labelled with its commit, while the rebuild runs, or with nothing
// stored the view says it is being built.
async function cachedView($: EngineInterface, builds: Builds, wait = true): Promise<View | null> {
  const root = await repoRoot($)
  const file = `${root}/${SETTINGS}`
  if (!(await $.fs.exists(file))) return null
  const text = await $.fs.read(file)
  const main = parseSettings(text).settings?.mainBranch
  if (!main) return null
  // one call: the common git dir (the repository's key, as repoKey reads it), main's commit, then the branch
  const r = await $.process.run(['git', 'rev-parse', '--git-common-dir', main, '--abbrev-ref', 'HEAD'], { cwd: root, timeoutMs: 10_000 })
  const [dir, sha, branch] = r.stdout.split('\n').map(x => x.trim())
  const remote = (await $.process.run(['git', 'rev-parse', '--verify', '--quiet', `refs/remotes/origin/${main}`], { cwd: root, timeoutMs: 10_000 }).catch(() => null))?.stdout.trim() ?? ''
  // a repository's views under one key, one per settings text, the latest VIEWS of them, so worktrees whose settings
  // differ keep theirs and the store stays bounded (HK-091, HK-092); an entry of an older form is read as none
  const key = `brief:${commonDir(root, dir)}`, id = fnv(text), stamp = [VIEW_FORMAT, sha, remote, text].join('\n')
  const keep = r.exitCode === 0 && !!sha // main resolves, so the view can be stored
  const stored = keep ? viewsOf(await $.store.get(key)) : undefined
  const hit = stored?.order.includes(id) ? stored.views[id] : undefined
  // stored with no branch line and no duties line, served with this checkout's branch (second check, finding 15) and
  // the day's duties; with nothing to store (an unborn HEAD, say, whose rev-parse names no branch) the load's own lines stand
  const today = new Date(await $.clock.now()).toISOString().slice(0, 10)
  const on = (v: View) => keep ? withBranch(v.duties ? withDuties(v.brief, v.duties, today) : v.brief, branch, main) : v.brief
  if (hit?.stamp === stamp) return { brief: on(hit), status: hit.status }
  const fresh = async () => {
    // a load that rejects (git past its time, a store that fails) is a failure too, said and retried as one (HK-091)
    const l = await load($, !keep).catch(err => ({ error: `housekeeping: ${err instanceof Error ? err.message : String(err)}` }))
    if ('error' in l) {
      if (keep) { builds.failed.clear(); builds.failed.set(stamp, { line: l.error.split('\n')[0], at: await $.clock.now() }) }
      return null
    }
    builds.failed.delete(stamp)
    const v = { brief: l.out.brief, status: statusLine(l.out), duties: l.out.data.duties }
    if (keep) {
      // shortcut: two builds at once for two settings texts each write over the other's list, so one view is lost and
      // built again at its next prompt; fine while such builds are rare, a lock per key if they are not
      const now = viewsOf(await $.store.get(key))
      const views: Record<string, Kept> = { ...now.views, [id]: { sha, stamp, ...v } }
      const order = [id, ...now.order.filter(x => x !== id)].slice(0, VIEWS)
      // a refused write (a full store, say) keeps the view it built, said with the reason, and prompts do not walk
      // again at every turn (HK-092, HK-093)
      const refused = await $.store.set(key, { order, views: Object.fromEntries(order.map(x => [x, views[x]])) })
        .then(() => null, (err: unknown) => err instanceof Error ? err.message : String(err))
      if (refused) builds.failed.set(stamp, { line: `the short view was built but could not be stored: ${refused}`, at: await $.clock.now(), view: v })
    }
    return { ...v, brief: on(v) }
  }
  if (!keep) return fresh() // nothing to store or serve: main does not resolve, so the load stops before any walk
  // a recent failure is said, with no walk; one older than RETRY_MS is said while it is tried again, on every route,
  // so git commands after a failure do not each walk the history again (the Phase 3 check)
  const failed = builds.failed.get(stamp)
  const retry = !failed || (await $.clock.now()) - failed.at >= RETRY_MS
  let build = builds.running.get(stamp)
  if (!build && retry) {
    build = fresh().finally(() => builds.running.delete(stamp))
    build.catch(() => {}) // handled where it is made: a prompt may return before it settles (HK-091)
    builds.running.set(stamp, build)
  }
  if (!wait && failed?.view) return { brief: `housekeeping: ${failed.line}\n${on(failed.view)}`, status: failed.view.status }
  if (!wait && failed) return hit ? { brief: `Stored view of ${main} at ${hit.sha.slice(0, 7)}; a new one could not be built: ${failed.line}\n${on(hit)}`, status: hit.status }
    : { brief: `housekeeping: the short view could not be built: ${failed.line}`, status: '' }
  if (!build) return null
  if (wait) return build
  build.catch(() => {}) // a failed rebuild leaves the stored view; the next ask tries again
  return hit ? { brief: `Stored view of ${main} at ${hit.sha.slice(0, 7)}, shown while a new one is built.\n${on(hit)}`, status: hit.status }
    : { brief: BUILDING, status: '' }
}

// The repository's top, its settings text and its settings; else why not, for the debug line
async function settingsAt($: EngineInterface): Promise<{ root: string; text: string; s: Settings } | string> {
  const root = await repoRoot($), file = `${root}/${SETTINGS}`
  if (!(await $.fs.exists(file))) return 'no settings file'
  const text = await $.fs.read(file), s = parseSettings(text).settings
  return s ? { root, text, s } : 'the settings file does not parse'
}
const recordsSpec = (s: Settings) => ['--', `:(literal)${s.files.backlog.path}`, `:(literal)${s.files.playbook.path}`]
// exits 1 when the records differ between two commits, 0 when they do not
const quietDiff = ($: EngineInterface, root: string, s: Settings, a: string, b: string) =>
  $.process.run(['git', 'diff', '--quiet', '--no-ext-diff', '--end-of-options', a, b, ...recordsSpec(s)], { cwd: root, timeoutMs: 10_000, env: OWED_ENV })

// Phase 3 call 16: one masked line per automatic firing, to the debug log alone: the hook, its outcome (with a
// 7-character sha and counts where it has them) and its milliseconds; never a row's text or a path
async function debug($: EngineInterface, hook: string, outcome: string, t0: number): Promise<void> {
  $.ui.log(maskPrivacy(`housekeeping ${hook}: ${outcome} (${(await $.clock.now()) - t0} ms)`), { to: 'debug' })
}
// an automatic part run in the background, its outcome put in the debug log; whatever fails in it stays in it, so it
// never costs the hook that started it, and is logged by its error's name alone, which holds no path (the Phase 3 check)
const failure = (err: unknown) => `failed: ${err instanceof Error ? err.name : 'error'}`
const fired = ($: EngineInterface, hook: string, work: () => Promise<string>): void => {
  (async () => { const t0 = await $.clock.now(); await debug($, hook, await work().catch(failure), t0) })().catch(() => {})
}
const at7 = (sha: string) => sha.slice(0, 7)

// After a commit, a merge or a pull on the Bash and PowerShell tools (Phase 3, Task 4), for a git command that ran in the
// foreground: where main moved past the stored view's commit and the records changed between the two, the view is
// rebuilt without waiting, the status line follows when it lands, and the main loop is told in one line. It answers the
// tool's result, with that line or as it came, and its outcome.
async function afterGit($: EngineInterface, builds: Builds, e: { agentId?: string }, got: { result?: unknown; context?: readonly string[] }):
  Promise<[typeof got, string]> {
  if (((got.result ?? {}) as { backgroundTaskId?: unknown }).backgroundTaskId) return [got, 'run in the background, nothing read']
  const at = await settingsAt($)
  if (typeof at === 'string') return [got, at]
  const { root, text, s } = at
  const v = await $.process.run(['git', 'rev-parse', '--git-common-dir', s.mainBranch], { cwd: root, timeoutMs: 10_000 })
  const [dir, sha] = v.stdout.split('\n').map(x => x.trim())
  if (v.exitCode !== 0 || !sha) return [got, 'main does not resolve']
  const key = `brief:${commonDir(root, dir)}`, id = fnv(text)
  const old = viewsOf(await $.store.get(key)).views[id]?.sha
  if (typeof old !== 'string') return [got, `main at ${at7(sha)}, no stored view`]
  if (old === sha) return [got, `main at ${at7(sha)}, as the stored view`]
  const d = (await quietDiff($, root, s, old, sha)).exitCode
  if (d !== 1) return [got, `main at ${at7(sha)}, ${d === 0 ? `the records unchanged since ${at7(old)}` : `git diff exited ${d}`}`]
  // not awaited: the agent's next step never waits on the walk, which one already running or a recent failure skips
  cachedView($, builds).then(x => { if (x) $.ui.status(x.status) }).catch(() => {})
  const said = `main at ${at7(sha)}, the records changed since ${at7(old)}: rebuilding`
  if (e.agentId !== undefined) return [got, `${said}, in a subagent: no line`]
  if (builds.announced.get(`${key}#${id}`) === sha) return [got, `${said}, already said`]
  builds.announced.set(`${key}#${id}`, sha)
  return [{ ...got, context: [...(got.context ?? []), maskPrivacy(`The records on ${s.mainBranch} changed at ${at7(sha)}; /housekeeping shows the new view.`)] }, `${said}, line added`]
}

// At the main loop's turn end (Phase 3 call 5): /loose-ends is suggested once per HEAD, when three or more commits follow
// the last one that touched the records and neither file has uncommitted edits. The HEADs it was shown at, each with its
// worktree's top, the latest NUDGED of them, are kept under their own key, nudge:<repository key>, beside the Route Map
// link's repo:<repository key>; a suggestion the prompt box did not show is not kept, so the next turn end tries again.
const NUDGED = 32
async function nudge($: EngineInterface): Promise<string> {
  const at = await settingsAt($)
  if (typeof at === 'string') return at
  const { root, s } = at
  const git = (argv: string[]) => $.process.run(['git', ...argv], { cwd: root, timeoutMs: 10_000, env: OWED_ENV })
  const h = await git(['rev-parse', '--git-common-dir', 'HEAD'])
  const [dir, head] = h.stdout.split('\n').map(x => x.trim())
  if (h.exitCode !== 0 || !head) return 'HEAD does not resolve'
  const key = `nudge:${commonDir(root, dir)}`, here = `${root}\n${head}`
  // an older form (a single HEAD) is read as none
  const kept = ((v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])(await $.store.get(key))
  if (kept.includes(here)) return `already suggested at ${at7(head)}`
  const st = await git(['status', '--porcelain', ...recordsSpec(s)])
  if (st.exitCode !== 0 || st.stdout.trim()) return `${at7(head)}, ${st.exitCode ? `git status exited ${st.exitCode}` : 'the records have uncommitted edits'}`
  const last = await git(['log', '-1', '--no-show-signature', '--format=%H', '--end-of-options', 'HEAD', ...recordsSpec(s)])
  if (last.exitCode !== 0) return `${at7(head)}, git log exited ${last.exitCode}`
  const n = await git(['rev-list', '--count', '--end-of-options', last.stdout.trim() ? `${last.stdout.trim()}..HEAD` : 'HEAD', '--'])
  const since = Number(n.stdout.trim())
  if (n.exitCode !== 0 || !(since >= 3)) return `${at7(head)}, ${n.exitCode ? `git rev-list exited ${n.exitCode}` : `${since} commits since the records, fewer than 3`}`
  // awaited here, in the background after the turn's end, which never waits on it (call 5)
  const shown = (await $.prompt.suggest({ text: '/loose-ends' })).isShown
  if (!shown) return `/loose-ends not shown at ${at7(head)}, ${since} commits since the records`
  await $.store.set(key, [here, ...kept.filter(x => x !== here)].slice(0, NUDGED))
  return `/loose-ends suggested at ${at7(head)}, ${since} commits since the records`
}

// At session start (Phase 3, Task 4): where a Route Map link is stored and the records on main changed since the commit
// it was published at, one line in the transcript says so; with no link stored, nothing is read
async function staleMap($: EngineInterface): Promise<string> {
  const at = await settingsAt($)
  if (typeof at === 'string') return at
  const { root, s } = at
  const known =(await $.store.get(`repo:${await repoKey($, root)}`)) as { url?: unknown; sha?: unknown } | undefined
  if (!known?.url || typeof known.sha !== 'string') return 'no Route Map link stored'
  const d = (await quietDiff($, root, s, known.sha, s.mainBranch)).exitCode
  if (d !== 1) return d === 0 ? `the Route Map at ${at7(known.sha)} matches the records` : `git diff exited ${d}`
  $.ui.log(maskPrivacy(`The Route Map is older than the records on ${s.mainBranch}: /housekeeping map publishes it.`))
  return `the Route Map at ${at7(known.sha)} is older than the records: line added`
}

// The records card, from the settings alone: none where there is no settings file, or one that does not parse
async function records($: EngineInterface): Promise<string | null> {
  const file = `${await repoRoot($)}/${SETTINGS}`
  const s = (await $.fs.exists(file)) ? parseSettings(await $.fs.read(file)).settings : null
  return s ? card(s) : null
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

// A procedure handed to the agent: its prompt file (cut, for the survey with a file denied), the sentence that says
// where housekeeping lives, then what goes with it. It reads no tracked file: the inventory is survey's and plan's.
export async function handPrompt($: EngineInterface, name: string, install: string, extra: string[], cut = (t: string) => t): Promise<string[]> {
  return [cut(await $.fs.read(`${$.plugin.root}/prompts/${name}.md`)), install, ...extra]
}

// survey and plan: the procedure, then the inventory, for the agent to follow; plan adds check's findings when
// there are settings. Neither writes anything.
async function procedure($: EngineInterface, arg: 'survey' | 'plan', named?: { tracker: string[]; notTracker: string[] }):
  Promise<{ text: string; exitCode?: number; context?: string[] }> {
  const root = await repoRoot($)
  const t = await readTracked($, root, named)
  if ('error' in t) return { text: t.error, exitCode: 1 }
  const inv = inventory(t.files, t.skipped, { denied: t.denied, outside: t.outside, ...t.named })
  // where housekeeping lives, which the procedures need for the Node command and FORMAT.md (finding 22). With a file
  // denied, no Node command: it ignores the Read rules, so the re-run is the person's slash command (second check, finding 1)
  const home = $.plugin.root
  // the files outside the session's folder are said as such: no rule denied them (HK-088)
  const kept = [t.denied > t.outside && "files the person's Read rules deny",
    t.outside && "files outside the folder this session started in, where the Read rules of the repository's top are not in force"]
  const where = inv.denied ? `housekeeping is installed at ${home}; read its row format in ${home}/FORMAT.md. Not measured counts ` +
    `${kept.filter(Boolean).join(' and ')}, and housekeeping's Node command ignores the Read rules wherever it runs: do not run its survey ` +
    'in this session. To survey again with --tracker and --not-tracker, ask the person to run /housekeeping survey --tracker <path> ' +
    '--not-tracker <path>, which obeys the rules.'
    : `housekeeping is installed at ${home}: run its Node command as node ${home}/cli.ts (survey takes --tracker and --not-tracker), ` +
    `and read its row format in ${home}/FORMAT.md.`
  const context = await handPrompt($, arg, where, [formatInventory(inv)], inv.denied && arg === 'survey' ? withoutNode : undefined)
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
  // second check, finding 4: a session started below the top cannot apply the top's Read rules
  const outside = t.outside ? `\n${t.outside} files outside the folder this session started in were not read, since the repository's ` +
    `Read rules are not in force here: start the session at the top of the repository, ${root}, to survey them.` : ''
  // the command starts no agent turn, so the reply says what comes next (the owner, 2026-11-04: "Say what's next")
  const next = `The agent carries out the ${arg} procedure on your next message, for example "go ahead".`
  return { text: `housekeeping ${arg}: ${inv.files} files read, ${inv.candidates.length} candidates${none}${stopped}${outside}\n${next}`, context }
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

const OWED_USAGE = 'housekeeping: owed [--base <ref>] [--head <ref>]'
const thrown = (err: unknown) => ({ error: `housekeeping: ${err instanceof Error ? err.message : String(err)}` })

// owed's and the audit's settings, their git (no locks, no fetch) and the person's Read rules; exit 2 with no settings
async function owedReads($: EngineInterface): Promise<{ settings: Settings; git: Git; allow: (path: string) => Promise<boolean> } | { text: string; exitCode: number }> {
  const root = await repoRoot($), file = `${root}/${SETTINGS}`
  const p = (await $.fs.exists(file)) ? parseSettings(await $.fs.read(file)) : null
  if (!p?.settings) return { text: p ? formatFindings(p.findings) : 'housekeeping: no .housekeeping.json here (run /housekeeping init)', exitCode: 2 }
  return { settings: p.settings, git: argv => $.process.run(['git', ...argv], { cwd: root, timeoutMs: 60_000, env: OWED_ENV }), allow: await readRule($, root) }
}

// /housekeeping owed (Phase 3, Task 2): the listing as the reply; exit 2 on a usage error, a stop or a git error. Every
// changed path is put to the person's Read rules; checked hears how many were excluded once all the checks are done.
async function owed($: EngineInterface, rest: string, checked: (excluded: number) => void): Promise<{ text: string; exitCode?: number }> {
  const w = rest.split(/\s+/).filter(Boolean), o: { base?: string; head?: string } = {}
  for (let i = 0; i < w.length; i += 2) {
    const k = w[i] === '--base' ? 'base' : w[i] === '--head' ? 'head' : null
    if (!k || w[i + 1] === undefined || k in o) return { text: OWED_USAGE, exitCode: 2 }
    o[k] = w[i + 1]
  }
  const g = await owedReads($)
  if ('text' in g) return g
  const r = await readOwed(g.git, g.settings, { ...o, allow: g.allow, checked }).catch(thrown)
  return 'error' in r ? { text: r.error, exitCode: 2 } : { text: r.text }
}

// /housekeeping audit (Phase 3, Task 3): the procedure, the sentence that says where it is, and owed's listing over
// auditStart's range under the same Read rules; it writes nothing. Exit 2 on a stop or a git error, as owed.
async function audit($: EngineInterface, checked: (excluded: number) => void): Promise<{ text: string; exitCode?: number; context?: string[] }> {
  const g = await owedReads($)
  if ('text' in g) return g
  const r = await readAudit(g.git, g.settings, { allow: g.allow, checked }).catch(thrown)
  if ('error' in r) return { text: r.error, exitCode: 2 }
  if ('idle' in r && r.idle) return { text: r.text } // nothing after the start: no procedure is handed (the Phase 3 check)
  const home = $.plugin.root
  // the procedure's commands carry the install folder in single quotes, which any single-quote character ends in
  // PowerShell (the Phase 3 re-check)
  if (/['‘’‚‛\p{Cc}]/u.test(home)) return { text: "housekeeping: the folder housekeeping is installed in holds a quote, which the audit's commands cannot carry; the audit stops.", exitCode: 2 }
  return { text: `${r.text.split('\n')[0]}\nThe agent carries out the audit procedure on your next message, for example "go ahead".`,
    context: await handPrompt($, 'audit', `housekeeping is installed at ${home}; the audit procedure is ${home}/prompts/audit.md.`, [r.text]) }
}

// room: the pane docks beside the transcript, which the fullscreen layout does from 110 columns; elsewhere it is
// placed inline above the prompt, where a few of the view's lines show (finding 19)
async function command($: EngineInterface, arg: string, show: (brief: string) => void, room: boolean, checked: (excluded: number) => void):
  Promise<{ text: string; exitCode?: number; context?: string[] }> {
  if (arg === 'init') return init($)
  if (arg === 'plan') return procedure($, arg)
  if (/^owed(?:\s|$)/.test(arg)) return owed($, arg.slice(4), checked)
  if (arg === 'audit') return audit($, checked)
  const named = /^survey(?:\s|$)/.test(arg) ? surveyArgs(arg.slice(6)) : null
  if (named) return procedure($, 'survey', named)
  if (!['', 'check', 'map', 'map new'].includes(arg)) return { text: 'housekeeping: [map | map new | check | init | survey [--tracker <path>] [--not-tracker <path>] | plan | owed [--base <ref>] [--head <ref>] | audit]; no argument opens the short view' }
  const l = await load($)
  if ('error' in l) return { text: l.error, exitCode: 1 }
  if (arg === 'check') return { text: [l.on.branch, ...l.on.behind, l.text].filter(Boolean).join('\n'), exitCode: l.failed ? 1 : 0 }
  if (arg === '') {
    show(l.out.brief)
    $.ui.invalidate('ui.render') // a pane already open draws the new view (finding 18)
    const pane = await $.ui.open({ id: 'housekeeping', title: 'housekeeping' })
    $.ui.status(statusLine(l.out))
    // no pane placed, or one with no room: the person would see nothing or a part, so the brief comes back as text (HK-029).
    // The hook knows the width only, so a docked pane may still be too short: the reply says how to reach the rest and
    // repeats the view's last line (second check, finding 16).
    const docked = 'housekeeping: short view open. Where the pane is too short for all of it, the wheel, or ctrl+x then Tab, ' +
      `reaches the rest. Its last line:\n${l.out.brief.split('\n').at(-1)}`
    return { text: pane.isPlaced && room ? docked : l.out.brief }
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

// Each procedure's rule on approval, which a compaction keeps word for word (Phase 3 call 15): survey's and plan's as
// 0.2.0 wrote them, which the owner's sitting tests (HK-080, call 12). owed has none, so it is never recorded.
const RULE = "Approval is the owner's own message, sent after they have seen the numbered steps. Nothing else is approval, and " +
  'nothing is written before it.'
const KEEP: Record<string, string> = { survey: RULE, plan: RULE,
  audit: "Approval is the owner's own message, sent after they have seen the numbered steps; only clear-cut cases the skeptic " +
    "agreed with are proposed; after this summary, read the audit branch's commits before applying anything, so nothing is applied twice." }
const DENIED = /do not run its survey in this session/
type Sent = { install: string }

// What a compaction's summary is told once a procedure went to the agent (second check, finding 13): the procedure
// and the install line are hidden messages its summary could drop, and with them the approval and apply rules.
export function keep(home: string, sent: Map<string, Sent>): string {
  const all = [...sent], names = all.map(([n]) => n), files = names.map(n => `${home}/prompts/${n}.md`), s = names.length > 1 ? 's' : ''
  // survey and plan keep one install sentence between them: the last sent, or the denied form whenever one was sent, so
  // a later one that names the Node command never stands beside it (call 15); audit keeps its own
  const pair = all.filter(([n]) => n !== 'audit')
  const kept = [pair.findLast(([, x]) => DENIED.test(x.install)) ?? pair.at(-1), all.find(([n]) => n === 'audit')]
    .filter((x): x is [string, Sent] => x !== undefined)
  const one = ([n, x]: [string, Sent]) => `${kept.length > 1 ? `In the ${n} procedure: ` : ''}Keep in the summary, word for word, ` +
    `this sentence: ${x.install} Keep the procedure's rule on approval: ${KEEP[n]}`
  return `housekeeping: this conversation was handed housekeeping's ${names.join(' and ')} procedure${s}. ${kept.map(one).join(' ')} ` +
    `Say in the summary that the agent is to re-read the ${names.join(' and ')} procedure${s} whole, in ${files.join(' and ')}, before its next step.` +
    // the survey's file holds the Node lines its denied context had cut (HK-088); plan's are sent whole (HK-091)
    (DENIED.test(sent.get('survey')?.install ?? '') ? " In this session the survey procedure's lines " +
      "that name cli.ts do not apply: the survey's re-run is the person's /housekeeping survey." : '')
}

// What the main conversation's summary is asked to keep where the settings file exists (Phase 3 call 6): what this
// conversation has not yet filed, under its own heading, at most 40 lines, so it cannot crowd the summary out
const UNFILED = 'housekeeping: keep in the summary, under the heading "Not yet filed into the backlog or playbook", one line per item ' +
  "of this conversation not yet written into the backlog or the playbook (each deferral, action item and decision), the owner's " +
  'decisions word for word; at most 40 lines, then "and N more: run /loose-ends".'
const unfiledAt = async ($: EngineInterface): Promise<string> => ((await $.fs.exists(`${await repoRoot($)}/${SETTINGS}`)) ? UNFILED : '')

// The reply of a command hook that failed outside its own promise, past its 10 s budget above all (finding 11): exit 1,
// and the Node form to run, which has no time limit. owed's ignores the Read rules, so it is named only after a run
// whose Read checks all finished with nothing excluded; otherwise the reply says to run the slash command again.
// The audit's reply names its procedure, which has no Node form of its own, and the Node owed under owed's rule (Phase 3, Task 3).
const NOT_CLEAR = "housekeeping's Node command ignores the Read rules, and this run's Read checks did not all finish with nothing excluded"
export function failedReply(home: string, args: string, why: string, owedClear: boolean): { text: string; exitCode: number } {
  const word = args.split(/\s/)[0], said = `housekeeping: /housekeeping${args ? ` ${args}` : ''} ${why}; `
  if (word === 'owed' && !owedClear) return { text: `${said}run /housekeeping owed again: ${NOT_CLEAR}`, exitCode: 1 }
  const at = `the audit procedure is ${home}/prompts/audit.md`
  if (word === 'audit') return { exitCode: 1, text: owedClear
    ? `${said}${at}: follow it outside Claude Code, with node ${home}/cli.ts owed in the repository, which has no time limit`
    : `${said}run /housekeeping audit again: ${NOT_CLEAR}; ${at}` }
  const as = word === '' ? 'brief' : ['map', 'check', 'survey', 'owed'].includes(word) ? word : word === 'plan' ? 'survey' : '<map|check|brief|survey|owed>'
  return { text: `${said}run node ${home}/cli.ts ${as} in the repository instead, which has no time limit`, exitCode: 1 }
}

export const register: Register = (on, options) => {
  // Phase 3 call 8: "off" stops the after-commit rebuild and its line, the /loose-ends suggestion, the stale-map line
  // and the debug lines; the compaction paragraph and the records card stay. "on" is the default.
  // off, false, no or 0, in any case and with spaces around it, all read as off (the Phase 3 check)
  const automatic = !/^(off|false|no|0)$/i.test(String(options?.automatic ?? 'on').trim())
  let view = 'housekeeping: run /housekeeping to build the short view.'
  const builds: Builds = { running: new Map(), failed: new Map(), announced: new Map() }
  // the procedures sent in this conversation, each with its install sentence (second check, finding 13)
  const sent = new Map<string, Sent>()
  // per run of the command: whether owed's Read checks all finished with nothing excluded, for the failed reply
  let owedClear = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'housekeeping', description: 'Pending work in one place: short view, map, map new, check, init, survey, plan, owed, audit.',
      argumentHint: '[map|map new|check|init|survey [--tracker <path>] [--not-tracker <path>]|plan|owed [--base <ref>] [--head <ref>]|audit]' })
    const got = await next(e)
    // not awaited: a slow repository must not hold up the session, nor the stale-map check the first prompt
    cachedView($, builds).then(v => { if (v) $.ui.status(v.status) }).catch(() => {})
    if (automatic) fired($, 'session start', () => staleMap($))
    return got
  })

  on('command.run', { command: 'housekeeping' }, async ($, e) => {
    owedClear = false // first, so a run that fails at once never inherits the last one's
    // a throw anywhere below still gives the person a reply (HK-031)
    const room = e.presentation.isFullscreen && e.presentation.columns >= 110
    const r = await command($, e.args.trim(), b => { view = b }, room, n => { owedClear = n === 0 })
      .catch(err => ({ text: `housekeeping: ${err instanceof Error ? err.message : String(err)}`, exitCode: 1 } as { text: string; exitCode?: number; context?: string[] }))
    // only a procedure comes with context: the procedure, then the sentence that says where housekeeping lives
    const name = e.args.trim().split(/\s/)[0]
    // the last one sent is last, with the sentence that stands; only a reply the site can take is recorded (HK-088), and
    // only a procedure with a rule to keep
    if (Object.hasOwn(KEEP, name) && r.context?.every(c => typeof c === 'string')) { sent.delete(name); sent.set(name, { install: r.context[1] }) }
    return r
  }).catch(($, e, next) => {
    const why = next.error.kind === 'timeout' ? 'ran past the 10 s a hook may take' : `failed in the hook (${next.error.message ?? 'no reason given'})`
    return failedReply($.plugin.root, e.args.trim(), why, owedClear)
  })

  // a fork inherits its parent's conversation, procedure and all, so its own compaction is told what it inherited: a
  // copy of the main conversation's record, or of its parent fork's; a fork of another subagent inherits none (HK-088,
  // HK-091)
  const forks = new Map<string, Map<string, Sent>>()
  on('agent.spawn', async ($, e, next) => {
    const got = await next(e)
    const from = e.parentAgentId ? forks.get(e.parentAgentId) : sent
    // only a new fork: a resumed one goes on from its own transcript and keeps the record it had, or none (HK-092)
    if (e.fork && !e.resume && from?.size && got && 'agentId' in got && got.agentId) forks.set(got.agentId, new Map(from))
    return got
  }).catch(($, e, next) => next(e)) // it gates every spawn: a failure here never stops one

  // On every trigger, precompute too, the main conversation's summary and a fork's are told to keep them; then the main
  // conversation's, where the settings file exists, what is not yet filed (call 6). Each paragraph is built apart, so a
  // failure in one keeps the other; with neither, or in another subagent's own compaction, it goes on as it came. Never
  // a skip: the compaction always runs, and a failure here passes it on as it came (HK-090).
  on('session.compact', async ($, e, next) => {
    const record = e.agentId ? forks.get(e.agentId) : sent
    let told = ''
    try { told = record?.size ? keep($.plugin.root, record) : '' } catch { /* the unfiled paragraph still goes */ }
    const unfiled = e.agentId ? '' : await unfiledAt($).catch(() => '')
    const add = [told, unfiled].filter(Boolean)
    if (automatic) fired($, 'compaction', async () => `${e.agentId ? 'a subagent' : 'the main conversation'}, ` +
      `${told ? `the procedure paragraph for ${record!.size}` : 'no procedure paragraph'}, ${unfiled ? 'the unfiled paragraph' : 'no unfiled paragraph'}`)
    return add.length ? next({ ...e, instructions: [e.instructions, ...add].filter(Boolean).join('\n\n') }) : next(e)
  }).catch(($, e, next) => next(e))

  // a /clear ends this conversation, and the next one holds no procedure; after a resume this hook no longer knows of
  // the one the resumed conversation may hold (HK-084)
  on('session.end', (_, e, next) => { sent.clear(); forks.clear(); return next(e) })

  // the command runs once, first and outside the try; only the work after it is guarded, and a failure there returns
  // the tool's own result. The .catch's next is replay-safe: it never runs the command again.
  on('tool.call', { tool: ['Bash', 'PowerShell'] }, async ($, e, next) => {
    const got = await next(e)
    let t0: number | null = null
    try {
      if (!automatic || got.deny !== undefined || !((got.result as { gitOperation?: unknown } | undefined)?.gitOperation || /\bgit\b/.test(String(e.command ?? '')))) return got
      t0 = await $.clock.now()
      const [out, said] = await afterGit($, builds, e, got)
      debug($, `${e.tool} call`, said, t0).catch(() => {})
      return out
    } catch (err) {
      // a firing that failed says so, by the error's name alone (the Phase 3 check)
      if (t0 !== null) debug($, `${e.tool} call`, failure(err), t0).catch(() => {})
      return got
    }
  }).catch(($, e, next) => next(e))

  // the main loop's answered turns only; not awaited, so the turn's end never waits on git
  on('turn.complete', async ($, e, next) => {
    const got = await next(e)
    if (automatic && e.agentId === undefined && e.reason === 'answer') fired($, 'turn end', () => nudge($))
    return got
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: 'housekeeping' }, ($, e) => {
    const { Markdown } = $.ui.resolve(e)
    return <Markdown text={view} />
  })

  on('prompt.context', async ($, e, next) => {
    const got = await next(e)
    // each one (the first, compaction, /clear) asks the cache, which never makes it wait on a walk (finding 20)
    const v = await cachedView($, builds, false).catch(() => null)
    // the records card, after the view and outside its 8,000 characters; a failure drops the card only (call 9)
    const c = await records($).catch(() => null)
    return { ...got, blocks: [...got.blocks, ...(v ? [{ name: 'housekeeping', text: v.brief }] : []),
      ...(c ? [{ name: 'housekeeping-records', text: c }] : [])] }
  })
}

// A stand-in for the few DOM features the page's script may use, so a test can run it with no browser. It is a
// port of the reference repository's test stub. Anything else an element, the document or the window is asked for
// throws, so the page cannot drift onto a feature the stub lacks (innerHTML, classList, querySelectorAll, ...).
// runPage evaluates the page's script text with new Function, so it runs under Node (node-tests/page.spec.ts):
// the plugin test kit allows no code from strings.
export const S = Symbol('stub')
type Listener = (e: unknown) => void
type Text = { data: string }
type Kid = El | Text
type Storage = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

const kid = (n: Kid | string): Kid => (typeof n === 'string' ? { data: n } : n)

export class El {
  [S]: { tag: string; attrs: Record<string, string>; kids: Kid[]; on: Record<string, Listener[]>; hidden: boolean }
  constructor(tag: string) { this[S] = { tag: tag.toLowerCase(), attrs: {}, kids: [], on: {}, hidden: false } }
  append(...n: (Kid | string)[]) { this[S].kids.push(...n.map(kid)) }
  replaceChildren(...n: (Kid | string)[]) { this[S].kids = n.map(kid) }
  setAttribute(k: string, v: unknown) { this[S].attrs[k] = String(v) }
  removeAttribute(k: string) { delete this[S].attrs[k] }
  addEventListener(k: string, f: Listener) { (this[S].on[k] ??= []).push(f) }
  focus() {}
  get children(): El[] { return this[S].kids.filter((k): k is El => k instanceof El) }
  get textContent(): string { return this[S].kids.map(k => (k instanceof El ? k.textContent : k.data)).join('') }
  set textContent(s: string) { this[S].kids = [{ data: String(s) }] }
  get hidden(): boolean { return this[S].hidden }
  set hidden(v: boolean) { this[S].hidden = !!v }
}

function guard<T extends object>(o: T, what: string, read: string[], write: string[] = []): T {
  return new Proxy(o, {
    get(t, k, r) {
      if (k === S || read.includes(k as string)) return Reflect.get(t, k, r)
      throw new Error(`the page read ${what}.${String(k)}, which the stub DOM does not provide`)
    },
    set(t, k, v, r) {
      if (write.includes(k as string)) return Reflect.set(t, k, v, r)
      throw new Error(`the page set ${what}.${String(k)}, which the stub DOM does not provide`)
    },
  })
}
const READ = ['append', 'replaceChildren', 'setAttribute', 'removeAttribute', 'addEventListener', 'textContent', 'children', 'hidden', 'focus']
const make = (tag: string) => guard(new El(tag), `<${tag}>`, READ, ['textContent', 'hidden'])

export const throwingStorage: Storage = guard({
  getItem: () => { throw new Error('no storage') }, setItem: () => { throw new Error('no storage') },
}, 'localStorage', ['getItem', 'setItem'])
export const memoryStorage = (): Storage => {
  const m = new Map<string, string>()
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)) } }
}

export const all = (e: El): El[] => [e, ...e.children.flatMap(all)]
export const attr = (e: El, k: string): string | undefined => e[S].attrs[k]
export const fire = (e: El, k: string, ev: unknown = { target: e }) => { for (const f of e[S].on[k] ?? []) f(ev) }

export type Page = { el: (id: string) => El | undefined; docOn: Record<string, Listener[]>; root: El }

// Runs the page's scripts. The elements with an id in the page's HTML are the ones querySelector finds.
export function runPage(html: string, storage: Storage = throwingStorage): Page {
  const byId = new Map<string, El>()
  for (const m of html.replace(/<script>[\s\S]*?<\/script>/g, '').matchAll(/\sid="([^"]+)"/g)) {
    const e = make('div')
    e[S].attrs.id = m[1]
    byId.set(m[1], e)
  }
  const docOn: Record<string, Listener[]> = {}
  const root = make('html')
  const document = guard({
    documentElement: root,
    createElement: (tag: string) => make(tag),
    createTextNode: (s: string): Text => ({ data: String(s) }),
    querySelector: (q: string) => {
      const m = /^#([\w-]+)$/.exec(q)
      if (!m) throw new Error(`querySelector takes only "#id" here, not ${q}`)
      return byId.get(m[1]) ?? null
    },
    addEventListener: (k: string, f: Listener) => { (docOn[k] ??= []).push(f) },
  }, 'document', ['documentElement', 'createElement', 'createTextNode', 'querySelector', 'addEventListener'])
  const window = guard({ DATA: null as unknown }, 'window', ['DATA'], ['DATA'])
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
    new Function('window', 'document', 'localStorage', m[1])(window, document, storage)
  return { el: id => byId.get(id), docOn, root }
}

// Shows every tab; in each, chooses every option of every select, then clicks everything that listens for a click.
// Then the markers, the drawer's body and its close controls, and Escape. Errors are collected, not thrown.
// `views` holds each tab's elements as first drawn; `opened` the rows the drawer showed.
export function clickAll(html: string) {
  const pg = runPage(html)
  const errors: string[] = []
  const views = new Map<string, El[]>()
  const opened = new Set<string>()
  const missing = ['tabs', 'views', 'markers', 'dkind', 'dbody', 'dclose', 'scrim'].filter(id => !pg.el(id))
  if (missing.length) return { errors: [`the page has no #${missing.join(', #')}`], views, opened }
  const el = (id: string) => pg.el(id)!
  const attempt = (what: string, f: () => void) => { try { f() } catch (e) { errors.push(`${what}: ${String(e)}`) } }
  const click = (e: El) => {
    fire(e, 'click')
    const t = el('dkind').textContent
    if (t) opened.add(t.split(' \u00b7 ')[0])
  }
  for (const tab of el('tabs').children) attempt(attr(tab, 'id') ?? '?', () => {
    fire(tab, 'click')
    views.set(attr(tab, 'id') ?? '?', el('views').children.flatMap(all))
    for (const sel of all(el('views')).filter(e => e[S].tag === 'select'))
      for (const o of sel.children) fire(sel, 'change', { target: { value: attr(o, 'value') } })
    for (const e of all(el('views'))) click(e)
  })
  for (const id of ['markers', 'dbody']) attempt(id, () => { for (const e of all(el(id))) click(e) })
  attempt('close', () => {
    click(el('dclose'))
    click(el('scrim'))
    for (const f of pg.docOn.keydown ?? []) f({ key: 'Escape' })
  })
  return { errors, views, opened }
}

// The causal graph and its feedback loops. Pure: plain data in, plain data out.
//
// Vertices are variables (stocks, auxiliaries, constants) and flows (rates). Edges are information
// links (signed by the author) plus one edge per flow-to-stock connection, whose sign is derived:
// a flow that fills a stock is +, a flow that drains it is − (Sterman 2000, Table 5-1).
// Elementary cycles are enumerated with Johnson's algorithm (Johnson 1975), capped so the hook
// stays inside its time budget.

export type Sign = 1 | -1

export type Edge = {
  from: string
  to: string
  sign: Sign
  /** The link id, or the flow id for a flow-to-stock edge. */
  via: string
  viaKind: 'link' | 'flow'
  /** Any status. The live graph holds observed and modelled edges; the full graph adds intended and missing ones, to find loops that would exist if built. */
  status: string
}

export type Cycle = {
  /** Vertices in traversal order, rotated so the lowest-ranked vertex comes first. */
  nodes: string[]
  /** edges[i] runs nodes[i] → nodes[(i + 1) % n]. */
  edges: Edge[]
  sign: Sign
  /** Rotation-normalised identity, e.g. "a>b>c". */
  key: string
}

export type CycleResult = { cycles: Cycle[]; truncated: boolean }

/** Rotate a cyclic sequence so its lowest-ranked element comes first. */
export function rotateToMin(seq: string[], rank: (id: string) => number): string[] {
  if (seq.length === 0) return []
  let best = 0
  for (let i = 1; i < seq.length; i++) if (rank(seq[i]) < rank(seq[best])) best = i
  return [...seq.slice(best), ...seq.slice(0, best)]
}

/**
 * All elementary cycles of a directed graph without self-loops or parallel edges.
 * `maxCycles` and `maxSteps` bound the work; `truncated` says a bound was hit.
 */
export function enumerateCycles(
  vertices: readonly string[],
  edges: readonly Edge[],
  maxCycles = 2000,
  maxSteps = 2_000_000,
): CycleResult {
  const order = [...new Set(vertices)].sort()
  const index = new Map(order.map((v, i) => [v, i]))
  const out: Edge[][] = order.map(() => [])
  for (const e of edges) {
    const a = index.get(e.from)
    const b = index.get(e.to)
    if (a === undefined || b === undefined || a === b) continue
    out[a].push(e)
  }
  const n = order.length
  const cycles: Cycle[] = []
  let steps = 0
  let truncated = false

  // Tarjan's SCC over the subgraph induced by vertices with index >= lo.
  const sccOf = (lo: number): number[] => {
    const idx = new Array<number>(n).fill(-1)
    const low = new Array<number>(n).fill(0)
    const onStack = new Array<boolean>(n).fill(false)
    const stack: number[] = []
    let counter = 0
    let found: number[] = []
    const strong = (v: number): void => {
      idx[v] = low[v] = counter++
      stack.push(v); onStack[v] = true
      for (const e of out[v]) {
        const w = index.get(e.to)!
        if (w < lo) continue
        if (idx[w] === -1) { strong(w); low[v] = Math.min(low[v], low[w]) }
        else if (onStack[w]) low[v] = Math.min(low[v], idx[w])
      }
      if (low[v] === idx[v]) {
        const comp: number[] = []
        let w: number
        do { w = stack.pop()!; onStack[w] = false; comp.push(w) } while (w !== v)
        if (comp.includes(lo)) found = comp
      }
    }
    strong(lo)
    return found
  }

  for (let s = 0; s < n && !truncated; s++) {
    const comp = sccOf(s)
    if (comp.length < 2) continue
    const inComp = new Array<boolean>(n).fill(false)
    for (const v of comp) inComp[v] = true
    const blocked = new Array<boolean>(n).fill(false)
    const B: Set<number>[] = order.map(() => new Set<number>())
    const vstack: number[] = []
    const estack: Edge[] = []
    const unblock = (u: number): void => {
      blocked[u] = false
      for (const w of [...B[u]]) {
        B[u].delete(w)
        if (blocked[w]) unblock(w)
      }
    }
    const circuit = (v: number): boolean => {
      let f = false
      vstack.push(v); blocked[v] = true
      for (const e of out[v]) {
        if (truncated) break
        if (++steps > maxSteps) { truncated = true; break }
        const w = index.get(e.to)!
        if (!inComp[w]) continue
        if (w === s) {
          const nodes = vstack.map(i => order[i])
          const es = [...estack, e]
          const sign = es.reduce<number>((p, x) => p * x.sign, 1) as Sign
          cycles.push({ nodes, edges: es, sign, key: nodes.join('>') })
          f = true
          if (cycles.length >= maxCycles) { truncated = true; break }
        } else if (!blocked[w]) {
          estack.push(e)
          if (circuit(w)) f = true
          estack.pop()
        }
      }
      if (f) unblock(v)
      else for (const e of out[v]) {
        const w = index.get(e.to)!
        if (inComp[w]) B[w].add(v)
      }
      vstack.pop()
      return f
    }
    circuit(s)
  }
  return { cycles, truncated }
}

/** The loop type a sign stands for: an even number of negative links reinforces (Ford 2019). */
export function loopType(sign: Sign): 'R' | 'B' {
  return sign === 1 ? 'R' : 'B'
}

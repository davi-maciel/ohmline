import type { Circuit, Edge } from "@/types/circuit";
import {
  RationalExpr,
  solveLinearSystem,
} from "@/lib/symbolic";
import { parseResistances } from "@/lib/circuitCalculator";

/**
 * Union-Find for merging nodes connected by
 * zero-resistance edges.
 */
class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor(ids: string[]) {
    this.parent = new Map();
    this.rank = new Map();
    for (const id of ids) {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    }
  }

  find(x: string): string {
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const rankA = this.rank.get(ra)!;
    const rankB = this.rank.get(rb)!;
    if (rankA < rankB) {
      this.parent.set(ra, rb);
    } else if (rankA > rankB) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }

  /** All ids whose root is `root`. */
  members(root: string): string[] {
    return [...this.parent.keys()].filter(
      (id) => this.find(id) === root
    );
  }
}

/**
 * Calculate currents in the circuit using KCL
 * nodal analysis. The current for an edge flows
 * from nodeA to nodeB.
 *
 * Algorithm:
 * 1. Parse values; any invalid value => no results.
 *    Edges that reference missing nodes are ignored.
 * 2. Nodes with a known potential are boundary
 *    nodes (ideal sources). Need at least 2.
 * 3. Merge nodes joined by zero-resistance wires.
 *    A merged group holding two different known
 *    potentials is a short between sources: its
 *    wires carry infinite current and its
 *    potential is undefined.
 * 4. Split the circuit into pieces connected by
 *    finite, non-zero resistances and solve each
 *    piece separately by nodal analysis. A piece
 *    with no boundary node gets an arbitrary
 *    reference potential (its currents are still
 *    well defined). A piece containing a short
 *    between sources, or with a singular system,
 *    is left undetermined.
 * 5. Resistor currents: I = (V_A - V_B) / R.
 *    Open circuits (infinite R) carry 0.
 * 6. Wire currents follow from KCL: a wire that is
 *    a bridge of its group carries the net current
 *    entering the side without a source. Wires in
 *    a loop of wires, or between two sources at the
 *    same potential, are undetermined.
 *
 * Edges whose current cannot be determined are
 * left out of the returned map.
 */
export function calculateCurrents(
  circuit: Circuit
): Map<string, RationalExpr> {
  const result = new Map<string, RationalExpr>();

  const nodeIds = new Set(circuit.nodes.map((n) => n.id));
  const edges = circuit.edges.filter(
    (e) => nodeIds.has(e.nodeA) && nodeIds.has(e.nodeB)
  );
  if (edges.length === 0) return result;

  // Step 1: any unparseable value => no results
  const resistance = parseResistances(circuit);
  if (!resistance) return result;

  const known = new Map<string, RationalExpr>();
  for (const node of circuit.nodes) {
    if (
      node.potential !== undefined
      && node.potential !== ""
    ) {
      const pot = RationalExpr.tryParse(node.potential);
      if (!pot) return result;
      known.set(node.id, pot);
    }
  }

  // Step 2: need at least 2 boundary nodes
  if (known.size < 2) return result;

  const isWire = (e: Edge) => resistance.get(e)!.isZero();
  const isOpen = (e: Edge) =>
    resistance.get(e)!.isInfinity();
  const isResistor = (e: Edge) => !isWire(e) && !isOpen(e);

  // Step 3: merge wire-connected nodes
  const uf = new UnionFind([...nodeIds]);
  for (const e of edges) {
    if (isWire(e)) uf.union(e.nodeA, e.nodeB);
  }

  const groupKnown = new Map<string, RationalExpr>();
  const shorted = new Set<string>();
  for (const [id, pot] of known) {
    const g = uf.find(id);
    const existing = groupKnown.get(g);
    if (existing && !existing.equals(pot)) {
      shorted.add(g);
    } else if (!existing) {
      groupKnown.set(g, pot);
    }
  }
  for (const g of shorted) groupKnown.delete(g);

  // Step 4: pieces connected by resistors
  const groups = new Set([...nodeIds].map((id) => uf.find(id)));
  const conn = new UnionFind([...groups]);
  for (const e of edges) {
    if (isResistor(e)) {
      conn.union(uf.find(e.nodeA), uf.find(e.nodeB));
    }
  }
  const pieces = new Map<string, string[]>();
  for (const g of groups) {
    const p = conn.find(g);
    if (!pieces.has(p)) pieces.set(p, []);
    pieces.get(p)!.push(g);
  }

  const potential = new Map<string, RationalExpr>();
  for (const piece of pieces.values()) {
    if (piece.some((g) => shorted.has(g))) continue;
    const fixed = new Map<string, RationalExpr>();
    for (const g of piece) {
      const pot = groupKnown.get(g);
      if (pot) fixed.set(g, pot);
    }
    if (fixed.size === 0) {
      // Floating piece: any reference works
      fixed.set(piece[0], RationalExpr.ZERO);
    }
    const solved = solvePiece(
      piece, fixed, edges, resistance, uf
    );
    if (!solved) continue;
    for (const [g, v] of solved) potential.set(g, v);
  }

  // Step 5: resistor and open-circuit currents
  for (const e of edges) {
    if (isOpen(e)) {
      result.set(e.id, RationalExpr.ZERO);
    } else if (isResistor(e)) {
      const vA = potential.get(uf.find(e.nodeA));
      const vB = potential.get(uf.find(e.nodeB));
      if (vA && vB) {
        result.set(
          e.id,
          vA.subtract(vB).divide(resistance.get(e)!)
        );
      }
    }
  }

  // Step 6: wire currents via KCL
  setWireCurrents(
    edges, isWire, isResistor, known, shorted, uf, result
  );

  return result;
}

/**
 * Nodal analysis on one piece. `fixed` maps groups
 * with known potential; returns potentials for all
 * groups in the piece, or null if singular.
 */
function solvePiece(
  piece: string[],
  fixed: Map<string, RationalExpr>,
  edges: Edge[],
  resistance: Map<Edge, RationalExpr>,
  uf: UnionFind
): Map<string, RationalExpr> | null {
  const inPiece = new Set(piece);
  const unknown = piece.filter((g) => !fixed.has(g));
  const index = new Map<string, number>();
  unknown.forEach((g, i) => index.set(g, i));
  const m = unknown.length;

  const Y: RationalExpr[][] = [];
  const b: RationalExpr[] = [];
  for (let i = 0; i < m; i++) {
    Y.push(new Array(m).fill(RationalExpr.ZERO));
    b.push(RationalExpr.ZERO);
  }

  for (const e of edges) {
    const r = resistance.get(e)!;
    if (r.isZero() || r.isInfinity()) continue;
    const gA = uf.find(e.nodeA);
    const gB = uf.find(e.nodeB);
    if (gA === gB || !inPiece.has(gA)) continue;
    const G = r.reciprocal();
    const iA = index.get(gA);
    const iB = index.get(gB);
    if (iA !== undefined) {
      Y[iA][iA] = Y[iA][iA].add(G);
      if (iB !== undefined) {
        Y[iA][iB] = Y[iA][iB].subtract(G);
      } else {
        b[iA] = b[iA].add(G.multiply(fixed.get(gB)!));
      }
    }
    if (iB !== undefined) {
      Y[iB][iB] = Y[iB][iB].add(G);
      if (iA !== undefined) {
        Y[iB][iA] = Y[iB][iA].subtract(G);
      } else {
        b[iB] = b[iB].add(G.multiply(fixed.get(gA)!));
      }
    }
  }

  const out = new Map(fixed);
  if (m > 0) {
    const V = solveLinearSystem(Y, b);
    if (!V) return null;
    unknown.forEach((g, i) => out.set(g, V[i]));
  }
  return out;
}

/**
 * Fill in wire (zero-resistance) currents from KCL,
 * using the resistor currents already in `result`.
 */
function setWireCurrents(
  edges: Edge[],
  isWire: (e: Edge) => boolean,
  isResistor: (e: Edge) => boolean,
  known: Map<string, RationalExpr>,
  shorted: Set<string>,
  uf: UnionFind,
  result: Map<string, RationalExpr>
): void {
  const wires = edges.filter(isWire);
  if (wires.length === 0) return;

  // Net current entering each node through
  // resistors; null if any of them is unknown
  const inflow = new Map<string, RationalExpr | null>();
  const addInflow = (id: string, i: RationalExpr | null) => {
    const prev = inflow.get(id);
    if (prev === null) return;
    if (i === null) {
      inflow.set(id, null);
    } else {
      inflow.set(id, (prev ?? RationalExpr.ZERO).add(i));
    }
  };
  for (const e of edges) {
    if (!isResistor(e) || e.nodeA === e.nodeB) continue;
    const i = result.get(e.id) ?? null;
    addInflow(e.nodeB, i);
    addInflow(e.nodeA, i ? i.negate() : null);
  }

  for (const w of wires) {
    if (w.nodeA === w.nodeB) continue; // wire loop

    // Nodes reachable from nodeA through the other
    // wires: if nodeB is among them, w is in a loop
    const side = new Set([w.nodeA]);
    const stack = [w.nodeA];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const o of wires) {
        if (o === w) continue;
        const next = o.nodeA === cur
          ? o.nodeB
          : o.nodeB === cur ? o.nodeA : null;
        if (next !== null && !side.has(next)) {
          side.add(next);
          stack.push(next);
        }
      }
    }
    if (side.has(w.nodeB)) continue; // wire loop

    const group = uf.find(w.nodeA);
    const other = [...uf.members(group)]
      .filter((id) => !side.has(id));

    if (shorted.has(group)) {
      // Infinite current unless one side has no
      // source (a dangling wire)
      const sideHasSource = [...side].some(
        (id) => known.has(id)
      );
      const otherHasSource = other.some(
        (id) => known.has(id)
      );
      if (sideHasSource && otherHasSource) {
        result.set(w.id, RationalExpr.INFINITY);
      }
      continue;
    }

    // KCL on the side without a source: everything
    // entering it must leave through w
    const sum = (ids: Iterable<string>) => {
      let total = RationalExpr.ZERO;
      for (const id of ids) {
        if (!inflow.has(id)) continue;
        const i = inflow.get(id);
        if (i === null || i === undefined) return null;
        total = total.add(i);
      }
      return total;
    };
    const hasSource = (ids: Iterable<string>) => {
      for (const id of ids) if (known.has(id)) return true;
      return false;
    };
    let current: RationalExpr | null = null;
    if (!hasSource(side)) {
      current = sum(side);
    } else if (!hasSource(other)) {
      const s = sum(other);
      current = s ? s.negate() : null;
    }
    if (current) result.set(w.id, current);
  }
}

import type { Circuit } from "@/types/circuit";
import {
  RationalExpr,
  solveLinearSystem,
} from "@/lib/symbolic";

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
}

/**
 * Calculate currents in the circuit using KCL
 * nodal analysis.
 *
 * Algorithm:
 * 1. Separate nodes into boundary (known
 *    potential) and interior (unknown).
 * 2. If <2 boundary nodes, return empty map.
 * 3. Union-Find for zero-R edges.
 * 4. Build conductance matrix for interior nodes.
 * 5. Solve for unknown potentials.
 * 6. Compute edge currents: I = (V_A - V_B) / R.
 */
export function calculateCurrents(
  circuit: Circuit
): Map<string, RationalExpr> {
  const result = new Map<string, RationalExpr>();

  if (circuit.edges.length === 0) {
    return result;
  }

  // Parse node potentials; separate boundary
  // (known) from interior (unknown)
  const knownPotentials = new Map<
    string, RationalExpr
  >();
  for (const node of circuit.nodes) {
    if (
      node.potential !== undefined
      && node.potential !== ""
    ) {
      knownPotentials.set(
        node.id,
        RationalExpr.parse(node.potential)
      );
    }
  }

  // Need at least 2 boundary nodes
  if (knownPotentials.size < 2) {
    return result;
  }

  // Union-Find for zero-resistance edges
  const allNodeIds = circuit.nodes.map(
    (n) => n.id
  );
  const uf = new UnionFind(allNodeIds);

  for (const edge of circuit.edges) {
    const r = RationalExpr.parse(edge.resistance);
    if (r.isZero()) {
      uf.union(edge.nodeA, edge.nodeB);
    }
  }

  // Check for short circuits: two merged nodes
  // with different known potentials
  const shortCircuitGroups = new Set<string>();
  const groupPotential = new Map<
    string, RationalExpr
  >();
  for (const [nodeId, pot] of knownPotentials) {
    const rep = uf.find(nodeId);
    const existing = groupPotential.get(rep);
    if (existing) {
      if (!existing.equals(pot)) {
        shortCircuitGroups.add(rep);
      }
    } else {
      groupPotential.set(rep, pot);
    }
  }

  // For short-circuit edges, set INFINITY current
  if (shortCircuitGroups.size > 0) {
    for (const edge of circuit.edges) {
      const r = RationalExpr.parse(
        edge.resistance
      );
      if (r.isZero()) {
        const rep = uf.find(edge.nodeA);
        if (shortCircuitGroups.has(rep)) {
          result.set(
            edge.id,
            RationalExpr.INFINITY
          );
        }
      }
    }
  }

  // Build representative node sets
  const repSet = new Set<string>();
  for (const id of allNodeIds) {
    repSet.add(uf.find(id));
  }

  // Determine which reps are boundary (known
  // potential) and which are interior
  const repKnown = new Map<
    string, RationalExpr
  >();
  for (const [nodeId, pot] of knownPotentials) {
    const rep = uf.find(nodeId);
    if (!shortCircuitGroups.has(rep)) {
      repKnown.set(rep, pot);
    }
  }

  const interiorReps: string[] = [];
  for (const rep of repSet) {
    if (
      !repKnown.has(rep)
      && !shortCircuitGroups.has(rep)
    ) {
      interiorReps.push(rep);
    }
  }

  const m = interiorReps.length;

  // Map interior rep -> matrix index
  const indexMap = new Map<string, number>();
  for (let i = 0; i < m; i++) {
    indexMap.set(interiorReps[i], i);
  }

  // Build conductance matrix Y (MxM) and RHS b
  const Y: RationalExpr[][] = [];
  const b: RationalExpr[] = [];
  for (let i = 0; i < m; i++) {
    Y.push([]);
    for (let j = 0; j < m; j++) {
      Y[i].push(RationalExpr.ZERO);
    }
    b.push(RationalExpr.ZERO);
  }

  for (const edge of circuit.edges) {
    const r = RationalExpr.parse(edge.resistance);
    if (r.isZero() || r.isInfinity()) continue;

    const G = r.reciprocal();
    const rA = uf.find(edge.nodeA);
    const rB = uf.find(edge.nodeB);
    if (rA === rB) continue;

    const iA = indexMap.get(rA);
    const iB = indexMap.get(rB);
    const potA = repKnown.get(rA);
    const potB = repKnown.get(rB);

    if (
      iA !== undefined
      && iB !== undefined
    ) {
      // Both interior
      Y[iA][iA] = Y[iA][iA].add(G);
      Y[iB][iB] = Y[iB][iB].add(G);
      Y[iA][iB] = Y[iA][iB].subtract(G);
      Y[iB][iA] = Y[iB][iA].subtract(G);
    } else if (
      iA !== undefined
      && potB !== undefined
    ) {
      // A interior, B boundary
      Y[iA][iA] = Y[iA][iA].add(G);
      b[iA] = b[iA].add(G.multiply(potB));
    } else if (
      iB !== undefined
      && potA !== undefined
    ) {
      // B interior, A boundary
      Y[iB][iB] = Y[iB][iB].add(G);
      b[iB] = b[iB].add(G.multiply(potA));
    }
    // Both boundary: no unknowns, skip
  }

  // Solve for interior potentials
  let interiorPotentials: RationalExpr[] | null =
    null;
  if (m > 0) {
    interiorPotentials = solveLinearSystem(Y, b);
  }

  // Build full potential map (rep -> potential)
  const allPotentials = new Map<
    string, RationalExpr
  >();
  for (const [rep, pot] of repKnown) {
    allPotentials.set(rep, pot);
  }
  if (interiorPotentials) {
    for (let i = 0; i < m; i++) {
      allPotentials.set(
        interiorReps[i],
        interiorPotentials[i]
      );
    }
  }

  // Compute edge currents: I = (V_A - V_B) / R
  for (const edge of circuit.edges) {
    // Skip if already set (short circuit)
    if (result.has(edge.id)) continue;

    const r = RationalExpr.parse(edge.resistance);

    if (r.isInfinity()) {
      result.set(edge.id, RationalExpr.ZERO);
      continue;
    }

    const rA = uf.find(edge.nodeA);
    const rB = uf.find(edge.nodeB);

    const potA = allPotentials.get(rA);
    const potB = allPotentials.get(rB);

    if (!potA || !potB) {
      // Cannot determine current
      continue;
    }

    if (r.isZero()) {
      // Zero resistance with same potential
      const diff = potA.subtract(potB);
      if (diff.isZero()) {
        result.set(
          edge.id, RationalExpr.ZERO
        );
      } else {
        result.set(
          edge.id, RationalExpr.INFINITY
        );
      }
      continue;
    }

    // I = (V_A - V_B) / R
    const current = potA.subtract(potB).divide(r);
    result.set(edge.id, current);
  }

  return result;
}

import type { Circuit } from "@/types/circuit";
import {
  RationalExpr,
  solveLinearSystem,
} from "@/lib/symbolic";

export { RationalExpr } from "@/lib/symbolic";

/**
 * Union-Find (Disjoint Set Union) for merging
 * nodes connected by zero-resistance edges.
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
    // Path compression
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
 * Check connectivity between two nodes using BFS.
 */
function areConnected(
  circuit: Circuit,
  nodeAId: string,
  nodeBId: string
): boolean {
  const adj = new Map<string, Set<string>>();
  for (const n of circuit.nodes) {
    adj.set(n.id, new Set());
  }
  for (const e of circuit.edges) {
    adj.get(e.nodeA)?.add(e.nodeB);
    adj.get(e.nodeB)?.add(e.nodeA);
  }
  const visited = new Set<string>();
  const queue = [nodeAId];
  visited.add(nodeAId);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === nodeBId) return true;
    for (const nb of adj.get(cur) || []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return false;
}

/**
 * Calculate equivalent resistance between two nodes
 * using conductance matrix + nodal analysis.
 *
 * Algorithm:
 * 1. Same node => R=0. Disconnected => R=Infinity.
 * 2. Merge zero-R edges via Union-Find.
 * 3. Ground node B. Build (N-1)x(N-1) conductance
 *    matrix Y.
 * 4. Inject 1A at node A, solve Y*V = I.
 * 5. R_eq = V[nodeA].
 */
export function calculateEquivalentResistance(
  circuit: Circuit,
  nodeAId: string,
  nodeBId: string
): RationalExpr | null {
  const nodeA = circuit.nodes.find(
    (n) => n.id === nodeAId
  );
  const nodeB = circuit.nodes.find(
    (n) => n.id === nodeBId
  );
  if (!nodeA || !nodeB) return null;

  if (nodeAId === nodeBId) {
    return RationalExpr.ZERO;
  }

  if (!areConnected(circuit, nodeAId, nodeBId)) {
    return RationalExpr.INFINITY;
  }

  // Step 2: Union-Find for zero-resistance edges
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

  // If A and B are in the same zero-R group,
  // equivalent resistance is 0
  if (uf.connected(nodeAId, nodeBId)) {
    return RationalExpr.ZERO;
  }

  // Get representative nodes (unique group reps)
  const repSet = new Set<string>();
  for (const id of allNodeIds) {
    repSet.add(uf.find(id));
  }

  const repA = uf.find(nodeAId);
  const repB = uf.find(nodeBId);

  // Ground node B (remove it from the system)
  const reps = [...repSet].filter(
    (id) => id !== repB
  );
  const n = reps.length;

  if (n === 0) return RationalExpr.ZERO;

  // Map representative node to matrix index
  const indexMap = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    indexMap.set(reps[i], i);
  }

  // Step 3-4: Build conductance matrix Y
  const Y: RationalExpr[][] = [];
  const I: RationalExpr[] = [];
  for (let i = 0; i < n; i++) {
    Y.push([]);
    for (let j = 0; j < n; j++) {
      Y[i].push(RationalExpr.ZERO);
    }
    I.push(RationalExpr.ZERO);
  }

  // Process each edge
  for (const edge of circuit.edges) {
    const r = RationalExpr.parse(edge.resistance);

    // Skip zero-R edges (already merged)
    if (r.isZero()) continue;
    // Skip infinite-R edges (open circuit)
    if (r.isInfinity()) continue;

    const G = r.reciprocal();
    const rA = uf.find(edge.nodeA);
    const rB = uf.find(edge.nodeB);

    // Skip if both ends merged to same group
    if (rA === rB) continue;

    const iA = indexMap.get(rA);
    const iB = indexMap.get(rB);

    // Both not grounded
    if (iA !== undefined && iB !== undefined) {
      Y[iA][iA] = Y[iA][iA].add(G);
      Y[iB][iB] = Y[iB][iB].add(G);
      Y[iA][iB] = Y[iA][iB].subtract(G);
      Y[iB][iA] = Y[iB][iA].subtract(G);
    } else if (
      iA !== undefined
      && iB === undefined
    ) {
      // B side is grounded
      Y[iA][iA] = Y[iA][iA].add(G);
    } else if (
      iA === undefined
      && iB !== undefined
    ) {
      // A side is grounded
      Y[iB][iB] = Y[iB][iB].add(G);
    }
    // Both grounded: edge between ground nodes,
    // doesn't affect the matrix
  }

  // Step 5: Current injection at node A
  const idxA = indexMap.get(repA);
  if (idxA === undefined) {
    // nodeA is grounded (same as nodeB),
    // should not happen since we checked above
    return RationalExpr.ZERO;
  }
  I[idxA] = RationalExpr.ONE;

  // Step 6: Solve Y * V = I
  const V = solveLinearSystem(Y, I);
  // Singular matrix means nodes are only
  // connected through infinite resistance
  if (!V) return RationalExpr.INFINITY;

  // Step 7: R_eq = V[nodeA]
  return V[idxA];
}

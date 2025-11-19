import type { Node, Edge, Circuit } from "@/types/circuit";

/**
 * Represents a symbolic resistance value that can be:
 * - A numeric value (including negative, zero, or Infinity)
 * - A symbolic expression (e.g., "r", "2r", "r+10")
 */
export type ResistanceValue = number | string;

/**
 * Parses a resistance value from string or number input
 */
export function parseResistance(value: number | string): ResistanceValue {
  if (typeof value === "number") {
    return value;
  }

  if (value === "Infinity" || value === "∞") {
    return Infinity;
  }

  // Try to parse as a number
  const parsed = parseFloat(value);
  if (!isNaN(parsed) && value.trim() === parsed.toString()) {
    return parsed;
  }

  // Otherwise, treat as symbolic variable
  return value.trim();
}

/**
 * Simplifies symbolic expressions involving resistances
 * Examples:
 * - "r" + "r" = "2r"
 * - "r" + "2r" = "3r"
 * - "r" + 10 = "r+10"
 * - "r" || "r" = "r/2"
 */
export class SymbolicResistance {
  // Stores terms like { "r": 2, "constant": 10 } for "2r+10"
  private terms: Map<string, number>;

  constructor(value: ResistanceValue) {
    this.terms = new Map();

    if (typeof value === "number") {
      if (value !== 0) {
        this.terms.set("constant", value);
      }
    } else {
      this.parseExpression(value);
    }
  }

  private parseExpression(expr: string): void {
    // Simple parser for expressions like "r", "2r", "r+10", "3r+5"
    expr = expr.replace(/\s/g, "");

    // Split by + and - while preserving the sign
    const parts = expr.match(/[+-]?[^+-]+/g) || [];

    for (const part of parts) {
      if (!part) continue;

      // Try to parse as pure number
      const num = parseFloat(part);
      if (!isNaN(num) && part === num.toString()) {
        this.addTerm("constant", num);
        continue;
      }

      // Parse coefficient and variable (e.g., "2r", "-r", "r")
      const match = part.match(/^([+-]?\d*\.?\d*)([a-zA-Z_]\w*)$/);
      if (match) {
        const coef = match[1] === "" || match[1] === "+" ? 1 : match[1] === "-" ? -1 : parseFloat(match[1]);
        const variable = match[2];
        this.addTerm(variable, coef);
      } else {
        // If we can't parse it, store the whole expression as a single variable
        this.addTerm(part, 1);
      }
    }
  }

  private addTerm(variable: string, coefficient: number): void {
    const current = this.terms.get(variable) || 0;
    const newValue = current + coefficient;
    if (Math.abs(newValue) < 1e-10) {
      this.terms.delete(variable);
    } else {
      this.terms.set(variable, newValue);
    }
  }

  add(other: SymbolicResistance): SymbolicResistance {
    const result = new SymbolicResistance(0);

    // Add all terms from this
    for (const [variable, coef] of this.terms) {
      result.addTerm(variable, coef);
    }

    // Add all terms from other
    for (const [variable, coef] of other.terms) {
      result.addTerm(variable, coef);
    }

    return result;
  }

  parallel(other: SymbolicResistance): SymbolicResistance {
    // R_eq = (R1 * R2) / (R1 + R2)

    // For pure numeric values, calculate directly
    if (this.isNumeric() && other.isNumeric()) {
      const r1 = this.toNumber();
      const r2 = other.toNumber();

      if (r1 === Infinity) return other;
      if (r2 === Infinity) return this;
      if (r1 === 0) return new SymbolicResistance(0);
      if (r2 === 0) return new SymbolicResistance(0);

      return new SymbolicResistance((r1 * r2) / (r1 + r2));
    }

    // For symbolic values, create a simplified expression when possible
    const thisStr = this.toString();
    const otherStr = other.toString();

    // Special case: r || r = r/2
    if (thisStr === otherStr) {
      const result = new SymbolicResistance(0);
      for (const [variable, coef] of this.terms) {
        result.addTerm(variable, coef / 2);
      }
      return result;
    }

    // For general symbolic case, return a placeholder expression
    return new SymbolicResistance(`(${thisStr}||${otherStr})`);
  }

  isNumeric(): boolean {
    return this.terms.size === 0 || (this.terms.size === 1 && this.terms.has("constant"));
  }

  toNumber(): number {
    if (this.terms.size === 0) return 0;
    if (this.isNumeric()) {
      return this.terms.get("constant") || 0;
    }
    throw new Error("Cannot convert symbolic expression to number");
  }

  toString(): string {
    if (this.terms.size === 0) return "0";

    const parts: string[] = [];
    let constant = 0;

    for (const [variable, coef] of this.terms) {
      if (variable === "constant") {
        constant = coef;
        continue;
      }

      if (coef === 1) {
        parts.push(variable);
      } else if (coef === -1) {
        parts.push(`-${variable}`);
      } else {
        parts.push(`${coef}${variable}`);
      }
    }

    if (constant !== 0) {
      parts.push(constant.toString());
    }

    if (parts.length === 0) return constant.toString();

    return parts.join("+").replace(/\+-/g, "-");
  }

  toDisplayString(): string {
    const str = this.toString();
    if (this.isNumeric()) {
      const num = this.toNumber();
      if (num === Infinity) return "∞";
      return `${num}Ω`;
    }
    return str;
  }
}

/**
 * Graph representation for circuit analysis
 */
class CircuitGraph {
  private adjacency: Map<string, Map<string, Edge[]>>;

  constructor(circuit: Circuit) {
    this.adjacency = new Map();

    // Build adjacency list
    for (const node of circuit.nodes) {
      this.adjacency.set(node.id, new Map());
    }

    for (const edge of circuit.edges) {
      this.addEdgeToGraph(edge);
    }
  }

  private addEdgeToGraph(edge: Edge): void {
    // Add edge in both directions (undirected graph)
    if (!this.adjacency.has(edge.nodeA)) {
      this.adjacency.set(edge.nodeA, new Map());
    }
    if (!this.adjacency.has(edge.nodeB)) {
      this.adjacency.set(edge.nodeB, new Map());
    }

    const nodeAEdges = this.adjacency.get(edge.nodeA)!;
    const nodeBEdges = this.adjacency.get(edge.nodeB)!;

    if (!nodeAEdges.has(edge.nodeB)) {
      nodeAEdges.set(edge.nodeB, []);
    }
    if (!nodeBEdges.has(edge.nodeA)) {
      nodeBEdges.set(edge.nodeA, []);
    }

    nodeAEdges.get(edge.nodeB)!.push(edge);
    nodeBEdges.get(edge.nodeA)!.push(edge);
  }

  getNeighbors(nodeId: string): string[] {
    return Array.from(this.adjacency.get(nodeId)?.keys() || []);
  }

  getEdgesBetween(nodeA: string, nodeB: string): Edge[] {
    return this.adjacency.get(nodeA)?.get(nodeB) || [];
  }

  /**
   * Find all simple paths between two nodes using DFS
   */
  findAllPaths(start: string, end: string): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: string[]) => {
      if (current === end) {
        paths.push([...path]);
        return;
      }

      visited.add(current);

      for (const neighbor of this.getNeighbors(current)) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor]);
        }
      }

      visited.delete(current);
    };

    dfs(start, [start]);
    return paths;
  }
}

/**
 * Calculate equivalent resistance between two nodes
 */
export function calculateEquivalentResistance(
  circuit: Circuit,
  nodeAId: string,
  nodeBId: string
): SymbolicResistance | null {
  // Check if nodes exist
  const nodeA = circuit.nodes.find((n) => n.id === nodeAId);
  const nodeB = circuit.nodes.find((n) => n.id === nodeBId);

  if (!nodeA || !nodeB) {
    return null;
  }

  // If same node, resistance is 0
  if (nodeAId === nodeBId) {
    return new SymbolicResistance(0);
  }

  const graph = new CircuitGraph(circuit);

  // Check if nodes are connected
  const paths = graph.findAllPaths(nodeAId, nodeBId);
  if (paths.length === 0) {
    return new SymbolicResistance(Infinity);
  }

  // Calculate resistance for each path, then combine in parallel
  const pathResistances: SymbolicResistance[] = [];

  for (const path of paths) {
    let pathResistance = new SymbolicResistance(0);

    // Add resistances in series along the path
    for (let i = 0; i < path.length - 1; i++) {
      const edges = graph.getEdgesBetween(path[i], path[i + 1]);

      if (edges.length === 0) {
        // This shouldn't happen if path is valid
        pathResistance = new SymbolicResistance(Infinity);
        break;
      }

      // If multiple edges between two nodes, they are in parallel
      let segmentResistance: SymbolicResistance | null = null;

      // Deduplicate edges by ID (since each edge is added twice in the graph - once for each direction)
      const uniqueEdges = Array.from(new Map(edges.map(e => [e.id, e])).values());

      for (const edge of uniqueEdges) {
        const edgeResistance = new SymbolicResistance(parseResistance(edge.resistance));

        if (segmentResistance === null) {
          segmentResistance = edgeResistance;
        } else {
          segmentResistance = segmentResistance.parallel(edgeResistance);
        }
      }

      if (segmentResistance) {
        pathResistance = pathResistance.add(segmentResistance);
      }
    }

    pathResistances.push(pathResistance);
  }

  // Combine all path resistances in parallel
  if (pathResistances.length === 0) {
    return new SymbolicResistance(Infinity);
  }

  let totalResistance = pathResistances[0];
  for (let i = 1; i < pathResistances.length; i++) {
    totalResistance = totalResistance.parallel(pathResistances[i]);
  }

  return totalResistance;
}

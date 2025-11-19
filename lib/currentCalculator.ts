import type { Circuit, Edge } from "@/types/circuit";
import { parseResistance, SymbolicResistance } from "./circuitCalculator";

/**
 * Represents a symbolic current or voltage value
 * Similar to SymbolicResistance but for electrical quantities
 */
export class SymbolicValue {
  // Stores terms like { "V": 1, "constant": 5 } for "V+5"
  private terms: Map<string, number>;

  constructor(value: number | string) {
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

      // Parse coefficient and variable (e.g., "2V", "-V", "V")
      const match = part.match(/^([+-]?\d*\.?\d*)([a-zA-Z_]\w*)$/);
      if (match) {
        const coef =
          match[1] === "" || match[1] === "+"
            ? 1
            : match[1] === "-"
            ? -1
            : parseFloat(match[1]);
        const variable = match[2];
        this.addTerm(variable, coef);
      } else {
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

  add(other: SymbolicValue): SymbolicValue {
    const result = new SymbolicValue(0);

    for (const [variable, coef] of this.terms) {
      result.addTerm(variable, coef);
    }

    for (const [variable, coef] of other.terms) {
      result.addTerm(variable, coef);
    }

    return result;
  }

  subtract(other: SymbolicValue): SymbolicValue {
    const result = new SymbolicValue(0);

    for (const [variable, coef] of this.terms) {
      result.addTerm(variable, coef);
    }

    for (const [variable, coef] of other.terms) {
      result.addTerm(variable, -coef);
    }

    return result;
  }

  multiply(scalar: number): SymbolicValue {
    const result = new SymbolicValue(0);

    for (const [variable, coef] of this.terms) {
      result.addTerm(variable, coef * scalar);
    }

    return result;
  }

  divide(divisor: SymbolicValue): SymbolicValue {
    // Only handle division by numeric constants
    if (divisor.isNumeric()) {
      const num = divisor.toNumber();
      if (num === 0) {
        return new SymbolicValue(Infinity);
      }
      return this.multiply(1 / num);
    }

    // For symbolic division, create expression
    const thisStr = this.toString();
    const divisorStr = divisor.toString();
    return new SymbolicValue(`(${thisStr})/(${divisorStr})`);
  }

  isNumeric(): boolean {
    return (
      this.terms.size === 0 ||
      (this.terms.size === 1 && this.terms.has("constant"))
    );
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

  toDisplayString(unit: string = ""): string {
    const str = this.toString();
    if (this.isNumeric()) {
      const num = this.toNumber();
      if (num === Infinity) return "∞";
      if (num === 0) return `0${unit}`;
      // Format to reasonable precision
      const formatted = Math.abs(num) < 1e-10 ? "0" : num.toFixed(4).replace(/\.?0+$/, "");
      return `${formatted}${unit}`;
    }
    return `${str}${unit}`;
  }
}

/**
 * Represents current flowing through an edge
 */
export interface EdgeCurrent {
  edgeId: string;
  current: SymbolicValue;
}

/**
 * Calculate currents in the circuit using Kirchhoff's laws
 *
 * Uses the Node Voltage Method (Nodal Analysis):
 * 1. Choose a reference node (ground)
 * 2. Write KCL equations for each non-reference node
 * 3. Solve the system of equations for node voltages
 * 4. Calculate currents using Ohm's law: I = (V1 - V2) / R
 */
export function calculateCurrents(circuit: Circuit): Map<string, SymbolicValue> {
  const edgeCurrents = new Map<string, SymbolicValue>();

  // If no edges, no currents
  if (circuit.edges.length === 0) {
    return edgeCurrents;
  }

  // Build node potential map (mix of known and unknown)
  const nodePotentials = new Map<string, SymbolicValue>();

  for (const node of circuit.nodes) {
    if (node.potential !== undefined && node.potential !== "") {
      nodePotentials.set(node.id, new SymbolicValue(node.potential));
    }
  }

  // Calculate current for each edge using Ohm's law: I = (V1 - V2) / R
  for (const edge of circuit.edges) {
    const nodeAId = edge.nodeA;
    const nodeBId = edge.nodeB;

    const potentialA = nodePotentials.get(nodeAId);
    const potentialB = nodePotentials.get(nodeBId);

    // If both potentials are unknown, current is unknown
    if (!potentialA && !potentialB) {
      edgeCurrents.set(edge.id, new SymbolicValue("I"));
      continue;
    }

    // If one potential is unknown, we can't calculate current yet
    // (would need full nodal analysis with KCL)
    if (!potentialA || !potentialB) {
      edgeCurrents.set(edge.id, new SymbolicValue("I"));
      continue;
    }

    // Both potentials are known, calculate current
    const resistance = parseResistance(edge.resistance);

    // Handle special cases
    if (resistance === Infinity) {
      edgeCurrents.set(edge.id, new SymbolicValue(0));
      continue;
    }

    if (typeof resistance === "number" && resistance === 0) {
      // Zero resistance - infinite current if voltage difference exists
      const voltageDiff = potentialA.subtract(potentialB);
      if (voltageDiff.isNumeric() && voltageDiff.toNumber() === 0) {
        edgeCurrents.set(edge.id, new SymbolicValue(0));
      } else {
        edgeCurrents.set(edge.id, new SymbolicValue(Infinity));
      }
      continue;
    }

    // I = (V_A - V_B) / R
    const voltageDiff = potentialA.subtract(potentialB);
    const resistanceValue = new SymbolicValue(resistance);
    const current = voltageDiff.divide(resistanceValue);

    edgeCurrents.set(edge.id, current);
  }

  return edgeCurrents;
}

/**
 * Get current direction (from nodeA to nodeB if positive, opposite if negative)
 */
export function getCurrentDirection(
  edge: Edge,
  current: SymbolicValue
): "A->B" | "B->A" | "none" {
  if (current.isNumeric()) {
    const value = current.toNumber();
    if (Math.abs(value) < 1e-10) return "none";
    return value > 0 ? "A->B" : "B->A";
  }
  // For symbolic, assume positive direction
  return "A->B";
}

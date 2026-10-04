import {
  parse as mathParse,
  MathNode,
} from "mathjs";
import { Rational } from "./Rational";

/**
 * Multivariate polynomial with exact rational
 * coefficients.
 *
 * Internal representation: Map<string, Rational> where
 * each key is a monomial key (variables sorted
 * alphabetically and joined by "*", e.g. "" for
 * constants, "r" for r, "r1*r2" for r1*r2) and the
 * value is the (non-zero) coefficient.
 */
export class Polynomial {
  private terms: Map<string, Rational>;

  constructor(terms?: Map<string, Rational>) {
    this.terms = new Map();
    if (terms) {
      for (const [key, coef] of terms) {
        if (!coef.isZero()) {
          this.terms.set(key, coef);
        }
      }
    }
  }

  // ----- static constructors -----

  static zero(): Polynomial {
    return new Polynomial();
  }

  static constant(value: number | Rational): Polynomial {
    const r = toRational(value);
    if (r.isZero()) return Polynomial.zero();
    const m = new Map<string, Rational>();
    m.set("", r);
    return new Polynomial(m);
  }

  static variable(name: string): Polynomial {
    const m = new Map<string, Rational>();
    m.set(name, Rational.ONE);
    return new Polynomial(m);
  }

  /**
   * Parse a string expression into a Polynomial.
   * Handles: "r", "3r+5", "10", "2r1+r2", "-r",
   * "3.5", "0", "2*a", "3r^2", etc.
   *
   * Uses mathjs for proper expression parsing,
   * then converts the AST to our Polynomial.
   */
  static parse(expr: string): Polynomial {
    if (typeof expr !== "string") {
      return Polynomial.constant(expr);
    }
    expr = expr.replace(/\s/g, "");
    if (expr === "" || expr === "0") {
      return Polynomial.zero();
    }

    // Pure decimal literal: parse exactly
    const asNum = Rational.fromDecimalString(expr);
    if (asNum) {
      return Polynomial.constant(asNum);
    }

    // Insert implicit multiplication for patterns
    // like "2r", "3x1" so mathjs can parse them.
    // Matches: digit followed by letter, or
    // letter/digit followed by letter (for "rr")
    const prepared = expr.replace(
      /(\d)([a-zA-Z])/g, "$1 * $2"
    );

    try {
      const tree = mathParse(prepared);
      return Polynomial.fromMathNode(tree);
    } catch {
      // Fallback: treat as a single variable
      return Polynomial.variable(expr);
    }
  }

  /**
   * Convert a mathjs AST node into a Polynomial.
   */
  private static fromMathNode(
    node: MathNode
  ): Polynomial {
    switch (node.type) {
      case "ConstantNode": {
        const val =
          (node as unknown as { value: number }).value;
        return Polynomial.constant(val);
      }

      case "SymbolNode": {
        const name =
          (node as unknown as { name: string }).name;
        return Polynomial.variable(name);
      }

      case "OperatorNode": {
        const op = (node as unknown as { op: string }).op;
        const args =
          (node as unknown as { args: MathNode[] }).args;

        if (op === "+" && args.length === 2) {
          return Polynomial.fromMathNode(args[0])
            .add(Polynomial.fromMathNode(args[1]));
        }
        if (op === "-" && args.length === 2) {
          return Polynomial.fromMathNode(args[0])
            .subtract(
              Polynomial.fromMathNode(args[1])
            );
        }
        if (op === "-" && args.length === 1) {
          return Polynomial.fromMathNode(
            args[0]
          ).negate();
        }
        if (op === "+" && args.length === 1) {
          return Polynomial.fromMathNode(args[0]);
        }
        if (op === "*" && args.length === 2) {
          return Polynomial.fromMathNode(args[0])
            .multiply(
              Polynomial.fromMathNode(args[1])
            );
        }
        if (op === "^" && args.length === 2) {
          const base =
            Polynomial.fromMathNode(args[0]);
          const expNode = args[1];
          if (
            expNode.type === "ConstantNode"
          ) {
            const exp =
              (expNode as unknown as { value: number }).value;
            if (
              Number.isInteger(exp) && exp >= 0
            ) {
              let result = Polynomial.constant(1);
              for (let i = 0; i < exp; i++) {
                result = result.multiply(base);
              }
              return result;
            }
          }
        }
        break;
      }

      case "ParenthesisNode": {
        const content =
          (node as unknown as { content: MathNode }).content;
        return Polynomial.fromMathNode(content);
      }
    }

    // Unsupported node: treat the string as a
    // variable name
    return Polynomial.variable(node.toString());
  }

  // ----- arithmetic -----

  add(other: Polynomial): Polynomial {
    const out = new Map<string, Rational>(this.terms);
    for (const [key, coef] of other.terms) {
      const prev = out.get(key);
      const sum = prev ? prev.add(coef) : coef;
      if (sum.isZero()) {
        out.delete(key);
      } else {
        out.set(key, sum);
      }
    }
    return new Polynomial(out);
  }

  subtract(other: Polynomial): Polynomial {
    return this.add(other.negate());
  }

  negate(): Polynomial {
    const out = new Map<string, Rational>();
    for (const [key, coef] of this.terms) {
      out.set(key, coef.negate());
    }
    return new Polynomial(out);
  }

  scale(s: number | Rational): Polynomial {
    const r = toRational(s);
    if (r.isZero()) return Polynomial.zero();
    const out = new Map<string, Rational>();
    for (const [key, coef] of this.terms) {
      out.set(key, coef.multiply(r));
    }
    return new Polynomial(out);
  }

  /**
   * Multiply two polynomials. Monomial keys are
   * merged by splitting on "*", combining, sorting
   * alphabetically, and re-joining.
   */
  multiply(other: Polynomial): Polynomial {
    const out = new Map<string, Rational>();
    for (const [ka, ca] of this.terms) {
      for (const [kb, cb] of other.terms) {
        const key = Polynomial.mergeKeys(ka, kb);
        const prev = out.get(key);
        const prod = ca.multiply(cb);
        const val = prev ? prev.add(prod) : prod;
        if (val.isZero()) {
          out.delete(key);
        } else {
          out.set(key, val);
        }
      }
    }
    return new Polynomial(out);
  }

  // ----- queries -----

  isZero(): boolean {
    return this.terms.size === 0;
  }

  isConstant(): boolean {
    if (this.terms.size === 0) return true;
    if (this.terms.size === 1 && this.terms.has("")) {
      return true;
    }
    return false;
  }

  /** Constant term as an exact rational. */
  constantTerm(): Rational {
    return this.terms.get("") || Rational.ZERO;
  }

  /** Constant term as a (possibly rounded) number. */
  constantValue(): number {
    return this.constantTerm().toNumber();
  }

  getVariables(): Set<string> {
    const vars = new Set<string>();
    for (const key of this.terms.keys()) {
      if (key === "") continue;
      for (const v of key.split("*")) {
        vars.add(v);
      }
    }
    return vars;
  }

  getTerms(): Map<string, Rational> {
    return new Map(this.terms);
  }

  equals(other: Polynomial): boolean {
    if (this.terms.size !== other.terms.size) {
      return false;
    }
    for (const [key, coef] of this.terms) {
      const otherCoef = other.terms.get(key);
      if (!otherCoef || !coef.equals(otherCoef)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Return the degree of the polynomial
   * (max number of variable factors in any monomial).
   */
  degree(): number {
    let maxDeg = 0;
    for (const key of this.terms.keys()) {
      if (key === "") continue;
      const deg = key.split("*").length;
      if (deg > maxDeg) maxDeg = deg;
    }
    return this.terms.size === 0 ? 0 : maxDeg;
  }

  /**
   * Terms in display order: higher degree first,
   * then alphabetical, constant last.
   */
  sortedTerms(): [string, Rational][] {
    return [...this.terms].sort(
      (a, b) => compareMonomials(a[0], b[0])
    );
  }

  /** Coefficient of the first term in display order. */
  leadingCoefficient(): Rational {
    const t = this.sortedTerms();
    return t.length > 0 ? t[0][1] : Rational.ZERO;
  }

  // ----- display -----

  toString(): string {
    if (this.terms.size === 0) return "0";

    const parts: string[] = [];
    for (const [key, coef] of this.sortedTerms()) {
      if (key === "") {
        parts.push(coef.toString());
        continue;
      }
      const varDisplay = formatMonomial(key);
      if (coef.equals(Rational.ONE)) {
        parts.push(varDisplay);
      } else if (coef.equals(Rational.ONE.negate())) {
        parts.push(`-${varDisplay}`);
      } else if (coef.isInteger()) {
        parts.push(`${coef}${varDisplay}`);
      } else {
        parts.push(`(${coef})${varDisplay}`);
      }
    }

    // Join with +, then fix "+-" -> "-"
    return parts.join("+").replace(/\+-/g, "-");
  }

  // ----- internal helpers -----

  /**
   * Merge two monomial keys, e.g.
   * mergeKeys("r1", "r2") => "r1*r2"
   * mergeKeys("", "r") => "r"
   * mergeKeys("r", "r") => "r*r"
   */
  private static mergeKeys(
    a: string,
    b: string
  ): string {
    const va = a === "" ? [] : a.split("*");
    const vb = b === "" ? [] : b.split("*");
    const all = [...va, ...vb];
    if (all.length === 0) return "";
    all.sort();
    return all.join("*");
  }
}

function toRational(v: number | Rational): Rational {
  return typeof v === "number" ? Rational.fromNumber(v) : v;
}

function monomialDegree(key: string): number {
  return key === "" ? 0 : key.split("*").length;
}

/** Display order: degree desc, then alphabetical. */
export function compareMonomials(a: string, b: string): number {
  const da = monomialDegree(a);
  const db = monomialDegree(b);
  if (da !== db) return db - da;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Format a monomial key for display.
 * "r" => "r", "r*r" => "r^2",
 * "r1*r2" => "r1r2", "r*r*r" => "r^3",
 * "r*s" => "rs"
 */
function formatMonomial(key: string): string {
  if (key === "") return "";
  const parts = key.split("*");

  // Count occurrences of each variable
  const counts = new Map<string, number>();
  for (const p of parts) {
    counts.set(p, (counts.get(p) || 0) + 1);
  }

  // Sort variables alphabetically
  const vars = Array.from(counts.keys()).sort();

  const result: string[] = [];
  for (const v of vars) {
    const c = counts.get(v)!;
    if (c === 1) {
      result.push(v);
    } else {
      result.push(`${v}^${c}`);
    }
  }
  return result.join("");
}

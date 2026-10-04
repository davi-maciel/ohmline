import { Rational } from "./Rational";
import {
  Algebra,
  ParseError,
  parseExpression,
} from "./parser";

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
   * "3.5", "0", "2*a", "3r^2", "(r+1)/2", etc.
   * Throws ParseError for invalid input or division
   * by a non-constant.
   */
  static parse(expr: string | number): Polynomial {
    if (typeof expr === "number") {
      return Polynomial.constant(expr);
    }
    if (expr.trim() === "") return Polynomial.zero();
    return parseExpression(expr, POLYNOMIAL_ALGEBRA);
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
 * "r1*r2" => "r1·r2", "r*r*r" => "r^3",
 * "r*s" => "r·s"
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
  // "·" keeps r·s distinct from a variable named rs
  return result.join("\u00B7");
}

const POLYNOMIAL_ALGEBRA: Algebra<Polynomial> = {
  number: (r) => Polynomial.constant(r),
  variable: (name) => Polynomial.variable(name),
  add: (a, b) => a.add(b),
  subtract: (a, b) => a.subtract(b),
  multiply: (a, b) => a.multiply(b),
  divide: (a, b) => {
    if (!b.isConstant() || b.isZero()) {
      throw new ParseError(
        "Polynomial division needs a non-zero constant"
      );
    }
    return a.scale(Rational.ONE.divide(b.constantTerm()));
  },
  negate: (a) => a.negate(),
  power: (a, n) => {
    if (n < 0) {
      throw new ParseError(
        "Negative exponent in a polynomial"
      );
    }
    let result = Polynomial.constant(1);
    for (let i = 0; i < n; i++) result = result.multiply(a);
    return result;
  },
  asInteger: (t) => {
    if (!t.isConstant()) return null;
    const c = t.constantTerm();
    return c.isInteger() ? c.toNumber() : null;
  },
};

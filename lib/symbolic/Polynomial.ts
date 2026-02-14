/**
 * Multivariate polynomial with numeric coefficients.
 *
 * Internal representation: Map<string, number> where each
 * key is a monomial key (variables sorted alphabetically
 * and joined by "*", e.g. "" for constants, "r" for r,
 * "r1*r2" for r1*r2) and the value is the coefficient.
 */
export class Polynomial {
  private terms: Map<string, number>;

  constructor(terms?: Map<string, number>) {
    this.terms = new Map();
    if (terms) {
      for (const [key, coef] of terms) {
        if (Math.abs(coef) > 1e-15) {
          this.terms.set(key, coef);
        }
      }
    }
  }

  // ----- static constructors -----

  static zero(): Polynomial {
    return new Polynomial();
  }

  static constant(value: number): Polynomial {
    if (Math.abs(value) <= 1e-15) return Polynomial.zero();
    const m = new Map<string, number>();
    m.set("", value);
    return new Polynomial(m);
  }

  static variable(name: string): Polynomial {
    const m = new Map<string, number>();
    m.set(name, 1);
    return new Polynomial(m);
  }

  /**
   * Parse a string expression into a Polynomial.
   * Handles: "r", "3r+5", "10", "2r1+r2", "-r",
   * "3.5", "0", etc.
   */
  static parse(expr: string): Polynomial {
    if (typeof expr !== "string") {
      return Polynomial.constant(Number(expr));
    }
    expr = expr.replace(/\s/g, "");
    if (expr === "" || expr === "0") {
      return Polynomial.zero();
    }

    // Try pure number first
    const asNum = Number(expr);
    if (!isNaN(asNum) && expr !== "") {
      return Polynomial.constant(asNum);
    }

    // Split on + and - keeping sign with each token
    const tokens =
      expr.match(/[+-]?[^+-]+/g) || [];

    let result = Polynomial.zero();
    for (const raw of tokens) {
      const tok = raw.trim();
      if (tok === "") continue;

      // Pure number token
      const num = Number(tok);
      if (!isNaN(num)) {
        result = result.add(Polynomial.constant(num));
        continue;
      }

      // coefficient * variable, e.g. "2r", "-r", "r",
      // "3.5x"
      const m = tok.match(
        /^([+-]?\d*\.?\d*)([a-zA-Z_]\w*)$/
      );
      if (m) {
        const coefStr = m[1];
        let coef: number;
        if (
          coefStr === "" ||
          coefStr === "+"
        ) {
          coef = 1;
        } else if (coefStr === "-") {
          coef = -1;
        } else {
          coef = Number(coefStr);
        }
        const varName = m[2];
        result = result.add(
          Polynomial.variable(varName).scale(coef)
        );
        continue;
      }

      // Fallback: treat whole token as a variable
      result = result.add(
        Polynomial.variable(tok)
      );
    }
    return result;
  }

  // ----- arithmetic -----

  add(other: Polynomial): Polynomial {
    const out = new Map<string, number>(this.terms);
    for (const [key, coef] of other.terms) {
      const sum = (out.get(key) || 0) + coef;
      if (Math.abs(sum) <= 1e-15) {
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
    const out = new Map<string, number>();
    for (const [key, coef] of this.terms) {
      out.set(key, -coef);
    }
    return new Polynomial(out);
  }

  scale(s: number): Polynomial {
    if (Math.abs(s) <= 1e-15) {
      return Polynomial.zero();
    }
    const out = new Map<string, number>();
    for (const [key, coef] of this.terms) {
      const v = coef * s;
      if (Math.abs(v) > 1e-15) {
        out.set(key, v);
      }
    }
    return new Polynomial(out);
  }

  /**
   * Multiply two polynomials. Monomial keys are
   * merged by splitting on "*", combining, sorting
   * alphabetically, and re-joining.
   */
  multiply(other: Polynomial): Polynomial {
    const out = new Map<string, number>();
    for (const [ka, ca] of this.terms) {
      for (const [kb, cb] of other.terms) {
        const key = Polynomial.mergeKeys(ka, kb);
        const val = (out.get(key) || 0) + ca * cb;
        if (Math.abs(val) <= 1e-15) {
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

  constantValue(): number {
    return this.terms.get("") || 0;
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

  getTerms(): Map<string, number> {
    return new Map(this.terms);
  }

  equals(other: Polynomial): boolean {
    if (this.terms.size !== other.terms.size) {
      return false;
    }
    for (const [key, coef] of this.terms) {
      const otherCoef = other.terms.get(key);
      if (
        otherCoef === undefined ||
        Math.abs(coef - otherCoef) > 1e-12
      ) {
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

  // ----- display -----

  toString(): string {
    if (this.terms.size === 0) return "0";

    // Collect terms: variables first (sorted), then
    // constant
    const varTerms: [string, number][] = [];
    let constant = 0;

    for (const [key, coef] of this.terms) {
      if (key === "") {
        constant = coef;
      } else {
        varTerms.push([key, coef]);
      }
    }

    // Sort: higher degree first, then alphabetical
    varTerms.sort((a, b) => {
      const degA = a[0] === ""
        ? 0
        : a[0].split("*").length;
      const degB = b[0] === ""
        ? 0
        : b[0].split("*").length;
      if (degA !== degB) return degB - degA;
      return a[0].localeCompare(b[0]);
    });

    const parts: string[] = [];

    for (const [key, coef] of varTerms) {
      const varDisplay = formatMonomial(key);
      if (coef === 1) {
        parts.push(varDisplay);
      } else if (coef === -1) {
        parts.push(`-${varDisplay}`);
      } else {
        parts.push(
          `${formatNum(coef)}${varDisplay}`
        );
      }
    }

    if (constant !== 0 || parts.length === 0) {
      if (parts.length === 0) {
        return formatNum(constant);
      }
      parts.push(formatNum(constant));
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

/** Format a number, dropping unnecessary decimals. */
function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  // Reasonable decimal precision
  const s = n.toPrecision(10);
  // Remove trailing zeros after decimal
  return parseFloat(s).toString();
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

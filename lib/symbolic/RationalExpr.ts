import { Polynomial } from "./Polynomial";
import { Rational, bigGcd } from "./Rational";

/**
 * Rational expression: numerator / denominator where
 * both are multivariate Polynomials.
 *
 * This is the unified replacement for both
 * SymbolicResistance and SymbolicValue from the old
 * code.
 */
export class RationalExpr {
  readonly num: Polynomial;
  readonly den: Polynomial;

  constructor(
    numerator: Polynomial,
    denominator: Polynomial
  ) {
    // Simplify before storing
    const [n, d] = RationalExpr.simplify(
      numerator,
      denominator
    );
    this.num = n;
    this.den = d;
  }

  // ----- static constants -----

  static readonly ZERO = new RationalExpr(
    Polynomial.zero(),
    Polynomial.constant(1)
  );

  static readonly ONE = new RationalExpr(
    Polynomial.constant(1),
    Polynomial.constant(1)
  );

  static readonly INFINITY = new RationalExpr(
    Polynomial.constant(1),
    Polynomial.zero()
  );

  // ----- static factories -----

  static fromNumber(n: number): RationalExpr {
    if (!isFinite(n)) {
      return RationalExpr.INFINITY;
    }
    // Simplest rational that rounds to n, so
    // 0.1 is exactly 1/10
    return new RationalExpr(
      Polynomial.constant(Rational.fromNumber(n)),
      Polynomial.constant(1)
    );
  }

  static fromString(s: string): RationalExpr {
    s = s.trim();
    // Infinity of either sign is an open circuit
    if (/^[+-]?(Infinity|∞|inf)$/.test(s)) {
      return RationalExpr.INFINITY;
    }
    // Decimal literal: parse exactly from the text
    const asNum = Rational.fromDecimalString(s);
    if (asNum) {
      return new RationalExpr(
        Polynomial.constant(asNum),
        Polynomial.constant(1)
      );
    }
    // Parse as polynomial expression
    return new RationalExpr(
      Polynomial.parse(s),
      Polynomial.constant(1)
    );
  }

  /**
   * Parse a resistance/value from the circuit data
   * types. Handles numbers (including 0, negative,
   * Infinity), symbolic variables ("r", "V"),
   * expressions ("2r+10", "3r+5").
   */
  static parse(
    value: number | string
  ): RationalExpr {
    if (typeof value === "number") {
      return RationalExpr.fromNumber(value);
    }
    return RationalExpr.fromString(value);
  }

  // ----- arithmetic -----

  add(other: RationalExpr): RationalExpr {
    // a/b + c/d = (ad + bc) / (bd)
    if (this.isInfinity() || other.isInfinity()) {
      return RationalExpr.INFINITY;
    }
    const n = this.num
      .multiply(other.den)
      .add(other.num.multiply(this.den));
    const d = this.den.multiply(other.den);
    return new RationalExpr(n, d);
  }

  subtract(other: RationalExpr): RationalExpr {
    return this.add(other.negate());
  }

  multiply(other: RationalExpr): RationalExpr {
    // Handle infinity cases
    if (this.isInfinity()) {
      if (other.isZero()) {
        // inf * 0 is indeterminate, return 0
        return RationalExpr.ZERO;
      }
      return RationalExpr.INFINITY;
    }
    if (other.isInfinity()) {
      if (this.isZero()) {
        return RationalExpr.ZERO;
      }
      return RationalExpr.INFINITY;
    }
    const n = this.num.multiply(other.num);
    const d = this.den.multiply(other.den);
    return new RationalExpr(n, d);
  }

  divide(other: RationalExpr): RationalExpr {
    return this.multiply(other.reciprocal());
  }

  reciprocal(): RationalExpr {
    if (this.isZero()) {
      return RationalExpr.INFINITY;
    }
    if (this.isInfinity()) {
      return RationalExpr.ZERO;
    }
    return new RationalExpr(this.den, this.num);
  }

  negate(): RationalExpr {
    return new RationalExpr(
      this.num.negate(),
      this.den
    );
  }

  // ----- queries -----

  isZero(): boolean {
    return this.num.isZero() && !this.den.isZero();
  }

  isInfinity(): boolean {
    return !this.num.isZero() && this.den.isZero();
  }

  isNumeric(): boolean {
    return this.num.isConstant()
      && this.den.isConstant();
  }

  toNumber(): number {
    if (this.isInfinity()) return Infinity;
    if (this.isZero()) return 0;
    if (!this.isNumeric()) {
      throw new Error(
        "Cannot convert symbolic expression "
        + "to number"
      );
    }
    return this.num.constantTerm()
      .divide(this.den.constantTerm())
      .toNumber();
  }

  // ----- display -----

  toString(): string {
    if (this.isZero()) return "0";
    if (this.isInfinity()) return "Infinity";

    const numStr = this.num.toString();
    const denStr = this.den.toString();

    // denominator is 1
    if (
      this.den.isConstant()
      && this.den.constantTerm().equals(Rational.ONE)
    ) {
      return numStr;
    }

    // Both numeric — display as fraction
    if (this.isNumeric()) {
      return `${numStr}/${denStr}`;
    }

    // Wrap in parens if the sub-expression has
    // multiple terms
    const nWrap = needsParens(numStr)
      ? `(${numStr})`
      : numStr;
    const dWrap = needsParens(denStr)
      ? `(${denStr})`
      : denStr;
    return `${nWrap}/${dWrap}`;
  }

  toDisplayString(unit: string = ""): string {
    if (this.isZero()) return `0${unit}`;
    if (this.isInfinity()) return "\u221E";

    return `${this.toString()}${unit}`;
  }

  equals(other: RationalExpr): boolean {
    // Cross-multiply check: a/b == c/d iff ad == bc
    return this.num
      .multiply(other.den)
      .equals(other.num.multiply(this.den));
  }

  // ----- simplification -----

  /**
   * Canonical form of numerator/denominator:
   *  1. Zero denominator => infinity (1/0), or 0
   *     for 0/0.
   *  2. Zero numerator => 0/1.
   *  3. Cancel scalar multiples (n = k*d => k/1).
   *  4. For single-variable polynomials, cancel the
   *     univariate GCD.
   *  5. Clear fractional coefficients and divide out
   *     the common integer content, so both sides
   *     have coprime integer coefficients.
   *  6. Make the denominator's leading coefficient
   *     positive.
   * All steps are exact (BigInt rationals).
   */
  private static simplify(
    num: Polynomial,
    den: Polynomial
  ): [Polynomial, Polynomial] {
    if (den.isZero()) {
      if (num.isZero()) {
        // 0/0 => treat as 0
        return [
          Polynomial.zero(),
          Polynomial.constant(1),
        ];
      }
      return [Polynomial.constant(1), den];
    }

    if (num.isZero()) {
      return [num, Polynomial.constant(1)];
    }

    let n = num;
    let d = den;

    const ratio = scalarRatio(n, d);
    if (ratio !== null) {
      n = Polynomial.constant(ratio);
      d = Polynomial.constant(1);
    } else {
      const vars = new Set([
        ...n.getVariables(),
        ...d.getVariables(),
      ]);
      if (vars.size === 1) {
        [n, d] = cancelUnivariateGCD(
          n, d, [...vars][0]
        );
      }
    }

    [n, d] = normalizeCoefficients(n, d);

    if (d.leadingCoefficient().isNegative()) {
      n = n.negate();
      d = d.negate();
    }
    return [n, d];
  }
}

// ----- helper functions -----

function needsParens(s: string): boolean {
  // Needs parens if contains + or - (not at start)
  return /[^e][+-]/.test(s);
}

function bigLcm(a: bigint, b: bigint): bigint {
  return (a / bigGcd(a, b)) * b;
}

/**
 * Scale n and d by the same rational so all
 * coefficients are integers with no common factor.
 */
function normalizeCoefficients(
  n: Polynomial,
  d: Polynomial
): [Polynomial, Polynomial] {
  const coefs = [
    ...n.getTerms().values(),
    ...d.getTerms().values(),
  ];
  let lcm = BigInt(1);
  for (const c of coefs) lcm = bigLcm(lcm, c.den);
  let g = BigInt(0);
  for (const c of coefs) {
    g = bigGcd(g, (c.num * lcm) / c.den);
  }
  const factor = Rational.of(lcm, g);
  if (factor.equals(Rational.ONE)) return [n, d];
  return [n.scale(factor), d.scale(factor)];
}

/**
 * If a = k * b for a rational k, return k;
 * otherwise null.
 */
function scalarRatio(
  a: Polynomial,
  b: Polynomial
): Rational | null {
  const aTerms = a.getTerms();
  const bTerms = b.getTerms();
  if (aTerms.size !== bTerms.size) return null;
  if (aTerms.size === 0) return null;

  let ratio: Rational | null = null;
  for (const [key, aCoef] of aTerms) {
    const bCoef = bTerms.get(key);
    if (!bCoef) return null;
    const r = aCoef.divide(bCoef);
    if (ratio === null) {
      ratio = r;
    } else if (!r.equals(ratio)) {
      return null;
    }
  }
  return ratio;
}

// Univariate helpers operate on exact coefficient
// arrays in ascending degree order:
// 3r^2 + 2r + 1 => [1, 2, 3]

function toUnivariateCoefs(
  p: Polynomial,
  varName: string
): Rational[] {
  const result: Rational[] = [];
  for (const [key, coef] of p.getTerms()) {
    const deg = key === ""
      ? 0
      : key.split("*").filter((v) => v === varName)
        .length;
    while (result.length <= deg) {
      result.push(Rational.ZERO);
    }
    result[deg] = result[deg].add(coef);
  }
  return result;
}

function fromUnivariateCoefs(
  coefs: Rational[],
  varName: string
): Polynomial {
  let result = Polynomial.zero();
  const varPoly = Polynomial.variable(varName);
  let power = Polynomial.constant(1);
  for (let i = 0; i < coefs.length; i++) {
    if (!coefs[i].isZero()) {
      result = result.add(power.scale(coefs[i]));
    }
    power = power.multiply(varPoly);
  }
  return result;
}

function trim(a: Rational[]): Rational[] {
  let i = a.length - 1;
  while (i >= 0 && a[i].isZero()) i--;
  return a.slice(0, i + 1);
}

/** Quotient and remainder of a / b (b non-zero). */
function polyDivMod(
  a: Rational[],
  b: Rational[]
): [Rational[], Rational[]] {
  a = trim(a);
  b = trim(b);
  const rem = [...a];
  const degB = b.length - 1;
  const lead = b[degB];
  const quot: Rational[] = [];
  for (let i = a.length - 1 - degB; i >= 0; i--) {
    const c = rem[i + degB].divide(lead);
    quot[i] = c;
    if (c.isZero()) continue;
    for (let j = 0; j <= degB; j++) {
      rem[i + j] = rem[i + j].subtract(c.multiply(b[j]));
    }
  }
  for (let i = 0; i < quot.length; i++) {
    if (!quot[i]) quot[i] = Rational.ZERO;
  }
  return [trim(quot), trim(rem.slice(0, degB))];
}

/** Monic GCD via the Euclidean algorithm. */
function univariateGCD(
  a: Rational[],
  b: Rational[]
): Rational[] {
  a = trim(a);
  b = trim(b);
  while (b.length > 0) {
    const [, r] = polyDivMod(a, b);
    a = b;
    b = r;
  }
  if (a.length === 0) return a;
  const lead = a[a.length - 1];
  return a.map((c) => c.divide(lead));
}

function cancelUnivariateGCD(
  num: Polynomial,
  den: Polynomial,
  varName: string
): [Polynomial, Polynomial] {
  const nCoefs = toUnivariateCoefs(num, varName);
  const dCoefs = toUnivariateCoefs(den, varName);
  const g = univariateGCD(nCoefs, dCoefs);
  if (g.length <= 1) return [num, den];
  const [newN] = polyDivMod(nCoefs, g);
  const [newD] = polyDivMod(dCoefs, g);
  return [
    fromUnivariateCoefs(newN, varName),
    fromUnivariateCoefs(newD, varName),
  ];
}

import { Polynomial } from "./Polynomial";

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
    return new RationalExpr(
      Polynomial.constant(n),
      Polynomial.constant(1)
    );
  }

  static fromString(s: string): RationalExpr {
    s = s.trim();
    if (
      s === "Infinity" ||
      s === "∞" ||
      s === "inf"
    ) {
      return RationalExpr.INFINITY;
    }
    // Try as number first
    const asNum = Number(s);
    if (!isNaN(asNum) && s !== "") {
      return RationalExpr.fromNumber(asNum);
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
    return (
      this.num.constantValue()
      / this.den.constantValue()
    );
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
      && Math.abs(this.den.constantValue() - 1)
        < 1e-15
    ) {
      return numStr;
    }

    // Both numeric — display as decimal
    if (this.isNumeric()) {
      return formatNum(this.toNumber());
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

    if (this.isNumeric()) {
      const n = this.toNumber();
      const formatted = formatNum(n);
      return `${formatted}${unit}`;
    }

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
   * Simplify numerator/denominator pair.
   *  1. If denominator is zero => keep as-is
   *     (infinity).
   *  2. If numerator is zero => (0, 1).
   *  3. If both are numeric constants => reduce
   *     fraction.
   *  4. Normalize sign: ensure leading coefficient
   *     of denominator is positive.
   *  5. Cancel scalar multiples.
   *  6. For single-variable polynomials, compute
   *     univariate GCD.
   */
  private static simplify(
    num: Polynomial,
    den: Polynomial
  ): [Polynomial, Polynomial] {
    // Case 1: denominator is zero (infinity)
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

    // Case 2: numerator is zero
    if (num.isZero()) {
      return [num, Polynomial.constant(1)];
    }

    // Case 3: both numeric constants
    if (num.isConstant() && den.isConstant()) {
      const nv = num.constantValue();
      const dv = den.constantValue();
      const g = gcd(Math.abs(nv), Math.abs(dv));
      const sign = dv < 0 ? -1 : 1;
      return [
        Polynomial.constant((nv / g) * sign),
        Polynomial.constant((dv / g) * sign),
      ];
    }

    // Case 4: normalize sign of denominator
    let n = num;
    let d = den;
    const denLead = leadingCoef(d);
    if (denLead < 0) {
      n = n.negate();
      d = d.negate();
    }

    // Case 5: check if polynomials are scalar
    // multiples of each other
    const ratio = scalarRatio(n, d);
    if (ratio !== null) {
      // n = ratio * d, so n/d = ratio
      return [
        Polynomial.constant(ratio),
        Polynomial.constant(1),
      ];
    }

    // Case 6: single-variable polynomial GCD
    const nVars = n.getVariables();
    const dVars = d.getVariables();
    if (
      nVars.size <= 1
      && dVars.size <= 1
    ) {
      const allVars = new Set([
        ...nVars,
        ...dVars,
      ]);
      if (allVars.size <= 1) {
        const varName =
          allVars.size === 1
            ? [...allVars][0]
            : undefined;
        if (varName) {
          const [rn, rd] = cancelUnivariateGCD(
            n,
            d,
            varName
          );
          n = rn;
          d = rd;
          // Re-normalize sign after GCD
          const dl = leadingCoef(d);
          if (dl < 0) {
            n = n.negate();
            d = d.negate();
          }
        }
      }
    }

    return [n, d];
  }
}

// ----- helper functions -----

function formatNum(n: number): string {
  if (!isFinite(n)) return "Infinity";
  if (Number.isInteger(n)) return n.toString();
  const s = n.toPrecision(10);
  return parseFloat(s).toString();
}

function needsParens(s: string): boolean {
  // Needs parens if contains + or - (not at start)
  return /[^e][+-]/.test(s);
}

/** GCD of two positive numbers (Euclidean). */
function gcd(a: number, b: number): number {
  // For floating point, use tolerance
  a = Math.abs(a);
  b = Math.abs(b);
  if (a < 1e-15) return b;
  if (b < 1e-15) return a;
  // If both are close to integers, use integer GCD
  if (
    Math.abs(a - Math.round(a)) < 1e-10
    && Math.abs(b - Math.round(b)) < 1e-10
  ) {
    let ia = Math.round(a);
    let ib = Math.round(b);
    while (ib !== 0) {
      const t = ib;
      ib = ia % ib;
      ia = t;
    }
    return ia;
  }
  return 1;
}

/** Get the leading coefficient of a polynomial. */
function leadingCoef(p: Polynomial): number {
  const terms = p.getTerms();
  // Pick first non-zero coefficient
  for (const [, coef] of terms) {
    return coef;
  }
  return 0;
}

/**
 * Check if a = ratio * b for some scalar ratio.
 * Returns ratio or null.
 */
function scalarRatio(
  a: Polynomial,
  b: Polynomial
): number | null {
  const aTerms = a.getTerms();
  const bTerms = b.getTerms();
  if (aTerms.size !== bTerms.size) return null;
  if (aTerms.size === 0) return null;

  let ratio: number | null = null;
  for (const [key, aCoef] of aTerms) {
    const bCoef = bTerms.get(key);
    if (bCoef === undefined) return null;
    const r = aCoef / bCoef;
    if (ratio === null) {
      ratio = r;
    } else if (Math.abs(r - ratio) > 1e-10) {
      return null;
    }
  }
  return ratio;
}

/**
 * Convert a polynomial to a univariate coefficient
 * array in ascending degree order.
 * e.g. 3r^2 + 2r + 1 => [1, 2, 3]
 */
function toUnivariateCoefs(
  p: Polynomial,
  varName: string
): number[] {
  const terms = p.getTerms();
  let maxDeg = 0;
  const coefMap = new Map<number, number>();

  for (const [key, coef] of terms) {
    let deg = 0;
    if (key !== "") {
      const parts = key.split("*");
      for (const part of parts) {
        if (part === varName) deg++;
      }
    }
    const cur = coefMap.get(deg) || 0;
    coefMap.set(deg, cur + coef);
    if (deg > maxDeg) maxDeg = deg;
  }

  const result: number[] = new Array(maxDeg + 1)
    .fill(0);
  for (const [deg, coef] of coefMap) {
    result[deg] = coef;
  }
  return result;
}

/**
 * Convert univariate coefficient array back to
 * Polynomial.
 */
function fromUnivariateCoefs(
  coefs: number[],
  varName: string
): Polynomial {
  let result = Polynomial.zero();
  const varPoly = Polynomial.variable(varName);
  let power = Polynomial.constant(1);
  for (let i = 0; i < coefs.length; i++) {
    if (Math.abs(coefs[i]) > 1e-15) {
      result = result.add(power.scale(coefs[i]));
    }
    if (i < coefs.length - 1) {
      power = power.multiply(varPoly);
    }
  }
  return result;
}

/**
 * Univariate polynomial GCD via Euclidean algorithm.
 * Operates on coefficient arrays in ascending order.
 */
function univariateGCD(
  a: number[],
  b: number[]
): number[] {
  // Trim trailing zeros
  a = trimTrailingZeros(a);
  b = trimTrailingZeros(b);

  if (a.length === 0) return b;
  if (b.length === 0) return a;

  // Ensure a has >= degree than b
  if (a.length < b.length) {
    [a, b] = [b, a];
  }

  while (b.length > 0) {
    const remainder = polyRemainder(a, b);
    a = b;
    b = trimTrailingZeros(remainder);
  }

  // Normalize: make leading coefficient 1
  if (a.length > 0) {
    const lc = a[a.length - 1];
    if (Math.abs(lc) > 1e-15) {
      a = a.map((c) => c / lc);
    }
  }

  return a;
}

function trimTrailingZeros(
  a: number[]
): number[] {
  let i = a.length - 1;
  while (i >= 0 && Math.abs(a[i]) < 1e-12) {
    i--;
  }
  return a.slice(0, i + 1);
}

function polyRemainder(
  a: number[],
  b: number[]
): number[] {
  const result = [...a];
  const bLead = b[b.length - 1];
  while (
    result.length >= b.length
    && result.length > 0
  ) {
    const leadIdx = result.length - 1;
    if (Math.abs(result[leadIdx]) < 1e-12) {
      result.pop();
      continue;
    }
    const factor = result[leadIdx] / bLead;
    const shift = result.length - b.length;
    for (let i = 0; i < b.length; i++) {
      result[i + shift] -= factor * b[i];
    }
    result.pop();
  }
  return result;
}

function polyDivide(
  a: number[],
  b: number[]
): number[] {
  if (b.length === 0) return a;
  a = trimTrailingZeros(a);
  b = trimTrailingZeros(b);
  if (a.length < b.length) return [0];

  const bLead = b[b.length - 1];
  const degA = a.length - 1;
  const degB = b.length - 1;
  const quotient = new Array(degA - degB + 1)
    .fill(0);
  const rem = [...a];

  for (
    let i = degA - degB;
    i >= 0;
    i--
  ) {
    const coef = rem[i + degB] / bLead;
    quotient[i] = coef;
    for (let j = 0; j < b.length; j++) {
      rem[i + j] -= coef * b[j];
    }
  }

  return quotient;
}

/**
 * Cancel common univariate GCD factor from
 * numerator and denominator.
 */
function cancelUnivariateGCD(
  num: Polynomial,
  den: Polynomial,
  varName: string
): [Polynomial, Polynomial] {
  const nCoefs = toUnivariateCoefs(num, varName);
  const dCoefs = toUnivariateCoefs(den, varName);

  const g = univariateGCD(nCoefs, dCoefs);
  if (g.length <= 1) {
    // GCD is a constant; nothing useful to cancel
    // beyond scalar (already handled).
    return [num, den];
  }

  const newN = polyDivide(nCoefs, g);
  const newD = polyDivide(dCoefs, g);

  return [
    fromUnivariateCoefs(
      trimTrailingZeros(newN),
      varName
    ),
    fromUnivariateCoefs(
      trimTrailingZeros(newD),
      varName
    ),
  ];
}

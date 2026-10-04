/**
 * Exact rational number backed by BigInt.
 *
 * Invariants: den > 0 and gcd(|num|, den) = 1.
 * (BigInt() calls instead of `1n` literals keep the
 * project's ES2017 target.)
 */

const B0 = BigInt(0);
const B1 = BigInt(1);
const B10 = BigInt(10);

function bigAbs(a: bigint): bigint {
  return a < B0 ? -a : a;
}

export function bigGcd(a: bigint, b: bigint): bigint {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b !== B0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export class Rational {
  readonly num: bigint;
  readonly den: bigint;

  private constructor(num: bigint, den: bigint) {
    this.num = num;
    this.den = den;
  }

  static of(
    num: bigint | number,
    den: bigint | number = 1
  ): Rational {
    let n = BigInt(num);
    let d = BigInt(den);
    if (d === B0) {
      throw new RangeError("Rational: zero denominator");
    }
    if (d < B0) {
      n = -n;
      d = -d;
    }
    const g = bigGcd(n, d);
    if (g > B1) {
      n /= g;
      d /= g;
    }
    return new Rational(n, d);
  }

  static readonly ZERO = Rational.of(0);
  static readonly ONE = Rational.of(1);

  /**
   * Convert a finite JS number to the simplest
   * rational that rounds back to the same double:
   * 0.1 -> 1/10, 1/3 -> 1/3, 1e-16 -> 1/10^16.
   * Walks the continued-fraction convergents of the
   * double's exact binary value.
   */
  static fromNumber(x: number): Rational {
    if (!isFinite(x)) {
      throw new RangeError(
        `Rational: non-finite number ${x}`
      );
    }
    if (Number.isInteger(x)) {
      return Rational.of(BigInt(x));
    }
    const exact = exactDyadic(x);
    // Convergents h/k of exact = [a0; a1, a2, ...]
    let hPrev = B0;
    let kPrev = B1;
    let h = B1;
    let k = B0;
    let p = exact.num;
    let q = exact.den;
    while (q !== B0) {
      // Floor division for negative p
      let a = p / q;
      if (p % q !== B0 && p < B0) a -= B1;
      const hNext = a * h + hPrev;
      const kNext = a * k + kPrev;
      hPrev = h;
      kPrev = k;
      h = hNext;
      k = kNext;
      const r = p - a * q;
      p = q;
      q = r;
      if (roundsTo(h, k, x)) {
        return Rational.of(h, k);
      }
    }
    return exact;
  }

  /**
   * Parse a decimal literal exactly, e.g. "0.1",
   * "-3.25", "1e-16", ".5", "2E3".
   * Returns null if the text is not a decimal.
   */
  static fromDecimalString(s: string): Rational | null {
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/
      .exec(s.trim());
    if (!m) return null;
    const [, sign, intPart, fracPart = "", expPart] = m;
    if (intPart === "" && fracPart === "") return null;
    let n = BigInt((intPart || "0") + fracPart);
    let exp = -fracPart.length + (
      expPart ? parseInt(expPart, 10) : 0
    );
    if (sign === "-") n = -n;
    if (exp >= 0) {
      return Rational.of(n * B10 ** BigInt(exp));
    }
    exp = -exp;
    return Rational.of(n, B10 ** BigInt(exp));
  }

  add(o: Rational): Rational {
    if (this.den === o.den) {
      return Rational.of(this.num + o.num, this.den);
    }
    return Rational.of(
      this.num * o.den + o.num * this.den,
      this.den * o.den
    );
  }

  subtract(o: Rational): Rational {
    return this.add(o.negate());
  }

  multiply(o: Rational): Rational {
    return Rational.of(
      this.num * o.num,
      this.den * o.den
    );
  }

  divide(o: Rational): Rational {
    if (o.num === B0) {
      throw new RangeError("Rational: divide by zero");
    }
    return Rational.of(
      this.num * o.den,
      this.den * o.num
    );
  }

  negate(): Rational {
    return new Rational(-this.num, this.den);
  }

  isZero(): boolean {
    return this.num === B0;
  }

  isInteger(): boolean {
    return this.den === B1;
  }

  isNegative(): boolean {
    return this.num < B0;
  }

  equals(o: Rational): boolean {
    return this.num === o.num && this.den === o.den;
  }

  /** Nearest double (approximate for huge values). */
  toNumber(): number {
    return bigRatioToNumber(this.num, this.den);
  }

  /** "3", "-1/2" */
  toString(): string {
    if (this.den === B1) return this.num.toString();
    return `${this.num}/${this.den}`;
  }
}

/** Exact value of a finite double as num/2^k. */
function exactDyadic(x: number): Rational {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  const hi = buf.getUint32(0);
  const lo = buf.getUint32(4);
  const sign = hi >>> 31 ? -1 : 1;
  const expBits = (hi >>> 20) & 0x7ff;
  let mant =
    (BigInt(hi & 0xfffff) << BigInt(32)) | BigInt(lo);
  let exp: number;
  if (expBits === 0) {
    exp = -1074; // subnormal
  } else {
    mant |= BigInt(1) << BigInt(52);
    exp = expBits - 1075;
  }
  if (sign < 0) mant = -mant;
  return exp >= 0
    ? Rational.of(mant << BigInt(exp))
    : Rational.of(mant, B1 << BigInt(-exp));
}

/** Does h/k round to exactly the double x? */
function roundsTo(h: bigint, k: bigint, x: number): boolean {
  return bigRatioToNumber(h, k) === x;
}

/**
 * Correctly rounded num/den as a double (for
 * |num|, |den| up to the double range; huge values
 * are scaled first).
 */
function bigRatioToNumber(num: bigint, den: bigint): number {
  if (num === B0) return 0;
  const LIMIT = BigInt(2) ** BigInt(53);
  if (bigAbs(num) <= LIMIT && den <= LIMIT) {
    // Both exact as doubles; IEEE division is
    // correctly rounded.
    return Number(num) / Number(den);
  }
  // Scale so the integer quotient has ~64 bits,
  // then round via Number().
  const neg = num < B0;
  const a = bigAbs(num);
  const shift =
    a.toString(2).length - den.toString(2).length - 64;
  let q: bigint;
  if (shift >= 0) {
    q = a / (den << BigInt(shift));
  } else {
    q = (a << BigInt(-shift)) / den;
  }
  // Two steps so 2^shift itself never under- or
  // overflows when the result is representable
  const half = Math.trunc(shift / 2);
  const v = Number(q) * Math.pow(2, half)
    * Math.pow(2, shift - half);
  return neg ? -v : v;
}

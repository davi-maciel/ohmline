import { Polynomial } from "./Polynomial";
import { Rational, bigGcd } from "./Rational";

/**
 * Multivariate polynomial GCD and exact division
 * over the rationals.
 *
 * gcd() uses the recursive primitive
 * pseudo-remainder sequence: treat both inputs as
 * polynomials in one main variable with
 * coefficients in the remaining variables, split
 * off contents (recursive GCDs of the
 * coefficients), and run Euclid on the primitive
 * parts using pseudo-remainders.
 */

type Exponents = Map<string, number>;

function parseKey(key: string): Exponents {
  const m: Exponents = new Map();
  if (key === "") return m;
  for (const v of key.split("*")) {
    m.set(v, (m.get(v) || 0) + 1);
  }
  return m;
}

function makeKey(m: Exponents): string {
  const parts: string[] = [];
  for (const v of [...m.keys()].sort()) {
    for (let i = 0; i < m.get(v)!; i++) parts.push(v);
  }
  return parts.join("*");
}

/** Lex order over alphabetically sorted variables. */
function lexCompare(
  a: Exponents,
  b: Exponents,
  vars: string[]
): number {
  for (const v of vars) {
    const d = (a.get(v) || 0) - (b.get(v) || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function allVars(...ps: Polynomial[]): string[] {
  const s = new Set<string>();
  for (const p of ps) {
    for (const v of p.getVariables()) s.add(v);
  }
  return [...s].sort();
}

function leadingTerm(
  p: Polynomial,
  vars: string[]
): [Exponents, Rational] {
  let best: [Exponents, Rational] | null = null;
  for (const [key, coef] of p.getTerms()) {
    const e = parseKey(key);
    if (!best || lexCompare(e, best[0], vars) > 0) {
      best = [e, coef];
    }
  }
  return best!;
}

function monomial(e: Exponents, c: Rational): Polynomial {
  const m = new Map<string, Rational>();
  m.set(makeKey(e), c);
  return new Polynomial(m);
}

/**
 * a / b when b divides a exactly, otherwise null.
 * Multivariate division in lex order.
 */
export function exactDivide(
  a: Polynomial,
  b: Polynomial
): Polynomial | null {
  if (b.isZero()) return null;
  if (b.isConstant()) {
    return a.scale(Rational.ONE.divide(b.constantTerm()));
  }
  const vars = allVars(a, b);
  const [lb, cb] = leadingTerm(b, vars);
  let r = a;
  let q = Polynomial.zero();
  while (!r.isZero()) {
    const [lr, cr] = leadingTerm(r, vars);
    const e: Exponents = new Map();
    for (const v of vars) {
      const d = (lr.get(v) || 0) - (lb.get(v) || 0);
      if (d < 0) return null;
      if (d > 0) e.set(v, d);
    }
    const t = monomial(e, cr.divide(cb));
    q = q.add(t);
    r = r.subtract(t.multiply(b));
  }
  return q;
}

/** Coefficients of p as a polynomial in x. */
function coeffsIn(
  p: Polynomial,
  x: string
): Map<number, Polynomial> {
  const out = new Map<number, Map<string, Rational>>();
  for (const [key, coef] of p.getTerms()) {
    const e = parseKey(key);
    const d = e.get(x) || 0;
    e.delete(x);
    if (!out.has(d)) out.set(d, new Map());
    out.get(d)!.set(makeKey(e), coef);
  }
  const res = new Map<number, Polynomial>();
  for (const [d, m] of out) res.set(d, new Polynomial(m));
  return res;
}

function degreeIn(p: Polynomial, x: string): number {
  let deg = -1;
  for (const d of coeffsIn(p, x).keys()) {
    if (d > deg) deg = d;
  }
  return deg;
}

function xPower(x: string, d: number): Polynomial {
  const e: Exponents = new Map();
  if (d > 0) e.set(x, d);
  return monomial(e, Rational.ONE);
}

/** GCD of p's coefficients with respect to x. */
function contentIn(p: Polynomial, x: string): Polynomial {
  let g = Polynomial.zero();
  for (const c of coeffsIn(p, x).values()) {
    g = gcd(g, c);
    if (g.isConstant()) return Polynomial.constant(1);
  }
  return g;
}

/**
 * Scale p so its coefficients are coprime integers.
 * Keeps pseudo-remainder coefficients from growing
 * exponentially.
 */
function integerPrimitive(p: Polynomial): Polynomial {
  const coefs = [...p.getTerms().values()];
  if (coefs.length === 0) return p;
  let lcm = BigInt(1);
  for (const c of coefs) {
    lcm = (lcm / bigGcd(lcm, c.den)) * c.den;
  }
  let g = BigInt(0);
  for (const c of coefs) {
    g = bigGcd(g, (c.num * lcm) / c.den);
  }
  return p.scale(Rational.of(lcm, g));
}

function primitivePartIn(
  p: Polynomial,
  x: string
): Polynomial {
  if (p.isZero()) return p;
  return integerPrimitive(
    exactDivide(p, contentIn(p, x))!
  );
}

/** Pseudo-remainder of a by b, as polynomials in x. */
function pseudoRemainder(
  a: Polynomial,
  b: Polynomial,
  x: string
): Polynomial {
  const db = degreeIn(b, x);
  const lcb = coeffsIn(b, x).get(db)!;
  let r = a;
  let e = degreeIn(a, x) - db + 1;
  while (!r.isZero() && degreeIn(r, x) >= db) {
    const dr = degreeIn(r, x);
    const lcr = coeffsIn(r, x).get(dr)!;
    r = r.multiply(lcb).subtract(
      lcr.multiply(xPower(x, dr - db)).multiply(b)
    );
    e--;
  }
  for (; e > 0; e--) r = r.multiply(lcb);
  return r;
}

/** Scale so the leading (display-order) coef is 1. */
function makeMonic(p: Polynomial): Polynomial {
  if (p.isZero()) return p;
  return p.scale(Rational.ONE.divide(p.leadingCoefficient()));
}

/**
 * Greatest common divisor, normalized so its
 * leading coefficient (display order) is 1.
 * gcd(0, 0) = 0; the GCD of non-zero constants is 1.
 */
export function gcd(a: Polynomial, b: Polynomial): Polynomial {
  if (a.isZero()) return makeMonic(b);
  if (b.isZero()) return makeMonic(a);
  if (a.isConstant() || b.isConstant()) {
    return Polynomial.constant(1);
  }

  // A common factor can only use shared variables
  const bv = b.getVariables();
  const shared = [...a.getVariables()]
    .filter((v) => bv.has(v)).sort();
  if (shared.length === 0) return Polynomial.constant(1);

  const x = shared[0];
  const ca = contentIn(a, x);
  const cb = contentIn(b, x);
  const c = gcd(ca, cb);

  let p = integerPrimitive(exactDivide(a, ca)!);
  let q = integerPrimitive(exactDivide(b, cb)!);
  if (degreeIn(p, x) < degreeIn(q, x)) [p, q] = [q, p];
  while (!q.isZero()) {
    if (degreeIn(q, x) === 0) {
      // q is primitive with no x: the primitive
      // parts are coprime
      p = Polynomial.constant(1);
      break;
    }
    const r = pseudoRemainder(p, q, x);
    p = q;
    q = primitivePartIn(r, x);
  }
  return makeMonic(c.multiply(primitivePartIn(p, x)));
}

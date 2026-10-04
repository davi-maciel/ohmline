/**
 * Property test: a symbolic result evaluated at
 * concrete variable values must equal the numeric
 * result for the circuit with those values
 * substituted in. Exact comparison.
 */
import {
  calculateEquivalentResistance,
} from "../circuitCalculator";
import { calculateCurrents } from "../currentCalculator";
import { RationalExpr, Polynomial } from "../symbolic";
import { Rational } from "../symbolic/Rational";
import type { Circuit } from "@/types/circuit";

let passed = 0;
let failed = 0;

function assert(
  condition: boolean,
  msg: string
): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${msg}`);
  }
}

// Deterministic PRNG (mulberry32)
let seed = 12345;
function rand(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(xs: T[]): T {
  return xs[Math.floor(rand() * xs.length)];
}

type Env = Map<string, Rational>;

function evalPoly(p: Polynomial, env: Env): Rational {
  let sum = Rational.ZERO;
  for (const [key, coef] of p.getTerms()) {
    let term = coef;
    if (key !== "") {
      for (const v of key.split("*")) {
        term = term.multiply(env.get(v)!);
      }
    }
    sum = sum.add(term);
  }
  return sum;
}

/** Value at env, or null if infinite/undefined. */
function evalExpr(
  e: RationalExpr,
  env: Env
): Rational | null {
  if (e.isInfinity()) return null;
  const d = evalPoly(e.den, env);
  if (d.isZero()) return null;
  return evalPoly(e.num, env).divide(d);
}

/** Substitute env into a value string. */
function substitute(
  v: number | string,
  env: Env
): string {
  const x = evalExpr(RationalExpr.parse(v), env);
  return x === null ? "Infinity" : x.toString();
}

const SYMBOLIC = [
  "r", "s", "2r", "r+1", "r+s", "3", "5", "1",
  "2s+3", "Infinity",
];

function randomCircuit(): Circuit {
  const nNodes = 3 + Math.floor(rand() * 4);
  const nodes: Circuit["nodes"] = [];
  for (let i = 0; i < nNodes; i++) {
    nodes.push({ id: `n${i}`, x: 0, y: 0, label: `${i}` });
  }
  const edges: Circuit["edges"] = [];
  const nEdges = nNodes + Math.floor(rand() * nNodes);
  for (let i = 0; i < nEdges; i++) {
    const a = Math.floor(rand() * nNodes);
    let b = Math.floor(rand() * nNodes);
    if (b === a) b = (a + 1) % nNodes;
    edges.push({
      id: `e${i}`,
      nodeA: `n${a}`,
      nodeB: `n${b}`,
      resistance: pick(SYMBOLIC),
    });
  }
  return { nodes, edges };
}

function withValues(c: Circuit, env: Env): Circuit {
  return {
    nodes: c.nodes.map((n) => ({
      ...n,
      potential: n.potential === undefined
        ? undefined
        : substitute(n.potential, env),
    })),
    edges: c.edges.map((e) => ({
      ...e,
      resistance: substitute(e.resistance, env),
    })),
  };
}

function sameValue(
  sym: RationalExpr | null | undefined,
  num: RationalExpr | null | undefined,
  env: Env
): boolean {
  if (!sym || !num) return sym === num;
  if (num.isInfinity()) {
    return evalExpr(sym, env) === null;
  }
  const v = evalExpr(sym, env);
  return v !== null && v.equals(evalExpr(num, env)!);
}

const TRIALS = 40;
for (let t = 0; t < TRIALS; t++) {
  const c = randomCircuit();
  const env: Env = new Map([
    ["r", Rational.of(1 + Math.floor(rand() * 9))],
    ["s", Rational.of(1 + Math.floor(rand() * 9))],
    ["V", Rational.of(1 + Math.floor(rand() * 20))],
  ]);
  const numeric = withValues(c, env);

  // Equivalent resistance between nodes 0 and 1
  const rs = calculateEquivalentResistance(c, "n0", "n1");
  const rn = calculateEquivalentResistance(
    numeric, "n0", "n1"
  );
  assert(
    sameValue(rs, rn, env),
    `trial ${t} R_eq: symbolic ${rs} vs numeric ${rn}`
  );

  // Currents with V at node 0 and ground at node 1
  c.nodes[0].potential = "V";
  c.nodes[1].potential = 0;
  const cs = calculateCurrents(c);
  const cn = calculateCurrents(withValues(c, env));
  for (const e of c.edges) {
    assert(
      sameValue(cs.get(e.id), cn.get(e.id), env),
      `trial ${t} I(${e.id}): symbolic `
      + `${cs.get(e.id)} vs numeric ${cn.get(e.id)}`
    );
  }
}

// --- summary ---

console.log(
  `\nsymbolicConsistency tests: ${passed} passed, `
  + `${failed} failed`
);
if (failed > 0) process.exit(1);

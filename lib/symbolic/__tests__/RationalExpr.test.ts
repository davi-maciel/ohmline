import { RationalExpr } from "../RationalExpr";
import { Polynomial } from "../Polynomial";

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

function assertEq(
  a: string,
  b: string,
  msg: string
): void {
  assert(a === b, `${msg}: got "${a}", want "${b}"`);
}

function assertNumEq(
  a: number,
  b: number,
  msg: string,
  tol = 1e-9
): void {
  assert(
    Math.abs(a - b) < tol,
    `${msg}: got ${a}, want ${b}`
  );
}

// --- parse ---

assert(
  RationalExpr.parse(0).isZero(),
  "parse 0 is zero"
);
assert(
  RationalExpr.parse(Infinity).isInfinity(),
  "parse Infinity"
);
assert(
  RationalExpr.parse("Infinity").isInfinity(),
  "parse 'Infinity'"
);
assertNumEq(
  RationalExpr.parse(10).toNumber(), 10,
  "parse 10"
);
assertNumEq(
  RationalExpr.parse(-3).toNumber(), -3,
  "parse -3"
);
assertEq(
  RationalExpr.parse("r").toString(), "r",
  "parse 'r'"
);
assertEq(
  RationalExpr.parse("2r+10").toString(),
  "2r+10",
  "parse '2r+10'"
);

// --- fromNumber ---

assertNumEq(
  RationalExpr.fromNumber(5).toNumber(), 5,
  "fromNumber 5"
);
assert(
  RationalExpr.fromNumber(0).isZero(),
  "fromNumber 0"
);

// --- constants ---

assert(RationalExpr.ZERO.isZero(), "ZERO");
assertNumEq(
  RationalExpr.ONE.toNumber(), 1, "ONE"
);
assert(
  RationalExpr.INFINITY.isInfinity(), "INFINITY"
);

// --- add ---

// 10 + 20 = 30
assertNumEq(
  RationalExpr.fromNumber(10)
    .add(RationalExpr.fromNumber(20))
    .toNumber(),
  30,
  "10 + 20 = 30"
);

// r + r = 2r
assertEq(
  RationalExpr.parse("r")
    .add(RationalExpr.parse("r")).toString(),
  "2r",
  "r + r = 2r"
);

// r + 10
assertEq(
  RationalExpr.parse("r")
    .add(RationalExpr.fromNumber(10))
    .toString(),
  "r+10",
  "r + 10"
);

// --- subtract ---

assertNumEq(
  RationalExpr.fromNumber(10)
    .subtract(RationalExpr.fromNumber(3))
    .toNumber(),
  7,
  "10 - 3 = 7"
);

// --- multiply ---

assertNumEq(
  RationalExpr.fromNumber(3)
    .multiply(RationalExpr.fromNumber(4))
    .toNumber(),
  12,
  "3 * 4 = 12"
);

// --- divide ---

assertNumEq(
  RationalExpr.fromNumber(10)
    .divide(RationalExpr.fromNumber(2))
    .toNumber(),
  5,
  "10 / 2 = 5"
);

// Divide by zero => infinity
assert(
  RationalExpr.fromNumber(5)
    .divide(RationalExpr.ZERO)
    .isInfinity(),
  "5 / 0 = infinity"
);

// --- reciprocal ---

assertNumEq(
  RationalExpr.fromNumber(4)
    .reciprocal().toNumber(),
  0.25,
  "1/4 = 0.25"
);
assert(
  RationalExpr.ZERO
    .reciprocal().isInfinity(),
  "1/0 = infinity"
);
assert(
  RationalExpr.INFINITY
    .reciprocal().isZero(),
  "1/infinity = 0"
);

// --- negate ---

assertNumEq(
  RationalExpr.fromNumber(5)
    .negate().toNumber(),
  -5,
  "negate 5"
);

// --- series: r + r = 2r ---

assertEq(
  RationalExpr.parse("r")
    .add(RationalExpr.parse("r"))
    .toString(),
  "2r",
  "series r + r"
);

// --- parallel: r || r = r/2 ---

// R_parallel = 1 / (1/R1 + 1/R2)
const r = RationalExpr.parse("r");
const rParallel = r.reciprocal()
  .add(r.reciprocal())
  .reciprocal();
assertEq(
  rParallel.toString(), "r/2",
  "parallel r || r = r/2"
);

// --- parallel: 10 || 10 = 5 ---

const r10 = RationalExpr.fromNumber(10);
const p10 = r10.reciprocal()
  .add(r10.reciprocal())
  .reciprocal();
assertNumEq(
  p10.toNumber(), 5,
  "parallel 10 || 10 = 5"
);

// --- parallel: r || 2r = 2r/3 ---

const r1 = RationalExpr.parse("r");
const r2 = RationalExpr.parse("2r");
const rPar = r1.reciprocal()
  .add(r2.reciprocal())
  .reciprocal();
assertEq(
  rPar.toString(), "2r/3",
  "parallel r || 2r = 2r/3"
);

// --- queries ---

assert(
  RationalExpr.fromNumber(5).isNumeric(),
  "5 isNumeric"
);
assert(
  !RationalExpr.parse("r").isNumeric(),
  "r is not numeric"
);

// --- display ---

assertEq(
  RationalExpr.fromNumber(5)
    .toDisplayString("A"),
  "5A",
  "display 5A"
);
assertEq(
  RationalExpr.INFINITY.toDisplayString(),
  "\u221E",
  "display infinity"
);
assertEq(
  RationalExpr.ZERO.toDisplayString("V"),
  "0V",
  "display 0V"
);

// --- equals ---

assert(
  RationalExpr.fromNumber(5)
    .equals(RationalExpr.fromNumber(5)),
  "5 equals 5"
);
assert(
  !RationalExpr.fromNumber(5)
    .equals(RationalExpr.fromNumber(3)),
  "5 != 3"
);

// --- fraction simplification ---

// 2/6 displays as 1/3
assertEq(
  new RationalExpr(
    Polynomial.constant(2),
    Polynomial.constant(6)
  ).toString(),
  "1/3",
  "2/6 simplifies to 1/3"
);

// 0.5 displays as 1/2
assertEq(
  RationalExpr.fromNumber(0.5).toString(),
  "1/2",
  "0.5 displays as 1/2"
);

// 1/3 displays as 1/3
assertEq(
  RationalExpr.fromNumber(1 / 3).toString(),
  "1/3",
  "1/3 displays as 1/3"
);

// 1/4 via reciprocal
assertEq(
  RationalExpr.fromNumber(4)
    .reciprocal().toString(),
  "1/4",
  "1/4 displays as 1/4"
);

// 2r/4 simplifies to r/2
assertEq(
  RationalExpr.parse("2r")
    .divide(RationalExpr.fromNumber(4))
    .toString(),
  "r/2",
  "2r/4 simplifies to r/2"
);

// 0.5 display with unit
assertEq(
  RationalExpr.fromNumber(0.5)
    .toDisplayString("\u03A9"),
  "1/2\u03A9",
  "0.5 displays as 1/2 with unit"
);

// --- summary ---

console.log(
  `\nRationalExpr tests: ${passed} passed, `
  + `${failed} failed`
);
if (failed > 0) process.exit(1);

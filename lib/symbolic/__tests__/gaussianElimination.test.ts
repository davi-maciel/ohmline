import { RationalExpr } from "../RationalExpr";
import {
  solveLinearSystem,
} from "../gaussianElimination";

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

function num(n: number): RationalExpr {
  return RationalExpr.fromNumber(n);
}

// --- 1x1 system ---

// 5x = 10 => x = 2
{
  const A = [[num(5)]];
  const b = [num(10)];
  const x = solveLinearSystem(A, b);
  assert(x !== null, "1x1 solvable");
  if (x) {
    assertNumEq(x[0].toNumber(), 2, "1x1: x=2");
  }
}

// --- 2x2 numeric system ---

// 2x + y = 5
// x + 3y = 10
// => x = 1, y = 3
{
  const A = [
    [num(2), num(1)],
    [num(1), num(3)],
  ];
  const b = [num(5), num(10)];
  const x = solveLinearSystem(A, b);
  assert(x !== null, "2x2 solvable");
  if (x) {
    assertNumEq(x[0].toNumber(), 1, "2x2: x=1");
    assertNumEq(x[1].toNumber(), 3, "2x2: y=3");
  }
}

// --- 3x3 numeric system ---

// x + y + z = 6
// 2x + y + z = 7
// x + 2y + z = 8
// => x = 1, y = 2, z = 3
{
  const A = [
    [num(1), num(1), num(1)],
    [num(2), num(1), num(1)],
    [num(1), num(2), num(1)],
  ];
  const b = [num(6), num(7), num(8)];
  const x = solveLinearSystem(A, b);
  assert(x !== null, "3x3 solvable");
  if (x) {
    assertNumEq(
      x[0].toNumber(), 1, "3x3: x=1"
    );
    assertNumEq(
      x[1].toNumber(), 2, "3x3: y=2"
    );
    assertNumEq(
      x[2].toNumber(), 3, "3x3: z=3"
    );
  }
}

// --- singular system ---

// x + y = 1
// x + y = 2
// => no solution
{
  const A = [
    [num(1), num(1)],
    [num(1), num(1)],
  ];
  const b = [num(1), num(2)];
  const x = solveLinearSystem(A, b);
  assert(x === null, "singular returns null");
}

// --- 1x1 symbolic system ---

// r * x = 1 => x = 1/r
{
  const A = [[RationalExpr.parse("r")]];
  const b = [RationalExpr.ONE];
  const x = solveLinearSystem(A, b);
  assert(x !== null, "1x1 symbolic solvable");
  if (x) {
    assert(
      x[0].toString() === "1/r",
      `1x1 symbolic: x=1/r, got ${x[0]}`
    );
  }
}

// --- empty system ---

{
  const x = solveLinearSystem([], []);
  assert(x !== null, "empty system solvable");
  assert(
    x !== null && x.length === 0,
    "empty system: empty result"
  );
}

// --- summary ---

console.log(
  `\ngaussianElimination tests: `
  + `${passed} passed, ${failed} failed`
);
if (failed > 0) process.exit(1);

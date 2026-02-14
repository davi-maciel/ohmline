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

// --- parse ---

assertEq(
  Polynomial.parse("0").toString(), "0",
  "parse 0"
);
assertEq(
  Polynomial.parse("5").toString(), "5",
  "parse 5"
);
assertEq(
  Polynomial.parse("-3").toString(), "-3",
  "parse -3"
);
assertEq(
  Polynomial.parse("r").toString(), "r",
  "parse r"
);
assertEq(
  Polynomial.parse("2r").toString(), "2r",
  "parse 2r"
);
assertEq(
  Polynomial.parse("-r").toString(), "-r",
  "parse -r"
);
assertEq(
  Polynomial.parse("3r+5").toString(), "3r+5",
  "parse 3r+5"
);
assertEq(
  Polynomial.parse("r+10").toString(), "r+10",
  "parse r+10"
);

// --- static constructors ---

assert(
  Polynomial.zero().isZero(),
  "zero is zero"
);
assert(
  Polynomial.constant(7).isConstant(),
  "constant 7 is constant"
);
assertEq(
  Polynomial.variable("x").toString(), "x",
  "variable x"
);

// --- add ---

assertEq(
  Polynomial.parse("r")
    .add(Polynomial.parse("r")).toString(),
  "2r",
  "r + r = 2r"
);
assertEq(
  Polynomial.parse("2r")
    .add(Polynomial.parse("3r")).toString(),
  "5r",
  "2r + 3r = 5r"
);
assertEq(
  Polynomial.parse("r")
    .add(Polynomial.constant(10)).toString(),
  "r+10",
  "r + 10"
);
assertEq(
  Polynomial.parse("r")
    .add(Polynomial.parse("-r")).toString(),
  "0",
  "r + (-r) = 0"
);

// --- subtract ---

assertEq(
  Polynomial.parse("3r")
    .subtract(Polynomial.parse("r")).toString(),
  "2r",
  "3r - r = 2r"
);

// --- multiply ---

assertEq(
  Polynomial.parse("r")
    .multiply(Polynomial.parse("r")).toString(),
  "r^2",
  "r * r = r^2"
);
assertEq(
  Polynomial.parse("2r")
    .multiply(Polynomial.constant(3)).toString(),
  "6r",
  "2r * 3 = 6r"
);

// (r+1)(r+2) = r^2 + 3r + 2
const prod = Polynomial.parse("r")
  .add(Polynomial.constant(1))
  .multiply(
    Polynomial.parse("r")
      .add(Polynomial.constant(2))
  );
// Should contain r^2, 3r, 2
assert(
  prod.toString().includes("r^2"),
  "(r+1)(r+2) has r^2"
);

// --- scale ---

assertEq(
  Polynomial.parse("r").scale(3).toString(),
  "3r",
  "r * 3 = 3r"
);
assertEq(
  Polynomial.parse("r").scale(0).toString(),
  "0",
  "r * 0 = 0"
);

// --- negate ---

assertEq(
  Polynomial.parse("r").negate().toString(),
  "-r",
  "negate r"
);

// --- queries ---

assert(
  Polynomial.zero().isZero(),
  "zero isZero"
);
assert(
  !Polynomial.parse("r").isZero(),
  "r is not zero"
);
assert(
  Polynomial.constant(5).isConstant(),
  "5 isConstant"
);
assert(
  !Polynomial.parse("r").isConstant(),
  "r is not constant"
);
assert(
  Polynomial.constant(5).constantValue() === 5,
  "constantValue of 5"
);
assert(
  Polynomial.parse("r").getVariables().has("r"),
  "r has variable r"
);

// --- equals ---

assert(
  Polynomial.parse("r")
    .equals(Polynomial.parse("r")),
  "r equals r"
);
assert(
  !Polynomial.parse("r")
    .equals(Polynomial.parse("2r")),
  "r != 2r"
);

// --- degree ---

assert(
  Polynomial.constant(5).degree() === 0,
  "degree of constant is 0"
);
assert(
  Polynomial.parse("r").degree() === 1,
  "degree of r is 1"
);
assert(
  Polynomial.parse("r")
    .multiply(Polynomial.parse("r"))
    .degree() === 2,
  "degree of r^2 is 2"
);

// --- summary ---

console.log(
  `\nPolynomial tests: ${passed} passed, `
  + `${failed} failed`
);
if (failed > 0) process.exit(1);

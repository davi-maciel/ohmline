import { Rational } from "../Rational";

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

// --- construction and normalization ---

assertEq(Rational.of(2, 6).toString(), "1/3", "2/6");
assertEq(Rational.of(3, -6).toString(), "-1/2", "3/-6");
assertEq(Rational.of(0, 5).toString(), "0", "0/5");
let threw = false;
try {
  Rational.of(1, 0);
} catch {
  threw = true;
}
assert(threw, "zero denominator throws");

// --- fromNumber: simplest round-tripping rational ---

assertEq(Rational.fromNumber(0.1).toString(), "1/10", "0.1");
assertEq(
  Rational.fromNumber(1 / 3).toString(), "1/3", "1/3"
);
assertEq(
  Rational.fromNumber(-2.5).toString(), "-5/2", "-2.5"
);
assertEq(
  Rational.fromNumber(1e-16).toString(),
  "1/10000000000000000",
  "1e-16 is not zero"
);
assertEq(
  Rational.fromNumber(1e20).toString(),
  "100000000000000000000",
  "1e20"
);
assert(
  Rational.fromNumber(Math.PI).toNumber() === Math.PI,
  "pi round-trips"
);
assert(
  Rational.fromNumber(5e-324).toNumber() === 5e-324,
  "subnormal round-trips"
);

// --- fromDecimalString: exact ---

assertEq(
  Rational.fromDecimalString("0.1")!.toString(),
  "1/10",
  "'0.1'"
);
assertEq(
  Rational.fromDecimalString("1.00000000001")!.toString(),
  "100000000001/100000000000",
  "'1.00000000001' exact"
);
assertEq(
  Rational.fromDecimalString("-3.25e2")!.toString(),
  "-325",
  "'-3.25e2'"
);
assertEq(
  Rational.fromDecimalString(".5")!.toString(),
  "1/2",
  "'.5'"
);
assert(
  Rational.fromDecimalString("r") === null,
  "'r' is not a decimal"
);
assert(
  Rational.fromDecimalString(".") === null,
  "'.' is not a decimal"
);

// --- arithmetic is exact ---

const tenth = Rational.fromDecimalString("0.1")!;
const fifth = Rational.fromDecimalString("0.2")!;
assertEq(
  tenth.add(fifth).toString(), "3/10", "0.1 + 0.2"
);
assertEq(
  Rational.fromNumber(1e20).add(Rational.ONE).toString(),
  "100000000000000000001",
  "1e20 + 1 keeps the 1"
);
assertEq(
  Rational.of(1, 3).multiply(Rational.of(3, 4))
    .toString(),
  "1/4",
  "1/3 * 3/4"
);
assertEq(
  Rational.of(1, 2).divide(Rational.of(-1, 4))
    .toString(),
  "-2",
  "1/2 / -1/4"
);
assert(
  !Rational.fromNumber(1e-13).equals(Rational.ZERO),
  "1e-13 != 0"
);

// --- toNumber ---

assert(Rational.of(1, 4).toNumber() === 0.25, "1/4");
const big = Rational.of(
  BigInt(10) ** BigInt(400) + BigInt(1),
  BigInt(10) ** BigInt(400)
);
assert(
  big.toNumber() === 1,
  `huge ratio ~ 1, got ${big.toNumber()}`
);

// --- summary ---

console.log(
  `\nRational tests: ${passed} passed, `
  + `${failed} failed`
);
if (failed > 0) process.exit(1);

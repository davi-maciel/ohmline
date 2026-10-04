import { RationalExpr } from "../RationalExpr";
import { Polynomial } from "../Polynomial";
import { ParseError } from "../parser";

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

function parses(input: string, want: string): void {
  let got: string;
  try {
    got = RationalExpr.parse(input).toString();
  } catch (e) {
    got = `threw ${(e as Error).message}`;
  }
  assert(
    got === want,
    `parse "${input}": got "${got}", want "${want}"`
  );
}

function rejects(input: string | number): void {
  let threw = false;
  try {
    RationalExpr.parse(input);
  } catch (e) {
    threw = e instanceof ParseError;
  }
  assert(threw, `"${input}" should be a ParseError`);
  assert(
    RationalExpr.tryParse(input) === null,
    `tryParse("${input}") should be null`
  );
}

// --- numbers are exact ---
parses("10", "10");
parses("0.1", "1/10");
parses("-2.5", "-5/2");
parses("1e-6", "1/1000000");
parses("1.00000000001", "100000000001/100000000000");
parses(".5", "1/2");

// --- infinity ---
parses("Infinity", "Infinity");
parses("-inf", "Infinity");
parses("∞", "Infinity");

// --- division (B1) ---
parses("r/2", "r/2");
parses("(r+1)/2", "(r+1)/2");
parses("1/r", "1/r");
parses("r/0", "Infinity");
parses("2/4", "1/2");
{
  const half = RationalExpr.parse("r/2");
  assert(
    half.add(half).toString() === "r",
    "r/2 + r/2 = r"
  );
}

// --- implicit multiplication ---
parses("2r", "2r");
parses("2(r+1)", "2r+2");
parses("r s", "r·s");
parses("2r s", "2r·s");
parses("(r+1)(r-1)", "r^2-1");
parses("r·s", "r·s");
parses("r×s", "r·s");

// --- precedence ---
parses("-r^2", "-r^2");
parses("2+3*4", "14");
parses("2^3^2", "512");
parses("r^-1", "1/r");
parses("1/2r", "r/2");

// --- identifiers ---
parses("R1", "R1");
parses("R_a", "R_a");
parses("2e", "2e");
parses("2e3", "2000");
parses("ρ", "ρ");
// Multi-letter names stay one variable but display
// differently from a product (B3)
assert(
  RationalExpr.parse("rs").toString()
    !== RationalExpr.parse("r*s").toString(),
  "rs and r*s display differently"
);

// --- display round-trips ---
for (const s of [
  "r·s+2", "(r+s)/2", "V/(2r)", "r^2-1",
]) {
  const e = RationalExpr.parse(s);
  assert(
    RationalExpr.parse(e.toString()).equals(e),
    `round-trip "${s}" via "${e}"`
  );
}

// --- rejected input (B2) ---
rejects("");
rejects("   ");
rejects("!!");
rejects("sqrt(2)");
rejects("sin(r)");
rejects("pi");
rejects("r+");
rejects("(r+1");
rejects("r+1)");
rejects("2 3");
rejects("r^s");
rejects("r^0.5");
rejects("r^1000");
rejects("r+Infinity");
rejects("10Ω");
rejects(NaN);

// --- Polynomial.parse ---
assert(
  Polynomial.parse("(r+2)/2").toString() === "(1/2)r+1",
  "polynomial with constant division"
);
{
  let threw = false;
  try {
    Polynomial.parse("1/r");
  } catch (e) {
    threw = e instanceof ParseError;
  }
  assert(threw, "polynomial rejects division by r");
}

// --- summary ---

console.log(
  `\nparser tests: ${passed} passed, `
  + `${failed} failed`
);
if (failed > 0) process.exit(1);

import { Polynomial } from "../Polynomial";
import { gcd, exactDivide } from "../polyGcd";

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

const P = (s: string) => Polynomial.parse(s);

// --- gcd ---

assertEq(
  gcd(P("r^2-1"), P("r^2+2r+1")).toString(),
  "r+1",
  "univariate gcd"
);
assertEq(
  gcd(P("(r+s)*(r-s)"), P("(r+s)^2")).toString(),
  "r+s",
  "bivariate gcd"
);
assertEq(
  gcd(P("x*y"), P("x*z")).toString(), "x",
  "monomial gcd"
);
assertEq(
  gcd(P("2r+2s"), P("4r+4s")).toString(), "r+s",
  "scalar multiples"
);
assertEq(
  gcd(P("a*b+a*c"), P("a*d")).toString(), "a",
  "content factor"
);
assertEq(
  gcd(P("r+1"), P("s+1")).toString(), "1",
  "disjoint variables"
);
assertEq(
  gcd(P("r^2+1"), P("r+1")).toString(), "1",
  "coprime"
);
assertEq(
  gcd(P("6"), P("4")).toString(), "1",
  "constants"
);
assertEq(
  gcd(Polynomial.zero(), P("2r+4")).toString(), "r+2",
  "gcd(0, p) is monic p"
);
{
  // (a+b)(c+d)(a-c) and (a+b)(a-c)^2 share
  // (a+b)(a-c)
  const f = P("(a+b)*(c+d)*(a-c)");
  const g = P("(a+b)*(a-c)^2");
  const want = P("(a+b)*(a-c)");
  const got = gcd(f, g);
  assert(
    exactDivide(got, want)?.isConstant() === true,
    `three-variable gcd: got ${got}`
  );
}

// --- exactDivide ---

assertEq(
  exactDivide(P("r^2-s^2"), P("r-s"))!.toString(),
  "r+s",
  "exact division"
);
assert(
  exactDivide(P("r^2+1"), P("r+1")) === null,
  "non-exact division is null"
);
assertEq(
  exactDivide(P("3r"), P("6"))!.toString(), "(1/2)r",
  "divide by constant"
);
assert(
  exactDivide(P("r"), Polynomial.zero()) === null,
  "divide by zero is null"
);

// --- summary ---

console.log(
  `\npolyGcd tests: ${passed} passed, `
  + `${failed} failed`
);
if (failed > 0) process.exit(1);

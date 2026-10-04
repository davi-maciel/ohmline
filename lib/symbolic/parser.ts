import { Rational } from "./Rational";

/**
 * Parser for resistance / potential expressions.
 *
 * Grammar (implicit multiplication binds like *):
 *   expr    := term (("+" | "-") term)*
 *   term    := unary (("*" | "/") unary | unary)*
 *   unary   := ("+" | "-") unary | power
 *   power   := primary ("^" unary)?
 *   primary := number | identifier | "(" expr ")"
 *
 * Numbers are decimal literals ("10", "0.1", "1e-6")
 * and are read exactly. Identifiers are variables
 * ("r", "R1", "R_a"). Exponents must be integer
 * constants. Anything else (functions, unknown
 * symbols, trailing operators) is a ParseError, so
 * typos never silently become variables.
 */

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/** Operations the parser evaluates into. */
export interface Algebra<T> {
  number(r: Rational): T;
  variable(name: string): T;
  add(a: T, b: T): T;
  subtract(a: T, b: T): T;
  multiply(a: T, b: T): T;
  divide(a: T, b: T): T;
  negate(a: T): T;
  power(a: T, n: number): T;
  /** The integer value of t, or null. */
  asInteger(t: T): number | null;
}

type Token =
  | { kind: "num"; value: Rational; text: string }
  | { kind: "id"; name: string }
  | { kind: "op"; op: string };

const FUNCTIONS = new Set([
  "sqrt", "sin", "cos", "tan", "log", "ln", "exp",
  "abs",
]);
const RESERVED = new Set([
  "Infinity", "inf", "pi", "NaN",
]);
const MAX_EXPONENT = 64;

const NUM_RE = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/;
// Latin or Greek letter or "_", then also digits.
// Capital omega (U+03A9) is excluded so "10Ω" is
// rejected rather than read as 10 times a variable.
const LETTER = "A-Za-z_\\u0391-\\u03A8\\u03B1-\\u03C9";
const ID_RE = new RegExp(`^[${LETTER}][${LETTER}0-9]*`);

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = s.slice(i);
    const num = NUM_RE.exec(rest);
    if (num) {
      tokens.push({
        kind: "num",
        value: Rational.fromDecimalString(num[0])!,
        text: num[0],
      });
      i += num[0].length;
      continue;
    }
    const id = ID_RE.exec(rest);
    if (id) {
      tokens.push({ kind: "id", name: id[0] });
      i += id[0].length;
      continue;
    }
    if ("+-*/^()".includes(ch)) {
      tokens.push({ kind: "op", op: ch });
      i++;
      continue;
    }
    if (ch === "·" || ch === "×") {
      // "·" and "×" are multiplication
      tokens.push({ kind: "op", op: "*" });
      i++;
      continue;
    }
    throw new ParseError(`Unexpected character "${ch}"`);
  }
  return tokens;
}

export function parseExpression<T>(
  input: string,
  alg: Algebra<T>
): T {
  const tokens = tokenize(input);
  if (tokens.length === 0) {
    throw new ParseError("Empty expression");
  }
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const isOp = (op: string): boolean => {
    const t = tokens[pos];
    return t !== undefined && t.kind === "op"
      && t.op === op;
  };

  function expr(): T {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { op: string }).op;
      const right = term();
      left = op === "+"
        ? alg.add(left, right)
        : alg.subtract(left, right);
    }
    return left;
  }

  function startsPrimary(): boolean {
    const t = peek();
    if (!t) return false;
    return t.kind === "id"
      || (t.kind === "op" && t.op === "(");
  }

  function term(): T {
    let left = unary();
    for (;;) {
      if (isOp("*")) {
        pos++;
        left = alg.multiply(left, unary());
      } else if (isOp("/")) {
        pos++;
        left = alg.divide(left, unary());
      } else if (startsPrimary()) {
        // Implicit multiplication: 2r, r s, 2(r+1)
        left = alg.multiply(left, power());
      } else {
        return left;
      }
    }
  }

  function unary(): T {
    if (isOp("-")) {
      pos++;
      return alg.negate(unary());
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  }

  function power(): T {
    const base = primary();
    if (!isOp("^")) return base;
    pos++;
    const n = alg.asInteger(unary());
    if (n === null) {
      throw new ParseError(
        "Exponent must be an integer constant"
      );
    }
    if (Math.abs(n) > MAX_EXPONENT) {
      throw new ParseError(
        `Exponent too large (max ${MAX_EXPONENT})`
      );
    }
    return alg.power(base, n);
  }

  function primary(): T {
    const t = tokens[pos++];
    if (!t) {
      throw new ParseError("Unexpected end of expression");
    }
    if (t.kind === "num") {
      if (peek()?.kind === "num") {
        throw new ParseError(
          `Missing operator after "${t.text}"`
        );
      }
      return alg.number(t.value);
    }
    if (t.kind === "id") {
      if (FUNCTIONS.has(t.name)) {
        throw new ParseError(
          `Functions are not supported: ${t.name}`
        );
      }
      if (RESERVED.has(t.name)) {
        throw new ParseError(
          `"${t.name}" is not allowed inside an `
          + "expression"
        );
      }
      return alg.variable(t.name);
    }
    if (t.op === "(") {
      const inner = expr();
      if (!isOp(")")) {
        throw new ParseError("Missing closing parenthesis");
      }
      pos++;
      return inner;
    }
    throw new ParseError(`Unexpected "${t.op}"`);
  }

  const result = expr();
  if (pos < tokens.length) {
    const t = tokens[pos];
    const text = t.kind === "op"
      ? t.op
      : t.kind === "id" ? t.name : t.text;
    throw new ParseError(`Unexpected "${text}"`);
  }
  return result;
}

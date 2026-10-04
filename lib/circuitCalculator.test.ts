import {
  calculateEquivalentResistance,
} from "./circuitCalculator";
import { RationalExpr } from "./symbolic";
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

function assertNumEq(
  r: RationalExpr | null,
  expected: number,
  msg: string,
  tol = 1e-9
): void {
  assert(r !== null, `${msg}: not null`);
  if (!r) return;
  assert(r.isNumeric(), `${msg}: is numeric`);
  const val = r.toNumber();
  assert(
    Math.abs(val - expected) < tol,
    `${msg}: got ${val}, want ${expected}`
  );
}

function assertSymEq(
  r: RationalExpr | null,
  expected: string,
  msg: string
): void {
  assert(r !== null, `${msg}: not null`);
  if (!r) return;
  assert(
    r.toString() === expected,
    `${msg}: got "${r}", want "${expected}"`
  );
}

// --- Series: 10 + 20 = 30 ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
      { id: "c", x: 2, y: 0, label: "C" },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: 10,
      },
      {
        id: "e2", nodeA: "b",
        nodeB: "c", resistance: 20,
      },
    ],
  };
  assertNumEq(
    calculateEquivalentResistance(
      circuit, "a", "c"
    ),
    30, "series 10+20=30"
  );
}

// --- Parallel: 10 || 10 = 5 ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: 10,
      },
      {
        id: "e2", nodeA: "a",
        nodeB: "b", resistance: 10,
      },
    ],
  };
  assertNumEq(
    calculateEquivalentResistance(
      circuit, "a", "b"
    ),
    5, "parallel 10||10=5"
  );
}

// --- Parallel: 10 || 20 = 20/3 ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: 10,
      },
      {
        id: "e2", nodeA: "a",
        nodeB: "b", resistance: 20,
      },
    ],
  };
  assertNumEq(
    calculateEquivalentResistance(
      circuit, "a", "b"
    ),
    20 / 3, "parallel 10||20=20/3"
  );
}

// --- Wheatstone bridge (equal R=10): R_eq = 10 ---
//
//     A ---10--- B
//     |  \       |
//    10   10    10
//     |       \  |
//     C ---10--- D
//
// 4 nodes, 5 edges. R_eq(A,D) = 10

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
      { id: "c", x: 0, y: 1, label: "C" },
      { id: "d", x: 1, y: 1, label: "D" },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: 10,
      },
      {
        id: "e2", nodeA: "a",
        nodeB: "c", resistance: 10,
      },
      {
        id: "e3", nodeA: "b",
        nodeB: "d", resistance: 10,
      },
      {
        id: "e4", nodeA: "c",
        nodeB: "d", resistance: 10,
      },
      {
        id: "e5", nodeA: "b",
        nodeB: "c", resistance: 10,
      },
    ],
  };
  assertNumEq(
    calculateEquivalentResistance(
      circuit, "a", "d"
    ),
    10,
    "Wheatstone bridge equal R=10"
  );
}

// --- Symbolic: r + 2r = 3r ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
      { id: "c", x: 2, y: 0, label: "C" },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: "r",
      },
      {
        id: "e2", nodeA: "b",
        nodeB: "c", resistance: "2r",
      },
    ],
  };
  assertSymEq(
    calculateEquivalentResistance(
      circuit, "a", "c"
    ),
    "3r", "symbolic series r+2r=3r"
  );
}

// --- Symbolic parallel: r || r = r/2 ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: "r",
      },
      {
        id: "e2", nodeA: "a",
        nodeB: "b", resistance: "r",
      },
    ],
  };
  assertSymEq(
    calculateEquivalentResistance(
      circuit, "a", "b"
    ),
    "r/2", "symbolic parallel r||r=r/2"
  );
}

// --- Disconnected: infinity ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
    ],
    edges: [],
  };
  const r = calculateEquivalentResistance(
    circuit, "a", "b"
  );
  assert(r !== null, "disconnected not null");
  assert(
    r !== null && r.isInfinity(),
    "disconnected = infinity"
  );
}

// --- Same node: 0 ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
    ],
    edges: [],
  };
  const r = calculateEquivalentResistance(
    circuit, "a", "a"
  );
  assert(r !== null, "same node not null");
  assert(
    r !== null && r.isZero(),
    "same node = 0"
  );
}

// --- Infinity resistance (open circuit) ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: "Infinity",
      },
    ],
  };
  const r = calculateEquivalentResistance(
    circuit, "a", "b"
  );
  assert(
    r !== null && r.isInfinity(),
    "infinite resistance = infinity"
  );
}

// --- Zero resistance: R_eq = 0 ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: 0,
      },
    ],
  };
  const r = calculateEquivalentResistance(
    circuit, "a", "b"
  );
  assert(
    r !== null && r.isZero(),
    "zero resistance = 0"
  );
}

// --- Invalid node ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
    ],
    edges: [],
  };
  const r = calculateEquivalentResistance(
    circuit, "a", "nonexistent"
  );
  assert(r === null, "invalid node = null");
}

// --- Isolated node does not affect R_eq ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
      { id: "c", x: 2, y: 0, label: "C" },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "b",
        resistance: 10 },
    ],
  };
  const r = calculateEquivalentResistance(
    circuit, "a", "b"
  );
  assertNumEq(r, 10, "isolated node ignored");
}

// --- Separate component does not affect R_eq ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
      { id: "c", x: 2, y: 0, label: "C" },
      { id: "d", x: 3, y: 0, label: "D" },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "b",
        resistance: "r" },
      { id: "e2", nodeA: "c", nodeB: "d",
        resistance: 5 },
    ],
  };
  const r = calculateEquivalentResistance(
    circuit, "a", "b"
  );
  assertSymEq(r, "r", "separate component ignored");
}

// --- Component reached only via infinite R ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
      { id: "c", x: 2, y: 0, label: "C" },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "b",
        resistance: 10 },
      { id: "e2", nodeA: "b", nodeB: "c",
        resistance: "Infinity" },
    ],
  };
  const r = calculateEquivalentResistance(
    circuit, "a", "b"
  );
  assertNumEq(r, 10, "node behind open circuit");
}

// --- Exact arithmetic: 30-rung ladder ---

{
  const nodes: Circuit["nodes"] = [
    { id: "a", x: 0, y: 0, label: "A" },
    { id: "b", x: 0, y: 1, label: "B" },
  ];
  const edges: Circuit["edges"] = [
    { id: "x", nodeA: "a", nodeB: "b", resistance: 1 },
  ];
  let prev = "a";
  for (let i = 0; i < 30; i++) {
    const m = `m${i}`;
    nodes.push({ id: m, x: i + 1, y: 0, label: m });
    edges.push(
      { id: `s${i}`, nodeA: prev, nodeB: m,
        resistance: 1 },
      { id: `g${i}`, nodeA: m, nodeB: "b",
        resistance: 1 }
    );
    prev = m;
  }
  const r = calculateEquivalentResistance(
    { nodes, edges }, "a", "b"
  );
  assertSymEq(
    r,
    "2504730781961/4052739537881",
    "ladder is exact"
  );
}

// --- Exact arithmetic: tiny and huge values ---

{
  const par = (r1: number, r2: number): Circuit => ({
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "b", x: 1, y: 0, label: "B" },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "b",
        resistance: r1 },
      { id: "e2", nodeA: "a", nodeB: "b",
        resistance: r2 },
    ],
  });
  const ser = (
    r1: number | string,
    r2: number | string
  ): Circuit => ({
    nodes: [
      { id: "a", x: 0, y: 0, label: "A" },
      { id: "m", x: 1, y: 0, label: "M" },
      { id: "b", x: 2, y: 0, label: "B" },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "m",
        resistance: r1 },
      { id: "e2", nodeA: "m", nodeB: "b",
        resistance: r2 },
    ],
  });
  assertSymEq(
    calculateEquivalentResistance(
      par(1e-16, 10), "a", "b"
    ),
    "10/100000000000000001",
    "1e-16 || 10 is not a short"
  );
  assertSymEq(
    calculateEquivalentResistance(
      ser(1e20, 1), "a", "b"
    ),
    "100000000000000000001",
    "1e20 + 1 keeps the 1"
  );
  assertSymEq(
    calculateEquivalentResistance(
      ser("0.1", "0.2"), "a", "b"
    ),
    "3/10",
    "0.1 + 0.2 = 3/10"
  );
  assertSymEq(
    calculateEquivalentResistance(
      par(3e12, 6e12), "a", "b"
    ),
    "2000000000000",
    "3e12 || 6e12 fully reduced"
  );
}

// --- summary ---

console.log(
  `\ncircuitCalculator tests: `
  + `${passed} passed, ${failed} failed`
);
if (failed > 0) process.exit(1);

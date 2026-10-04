import {
  calculateCurrents,
} from "./currentCalculator";
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

function assertCurrentEq(
  currents: Map<string, RationalExpr>,
  edgeId: string,
  expected: number,
  msg: string,
  tol = 1e-9
): void {
  const c = currents.get(edgeId);
  assert(
    c !== undefined,
    `${msg}: edge ${edgeId} has current`
  );
  if (!c) return;
  assert(c.isNumeric(), `${msg}: is numeric`);
  const val = c.toNumber();
  assert(
    Math.abs(val - expected) < tol,
    `${msg}: got ${val}, want ${expected}`
  );
}

// --- Simple: V=10, R=5 => I=2A ---

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "a", x: 0, y: 0,
        label: "A", potential: 10,
      },
      {
        id: "b", x: 1, y: 0,
        label: "B", potential: 0,
      },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: 5,
      },
    ],
  };
  const currents = calculateCurrents(circuit);
  assertCurrentEq(
    currents, "e1", 2, "simple 10V/5ohm=2A"
  );
}

// --- Series with partial potentials ---
// Only endpoints set: V_a=12, V_c=0
// A --2ohm-- B --4ohm-- C
// Should solve V_b = 8, I1 = 2A, I2 = 2A

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "a", x: 0, y: 0,
        label: "A", potential: 12,
      },
      {
        id: "b", x: 1, y: 0,
        label: "B",
      },
      {
        id: "c", x: 2, y: 0,
        label: "C", potential: 0,
      },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: 2,
      },
      {
        id: "e2", nodeA: "b",
        nodeB: "c", resistance: 4,
      },
    ],
  };
  const currents = calculateCurrents(circuit);
  assertCurrentEq(
    currents, "e1", 2,
    "series partial: I1=2A"
  );
  assertCurrentEq(
    currents, "e2", 2,
    "series partial: I2=2A"
  );
}

// --- Parallel current split ---
// A(10V) --10ohm-- B(0V)
// A(10V) --10ohm-- B(0V)
// Each branch: I = 10/10 = 1A

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "a", x: 0, y: 0,
        label: "A", potential: 10,
      },
      {
        id: "b", x: 1, y: 0,
        label: "B", potential: 0,
      },
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
  const currents = calculateCurrents(circuit);
  assertCurrentEq(
    currents, "e1", 1,
    "parallel split: I1=1A"
  );
  assertCurrentEq(
    currents, "e2", 1,
    "parallel split: I2=1A"
  );
}

// --- Reverse polarity: I = (0-10)/5 = -2A ---

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "a", x: 0, y: 0,
        label: "A", potential: 0,
      },
      {
        id: "b", x: 1, y: 0,
        label: "B", potential: 10,
      },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: 5,
      },
    ],
  };
  const currents = calculateCurrents(circuit);
  assertCurrentEq(
    currents, "e1", -2,
    "reverse polarity: I=-2A"
  );
}

// --- Infinite resistance: I=0 ---

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "a", x: 0, y: 0,
        label: "A", potential: 10,
      },
      {
        id: "b", x: 1, y: 0,
        label: "B", potential: 0,
      },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: "Infinity",
      },
    ],
  };
  const currents = calculateCurrents(circuit);
  assertCurrentEq(
    currents, "e1", 0,
    "infinite R: I=0"
  );
}

// --- Less than 2 boundary nodes: empty ---

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "a", x: 0, y: 0,
        label: "A", potential: 10,
      },
      { id: "b", x: 1, y: 0, label: "B" },
    ],
    edges: [
      {
        id: "e1", nodeA: "a",
        nodeB: "b", resistance: 5,
      },
    ],
  };
  const currents = calculateCurrents(circuit);
  assert(
    currents.size === 0,
    "<2 boundary: empty"
  );
}

// --- No edges: empty ---

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "a", x: 0, y: 0,
        label: "A", potential: 10,
      },
      {
        id: "b", x: 1, y: 0,
        label: "B", potential: 0,
      },
    ],
    edges: [],
  };
  const currents = calculateCurrents(circuit);
  assert(
    currents.size === 0,
    "no edges: empty"
  );
}

// --- Wheatstone bridge with potentials ---
// A(10V) --10-- B --10-- D(0V)
// A(10V) --10-- C --10-- D(0V)
//               B --10-- C
// KCL must hold at B and C

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "a", x: 0, y: 0,
        label: "A", potential: 10,
      },
      { id: "b", x: 1, y: 0, label: "B" },
      { id: "c", x: 0, y: 1, label: "C" },
      {
        id: "d", x: 1, y: 1,
        label: "D", potential: 0,
      },
    ],
    edges: [
      {
        id: "ab", nodeA: "a",
        nodeB: "b", resistance: 10,
      },
      {
        id: "ac", nodeA: "a",
        nodeB: "c", resistance: 10,
      },
      {
        id: "bd", nodeA: "b",
        nodeB: "d", resistance: 10,
      },
      {
        id: "cd", nodeA: "c",
        nodeB: "d", resistance: 10,
      },
      {
        id: "bc", nodeA: "b",
        nodeB: "c", resistance: 10,
      },
    ],
  };
  const currents = calculateCurrents(circuit);

  // In balanced Wheatstone, V_b = V_c = 5V
  // I_bc = 0 (no current across bridge)
  const iBC = currents.get("bc");
  assert(
    iBC !== undefined,
    "Wheatstone: bc has current"
  );
  if (iBC) {
    assert(
      iBC.isNumeric()
      && Math.abs(iBC.toNumber()) < 1e-9,
      "Wheatstone: I_bc=0 (balanced)"
    );
  }

  // I_ab = I_ac (symmetric)
  const iAB = currents.get("ab");
  const iAC = currents.get("ac");
  assert(
    iAB !== undefined && iAC !== undefined,
    "Wheatstone: ab,ac have currents"
  );
  if (iAB && iAC && iAB.isNumeric()
    && iAC.isNumeric()) {
    assert(
      Math.abs(
        iAB.toNumber() - iAC.toNumber()
      ) < 1e-9,
      "Wheatstone: I_ab = I_ac (symmetric)"
    );
  }

  // Total current from A: I_ab + I_ac = 1A
  // (V=10, R_eq=10)
  if (iAB && iAC && iAB.isNumeric()
    && iAC.isNumeric()) {
    const total =
      iAB.toNumber() + iAC.toNumber();
    assert(
      Math.abs(total - 1) < 1e-9,
      `Wheatstone: total I=1A, got ${total}`
    );
  }
}

// --- Isolated node does not block solving ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A",
        potential: 10 },
      { id: "m", x: 1, y: 0, label: "M" },
      { id: "b", x: 2, y: 0, label: "B",
        potential: 0 },
      { id: "c", x: 3, y: 0, label: "C" },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "m",
        resistance: 5 },
      { id: "e2", nodeA: "m", nodeB: "b",
        resistance: 5 },
    ],
  };
  const currents = calculateCurrents(circuit);
  assertCurrentEq(
    currents, "e1", 1, "isolated node: e1"
  );
  assertCurrentEq(
    currents, "e2", 1, "isolated node: e2"
  );
}

// --- Floating component does not block solving ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A",
        potential: 10 },
      { id: "m", x: 1, y: 0, label: "M" },
      { id: "b", x: 2, y: 0, label: "B",
        potential: 0 },
      { id: "c", x: 3, y: 0, label: "C" },
      { id: "d", x: 4, y: 0, label: "D" },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "m",
        resistance: 5 },
      { id: "e2", nodeA: "m", nodeB: "b",
        resistance: 5 },
      { id: "e3", nodeA: "c", nodeB: "d",
        resistance: 1 },
    ],
  };
  const currents = calculateCurrents(circuit);
  assertCurrentEq(
    currents, "e1", 1, "floating component: e1"
  );
  assertCurrentEq(
    currents, "e3", 0,
    "floating component carries no current"
  );
}

// --- Invalid values => no currents ---

{
  const base = (r: string, v: string): Circuit => ({
    nodes: [
      { id: "a", x: 0, y: 0, label: "A", potential: v },
      { id: "b", x: 1, y: 0, label: "B", potential: 0 },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "b",
        resistance: r },
    ],
  });
  assert(
    calculateCurrents(base("r+", "10")).size === 0,
    "invalid resistance gives no currents"
  );
  assert(
    calculateCurrents(base("5", "!!")).size === 0,
    "invalid potential gives no currents"
  );
  assertCurrentEq(
    calculateCurrents(base("5", "10")), "e1", 2,
    "valid values still work"
  );
}

// --- Wire in series carries the series current ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A", potential: 10 },
      { id: "m", x: 1, y: 0, label: "M" },
      { id: "n", x: 2, y: 0, label: "N" },
      { id: "b", x: 3, y: 0, label: "B", potential: 0 },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "m", resistance: 5 },
      { id: "w", nodeA: "m", nodeB: "n", resistance: 0 },
      { id: "e2", nodeA: "n", nodeB: "b", resistance: 5 },
    ],
  };
  const c = calculateCurrents(circuit);
  assertCurrentEq(c, "w", 1, "series wire");
  assertCurrentEq(c, "e1", 1, "series wire: e1");
}

// --- Wire from a source node ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A", potential: 10 },
      { id: "m", x: 1, y: 0, label: "M" },
      { id: "b", x: 2, y: 0, label: "B", potential: 0 },
    ],
    edges: [
      // Wire listed B->A direction on purpose
      { id: "w", nodeA: "m", nodeB: "a", resistance: 0 },
      { id: "e1", nodeA: "m", nodeB: "b", resistance: 2 },
      { id: "e2", nodeA: "m", nodeB: "b", resistance: 2 },
    ],
  };
  const c = calculateCurrents(circuit);
  // 10V across 2||2 = 1 ohm => 10A from A into M,
  // i.e. -10A in the m->a direction
  assertCurrentEq(c, "w", -10, "source wire");
}

// --- Parallel wires are undetermined ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A", potential: 10 },
      { id: "m", x: 1, y: 0, label: "M" },
      { id: "n", x: 2, y: 0, label: "N" },
      { id: "b", x: 3, y: 0, label: "B", potential: 0 },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "m", resistance: 5 },
      { id: "w1", nodeA: "m", nodeB: "n", resistance: 0 },
      { id: "w2", nodeA: "m", nodeB: "n", resistance: 0 },
      { id: "e2", nodeA: "n", nodeB: "b", resistance: 5 },
    ],
  };
  const c = calculateCurrents(circuit);
  assert(
    !c.has("w1") && !c.has("w2"),
    "parallel wires undetermined"
  );
  assertCurrentEq(c, "e1", 1, "parallel wires: e1");
}

// --- Shorted sources leave their piece undetermined ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A", potential: 10 },
      { id: "b", x: 1, y: 0, label: "B", potential: 0 },
      { id: "m", x: 2, y: 0, label: "M" },
      { id: "z", x: 3, y: 0, label: "Z", potential: 0 },
      // Separate, well-posed piece
      { id: "p", x: 0, y: 1, label: "P", potential: 4 },
      { id: "q", x: 1, y: 1, label: "Q", potential: 0 },
    ],
    edges: [
      { id: "s", nodeA: "a", nodeB: "b", resistance: 0 },
      { id: "e1", nodeA: "b", nodeB: "m", resistance: 5 },
      { id: "e2", nodeA: "m", nodeB: "z", resistance: 5 },
      { id: "e3", nodeA: "p", nodeB: "q", resistance: 2 },
    ],
  };
  const c = calculateCurrents(circuit);
  assert(
    c.get("s")?.isInfinity() === true,
    "short between sources is infinite"
  );
  assert(
    !c.has("e1") && !c.has("e2"),
    "piece with shorted sources undetermined"
  );
  assertCurrentEq(c, "e3", 2, "other piece still solved");
}

// --- Singular piece does not blank other pieces ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A", potential: 10 },
      { id: "m", x: 1, y: 0, label: "M" },
      { id: "b", x: 2, y: 0, label: "B", potential: 0 },
      { id: "p", x: 0, y: 1, label: "P", potential: 4 },
      { id: "q", x: 1, y: 1, label: "Q", potential: 0 },
    ],
    edges: [
      // 1 + (-1) in parallel at M: zero conductance
      { id: "e1", nodeA: "a", nodeB: "m", resistance: 1 },
      { id: "e2", nodeA: "a", nodeB: "m", resistance: -1 },
      { id: "e3", nodeA: "m", nodeB: "b", resistance: 1 },
      { id: "e4", nodeA: "m", nodeB: "b", resistance: -1 },
      { id: "e5", nodeA: "p", nodeB: "q", resistance: 2 },
    ],
  };
  const c = calculateCurrents(circuit);
  assert(!c.has("e1"), "singular piece undetermined");
  assertCurrentEq(c, "e5", 2, "other piece solved");
}

// --- Edge to a missing node is ignored ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A", potential: 10 },
      { id: "b", x: 1, y: 0, label: "B", potential: 0 },
    ],
    edges: [
      { id: "e1", nodeA: "a", nodeB: "b", resistance: 5 },
      { id: "e2", nodeA: "a", nodeB: "ghost",
        resistance: 5 },
    ],
  };
  const c = calculateCurrents(circuit);
  assertCurrentEq(c, "e1", 2, "missing node: e1");
  assert(!c.has("e2"), "missing node: e2 has no current");
}

// --- KCL holds at every interior node ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "a", x: 0, y: 0, label: "A", potential: 12 },
      { id: "c", x: 1, y: 0, label: "C" },
      { id: "d", x: 1, y: 1, label: "D" },
      { id: "e", x: 2, y: 1, label: "E" },
      { id: "b", x: 2, y: 0, label: "B", potential: 0 },
    ],
    edges: [
      { id: "1", nodeA: "a", nodeB: "c", resistance: 1 },
      { id: "2", nodeA: "a", nodeB: "d", resistance: 2 },
      { id: "3", nodeA: "c", nodeB: "d", resistance: 3 },
      { id: "4", nodeA: "d", nodeB: "e", resistance: 0 },
      { id: "5", nodeA: "c", nodeB: "b", resistance: 4 },
      { id: "6", nodeA: "e", nodeB: "b", resistance: 5 },
    ],
  };
  const c = calculateCurrents(circuit);
  for (const n of ["c", "d", "e"]) {
    let net = RationalExpr.ZERO;
    let complete = true;
    for (const e of circuit.edges) {
      const i = c.get(e.id);
      if (!i) {
        complete = false;
        continue;
      }
      if (e.nodeB === n) net = net.add(i);
      if (e.nodeA === n) net = net.subtract(i);
    }
    assert(complete, `KCL at ${n}: all currents known`);
    assert(net.isZero(), `KCL at ${n}: net ${net}`);
  }
}

// --- summary ---

console.log(
  `\ncurrentCalculator tests: `
  + `${passed} passed, ${failed} failed`
);
if (failed > 0) process.exit(1);

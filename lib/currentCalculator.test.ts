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

// --- summary ---

console.log(
  `\ncurrentCalculator tests: `
  + `${passed} passed, ${failed} failed`
);
if (failed > 0) process.exit(1);

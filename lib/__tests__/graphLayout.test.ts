import {
  applyForceDirectedLayout,
} from "../graphLayout";
import type { Circuit } from "@/types/circuit";

const W = 800;
const H = 600;

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

// --- Single node centered ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 100, y: 100, label: "N1" },
    ],
    edges: [],
  };
  const r = applyForceDirectedLayout(
    circuit, { width: W, height: H }
  );
  assert(
    r[0].x === W / 2 && r[0].y === H / 2,
    "single node centered"
  );
}

// --- Two nearby nodes spread apart ---

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "n1", x: 399, y: 300, label: "N1",
      },
      {
        id: "n2", x: 401, y: 300, label: "N2",
      },
    ],
    edges: [],
  };
  const r = applyForceDirectedLayout(
    circuit, { width: W, height: H }
  );
  const dist = Math.sqrt(
    (r[1].x - r[0].x) ** 2
    + (r[1].y - r[0].y) ** 2
  );
  assert(dist > 10, "two nodes spread apart");
}

// --- Nodes stay within bounds ---

{
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 100, y: 100, label: "N1" },
      { id: "n2", x: 110, y: 110, label: "N2" },
      { id: "n3", x: 120, y: 120, label: "N3" },
    ],
    edges: [
      {
        id: "e1", nodeA: "n1",
        nodeB: "n2", resistance: 1,
      },
      {
        id: "e2", nodeA: "n2",
        nodeB: "n3", resistance: 1,
      },
    ],
  };
  const r = applyForceDirectedLayout(
    circuit, { width: W, height: H }
  );
  const allInBounds = r.every(
    (n) =>
      n.x >= 0 && n.x <= W
      && n.y >= 0 && n.y <= H
  );
  assert(allInBounds, "nodes within bounds");
}

// --- Potentials preserved ---

{
  const circuit: Circuit = {
    nodes: [
      {
        id: "n1", x: 100, y: 100,
        label: "N1", potential: 10,
      },
      {
        id: "n2", x: 200, y: 200,
        label: "N2", potential: "V",
      },
    ],
    edges: [
      {
        id: "e1", nodeA: "n1",
        nodeB: "n2", resistance: 1,
      },
    ],
  };
  const r = applyForceDirectedLayout(
    circuit, { width: W, height: H }
  );
  assert(
    r[0].potential === 10,
    "potential 10 preserved"
  );
  assert(
    r[1].potential === "V",
    "potential 'V' preserved"
  );
}

// --- Empty circuit ---

{
  const circuit: Circuit = {
    nodes: [],
    edges: [],
  };
  const r = applyForceDirectedLayout(
    circuit, { width: W, height: H }
  );
  assert(r.length === 0, "empty circuit");
}

// --- summary ---

console.log(
  `\ngraphLayout tests: `
  + `${passed} passed, ${failed} failed`
);
if (failed > 0) process.exit(1);

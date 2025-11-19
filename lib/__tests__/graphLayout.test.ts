import { applyForceDirectedLayout } from "../graphLayout";
import type { Circuit } from "@/types/circuit";

const canvasWidth = 800;
const canvasHeight = 600;

// Test: Single node should be centered
function testSingleNode() {
  const circuit: Circuit = {
    nodes: [{ id: "n1", x: 100, y: 100, label: "N1" }],
    edges: [],
  };

  const result = applyForceDirectedLayout(circuit, {
    width: canvasWidth,
    height: canvasHeight,
  });

  console.log("Test Single Node (centered):");
  console.log(`  Expected: x=${canvasWidth / 2}, y=${canvasHeight / 2}`);
  console.log(`  Got: x=${result[0].x}, y=${result[0].y}`);
  console.log(`  ✓ Node centered: ${result[0].x === canvasWidth / 2 && result[0].y === canvasHeight / 2}`);
}

// Test: Two nodes should spread apart
function testTwoNodes() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 400, y: 300, label: "N1" },
      { id: "n2", x: 400, y: 300, label: "N2" },
    ],
    edges: [],
  };

  const result = applyForceDirectedLayout(circuit, {
    width: canvasWidth,
    height: canvasHeight,
  });

  const distance = Math.sqrt(
    Math.pow(result[1].x - result[0].x, 2) +
      Math.pow(result[1].y - result[0].y, 2)
  );

  console.log("\nTest Two Nodes (should spread apart):");
  console.log(`  Distance between nodes: ${distance.toFixed(2)}`);
  console.log(`  ✓ Nodes spread apart: ${distance > 0}`);
}

// Test: Series circuit layout
function testSeriesCircuit() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 100, y: 100, label: "N1" },
      { id: "n2", x: 110, y: 110, label: "N2" },
      { id: "n3", x: 120, y: 120, label: "N3" },
    ],
    edges: [
      { id: "e1", nodeA: "n1", nodeB: "n2", resistance: 1 },
      { id: "e2", nodeA: "n2", nodeB: "n3", resistance: 1 },
    ],
  };

  const result = applyForceDirectedLayout(circuit, {
    width: canvasWidth,
    height: canvasHeight,
  });

  const allInBounds = result.every(
    (node) =>
      node.x >= 0 &&
      node.x <= canvasWidth &&
      node.y >= 0 &&
      node.y <= canvasHeight
  );

  console.log("\nTest Series Circuit (n1 - n2 - n3):");
  result.forEach((node) => {
    console.log(`  ${node.label}: x=${node.x.toFixed(2)}, y=${node.y.toFixed(2)}`);
  });
  console.log(`  ✓ All nodes within bounds: ${allInBounds}`);
}

// Test: Parallel circuit layout
function testParallelCircuit() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 100, y: 300, label: "N1" },
      { id: "n2", x: 400, y: 200, label: "N2" },
      { id: "n3", x: 400, y: 400, label: "N3" },
      { id: "n4", x: 700, y: 300, label: "N4" },
    ],
    edges: [
      { id: "e1", nodeA: "n1", nodeB: "n2", resistance: 1 },
      { id: "e2", nodeA: "n1", nodeB: "n3", resistance: 1 },
      { id: "e3", nodeA: "n2", nodeB: "n4", resistance: 1 },
      { id: "e4", nodeA: "n3", nodeB: "n4", resistance: 1 },
    ],
  };

  const result = applyForceDirectedLayout(circuit, {
    width: canvasWidth,
    height: canvasHeight,
  });

  console.log("\nTest Parallel Circuit:");
  result.forEach((node) => {
    console.log(`  ${node.label}: x=${node.x.toFixed(2)}, y=${node.y.toFixed(2)}`);
  });
}

// Run all tests
console.log("=== Force-Directed Layout Tests ===\n");
testSingleNode();
testTwoNodes();
testSeriesCircuit();
testParallelCircuit();
console.log("\n=== All tests completed ===");

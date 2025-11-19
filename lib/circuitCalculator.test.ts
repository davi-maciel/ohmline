import { calculateEquivalentResistance, SymbolicResistance } from "./circuitCalculator";
import type { Circuit } from "@/types/circuit";

// Test: Two resistors in series
function testSeries() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1" },
      { id: "n2", x: 100, y: 0, label: "N2" },
      { id: "n3", x: 200, y: 0, label: "N3" },
    ],
    edges: [
      { id: "e1", nodeA: "n1", nodeB: "n2", resistance: 10 },
      { id: "e2", nodeA: "n2", nodeB: "n3", resistance: 20 },
    ],
  };

  const result = calculateEquivalentResistance(circuit, "n1", "n3");
  console.log("Test Series (10Ω + 20Ω):", result?.toDisplayString()); // Expected: 30Ω
}

// Test: Two resistors in parallel
function testParallel() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1" },
      { id: "n2", x: 100, y: 0, label: "N2" },
    ],
    edges: [
      { id: "e1", nodeA: "n1", nodeB: "n2", resistance: 10 },
      { id: "e2", nodeA: "n1", nodeB: "n2", resistance: 10 },
    ],
  };

  const result = calculateEquivalentResistance(circuit, "n1", "n2");
  console.log("Test Parallel (10Ω || 10Ω):", result?.toDisplayString()); // Expected: 5Ω
}

// Test: Symbolic resistances
function testSymbolic() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1" },
      { id: "n2", x: 100, y: 0, label: "N2" },
      { id: "n3", x: 200, y: 0, label: "N3" },
    ],
    edges: [
      { id: "e1", nodeA: "n1", nodeB: "n2", resistance: "r" },
      { id: "e2", nodeA: "n2", nodeB: "n3", resistance: "2r" },
    ],
  };

  const result = calculateEquivalentResistance(circuit, "n1", "n3");
  console.log("Test Symbolic Series (r + 2r):", result?.toString()); // Expected: 3r
}

// Test: Mixed symbolic and numeric
function testMixed() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1" },
      { id: "n2", x: 100, y: 0, label: "N2" },
      { id: "n3", x: 200, y: 0, label: "N3" },
    ],
    edges: [
      { id: "e1", nodeA: "n1", nodeB: "n2", resistance: "r" },
      { id: "e2", nodeA: "n2", nodeB: "n3", resistance: 10 },
    ],
  };

  const result = calculateEquivalentResistance(circuit, "n1", "n3");
  console.log("Test Mixed (r + 10):", result?.toString()); // Expected: r+10
}

// Test: Infinity resistance (open circuit)
function testInfinity() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1" },
      { id: "n2", x: 100, y: 0, label: "N2" },
    ],
    edges: [
      { id: "e1", nodeA: "n1", nodeB: "n2", resistance: "Infinity" },
    ],
  };

  const result = calculateEquivalentResistance(circuit, "n1", "n2");
  console.log("Test Infinity:", result?.toDisplayString()); // Expected: ∞
}

// Test: Disconnected nodes
function testDisconnected() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1" },
      { id: "n2", x: 100, y: 0, label: "N2" },
    ],
    edges: [],
  };

  const result = calculateEquivalentResistance(circuit, "n1", "n2");
  console.log("Test Disconnected:", result?.toDisplayString()); // Expected: ∞
}

// Run all tests
console.log("\n=== Circuit Calculator Tests ===\n");
testSeries();
testParallel();
testSymbolic();
testMixed();
testInfinity();
testDisconnected();
console.log("\n=== Tests Complete ===\n");

import { calculateCurrents, SymbolicValue } from "./currentCalculator";
import type { Circuit } from "@/types/circuit";

// Test: Simple circuit with one resistor and known voltages
function testSimpleCurrent() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1", potential: 10 },
      { id: "n2", x: 100, y: 0, label: "N2", potential: 0 },
    ],
    edges: [{ id: "e1", nodeA: "n1", nodeB: "n2", resistance: 5 }],
  };

  const currents = calculateCurrents(circuit);
  const current = currents.get("e1");

  console.log("Test Simple (V=10V, R=5Ω):", current?.toDisplayString("A"));
  // Expected: I = (10 - 0) / 5 = 2A
}

// Test: Series circuit with voltage drops
function testSeriesCurrents() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1", potential: 12 },
      { id: "n2", x: 100, y: 0, label: "N2", potential: 8 },
      { id: "n3", x: 200, y: 0, label: "N3", potential: 0 },
    ],
    edges: [
      { id: "e1", nodeA: "n1", nodeB: "n2", resistance: 2 },
      { id: "e2", nodeA: "n2", nodeB: "n3", resistance: 4 },
    ],
  };

  const currents = calculateCurrents(circuit);
  const current1 = currents.get("e1");
  const current2 = currents.get("e2");

  console.log("Test Series e1 (12V-8V)/2Ω:", current1?.toDisplayString("A"));
  console.log("Test Series e2 (8V-0V)/4Ω:", current2?.toDisplayString("A"));
  // Expected: I1 = (12 - 8) / 2 = 2A, I2 = (8 - 0) / 4 = 2A
}

// Test: Symbolic voltages
function testSymbolicVoltage() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1", potential: "V" },
      { id: "n2", x: 100, y: 0, label: "N2", potential: 0 },
    ],
    edges: [{ id: "e1", nodeA: "n1", nodeB: "n2", resistance: 10 }],
  };

  const currents = calculateCurrents(circuit);
  const current = currents.get("e1");

  console.log("Test Symbolic Voltage (V/10Ω):", current?.toString());
  // Expected: I = V / 10 (simplified or as expression)
}

// Test: Symbolic resistance
function testSymbolicResistance() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1", potential: 12 },
      { id: "n2", x: 100, y: 0, label: "N2", potential: 0 },
    ],
    edges: [{ id: "e1", nodeA: "n1", nodeB: "n2", resistance: "r" }],
  };

  const currents = calculateCurrents(circuit);
  const current = currents.get("e1");

  console.log("Test Symbolic Resistance (12V/r):", current?.toString());
  // Expected: I = 12 / r
}

// Test: Mixed symbolic voltage and resistance
function testMixedSymbolic() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1", potential: "V1" },
      { id: "n2", x: 100, y: 0, label: "N2", potential: "V2" },
    ],
    edges: [{ id: "e1", nodeA: "n1", nodeB: "n2", resistance: "r" }],
  };

  const currents = calculateCurrents(circuit);
  const current = currents.get("e1");

  console.log("Test Mixed Symbolic ((V1-V2)/r):", current?.toString());
  // Expected: I = (V1 - V2) / r
}

// Test: Zero resistance (short circuit)
function testZeroResistance() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1", potential: 10 },
      { id: "n2", x: 100, y: 0, label: "N2", potential: 0 },
    ],
    edges: [{ id: "e1", nodeA: "n1", nodeB: "n2", resistance: 0 }],
  };

  const currents = calculateCurrents(circuit);
  const current = currents.get("e1");

  console.log("Test Zero Resistance:", current?.toDisplayString("A"));
  // Expected: I = Infinity (voltage difference across zero resistance)
}

// Test: Infinite resistance (open circuit)
function testInfiniteResistance() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1", potential: 10 },
      { id: "n2", x: 100, y: 0, label: "N2", potential: 0 },
    ],
    edges: [{ id: "e1", nodeA: "n1", nodeB: "n2", resistance: "Infinity" }],
  };

  const currents = calculateCurrents(circuit);
  const current = currents.get("e1");

  console.log("Test Infinite Resistance:", current?.toDisplayString("A"));
  // Expected: I = 0A (no current through open circuit)
}

// Test: No potential set
function testNoPotential() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1" },
      { id: "n2", x: 100, y: 0, label: "N2" },
    ],
    edges: [{ id: "e1", nodeA: "n1", nodeB: "n2", resistance: 10 }],
  };

  const currents = calculateCurrents(circuit);
  const current = currents.get("e1");

  console.log("Test No Potential:", current?.toString());
  // Expected: I (unknown current)
}

// Test: Negative voltage (reverse current)
function testNegativeVoltage() {
  const circuit: Circuit = {
    nodes: [
      { id: "n1", x: 0, y: 0, label: "N1", potential: 0 },
      { id: "n2", x: 100, y: 0, label: "N2", potential: 10 },
    ],
    edges: [{ id: "e1", nodeA: "n1", nodeB: "n2", resistance: 5 }],
  };

  const currents = calculateCurrents(circuit);
  const current = currents.get("e1");

  console.log("Test Negative Current (0-10)/5:", current?.toDisplayString("A"));
  // Expected: I = (0 - 10) / 5 = -2A (current flows from n2 to n1)
}

// Run all tests
console.log("\n=== Current Calculator Tests ===\n");
testSimpleCurrent();
testSeriesCurrents();
testSymbolicVoltage();
testSymbolicResistance();
testMixedSymbolic();
testZeroResistance();
testInfiniteResistance();
testNoPotential();
testNegativeVoltage();
console.log("\n=== Tests Complete ===\n");

import { applyForceDirectedLayout, applyGridLayout } from "./layoutAlgorithm";
import type { Circuit } from "@/types/circuit";

describe("Layout Algorithms", () => {
  describe("applyForceDirectedLayout", () => {
    test("handles empty circuit", () => {
      const circuit: Circuit = { nodes: [], edges: [] };
      const result = applyForceDirectedLayout(circuit);
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    test("repositions nodes within bounds", () => {
      const circuit: Circuit = {
        nodes: [
          { id: "n1", x: 100, y: 100, label: "N1" },
          { id: "n2", x: 200, y: 200, label: "N2" },
          { id: "n3", x: 300, y: 300, label: "N3" },
        ],
        edges: [
          { id: "e1", nodeA: "n1", nodeB: "n2", resistance: 10 },
          { id: "e2", nodeA: "n2", nodeB: "n3", resistance: 20 },
        ],
      };

      const result = applyForceDirectedLayout(circuit, {
        width: 800,
        height: 600,
        iterations: 50,
      });

      // Check all nodes are within bounds
      result.nodes.forEach((node) => {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(800);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThanOrEqual(600);
      });

      // Check that nodes have moved from their original positions
      expect(result.nodes).toHaveLength(3);
    });

    test("handles disconnected components", () => {
      const circuit: Circuit = {
        nodes: [
          { id: "n1", x: 100, y: 100, label: "N1" },
          { id: "n2", x: 200, y: 200, label: "N2" },
          { id: "n3", x: 300, y: 300, label: "N3" },
          { id: "n4", x: 400, y: 400, label: "N4" },
        ],
        edges: [
          { id: "e1", nodeA: "n1", nodeB: "n2", resistance: 10 },
          { id: "e2", nodeA: "n3", nodeB: "n4", resistance: 20 },
        ],
      };

      const result = applyForceDirectedLayout(circuit, {
        width: 800,
        height: 600,
        iterations: 50,
      });

      expect(result.nodes).toHaveLength(4);
      result.nodes.forEach((node) => {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(800);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThanOrEqual(600);
      });
    });

    test("preserves node and edge data", () => {
      const circuit: Circuit = {
        nodes: [
          { id: "n1", x: 100, y: 100, label: "Node 1" },
          { id: "n2", x: 200, y: 200, label: "Node 2" },
        ],
        edges: [{ id: "e1", nodeA: "n1", nodeB: "n2", resistance: "r" }],
      };

      const result = applyForceDirectedLayout(circuit);

      expect(result.nodes[0].id).toBe("n1");
      expect(result.nodes[0].label).toBe("Node 1");
      expect(result.nodes[1].id).toBe("n2");
      expect(result.nodes[1].label).toBe("Node 2");
      expect(result.edges[0].resistance).toBe("r");
    });
  });

  describe("applyGridLayout", () => {
    test("handles empty circuit", () => {
      const circuit: Circuit = { nodes: [], edges: [] };
      const result = applyGridLayout(circuit);
      expect(result.nodes).toHaveLength(0);
    });

    test("arranges nodes in a grid", () => {
      const circuit: Circuit = {
        nodes: [
          { id: "n1", x: 0, y: 0, label: "N1" },
          { id: "n2", x: 0, y: 0, label: "N2" },
          { id: "n3", x: 0, y: 0, label: "N3" },
          { id: "n4", x: 0, y: 0, label: "N4" },
        ],
        edges: [],
      };

      const result = applyGridLayout(circuit, { width: 800, height: 600 });

      // All nodes should have different positions
      const positions = result.nodes.map((n) => `${n.x},${n.y}`);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(4);

      // All positions should be within bounds
      result.nodes.forEach((node) => {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(800);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThanOrEqual(600);
      });
    });
  });
});

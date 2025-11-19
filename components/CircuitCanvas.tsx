"use client";

import { useState, useRef, useCallback } from "react";
import type { Node, Edge, Circuit } from "@/types/circuit";

export default function CircuitCanvas() {
  const [circuit, setCircuit] = useState<Circuit>({ nodes: [], edges: [] });
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [mode, setMode] = useState<"add-node" | "add-edge" | "select">("select");
  const canvasRef = useRef<HTMLDivElement>(null);

  const addNode = useCallback((x: number, y: number) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      x,
      y,
      label: `N${circuit.nodes.length + 1}`,
    };
    setCircuit((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
  }, [circuit.nodes.length]);

  const addEdge = useCallback((nodeAId: string, nodeBId: string) => {
    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      nodeA: nodeAId,
      nodeB: nodeBId,
      resistance: 1, // Default resistance
    };
    setCircuit((prev) => ({
      ...prev,
      edges: [...prev.edges, newEdge],
    }));
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === "add-node") {
      addNode(x, y);
    }
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (mode === "add-edge") {
      setSelectedNodes((prev) => {
        const newSelection = [...prev, nodeId];
        if (newSelection.length === 2) {
          addEdge(newSelection[0], newSelection[1]);
          return [];
        }
        return newSelection;
      });
    }
  };

  const updateResistance = (edgeId: string, value: string) => {
    setCircuit((prev) => ({
      ...prev,
      edges: prev.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, resistance: value || 1 } : edge
      ),
    }));
  };

  const getNodeById = (id: string) => circuit.nodes.find((n) => n.id === id);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("select")}
            className={`px-4 py-2 rounded ${
              mode === "select"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Select
          </button>
          <button
            onClick={() => setMode("add-node")}
            className={`px-4 py-2 rounded ${
              mode === "add-node"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Add Node
          </button>
          <button
            onClick={() => {
              setMode("add-edge");
              setSelectedNodes([]);
            }}
            className={`px-4 py-2 rounded ${
              mode === "add-edge"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Add Edge
          </button>
        </div>
        {mode === "add-edge" && selectedNodes.length === 1 && (
          <p className="mt-2 text-sm text-gray-600">
            Select the second node to create an edge
          </p>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="relative bg-white rounded-lg shadow h-[600px] border-2 border-gray-200 cursor-crosshair"
      >
        {/* Render edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {circuit.edges.map((edge) => {
            const nodeA = getNodeById(edge.nodeA);
            const nodeB = getNodeById(edge.nodeB);
            if (!nodeA || !nodeB) return null;

            const midX = (nodeA.x + nodeB.x) / 2;
            const midY = (nodeA.y + nodeB.y) / 2;

            return (
              <g key={edge.id}>
                <line
                  x1={nodeA.x}
                  y1={nodeA.y}
                  x2={nodeB.x}
                  y2={nodeB.y}
                  stroke="#4B5563"
                  strokeWidth="2"
                />
                <text
                  x={midX}
                  y={midY - 10}
                  fill="#1F2937"
                  fontSize="12"
                  textAnchor="middle"
                  className="pointer-events-auto"
                >
                  {typeof edge.resistance === "number"
                    ? `${edge.resistance}Ω`
                    : edge.resistance}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Render nodes */}
        {circuit.nodes.map((node) => (
          <div
            key={node.id}
            onClick={(e) => handleNodeClick(node.id, e)}
            className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold cursor-pointer transform -translate-x-1/2 -translate-y-1/2 ${
              selectedNodes.includes(node.id)
                ? "bg-green-500 ring-4 ring-green-300"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
            style={{ left: node.x, top: node.y }}
          >
            {node.label}
          </div>
        ))}
      </div>

      {/* Edge properties panel */}
      {circuit.edges.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Edge Properties</h3>
          <div className="space-y-2">
            {circuit.edges.map((edge) => {
              const nodeA = getNodeById(edge.nodeA);
              const nodeB = getNodeById(edge.nodeB);
              return (
                <div key={edge.id} className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {nodeA?.label} - {nodeB?.label}:
                  </span>
                  <input
                    type="text"
                    value={edge.resistance}
                    onChange={(e) => updateResistance(edge.id, e.target.value)}
                    className="px-2 py-1 border rounded w-32"
                    placeholder="Resistance"
                  />
                  <span className="text-sm text-gray-500">
                    (e.g., 10, r, Infinity)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Circuit info */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Circuit Info</h3>
        <p className="text-sm text-gray-600">
          Nodes: {circuit.nodes.length} | Edges: {circuit.edges.length}
        </p>
      </div>
    </div>
  );
}

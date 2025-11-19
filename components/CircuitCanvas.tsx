"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { Node, Edge, Circuit } from "@/types/circuit";
import { calculateEquivalentResistance, SymbolicResistance } from "@/lib/circuitCalculator";
import { applyForceDirectedLayout } from "@/lib/graphLayout";
import { calculateCurrents, SymbolicValue } from "@/lib/currentCalculator";

export default function CircuitCanvas() {
  const [circuit, setCircuit] = useState<Circuit>({ nodes: [], edges: [] });
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [mode, setMode] = useState<"add-node" | "add-edge" | "select" | "calculate-resistance" | "delete">("select");
  const [calculationNodes, setCalculationNodes] = useState<string[]>([]);
  const [equivalentResistance, setEquivalentResistance] = useState<SymbolicResistance | null>(null);
  const [showCurrents, setShowCurrents] = useState<boolean>(true);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Calculate currents whenever circuit changes
  const edgeCurrents = useMemo(() => {
    return calculateCurrents(circuit);
  }, [circuit]);

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

  const deleteNode = useCallback((nodeId: string) => {
    setCircuit((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      // Also remove all edges connected to this node
      edges: prev.edges.filter((e) => e.nodeA !== nodeId && e.nodeB !== nodeId),
    }));
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setCircuit((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId),
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

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggedNode || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - dragOffset.x;
    const newY = mouseY - dragOffset.y;

    setCircuit((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === draggedNode ? { ...node, x: newX, y: newY } : node
      ),
    }));
  };

  const handleCanvasMouseUp = () => {
    setDraggedNode(null);
  };

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (mode === "select") {
      // Start dragging
      const node = getNodeById(nodeId);
      if (!node || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setDraggedNode(nodeId);
      setDragOffset({
        x: mouseX - node.x,
        y: mouseY - node.y,
      });
    }
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (mode === "delete") {
      deleteNode(nodeId);
    } else if (mode === "add-edge") {
      setSelectedNodes((prev) => {
        const newSelection = [...prev, nodeId];
        if (newSelection.length === 2) {
          addEdge(newSelection[0], newSelection[1]);
          return [];
        }
        return newSelection;
      });
    } else if (mode === "calculate-resistance") {
      setCalculationNodes((prev) => {
        const newSelection = [...prev, nodeId];
        if (newSelection.length === 2) {
          // Calculate equivalent resistance
          const result = calculateEquivalentResistance(circuit, newSelection[0], newSelection[1]);
          setEquivalentResistance(result);
          return newSelection; // Keep the selection to show which nodes were used
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

  const updateNodePotential = (nodeId: string, value: string) => {
    setCircuit((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === nodeId ? { ...node, potential: value || undefined } : node
      ),
    }));
  };

  const handleAutoLayout = () => {
    if (!canvasRef.current || circuit.nodes.length === 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const layoutedNodes = applyForceDirectedLayout(circuit, {
      width: rect.width,
      height: rect.height,
    });

    setCircuit((prev) => ({
      ...prev,
      nodes: layoutedNodes,
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
          <button
            onClick={() => setMode("delete")}
            className={`px-4 py-2 rounded ${
              mode === "delete"
                ? "bg-red-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Delete
          </button>
          <button
            onClick={() => {
              setMode("calculate-resistance");
              setCalculationNodes([]);
              setEquivalentResistance(null);
            }}
            className={`px-4 py-2 rounded ${
              mode === "calculate-resistance"
                ? "bg-purple-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Calculate R<sub>eq</sub>
          </button>
          <button
            onClick={handleAutoLayout}
            disabled={circuit.nodes.length === 0}
            className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Auto-Layout
          </button>
          <button
            onClick={() => setShowCurrents(!showCurrents)}
            className={`px-4 py-2 rounded ${
              showCurrents
                ? "bg-red-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {showCurrents ? "Hide" : "Show"} Currents
          </button>
        </div>
        {mode === "add-edge" && selectedNodes.length === 1 && (
          <p className="mt-2 text-sm text-gray-600">
            Select the second node to create an edge
          </p>
        )}
        {mode === "delete" && (
          <p className="mt-2 text-sm text-red-600">
            Click on a node or edge to delete it
          </p>
        )}
        {mode === "calculate-resistance" && calculationNodes.length === 1 && (
          <p className="mt-2 text-sm text-gray-600">
            Select the second node to calculate equivalent resistance
          </p>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
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

            const current = edgeCurrents.get(edge.id);
            const hasNonZeroCurrent = current && !(current.isNumeric() && Math.abs(current.toNumber()) < 1e-10);

            return (
              <g key={edge.id}>
                {/* Invisible thick line for easier clicking */}
                <line
                  x1={nodeA.x}
                  y1={nodeA.y}
                  x2={nodeB.x}
                  y2={nodeB.y}
                  stroke="transparent"
                  strokeWidth="20"
                  className={mode === "delete" ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === "delete") {
                      deleteEdge(edge.id);
                    }
                  }}
                />
                {/* Visible line */}
                <line
                  x1={nodeA.x}
                  y1={nodeA.y}
                  x2={nodeB.x}
                  y2={nodeB.y}
                  stroke={hasNonZeroCurrent && showCurrents ? "#DC2626" : "#4B5563"}
                  strokeWidth={hasNonZeroCurrent && showCurrents ? "3" : "2"}
                  className="pointer-events-none"
                />
                {/* Resistance label */}
                <text
                  x={midX}
                  y={midY - 10}
                  fill="#1F2937"
                  fontSize="12"
                  textAnchor="middle"
                  className={mode === "delete" ? "pointer-events-auto cursor-pointer" : "pointer-events-auto"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mode === "delete") {
                      deleteEdge(edge.id);
                    }
                  }}
                >
                  {typeof edge.resistance === "number"
                    ? `${edge.resistance}Ω`
                    : edge.resistance}
                </text>
                {/* Current label */}
                {showCurrents && current && (
                  <text
                    x={midX}
                    y={midY + 20}
                    fill="#DC2626"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="pointer-events-auto"
                  >
                    I = {current.toDisplayString("A")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Render nodes */}
        {circuit.nodes.map((node) => {
          const isSelected = selectedNodes.includes(node.id);
          const isCalculationNode = calculationNodes.includes(node.id);
          const isDragging = draggedNode === node.id;

          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
              onClick={(e) => handleNodeClick(node.id, e)}
              className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold transform -translate-x-1/2 -translate-y-1/2 ${
                isSelected
                  ? "bg-green-500 ring-4 ring-green-300"
                  : isCalculationNode
                  ? "bg-purple-500 ring-4 ring-purple-300"
                  : "bg-blue-500 hover:bg-blue-600"
              } ${
                mode === "select" && !isDragging
                  ? "cursor-move"
                  : isDragging
                  ? "cursor-grabbing"
                  : "cursor-pointer"
              }`}
              style={{ left: node.x, top: node.y }}
            >
              {node.label}
            </div>
          );
        })}
      </div>

      {/* Node properties panel */}
      {circuit.nodes.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Node Properties</h3>
          <div className="space-y-2">
            {circuit.nodes.map((node) => (
              <div key={node.id} className="flex items-center gap-2">
                <span className="text-sm text-gray-600 w-12">
                  {node.label}:
                </span>
                <span className="text-sm text-gray-500">V =</span>
                <input
                  type="text"
                  value={node.potential ?? ""}
                  onChange={(e) => updateNodePotential(node.id, e.target.value)}
                  className="px-2 py-1 border rounded w-32"
                  placeholder="Potential"
                />
                <span className="text-sm text-gray-500">
                  (e.g., 5, V, 0)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Equivalent resistance display */}
      {equivalentResistance !== null && calculationNodes.length === 2 && (
        <div className="bg-purple-50 p-4 rounded-lg shadow border-2 border-purple-200">
          <h3 className="text-lg font-semibold mb-2 text-purple-900">
            Equivalent Resistance
          </h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Between nodes:{" "}
              <span className="font-semibold">
                {getNodeById(calculationNodes[0])?.label}
              </span>
              {" and "}
              <span className="font-semibold">
                {getNodeById(calculationNodes[1])?.label}
              </span>
            </p>
            <div className="bg-white p-3 rounded border border-purple-300">
              <p className="text-2xl font-bold text-purple-700">
                R<sub>eq</sub> = {equivalentResistance.toDisplayString()}
              </p>
            </div>
            <button
              onClick={() => {
                setCalculationNodes([]);
                setEquivalentResistance(null);
              }}
              className="mt-2 px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
            >
              Clear Calculation
            </button>
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

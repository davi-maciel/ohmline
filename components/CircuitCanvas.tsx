"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Node, Edge, Circuit } from "@/types/circuit";
import { calculateEquivalentResistance, SymbolicResistance } from "@/lib/circuitCalculator";
import { applyForceDirectedLayout } from "@/lib/graphLayout";
import { calculateCurrents, SymbolicValue } from "@/lib/currentCalculator";

export default function CircuitCanvas() {
  const [circuit, setCircuit] = useState<Circuit>({ nodes: [], edges: [] });
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [mode, setMode] = useState<"add-node" | "add-edge" | "select" | "calculate-resistance" | "delete">("select");
  const [calculationNodes, setCalculationNodes] = useState<string[]>([]);
  const [equivalentResistance, setEquivalentResistance] = useState<SymbolicResistance | null>(null);
  const [showCurrents, setShowCurrents] = useState<boolean>(true);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastEdgeAddRef = useRef<{ nodeA: string; nodeB: string; timestamp: number } | null>(null);

  // Undo/Redo state
  const [history, setHistory] = useState<Circuit[]>([{ nodes: [], edges: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoingOrRedoing = useRef(false);

  // Calculate currents whenever circuit changes
  const edgeCurrents = useMemo(() => {
    return calculateCurrents(circuit);
  }, [circuit]);

  // Update history when circuit changes
  useEffect(() => {
    if (isUndoingOrRedoing.current) {
      isUndoingOrRedoing.current = false;
      return;
    }

    // Add current circuit to history
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      // Deep clone circuit to avoid reference issues
      newHistory.push(JSON.parse(JSON.stringify(circuit)));
      // Limit history to 50 states to prevent memory issues
      if (newHistory.length > 50) {
        newHistory.shift();
        setHistoryIndex((idx) => Math.max(0, idx - 1));
        return newHistory;
      }
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [circuit]);

  // Undo/Redo functions
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoingOrRedoing.current = true;
      setHistoryIndex((prev) => prev - 1);
      setCircuit(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoingOrRedoing.current = true;
      setHistoryIndex((prev) => prev + 1);
      setCircuit(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  }, [historyIndex, history]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo (Ctrl/Cmd+Z)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)
      else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") || ((e.ctrlKey || e.metaKey) && e.key === "y")) {
        e.preventDefault();
        redo();
      }
      // Delete key - delete selected items
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          e.preventDefault();

          // Delete selected nodes and edges
          setCircuit((prev) => ({
            nodes: prev.nodes.filter((n) => !selectedNodes.includes(n.id)),
            edges: prev.edges.filter((e) => !selectedEdges.includes(e.id) && !selectedNodes.includes(e.nodeA) && !selectedNodes.includes(e.nodeB)),
          }));

          // Clear selections
          setSelectedNodes([]);
          setSelectedEdges([]);
        }
      }
      // Escape key - clear selections
      else if (e.key === "Escape") {
        setSelectedNodes([]);
        setSelectedEdges([]);
        setCalculationNodes([]);
        setEquivalentResistance(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodes, selectedEdges, undo, redo]);

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
      id: `edge-${Date.now()}-${Math.random()}`,
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
    } else if (mode === "select") {
      // Deselect all when clicking on canvas background
      setSelectedNodes([]);
      setSelectedEdges([]);
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

    if (mode === "select") {
      // Multi-select with Ctrl/Cmd key
      if (e.ctrlKey || e.metaKey) {
        setSelectedNodes((prev) =>
          prev.includes(nodeId)
            ? prev.filter((id) => id !== nodeId)
            : [...prev, nodeId]
        );
      } else {
        // Single select
        setSelectedNodes((prev) =>
          prev.includes(nodeId) && prev.length === 1 ? [] : [nodeId]
        );
        setSelectedEdges([]);
      }
    } else if (mode === "delete") {
      deleteNode(nodeId);
    } else if (mode === "add-edge") {
      setSelectedNodes((prev) => {
        const newSelection = [...prev, nodeId];
        if (newSelection.length === 2) {
          const nodeA = newSelection[0];
          const nodeB = newSelection[1];

          // Check if we just added this exact edge within the last 100ms
          // This prevents double-clicks / event bubbling from adding duplicate edges
          // but still allows users to intentionally add parallel edges
          const now = Date.now();
          if (lastEdgeAddRef.current) {
            const { nodeA: lastA, nodeB: lastB, timestamp } = lastEdgeAddRef.current;
            const sameEdge =
              (lastA === nodeA && lastB === nodeB) ||
              (lastA === nodeB && lastB === nodeA);

            if (sameEdge && now - timestamp < 100) {
              // Skip this duplicate edge addition (likely from event bubbling)
              return [];
            }
          }

          lastEdgeAddRef.current = { nodeA, nodeB, timestamp: now };
          addEdge(nodeA, nodeB);
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

  const handleEdgeClick = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (mode === "select") {
      // Multi-select with Ctrl/Cmd key
      if (e.ctrlKey || e.metaKey) {
        setSelectedEdges((prev) =>
          prev.includes(edgeId)
            ? prev.filter((id) => id !== edgeId)
            : [...prev, edgeId]
        );
      } else {
        // Single select
        setSelectedEdges((prev) =>
          prev.includes(edgeId) && prev.length === 1 ? [] : [edgeId]
        );
        setSelectedNodes([]);
      }
    } else if (mode === "delete") {
      deleteEdge(edgeId);
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

  const handleSaveCircuit = () => {
    const dataStr = JSON.stringify(circuit, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `circuit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadCircuit = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const loadedCircuit = JSON.parse(event.target?.result as string);
          // Validate the loaded circuit has the expected structure
          if (loadedCircuit && Array.isArray(loadedCircuit.nodes) && Array.isArray(loadedCircuit.edges)) {
            setCircuit(loadedCircuit);
            // Clear selections
            setSelectedNodes([]);
            setSelectedEdges([]);
            setCalculationNodes([]);
            setEquivalentResistance(null);
          } else {
            alert("Invalid circuit file format");
          }
        } catch (error) {
          alert("Error loading circuit file");
          console.error(error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const generateSVG = (): string => {
    // Calculate bounds
    const padding = 50;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    circuit.nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    });

    // Handle empty circuit
    if (circuit.nodes.length === 0) {
      minX = minY = 0;
      maxX = maxY = 100;
    }

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    // Build SVG string
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    // Background
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;

    // Edges
    circuit.edges.forEach((edge) => {
      const nodeA = getNodeById(edge.nodeA);
      const nodeB = getNodeById(edge.nodeB);
      if (!nodeA || !nodeB) return;

      const x1 = nodeA.x - minX + padding;
      const y1 = nodeA.y - minY + padding;
      const x2 = nodeB.x - minX + padding;
      const y2 = nodeB.y - minY + padding;

      // Find all edges between these two nodes (in either direction)
      const parallelEdges = circuit.edges.filter((e) =>
        (e.nodeA === edge.nodeA && e.nodeB === edge.nodeB) ||
        (e.nodeA === edge.nodeB && e.nodeB === edge.nodeA)
      );
      const edgeIndex = parallelEdges.findIndex((e) => e.id === edge.id);
      const totalParallelEdges = parallelEdges.length;

      let pathD: string;
      let midX: number;
      let midY: number;

      if (totalParallelEdges === 1) {
        // Single edge - draw straight line
        pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
        midX = (x1 + x2) / 2;
        midY = (y1 + y2) / 2;
      } else {
        // Multiple edges - draw curves
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / length;
        const perpY = dx / length;
        const maxOffset = 40;
        const offsetStep = maxOffset / Math.max(1, Math.floor(totalParallelEdges / 2));

        let offset: number;
        if (totalParallelEdges === 2) {
          offset = edgeIndex === 0 ? -offsetStep : offsetStep;
        } else {
          const midIndex = Math.floor(totalParallelEdges / 2);
          offset = (edgeIndex - midIndex) * offsetStep;
        }

        const controlX = (x1 + x2) / 2 + perpX * offset;
        const controlY = (y1 + y2) / 2 + perpY * offset;
        pathD = `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
        midX = 0.25 * x1 + 0.5 * controlX + 0.25 * x2;
        midY = 0.25 * y1 + 0.5 * controlY + 0.25 * y2;
      }

      const current = edgeCurrents.get(edge.id);
      const hasNonZeroCurrent = current && !(current.isNumeric() && Math.abs(current.toNumber()) < 1e-10);

      // Edge path
      svg += `<path d="${pathD}" stroke="${hasNonZeroCurrent && showCurrents ? '#DC2626' : '#4B5563'}" stroke-width="${hasNonZeroCurrent && showCurrents ? '3' : '2'}" fill="none"/>`;

      // Resistance label
      const resistanceText = typeof edge.resistance === "number" ? `${edge.resistance}Ω` : edge.resistance;
      svg += `<text x="${midX}" y="${midY - 10}" fill="#1F2937" font-size="12" text-anchor="middle" font-family="Arial, sans-serif">${resistanceText}</text>`;

      // Current label
      if (showCurrents && current) {
        svg += `<text x="${midX}" y="${midY + 20}" fill="#DC2626" font-size="11" font-weight="bold" text-anchor="middle" font-family="Arial, sans-serif">I = ${current.toDisplayString("A")}</text>`;
      }
    });

    // Nodes
    circuit.nodes.forEach((node) => {
      const x = node.x - minX + padding;
      const y = node.y - minY + padding;

      // Node circle
      svg += `<circle cx="${x}" cy="${y}" r="16" fill="#3B82F6"/>`;

      // Node label
      svg += `<text x="${x}" y="${y + 5}" fill="white" font-size="12" font-weight="bold" text-anchor="middle" font-family="Arial, sans-serif">${node.label}</text>`;
    });

    svg += '</svg>';
    return svg;
  };

  const handleExportSVG = () => {
    const svgData = generateSVG();
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `circuit-${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    const svgData = generateSVG();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Convert to PNG and download
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement("a");
        link.href = pngUrl;
        link.download = `circuit-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
      });

      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={undo}
            disabled={historyIndex === 0}
            className="px-4 py-2 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Undo (Ctrl/Cmd+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="px-4 py-2 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            ↷ Redo
          </button>
          <div className="border-l-2 border-gray-300 mx-1"></div>
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
          <div className="border-l-2 border-gray-300 mx-1"></div>
          <button
            onClick={handleSaveCircuit}
            disabled={circuit.nodes.length === 0 && circuit.edges.length === 0}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Save circuit to JSON file"
          >
            💾 Save
          </button>
          <button
            onClick={handleLoadCircuit}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            title="Load circuit from JSON file"
          >
            📂 Load
          </button>
          <div className="border-l-2 border-gray-300 mx-1"></div>
          <button
            onClick={handleExportSVG}
            disabled={circuit.nodes.length === 0}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Export circuit as SVG image"
          >
            🖼️ Export SVG
          </button>
          <button
            onClick={handleExportPNG}
            disabled={circuit.nodes.length === 0}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Export circuit as PNG image"
          >
            📸 Export PNG
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
        {mode === "select" && (selectedNodes.length > 0 || selectedEdges.length > 0) && (
          <p className="mt-2 text-sm text-blue-600">
            Selected: {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''}, {selectedEdges.length} edge{selectedEdges.length !== 1 ? 's' : ''} | Press Delete to remove or Escape to deselect
          </p>
        )}
        {mode === "select" && selectedNodes.length === 0 && selectedEdges.length === 0 && (
          <p className="mt-2 text-sm text-gray-600">
            Click to select items. Hold Ctrl/Cmd to select multiple. Press Delete to remove selected items. Use Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z to redo.
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

            // Find all edges between these two nodes (in either direction)
            const parallelEdges = circuit.edges.filter((e) =>
              (e.nodeA === edge.nodeA && e.nodeB === edge.nodeB) ||
              (e.nodeA === edge.nodeB && e.nodeB === edge.nodeA)
            );
            const edgeIndex = parallelEdges.findIndex((e) => e.id === edge.id);
            const totalParallelEdges = parallelEdges.length;

            // Calculate curve offset for parallel edges
            let pathD: string;
            let midX: number;
            let midY: number;

            if (totalParallelEdges === 1) {
              // Single edge - draw straight line
              pathD = `M ${nodeA.x} ${nodeA.y} L ${nodeB.x} ${nodeB.y}`;
              midX = (nodeA.x + nodeB.x) / 2;
              midY = (nodeA.y + nodeB.y) / 2;
            } else {
              // Multiple edges - draw curves
              // Calculate perpendicular offset
              const dx = nodeB.x - nodeA.x;
              const dy = nodeB.y - nodeA.y;
              const length = Math.sqrt(dx * dx + dy * dy);

              // Perpendicular vector (normalized)
              const perpX = -dy / length;
              const perpY = dx / length;

              // Offset amount based on edge index
              const maxOffset = 40; // Maximum curve offset
              const offsetStep = maxOffset / Math.max(1, Math.floor(totalParallelEdges / 2));

              // Calculate offset for this edge
              let offset: number;
              if (totalParallelEdges === 2) {
                offset = edgeIndex === 0 ? -offsetStep : offsetStep;
              } else {
                const midIndex = Math.floor(totalParallelEdges / 2);
                offset = (edgeIndex - midIndex) * offsetStep;
              }

              // Calculate control point for quadratic curve
              const controlX = (nodeA.x + nodeB.x) / 2 + perpX * offset;
              const controlY = (nodeA.y + nodeB.y) / 2 + perpY * offset;

              // Create quadratic bezier path
              pathD = `M ${nodeA.x} ${nodeA.y} Q ${controlX} ${controlY} ${nodeB.x} ${nodeB.y}`;

              // Calculate midpoint on curve for labels (point at t=0.5 on quadratic bezier)
              midX = 0.25 * nodeA.x + 0.5 * controlX + 0.25 * nodeB.x;
              midY = 0.25 * nodeA.y + 0.5 * controlY + 0.25 * nodeB.y;
            }

            const current = edgeCurrents.get(edge.id);
            const hasNonZeroCurrent = current && !(current.isNumeric() && Math.abs(current.toNumber()) < 1e-10);
            const isSelected = selectedEdges.includes(edge.id);

            return (
              <g key={edge.id}>
                {/* Invisible thick path for easier clicking */}
                <path
                  d={pathD}
                  stroke="transparent"
                  strokeWidth="20"
                  fill="none"
                  className={(mode === "delete" || mode === "select") ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}
                  onClick={(e) => handleEdgeClick(edge.id, e)}
                />
                {/* Visible path */}
                <path
                  d={pathD}
                  stroke={isSelected ? "#10B981" : (hasNonZeroCurrent && showCurrents ? "#DC2626" : "#4B5563")}
                  strokeWidth={isSelected ? "4" : (hasNonZeroCurrent && showCurrents ? "3" : "2")}
                  fill="none"
                  className="pointer-events-none"
                  strokeDasharray={isSelected ? "5,5" : "none"}
                />
                {/* Resistance label */}
                <text
                  x={midX}
                  y={midY - 10}
                  fill="#1F2937"
                  fontSize="12"
                  textAnchor="middle"
                  className={(mode === "delete" || mode === "select") ? "pointer-events-auto cursor-pointer" : "pointer-events-auto"}
                  onClick={(e) => handleEdgeClick(edge.id, e)}
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

"use client";

import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import type { Node, Edge, Circuit } from "@/types/circuit";
import {
  calculateEquivalentResistance,
  RationalExpr,
} from "@/lib/circuitCalculator";
import {
  applyForceDirectedLayout,
} from "@/lib/graphLayout";
import UiSwitch from "@/components/UiSwitch";
import {
  calculateCurrents,
} from "@/lib/currentCalculator";

/**
 * Let long expressions wrap after operators
 * instead of in the middle of a number.
 */
function breakable(s: string): React.ReactNode[] {
  return s.split(/(?<=[+\-/\u00B7)])/).flatMap(
    (part, i) => (i === 0 ? [part] : [<wbr key={i} />, part])
  );
}

export default function CircuitCanvas() {
  const [circuit, setCircuit] = useState<Circuit>({
    nodes: [],
    edges: [],
  });
  const [selectedNodes, setSelectedNodes] = useState<
    string[]
  >([]);
  const [selectedEdges, setSelectedEdges] = useState<
    string[]
  >([]);
  const [mode, setMode] = useState<
    | "add-node"
    | "add-edge"
    | "select"
    | "calculate-resistance"
    | "delete"
  >("select");
  const [calculationNodes, setCalculationNodes] = useState<
    string[]
  >([]);
  const [showCurrents, setShowCurrents] =
    useState<boolean>(true);
  const [draggedNode, setDraggedNode] = useState<
    string | null
  >(null);
  const [dragOffset, setDragOffset] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastEdgeAddRef = useRef<{
    nodeA: string;
    nodeB: string;
    timestamp: number;
  } | null>(null);

  // Viewport state (pan & zoom)
  const [viewOffset, setViewOffset] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const spaceHeldRef = useRef(false);
  const wasPanningRef = useRef(false);

  // Undo/Redo state
  const [history, setHistory] = useState<Circuit[]>([
    { nodes: [], edges: [] },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoingOrRedoing = useRef(false);
  const isDraggingRef = useRef(false);
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;

  // Calculate currents whenever circuit changes
  const edgeCurrents = useMemo(() => {
    return calculateCurrents(circuit);
  }, [circuit]);

  // Derived, so it stays in sync with undo/redo
  // and edits made while the result is shown
  const equivalentResistance =
    useMemo<RationalExpr | null>(() => {
      if (calculationNodes.length !== 2) return null;
      return calculateEquivalentResistance(
        circuit,
        calculationNodes[0],
        calculationNodes[1]
      );
    }, [circuit, calculationNodes]);

  // Update history when circuit changes
  useEffect(() => {
    if (isUndoingOrRedoing.current) {
      isUndoingOrRedoing.current = false;
      return;
    }
    if (isDraggingRef.current) return;

    setHistory((prev) => {
      const idx = historyIndexRef.current;
      const newHistory = prev.slice(0, idx + 1);
      newHistory.push(
        JSON.parse(JSON.stringify(circuit))
      );
      if (newHistory.length > 50) {
        newHistory.shift();
        setHistoryIndex((i) => Math.max(0, i - 1));
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
      setCircuit(
        JSON.parse(
          JSON.stringify(history[historyIndex - 1])
        )
      );
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoingOrRedoing.current = true;
      setHistoryIndex((prev) => prev + 1);
      setCircuit(
        JSON.parse(
          JSON.stringify(history[historyIndex + 1])
        )
      );
    }
  }, [historyIndex, history]);

  // Coordinate transforms
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => ({
      x: screenX / zoom + viewOffset.x,
      y: screenY / zoom + viewOffset.y,
    }),
    [zoom, viewOffset]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Leave typing in form fields alone (Space,
      // Backspace and undo belong to the field)
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      // Space key for panning
      if (e.code === "Space") {
        e.preventDefault();
        spaceHeldRef.current = true;
        return;
      }
      // Undo
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "z" &&
        !e.shiftKey
      ) {
        e.preventDefault();
        undo();
      }
      // Redo
      else if (
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          e.key === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }
      // Delete
      else if (
        e.key === "Delete" ||
        e.key === "Backspace"
      ) {
        if (
          selectedNodes.length > 0 ||
          selectedEdges.length > 0
        ) {
          e.preventDefault();
          setCircuit((prev) => ({
            nodes: prev.nodes.filter(
              (n) => !selectedNodes.includes(n.id)
            ),
            edges: prev.edges.filter(
              (edge) =>
                !selectedEdges.includes(edge.id) &&
                !selectedNodes.includes(edge.nodeA) &&
                !selectedNodes.includes(edge.nodeB)
            ),
          }));
          setSelectedNodes([]);
          setSelectedEdges([]);
        }
      }
      // Escape
      else if (e.key === "Escape") {
        setSelectedNodes([]);
        setSelectedEdges([]);
        setCalculationNodes([]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedNodes, selectedEdges, undo, redo]);

  // Zoom with scroll wheel
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect =
        canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // World point under cursor before zoom
      const worldX = screenX / zoom + viewOffset.x;
      const worldY = screenY / zoom + viewOffset.y;

      const factor = e.deltaY > 0 ? 0.97 : 1.03;
      const newZoom = Math.min(
        5,
        Math.max(0.1, zoom * factor)
      );

      // Keep world point under cursor fixed
      setZoom(newZoom);
      setViewOffset({
        x: worldX - screenX / newZoom,
        y: worldY - screenY / newZoom,
      });
    },
    [zoom, viewOffset]
  );

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, {
      passive: false,
    });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const addNode = useCallback(
    (x: number, y: number) => {
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
    },
    [circuit.nodes.length]
  );

  const addEdge = useCallback(
    (nodeAId: string, nodeBId: string) => {
      const newEdge: Edge = {
        id: `edge-${Date.now()}-${Math.random()}`,
        nodeA: nodeAId,
        nodeB: nodeBId,
        resistance: 1,
      };
      setCircuit((prev) => ({
        ...prev,
        edges: [...prev.edges, newEdge],
      }));
    },
    []
  );

  const deleteNode = useCallback((nodeId: string) => {
    setCircuit((prev) => ({
      nodes: prev.nodes.filter(
        (n) => n.id !== nodeId
      ),
      edges: prev.edges.filter(
        (e) =>
          e.nodeA !== nodeId && e.nodeB !== nodeId
      ),
    }));
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setCircuit((prev) => ({
      ...prev,
      edges: prev.edges.filter(
        (e) => e.id !== edgeId
      ),
    }));
  }, []);

  // --- Canvas event handlers ---

  const handleCanvasMouseDown = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    // Middle-click or space+left-click → pan
    if (
      e.button === 1 ||
      (e.button === 0 && spaceHeldRef.current)
    ) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        offsetX: viewOffset.x,
        offsetY: viewOffset.y,
      };
    }
  };

  const handleCanvasClick = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    // Ignore clicks that were really pan-releases
    if (wasPanningRef.current) {
      wasPanningRef.current = false;
      return;
    }
    if (!canvasRef.current) return;

    const rect =
      canvasRef.current.getBoundingClientRect();
    const { x, y } = screenToWorld(
      e.clientX - rect.left,
      e.clientY - rect.top
    );

    if (mode === "add-node") {
      addNode(x, y);
    } else if (mode === "select") {
      setSelectedNodes([]);
      setSelectedEdges([]);
    }
  };

  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    // Panning
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewOffset({
        x: panStartRef.current.offsetX - dx / zoom,
        y: panStartRef.current.offsetY - dy / zoom,
      });
      return;
    }

    // Node dragging
    if (!draggedNode || !canvasRef.current) return;

    const rect =
      canvasRef.current.getBoundingClientRect();
    const { x: worldX, y: worldY } = screenToWorld(
      e.clientX - rect.left,
      e.clientY - rect.top
    );

    const newX = worldX - dragOffset.x;
    const newY = worldY - dragOffset.y;

    setCircuit((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === draggedNode
          ? { ...node, x: newX, y: newY }
          : node
      ),
    }));
  };

  const handleCanvasMouseUp = () => {
    if (isPanning) {
      wasPanningRef.current = true;
      setIsPanning(false);
      panStartRef.current = null;
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      // Commit final position to history
      setCircuit((prev) => ({ ...prev }));
    }
    setDraggedNode(null);
  };

  const handleNodeMouseDown = (
    nodeId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (mode === "select") {
      const node = getNodeById(nodeId);
      if (!node || !canvasRef.current) return;

      const rect =
        canvasRef.current.getBoundingClientRect();
      const { x: worldX, y: worldY } = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top
      );

      isDraggingRef.current = true;
      setDraggedNode(nodeId);
      setDragOffset({
        x: worldX - node.x,
        y: worldY - node.y,
      });
    }
  };

  const handleNodeClick = (
    nodeId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (mode === "select") {
      if (e.ctrlKey || e.metaKey) {
        setSelectedNodes((prev) =>
          prev.includes(nodeId)
            ? prev.filter((id) => id !== nodeId)
            : [...prev, nodeId]
        );
      } else {
        setSelectedNodes((prev) =>
          prev.includes(nodeId) && prev.length === 1
            ? []
            : [nodeId]
        );
        setSelectedEdges([]);
      }
    } else if (mode === "delete") {
      deleteNode(nodeId);
    } else if (mode === "add-edge") {
      const now = Date.now();
      if (lastEdgeAddRef.current) {
        const { nodeA: lastA, nodeB: lastB, timestamp } =
          lastEdgeAddRef.current;
        if (
          (lastA === nodeId || lastB === nodeId) &&
          now - timestamp < 500
        ) {
          return;
        }
      }

      if (selectedNodes.length === 0) {
        setSelectedNodes([nodeId]);
      } else if (selectedNodes.length === 1) {
        const nodeA = selectedNodes[0];
        const nodeB = nodeId;
        lastEdgeAddRef.current = {
          nodeA,
          nodeB,
          timestamp: now,
        };
        addEdge(nodeA, nodeB);
        setSelectedNodes([]);
      }
    } else if (mode === "calculate-resistance") {
      // A third click starts a new pair
      setCalculationNodes((prev) =>
        prev.length >= 2 ? [nodeId] : [...prev, nodeId]
      );
    }
  };

  const handleEdgeClick = (
    edgeId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (mode === "select") {
      if (e.ctrlKey || e.metaKey) {
        setSelectedEdges((prev) =>
          prev.includes(edgeId)
            ? prev.filter((id) => id !== edgeId)
            : [...prev, edgeId]
        );
      } else {
        setSelectedEdges((prev) =>
          prev.includes(edgeId) && prev.length === 1
            ? []
            : [edgeId]
        );
        setSelectedNodes([]);
      }
    } else if (mode === "delete") {
      deleteEdge(edgeId);
    }
  };

  const updateResistance = (
    edgeId: string,
    value: string
  ) => {
    setCircuit((prev) => ({
      ...prev,
      edges: prev.edges.map((edge) =>
        edge.id === edgeId
          ? { ...edge, resistance: value }
          : edge
      ),
    }));
  };

  const commitResistance = (
    edgeId: string,
    value: string
  ) => {
    if (value === "") {
      updateResistance(edgeId, "1");
    }
  };

  const updateNodePotential = (
    nodeId: string,
    value: string
  ) => {
    setCircuit((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, potential: value || undefined }
          : node
      ),
    }));
  };

  const updateNodeLabel = (
    nodeId: string,
    value: string
  ) => {
    setCircuit((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, label: value || node.label }
          : node
      ),
    }));
  };

  const handleAutoLayout = () => {
    if (circuit.nodes.length === 0) return;

    const rect =
      canvasRef.current?.getBoundingClientRect();
    const layoutW = rect ? rect.width / zoom : 1000;
    const layoutH = rect ? rect.height / zoom : 800;

    const layoutedNodes = applyForceDirectedLayout(
      circuit,
      { width: layoutW, height: layoutH }
    );

    // Offset so layout is placed in current viewport
    const adjusted = layoutedNodes.map((n) => ({
      ...n,
      x: n.x + viewOffset.x,
      y: n.y + viewOffset.y,
    }));

    setCircuit((prev) => ({
      ...prev,
      nodes: adjusted,
    }));
  };

  const getNodeById = (id: string) =>
    circuit.nodes.find((n) => n.id === id);

  // --- File I/O ---

  const handleSaveCircuit = () => {
    const dataStr = JSON.stringify(circuit, null, 2);
    const dataBlob = new Blob([dataStr], {
      type: "application/json",
    });
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
      const file = (e.target as HTMLInputElement)
        .files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const loaded = JSON.parse(
            event.target?.result as string
          );
          if (
            loaded &&
            Array.isArray(loaded.nodes) &&
            Array.isArray(loaded.edges)
          ) {
            setCircuit(loaded);
            setSelectedNodes([]);
            setSelectedEdges([]);
            setCalculationNodes([]);
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

  // --- Export ---

  const generateSVG = (): string => {
    const padding = 50;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    circuit.nodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    });

    if (circuit.nodes.length === 0) {
      minX = minY = 0;
      maxX = maxY = 100;
    }

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    let svg =
      `<svg xmlns="http://www.w3.org/2000/svg"` +
      ` width="${width}" height="${height}"` +
      ` viewBox="0 0 ${width} ${height}">`;
    svg +=
      `<rect width="${width}"` +
      ` height="${height}" fill="white"/>`;

    circuit.edges.forEach((edge) => {
      const nodeA = getNodeById(edge.nodeA);
      const nodeB = getNodeById(edge.nodeB);
      if (!nodeA || !nodeB) return;

      const x1 = nodeA.x - minX + padding;
      const y1 = nodeA.y - minY + padding;
      const x2 = nodeB.x - minX + padding;
      const y2 = nodeB.y - minY + padding;

      const parallelEdges = circuit.edges.filter(
        (e) =>
          (e.nodeA === edge.nodeA &&
            e.nodeB === edge.nodeB) ||
          (e.nodeA === edge.nodeB &&
            e.nodeB === edge.nodeA)
      );
      const edgeIndex = parallelEdges.findIndex(
        (e) => e.id === edge.id
      );
      const totalParallelEdges = parallelEdges.length;

      let pathD: string;
      let midX: number;
      let midY: number;

      if (totalParallelEdges === 1) {
        pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
        midX = (x1 + x2) / 2;
        midY = (y1 + y2) / 2;
      } else {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(
          dx * dx + dy * dy
        );
        const perpX = -dy / length;
        const perpY = dx / length;
        const maxOffset = 40;
        const offsetStep =
          maxOffset /
          Math.max(
            1,
            Math.floor(totalParallelEdges / 2)
          );

        let offset: number;
        if (totalParallelEdges === 2) {
          offset =
            edgeIndex === 0
              ? -offsetStep
              : offsetStep;
        } else {
          const midIndex = Math.floor(
            totalParallelEdges / 2
          );
          offset = (edgeIndex - midIndex) * offsetStep;
        }

        const controlX =
          (x1 + x2) / 2 + perpX * offset;
        const controlY =
          (y1 + y2) / 2 + perpY * offset;
        pathD =
          `M ${x1} ${y1}` +
          ` Q ${controlX} ${controlY}` +
          ` ${x2} ${y2}`;
        midX =
          0.25 * x1 + 0.5 * controlX + 0.25 * x2;
        midY =
          0.25 * y1 + 0.5 * controlY + 0.25 * y2;
      }

      const current = edgeCurrents.get(edge.id);
      const hasNonZeroCurrent =
        current &&
        !(
          current.isNumeric() &&
          Math.abs(current.toNumber()) < 1e-10
        );

      const strokeColor =
        hasNonZeroCurrent && showCurrents
          ? "#DC2626"
          : "#4B5563";
      const strokeW =
        hasNonZeroCurrent && showCurrents ? "3" : "2";
      svg +=
        `<path d="${pathD}"` +
        ` stroke="${strokeColor}"` +
        ` stroke-width="${strokeW}" fill="none"/>`;

      const rVal = edge.resistance;
      const isNumericR =
        typeof rVal === "number" ||
        (typeof rVal === "string" &&
          /^-?[\d.]+$/.test(rVal));
      const resistanceText = isNumericR
        ? `${rVal}\u03A9`
        : String(rVal);
      svg +=
        `<text x="${midX}" y="${midY - 10}"` +
        ` fill="#1F2937" font-size="12"` +
        ` text-anchor="middle"` +
        ` font-family="Arial, sans-serif">` +
        `${resistanceText}</text>`;

      if (showCurrents && current) {
        svg +=
          `<text x="${midX}" y="${midY + 20}"` +
          ` fill="#DC2626" font-size="11"` +
          ` font-weight="bold"` +
          ` text-anchor="middle"` +
          ` font-family="Arial, sans-serif">` +
          `I = ${current.toDisplayString("A")}</text>`;
      }
    });

    circuit.nodes.forEach((node) => {
      const x = node.x - minX + padding;
      const y = node.y - minY + padding;
      svg +=
        `<circle cx="${x}" cy="${y}" r="16"` +
        ` fill="#3B82F6"/>`;
      svg +=
        `<text x="${x}" y="${y + 5}" fill="white"` +
        ` font-size="12" font-weight="bold"` +
        ` text-anchor="middle"` +
        ` font-family="Arial, sans-serif">` +
        `${node.label}</text>`;
    });

    svg += "</svg>";
    return svg;
  };

  const handleExportSVG = () => {
    const svgData = generateSVG();
    const blob = new Blob([svgData], {
      type: "image/svg+xml",
    });
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
    const blob = new Blob([svgData], {
      type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = "white";
      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
      ctx.drawImage(img, 0, 0);
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

  // Cursor for canvas
  const canvasCursor = isPanning
    ? "grabbing"
    : spaceHeldRef.current
      ? "grab"
      : mode === "add-node"
        ? "crosshair"
        : mode === "select"
          ? draggedNode
            ? "grabbing"
            : "default"
          : "pointer";

  // SVG transform string for the viewport
  const svgTransform =
    `scale(${zoom})` +
    ` translate(${-viewOffset.x}, ${-viewOffset.y})`;

  const edgesClickable =
    mode === "delete" || mode === "select";

  const hint =
    mode === "add-node"
      ? "Click the canvas to place a node"
      : mode === "add-edge"
        ? selectedNodes.length === 1
          ? "Pick the second node"
          : "Pick two nodes to connect them"
        : mode === "delete"
          ? "Click a node or edge to delete it"
          : mode === "calculate-resistance"
            ? calculationNodes.length === 1
              ? "Pick the second node"
              : calculationNodes.length === 2
                ? "Pick another node to start a new pair"
                : "Pick two nodes to measure Req"
            : selectedNodes.length > 0 ||
                selectedEdges.length > 0
              ? `Selected: ${selectedNodes.length} node` +
                `${selectedNodes.length !== 1 ? "s" : ""}` +
                `, ${selectedEdges.length} edge` +
                `${selectedEdges.length !== 1 ? "s" : ""}`
              : "Drag nodes to move \u00B7 Space+drag to pan";

  const tools: {
    id: typeof mode;
    label: React.ReactNode;
    key: string;
  }[] = [
    { id: "select", label: "Select", key: "select" },
    { id: "add-node", label: "Node", key: "node" },
    { id: "add-edge", label: "Resistor", key: "edge" },
    { id: "delete", label: "Delete", key: "delete" },
  ];

  const selectTool = (id: typeof mode) => {
    setMode(id);
    if (id === "add-edge") setSelectedNodes([]);
    if (id === "calculate-resistance") {
      setCalculationNodes([]);
    }
  };

  const isEmpty =
    circuit.nodes.length === 0 &&
    circuit.edges.length === 0;

  return (
    <div className="oh-app" data-mode={mode}>
      {/* Infinite canvas */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        className="oh-canvas"
        style={{ cursor: canvasCursor }}
      >
        {/* Grid background: each look shows dots,
            lines, or nothing */}
        <svg className="oh-grid" aria-hidden="true">
          <defs>
            <pattern
              id="ohGrid"
              width={20 * zoom}
              height={20 * zoom}
              patternUnits="userSpaceOnUse"
              x={(-viewOffset.x % 20) * zoom}
              y={(-viewOffset.y % 20) * zoom}
            >
              <path
                className="oh-grid-line"
                d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`}
                fill="none"
              />
              <circle
                className="oh-grid-dot"
                cx={1}
                cy={1}
                r={1}
              />
            </pattern>
            <pattern
              id="ohGridMajor"
              width={100 * zoom}
              height={100 * zoom}
              patternUnits="userSpaceOnUse"
              x={(-viewOffset.x % 100) * zoom}
              y={(-viewOffset.y % 100) * zoom}
            >
              <path
                className="oh-grid-major"
                d={
                  `M ${100 * zoom} 0 L 0 0` +
                  ` 0 ${100 * zoom}`
                }
                fill="none"
              />
            </pattern>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="url(#ohGrid)"
          />
          <rect
            width="100%"
            height="100%"
            fill="url(#ohGridMajor)"
          />
        </svg>

        {/* Edges (SVG layer) */}
        <svg className="oh-wires">
          <g transform={svgTransform}>
            {circuit.edges.map((edge) => {
              const nodeA = getNodeById(edge.nodeA);
              const nodeB = getNodeById(edge.nodeB);
              if (!nodeA || !nodeB) return null;

              const parallelEdges =
                circuit.edges.filter(
                  (e) =>
                    (e.nodeA === edge.nodeA &&
                      e.nodeB === edge.nodeB) ||
                    (e.nodeA === edge.nodeB &&
                      e.nodeB === edge.nodeA)
                );
              const edgeIndex =
                parallelEdges.findIndex(
                  (e) => e.id === edge.id
                );
              const totalParallelEdges =
                parallelEdges.length;

              let pathD: string;
              let midX: number;
              let midY: number;

              if (totalParallelEdges === 1) {
                pathD =
                  `M ${nodeA.x} ${nodeA.y}` +
                  ` L ${nodeB.x} ${nodeB.y}`;
                midX = (nodeA.x + nodeB.x) / 2;
                midY = (nodeA.y + nodeB.y) / 2;
              } else {
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const length = Math.sqrt(
                  dx * dx + dy * dy
                );
                const perpX = -dy / length;
                const perpY = dx / length;
                const maxOff = 40;
                const offStep =
                  maxOff /
                  Math.max(
                    1,
                    Math.floor(
                      totalParallelEdges / 2
                    )
                  );

                let offset: number;
                if (totalParallelEdges === 2) {
                  offset =
                    edgeIndex === 0
                      ? -offStep
                      : offStep;
                } else {
                  const mi = Math.floor(
                    totalParallelEdges / 2
                  );
                  offset =
                    (edgeIndex - mi) * offStep;
                }

                const ctrlX =
                  (nodeA.x + nodeB.x) / 2 +
                  perpX * offset;
                const ctrlY =
                  (nodeA.y + nodeB.y) / 2 +
                  perpY * offset;

                pathD =
                  `M ${nodeA.x} ${nodeA.y}` +
                  ` Q ${ctrlX} ${ctrlY}` +
                  ` ${nodeB.x} ${nodeB.y}`;
                midX =
                  0.25 * nodeA.x +
                  0.5 * ctrlX +
                  0.25 * nodeB.x;
                midY =
                  0.25 * nodeA.y +
                  0.5 * ctrlY +
                  0.25 * nodeB.y;
              }

              const current = edgeCurrents.get(
                edge.id
              );
              const hasNonZeroCurrent =
                current &&
                !(
                  current.isNumeric() &&
                  Math.abs(current.toNumber()) <
                    1e-10
                );
              const isSelected = selectedEdges.includes(
                edge.id
              );
              const isLive =
                !!hasNonZeroCurrent && showCurrents;
              // Flow direction for looks that animate
              // current (path runs nodeA -> nodeB)
              const isReverse =
                isLive &&
                current!.isNumeric() &&
                current!.toNumber() < 0;

              return (
                <g
                  key={edge.id}
                  className={
                    "oh-edge" +
                    (isSelected ? " is-selected" : "") +
                    (isLive ? " is-live" : "") +
                    (isReverse ? " is-reverse" : "")
                  }
                >
                  {/* Invisible thick path for clicking */}
                  <path
                    d={pathD}
                    className="oh-edge-hit"
                    stroke="transparent"
                    strokeWidth={20 / zoom}
                    fill="none"
                    style={{
                      pointerEvents: edgesClickable
                        ? "auto"
                        : "none",
                    }}
                    onClick={(e) =>
                      handleEdgeClick(edge.id, e)
                    }
                  />
                  {/* Visible path */}
                  <path
                    d={pathD}
                    className="oh-edge-line"
                    fill="none"
                  />
                  {/* Resistance label */}
                  <text
                    x={midX}
                    y={midY - 10}
                    textAnchor="middle"
                    className="oh-edge-label"
                    onClick={(e) =>
                      handleEdgeClick(edge.id, e)
                    }
                  >
                    {typeof edge.resistance ===
                      "number" ||
                    (typeof edge.resistance ===
                      "string" &&
                      /^-?[\d.]+$/.test(
                        edge.resistance
                      ))
                      ? `${edge.resistance}\u03A9`
                      : edge.resistance}
                  </text>
                  {/* Current label */}
                  {showCurrents && current && (
                    <text
                      x={midX}
                      y={midY + 20}
                      textAnchor="middle"
                      className="oh-edge-current"
                    >
                      I ={" "}
                      {current.toDisplayString("A")}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Nodes (HTML layer with transform) */}
        <div
          style={{
            transform:
              `scale(${zoom})` +
              ` translate(${-viewOffset.x}px,` +
              ` ${-viewOffset.y}px)`,
            transformOrigin: "0 0",
          }}
          className="oh-nodes"
        >
          {circuit.nodes.map((node) => {
            const isSelected = selectedNodes.includes(
              node.id
            );
            const isCalcNode =
              calculationNodes.includes(node.id);
            const isDragging =
              draggedNode === node.id;
            const hasPotential =
              node.potential !== undefined &&
              node.potential !== "";

            return (
              <div
                key={node.id}
                onMouseDown={(e) =>
                  handleNodeMouseDown(node.id, e)
                }
                onClick={(e) =>
                  handleNodeClick(node.id, e)
                }
                className={
                  "oh-node" +
                  (isSelected ? " is-selected" : "") +
                  (isCalcNode ? " is-calc" : "") +
                  (hasPotential ? " is-source" : "")
                }
                style={{
                  left: node.x,
                  top: node.y,
                  cursor:
                    mode === "select"
                      ? isDragging
                        ? "grabbing"
                        : "move"
                      : "pointer",
                }}
              >
                <span className="oh-node-label">
                  {node.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top bar */}
      <header className="oh-top">
        <div className="oh-brand">
          <span className="oh-brand-name">Ohmline</span>
          <small className="oh-brand-tag">
            circuit designer
          </small>
        </div>
        <div className="oh-history">
          <button
            type="button"
            className="oh-btn"
            onClick={undo}
            disabled={historyIndex === 0}
            title="Undo (Ctrl/Cmd+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            className="oh-btn"
            onClick={redo}
            disabled={
              historyIndex >= history.length - 1
            }
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            Redo
          </button>
        </div>
        <UiSwitch />
      </header>

      {/* Tool palette — left */}
      <aside className="oh-tools" aria-label="Tools">
        <section className="oh-group">
          <h2 className="oh-group-title">Draw</h2>
          {tools.map((t) => (
            <button
              key={t.key}
              type="button"
              className="oh-tool"
              data-tool={t.key}
              aria-pressed={mode === t.id}
              onClick={() => selectTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </section>
        <section className="oh-group">
          <h2 className="oh-group-title">Analyze</h2>
          <button
            type="button"
            className="oh-tool"
            data-tool="measure"
            aria-pressed={
              mode === "calculate-resistance"
            }
            onClick={() =>
              selectTool("calculate-resistance")
            }
          >
            <span>
              Measure R<sub>eq</sub>
            </span>
          </button>
          <button
            type="button"
            className="oh-tool"
            data-tool="currents"
            aria-pressed={showCurrents}
            onClick={() =>
              setShowCurrents(!showCurrents)
            }
          >
            Currents
          </button>
          <button
            type="button"
            className="oh-btn"
            onClick={handleAutoLayout}
            disabled={circuit.nodes.length === 0}
          >
            Auto-layout
          </button>
        </section>
        <section className="oh-group">
          <h2 className="oh-group-title">File</h2>
          <button
            type="button"
            className="oh-btn"
            onClick={handleSaveCircuit}
            disabled={isEmpty}
            title="Save circuit to JSON file"
          >
            Save
          </button>
          <button
            type="button"
            className="oh-btn"
            onClick={handleLoadCircuit}
            title="Load circuit from JSON file"
          >
            Load
          </button>
          <button
            type="button"
            className="oh-btn"
            onClick={handleExportSVG}
            disabled={circuit.nodes.length === 0}
            title="Export circuit as SVG image"
          >
            Export SVG
          </button>
          <button
            type="button"
            className="oh-btn"
            onClick={handleExportPNG}
            disabled={circuit.nodes.length === 0}
            title="Export circuit as PNG image"
          >
            Export PNG
          </button>
        </section>
      </aside>

      {/* Inspector — right */}
      {(circuit.nodes.length > 0 ||
        equivalentResistance !== null) && (
        <aside
          className="oh-inspector"
          aria-label="Inspector"
        >
          {equivalentResistance !== null && (
            <section className="oh-card oh-result">
              <h2 className="oh-card-title">
                Equivalent resistance
              </h2>
              <p className="oh-result-between">
                between{" "}
                <b>
                  {getNodeById(calculationNodes[0])?.label}
                </b>
                {" and "}
                <b>
                  {getNodeById(calculationNodes[1])?.label}
                </b>
              </p>
              <p className="oh-result-value">
                <span className="oh-result-symbol">
                  R<sub>eq</sub> ={" "}
                </span>
                {breakable(
                  equivalentResistance.toDisplayString(
                    "\u03A9"
                  )
                )}
              </p>
              <button
                type="button"
                className="oh-btn oh-btn-small"
                onClick={() => setCalculationNodes([])}
              >
                Clear
              </button>
            </section>
          )}

          {circuit.nodes.length > 0 && (
            <section className="oh-card">
              <h2 className="oh-card-title">Nodes</h2>
              <div className="oh-rows">
                {circuit.nodes.map((node) => (
                  <div key={node.id} className="oh-row">
                    <input
                      type="text"
                      aria-label="Node label"
                      value={node.label}
                      onChange={(e) =>
                        updateNodeLabel(
                          node.id,
                          e.target.value
                        )
                      }
                      className="oh-input oh-input-label"
                    />
                    <span className="oh-row-sym">V =</span>
                    <input
                      type="text"
                      aria-label={
                        `Potential of ${node.label}`
                      }
                      value={node.potential ?? ""}
                      onChange={(e) =>
                        updateNodePotential(
                          node.id,
                          e.target.value
                        )
                      }
                      className="oh-input"
                      placeholder="free"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {circuit.edges.length > 0 && (
            <section className="oh-card">
              <h2 className="oh-card-title">Resistors</h2>
              <div className="oh-rows">
                {circuit.edges.map((edge) => {
                  const nA = getNodeById(edge.nodeA);
                  const nB = getNodeById(edge.nodeB);
                  return (
                    <div
                      key={edge.id}
                      className={
                        "oh-row" +
                        (selectedEdges.includes(edge.id)
                          ? " is-selected"
                          : "")
                      }
                    >
                      <span className="oh-row-name">
                        {nA?.label}
                        <span className="oh-row-dash">
                          {"\u2013"}
                        </span>
                        {nB?.label}
                      </span>
                      <input
                        type="text"
                        aria-label={
                          `Resistance ${nA?.label}` +
                          `\u2013${nB?.label}`
                        }
                        value={edge.resistance}
                        onChange={(e) =>
                          updateResistance(
                            edge.id,
                            e.target.value
                          )
                        }
                        onBlur={(e) =>
                          commitResistance(
                            edge.id,
                            e.target.value
                          )
                        }
                        className="oh-input"
                        placeholder="R"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      )}

      {/* Status line */}
      <footer className="oh-status">
        <span className="oh-hint">{hint}</span>
        <span className="oh-count">
          {circuit.nodes.length} node
          {circuit.nodes.length !== 1 ? "s" : ""}
          {" \u00B7 "}
          {circuit.edges.length} resistor
          {circuit.edges.length !== 1 ? "s" : ""}
        </span>
      </footer>
    </div>
  );
}

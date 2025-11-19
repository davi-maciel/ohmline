import type { Circuit, Node } from "@/types/circuit";

interface Vector2D {
  x: number;
  y: number;
}

interface LayoutConfig {
  width: number;
  height: number;
  iterations: number;
  repulsionStrength: number;
  attractionStrength: number;
  centeringStrength: number;
  damping: number;
  minDistance: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  width: 800,
  height: 600,
  iterations: 100,
  repulsionStrength: 5000,
  attractionStrength: 0.01,
  centeringStrength: 0.001,
  damping: 0.9,
  minDistance: 50,
};

/**
 * Force-directed graph layout algorithm
 * Uses a simplified version of the Fruchterman-Reingold algorithm
 */
export function applyForceDirectedLayout(
  circuit: Circuit,
  config: Partial<LayoutConfig> = {}
): Circuit {
  const conf = { ...DEFAULT_CONFIG, ...config };

  if (circuit.nodes.length === 0) {
    return circuit;
  }

  // Initialize positions if nodes don't have them or are at the same position
  const nodes = initializePositions(circuit.nodes, conf.width, conf.height);

  // Create a map of node velocities
  const velocities = new Map<string, Vector2D>();
  nodes.forEach(node => {
    velocities.set(node.id, { x: 0, y: 0 });
  });

  // Build adjacency list for connected nodes
  const adjacency = new Map<string, Set<string>>();
  circuit.nodes.forEach(node => {
    adjacency.set(node.id, new Set());
  });

  circuit.edges.forEach(edge => {
    adjacency.get(edge.nodeA)?.add(edge.nodeB);
    adjacency.get(edge.nodeB)?.add(edge.nodeA);
  });

  // Simulation loop
  for (let iteration = 0; iteration < conf.iterations; iteration++) {
    const forces = new Map<string, Vector2D>();

    // Initialize forces
    nodes.forEach(node => {
      forces.set(node.id, { x: 0, y: 0 });
    });

    // Calculate repulsive forces (all pairs)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        if (dist < 0.1) continue; // Avoid division by zero

        // Repulsive force (Coulomb's law)
        const force = conf.repulsionStrength / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const forceA = forces.get(nodeA.id)!;
        const forceB = forces.get(nodeB.id)!;

        forceA.x -= fx;
        forceA.y -= fy;
        forceB.x += fx;
        forceB.y += fy;
      }
    }

    // Calculate attractive forces (connected nodes)
    circuit.edges.forEach(edge => {
      const nodeA = nodes.find(n => n.id === edge.nodeA);
      const nodeB = nodes.find(n => n.id === edge.nodeB);

      if (!nodeA || !nodeB) return;

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.1) return;

      // Attractive force (Hooke's law)
      const force = conf.attractionStrength * dist;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      const forceA = forces.get(nodeA.id)!;
      const forceB = forces.get(nodeB.id)!;

      forceA.x += fx;
      forceA.y += fy;
      forceB.x -= fx;
      forceB.y -= fy;
    });

    // Apply centering force
    const centerX = conf.width / 2;
    const centerY = conf.height / 2;

    nodes.forEach(node => {
      const force = forces.get(node.id)!;
      force.x += (centerX - node.x) * conf.centeringStrength;
      force.y += (centerY - node.y) * conf.centeringStrength;
    });

    // Update velocities and positions
    nodes.forEach(node => {
      const force = forces.get(node.id)!;
      const velocity = velocities.get(node.id)!;

      // Update velocity
      velocity.x = (velocity.x + force.x) * conf.damping;
      velocity.y = (velocity.y + force.y) * conf.damping;

      // Update position
      node.x += velocity.x;
      node.y += velocity.y;

      // Keep nodes within bounds with padding
      const padding = 50;
      node.x = Math.max(padding, Math.min(conf.width - padding, node.x));
      node.y = Math.max(padding, Math.min(conf.height - padding, node.y));
    });
  }

  return {
    ...circuit,
    nodes: nodes,
  };
}

/**
 * Initialize node positions if they don't exist or are clustered
 */
function initializePositions(nodes: Node[], width: number, height: number): Node[] {
  // Check if nodes need initialization
  const needsInit = nodes.some((node, i) => {
    // Check if position is invalid or if multiple nodes are at the same position
    return nodes.some((other, j) =>
      i !== j && Math.abs(node.x - other.x) < 1 && Math.abs(node.y - other.y) < 1
    );
  });

  if (!needsInit && nodes.every(n => n.x > 0 && n.y > 0 && n.x < width && n.y < height)) {
    return [...nodes];
  }

  // Initialize in a circle for better starting positions
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.3;

  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
}

/**
 * Apply a simpler grid-based layout
 */
export function applyGridLayout(circuit: Circuit, config: Partial<LayoutConfig> = {}): Circuit {
  const conf = { ...DEFAULT_CONFIG, ...config };

  if (circuit.nodes.length === 0) {
    return circuit;
  }

  // Calculate grid dimensions
  const cols = Math.ceil(Math.sqrt(circuit.nodes.length));
  const rows = Math.ceil(circuit.nodes.length / cols);

  const cellWidth = (conf.width - 100) / cols;
  const cellHeight = (conf.height - 100) / rows;

  const nodes = circuit.nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    return {
      ...node,
      x: 50 + col * cellWidth + cellWidth / 2,
      y: 50 + row * cellHeight + cellHeight / 2,
    };
  });

  return {
    ...circuit,
    nodes: nodes,
  };
}

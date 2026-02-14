import type { Circuit, Node } from "@/types/circuit";

/**
 * Force-directed graph layout algorithm for automatic node positioning
 * Uses a physics simulation with:
 * - Repulsive forces between all nodes
 * - Attractive forces along edges (spring forces)
 * - Damping to stabilize the layout
 */

interface Force {
  x: number;
  y: number;
}

interface NodeWithVelocity extends Node {
  vx: number;
  vy: number;
}

interface LayoutOptions {
  width: number;
  height: number;
  iterations?: number;
  springLength?: number;
  springStrength?: number;
  repulsionStrength?: number;
  damping?: number;
  centeringStrength?: number;
}

const DEFAULT_OPTIONS = {
  iterations: 100,
  springLength: 100, // Desired edge length
  springStrength: 0.1, // How strongly edges pull nodes together
  repulsionStrength: 5000, // How strongly nodes push each other apart
  damping: 0.8, // Velocity damping (0-1, higher = more damping)
  centeringStrength: 0.01, // How strongly to pull nodes toward center
};

/**
 * Apply force-directed layout to circuit nodes
 */
export function applyForceDirectedLayout(
  circuit: Circuit,
  options: LayoutOptions
): Node[] {
  if (circuit.nodes.length === 0) return [];
  if (circuit.nodes.length === 1) {
    // Single node - center it
    return [
      {
        ...circuit.nodes[0],
        x: options.width / 2,
        y: options.height / 2,
      },
    ];
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Initialize nodes with velocities
  const nodes: NodeWithVelocity[] = circuit.nodes.map((node) => ({
    ...node,
    vx: 0,
    vy: 0,
  }));

  // Create adjacency map for quick edge lookup
  const adjacency = new Map<string, Set<string>>();
  circuit.edges.forEach((edge) => {
    if (!adjacency.has(edge.nodeA)) adjacency.set(edge.nodeA, new Set());
    if (!adjacency.has(edge.nodeB)) adjacency.set(edge.nodeB, new Set());
    adjacency.get(edge.nodeA)!.add(edge.nodeB);
    adjacency.get(edge.nodeB)!.add(edge.nodeA);
  });

  // Run simulation
  for (let iter = 0; iter < opts.iterations; iter++) {
    const forces = new Map<string, Force>();

    // Initialize forces
    nodes.forEach((node) => {
      forces.set(node.id, { x: 0, y: 0 });
    });

    // Apply repulsive forces between all pairs of nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distanceSquared = dx * dx + dy * dy;
        const distance = Math.sqrt(distanceSquared);

        if (distance < 1) continue; // Avoid division by zero

        // Repulsive force (inversely proportional to distance)
        const repulsionForce = opts.repulsionStrength / distanceSquared;
        const fx = (dx / distance) * repulsionForce;
        const fy = (dy / distance) * repulsionForce;

        const forceA = forces.get(nodeA.id)!;
        const forceB = forces.get(nodeB.id)!;

        forceA.x -= fx;
        forceA.y -= fy;
        forceB.x += fx;
        forceB.y += fy;
      }
    }

    // Apply attractive forces along edges (Hooke's law)
    circuit.edges.forEach((edge) => {
      const nodeA = nodes.find((n) => n.id === edge.nodeA);
      const nodeB = nodes.find((n) => n.id === edge.nodeB);

      if (!nodeA || !nodeB) return;

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 1) return;

      // Spring force proportional to displacement from rest length
      const displacement = distance - opts.springLength;
      const springForce = displacement * opts.springStrength;
      const fx = (dx / distance) * springForce;
      const fy = (dy / distance) * springForce;

      const forceA = forces.get(nodeA.id)!;
      const forceB = forces.get(nodeB.id)!;

      forceA.x += fx;
      forceA.y += fy;
      forceB.x -= fx;
      forceB.y -= fy;
    });

    // Apply centering force to keep graph centered in canvas
    const centerX = options.width / 2;
    const centerY = options.height / 2;

    nodes.forEach((node) => {
      const force = forces.get(node.id)!;
      force.x += (centerX - node.x) * opts.centeringStrength;
      force.y += (centerY - node.y) * opts.centeringStrength;
    });

    // Update velocities and positions
    nodes.forEach((node) => {
      const force = forces.get(node.id)!;

      // Update velocity
      node.vx = (node.vx + force.x) * opts.damping;
      node.vy = (node.vy + force.y) * opts.damping;

      // Update position
      node.x += node.vx;
      node.y += node.vy;

      // Keep nodes within bounds with padding
      const padding = 50;
      node.x = Math.max(padding, Math.min(options.width - padding, node.x));
      node.y = Math.max(padding, Math.min(options.height - padding, node.y));
    });
  }

  // Return nodes without velocity properties
  return nodes.map(({ vx, vy, ...node }) => node);
}

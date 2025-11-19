export interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
  potential?: number | string; // Can be a number or a variable like 'V'
}

export interface Edge {
  id: string;
  nodeA: string; // Node ID
  nodeB: string; // Node ID
  resistance: number | string; // Can be a number, 'Infinity', or a variable like 'r'
}

export interface Circuit {
  nodes: Node[];
  edges: Edge[];
}

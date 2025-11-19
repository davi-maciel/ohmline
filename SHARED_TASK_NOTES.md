# Shared Task Notes

## What's Been Done
- Next.js project set up with TypeScript and Tailwind CSS
- Basic circuit canvas component implemented with:
  - Add nodes by clicking on canvas
  - Connect nodes with edges (resistances)
  - Edit resistance values (supports numbers, variables like 'r', and 'Infinity')
  - Visual rendering of nodes and edges with labels
  - UI modes: select, add-node, add-edge

## Next Priorities

### 1. Equivalent Resistance Calculator (High Priority)
Implement the core physics calculation to compute equivalent resistance between two selected nodes.
- Create `lib/circuitCalculator.ts` with algorithms to:
  - Parse resistance values (numbers, variables, Infinity)
  - Detect series and parallel resistances
  - Simplify circuits using Kirchhoff's laws
  - Handle symbolic math (e.g., r + 2r = 3r, r || r = r/2)
- Add UI to select two nodes and display calculated equivalent resistance
- Consider using a graph algorithm (BFS/DFS) to find all paths between nodes

### 2. Node Redistribution/Auto-Layout (Medium Priority)
Add a button to automatically reorganize nodes for better visualization.
- Consider using force-directed graph layout algorithms
- Libraries to explore: d3-force, cytoscape.js, or custom implementation

### 3. Electric Potential & Current Calculation (Medium Priority)
- Add input fields to set potential (voltage) at each node
- Calculate current flow through the circuit using Ohm's law (I = V/R)
- Display current values on edges

### 4. Enhanced Features (Lower Priority)
- Delete nodes/edges functionality
- Drag nodes to reposition them
- Undo/redo functionality
- Save/load circuit designs
- Export circuit as image or data

## Technical Notes
- Circuit state is managed in `components/CircuitCanvas.tsx` using React hooks
- Types defined in `types/circuit.ts`
- Resistance values support: numbers (including negative/zero), variables (strings), and 'Infinity'

## To Run
```bash
npm run dev  # Development server at localhost:3000
npm run build  # Production build
```

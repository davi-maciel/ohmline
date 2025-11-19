# Shared Task Notes

## What's Been Done
- Next.js project set up with TypeScript and Tailwind CSS
- Basic circuit canvas component implemented with:
  - Add nodes by clicking on canvas
  - Connect nodes with edges (resistances)
  - Edit resistance values (supports numbers, variables like 'r', and 'Infinity')
  - Visual rendering of nodes and edges with labels
  - UI modes: select, add-node, add-edge, calculate-resistance
- **Equivalent Resistance Calculator (COMPLETED)**:
  - `lib/circuitCalculator.ts` with SymbolicResistance class for symbolic math
  - Handles numeric, symbolic (variables), and infinity values
  - Graph-based algorithm finds all paths between nodes
  - Combines series (addition) and parallel resistances correctly
  - UI mode to select two nodes and display R_eq
  - Tests confirm: series, parallel, symbolic, mixed, infinity, and disconnected cases work
- **Node Auto-Layout (COMPLETED)**:
  - Force-directed graph layout algorithm in `lib/graphLayout.ts`
  - Physics simulation with repulsive forces (nodes push apart) and attractive forces (edges pull nodes together)
  - Green "Auto-Layout" button in toolbar
  - Automatically redistributes nodes for better visualization while preserving circuit topology
  - Keeps nodes within canvas bounds
  - Tests confirm: single node centering, spreading nodes, series/parallel circuits work correctly

## Next Priorities

### 1. Electric Potential & Current Calculation (High Priority)
- Add input fields to set potential (voltage) at each node
- Calculate current flow through the circuit using Ohm's law and Kirchhoff's laws
- Display current values on edges
- Handle symbolic voltages (like variables in resistances)

### 2. Enhanced Features (Medium Priority)
- Delete nodes/edges functionality
- Drag nodes to reposition them
- Undo/redo functionality
- Save/load circuit designs
- Export circuit as image or data

## Technical Notes
- Circuit state is managed in `components/CircuitCanvas.tsx` using React hooks
- Types defined in `types/circuit.ts`
- Resistance values support: numbers (including negative/zero), variables (strings), and 'Infinity'
- Layout algorithm uses: spring forces for edges, repulsion for nodes, damping for stability, centering force

## To Run
```bash
npm run dev  # Development server at localhost:3000
npm run build  # Production build
```

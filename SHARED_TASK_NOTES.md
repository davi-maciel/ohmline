# Shared Task Notes

## What's Been Done
- Next.js project set up with TypeScript and Tailwind CSS
- Basic circuit canvas component with:
  - Add nodes by clicking on canvas
  - Connect nodes with edges (resistances)
  - Edit resistance values (supports numbers, variables like 'r', and 'Infinity')
  - Visual rendering of nodes and edges with labels
  - UI modes: select, add-node, add-edge, calculate-resistance, delete
  - **Delete nodes/edges functionality (COMPLETED)**:
    - Delete mode in toolbar (red button)
    - Click on nodes to delete them (also removes connected edges)
    - Click on edges to delete them (invisible thick line for easier clicking)
    - Helper text when in delete mode
- **Equivalent Resistance Calculator (COMPLETED)**
- **Node Auto-Layout (COMPLETED)**
- **Electric Potential & Current Calculation (COMPLETED)**

## Next Priorities

### 1. Enhanced Circuit Editing (High Priority)
- Drag nodes to reposition them manually
- Select multiple nodes/edges
- Keyboard shortcuts (e.g., Delete key to delete selected items)

### 2. Additional Features (Medium Priority)
- Undo/redo functionality
- Save/load circuit designs (JSON export/import)
- Export circuit as image (PNG/SVG)

## Technical Notes
- Circuit state in `components/CircuitCanvas.tsx` using React hooks
- Types in `types/circuit.ts` (Node has optional `potential` field)
- Resistance/voltage values: numbers, variables (strings), 'Infinity'
- Current calculation uses Ohm's law (simple case); full nodal analysis not yet implemented
- Currents recalculated automatically when circuit changes (useMemo hook)

## To Run
```bash
npm run dev  # Development server at localhost:3000
npm run build  # Production build
npx tsx lib/*.test.ts  # Run tests
```

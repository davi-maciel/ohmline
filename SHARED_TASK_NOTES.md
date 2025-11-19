# Shared Task Notes

## What's Been Done
- Next.js project set up with TypeScript and Tailwind CSS
- Basic circuit canvas component with:
  - Add nodes by clicking on canvas
  - Connect nodes with edges (resistances)
  - Edit resistance values (supports numbers, variables like 'r', and 'Infinity')
  - Visual rendering of nodes and edges with labels
  - UI modes: select, add-node, add-edge, calculate-resistance, delete
  - Delete nodes/edges functionality
  - Drag-to-reposition nodes (in select mode)
  - Multi-select nodes/edges:
    - Click items in select mode to select
    - Ctrl/Cmd+click to multi-select
    - Selected items highlighted (nodes: green ring, edges: green dashed)
  - Keyboard shortcuts:
    - Delete/Backspace: Delete selected items
    - Escape: Clear selections
    - Ctrl/Cmd+Z: Undo
    - Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y): Redo
  - **Undo/Redo functionality (COMPLETED)**:
    - History stack with 50-state limit
    - Undo/Redo buttons in toolbar
    - Keyboard shortcuts (Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y for redo)
    - Works with all circuit operations (add/delete/move nodes, add/delete edges, edit properties)
- Equivalent Resistance Calculator
- Node Auto-Layout (force-directed graph)
- Electric Potential & Current Calculation

## Next Priorities

### 1. Additional Features (Medium Priority)
- Save/load circuit designs (JSON export/import)
- Export circuit as image (PNG/SVG)

### 2. Enhanced UX (Low Priority)
- Box/lasso selection (drag to select multiple items)
- Copy/paste circuits

## Technical Notes
- Circuit state in `components/CircuitCanvas.tsx` using React hooks
- Types in `types/circuit.ts` (Node has optional `potential` field)
- Resistance/voltage values: numbers, variables (strings), 'Infinity'
- Multi-select: `selectedNodes` and `selectedEdges` state arrays
- Keyboard shortcuts implemented via useEffect with window event listener

## To Run
```bash
npm run dev  # Development server at localhost:3000
npm run build  # Production build
npx tsx lib/*.test.ts  # Run tests
```

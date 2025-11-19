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
  - Undo/Redo functionality:
    - History stack with 50-state limit
    - Undo/Redo buttons in toolbar
    - Keyboard shortcuts (Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y for redo)
    - Works with all circuit operations (add/delete/move nodes, add/delete edges, edit properties)
  - Save/Load functionality:
    - Save circuit to JSON file (filename: circuit-YYYY-MM-DD.json)
    - Load circuit from JSON file
    - Validates loaded circuit structure
    - Clears all selections when loading
  - Export circuit as image:
    - Export as SVG (vector format, scales without quality loss)
    - Export as PNG (raster format)
    - Exports include all nodes, edges, resistance values, and current labels
    - Auto-calculates bounds with padding
    - Disabled when circuit is empty
  - Parallel edge rendering:
    - Multiple edges between same nodes are rendered with curved paths
    - Edges automatically spread out to avoid overlap
    - Works in both canvas and export views
    - Debounced edge addition to prevent accidental duplicates
- Equivalent Resistance Calculator
- Node Auto-Layout (force-directed graph)
- Electric Potential & Current Calculation

## Recent Fixes (2025-11-19 - Iteration 4)
- Fixed edge duplication bug where adding an edge would sometimes create two edges
  - Simplified `addEdge` function (removed complex guards)
  - Added deduplication check in `handleNodeClick` when adding edges
  - Uses 100ms time window to prevent event bubbling duplicates
  - Allows intentional parallel edges (users can add multiple edges between same nodes)
- Parallel edge rendering confirmed working:
  - Multiple edges between same nodes rendered with curved paths
  - Edges automatically spread out to avoid overlap
  - Calculates correct equivalent resistance for parallel edges

## Next Priorities

### 1. Enhanced UX (Low Priority)
- Box/lasso selection (drag to select multiple items)
- Copy/paste circuits

## Technical Notes
- Circuit state in `components/CircuitCanvas.tsx` using React hooks
- Types in `types/circuit.ts` (Node has optional `potential` field)
- Resistance/voltage values: numbers, variables (strings), 'Infinity'
- Multi-select: `selectedNodes` and `selectedEdges` state arrays
- Keyboard shortcuts implemented via useEffect with window event listener
- Edge deduplication:
  - `lastEdgeAddRef` tracks the last edge added with timestamp
  - 100ms time window prevents event bubbling from creating duplicates
  - Located in `handleNodeClick` function in add-edge mode

## To Run
```bash
npm run dev  # Development server at localhost:3000
npm run build  # Production build
npx tsx lib/*.test.ts  # Run tests
```

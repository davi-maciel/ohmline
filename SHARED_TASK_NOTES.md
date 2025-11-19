# Shared Task Notes

## What's Been Done
- Next.js project set up with TypeScript and Tailwind CSS
- Basic circuit canvas component with:
  - Add nodes by clicking on canvas
  - Connect nodes with edges (resistances)
  - Edit resistance values (supports numbers, variables like 'r', and 'Infinity')
  - Visual rendering of nodes and edges with labels
  - UI modes: select, add-node, add-edge, calculate-resistance
- **Equivalent Resistance Calculator (COMPLETED)**
- **Node Auto-Layout (COMPLETED)**
- **Electric Potential & Current Calculation (COMPLETED)**:
  - Node properties panel with voltage input fields for each node
  - `lib/currentCalculator.ts` with SymbolicValue class for voltage/current expressions
  - Calculates current through each edge using Ohm's law: I = (V₁ - V₂) / R
  - Supports numeric voltages, symbolic variables (e.g., 'V'), and mixed expressions
  - Handles special cases: zero resistance (infinite current), infinite resistance (zero current)
  - Visual feedback: edges with current shown in red, thicker lines
  - Current values displayed on edges in red text
  - Toggle button to show/hide current display
  - Tests confirm: simple circuits, series, symbolic voltages/resistances, edge cases work correctly

## Next Priorities

### 1. Enhanced Circuit Editing (High Priority)
- Delete nodes/edges functionality
- Drag nodes to reposition them manually
- Select multiple nodes/edges

### 2. Additional Features (Medium Priority)
- Undo/redo functionality
- Save/load circuit designs (JSON export/import)
- Export circuit as image (PNG/SVG)
- Keyboard shortcuts

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

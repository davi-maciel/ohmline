# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

See @README.md.

## Features and Use Cases

This is what this project aims to build.

- The user can add nodes and edges to the canvas. Multiple edges can be added to a single node. It is possible to add multiple edges to the same pair of nodes (edges in parallel). Each edge is a resistance.
- The user can set the value of each resistance. The value can either be in ohms or it can also be a variable e.g. r.
- The system is able to compute the equivalent resistance between two connected nodes in the circuit. Variables are to be taken as variables, that is, two resistances of r each in series give a 2r equivalent resistance; an r resistance with a 10 ohm resistance give equivalent resistance of r + 10 ohms.
- The user can add nodes anywhere on the canvas, however, there is a button that prompts the system to redistributes the nodes in order to optimize visualization, without change the properties of the circuit.
- The value of the resistance is visible in their respective edge.
- Resistance values real numbers, that is, zero and negative resistance is possible.
- It is possible to represent infinite resistance.
- The user can set electric potentials in each node in order to ask for the electric current in the system.
- Circuit properties are computed based on the laws of physics applied to electric circuits.

## Build Commands

```bash
npm run dev    # Start development server at localhost:3000
npm run build  # Create production build
npm run start  # Run production server
npm run lint   # Run ESLint
```

## Testing

Tests are located in `lib/*.test.ts` and `lib/__tests__/*.test.ts`. Run individual test files with:

```bash
npx tsx lib/circuitCalculator.test.ts
npx tsx lib/currentCalculator.test.ts
npx tsx lib/__tests__/graphLayout.test.ts
npx tsx lib/symbolic/__tests__/Polynomial.test.ts
npx tsx lib/symbolic/__tests__/RationalExpr.test.ts
npx tsx lib/symbolic/__tests__/gaussianElimination.test.ts
```

## Architecture

### Core Data Model (`types/circuit.ts`)

The circuit is represented by two main types:

- **Node**: Has `id`, `x`, `y`, `label`, and optional `potential` (number or symbolic variable like 'V')
- **Edge**: Has `id`, `nodeA`, `nodeB`, and `resistance` (number, 'Infinity', or symbolic variable like 'r')
- **Circuit**: Container with `nodes[]` and `edges[]` arrays

### Circuit State Management (`components/CircuitCanvas.tsx`)

The main component manages all circuit state using React hooks:

- Circuit data stored in `circuit` state
- Multi-select support via `selectedNodes` and `selectedEdges` arrays
- Undo/Redo implemented with history stack (50-state limit) and `historyIndex`
- **Edge Deduplication**: `lastEdgeAddRef` tracks the last edge added with timestamp to prevent duplicate edges from event bubbling (500ms window)

### Symbolic Math System (`lib/symbolic/`)

A unified symbolic algebra library handles both numeric and symbolic values:

- **`Polynomial`**: Multivariate polynomial with `Map<monomialKey, coefficient>` representation. Supports add, subtract, multiply, scale, negate, parse.
- **`RationalExpr`**: Rational expression (Polynomial/Polynomial). Unified replacement for the former `SymbolicResistance` and `SymbolicValue` classes. Supports add, subtract, multiply, divide, reciprocal, negate, with automatic simplification.
- **`solveLinearSystem`**: Gaussian elimination with partial pivoting over `RationalExpr` entries. Works identically for numeric and symbolic systems.

**`lib/circuitCalculator.ts`** — Equivalent resistance via conductance matrix + nodal analysis:

- Union-Find merges zero-resistance edges, BFS checks connectivity
- Grounds node B, builds (N-1)x(N-1) conductance matrix Y using `RationalExpr`
- Injects 1A at node A, solves Y*V=I; R_eq = V[nodeA]
- Correctly handles non-series-parallel circuits (e.g., Wheatstone bridge)

**`lib/currentCalculator.ts`** — Edge currents via KCL nodal analysis:

- Separates boundary nodes (known potential) from interior nodes (unknown)
- Builds conductance matrix for interior nodes, solves for unknown potentials
- Computes edge currents as I = (V_A - V_B) / R
- Returns symbolic expressions when variables are present

### Graph Layout (`lib/graphLayout.ts`)

- Force-directed graph algorithm (Fruchterman-Reingold variant)
- Applies repulsion forces between nodes and attraction forces along edges
- Configurable parameters: iterations, strengths, damping, canvas dimensions
- Auto-positions nodes to optimize visualization while preserving circuit topology

### Important Implementation Details

1. **Parallel Edges**: Multiple edges between the same node pair are supported and rendered with curved paths that spread out to avoid overlap

2. **Edge Duplication Prevention**: Located in `handleNodeClick` function (~line 236) in add-edge mode:

   - Checks if the same edge was added within the last 500ms
   - Early return prevents event bubbling from creating duplicates
   - Users can still intentionally add parallel edges by waiting >500ms

3. **Resistance Values**: Accept numbers (including zero, negative, and Infinity), symbolic variables (e.g., "r"), and expressions (e.g., "2r+10")

4. **Equivalent Resistance Calculation**:

   - Uses conductance matrix + nodal analysis (not path enumeration)
   - Correctly handles any topology including Wheatstone bridges
   - Returns symbolic expressions when variables are present

5. **Current Calculation**:

   - Requires at least 2 boundary nodes with defined potentials
   - Solves for unknown interior node potentials via KCL nodal analysis
   - Returns symbolic results when circuit contains variable resistances or potentials

6. **Node Label Editing**: Labels are editable in the Node Properties panel

7. **File I/O**:

   - Save: Exports circuit as JSON (filename: `circuit-YYYY-MM-DD.json`)
   - Load: Validates structure and clears selections
   - Export: Supports SVG (vector) and PNG (raster) image formats with auto-calculated bounds

8. **Keyboard Shortcuts**:
   - Delete/Backspace: Delete selected items
   - Escape: Clear selections
   - Ctrl/Cmd+Z: Undo
   - Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y: Redo

## Code Style

- Maximum line length: 80 characters

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 18
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4
- **Runtime**: Node.js 20+

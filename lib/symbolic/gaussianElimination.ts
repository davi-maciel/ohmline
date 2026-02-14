import { RationalExpr } from "./RationalExpr";

/**
 * Solve a linear system A * x = b using Gaussian
 * elimination with partial pivoting, where all
 * entries are RationalExpr (symbolic rationals).
 *
 * @param A  NxN coefficient matrix
 * @param b  N-element right-hand-side vector
 * @returns  solution vector x, or null if singular
 */
export function solveLinearSystem(
  A: RationalExpr[][],
  b: RationalExpr[]
): RationalExpr[] | null {
  const n = b.length;
  if (n === 0) return [];

  // Build augmented matrix [A | b]
  // Deep-copy so we don't mutate the caller's data.
  const aug: RationalExpr[][] = [];
  for (let i = 0; i < n; i++) {
    const row: RationalExpr[] = [];
    for (let j = 0; j < n; j++) {
      row.push(A[i][j]);
    }
    row.push(b[i]);
    aug.push(row);
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot: prefer numeric non-zero, then
    // any non-zero
    let pivotRow = -1;
    for (let row = col; row < n; row++) {
      if (!aug[row][col].isZero()) {
        if (
          pivotRow === -1
          || (aug[row][col].isNumeric()
            && !aug[pivotRow][col].isNumeric())
        ) {
          pivotRow = row;
        }
      }
    }

    if (pivotRow === -1) {
      // No non-zero pivot => singular
      return null;
    }

    // Swap rows
    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [
        aug[pivotRow],
        aug[col],
      ];
    }

    const pivot = aug[col][col];

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      if (aug[row][col].isZero()) continue;

      // factor = aug[row][col] / pivot
      const factor = aug[row][col].divide(pivot);

      for (let j = col; j <= n; j++) {
        aug[row][j] = aug[row][j].subtract(
          factor.multiply(aug[col][j])
        );
      }
    }
  }

  // Back substitution
  const x: RationalExpr[] = new Array(n);

  for (let row = n - 1; row >= 0; row--) {
    if (aug[row][row].isZero()) {
      return null; // singular
    }

    let sum = aug[row][n]; // RHS
    for (let col = row + 1; col < n; col++) {
      sum = sum.subtract(
        aug[row][col].multiply(x[col])
      );
    }

    x[row] = sum.divide(aug[row][row]);
  }

  return x;
}

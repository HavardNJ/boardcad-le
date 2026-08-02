export type Matrix = number[][];

export function multiply(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const inner = b.length;
  const cols = b[0].length;
  const result: Matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) sum += a[i][k] * b[k][j];
      result[i][j] = sum;
    }
  }
  return result;
}

export function transpose(a: Matrix): Matrix {
  const rows = a.length;
  const cols = a[0].length;
  const result: Matrix = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) result[j][i] = a[i][j];
  }
  return result;
}

/** Gauss-Jordan inversion of a square matrix. Throws if the matrix is singular. */
export function invert(a: Matrix): Matrix {
  const n = a.length;
  const augmented: Matrix = a.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivotRow][col])) pivotRow = row;
    }
    // The !Number.isFinite check matters as much as the magnitude check: Math.abs(NaN)
    // is NaN, and `NaN < 1e-12` is false, so a NaN-poisoned pivot (e.g. from dividing by
    // a zero total path length upstream in bezierFit.ts) would otherwise sail through
    // this guard and silently propagate NaN through the rest of the elimination instead
    // of throwing here where the problem is easy to diagnose.
    if (!Number.isFinite(augmented[pivotRow][col]) || Math.abs(augmented[pivotRow][col]) < 1e-12) {
      throw new Error('matrix is singular');
    }
    [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];

    const pivot = augmented[col][col];
    for (let j = 0; j < 2 * n; j++) augmented[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = 0; j < 2 * n; j++) augmented[row][j] -= factor * augmented[col][j];
    }
  }

  return augmented.map((row) => row.slice(n));
}

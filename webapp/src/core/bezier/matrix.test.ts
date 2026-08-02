import { describe, it, expect } from 'vitest';
import { multiply, transpose, invert } from './matrix';

describe('matrix', () => {
  it('multiply computes standard matrix product', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    expect(multiply(a, b)).toEqual([[19, 22], [43, 50]]);
  });

  it('transpose swaps rows and columns', () => {
    expect(transpose([[1, 2, 3], [4, 5, 6]])).toEqual([[1, 4], [2, 5], [3, 6]]);
  });

  it('invert(A) * A is approximately the identity matrix', () => {
    const a = [
      [4, 3, 2, 1],
      [3, 4, 3, 2],
      [2, 3, 4, 3],
      [1, 2, 3, 4],
    ];
    const inv = invert(a);
    const product = multiply(inv, a);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(product[i][j]).toBeCloseTo(i === j ? 1 : 0, 6);
      }
    }
  });
});

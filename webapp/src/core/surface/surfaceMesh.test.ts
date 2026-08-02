import { describe, it, expect } from 'vitest';
import { newBoard } from '../board/board';
import { buildSurfaceMesh } from './surfaceMesh';

describe('buildSurfaceMesh', () => {
  it('produces the expected vertex and index counts', () => {
    const board = newBoard();
    const lengthSplits = 8;
    const crossSplits = 6;
    const mesh = buildSurfaceMesh(board, lengthSplits, crossSplits);

    const expectedVertexCount = (lengthSplits + 1) * (2 * crossSplits + 1);
    expect(mesh.positions.length).toBe(expectedVertexCount * 3);
    expect(mesh.indices.length).toBe(lengthSplits * 2 * crossSplits * 6);
  });

  it('contains no NaN or Infinity values', () => {
    const mesh = buildSurfaceMesh(newBoard(), 8, 6);
    for (const v of mesh.positions) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('mirrors the cross-section ring across the centerline', () => {
    const crossSplits = 6;
    const mesh = buildSurfaceMesh(newBoard(), 8, crossSplits);
    const ringStride = 2 * crossSplits + 1;
    // Second ring (i=1), point j=1 vs its mirror at 2*crossSplits-1.
    const ringBase = 1 * ringStride;
    const j = 1;
    const mirrorJ = 2 * crossSplits - j;
    const yAtJ = mesh.positions[(ringBase + j) * 3 + 1];
    const yAtMirror = mesh.positions[(ringBase + mirrorJ) * 3 + 1];
    expect(yAtMirror).toBeCloseTo(-yAtJ, 3);
  });

  it('every index references a valid vertex', () => {
    const mesh = buildSurfaceMesh(newBoard(), 8, 6);
    const vertexCount = mesh.positions.length / 3;
    for (const idx of mesh.indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(vertexCount);
    }
  });
});

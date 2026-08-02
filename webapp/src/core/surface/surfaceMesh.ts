import type { Board } from '../board/types';
import { getLength, getRockerAtPos, getInterpolatedCrossSection } from '../board/board';

export interface SurfaceMesh {
  /** Flat [x0,y0,z0, x1,y1,z1, ...] vertex positions. x=length pos, y=half-width offset, z=height incl. rocker. */
  positions: Float32Array;
  /** Flat triangle index list, 2 triangles per quad. */
  indices: Uint32Array;
  lengthSplits: number;
  crossSplits: number;
}

/** One closed ring of (2*crossSplits + 1) points around the board's cross-section at position x. */
function buildRing(board: Board, x: number, crossSplits: number): Array<{ y: number; z: number }> {
  const crossSection = getInterpolatedCrossSection(board, x);
  const rocker = getRockerAtPos(board, x);
  const ring: Array<{ y: number; z: number }> = [];

  if (crossSection == null) {
    // Degenerate: collapse to the centerline so the mesh stays well-formed.
    for (let j = 0; j <= 2 * crossSplits; j++) ring.push({ y: 0, z: rocker });
    return ring;
  }

  for (let j = 0; j <= crossSplits; j++) {
    const s = j / crossSplits;
    const p = crossSection.spline.getPointByS(s);
    ring.push({ y: p.x, z: p.y + rocker });
  }
  for (let j = crossSplits + 1; j <= 2 * crossSplits; j++) {
    const k = 2 * crossSplits - j;
    const s = k / crossSplits;
    const p = crossSection.spline.getPointByS(s);
    ring.push({ y: -p.x, z: p.y + rocker });
  }
  return ring;
}

export function buildSurfaceMesh(board: Board, lengthSplits = 40, crossSplits = 24): SurfaceMesh {
  const length = getLength(board);
  const ringStride = 2 * crossSplits + 1;
  const positions = new Float32Array((lengthSplits + 1) * ringStride * 3);

  for (let i = 0; i <= lengthSplits; i++) {
    let x = (i / lengthSplits) * length;
    x = Math.min(Math.max(x, 0.1), length - 0.1);

    const ring = buildRing(board, x, crossSplits);
    for (let j = 0; j < ring.length; j++) {
      const vertexIndex = i * ringStride + j;
      positions[vertexIndex * 3] = x;
      positions[vertexIndex * 3 + 1] = ring[j].y;
      positions[vertexIndex * 3 + 2] = ring[j].z;
    }
  }

  const indices = new Uint32Array(lengthSplits * 2 * crossSplits * 6);
  let idx = 0;
  for (let i = 0; i < lengthSplits; i++) {
    for (let j = 0; j < 2 * crossSplits; j++) {
      const a = i * ringStride + j;
      const b = i * ringStride + j + 1;
      const c = (i + 1) * ringStride + j;
      const d = (i + 1) * ringStride + j + 1;

      indices[idx++] = a;
      indices[idx++] = c;
      indices[idx++] = b;

      indices[idx++] = b;
      indices[idx++] = c;
      indices[idx++] = d;
    }
  }

  return { positions, indices, lengthSplits, crossSplits };
}

import type { Point2D } from './point';
import { multiply, transpose, invert, type Matrix } from './matrix';

// Fixed cubic-Bezier-to-power-basis conversion matrix: for control points P0..P3 and the
// power-basis row [t^3, t^2, t, 1], [t^3 t^2 t 1] * M * [P0;P1;P2;P3] = (1-t)^3*P0 +
// 3t(1-t)^2*P1 + 3t^2(1-t)*P2 + t^3*P3. Cross-checked by hand against the same expansion
// BezierCurve.calculateCoeff() encodes (coeff0..coeff3 there are exactly M's rows applied
// to [P0, tangentToNext, tangentToPrev, P3]).
const M: Matrix = [
  [-1, 3, -3, 1],
  [3, -6, 3, 0],
  [-3, 3, 0, 0],
  [1, 0, 0, 0],
];

function normalizedPathLengths(points: Point2D[]): number[] {
  const pathLength = new Array(points.length).fill(0);
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    pathLength[i] = pathLength[i - 1] + Math.sqrt(dx * dx + dy * dy);
  }
  const total = pathLength[pathLength.length - 1];
  return pathLength.map((l) => l / total);
}

function columnVector(values: number[]): Matrix {
  return values.map((v) => [v]);
}

/**
 * Port of BezierFit.bestFit: least-squares fit of a single cubic Bezier through `points`.
 * Returns [P0, P1(tangent-to-next), P2(tangent-to-prev), P3].
 *
 * Uses chord-length parametrization (cumulative distance between consecutive points,
 * normalized to [0,1]) as a stand-in for the curve's true parameter, since real guide
 * points (e.g. mouse clicks) have no known parameter value. This is an approximation:
 * for points whose true parametrization is far from evenly-spaced-by-arc-length (e.g.
 * very unequal tangent-handle lengths), the fit can deviate from the "true" underlying
 * curve by a non-trivial amount even though the least-squares solve itself is exact —
 * see bezierFit.test.ts's tolerance comment for a worked example and independent proof
 * this is inherent to the method, not a solver bug.
 *
 * Requires at least 4 points, not all coincident, for the normal-equations matrix
 * `A = UT * U` to be non-singular:
 * - `points.length === 0`: throws a TypeError from `transpose()`'s internal `a[0].length`
 *   access (an empty `U` has no rows) — a different, less clear error than the ones below,
 *   since this case is never expected to reach `bestFit` in practice (callers filter empty
 *   guide-point lists before calling this).
 * - `points.length` 1-3: `invert()` throws `'matrix is singular'` (U doesn't have full
 *   column rank).
 * - All points coincident (any count): `normalizedPathLengths` divides by a total path
 *   length of 0, producing NaN t-values that poison `A`; `invert()` throws `'matrix is
 *   singular'` (its pivot guard explicitly checks for non-finite values, not just small
 *   magnitude — see the comment in matrix.ts — specifically so this case throws instead
 *   of silently returning NaN control points).
 * Callers should guard against `points.length < 4` before calling `bestFit`; the
 * all-coincident case is handled by the throw above rather than needing a caller-side guard.
 */
export function bestFit(points: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
  const npls = normalizedPathLengths(points);
  const U: Matrix = npls.map((u) => [u ** 3, u ** 2, u, 1]);
  const X = columnVector(points.map((p) => p.x));
  const Y = columnVector(points.map((p) => p.y));

  const Minv = invert(M);
  const UT = transpose(U);
  const A = multiply(UT, U);
  const B = invert(A);
  const C = multiply(Minv, B);
  const D = multiply(C, UT);
  const E = multiply(D, X);
  const F = multiply(D, Y);

  const result: Point2D[] = [];
  for (let i = 0; i < 4; i++) {
    result.push({ x: E[i][0], y: F[i][0] });
  }
  return result as [Point2D, Point2D, Point2D, Point2D];
}

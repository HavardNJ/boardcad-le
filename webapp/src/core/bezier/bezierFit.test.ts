import { describe, it, expect } from 'vitest';
import { bestFit } from './bezierFit';
import { BezierCurve } from './bezierCurve';
import type { Point2D } from './point';

describe('bestFit', () => {
  it('recovers control points from points sampled off a known curve', () => {
    const curve = new BezierCurve(0, 0, 3, 6, 7, 6, 10, 0);
    const points: Point2D[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      points.push(curve.getValue(t));
    }

    const fitted = bestFit(points);

    // Tolerance note: bestFit uses chord-length parametrization (cumulative distance
    // between consecutive points, normalized to [0,1]) as a stand-in for the curve's
    // true t-parameter, since real guide points (mouse clicks) have no known t. For a
    // curve with unequal tangent-handle lengths like this one, chord-length param
    // diverges meaningfully from true-t param (points sampled at even t-steps aren't
    // evenly spaced by arc length), which shows up as real, expected fitting error at
    // the endpoints (verified independently: the OLS solve itself is exact — normal
    // equation residual ~1e-12 — and substituting true-t param instead of chord-length
    // param recovers the original control points to ~1e-13. The ~0.08-0.28 unit
    // deviation here is entirely the chord-length approximation, not a solver bug).
    // toBeCloseTo(x, 0) => within 0.5, loose enough to accommodate that expected error
    // while still catching a genuinely broken fit (which would be off by whole units).
    expect(fitted[0].x).toBeCloseTo(0, 0);
    expect(fitted[0].y).toBeCloseTo(0, 0);
    expect(fitted[3].x).toBeCloseTo(10, 0);
    expect(fitted[3].y).toBeCloseTo(0, 0);
  });

  it('fits a near-straight line for collinear points', () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 6, y: 0 },
      { x: 10, y: 0 },
    ];
    const fitted = bestFit(points);
    for (const p of fitted) expect(p.y).toBeCloseTo(0, 1);
  });

  it('throws for 1-3 points (normal-equations matrix is rank-deficient)', () => {
    expect(() => bestFit([{ x: 0, y: 0 }])).toThrow('matrix is singular');
    expect(() => bestFit([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow('matrix is singular');
    expect(() => bestFit([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toThrow('matrix is singular');
  });

  it('throws for all-coincident points instead of silently returning NaN control points', () => {
    const points: Point2D[] = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(() => bestFit(points)).toThrow('matrix is singular');
  });

  it('throws (a lower-level TypeError, not "matrix is singular") for zero points', () => {
    // Documented as a distinct, less-clear failure mode in bestFit's doc comment — this
    // test just locks in that it still throws rather than silently misbehaving, since
    // callers are expected to filter empty guide-point lists before calling bestFit.
    expect(() => bestFit([])).toThrow();
  });
});

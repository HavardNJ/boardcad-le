import { describe, it, expect } from 'vitest';
import { BezierCurve } from './bezierCurve';
import { BezierKnot } from './bezierKnot';

function straightCurve(): BezierCurve {
  // A straight line from (0,0) to (10,0), tangents collinear so the cubic degenerates to a line.
  return new BezierCurve(0, 0, 3.33, 0, 6.66, 0, 10, 0);
}

describe('BezierCurve', () => {
  it('evaluates a straight curve at its geometric midpoint', () => {
    const c = straightCurve();
    expect(c.getXValue(0.5)).toBeCloseTo(5, 1);
    expect(c.getYValue(0.5)).toBeCloseTo(0, 6);
  });

  it('getTForX round-trips to getXValue', () => {
    const c = straightCurve();
    const t = c.getTForX(7);
    expect(c.getXValue(t)).toBeCloseTo(7, 2);
  });

  it('getLength of a straight curve equals the endpoint distance', () => {
    const c = straightCurve();
    expect(c.getLength()).toBeCloseTo(10, 1);
  });

  it('getSplitControlPoint(0.5) endpoint equals getValue(0.5)', () => {
    const c = straightCurve();
    const mid = c.getValue(0.5);
    const split = c.getSplitControlPoint(0.5);
    expect(split.points[0].x).toBeCloseTo(mid.x, 6);
    expect(split.points[0].y).toBeCloseTo(mid.y, 6);
  });

  it('getClosestT finds t near 0.5 for a point near the curve midpoint', () => {
    const c = straightCurve();
    const t = c.getClosestT({ x: 5, y: 0.01 });
    expect(t).toBeCloseTo(0.5, 1);
  });

  it('recomputes coefficients after setDirty() following a knot mutation', () => {
    // NOTE: unlike Java's BezierCurve (which auto-invalidates via
    // BezierKnot's mChangeListeners/onChange()), this port's BezierKnot has no
    // change-listener mechanism (see bezierKnot.ts's class doc: whole-Board immutable
    // snapshots per command are used instead of mutation observers). So mutating a
    // knot in place does NOT automatically invalidate a BezierCurve's cached
    // coefficients - the caller must call setDirty() explicitly. This test verifies
    // that manual invalidation path (coeffDirty tracking) actually works, not that
    // mutation is auto-detected.
    const start = new BezierKnot(0, 0, 0, 0, 3.33, 0);
    const end = new BezierKnot(10, 0, 6.66, 0, 0, 0);
    const c = new BezierCurve(start, end);
    expect(c.getXValue(1)).toBeCloseTo(10, 1);
    end.setEndPoint(20, 0);
    c.setDirty();
    expect(c.getXValue(1)).toBeCloseTo(20, 1);
  });

  describe('getMaxY / getMinY on a curved control polygon', () => {
    // Both curves share the same |y|-shape (P0=(0,0), P3=(10,0), tangent handles at
    // y=+-10 and y=+-2) but with the "tall" tangent handle on opposite ends, which
    // pushes the true extremum into opposite halves of the t-domain. Expected t/value
    // were computed independently (golden-section search directly on the cubic
    // y(t) formula, not via this class) - see task notes. This locks in the
    // getMinMaxNumerical fix (Math.abs on the convergence check): without it, the
    // early-return check `bestT - (t1-t0)/2 < MIN_MAX_TOLERANCE` spuriously passes
    // whenever bestT sits in the lower half of the interval, truncating refinement a
    // level early and costing ~4 orders of magnitude of precision - but only for
    // extrema that land in specific sub-intervals, which is exactly why both an
    // early-half and a late-half case are needed to catch a regression here.
    const EXPECTED_EXTREMUM = 4.923169155390905; // golden-section ground truth, independent of this class

    it('finds the max with the extremum in the early half of the t-domain (t~=0.368)', () => {
      const c = new BezierCurve(0, 0, 3, 10, 7, 2, 10, 0);
      expect(c.getMaxY()).toBeCloseTo(EXPECTED_EXTREMUM, 4);
    });

    it('finds the max with the extremum in the late half of the t-domain (t~=0.632)', () => {
      const c = new BezierCurve(0, 0, 3, 2, 7, 10, 10, 0);
      expect(c.getMaxY()).toBeCloseTo(EXPECTED_EXTREMUM, 4);
    });

    it('finds the min (mirrored curve, extremum in the early half)', () => {
      const c = new BezierCurve(0, 0, 3, -10, 7, -2, 10, 0);
      expect(c.getMinY()).toBeCloseTo(-EXPECTED_EXTREMUM, 4);
    });
  });

  describe('getTForLength', () => {
    it('1-arg form finds t for a target arc length from the curve start', () => {
      const c = straightCurve(); // total length ~10
      const t = c.getTForLength(5);
      expect(t).toBeCloseTo(0.5, 2);
    });

    it('3-arg form over the full range [0,1] matches the 1-arg form', () => {
      const c = straightCurve();
      const t = c.getTForLength(0, 1, 5);
      expect(t).toBeCloseTo(0.5, 2);
    });

    it('3-arg form over a sub-range finds t for remaining length measured from t0', () => {
      const c = straightCurve();
      // Sub-range [0.2, 0.8] of a straight (~length-linear) curve: 3 units of the
      // ~6-unit sub-range length, starting from t0=0.2, lands at t~=0.2+3/10=0.5.
      const t = c.getTForLength(0.2, 0.8, 3);
      expect(t).toBeCloseTo(0.5, 2);
    });
  });

  it('falls back to brute-force search when Newton diverges near a flat tangent', () => {
    // x(t) = 1000t^3 - 1500t^2 + 750t, whose derivative 3000*(t-0.5)^2 touches zero at
    // t=0.5 - the Newton step's 1/slope blows up in that neighborhood. x=124.99 was
    // picked (via a standalone simulation of the exact Newton loop, outside this class)
    // so the initial guess (t~=0.50004, from (x-p3x)/(p0x-p3x)) sits inside that
    // near-zero-derivative neighborhood: plain Newton (no fallback) exceeds
    // POS_MAX_ITERATIONS without converging, which is precisely the condition
    // getTForXInternal checks to trigger getTForXBySearch(). A correct round-tripped
    // result here therefore demonstrates the fallback path actually ran.
    const c = new BezierCurve(0, 0, 250, 5, 0, 15, 250, 20);
    const t = c.getTForX(124.99);
    expect(c.getXValue(t)).toBeCloseTo(124.99, 2);
  });

  it('getSplitControlPoint(0.3) on a curved control polygon matches independently-computed de Casteljau values', () => {
    // P0=(0,0), tangentToNext=(3,6), tangentToPrev=(7,6), P3=(10,0): a genuinely curved
    // (non-collinear) arch. Expected values are from an independently hand/script
    // computed de Casteljau subdivision at t=0.3 (lerp chain Q1/Q2/Q3 -> R0/R1 -> S0),
    // cross-checked against the standard cubic Bernstein-basis formula for the endpoint.
    // This exercises the tangent handles (points[1]/points[2], i.e. r2/r3), which a
    // straight-line control polygon cannot: on a straight line every intermediate lerp
    // is collinear, so a sign or direction error in q1/q2/q3/r2/r3 would go undetected.
    const c = new BezierCurve(0, 0, 3, 6, 7, 6, 10, 0);
    const split = c.getSplitControlPoint(0.3);
    expect(split.points[0].x).toBeCloseTo(2.916, 6); // endpoint (S0)
    expect(split.points[0].y).toBeCloseTo(3.78, 6);
    expect(split.points[1].x).toBeCloseTo(1.89, 6); // tangentToPrev (R0)
    expect(split.points[1].y).toBeCloseTo(3.06, 6);
    expect(split.points[2].x).toBeCloseTo(5.31, 6); // tangentToNext (R1)
    expect(split.points[2].y).toBeCloseTo(5.46, 6);
  });
});

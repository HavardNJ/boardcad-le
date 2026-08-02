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
});

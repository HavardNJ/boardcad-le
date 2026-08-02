import { describe, it, expect } from 'vitest';
import { BezierSpline } from './bezierSpline';
import { BezierKnot } from './bezierKnot';

function straightSpline(): BezierSpline {
  // Two knots, straight line (0,0) -> (10,0), collinear tangents.
  const s = new BezierSpline();
  s.append(new BezierKnot(0, 0, 0, 0, 3.33, 0));
  s.append(new BezierKnot(10, 0, 6.66, 0, 10, 0));
  return s;
}

function threeKnotSpline(): BezierSpline {
  // Three knots, straight line (0,0) -> (5,0) -> (10,0), collinear tangents throughout.
  const s = new BezierSpline();
  s.append(new BezierKnot(0, 0, -1, 0, 1.66, 0));
  s.append(new BezierKnot(5, 0, 3.33, 0, 6.66, 0));
  s.append(new BezierKnot(10, 0, 8.33, 0, 11, 0));
  return s;
}

function fourKnotSpline(): BezierSpline {
  // Four knots, straight line (0,0) -> (5,0) -> (10,0) -> (15,0), collinear tangents.
  const s = new BezierSpline();
  s.append(new BezierKnot(0, 0, -1, 0, 1.66, 0));
  s.append(new BezierKnot(5, 0, 3.33, 0, 6.66, 0));
  s.append(new BezierKnot(10, 0, 8.33, 0, 11.66, 0));
  s.append(new BezierKnot(15, 0, 13.33, 0, 16, 0));
  return s;
}

describe('BezierSpline', () => {
  it('append builds one curve from two knots', () => {
    const s = straightSpline();
    expect(s.getNrOfControlPoints()).toBe(2);
    expect(s.getNrOfCurves()).toBe(1);
  });

  it('getValueAt returns the y value of the containing segment', () => {
    const s = new BezierSpline();
    s.append(new BezierKnot(0, 0, 0, 0, 3.33, 1));
    s.append(new BezierKnot(10, 2, 6.66, 1.5, 10, 2));
    const y = s.getValueAt(5);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(2);
  });

  it('getPointByS(0) and getPointByS(1) return the endpoints', () => {
    const s = straightSpline();
    const p0 = s.getPointByS(0);
    const p1 = s.getPointByS(1);
    expect(p0.x).toBeCloseTo(0, 3);
    expect(p1.x).toBeCloseTo(10, 3);
  });

  it('getPointByS(0.5) is between the endpoints along x', () => {
    const s = straightSpline();
    const mid = s.getPointByS(0.5);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(10);
  });

  it('insert adds a control point between two existing ones', () => {
    const s = straightSpline();
    const knot = new BezierKnot(5, 0, 4, 0, 6, 0);
    s.insert(1, knot);
    expect(s.getNrOfControlPoints()).toBe(3);
    expect(s.getControlPoint(1)).toBe(knot);
  });

  it('remove deletes a control point and rejoins the curve', () => {
    const s = straightSpline();
    s.insert(1, new BezierKnot(5, 0, 4, 0, 6, 0));
    s.remove(1);
    expect(s.getNrOfControlPoints()).toBe(2);
  });

  it('getSplitControlPoint finds the nearest segment and returns an insertion index', () => {
    const s = straightSpline();
    const out = new BezierKnot();
    const index = s.getSplitControlPoint({ x: 5, y: 0.1 }, out);
    expect(index).toBe(1);
    expect(out.points[0].x).toBeCloseTo(5, 0);
  });

  it('scale multiplies all control points', () => {
    const s = straightSpline();
    s.scale(2, 1);
    expect(s.getControlPoint(1).points[0].x).toBeCloseTo(20, 3);
  });

  it('clone deep-copies control points', () => {
    const s = straightSpline();
    const c = s.clone();
    c.getControlPoint(0).points[0].x = 999;
    expect(s.getControlPoint(0).points[0].x).toBe(0);
  });

  it('getMinX/getMaxY include the extremum when it falls in the LAST curve segment', () => {
    // Two curves: the first (A->B) stays essentially flat along y=0 with x in [0,10].
    // The second (B->C) swings out to x=-5, y=8 - both its minX and maxY are more extreme
    // than anything in curve 1. A loop that skips the last curve (the bug this regression
    // guards against) would only see curve 1 and report minX/maxY near 0; the fixed loop
    // must see curve 2's true extrema.
    const s = new BezierSpline();
    s.append(new BezierKnot(0, 0, 0, 0, 3, 0));
    s.append(new BezierKnot(10, 0, 7, 0, 10, 5));
    s.append(new BezierKnot(-5, 8, -5, 5, -5, 8));

    expect(s.getMinX()).toBeLessThan(0);
    expect(s.getMaxY()).toBeGreaterThan(1);
  });

  it('getControlPoint returns null (not a throw) one past the last valid index', () => {
    // 1-curve spline: valid control-point indices are 0 and 1. Index 2 is out of range and
    // must return null gracefully, matching every other out-of-range index, rather than
    // crashing on an out-of-bounds array access.
    const s = straightSpline();
    expect(() => s.getControlPoint(2)).not.toThrow();
    expect(s.getControlPoint(2)).toBe(null);
  });

  describe('insert at all three positions (start/middle/end) on a 3-knot spline', () => {
    it('insert at the start (index 0) becomes the new first control point', () => {
      const s = threeKnotSpline();
      const knot = new BezierKnot(-5, 0, -6, 0, -4, 0);
      s.insert(0, knot);
      expect(s.getNrOfControlPoints()).toBe(4);
      expect(s.getNrOfCurves()).toBe(3);
      expect(s.getControlPoint(0)).toBe(knot);
    });

    it('insert in the middle (index 1) splits the curve it falls inside', () => {
      const s = threeKnotSpline();
      const knot = new BezierKnot(2.5, 0, 2, 0, 3, 0);
      s.insert(1, knot);
      expect(s.getNrOfControlPoints()).toBe(4);
      expect(s.getNrOfCurves()).toBe(3);
      expect(s.getControlPoint(1)).toBe(knot);
    });

    it('insert at the end of the valid range (index N-1) becomes the new second-to-last control point', () => {
      const s = threeKnotSpline();
      const knot = new BezierKnot(7.5, 0, 7, 0, 8, 0);
      const n = s.getNrOfControlPoints();
      s.insert(n - 1, knot);
      expect(s.getNrOfControlPoints()).toBe(4);
      expect(s.getNrOfCurves()).toBe(3);
      expect(s.getControlPoint(n - 1)).toBe(knot);
    });

    it('insert in the middle preserves the shared-knot invariant at BOTH new curve boundaries', () => {
      // This directly checks object identity between adjacent curves (curve.getEndKnot()
      // === nextCurve.getStartKnot()), not just count/getControlPoint() identity - a broken
      // invariant with count/indexing still "looking right" would slip past the other tests.
      const s = threeKnotSpline();
      const knot = new BezierKnot(2.5, 0, 2, 0, 3, 0);
      s.insert(1, knot);
      // 3 curves now: [oldFirst -> knot], [knot -> oldSecond], [oldSecond -> oldThird]
      expect(s.getCurve(0).getEndKnot()).toBe(s.getCurve(1).getStartKnot());
      expect(s.getCurve(0).getEndKnot()).toBe(knot);
      expect(s.getCurve(1).getEndKnot()).toBe(s.getCurve(2).getStartKnot());
    });
  });

  describe('remove at all three positions (start/middle/end) on a 4-knot spline', () => {
    it('remove at the start (index 0) drops the first control point', () => {
      const s = fourKnotSpline();
      const second = s.getControlPoint(1);
      s.remove(0);
      expect(s.getNrOfControlPoints()).toBe(3);
      expect(s.getNrOfCurves()).toBe(2);
      expect(s.getControlPoint(0)).toBe(second);
    });

    it('remove in the middle (index 1) rejoins its two neighboring curves', () => {
      const s = fourKnotSpline();
      const first = s.getControlPoint(0);
      const third = s.getControlPoint(2);
      s.remove(1);
      expect(s.getNrOfControlPoints()).toBe(3);
      expect(s.getNrOfCurves()).toBe(2);
      expect(s.getControlPoint(0)).toBe(first);
      expect(s.getControlPoint(1)).toBe(third);
    });

    it('remove at the end (last index) leaves the last curve dangling rather than removing a curve', () => {
      const s = fourKnotSpline();
      const n = s.getNrOfControlPoints();
      s.remove(n - 1);
      expect(s.getNrOfControlPoints()).toBe(3);
      // Curve count is unchanged: the last curve's end knot becomes null (dangling) instead
      // of a curve object being spliced out of the array.
      expect(s.getNrOfCurves()).toBe(3);
    });

    it('remove in the middle preserves the shared-knot invariant at the rejoined boundary', () => {
      // Directly checks object identity (curve.getEndKnot() === nextCurve.getStartKnot())
      // after the rejoin, not just count/getControlPoint() identity.
      const s = fourKnotSpline();
      const third = s.getControlPoint(2);
      s.remove(1);
      // 2 curves now: [first -> third], [third -> fourth]
      expect(s.getCurve(0).getEndKnot()).toBe(s.getCurve(1).getStartKnot());
      expect(s.getCurve(0).getEndKnot()).toBe(third);
    });
  });
});

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
});

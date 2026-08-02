import { describe, it, expect } from 'vitest';
import { BezierKnot, LOCK_X_MORE, LOCK_Y_LESS } from './bezierKnot';

describe('BezierKnot', () => {
  it('constructs with endpoint and tangent points', () => {
    const k = new BezierKnot(1, 2, 0, 0, 3, 4);
    expect(k.points[0]).toEqual({ x: 1, y: 2 });
    expect(k.points[1]).toEqual({ x: 0, y: 0 });
    expect(k.points[2]).toEqual({ x: 3, y: 4 });
  });

  it('setControlPointLocation moves all three points by the same delta', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    k.setControlPointLocation(5, 5);
    expect(k.points[0]).toEqual({ x: 5, y: 5 });
    expect(k.points[1]).toEqual({ x: 4, y: 5 });
    expect(k.points[2]).toEqual({ x: 6, y: 5 });
  });

  it('setControlPointLocation respects xMask/yMask', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    k.setMask(0, 1);
    k.setControlPointLocation(5, 5);
    expect(k.points[0]).toEqual({ x: 0, y: 5 });
  });

  it('setControlPointLocation updates a slave knot endpoint and tangent deltas', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    const slave = new BezierKnot(10, 10, 9, 10, 11, 10);
    k.setSlave(slave);
    // setSlave already applied a one-time (10,10) delta to slave (endpoints 10 apart),
    // moving slave's tangents to (19,20)/(21,20) - see the dedicated setSlave test below.
    // setControlPointLocation(2,3) then applies a further (2,3) delta on top of that.
    k.setControlPointLocation(2, 3);
    expect(slave.points[0]).toEqual({ x: 2, y: 3 });
    expect(slave.points[1]).toEqual({ x: 21, y: 23 });
    expect(slave.points[2]).toEqual({ x: 23, y: 23 });
  });

  it('setTangentToNext clamps against LOCK_X_MORE', () => {
    const k = new BezierKnot(5, 5, 4, 5, 6, 5);
    k.setTangentToNextLocks(LOCK_X_MORE);
    k.setTangentToNext(3, 5);
    expect(k.points[2].x).toBe(5);
  });

  it('setTangentToPrev clamps against LOCK_Y_LESS', () => {
    const k = new BezierKnot(5, 5, 4, 5, 6, 5);
    k.setTangentToPrevLocks(LOCK_Y_LESS);
    k.setTangentToPrev(4, 10);
    expect(k.points[1].y).toBe(5);
  });

  it('getAngleBetweenTangents returns PI for a straight (fully smooth) knot', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    expect(k.getAngleBetweenTangents()).toBeCloseTo(Math.PI);
  });

  it('scaleTangentToNext doubles the tangent distance from the endpoint, preserving direction', () => {
    const k = new BezierKnot(0, 0, -1, 0, 3, 4);
    const originalLength = k.getTangentToNextLength(); // sqrt(3^2+4^2) = 5

    k.scaleTangentToNext(2);

    expect(k.getTangentToNextLength()).toBeCloseTo(originalLength * 2);
    // (3,4) scaled by 2 around the endpoint (0,0) is (6,8) - same direction, not just same length.
    expect(k.points[2]).toEqual({ x: 6, y: 8 });
  });

  it('scaleTangentToPrev doubles the tangent distance from the endpoint, preserving direction', () => {
    const k = new BezierKnot(0, 0, -3, -4, 1, 0);
    const originalLength = k.getTangentToPrevLength(); // sqrt(3^2+4^2) = 5

    k.scaleTangentToPrev(2);

    expect(k.getTangentToPrevLength()).toBeCloseTo(originalLength * 2);
    // (-3,-4) scaled by 2 around the endpoint (0,0) is (-6,-8) - same direction, not just same length.
    expect(k.points[1]).toEqual({ x: -6, y: -8 });
  });

  it('clone deep-copies points so mutating the clone does not affect the original', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    const c = k.clone();
    c.points[0].x = 99;
    expect(k.points[0].x).toBe(0);
  });

  it('handleLocks only clamps when the value crosses the endpoint, not on the allowed side', () => {
    // LOCK_X_MORE only prevents point.x from going *below* endpoint.x (point.x < endpoint.x).
    // Moving to a value >= endpoint.x should pass through unclamped.
    const k = new BezierKnot(5, 5, 4, 5, 6, 5);
    k.setTangentToNextLocks(LOCK_X_MORE);
    k.setTangentToNext(8, 5);
    expect(k.points[2].x).toBe(8);
  });

  it('handleLocks can combine multiple lock flags on independent axes', () => {
    const k = new BezierKnot(5, 5, 4, 5, 6, 5);
    k.setTangentToNextLocks(LOCK_X_MORE | LOCK_Y_LESS);
    k.setTangentToNext(3, 10);
    expect(k.points[2]).toEqual({ x: 5, y: 5 });
  });

  it('setSlave immediately syncs the slave endpoint and shifts its tangents by the endpoint delta', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    const slave = new BezierKnot(10, 10, 9, 10, 11, 10);
    k.setSlave(slave);
    // updateSlave snaps slave's endpoint directly onto master's (0,0), and adds the
    // one-time delta between the two original endpoints ((10,10)-(0,0) = (10,10)) to
    // slave's existing tangent points: (9,10)+(10,10)=(19,20), (11,10)+(10,10)=(21,20).
    // Note this does NOT preserve the slave's tangent-to-endpoint offset - it's an
    // absolute shift, same math as any other setControlPointLocation-driven move.
    expect(slave.points[0]).toEqual({ x: 0, y: 0 });
    expect(slave.points[1]).toEqual({ x: 19, y: 20 });
    expect(slave.points[2]).toEqual({ x: 21, y: 20 });
  });

  it('clone() copies the slave reference as-is (not deep-cloned)', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    const slave = new BezierKnot(10, 10, 9, 10, 11, 10);
    k.setSlave(slave);

    const c = k.clone();

    expect(c.slave).toBe(slave);
  });

  it('set() copies the slave reference as-is (not deep-cloned)', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    const slave = new BezierKnot(10, 10, 9, 10, 11, 10);
    k.setSlave(slave);

    const other = new BezierKnot();
    other.set(k);

    expect(other.slave).toBe(slave);
  });
});

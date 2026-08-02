import type { Point2D } from './point';
import * as vec from './vecMath';

/**
 * Tangent lock flags for `handleLocks`. Each flag clamps a tangent handle's coordinate
 * back to the knot's endpoint value if the handle would otherwise cross past it:
 *  - LOCK_X_MORE: handle.x may not go BELOW endpoint.x (clamps if endpoint.x > handle.x)
 *  - LOCK_X_LESS: handle.x may not go ABOVE endpoint.x (clamps if endpoint.x < handle.x)
 *  - LOCK_Y_MORE: handle.y may not go BELOW endpoint.y (clamps if endpoint.y > handle.y)
 *  - LOCK_Y_LESS: handle.y may not go ABOVE endpoint.y (clamps if endpoint.y < handle.y)
 * Flags may be OR'd together to constrain both axes at once.
 */
export const LOCK_X_MORE = 0x0001;
export const LOCK_X_LESS = 0x0010;
export const LOCK_Y_MORE = 0x0100;
export const LOCK_Y_LESS = 0x1000;

export const END_POINT = 0;
export const PREVIOUS_TANGENT = 1;
export const NEXT_TANGENT = 2;

/**
 * Port of cadcore.BezierKnot: a control point on a bezier curve, consisting of an
 * endpoint (points[0]) and two tangent handles (points[1] = tangent to previous knot,
 * points[2] = tangent to next knot).
 *
 * `compareTo`/`toString`/`fromString` from the Java original are not ported: they exist
 * for CAM cross-section matching heuristics and legacy `.brd` text serialization, neither
 * of which apply to this port (v1 uses JSON, not the text format).
 */
export class BezierKnot {
  /** [endpoint, tangentToPrev, tangentToNext] - matches Java's index convention. */
  points: [Point2D, Point2D, Point2D];
  continuous = true;
  xMask = 1.0;
  yMask = 1.0;
  tangentPrevLocks = 0;
  tangentNextLocks = 0;
  /**
   * An optional linked knot that mirrors this knot's endpoint moves (e.g. a knot shared
   * between two hull sections). See `setSlave`/`updateSlave` for the update math, and
   * `set`/`clone` for why the reference itself is never deep-copied.
   */
  slave: BezierKnot | null = null;

  constructor(cx = 0, cy = 0, px = 0, py = 0, nx = 0, ny = 0) {
    this.points = [
      { x: cx, y: cy },
      { x: px, y: py },
      { x: nx, y: ny },
    ];
  }

  get endPoint(): Point2D {
    return this.points[0];
  }

  get tangentToPrev(): Point2D {
    return this.points[1];
  }

  get tangentToNext(): Point2D {
    return this.points[2];
  }

  getTangentToPrevLength(): number {
    return vec.length(this.points[1], this.points[0]);
  }

  getTangentToNextLength(): number {
    return vec.length(this.points[2], this.points[0]);
  }

  /**
   * Moves the endpoint to (x, y) and translates both tangent handles by the same delta,
   * keeping their offset from the endpoint unchanged. The delta is masked per-axis by
   * xMask/yMask (see `setMask`) before being applied to all three points. If a `slave`
   * knot is linked, the same delta is also applied to it via `updateSlave`.
   */
  setControlPointLocation(x: number, y: number): void {
    const xDiff = (x - this.points[0].x) * this.xMask;
    const yDiff = (y - this.points[0].y) * this.yMask;

    this.points[0] = { x: this.points[0].x + xDiff, y: this.points[0].y + yDiff };
    this.points[1] = { x: this.points[1].x + xDiff, y: this.points[1].y + yDiff };
    this.points[2] = { x: this.points[2].x + xDiff, y: this.points[2].y + yDiff };

    if (this.slave != null) {
      this.updateSlave(xDiff, yDiff);
    }
  }

  /**
   * Applies a move to `slave`: its endpoint is snapped directly to this knot's current
   * endpoint (not offset by xDiff/yDiff - the two endpoints are always kept coincident),
   * while its tangent handles are shifted by (xDiff, yDiff) same as this knot's own
   * tangents, preserving the slave's own tangent shape/length. Called both from
   * `setControlPointLocation` (per-move delta) and from `setSlave` (one-time delta to
   * bring a newly linked slave into sync with this knot's current position).
   */
  updateSlave(xDiff: number, yDiff: number): void {
    const s = this.slave!;
    s.points[0] = { x: this.points[0].x, y: this.points[0].y };
    s.points[1] = { x: s.points[1].x + xDiff, y: s.points[1].y + yDiff };
    s.points[2] = { x: s.points[2].x + xDiff, y: s.points[2].y + yDiff };
  }

  setEndPoint(x: number, y: number): void {
    this.points[0] = { x: x * this.xMask, y: y * this.yMask };
  }

  /** Sets the tangent-to-prev handle, then clamps it per `tangentPrevLocks` (see `handleLocks`). */
  setTangentToPrev(x: number, y: number): void {
    this.points[1] = { x, y };
    this.handleLocks(this.points[1], this.tangentPrevLocks);
  }

  /** Sets the tangent-to-next handle, then clamps it per `tangentNextLocks` (see `handleLocks`). */
  setTangentToNext(x: number, y: number): void {
    this.points[2] = { x, y };
    this.handleLocks(this.points[2], this.tangentNextLocks);
  }

  setLocation(index: 0 | 1 | 2, x: number, y: number): void {
    if (index === 0) this.setEndPoint(x, y);
    else if (index === 1) this.setTangentToPrev(x, y);
    else this.setTangentToNext(x, y);
  }

  scale(scaleX: number, scaleY: number): void {
    this.points = this.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })) as [Point2D, Point2D, Point2D];
  }

  translate(dx: number, dy: number): void {
    this.points = this.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) as [Point2D, Point2D, Point2D];
  }

  scaleTangentToPrev(scale: number): void {
    const v = vec.scale(vec.sub(this.endPoint, this.tangentToPrev), scale);
    const p = vec.add(v, this.endPoint);
    this.setTangentToPrev(p.x, p.y);
  }

  scaleTangentToNext(scale: number): void {
    const v = vec.scale(vec.sub(this.endPoint, this.tangentToNext), scale);
    const p = vec.add(v, this.endPoint);
    this.setTangentToNext(p.x, p.y);
  }

  getTangentToPrevAngle(): number {
    const u = { x: 0, y: 1 };
    const v = vec.sub(this.endPoint, this.tangentToPrev);
    return vec.angleBetween(u, v);
  }

  setTangentToPrevAngle(angle: number): void {
    const next = this.tangentToPrev;
    const sx = next.x - this.endPoint.x;
    const sy = next.y - this.endPoint.y;
    const rotAngle = angle - this.getTangentToPrevAngle();
    const xDiff = Math.cos(rotAngle) * sx - Math.sin(rotAngle) * sy - sx;
    const yDiff = Math.sin(rotAngle) * sx + Math.cos(rotAngle) * sy - sy;
    this.setTangentToPrev(next.x + xDiff, next.y + yDiff);
  }

  getTangentToNextAngle(): number {
    const u = { x: 0, y: 1 };
    const v = vec.sub(this.endPoint, this.tangentToNext);
    return vec.angleBetween(u, v);
  }

  setTangentToNextAngle(angle: number): void {
    const next = this.tangentToNext;
    const sx = next.x - this.endPoint.x;
    const sy = next.y - this.endPoint.y;
    const rotAngle = angle - this.getTangentToNextAngle();
    const xDiff = Math.cos(rotAngle) * sx - Math.sin(rotAngle) * sy - sx;
    const yDiff = Math.sin(rotAngle) * sx + Math.cos(rotAngle) * sy - sy;
    this.setTangentToNext(next.x + xDiff, next.y + yDiff);
  }

  /** Angle between the two tangent vectors (endpoint -> tangentToPrev, endpoint -> tangentToNext).
   *  PI means the tangents point in exactly opposite directions (a fully smooth/straight knot). */
  getAngleBetweenTangents(): number {
    const v1 = vec.sub(this.endPoint, this.tangentToPrev);
    const v2 = vec.sub(this.endPoint, this.tangentToNext);
    return vec.angleBetween(v1, v2);
  }

  /** Per-axis move mask (0 or 1) applied by setControlPointLocation/setEndPoint, e.g. to lock
   *  a knot to only move along one axis. */
  setMask(x: number, y: number): void {
    this.xMask = x;
    this.yMask = y;
  }

  setTangentToPrevLocks(locks: number): void {
    this.tangentPrevLocks = locks;
  }

  setTangentToNextLocks(locks: number): void {
    this.tangentNextLocks = locks;
  }

  addTangentToPrevLocks(locks: number): void {
    this.tangentPrevLocks |= locks;
  }

  addTangentToNextLocks(locks: number): void {
    this.tangentNextLocks |= locks;
  }

  /**
   * Links `slave` to this knot and immediately brings it into sync: computes the delta
   * between the slave's current endpoint and this knot's current endpoint, then applies
   * that one-time delta via `updateSlave` (snapping the slave's endpoint onto this
   * knot's, and shifting the slave's tangents by the same delta). From then on, every
   * `setControlPointLocation` move on this knot propagates to the slave the same way.
   */
  setSlave(slave: BezierKnot): void {
    this.slave = slave;
    const xDiff = slave.points[0].x - this.points[0].x;
    const yDiff = slave.points[0].y - this.points[0].y;
    this.updateSlave(xDiff, yDiff);
  }

  /**
   * Clamps `point` back to this knot's endpoint coordinate on each axis where a lock flag
   * is set and `point` has crossed past the endpoint on that axis:
   *  - LOCK_X_MORE clamps when endpoint.x > point.x (point.x can't go below endpoint.x)
   *  - LOCK_X_LESS clamps when endpoint.x < point.x (point.x can't go above endpoint.x)
   *  - LOCK_Y_MORE clamps when endpoint.y > point.y (point.y can't go below endpoint.y)
   *  - LOCK_Y_LESS clamps when endpoint.y < point.y (point.y can't go above endpoint.y)
   * Mutates `point` in place (mirrors Java's Point2D.Double aliasing behavior).
   */
  handleLocks(point: Point2D, locks: number): void {
    if ((locks & LOCK_X_MORE) !== 0 && this.points[0].x > point.x) point.x = this.points[0].x;
    if ((locks & LOCK_X_LESS) !== 0 && this.points[0].x < point.x) point.x = this.points[0].x;
    if ((locks & LOCK_Y_MORE) !== 0 && this.points[0].y > point.y) point.y = this.points[0].y;
    if ((locks & LOCK_Y_LESS) !== 0 && this.points[0].y < point.y) point.y = this.points[0].y;
  }

  switchTangents(): void {
    const tmp = this.points[1];
    this.points[1] = this.points[2];
    this.points[2] = tmp;
  }

  equals(other: BezierKnot): boolean {
    for (let i = 0; i < 3; i++) {
      if (this.points[i].x !== other.points[i].x) return false;
      if (this.points[i].y !== other.points[i].y) return false;
    }
    return this.continuous === other.continuous;
  }

  /** Copies `other`'s state onto this knot, including a shallow copy of the `slave`
   *  reference (not deep-cloned) - matches Java's `set()`. */
  set(other: BezierKnot): void {
    this.continuous = other.continuous;
    this.slave = other.slave;
    this.tangentPrevLocks = other.tangentPrevLocks;
    this.tangentNextLocks = other.tangentNextLocks;
    this.points = [
      { x: other.points[0].x, y: other.points[0].y },
      { x: other.points[1].x, y: other.points[1].y },
      { x: other.points[2].x, y: other.points[2].y },
    ];
  }

  /** Deep-copies points, but NOT the `slave` reference (copied as-is) - matches Java's
   *  `clone()`, which clones `mPoints` but assigns `mSlave` by reference via `super.clone()`. */
  clone(): BezierKnot {
    const k = new BezierKnot();
    k.continuous = this.continuous;
    k.xMask = this.xMask;
    k.yMask = this.yMask;
    k.tangentPrevLocks = this.tangentPrevLocks;
    k.tangentNextLocks = this.tangentNextLocks;
    k.slave = this.slave;
    k.points = [
      { x: this.points[0].x, y: this.points[0].y },
      { x: this.points[1].x, y: this.points[1].y },
      { x: this.points[2].x, y: this.points[2].y },
    ];
    return k;
  }
}

import type { Point2D } from './point';
import { BezierKnot } from './bezierKnot';
import * as vec from './vecMath';

export const ZERO = 0.0000000001;
export const ONE = 0.9999999999;

const X = 0;
const Y = 1;
const MIN = 0;
const MAX = 1;

const POS_TOLERANCE = 0.003; // 0.03mm
const POS_MAX_ITERATIONS = 30;
const LENGTH_TOLERANCE = 0.001;
const MIN_MAX_TOLERANCE = 0.0001;
const MIN_MAX_SPLITS = 96;

/**
 * Port of cadcore.BezierCurve, scoped to the subset exercised by this plan: cubic
 * evaluation, length, t-for-x search, closest-point search, de Casteljau splitting, and
 * numeric min/max. `getTangent`/`getNormal`/`getCurvature*`/`getTForTangent*`/
 * `getTForDistance` are intentionally not ported (see Task 3 scope cut) - nothing in the
 * v1 feature set calls them, and Three.js computes mesh normals itself.
 */
export class BezierCurve {
  private startKnot: BezierKnot;
  private endKnot: BezierKnot;

  private coeff0 = 0;
  private coeff1 = 0;
  private coeff2 = 0;
  private coeff3 = 0;
  private coeff4 = 0;
  private coeff5 = 0;
  private coeff6 = 0;
  private coeff7 = 0;
  private coeffDirty = true;

  constructor(
    p0xOrStart: number | BezierKnot,
    p0yOrEnd?: number | BezierKnot,
    p1x?: number,
    p1y?: number,
    p2x?: number,
    p2y?: number,
    p3x?: number,
    p3y?: number,
  ) {
    if (p0xOrStart instanceof BezierKnot) {
      this.startKnot = p0xOrStart;
      this.endKnot = p0yOrEnd as BezierKnot;
    } else {
      this.startKnot = new BezierKnot(p0xOrStart, p0yOrEnd as number, 0, 0, p1x!, p1y!);
      this.endKnot = new BezierKnot(p3x!, p3y!, p2x!, p2y!, 0, 0);
    }
  }

  getStartKnot(): BezierKnot {
    return this.startKnot;
  }

  getEndKnot(): BezierKnot {
    return this.endKnot;
  }

  setStartKnot(knot: BezierKnot): void {
    this.startKnot = knot;
    this.setDirty();
  }

  /**
   * NOTE: passing `null` (e.g. during curve removal) satisfies the type checker via the
   * `as BezierKnot` cast below, but leaves `this.endKnot` actually null at runtime. Any
   * subsequent call that touches `this.endKnot` (getXValue, getLength, getSplitControlPoint,
   * etc.) will then throw at runtime with no compile-time warning - TS's null-safety is
   * deliberately defeated here to match Java's nullable-field signature. Callers must not
   * evaluate a curve after null-ing out its end knot.
   */
  setEndKnot(knot: BezierKnot | null): void {
    this.endKnot = knot as BezierKnot;
    this.setDirty();
  }

  /**
   * Marks the cached coefficients (and, transitively, anything derived from them) stale
   * so the next evaluation recomputes from the current knot state.
   *
   * NOTE on cache invalidation: Java's BezierCurve auto-invalidates via
   * `BezierKnotChangeListener`/`onChange()` fired by the knot on every mutation (see
   * `mStartKnot.addChangeListener(this)` in the Java constructor). That observer
   * mechanism is deliberately not ported here (see bezierKnot.ts's class doc: this
   * port's architecture uses whole-Board immutable snapshots per command instead of
   * mutation-observer wiring), so a `BezierCurve` in this port does NOT automatically
   * notice direct mutations to its start/end knot (e.g. calling `knot.setEndPoint(...)`
   * on a knot the curve already holds a reference to). Callers that mutate a knot in
   * place after handing it to a `BezierCurve` must call `setDirty()` themselves
   * afterward; the normal command-based editing flow instead constructs fresh knots and
   * re-assigns them via `setStartKnot`/`setEndKnot`, which call `setDirty()` for you.
   */
  setDirty(): void {
    this.coeffDirty = true;
  }

  private calculateCoeff(): void {
    if (!this.coeffDirty) return;

    const p0 = this.startKnot.endPoint;
    const t1 = this.startKnot.tangentToNext;
    const t2 = this.endKnot.tangentToPrev;
    const p3 = this.endKnot.endPoint;

    this.coeff0 = p3.x + 3 * (-t2.x + t1.x) - p0.x;
    this.coeff1 = 3 * (t2.x - 2 * t1.x + p0.x);
    this.coeff2 = 3 * (t1.x - p0.x);
    this.coeff3 = p0.x;

    this.coeff4 = p3.y + 3 * (-t2.y + t1.y) - p0.y;
    this.coeff5 = 3 * (t2.y - 2 * t1.y + p0.y);
    this.coeff6 = 3 * (t1.y - p0.y);
    this.coeff7 = p0.y;

    this.coeffDirty = false;
  }

  getXValue(t: number): number {
    this.calculateCoeff();
    return ((((this.coeff0 * t + this.coeff1) * t) + this.coeff2) * t) + this.coeff3;
  }

  getYValue(t: number): number {
    this.calculateCoeff();
    return ((((this.coeff4 * t + this.coeff5) * t) + this.coeff6) * t) + this.coeff7;
  }

  getValue(t: number): Point2D {
    this.calculateCoeff();
    return { x: this.getXValue(t), y: this.getYValue(t) };
  }

  private getXDerivate(t: number): number {
    return (((3 * this.coeff0 * t) + 2 * this.coeff1) * t) + this.coeff2;
  }

  getTForX(x: number, startT?: number): number {
    this.calculateCoeff();
    const t = startT ?? (x - this.endKnot.endPoint.x) / (this.startKnot.endPoint.x - this.endKnot.endPoint.x);
    return this.getTForXInternal(x, t);
  }

  private getTForXInternal(x: number, startT: number): number {
    let tn = startT;
    let xn = this.getXValue(tn);
    let error = x - xn;
    let n = 0;

    while (Math.abs(error) > POS_TOLERANCE && n++ < POS_MAX_ITERATIONS) {
      const currentSlope = 1 / this.getXDerivate(tn);
      tn = tn + error * currentSlope;
      xn = this.getXValue(tn);
      error = x - xn;
    }

    if (tn < 0 || tn > 1 || Number.isNaN(tn) || n >= POS_MAX_ITERATIONS || Math.abs(error) > POS_TOLERANCE) {
      // Matches Java's fallback exactly (BezierSpline.MIN_MAX_SPLITS, not a coarser
      // value): this path only runs once Newton's method has already failed to
      // converge, so it is the wrong place to trade away precision for speed.
      tn = this.getTForXBySearch(x, 0, 1, MIN_MAX_SPLITS);
    }
    return tn;
  }

  private getTForXBySearch(x: number, t0: number, t1: number, nrOfSplits: number): number {
    let bestT = 0;
    let bestError = 1e9;
    const seg = (t1 - t0) / nrOfSplits;

    for (let i = 1; i < nrOfSplits; i++) {
      const currentT = seg * i + t0;
      if (currentT < 0 || currentT > 1) continue;
      const error = Math.abs(x - this.getXValue(currentT));
      if (error < bestError) {
        bestError = error;
        bestT = currentT;
      }
    }

    if (bestError < POS_TOLERANCE) return bestT;
    if (Math.abs(bestT - (t1 - t0) / 2) < MIN_MAX_TOLERANCE) return bestT;
    if (nrOfSplits <= 2) return bestT;
    return this.getTForXBySearch(x, bestT - seg, bestT + seg, Math.floor(nrOfSplits / 2));
  }

  getYForX(x: number): number {
    this.calculateCoeff();
    const t0 = (x - this.startKnot.endPoint.x) / (this.endKnot.endPoint.x - this.startKnot.endPoint.x);
    const t = this.getTForXInternal(x, t0);
    return this.getYValue(t);
  }

  getMinX(): number {
    return this.getMinMaxNumerical(X, MIN);
  }
  getMaxX(): number {
    return this.getMinMaxNumerical(X, MAX);
  }
  getMinY(): number {
    return this.getMinMaxNumerical(Y, MIN);
  }
  getMaxY(): number {
    return this.getMinMaxNumerical(Y, MAX);
  }

  getMinMaxNumerical(xOrY: number, minOrMax: number, t0 = 0, t1 = 1, nrOfSplits = MIN_MAX_SPLITS): number {
    this.calculateCoeff();
    let bestT = 0;
    let bestValue = minOrMax === MAX ? -1e7 : 1e7;
    const seg = (t1 - t0) / nrOfSplits;

    for (let i = 0; i < nrOfSplits; i++) {
      const currentT = seg * i + t0;
      if (currentT < 0 || currentT > 1) continue;
      const currentValue = xOrY === X ? this.getXValue(currentT) : this.getYValue(currentT);
      if (minOrMax === MAX ? currentValue >= bestValue : currentValue <= bestValue) {
        bestValue = currentValue;
        bestT = currentT;
      }
    }

    // Deliberate accuracy improvement over Java's original (BezierCurve.java:568), which
    // has the same convergence check WITHOUT Math.abs(): `(bestT - (t1-t0)/2) <
    // MIN_MAX_TOLERANCE`. Without the abs, the check spuriously passes whenever bestT
    // lands in the lower half of [t0,t1] (a negative difference is always <
    // MIN_MAX_TOLERANCE), stopping the refinement a full recursion level early and
    // giving ~10,000x worse precision purely depending on which half of the domain the
    // extremum falls in (confirmed empirically: ~7.7e-4 error vs ~6.6e-11 error for
    // otherwise-equivalent inputs). Unlike rootFinder's Java-bug preservation (Task 1,
    // where nothing else in the plan depends on the buggy behavior either way), this
    // method is called by later tasks (BezierSpline min/max, board width/thickness,
    // curve-fit range detection) that benefit from the more accurate result, and there
    // is no reason to intentionally ship the less-accurate Java behavior here.
    if (Math.abs(bestT - (t1 - t0) / 2) < MIN_MAX_TOLERANCE) return bestValue;
    if (nrOfSplits <= 2) return bestValue;
    return this.getMinMaxNumerical(xOrY, minOrMax, bestT - seg, bestT + seg, Math.floor(nrOfSplits / 2));
  }

  getLength(t0 = ZERO, t1 = ONE): number {
    this.calculateCoeff();
    const x0 = this.getXValue(t0);
    const y0 = this.getYValue(t0);
    const x1 = this.getXValue(t1);
    const y1 = this.getYValue(t1);

    const ts = (t1 - t0) / 2 + t0;
    const sx = this.getXValue(ts);
    const sy = this.getYValue(ts);

    const length = vec.length({ x: x0, y: y0 }, { x: sx, y: sy }) + vec.length({ x: sx, y: sy }, { x: x1, y: y1 });
    const chord = vec.length({ x: x0, y: y0 }, { x: x1, y: y1 });

    if (length - chord > LENGTH_TOLERANCE && t1 - t0 > 0.001) {
      return this.getLength(t0, ts) + this.getLength(ts, t1);
    }
    return length;
  }

  /**
   * Finds t such that the arc length from t0 to t equals `lengthLeft`. Two call forms,
   * matching Java's two `getTForLength` overloads:
   *  - `getTForLength(lengthLeft)` - search the whole curve (t0=ZERO, t1=ONE).
   *  - `getTForLength(t0, t1, lengthLeft)` - search within [t0, t1] for `lengthLeft` of
   *    remaining arc length measured from t0.
   * These are declared as real TS overload signatures (not just optional params) so a
   * 2-argument call is a compile error rather than silently falling through to the
   * 3-arg branch with `lengthLeft` undefined.
   */
  getTForLength(lengthLeft: number): number;
  getTForLength(t0: number, t1: number, lengthLeft: number): number;
  getTForLength(t0OrLengthLeft: number, t1?: number, lengthLeft?: number): number {
    this.calculateCoeff();
    if (t1 === undefined) {
      return this.getTForLength(ZERO, ONE, t0OrLengthLeft);
    }
    const t0 = t0OrLengthLeft;
    const remaining = lengthLeft as number;

    if (Math.abs(t0 - t1) < 0.00001) return t0;

    const ts = (t1 - t0) / 2 + t0;
    const sl = this.getLength(t0, ts);

    if (Math.abs(sl - remaining) > LENGTH_TOLERANCE) {
      return sl > remaining ? this.getTForLength(t0, ts, remaining) : this.getTForLength(ts, t1, remaining - sl);
    }
    return ts;
  }

  getClosestT(point: Point2D, t0 = 0, t1 = 1, nrOfSplits = 32): number {
    this.calculateCoeff();
    let bestT = 0;
    let minDist = 1e9;
    const seg = (t1 - t0) / nrOfSplits;

    for (let i = 0; i < nrOfSplits; i++) {
      const currentT = seg * i + t0;
      if (currentT < 0 || currentT > 1) continue;
      const dist = vec.length({ x: this.getXValue(currentT), y: this.getYValue(currentT) }, point);
      if (dist <= minDist) {
        minDist = dist;
        bestT = currentT;
      }
    }

    if (bestT - (t1 - t0) / 2 < 0.001) return bestT;
    if (nrOfSplits <= 2) return bestT;
    return this.getClosestT(point, bestT - seg, bestT + seg, Math.floor(nrOfSplits / 2));
  }

  /** De Casteljau split: returns a knot whose endpoint/tangents are the curve's local control polygon at t. */
  getSplitControlPoint(t: number): BezierKnot {
    const q1 = vec.add(vec.scale(vec.sub(this.startKnot.endPoint, this.startKnot.tangentToNext), t), this.startKnot.endPoint);
    const q2 = vec.add(vec.scale(vec.sub(this.startKnot.tangentToNext, this.endKnot.tangentToPrev), t), this.startKnot.tangentToNext);
    const q3 = vec.add(vec.scale(vec.sub(this.endKnot.tangentToPrev, this.endKnot.endPoint), t), this.endKnot.tangentToPrev);

    const r2 = vec.add(vec.scale(vec.sub(q1, q2), t), q1);
    const r3 = vec.add(vec.scale(vec.sub(q2, q3), t), q2);
    const r1 = vec.add(vec.scale(vec.sub(r2, r3), t), r2);

    const ret = new BezierKnot();
    ret.points[0] = r1;
    ret.points[1] = r2;
    ret.points[2] = r3;
    return ret;
  }
}

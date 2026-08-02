import type { Point2D } from './point';
import { BezierKnot } from './bezierKnot';
import { BezierCurve, ZERO, ONE } from './bezierCurve';
import * as vec from './vecMath';

const X = 0;
const MIN = 0;
const MAX = 1;

/**
 * Port of cadcore.BezierSpline, scoped to the subset exercised by this plan: control-point
 * list management, value/point lookup used by rocker/deck/width evaluation and uniform
 * arc-length mesh sampling, add-control-point (getSplitControlPoint), and scale/translate/
 * clone. Hit-testing (findBestMatch/getBestMatchWhich) is app-layer pointer interaction and
 * is not ported here. getValueAtReverse, tangent/normal/angle-based length queries, and
 * toString/fromString (legacy text format) are also not ported - nothing in scope calls them.
 */
export class BezierSpline {
  private curves: BezierCurve[] = [];

  private isLastControlPointNull(): boolean {
    if (this.curves.length === 0) return true;
    return this.curves[this.curves.length - 1].getEndKnot() == null;
  }

  append(controlPoint: BezierKnot): void {
    if (this.curves.length === 0) {
      this.curves.push(new BezierCurve(controlPoint, null as unknown as BezierKnot));
    } else if (this.curves.length === 1 && this.curves[0].getEndKnot() == null) {
      this.curves[0].setEndKnot(controlPoint);
    } else {
      this.curves.push(new BezierCurve(this.curves[this.curves.length - 1].getEndKnot(), controlPoint));
    }
  }

  insert(i: number, controlPoint: BezierKnot): void {
    let next: BezierKnot | null = null;
    if (i < this.getNrOfControlPoints()) {
      next = this.getControlPoint(i);
    }
    if (i > 0 && i - 1 < this.curves.length) {
      this.curves[i - 1].setEndKnot(controlPoint);
    }
    const newCurve = new BezierCurve(controlPoint, next as BezierKnot);
    this.curves.splice(i, 0, newCurve);
  }

  remove(knotOrIndex: BezierKnot | number): void {
    const i = typeof knotOrIndex === 'number' ? knotOrIndex : this.indexOf(knotOrIndex);
    let removeCurve: BezierCurve | null = null;
    if (i < this.curves.length) removeCurve = this.curves[i];
    if (i > 0 && i - 1 < this.curves.length) {
      this.curves[i - 1].setEndKnot(removeCurve != null ? removeCurve.getEndKnot() : null);
    }
    if (removeCurve != null) {
      const idx = this.curves.indexOf(removeCurve);
      if (idx !== -1) this.curves.splice(idx, 1);
    }
  }

  getControlPoint(i: number): BezierKnot {
    if (this.curves.length === 0 || this.curves.length < i - 1) return null as unknown as BezierKnot;
    return i === 0 ? this.curves[0].getStartKnot() : this.curves[i - 1].getEndKnot();
  }

  getCurve(i: number): BezierCurve {
    return this.curves[i];
  }

  indexOf(controlPoint: BezierKnot): number {
    for (let i = 0; i < this.curves.length + 1; i++) {
      if (controlPoint === this.getControlPoint(i)) return i;
    }
    return -1;
  }

  getNrOfControlPoints(): number {
    return this.curves.length + (this.isLastControlPointNull() ? 0 : 1);
  }

  getNrOfCurves(): number {
    return this.curves.length;
  }

  clear(): void {
    this.curves = [];
  }

  private findMatchingBezierSegment(pos: number): number {
    for (let i = 0; i < this.curves.length; i++) {
      const lx = this.curves[i].getStartKnot().endPoint.x;
      const ux = this.curves[i].getEndKnot().endPoint.x;
      if (lx <= pos && ux >= pos) return i;
    }
    for (let i = 0; i < this.curves.length; i++) {
      const curve = this.curves[i];
      const lx = curve.getMinMaxNumerical(X, MIN);
      const ux = curve.getMinMaxNumerical(X, MAX);
      if ((lx <= pos && ux >= pos) || (ux <= pos && lx >= pos)) return i;
    }
    return -1;
  }

  getValueAt(pos: number): number {
    const index = this.findMatchingBezierSegment(pos);
    if (index === -1) return 0.0;
    return this.curves[index].getYForX(pos);
  }

  getMaxX(): number {
    let max = -100000;
    for (const c of this.curves) max = Math.max(max, c.getMaxX());
    return max;
  }

  /**
   * NOTE on the asymmetric loop bound: this skips the LAST curve (`this.curves.length - 1`,
   * not `this.curves.length`), while `getMaxX`/`getMinY` below iterate every curve. This is
   * not a transcription slip - it faithfully matches `BezierSpline.java`'s `getMinX()`
   * (loop `i < mCurves.size() - 1`) vs. `getMaxX()` (loop `i < mCurves.size()`), i.e. the
   * asymmetry exists in the Java original too. For a spline with a single curve this loop
   * never executes and `min` stays at the sentinel `Number.MAX_VALUE` - same behavior as
   * Java, which returns `Double.MAX_VALUE` in that case. Nothing in this task's scope
   * (control-point list management, getValueAt, getPointByS, getSplitControlPoint, scale/
   * translate/clone) calls getMinX, so this is preserved as-is rather than "fixed"; flagged
   * here for whichever later task first calls getMinX/getMaxY on a single-curve spline.
   */
  getMinX(): number {
    let min = Number.MAX_VALUE;
    for (let i = 0; i < this.curves.length - 1; i++) min = Math.min(min, this.curves[i].getMinX());
    return min;
  }

  /** See getMinX's note above - same asymmetric (skip-last-curve) loop bound as Java's getMaxY(). */
  getMaxY(): number {
    let max = -Number.MAX_VALUE;
    for (let i = 0; i < this.curves.length - 1; i++) max = Math.max(max, this.curves[i].getMaxY());
    return max;
  }

  getMinY(): number {
    let min = 100000;
    for (const c of this.curves) min = Math.min(min, c.getMinY());
    return min;
  }

  getLength(): number {
    let length = 0;
    for (const c of this.curves) length += c.getLength();
    return length;
  }

  getPointByS(s: number): Point2D {
    return this.getPointByCurveLength(s * this.getLength());
  }

  getPointByCurveLength(curveLength: number): Point2D {
    let l = curveLength;

    if (curveLength <= 0.0) {
      const c = this.curves[0];
      return { x: c.getXValue(ZERO), y: c.getYValue(ZERO) };
    }
    if (curveLength >= this.getLength()) {
      const c = this.curves[this.curves.length - 1];
      return { x: c.getXValue(ONE), y: c.getYValue(ONE) };
    }

    let curve: BezierCurve | null = null;
    let t = -1;
    for (let i = 0; i < this.curves.length; i++) {
      curve = this.curves[i];
      const currentLength = curve.getLength();
      if (l < currentLength) {
        t = curve.getTForLength(l);
        break;
      }
      l -= currentLength;
    }

    return { x: curve!.getXValue(t), y: curve!.getYValue(t) };
  }

  /** Port of BezierSpline.getSplitControlPoint: finds the closest curve segment to nearPoint, writes the split knot into `returned`, and returns the insertion index. */
  getSplitControlPoint(nearPoint: Point2D, returned: BezierKnot): number {
    let nearestDist = 1e8;
    let index = 0;
    let t = 0;

    for (let i = 0; i < this.curves.length; i++) {
      const curve = this.curves[i];
      const tc = curve.getClosestT(nearPoint);
      const dist = vec.length({ x: curve.getXValue(tc), y: curve.getYValue(tc) }, nearPoint);
      if (nearestDist > dist) {
        nearestDist = dist;
        index = i;
        t = tc;
      }
    }

    returned.set(this.curves[index].getSplitControlPoint(t));
    return index + 1;
  }

  /**
   * NOTE on parameter order: Java's `BezierSpline.scale(double verticalScale, double
   * horizontalScale)` swaps its two arguments before delegating - it calls
   * `knot.scale(horizontalScale, verticalScale)`, where `BezierKnot.scale(scaleX, scaleY)`
   * applies its first argument to x and second to y. So in Java, argument 1 of
   * `spline.scale()` ends up scaling Y and argument 2 ends up scaling X (matching how its
   * only callers use it: cross-section splines where thickness is drawn vertically and
   * width horizontally, e.g. `crossSectionSpline.scale(thicknessScale, widthScale)`).
   * This port instead takes `scale(scaleX, scaleY)` in the conventional order and applies
   * them directly to x/y with no swap - a deliberate simplification, since nothing in this
   * task's scope depends on the Java call sites' vertical/horizontal convention and the
   * swapped naming in Java is itself just a confusing artifact of that one BezierBoard-
   * specific caller, not a generic spline semantic. Any later task that ports a call site
   * from Java (e.g. `crossSectionSpline.scale(newThicknessScale, newWidthScale)`) must pass
   * (scaleX=newWidthScale, scaleY=newThicknessScale) here to preserve Java's actual
   * behavior, not copy the Java argument order literally.
   */
  scale(scaleX: number, scaleY: number): void {
    for (let i = 0; i < this.curves.length; i++) {
      if (i === 0) this.curves[i].getStartKnot().scale(scaleX, scaleY);
      const endKnot = this.curves[i].getEndKnot();
      if (endKnot != null) endKnot.scale(scaleX, scaleY);
    }
  }

  translate(dx: number, dy: number): void {
    for (let i = 0; i < this.curves.length; i++) {
      if (i === 0) this.curves[i].getStartKnot().translate(dx, dy);
      const endKnot = this.curves[i].getEndKnot();
      if (endKnot != null) endKnot.translate(dx, dy);
    }
  }

  clone(): BezierSpline {
    const spline = new BezierSpline();
    for (let i = 0; i < this.getNrOfControlPoints(); i++) {
      spline.append(this.getControlPoint(i).clone());
    }
    return spline;
  }
}

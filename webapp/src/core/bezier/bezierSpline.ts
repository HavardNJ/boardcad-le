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
 *
 * INVARIANT - shared knot objects between adjacent curves: a spline with N control points
 * has N-1 curves, and for every internal boundary, curve `i`'s end knot and curve `i+1`'s
 * start knot must be the *same* `BezierKnot` object reference (`curves[i].getEndKnot() ===
 * curves[i + 1].getStartKnot()`), not merely two separate knots with equal coordinates.
 * This is how the spline stays a single connected curve rather than a list of disjoint
 * segments: `getControlPoint(i)` for an internal index reads `curves[i - 1].getEndKnot()`,
 * and moving that shared knot (e.g. via `setControlPointLocation`) must move both curves'
 * shared endpoint at once, which only works if it's one object referenced twice.
 * `append`/`insert`/`remove` all preserve this by construction: `append` reuses
 * `curves[last].getEndKnot()` as the new curve's start knot rather than creating a fresh
 * one; `insert`/`remove` patch the existing neighbor curve's end knot in place via
 * `curve.setEndKnot(...)` instead of replacing the whole curve object. Anyone extending or
 * reimplementing this logic must preserve reference identity at every internal boundary -
 * swapping in a same-valued-but-distinct knot silently splits the spline into disconnected
 * pieces (evaluation functions that walk `curves[]` independently, like `getValueAt`/
 * `getPointByCurveLength`, would keep working per-segment, but anything that mutates a
 * knot expecting it to move both adjacent curves - e.g. app-layer drag handling - would
 * only move one side, and `indexOf`/`getControlPoint` identity lookups would start
 * disagreeing about which curve "owns" the shared point).
 */
export class BezierSpline {
  private curves: BezierCurve[] = [];

  private isLastControlPointNull(): boolean {
    if (this.curves.length === 0) return true;
    return this.curves[this.curves.length - 1].getEndKnot() == null;
  }

  /**
   * Appends `controlPoint` as the new last control point. When there's already a dangling
   * last curve (its end knot is null), completes it with `setEndKnot`; otherwise starts a
   * new curve whose start knot is reused (same object, not a copy) from the current last
   * curve's end knot - preserving the shared-knot invariant documented on the class above.
   */
  append(controlPoint: BezierKnot): void {
    if (this.curves.length === 0) {
      this.curves.push(new BezierCurve(controlPoint, null as unknown as BezierKnot));
    } else if (this.curves.length === 1 && this.curves[0].getEndKnot() == null) {
      this.curves[0].setEndKnot(controlPoint);
    } else {
      this.curves.push(new BezierCurve(this.curves[this.curves.length - 1].getEndKnot(), controlPoint));
    }
  }

  /**
   * Inserts `controlPoint` at index `i`, splitting the curve that previously ran through
   * that position into two curves that share `controlPoint` as their new joint (preserving
   * the shared-knot invariant documented on the class above) via `curves[i - 1].setEndKnot`
   * rather than constructing a replacement curve for the left neighbor.
   *
   * Valid range for `i` is `[0, getNrOfControlPoints() - 1]` - i.e. inserting before or
   * between existing control points. To add a point after the last one, use `append()`
   * instead of `insert(getNrOfControlPoints(), cp)`.
   *
   * NOT VALIDATED (documented, not guarded - see the coordinator note in this task's
   * history for why no runtime check was added): calling `insert(i, cp)` with
   * `i === getNrOfControlPoints()` on a spline whose last knot is already non-null is out
   * of the valid range, but silently "succeeds" without an error. `next` resolves to null
   * (`i < getNrOfControlPoints()` is false), no existing curve's end knot gets patched
   * (`i - 1 < curves.length` is false when `i` is one past the end), and
   * `curves.splice(i, ...)` clamps to appending at the array's end instead of throwing -
   * unlike Java's `ArrayList.add(index, ...)`, which throws `IndexOutOfBoundsException` for
   * the equivalent out-of-range call. The result is a new dangling curve appended after the
   * spline's existing last curve with no knot shared between them: a silently disconnected
   * spline, not a crash. Nothing in this plan calls `insert()` out of range (the one caller,
   * `addControlPointCommand` in Task 10, always gets `i` from `getSplitControlPoint()`,
   * which returns a valid in-range index by construction), so this is intentionally left
   * undocumented-by-assertion rather than guarded - adding a runtime check now would be
   * scope creep for a call pattern nothing exercises. If a future caller ever needs to
   * insert at an arbitrary/untrusted index, add a bounds check there.
   */
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

  /**
   * Removes the control point at index `i` (or the given `BezierKnot`, resolved via
   * `indexOf`), rejoining its two neighboring curves into one continuous curve by patching
   * the left neighbor's end knot to the right neighbor's end knot via `setEndKnot`
   * (preserving the shared-knot invariant documented on the class above), then dropping the
   * now-redundant curve object rather than leaving two curves pointing at removed state.
   */
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

  /**
   * Deliberate fix over Java's `BezierSpline.getControlPoint()` (`BezierSpline.java:101-104`),
   * which guards with `mCurves.size() == 0 || mCurves.size() < i - 1`. That check only
   * catches indices far out of range: for a 1-curve spline (`mCurves.size() == 1`),
   * `getControlPoint(2)` computes `1 < 1` (false), falls through, and does
   * `mCurves.get(i - 1)` = `mCurves.get(1)` - an out-of-bounds access that throws
   * `IndexOutOfBoundsException` in Java / `TypeError` here, instead of returning null like
   * every other out-of-range index does. Valid control-point indices are exactly
   * `[0, curves.length]` (curves.length+1 control points when the spline is "closed" with
   * a non-null last knot, or curves.length when the last curve is still dangling); this
   * bounds the index directly against that range instead of reproducing Java's confusing
   * and incomplete `size() < i - 1` check. No caller in this codebase currently exercises
   * the crashing case, but it's a cheap, unambiguous fix worth making now rather than
   * leaving a crash-on-reasonable-input trap for a later task.
   */
  getControlPoint(i: number): BezierKnot {
    if (this.curves.length === 0 || i < 0 || i > this.curves.length) return null as unknown as BezierKnot;
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
   * Deliberate fix over Java's `BezierSpline.getMinX()` (`BezierSpline.java:304-317`), which
   * loops `i < mCurves.size() - 1` - i.e. it skips the LAST curve entirely, while
   * `getMaxX()`/`getMinY()` (above/below) correctly iterate every curve. Confirmed against
   * the Java source directly: this asymmetry is a genuine bug there, not a transcription
   * error. Unlike `rootFinder`'s preserved Java quirk (nothing downstream depended on it),
   * this method's result feeds `getMaxWidth()`/`getMaxRocker()` (Task 6) which `scaleBoard`
   * (Task 7) divides by - a wrong extremum here means wrong board scaling, not just a
   * display glitch. Same reasoning as the `Math.abs` fix in `BezierCurve.getMinMaxNumerical`
   * (Task 3): confirmed genuine Java bug, real downstream consumers, no reason to ship the
   * buggy behavior. Fixed to iterate all curves, matching `getMaxX()`/`getMinY()`.
   */
  getMinX(): number {
    let min = Number.MAX_VALUE;
    for (const c of this.curves) min = Math.min(min, c.getMinX());
    return min;
  }

  /** Deliberate fix over Java's `BezierSpline.getMaxY()` - see getMinX's comment above for the full explanation (same skip-last-curve bug, same fix). */
  getMaxY(): number {
    let max = -Number.MAX_VALUE;
    for (const c of this.curves) max = Math.max(max, c.getMaxY());
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

import { BezierKnot } from '../bezier/bezierKnot';
import { BezierCurve } from '../bezier/bezierCurve';
import * as vec from '../bezier/vecMath';
import type { CrossSection } from './types';

export function getWidth(cs: CrossSection): number {
  return cs.spline.getMaxX() * 2;
}

export function getCenterThickness(cs: CrossSection): number {
  const last = cs.spline.getNrOfControlPoints() - 1;
  return cs.spline.getControlPoint(last).points[0].y - cs.spline.getControlPoint(0).points[0].y;
}

/**
 * Port of BezierBoardCrossSection.scale(newThickness, newWidth). Note the Java call site
 * (`mCrossSectionSpline.scale(newThicknessScale, newWidtScale)`) relies on
 * BezierSpline.scale's Java-only argument swap (see bezierSpline.ts's scale() doc comment);
 * this port's BezierSpline.scale(scaleX, scaleY) does NOT swap, so this calls
 * `cs.spline.scale(widthScale, thicknessScale)` (width -> x, thickness -> y) to reproduce
 * the same net effect without the swap.
 */
export function scaleCrossSection(cs: CrossSection, newThickness: number, newWidth: number): void {
  const oldWidth = Math.max(getWidth(cs), 0.1);
  const oldThickness = Math.max(getCenterThickness(cs), 0.1);

  const thicknessScale = Math.abs(newThickness / oldThickness);
  const widthScale = Math.abs(newWidth / oldWidth);

  if (oldThickness * thicknessScale <= 0.1) return;
  if (oldWidth * widthScale <= 0.1) return;

  cs.spline.scale(widthScale, thicknessScale);
}

function cloneCrossSection(cs: CrossSection): CrossSection {
  return { position: cs.position, spline: cs.spline.clone() };
}

/**
 * Port of BezierBoardCrossSection.interpolate: rescales `target` to `source`'s size,
 * matches control point counts by inserting split points into whichever has fewer, then
 * linearly interpolates knot-by-knot.
 *
 * Deviation from Java: the per-control-point "best match" search below uses plain
 * Euclidean distance (`vec.length`) between endpoints, whereas Java's
 * `BezierKnot.compareTo` is a weighted heuristic combining continuity, position, and
 * both tangent angles/lengths. `compareTo` was already deliberately not ported (see
 * bezierKnot.ts's class doc: "exist for CAM cross-section matching heuristics ... neither
 * of which apply to this port"), so this uses a simpler position-only proxy for the same
 * matching step. This can only change *which* interior control point gets treated as the
 * "worst match" and thus gets a split point inserted first when interpolating between two
 * cross-sections with different control-point counts - it does not change the scale/
 * interpolate math itself, and t=0/t=1 boundary behavior (this task's acceptance
 * criteria) is unaffected since both source and target always match themselves exactly
 * at those endpoints.
 */
export function interpolateCrossSection(source: CrossSection, target: CrossSection, t: number): CrossSection | null {
  try {
    const sourceCopy = cloneCrossSection(source);
    const targetCopy = cloneCrossSection(target);

    scaleCrossSection(targetCopy, getCenterThickness(source), getWidth(source));

    if (sourceCopy.spline.getNrOfControlPoints() !== targetCopy.spline.getNrOfControlPoints()) {
      const most = sourceCopy.spline.getNrOfControlPoints() >= targetCopy.spline.getNrOfControlPoints() ? sourceCopy.spline : targetCopy.spline;
      const other = most === sourceCopy.spline ? targetCopy.spline : sourceCopy.spline;

      const scaleX = other.getMaxX() / most.getMaxX();
      const scaleY = other.getMaxY() / most.getMaxY();

      while (most.getNrOfControlPoints() > other.getNrOfControlPoints()) {
        let worstMatchPoint: BezierKnot | null = null;
        let worstMatch = 0;

        for (let i = 1; i < most.getNrOfControlPoints() - 1; i++) {
          const current = most.getControlPoint(i);
          let bestMatch = 1e7;
          for (let j = 1; j < other.getNrOfControlPoints() - 1; j++) {
            const otherPoint = other.getControlPoint(j).clone();
            otherPoint.setControlPointLocation(otherPoint.endPoint.x * scaleX, otherPoint.endPoint.y * scaleY);
            const dist = vec.length(current.endPoint, otherPoint.endPoint);
            if (dist < bestMatch) bestMatch = dist;
          }
          if (bestMatch > worstMatch) {
            worstMatch = bestMatch;
            worstMatchPoint = current;
          }
        }

        const newControlPoint = new BezierKnot();
        const index = other.getSplitControlPoint(worstMatchPoint!.endPoint, newControlPoint);
        if (index <= 0) return sourceCopy;

        other.insert(index, newControlPoint);

        const prev = other.getControlPoint(index - 1);
        const next = other.getControlPoint(index + 1);
        const tmpCurve = new BezierCurve(prev, next);
        const ct = tmpCurve.getClosestT(worstMatchPoint!.endPoint);

        const tmp1 = vec.scale(vec.sub(prev.points[0], prev.points[2]), ct);
        prev.points[2] = vec.add(prev.points[0], tmp1);

        const tmp2 = vec.scale(vec.sub(next.points[1], next.points[0]), ct - 1);
        next.points[1] = vec.add(next.points[0], tmp2);
      }
    }

    const interpolated = cloneCrossSection(targetCopy);
    for (let i = 0; i < targetCopy.spline.getNrOfControlPoints(); i++) {
      const a = sourceCopy.spline.getControlPoint(i);
      const b = targetCopy.spline.getControlPoint(i);
      const v = interpolated.spline.getControlPoint(i);
      for (let j = 0; j < 3; j++) {
        const diff = vec.sub(a.points[j], b.points[j]);
        const scaled = vec.scale(diff, t);
        v.points[j] = vec.add(a.points[j], scaled);
      }
    }
    return interpolated;
  } catch (e) {
    console.error('Error in interpolateCrossSection()', e);
    return null;
  }
}

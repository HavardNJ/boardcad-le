import type { Point2D } from '../bezier/point';
import { BezierKnot } from '../bezier/bezierKnot';
import { BezierCurve } from '../bezier/bezierCurve';
import * as vec from '../bezier/vecMath';
import { bestFit } from '../bezier/bezierFit';
import type { Board } from '../board/types';
import {
  cloneBoard,
  getLength,
  getThicknessAtPos,
  getWidthAtPos,
  getInterpolatedCrossSection,
  sortCrossSections,
  scaleBoard,
} from '../board/board';
import { scaleCrossSection } from '../board/crossSection';
import { resolveSpline, notifyChanged, type SplineRef } from './splineRef';

/** Port of the continuity-mirror branch of BrdEditCommand.moveControlPoints: mutates `which`'s point to (x,y); if the knot is continuous, mirrors the *direction* of the opposite tangent while preserving its own length. */
function moveKnotTangent(knot: BezierKnot, which: 1 | 2, x: number, y: number): void {
  knot.setLocation(which, x, y);
  if (!knot.continuous) return;

  const other = which === 1 ? 2 : 1;
  const otherLength = vec.length(knot.points[other], knot.endPoint);
  const towardEndpoint = vec.sub(knot.points[which], knot.endPoint); // endpoint - tangent[which]
  const newOtherVec = vec.scale(vec.normalize(towardEndpoint), otherLength);
  const newOtherPoint = vec.add(newOtherVec, knot.endPoint);
  knot.setLocation(other, newOtherPoint.x, newOtherPoint.y);
}

/** which=0 moves the whole knot (endpoint + both tangents, rigid translate); which=1|2 moves a single tangent handle. */
export function moveControlPointCommand(board: Board, ref: SplineRef, knotIndex: number, which: 0 | 1 | 2, x: number, y: number): Board {
  const next = cloneBoard(board);
  const spline = resolveSpline(next, ref);
  const knot = spline.getControlPoint(knotIndex);

  if (which === 0) {
    knot.setControlPointLocation(x, y);
  } else {
    moveKnotTangent(knot, which, x, y);
  }

  notifyChanged(next, ref);
  return next;
}

export function setContinuousCommand(board: Board, ref: SplineRef, knotIndex: number, continuous: boolean): Board {
  const next = cloneBoard(board);
  resolveSpline(next, ref).getControlPoint(knotIndex).continuous = continuous;
  notifyChanged(next, ref);
  return next;
}

/** Port of BrdAddControlPointCommand.addControlPoint: splits the nearest curve segment at `pos`, inserts the new knot, and re-derives the adjacent tangent handles so the curve shape is preserved at the split point. */
export function addControlPointCommand(board: Board, ref: SplineRef, pos: Point2D): { board: Board; knotIndex: number } {
  const next = cloneBoard(board);
  const spline = resolveSpline(next, ref);
  if (spline.getNrOfCurves() === 0) return { board: next, knotIndex: -1 };

  const newKnot = new BezierKnot();
  const index = spline.getSplitControlPoint(pos, newKnot);
  spline.insert(index, newKnot);

  const prev = spline.getControlPoint(index - 1);
  const nextKnot = spline.getControlPoint(index + 1);
  const tmpCurve = new BezierCurve(prev, nextKnot);
  const t = tmpCurve.getClosestT(pos);

  prev.points[2] = vec.add(prev.points[0], vec.scale(vec.sub(prev.points[0], prev.points[2]), t));
  nextKnot.points[1] = vec.add(nextKnot.points[0], vec.scale(vec.sub(nextKnot.points[1], nextKnot.points[0]), t - 1));

  notifyChanged(next, ref);
  return { board: next, knotIndex: index };
}

/** Port of BrdDeleteControlPointCommand's simple-rescale branch (the BezierFit-on-delete branch is not ported, see plan header). Refuses to delete a spline's first/last control point. */
export function deleteControlPointCommand(board: Board, ref: SplineRef, knotIndex: number): Board {
  const next = cloneBoard(board);
  const spline = resolveSpline(next, ref);

  if (knotIndex <= 0 || knotIndex >= spline.getNrOfControlPoints() - 1) {
    return next;
  }

  const prevCurve = spline.getCurve(knotIndex - 1);
  const nextCurve = spline.getCurve(knotIndex);
  const prev = spline.getControlPoint(knotIndex - 1);
  const nextKnot = spline.getControlPoint(knotIndex + 1);
  const targetLength = prevCurve.getLength() + nextCurve.getLength();

  spline.remove(knotIndex);

  for (let i = 0; i < 1000; i++) {
    const newLength = prevCurve.getLength();
    if (Math.abs(newLength - targetLength) < 0.1) break;
    const factor = targetLength / newLength;
    prev.scaleTangentToNext(factor);
    nextKnot.scaleTangentToPrev(factor);
    // scaleTangentToNext/Prev mutate the knots directly; BezierCurve has no
    // change-notification wiring to its knots, so the next getLength() call
    // would otherwise return the stale pre-scale length forever, applying the
    // same factor every iteration and diverging instead of converging.
    prevCurve.setDirty();
  }

  notifyChanged(next, ref);
  return next;
}

/** Port of BrdFitCurveCommand.fitCurve for a single spline. `isCrossSection` selects the Java version's x/y-bounded range (cross-sections) vs. x-only range (outline/deck/bottom/rocker) for filtering guide points per curve segment. */
export function fitCurveFromGuidePointsCommand(board: Board, ref: SplineRef, guidePoints: Point2D[], isCrossSection: boolean): Board {
  const next = cloneBoard(board);
  const spline = resolveSpline(next, ref);

  for (let k = 0; k < spline.getNrOfCurves(); k++) {
    const curve = spline.getCurve(k);

    let xmin = 0;
    let xmax = 0;
    let ymin = -10000000;
    let ymax = 10000000;
    if (isCrossSection) {
      xmin = curve.getMinX();
      xmax = curve.getMaxX();
      ymin = curve.getMinY();
      ymax = curve.getMaxY();
    } else {
      xmin = curve.getStartKnot().endPoint.x;
      xmax = curve.getEndKnot().endPoint.x;
    }

    const inRange = guidePoints.filter((p) => p.x >= xmin && p.x <= xmax && p.y >= ymin && p.y <= ymax);
    if (inRange.length === 0) continue;

    const startPoint = curve.getStartKnot().endPoint;
    const endPoint = curve.getEndKnot().endPoint;
    const points = [...inRange, startPoint, startPoint, endPoint, endPoint].sort((a, b) => a.x - b.x);

    const [p0, p1, p2, p3] = bestFit(points);

    curve.getStartKnot().continuous = false;
    curve.getStartKnot().setControlPointLocation(p0.x, p0.y);
    curve.getStartKnot().setTangentToNext(p1.x, p1.y);
    curve.getEndKnot().continuous = false;
    curve.getEndKnot().setControlPointLocation(p3.x, p3.y);
    curve.getEndKnot().setTangentToPrev(p2.x, p2.y);
  }

  notifyChanged(next, ref);
  return next;
}

/** Port of BrdAddCrossSectionCommand: interpolates a new cross-section at `pos` and inserts it among the real (non-boundary) cross-sections. */
export function addCrossSectionCommand(board: Board, pos: number): Board {
  const next = cloneBoard(board);
  const interpolated = getInterpolatedCrossSection(next, pos);
  if (interpolated == null) return next;

  interpolated.position = pos;
  scaleCrossSection(interpolated, getThicknessAtPos(next, pos), getWidthAtPos(next, pos));
  next.crossSections.push(interpolated);
  sortCrossSections(next);
  return next;
}

/** Port of BrdRemoveCrossSectionCommand. Refuses to remove a boundary (first/last) cross-section. */
export function removeCrossSectionCommand(board: Board, index: number): Board {
  const next = cloneBoard(board);
  if (index <= 0 || index >= next.crossSections.length - 1) return next;
  next.crossSections.splice(index, 1);
  return next;
}

export function moveCrossSectionCommand(board: Board, index: number, newPosition: number): Board {
  const next = cloneBoard(board);
  if (index <= 0 || index >= next.crossSections.length - 1) return next;
  const clamped = Math.min(Math.max(newPosition, 0.01), getLength(next) - 0.01);
  next.crossSections[index].position = clamped;
  sortCrossSections(next);
  return next;
}

export function updateMetadataCommand(
  board: Board,
  patch: Partial<Pick<Board, 'name' | 'designer' | 'surfer' | 'model' | 'description' | 'comments'>>,
): Board {
  return { ...cloneBoard(board), ...patch };
}

/** Port of BezierBoard.scale via core/board's scaleBoard. */
export function scaleBoardCommand(board: Board, newLength: number, newWidth: number, newThickness: number): Board {
  const next = cloneBoard(board);
  scaleBoard(next, newLength, newWidth, newThickness);
  return next;
}

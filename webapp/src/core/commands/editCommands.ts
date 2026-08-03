import type { Point2D } from '../bezier/point';
import { BezierKnot } from '../bezier/bezierKnot';
import { BezierCurve } from '../bezier/bezierCurve';
import * as vec from '../bezier/vecMath';
import { bestFit } from '../bezier/bezierFit';
import type { Board } from '../board/types';
import {
  cloneBoard,
  getLength,
  getInterpolatedCrossSection,
  sortCrossSections,
  scaleBoard,
} from '../board/board';
import { resolveSpline, notifyChanged, type SplineRef } from './splineRef';

/** Port of the continuity-mirror branch of BrdEditCommand.moveControlPoints: mutates `which`'s point to (x,y); if the knot is continuous, mirrors the *direction* of the opposite tangent while preserving its own length. */
export function moveKnotTangent(knot: BezierKnot, which: 1 | 2, x: number, y: number): void {
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
    // isCrossSection's getMinX/MaxX/MinY/MaxY calls above already forced this curve's
    // coefficient cache to compute (and freeze) against the PRE-fit knot positions;
    // without this, the curve would keep evaluating its old shape until some unrelated
    // later edit happened to call setDirty() on it (same bug class fixed for
    // deleteControlPointCommand's convergence loop above).
    curve.setDirty();
  }

  notifyChanged(next, ref);
  return next;
}

/**
 * Small enough to be invisible in normal use (cm), large enough to keep positions safely
 * distinguishable by both floating-point equality and interpolation math.
 */
export const CROSS_SECTION_MIN_SPACING = 0.1;

/**
 * Nudges `desiredPosition` away from every OTHER cross-section's position (boundaries
 * included; `excludeIndex` skips comparing a cross-section against itself when moving an
 * existing one) so no two cross-sections in the result end up within
 * `CROSS_SECTION_MIN_SPACING` of each other.
 *
 * Two cross-sections at (near-)identical positions are ill-defined for more than just the
 * app layer's position-based selection tracking (see app/editor2d/BoardEditorPanel): this
 * board's own `getInterpolatedCrossSection` divides by `secondPos - firstPos`, so a
 * near-zero gap between adjacent cross-sections blows up that division. This is a genuine
 * core-model invariant, not a UI-only concern - hence living here rather than in the app
 * layer, and applying to BOTH `addCrossSectionCommand` (which can otherwise duplicate the
 * position of an already-added cross-section, e.g. two consecutive "Add Cross-Section"
 * clicks at the board's midpoint) and `moveCrossSectionCommand` (which can otherwise move a
 * cross-section directly onto another's exact position).
 *
 * The scan-and-bump loop re-checks ALL positions after every bump (not just the one that
 * triggered it), so a bump that lands within range of a third cross-section keeps pushing
 * until no collision remains - bounded by `board.crossSections.length` iterations since
 * each full pass either finds zero collisions (loop exits) or resolves at least the
 * currently-nearest one. The final clamp back into the board's valid range is the
 * "no unique position exists" safety net for a board so densely packed that nudging alone
 * would push the position past the tail boundary; it does not re-scan for new collisions
 * introduced by the clamp itself; a real product would need a denser-packing story, but
 * that degenerate case is out of scope here.
 */
function resolveUniqueCrossSectionPosition(board: Board, desiredPosition: number, excludeIndex: number | null): number {
  let position = desiredPosition;
  let adjusted = true;
  let guard = 0;
  while (adjusted && guard <= board.crossSections.length) {
    adjusted = false;
    guard++;
    for (let i = 0; i < board.crossSections.length; i++) {
      if (i === excludeIndex) continue;
      if (Math.abs(board.crossSections[i].position - position) < CROSS_SECTION_MIN_SPACING) {
        position += CROSS_SECTION_MIN_SPACING;
        adjusted = true;
      }
    }
  }
  return Math.min(Math.max(position, 0.01), getLength(board) - 0.01);
}

/** Port of BrdAddCrossSectionCommand: interpolates a new cross-section at `pos` and inserts it among the real (non-boundary) cross-sections. */
export function addCrossSectionCommand(board: Board, pos: number): Board {
  const next = cloneBoard(board);
  // getInterpolatedCrossSection already sets `.position` and scales to the board's
  // thickness/width at `pos` (with a 0.5 floor) - redoing that here would call
  // scaleCrossSection with unclamped values, silently discarding that floor.
  const interpolated = getInterpolatedCrossSection(next, pos);
  if (interpolated == null) return next;

  // Nudge before pushing: resolveUniqueCrossSectionPosition compares against
  // next.crossSections as it currently stands (interpolated isn't in there yet), so no
  // excludeIndex is needed here.
  interpolated.position = resolveUniqueCrossSectionPosition(next, interpolated.position, null);
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

/**
 * Returns the actual resulting position alongside the board (not just the board) because
 * the caller can't reliably recover it afterward: `resolveUniqueCrossSectionPosition` may
 * have nudged `newPosition` away from a collision, and `sortCrossSections` may then have
 * moved the entry to a different array index - so `result.crossSections[index]` after the
 * fact is not guaranteed to still be the cross-section that was just moved. Returning the
 * exact value computed here (before any of that reshuffling) sidesteps needing to re-find
 * it by any kind of nearest-position search, which is the same fragile-by-construction
 * pattern this file's `resolveUniqueCrossSectionPosition` and the app layer's
 * `findActiveCrossSectionIndex` exist to work around, not to lean on further. Mirrors
 * `addControlPointCommand`'s existing `{ board, knotIndex }` shape for the same reason.
 */
export function moveCrossSectionCommand(board: Board, index: number, newPosition: number): { board: Board; position: number } {
  const next = cloneBoard(board);
  if (index <= 0 || index >= next.crossSections.length - 1) {
    return { board: next, position: next.crossSections[index]?.position ?? newPosition };
  }
  const clamped = Math.min(Math.max(newPosition, 0.01), getLength(next) - 0.01);
  const resolved = resolveUniqueCrossSectionPosition(next, clamped, index);
  next.crossSections[index].position = resolved;
  sortCrossSections(next);
  return { board: next, position: resolved };
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

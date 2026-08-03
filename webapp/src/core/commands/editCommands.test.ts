import { describe, it, expect } from 'vitest';
import { newBoard, getLength, getMaxWidth, getMaxThickness } from '../board/board';
import { BezierKnot } from '../bezier/bezierKnot';
import { BezierCurve } from '../bezier/bezierCurve';
import { BezierSpline } from '../bezier/bezierSpline';
import type { Board } from '../board/types';
import {
  moveControlPointCommand,
  addControlPointCommand,
  deleteControlPointCommand,
  fitCurveFromGuidePointsCommand,
  addCrossSectionCommand,
  removeCrossSectionCommand,
  moveCrossSectionCommand,
  scaleBoardCommand,
  CROSS_SECTION_MIN_SPACING,
} from './editCommands';

function boardWithSingleOutlineKnot(): Board {
  const b = newBoard();
  b.outline = new BezierSpline();
  b.outline.append(new BezierKnot(0, 0, -2, 0, 3, 0));
  b.outline.append(new BezierKnot(20, 0, 15, 0, 25, 0));
  return b;
}

describe('moveControlPointCommand', () => {
  it('mirrors the opposite tangent direction while preserving its own length (continuous knot)', () => {
    const board = boardWithSingleOutlineKnot();
    const result = moveControlPointCommand(board, 'outline', 0, 2, 0, 5);
    const knot = result.outline.getControlPoint(0);
    expect(knot.points[1].x).toBeCloseTo(0, 1);
    expect(knot.points[1].y).toBeCloseTo(-2, 1);
  });

  it('does not move the opposite tangent when the knot is not continuous', () => {
    const board = boardWithSingleOutlineKnot();
    board.outline.getControlPoint(0).continuous = false;
    const before = { ...board.outline.getControlPoint(0).points[1] };
    const result = moveControlPointCommand(board, 'outline', 0, 2, 0, 5);
    expect(result.outline.getControlPoint(0).points[1]).toEqual(before);
  });

  it('does not mutate the original board (immutability)', () => {
    const board = boardWithSingleOutlineKnot();
    const beforeX = board.outline.getControlPoint(0).points[2].x;
    moveControlPointCommand(board, 'outline', 0, 2, 0, 5);
    expect(board.outline.getControlPoint(0).points[2].x).toBe(beforeX);
  });
});

describe('addControlPointCommand', () => {
  it('inserts a knot and keeps the spline continuous through it', () => {
    const board = boardWithSingleOutlineKnot();
    const before = board.outline.getValueAt(10);
    const { board: result, knotIndex } = addControlPointCommand(board, 'outline', { x: 10, y: 0 });
    expect(knotIndex).toBe(1);
    expect(result.outline.getNrOfControlPoints()).toBe(3);
    expect(result.outline.getValueAt(10)).toBeCloseTo(before, 0);
  });
});

describe('deleteControlPointCommand', () => {
  it('refuses to delete the first or last control point', () => {
    const board = boardWithSingleOutlineKnot();
    expect(deleteControlPointCommand(board, 'outline', 0).outline.getNrOfControlPoints()).toBe(2);
    const lastIndex = board.outline.getNrOfControlPoints() - 1;
    expect(deleteControlPointCommand(board, 'outline', lastIndex).outline.getNrOfControlPoints()).toBe(2);
  });

  it('deletes a middle control point and preserves approximate curve length', () => {
    const board = boardWithSingleOutlineKnot();
    const { board: withMid } = addControlPointCommand(board, 'outline', { x: 10, y: 0 });
    const totalBefore = withMid.outline.getCurve(0).getLength() + withMid.outline.getCurve(1).getLength();
    const result = deleteControlPointCommand(withMid, 'outline', 1);
    expect(result.outline.getNrOfControlPoints()).toBe(2);
    expect(result.outline.getCurve(0).getLength()).toBeCloseTo(totalBefore, 0);
  });

  it('converges (not diverges to Infinity) for asymmetric non-degenerate tangent geometry', () => {
    // Regression test: the convergence loop used to call prevCurve.getLength() every
    // iteration without invalidating its cache after scaleTangentToNext/Prev mutated the
    // knots in place, so newLength was frozen after the first iteration and the same
    // factor got reapplied 1000 times, compounding geometrically instead of converging.
    // knot0 and knot2 (the knots that survive the deletion of knot1) both need genuine
    // off-axis tangent components here, or the merged curve degenerates to a straight
    // line whose length is invariant to tangent scaling regardless of caching.
    const board = newBoard();
    board.outline = new BezierSpline();
    board.outline.append(new BezierKnot(0, 0, -1, -3, 1, 3));
    board.outline.append(new BezierKnot(10, 0, 5, 5, 15, -5));
    board.outline.append(new BezierKnot(30, 0, 25, -4, 35, 4));
    const totalBefore = board.outline.getCurve(0).getLength() + board.outline.getCurve(1).getLength();

    const result = deleteControlPointCommand(board, 'outline', 1);

    const tangent = result.outline.getControlPoint(0).tangentToNext;
    expect(Number.isFinite(tangent.x)).toBe(true);
    expect(Number.isFinite(tangent.y)).toBe(true);
    expect(Math.abs(result.outline.getCurve(0).getLength() - totalBefore)).toBeLessThan(0.5);
  });
});

describe('fitCurveFromGuidePointsCommand', () => {
  it('skips curves with no guide points in range', () => {
    const board = boardWithSingleOutlineKnot();
    const beforeP0 = { ...board.outline.getControlPoint(0).points[0] };
    const result = fitCurveFromGuidePointsCommand(board, 'outline', [{ x: 1000, y: 1000 }], false);
    expect(result.outline.getControlPoint(0).points[0]).toEqual(beforeP0);
  });

  it('pulls a curve toward guide points within its x-range', () => {
    const board = boardWithSingleOutlineKnot();
    const guidePoints = Array.from({ length: 10 }, (_, i) => ({ x: (i / 9) * 20, y: 5 }));
    const result = fitCurveFromGuidePointsCommand(board, 'outline', guidePoints, false);
    expect(result.outline.getValueAt(10)).toBeGreaterThan(2);
  });

  it('isCrossSection=true returns a curve whose cached evaluation reflects the fitted shape, not the pre-fit shape', () => {
    // Regression test: the isCrossSection branch calls curve.getMinX/MaxX/MinY/MaxY to
    // compute the guide-point filter range BEFORE the fit mutates the curve's knots.
    // Those calls force-compute (and freeze) the curve's cached coefficients against the
    // PRE-fit knot positions; without an explicit setDirty() after the mutation, the
    // curve keeps evaluating its old shape. Guide points must stay inside the original
    // curve's small y-bounds (~±0.29 here) or the range filter skips the curve entirely,
    // which would make this test pass trivially without exercising the bug.
    const board = newBoard();
    board.outline = new BezierSpline();
    board.outline.append(new BezierKnot(0, 0, -2, 0, 2, 1));
    board.outline.append(new BezierKnot(10, 0, 8, -1, 12, 0));
    const guidePoints = Array.from({ length: 10 }, (_, i) => ({ x: (i / 9) * 10, y: 0.2 }));

    const result = fitCurveFromGuidePointsCommand(board, 'outline', guidePoints, true);

    const curve = result.outline.getCurve(0);
    const cachedY = curve.getYValue(0.5);
    const freshCurve = new BezierCurve(curve.getStartKnot(), curve.getEndKnot());
    const freshY = freshCurve.getYValue(0.5);
    expect(Math.abs(cachedY - freshY)).toBeLessThan(0.001);
  });
});

describe('cross-section commands', () => {
  it('addCrossSectionCommand inserts a real (non-boundary) cross-section', () => {
    const board = newBoard();
    const before = board.crossSections.length;
    const result = addCrossSectionCommand(board, getLength(board) / 2);
    expect(result.crossSections.length).toBe(before + 1);
  });

  it('removeCrossSectionCommand refuses to remove boundary cross-sections', () => {
    const board = newBoard();
    const result = removeCrossSectionCommand(board, 0);
    expect(result.crossSections.length).toBe(board.crossSections.length);
  });

  it('moveCrossSectionCommand refuses to move boundary cross-sections', () => {
    const board = newBoard();
    const result = moveCrossSectionCommand(board, 0, getLength(board) / 2);
    expect(result.board.crossSections[0].position).toBe(board.crossSections[0].position);
    expect(result.position).toBe(board.crossSections[0].position);
  });

  it('moveCrossSectionCommand moves a real cross-section to the requested (clamped) position', () => {
    const board = newBoard();
    const withReal = addCrossSectionCommand(board, getLength(board) / 2);
    const realIndex = withReal.crossSections.findIndex(
      (cs) => cs !== withReal.crossSections[0] && cs !== withReal.crossSections[withReal.crossSections.length - 1],
    );
    const newPos = getLength(withReal) * 0.75;
    const result = moveCrossSectionCommand(withReal, realIndex, newPos);
    expect(result.board.crossSections[realIndex].position).toBeCloseTo(newPos, 5);
    expect(result.position).toBeCloseTo(newPos, 5);
  });
});

describe('cross-section position uniqueness', () => {
  it('addCrossSectionCommand nudges a new cross-section away from an existing one added at the identical position', () => {
    // Regression: two consecutive "Add Cross-Section" clicks both call
    // addCrossSectionCommand(board, getLength(board) / 2) - the exact same midpoint - which
    // used to produce two cross-sections at an identical position, ill-defined for both
    // getInterpolatedCrossSection's interpolation math and any position-based identity
    // tracking (e.g. the app layer's selection tracking).
    const board = newBoard();
    const mid = getLength(board) / 2;
    const withFirst = addCrossSectionCommand(board, mid);
    const withSecond = addCrossSectionCommand(withFirst, mid);

    expect(withSecond.crossSections.length).toBe(board.crossSections.length + 2);
    const realPositions = withSecond.crossSections.slice(1, -1).map((cs) => cs.position);
    expect(realPositions.length).toBe(2);
    expect(Math.abs(realPositions[1] - realPositions[0])).toBeGreaterThanOrEqual(CROSS_SECTION_MIN_SPACING - 1e-9);
  });

  it('moveCrossSectionCommand nudges a cross-section away from another cross-section it is moved onto', () => {
    const board = newBoard();
    const length = getLength(board);
    const withFirst = addCrossSectionCommand(board, length * 0.3);
    const withSecond = addCrossSectionCommand(withFirst, length * 0.7);
    const targetPosition = withSecond.crossSections[2].position; // the ~0.7L real cross-section

    const result = moveCrossSectionCommand(withSecond, 1, targetPosition);

    // The moved cross-section's exact final position is `result.position`, not something
    // that needs to be re-found in `result.board` by index or nearest-match - see the
    // command's own doc comment for why that would be unreliable after sortCrossSections.
    expect(result.position).not.toBeCloseTo(targetPosition, 2);
    const realPositions = result.board.crossSections
      .slice(1, -1)
      .map((cs) => cs.position)
      .sort((a, b) => a - b);
    expect(realPositions.length).toBe(2);
    expect(realPositions).toContain(result.position);
    expect(Math.abs(realPositions[1] - realPositions[0])).toBeGreaterThanOrEqual(CROSS_SECTION_MIN_SPACING - 1e-9);
  });

  it('moveCrossSectionCommand still moves a cross-section normally when no collision occurs', () => {
    // Guards against the uniqueness fix accidentally perturbing the non-colliding case
    // covered by the existing "moves a real cross-section to the requested (clamped)
    // position" test above.
    const board = newBoard();
    const withReal = addCrossSectionCommand(board, getLength(board) / 2);
    const realIndex = 1;
    const newPos = getLength(withReal) * 0.75;
    const result = moveCrossSectionCommand(withReal, realIndex, newPos);
    expect(result.board.crossSections[realIndex].position).toBeCloseTo(newPos, 5);
    expect(result.position).toBeCloseTo(newPos, 5);
  });

  /** Every pair of cross-sections (including both boundaries) must be at least
   *  CROSS_SECTION_MIN_SPACING apart - the invariant this whole describe block exists to
   *  guarantee, not just "doesn't crash" or "isn't exactly equal". */
  function expectFullPairwiseSpacing(board: Board) {
    const positions = board.crossSections.map((cs) => cs.position).sort((a, b) => a - b);
    for (let i = 0; i < positions.length - 1; i++) {
      expect(positions[i + 1] - positions[i]).toBeGreaterThanOrEqual(CROSS_SECTION_MIN_SPACING - 1e-9);
    }
  }

  it('addCrossSectionCommand near the tail boundary maintains full spacing from both boundaries', () => {
    // Regression: addCrossSectionCommand(newBoard(), 179.95) on a 180cm board used to nudge
    // the position past the tail boundary (to 180.15) and then clamp it straight back to
    // 179.99 - only 0.01cm from the tail, well inside CROSS_SECTION_MIN_SPACING.
    const board = newBoard();
    const length = getLength(board);
    const result = addCrossSectionCommand(board, length - CROSS_SECTION_MIN_SPACING / 2);

    expect(result.crossSections.length).toBe(board.crossSections.length + 1);
    expectFullPairwiseSpacing(result);
  });

  it('addCrossSectionCommand near the head boundary maintains full spacing from both boundaries', () => {
    const board = newBoard();
    const result = addCrossSectionCommand(board, CROSS_SECTION_MIN_SPACING / 2);

    expect(result.crossSections.length).toBe(board.crossSections.length + 1);
    expectFullPairwiseSpacing(result);
  });

  it('moveCrossSectionCommand onto the tail boundary maintains full spacing from both boundaries', () => {
    const board = newBoard();
    const length = getLength(board);
    const withReal = addCrossSectionCommand(board, length / 2);

    const result = moveCrossSectionCommand(withReal, 1, length - CROSS_SECTION_MIN_SPACING / 2);

    expectFullPairwiseSpacing(result.board);
  });

  it('moveCrossSectionCommand onto the head boundary maintains full spacing from both boundaries', () => {
    const board = newBoard();
    const withReal = addCrossSectionCommand(board, getLength(board) / 2);

    const result = moveCrossSectionCommand(withReal, 1, CROSS_SECTION_MIN_SPACING / 2);

    expectFullPairwiseSpacing(result.board);
  });

  it('maintains full spacing (including boundaries) across a denser board with an add and a move near the tail', () => {
    // A slightly more realistic scenario than a single isolated add/move: several real
    // cross-sections already present, then a boundary-adjacent add and a boundary-adjacent
    // move, checking the FULL pairwise invariant (not just the two entries directly involved)
    // holds across the whole board afterward.
    const board = newBoard();
    const length = getLength(board);
    let b = addCrossSectionCommand(board, length * 0.25);
    b = addCrossSectionCommand(b, length * 0.5);
    b = addCrossSectionCommand(b, length * 0.75);
    b = addCrossSectionCommand(b, length - CROSS_SECTION_MIN_SPACING / 2);
    expectFullPairwiseSpacing(b);

    const moveResult = moveCrossSectionCommand(b, 1, length - CROSS_SECTION_MIN_SPACING / 2);
    expectFullPairwiseSpacing(moveResult.board);
  });
});

describe('scaleBoardCommand', () => {
  it('produces a board matching the requested length/width/thickness', () => {
    const board = newBoard();
    const result = scaleBoardCommand(board, 200, 50, 7);
    expect(getLength(result)).toBeCloseTo(200, 0);
    expect(getMaxWidth(result)).toBeCloseTo(50, 0);
    expect(getMaxThickness(result)).toBeCloseTo(7, 0);
  });
});

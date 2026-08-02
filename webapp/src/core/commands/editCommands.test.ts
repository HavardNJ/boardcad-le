import { describe, it, expect } from 'vitest';
import { newBoard, getLength, getMaxWidth, getMaxThickness } from '../board/board';
import { BezierKnot } from '../bezier/bezierKnot';
import { BezierSpline } from '../bezier/bezierSpline';
import type { Board } from '../board/types';
import {
  moveControlPointCommand,
  addControlPointCommand,
  deleteControlPointCommand,
  fitCurveFromGuidePointsCommand,
  addCrossSectionCommand,
  removeCrossSectionCommand,
  scaleBoardCommand,
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

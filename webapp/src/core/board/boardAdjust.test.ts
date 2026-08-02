import { describe, it, expect } from 'vitest';
import { BezierSpline } from '../bezier/bezierSpline';
import { BezierKnot } from '../bezier/bezierKnot';
import type { CrossSection } from './types';
import { getWidth, getCenterThickness, scaleCrossSection } from './crossSection';
import {
  newBoard,
  getLength,
  getMaxWidth,
  getMaxThickness,
  getWidthAtPos,
  getThicknessAtPos,
  sortCrossSections,
  adjustCrosssectionsToThicknessAndWidth,
} from './board';
import { getInterpolatedCrossSection, adjustRockerToZero, scaleBoard } from './board';

/** Builds a cross-section with exactly `n` control points, all interior points sitting at
 *  x=halfWidth (so getWidth() is predictably `halfWidth * 2`), evenly spaced in y from 0 to
 *  `thickness`. Used to give real (non-boundary) cross-sections a distinctive control-point
 *  count, so tests can tell which cross-section(s) getInterpolatedCrossSection actually used
 *  as its interpolation source(s) - not just that it returned *something* plausible. */
function makeCrossSection(n: number, halfWidth: number, thickness: number): CrossSection {
  const spline = new BezierSpline();
  spline.append(new BezierKnot(0, 0, 0, 0, halfWidth * 0.3, 0));
  for (let i = 1; i < n - 1; i++) {
    const y = (thickness * i) / (n - 1);
    spline.append(new BezierKnot(halfWidth, y, halfWidth, y, halfWidth, y));
  }
  spline.append(new BezierKnot(0, thickness, halfWidth * 0.3, thickness, 0, thickness));
  return { position: 0, spline };
}

describe('board adjust helpers', () => {
  it('getInterpolatedCrossSection returns null outside [0, length]', () => {
    const b = newBoard();
    expect(getInterpolatedCrossSection(b, -1)).toBeNull();
    expect(getInterpolatedCrossSection(b, getLength(b) + 1)).toBeNull();
  });

  it('getInterpolatedCrossSection returns a cross-section scaled to the board width/thickness at that x', () => {
    const b = newBoard();
    const x = getLength(b) / 2;
    const cs = getInterpolatedCrossSection(b, x)!;
    expect(cs).not.toBeNull();
    expect(cs.position).toBeCloseTo(x, 6);
  });

  it('adjustCrosssectionsToThicknessAndWidth updates a real (non-boundary) cross-section to match the board at its position', () => {
    const b = newBoard();
    const pos = getLength(b) / 3;

    const real = makeCrossSection(4, 5, 3);
    real.position = pos;
    // Perturb it so it does NOT already match the board's width/thickness at `pos` -
    // otherwise the assertion below couldn't distinguish "was adjusted" from "was already correct".
    scaleCrossSection(real, getCenterThickness(real) * 3, getWidth(real) * 3);
    b.crossSections.splice(1, 0, real);
    sortCrossSections(b);

    expect(getWidth(b.crossSections[1])).not.toBeCloseTo(getWidthAtPos(b, pos), 1);

    adjustCrosssectionsToThicknessAndWidth(b);

    expect(getWidth(b.crossSections[1])).toBeCloseTo(getWidthAtPos(b, pos), 3);
    expect(getCenterThickness(b.crossSections[1])).toBeCloseTo(getThicknessAtPos(b, pos), 3);
  });

  it('getInterpolatedCrossSection interpolates between the correct pair of real cross-sections', () => {
    // Two real cross-sections with distinct, easily-identified control-point counts (4 and
    // 6) inserted a third and two-thirds of the way down the board. If
    // getInterpolatedCrossSection picks the wrong pair (or silently falls back to the
    // boundary-to-boundary pair, ignoring the real cross-sections entirely), the resulting
    // control-point count gives it away: boundary cross-sections have 3, real1 has 4, real2
    // has 6, and a genuine blend of two mismatched counts is matched up to the larger one.
    const b = newBoard();
    const length = getLength(b);
    const real1Pos = length / 3;
    const real2Pos = (2 * length) / 3;

    const real1 = makeCrossSection(4, 8, 4);
    real1.position = real1Pos;
    const real2 = makeCrossSection(6, 9, 5);
    real2.position = real2Pos;

    b.crossSections.splice(1, 0, real1);
    b.crossSections.splice(2, 0, real2);
    sortCrossSections(b);
    expect(b.crossSections.map((cs) => cs.position)).toEqual([0, real1Pos, real2Pos, length]);

    // Before the first real cross-section: per BezierBoard's clamp logic (index gets reset
    // to 1 while nextIndex is left at its already-computed value of 1), this resolves to
    // real1 interpolated with itself, not a blend with the boundary - so the result keeps
    // real1's own control-point count (4).
    const before = getInterpolatedCrossSection(b, real1Pos / 2)!;
    expect(before).not.toBeNull();
    expect(before.position).toBeCloseTo(real1Pos / 2, 6);
    expect(before.spline.getNrOfControlPoints()).toBe(4);

    // Between the two real cross-sections: a genuine blend of real1 (4 control points) and
    // real2 (6 control points), matched up to the larger count.
    const mid = getInterpolatedCrossSection(b, (real1Pos + real2Pos) / 2)!;
    expect(mid).not.toBeNull();
    expect(mid.position).toBeCloseTo((real1Pos + real2Pos) / 2, 6);
    expect(mid.spline.getNrOfControlPoints()).toBe(6);

    // After the last real cross-section: symmetric to the "before" case - resolves to real2
    // interpolated with itself (control-point count 6), not a blend with the tail boundary.
    const after = getInterpolatedCrossSection(b, (real2Pos + length) / 2)!;
    expect(after).not.toBeNull();
    expect(after.position).toBeCloseTo((real2Pos + length) / 2, 6);
    expect(after.spline.getNrOfControlPoints()).toBe(6);
  });

  it('adjustRockerToZero makes the bottom spline minimum y exactly 0', () => {
    const b = newBoard();
    b.bottom.translate(0, 3); // push it out of alignment
    adjustRockerToZero(b);
    expect(b.bottom.getMinY()).toBeCloseTo(0, 6);
  });

  it('scaleBoard updates length/width/thickness and keeps the last cross-section pinned to the new length', () => {
    const b = newBoard();
    const newLength = getLength(b) * 2;
    scaleBoard(b, newLength, getMaxWidth(b) * 1.5, getMaxThickness(b) * 1.2);
    expect(getLength(b)).toBeCloseTo(newLength, 6);
    expect(b.crossSections[b.crossSections.length - 1].position).toBeCloseTo(newLength, 6);
  });
});

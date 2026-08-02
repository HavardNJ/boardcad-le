import { describe, it, expect } from 'vitest';
import { newBoard, getLength, getMaxWidth, getMaxThickness } from './board';
import { getInterpolatedCrossSection, adjustRockerToZero, scaleBoard } from './board';

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
    expect(getLength(b)).toBeCloseTo(newLength, 0);
    expect(b.crossSections[b.crossSections.length - 1].position).toBeCloseTo(newLength, 6);
  });
});

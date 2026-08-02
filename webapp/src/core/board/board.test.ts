import { describe, it, expect } from 'vitest';
import { newBoard, getLength, getWidthAtPos, getRockerAtPos, getDeckAtPos, getThicknessAtPos, getMaxWidth, cloneBoard } from './board';

describe('board basic accessors', () => {
  it('newBoard has two boundary cross-sections and a positive length', () => {
    const b = newBoard();
    expect(b.crossSections.length).toBeGreaterThanOrEqual(2);
    expect(getLength(b)).toBeGreaterThan(0);
  });

  it('getWidthAtPos returns twice the outline value at that x', () => {
    const b = newBoard();
    const half = b.outline.getValueAt(getLength(b) / 2);
    expect(getWidthAtPos(b, getLength(b) / 2)).toBeCloseTo(half * 2, 6);
  });

  it('getThicknessAtPos equals deck minus bottom at that x', () => {
    const b = newBoard();
    const x = getLength(b) / 2;
    expect(getThicknessAtPos(b, x)).toBeCloseTo(getDeckAtPos(b, x) - getRockerAtPos(b, x), 6);
  });

  it('getMaxWidth is derived from the outline spline, not stored', () => {
    const b = newBoard();
    expect(getMaxWidth(b)).toBeCloseTo(b.outline.getMaxY() * 2, 6);
  });

  it('cloneBoard rebinds slave links so editing the clone does not affect the original', () => {
    const b = newBoard();
    const clone = cloneBoard(b);
    const deckTailIndex = clone.deck.getNrOfControlPoints() - 1;
    const bottomTailIndex = clone.bottom.getNrOfControlPoints() - 1;
    const originalBottomTailPos = { ...b.bottom.getControlPoint(bottomTailIndex).points[0] };

    // Deck/bottom tail knots have xMask=0 (their x/length position is locked; only the
    // y/thickness coordinate is user-editable — see setLocks), so move y, not x.
    const deckTailX = clone.deck.getControlPoint(deckTailIndex).points[0].x;
    clone.deck.getControlPoint(deckTailIndex).setControlPointLocation(deckTailX, 999);

    // The clone's bottom tail should have moved (slave rebound to the clone's own bottom knot)...
    expect(clone.bottom.getControlPoint(bottomTailIndex).points[0].y).toBeCloseTo(999, 3);
    // ...but the ORIGINAL board's bottom tail should be untouched.
    expect(b.bottom.getControlPoint(bottomTailIndex).points[0]).toEqual(originalBottomTailPos);
  });
});

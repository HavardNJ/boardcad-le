import { describe, it, expect } from 'vitest';
import { newBoard, getLength, getWidthAtPos, getRockerAtPos, getDeckAtPos, getThicknessAtPos, getMaxWidth, cloneBoard } from './board';
import { LOCK_X_LESS, LOCK_X_MORE, LOCK_Y_MORE } from '../bezier/bezierKnot';

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

  it('setLocks masks the outline endpoints fully immovable (xMask=0, yMask=0)', () => {
    const b = newBoard();
    const last = b.outline.getNrOfControlPoints() - 1;
    const tail = b.outline.getControlPoint(0);
    const nose = b.outline.getControlPoint(last);
    expect(tail.xMask).toBe(0);
    expect(tail.yMask).toBe(0);
    expect(nose.xMask).toBe(0);
    expect(nose.yMask).toBe(0);
  });

  it('setLocks masks deck/bottom tail-nose endpoints to move only in y (xMask=0, yMask=1)', () => {
    const b = newBoard();
    const deckLast = b.deck.getNrOfControlPoints() - 1;
    const bottomLast = b.bottom.getNrOfControlPoints() - 1;
    for (const knot of [b.deck.getControlPoint(0), b.deck.getControlPoint(deckLast), b.bottom.getControlPoint(0), b.bottom.getControlPoint(bottomLast)]) {
      expect(knot.xMask).toBe(0);
      expect(knot.yMask).toBe(1);
    }
  });

  it('setLocks sets outline tangent lock bitmasks (LOCK_X_LESS/LOCK_X_MORE, plus LOCK_Y_MORE at the tail/nose)', () => {
    const b = newBoard();
    const last = b.outline.getNrOfControlPoints() - 1;
    // Every outline knot: tangent-to-prev can't cross past the endpoint on the +x side, tangent-to-next can't cross past it on the -x side.
    for (let i = 0; i <= last; i++) {
      const knot = b.outline.getControlPoint(i);
      expect(knot.tangentPrevLocks & LOCK_X_LESS).toBe(LOCK_X_LESS);
      expect(knot.tangentNextLocks & LOCK_X_MORE).toBe(LOCK_X_MORE);
    }
    // The tail's next-tangent and the nose's prev-tangent additionally get LOCK_Y_MORE (added on top of the LOCK_X_* base).
    const tail = b.outline.getControlPoint(0);
    const nose = b.outline.getControlPoint(last);
    expect(tail.tangentNextLocks).toBe(LOCK_X_MORE | LOCK_Y_MORE);
    expect(nose.tangentPrevLocks).toBe(LOCK_X_LESS | LOCK_Y_MORE);
  });

  it('setLocks slave-sync bulges the default "flat" bottom away from flat (see NOTE on newBoard in board.ts)', () => {
    const b = newBoard();
    // deck stays exactly flat at its constructed value...
    expect(getDeckAtPos(b, 0)).toBeCloseTo(6, 6);
    expect(getDeckAtPos(b, getLength(b) / 2)).toBeCloseTo(6, 6);
    expect(getDeckAtPos(b, getLength(b))).toBeCloseTo(6, 6);
    // ...but bottom's tail/nose endpoints get slave-snapped up to meet the deck (not left at 0)...
    expect(getRockerAtPos(b, 0)).toBeCloseTo(6, 6);
    expect(getRockerAtPos(b, getLength(b))).toBeCloseTo(6, 6);
    // ...which means thickness (deck - bottom) is 0 at both tips...
    expect(getThicknessAtPos(b, 0)).toBeCloseTo(0, 6);
    expect(getThicknessAtPos(b, getLength(b))).toBeCloseTo(0, 6);
    // ...but bulges well past the nominal 6 in the middle, while staying within the
    // [0, 12] bound implied by the Bezier convex hull (see the NOTE on newBoard).
    const midThickness = getThicknessAtPos(b, getLength(b) / 2);
    expect(midThickness).toBeGreaterThan(7);
    expect(midThickness).toBeLessThanOrEqual(12);
  });
});

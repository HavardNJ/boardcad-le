import { describe, it, expect } from 'vitest';
import { newBoard, getLength, getWidthAtPos, getRockerAtPos } from '../board/board';
import { moveControlPointCommand } from '../commands/editCommands';
import { serializeBoard, deserializeBoard, BoardFileError } from './boardFile';

describe('board JSON persistence', () => {
  it('round-trips a fresh board: same length, width, rocker, and cross-section count', () => {
    const board = newBoard();
    const json = serializeBoard(board);
    const restored = deserializeBoard(json);

    const x = getLength(board) / 2;
    expect(getLength(restored)).toBeCloseTo(getLength(board), 6);
    expect(getWidthAtPos(restored, x)).toBeCloseTo(getWidthAtPos(board, x), 6);
    expect(getRockerAtPos(restored, x)).toBeCloseTo(getRockerAtPos(board, x), 6);
    expect(restored.crossSections.length).toBe(board.crossSections.length);
  });

  it('round-trips metadata fields', () => {
    const board = newBoard();
    board.name = 'Test Board';
    board.designer = 'Jane';
    const restored = deserializeBoard(serializeBoard(board));
    expect(restored.name).toBe('Test Board');
    expect(restored.designer).toBe('Jane');
  });

  it('round-trips knot continuity flags', () => {
    const board = newBoard();
    board.outline.getControlPoint(1).continuous = false;
    const restored = deserializeBoard(serializeBoard(board));
    expect(restored.outline.getControlPoint(1).continuous).toBe(false);
  });

  it('round-trips tangent handle positions exactly, not just endpoints', () => {
    let board = newBoard();
    // Move a tangent handle to an asymmetric, non-default position.
    board = moveControlPointCommand(board, 'outline', 1, 1, -12.34, 56.78);
    const knotBefore = board.outline.getControlPoint(1);

    const restored = deserializeBoard(serializeBoard(board));
    const knotAfter = restored.outline.getControlPoint(1);

    expect(knotAfter.tangentToPrev.x).toBeCloseTo(knotBefore.tangentToPrev.x, 9);
    expect(knotAfter.tangentToPrev.y).toBeCloseTo(knotBefore.tangentToPrev.y, 9);
    expect(knotAfter.tangentToNext.x).toBeCloseTo(knotBefore.tangentToNext.x, 9);
    expect(knotAfter.tangentToNext.y).toBeCloseTo(knotBefore.tangentToNext.y, 9);
  });

  it('round-trips an interior (non-boundary) cross-section position and shape', () => {
    const board = newBoard();
    const length = getLength(board);
    const interior = { position: length / 3, spline: board.crossSections[0].spline.clone() };
    board.crossSections.splice(1, 0, interior);

    const restored = deserializeBoard(serializeBoard(board));

    expect(restored.crossSections.length).toBe(3);
    expect(restored.crossSections[1].position).toBeCloseTo(length / 3, 9);
    expect(restored.crossSections[1].spline.getNrOfControlPoints()).toBe(interior.spline.getNrOfControlPoints());
    for (let i = 0; i < interior.spline.getNrOfControlPoints(); i++) {
      const before = interior.spline.getControlPoint(i);
      const after = restored.crossSections[1].spline.getControlPoint(i);
      expect(after.endPoint.x).toBeCloseTo(before.endPoint.x, 9);
      expect(after.endPoint.y).toBeCloseTo(before.endPoint.y, 9);
    }
  });

  it('re-establishes deck/bottom nose-tail slave sync after deserialization (moving deck endpoint moves bottom)', () => {
    const board = newBoard();
    const restored = deserializeBoard(serializeBoard(board));

    const deckLast = restored.deck.getNrOfControlPoints() - 1;
    const bottomLast = restored.bottom.getNrOfControlPoints() - 1;
    const bottomTailBefore = { ...restored.bottom.getControlPoint(bottomLast).endPoint };

    restored.deck.getControlPoint(deckLast).setControlPointLocation(
      restored.deck.getControlPoint(deckLast).endPoint.x,
      restored.deck.getControlPoint(deckLast).endPoint.y + 3,
    );

    const bottomTailAfter = restored.bottom.getControlPoint(bottomLast).endPoint;
    expect(bottomTailAfter.y).toBeCloseTo(bottomTailBefore.y + 3, 9);
  });

  it('serializeBoard produces valid JSON text', () => {
    const board = newBoard();
    const text = serializeBoard(board);
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('deserializeBoard throws BoardFileError for garbage input', () => {
    expect(() => deserializeBoard('{"not":"a board"}')).toThrow(BoardFileError);
    expect(() => deserializeBoard('not even json')).toThrow(BoardFileError);
  });

  it('deserializeBoard throws BoardFileError for an unsupported formatVersion', () => {
    const board = newBoard();
    const parsed = JSON.parse(serializeBoard(board));
    parsed.formatVersion = 99;
    expect(() => deserializeBoard(JSON.stringify(parsed))).toThrow(BoardFileError);
  });

  it('deserializeBoard throws BoardFileError (not a raw TypeError) for a malformed control point', () => {
    // The container-level Array.isArray checks accept `outline: [{}]` (it IS an array),
    // but the element itself is missing point/tangentPrev/tangentNext/continuous.
    // Without element-level validation, this used to throw a raw TypeError from deep
    // inside splineFromJson instead of a catchable BoardFileError.
    const parsed = JSON.parse(serializeBoard(newBoard()));
    parsed.outline = [{}];
    expect(() => deserializeBoard(JSON.stringify(parsed))).toThrow(BoardFileError);
  });

  it('deserializeBoard throws BoardFileError (not a raw TypeError) for a garbage cross-section element', () => {
    const parsed = JSON.parse(serializeBoard(newBoard()));
    parsed.crossSections = [null];
    expect(() => deserializeBoard(JSON.stringify(parsed))).toThrow(BoardFileError);
  });
});

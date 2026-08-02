import { BezierSpline } from '../bezier/bezierSpline';
import { BezierKnot, LOCK_X_LESS, LOCK_X_MORE, LOCK_Y_MORE } from '../bezier/bezierKnot';
import type { Board, CrossSection } from './types';

const DEFAULT_LENGTH = 180; // cm, roughly a shortboard
const DEFAULT_HALF_WIDTH = 25;
const DEFAULT_THICKNESS = 6;

function straightOutline(): BezierSpline {
  const s = new BezierSpline();
  s.append(new BezierKnot(0, 2, 0, 2, DEFAULT_LENGTH * 0.2, 2));
  s.append(new BezierKnot(DEFAULT_LENGTH / 2, DEFAULT_HALF_WIDTH, DEFAULT_LENGTH * 0.3, DEFAULT_HALF_WIDTH, DEFAULT_LENGTH * 0.7, DEFAULT_HALF_WIDTH));
  s.append(new BezierKnot(DEFAULT_LENGTH, 2, DEFAULT_LENGTH * 0.8, 2, DEFAULT_LENGTH, 2));
  return s;
}

/**
 * Builds a spline that is flat (constant y) *as constructed here* - see the NOTE on
 * newBoard() below for why the deck/bottom pair built from this is not actually flat
 * once the board's setLocks() runs.
 */
function flatSpline(y: number): BezierSpline {
  const s = new BezierSpline();
  s.append(new BezierKnot(0, y, 0, y, DEFAULT_LENGTH * 0.3, y));
  s.append(new BezierKnot(DEFAULT_LENGTH, y, DEFAULT_LENGTH * 0.7, y, DEFAULT_LENGTH, y));
  return s;
}

function boundaryCrossSection(position: number): CrossSection {
  // A minimal capsule-shaped half-outline from bottom-center (0,0) around to deck-center (0, thickness).
  const spline = new BezierSpline();
  spline.append(new BezierKnot(0, 0, 0, 0, DEFAULT_HALF_WIDTH * 0.5, 0));
  spline.append(new BezierKnot(DEFAULT_HALF_WIDTH, DEFAULT_THICKNESS / 2, DEFAULT_HALF_WIDTH, DEFAULT_THICKNESS * 0.2, DEFAULT_HALF_WIDTH, DEFAULT_THICKNESS * 0.8));
  spline.append(new BezierKnot(0, DEFAULT_THICKNESS, DEFAULT_HALF_WIDTH * 0.5, DEFAULT_THICKNESS, 0, DEFAULT_THICKNESS));
  return { position, spline };
}

/**
 * NOTE - "flat isn't flat": the deck/bottom pair built here (flatSpline(DEFAULT_THICKNESS)
 * at constant y=6, flatSpline(0) at constant y=0) is NOT actually flat once setLocks()
 * (called at the end of this function) runs its slave-sync step. deck and bottom don't
 * share endpoints at the tail/nose as constructed, but setLocks() slave-links their
 * tail/nose knots together as if they did. setSlave()/updateSlave() (see BezierKnot) snap
 * the SLAVE's endpoint directly onto the MASTER's current endpoint (not offset by the
 * delta), while shifting the slave's tangent HANDLES by that same delta. Concretely, for
 * the tail knot: deck is the master at (x=0, y=6); bottom is the slave, starting at
 * (x=0, y=0) with tangent handles also at y=0. yDiff = slave.y - master.y = 0 - 6 = -6.
 * updateSlave then sets bottom's endpoint to (0, 6) (matching deck) but shifts bottom's
 * tangent handles by yDiff to y = 0 + (-6) = -6 - i.e. bottom's tail knot ends up with
 * control points {endpoint: 6, tangentToPrev: -6, tangentToNext: -6}, not a flat
 * {6, 6, 6}. The same happens at the nose. Net result: deck stays flat at y=6, but bottom
 * curves from y=6 at both tips down toward its (unmoved) middle control point at y=0, and
 * getThicknessAtPos (deck - bottom) is 0 at both tips and bulges to ~9 at center - 50%
 * over the nominal 6, not a gentle taper. This is provably non-negative (a cubic Bezier
 * segment's value is bounded by its own control points' convex hull; bottom's control
 * points here stay within [-6, 6] while deck is a flat 6, so thickness stays within
 * [0, 12]), so the default board is still a valid, non-degenerate shape - just not
 * literally "flat". See board.test.ts's setLocks-effects tests for the numeric bounds
 * this relies on.
 */
export function newBoard(): Board {
  const board: Board = {
    name: 'New Board',
    designer: '',
    surfer: '',
    model: '',
    description: '',
    comments: '',
    outline: straightOutline(),
    deck: flatSpline(DEFAULT_THICKNESS),
    bottom: flatSpline(0),
    crossSections: [boundaryCrossSection(0), boundaryCrossSection(DEFAULT_LENGTH)],
  };
  setLocks(board);
  return board;
}

export function getLength(board: Board): number {
  let length = 0;
  for (let i = 0; i < board.outline.getNrOfControlPoints(); i++) {
    const x = board.outline.getControlPoint(i).endPoint.x;
    if (x > length) length = x;
  }
  return length;
}

export function getWidthAtPos(board: Board, pos: number): number {
  return board.outline.getValueAt(pos) * 2;
}

export function getRockerAtPos(board: Board, pos: number): number {
  return board.bottom.getValueAt(pos);
}

export function getDeckAtPos(board: Board, pos: number): number {
  return board.deck.getValueAt(pos);
}

export function getThicknessAtPos(board: Board, pos: number): number {
  return getDeckAtPos(board, pos) - getRockerAtPos(board, pos);
}

export function getCenterWidth(board: Board): number {
  return getWidthAtPos(board, getLength(board) / 2);
}

export function getMaxWidth(board: Board): number {
  return board.outline.getMaxY() * 2;
}

export function getThickness(board: Board): number {
  return getThicknessAtPos(board, getLength(board) / 2);
}

export function getMaxThickness(board: Board): number {
  let max = -100000;
  const length = getLength(board);
  for (let i = 0; i < Math.floor(length * 10); i++) {
    const pos = i / 10;
    max = Math.max(max, getThicknessAtPos(board, pos));
  }
  return max;
}

export function getMaxRocker(board: Board): number {
  return board.bottom.getMaxY();
}

export function sortCrossSections(board: Board): void {
  board.crossSections.sort((a, b) => a.position - b.position);
}

/** Port of BezierBoard.setLocks: axis masks on the endpoints, and a slave link between deck/bottom's nose and tail endpoints so they move together. */
export function setLocks(board: Board): void {
  if (board.outline.getNrOfControlPoints() < 2) return;

  // Set masks
  const outlineLast = board.outline.getNrOfControlPoints() - 1;
  board.outline.getControlPoint(0).setMask(0, 0);
  board.outline.getControlPoint(outlineLast).setMask(0, 0);

  const deckLast = board.deck.getNrOfControlPoints() - 1;
  board.deck.getControlPoint(0).setMask(0, 1.0);
  board.deck.getControlPoint(deckLast).setMask(0, 1.0);

  const bottomLast = board.bottom.getNrOfControlPoints() - 1;
  board.bottom.getControlPoint(0).setMask(0, 1.0);
  board.bottom.getControlPoint(bottomLast).setMask(0, 1.0);

  for (const cs of board.crossSections) {
    const last = cs.spline.getNrOfControlPoints() - 1;
    cs.spline.getControlPoint(0).setMask(0, 1);
    cs.spline.getControlPoint(last).setMask(0, 1);
  }

  // Set slaves
  board.deck.getControlPoint(0).setSlave(board.bottom.getControlPoint(0));
  board.deck.getControlPoint(deckLast).setSlave(board.bottom.getControlPoint(bottomLast));
  board.bottom.getControlPoint(0).setSlave(board.deck.getControlPoint(0));
  board.bottom.getControlPoint(bottomLast).setSlave(board.deck.getControlPoint(deckLast));

  // Set locks
  for (let i = 0; i < board.outline.getNrOfControlPoints(); i++) {
    board.outline.getControlPoint(i).setTangentToPrevLocks(LOCK_X_LESS);
    board.outline.getControlPoint(i).setTangentToNextLocks(LOCK_X_MORE);
  }
  board.outline.getControlPoint(0).addTangentToNextLocks(LOCK_Y_MORE);
  board.outline.getControlPoint(outlineLast).addTangentToPrevLocks(LOCK_Y_MORE);

  for (let i = 0; i < board.deck.getNrOfControlPoints(); i++) {
    board.deck.getControlPoint(i).setTangentToPrevLocks(LOCK_X_LESS);
    board.deck.getControlPoint(i).setTangentToNextLocks(LOCK_X_MORE);
  }
  for (let i = 0; i < board.bottom.getNrOfControlPoints(); i++) {
    board.bottom.getControlPoint(i).setTangentToPrevLocks(LOCK_X_LESS);
    board.bottom.getControlPoint(i).setTangentToNextLocks(LOCK_X_MORE);
  }
  for (const cs of board.crossSections) {
    const last = cs.spline.getNrOfControlPoints() - 1;
    cs.spline.getControlPoint(0).setTangentToNextLocks(LOCK_X_MORE);
    cs.spline.getControlPoint(last).setTangentToPrevLocks(LOCK_X_MORE);
  }
}

/**
 * IMPORTANT: BezierKnot.clone()/set() copy the `slave` field by reference (matching
 * Java's shallow-clone contract — see core/bezier's BezierKnot). That means a cloned
 * deck knot's `.slave` still points at the *pre-clone* bottom knot, not the fresh one
 * in this same new Board. Every edit command clones the whole board, so without
 * re-running setLocks() here, the deck/bottom nose-tail sync would silently break
 * after the very first edit. setLocks() is idempotent (safe to call on every clone):
 * it deterministically re-derives masks/locks/slave links from the current knots,
 * and since deck/bottom tail endpoints are always coincident when sync is working,
 * re-snapping them is a no-op in practice.
 */
export function cloneBoard(board: Board): Board {
  const next: Board = {
    ...board,
    outline: board.outline.clone(),
    deck: board.deck.clone(),
    bottom: board.bottom.clone(),
    crossSections: board.crossSections.map((cs) => ({ position: cs.position, spline: cs.spline.clone() })),
  };
  setLocks(next);
  return next;
}

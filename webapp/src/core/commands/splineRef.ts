import type { Board } from '../board/types';
import { BezierSpline } from '../bezier/bezierSpline';
import { onOutlineChanged, onRockerChanged, onCrossSectionChanged } from '../board/board';

export type SplineRef = 'outline' | 'deck' | 'bottom' | { crossSection: number };

export function resolveSpline(board: Board, ref: SplineRef): BezierSpline {
  if (ref === 'outline') return board.outline;
  if (ref === 'deck') return board.deck;
  if (ref === 'bottom') return board.bottom;
  return board.crossSections[ref.crossSection].spline;
}

export function notifyChanged(board: Board, ref: SplineRef): void {
  if (ref === 'outline') onOutlineChanged(board);
  else if (ref === 'deck' || ref === 'bottom') onRockerChanged(board);
  else onCrossSectionChanged(board);
}

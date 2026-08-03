import { useRef, useState } from 'react';
import type { Point2D } from '../../core/bezier/point';
import { BezierSpline } from '../../core/bezier/bezierSpline';
import { END_POINT } from '../../core/bezier/bezierKnot';
import * as vec from '../../core/bezier/vecMath';
import {
  moveControlPointCommand,
  moveKnotTangent,
  addControlPointCommand,
  deleteControlPointCommand,
  fitCurveFromGuidePointsCommand,
} from '../../core/commands/editCommands';
import type { SplineRef } from '../../core/commands/splineRef';
import { useBoardState } from '../state/BoardStateContext';
import { SplineCanvas, type KnotSelection } from './SplineCanvas';
import { screenToBoard, type Viewport } from './viewport';

export interface Editor2DProps {
  spline: BezierSpline;
  splineRef: SplineRef;
  viewport: Viewport;
  isCrossSection: boolean;
}

const HIT_RADIUS_PX = 8;

function eventToScreenPos(event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): Point2D {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/**
 * `spline.clone()` deep-copies each knot's points but NOT its `.slave` reference (see
 * `BezierKnot.clone()`'s doc comment) - a knot cloned from `board.deck`'s or
 * `board.bottom`'s nose/tail (slave-linked by `setLocks()`) would still have `.slave`
 * pointing at the REAL, live knot on the real board. Since this preview is a scratch,
 * render-only copy that's mutated directly (bypassing `dispatch`/`cloneBoard`) on every
 * pointermove, leaving `.slave` intact would let `updateSlave()` reach through it and
 * mutate the live board in place mid-drag - outside undo history, outside React state.
 * Stripping `.slave` here (the preview never needs real slave-sync; it's discarded once
 * the real command runs and produces a properly `cloneBoard`+`setLocks`-rebound board)
 * makes that impossible.
 */
function clonePreviewSpline(spline: BezierSpline): BezierSpline {
  const preview = spline.clone();
  for (let i = 0; i < preview.getNrOfControlPoints(); i++) {
    preview.getControlPoint(i).slave = null;
  }
  return preview;
}

export function Editor2D({ spline, splineRef, viewport, isCrossSection }: Editor2DProps) {
  const { dispatch } = useBoardState();
  const [selection, setSelection] = useState<KnotSelection | null>(null);
  const [previewSpline, setPreviewSpline] = useState<BezierSpline | null>(null);
  const [mode, setMode] = useState<'edit' | 'guide'>('edit');
  const [guidePoints, setGuidePoints] = useState<Point2D[]>([]);
  const dragRef = useRef<KnotSelection | null>(null);

  function hitTest(screenPos: Point2D): KnotSelection | null {
    const boardPos = screenToBoard(viewport, screenPos);
    const threshold = HIT_RADIUS_PX / viewport.scale;
    let best: KnotSelection | null = null;
    let bestDist = threshold;

    for (let i = 0; i < spline.getNrOfControlPoints(); i++) {
      const knot = spline.getControlPoint(i);
      for (const which of [0, 1, 2] as const) {
        const dist = vec.length(knot.points[which], boardPos);
        if (dist < bestDist) {
          bestDist = dist;
          best = { knotIndex: i, which };
        }
      }
    }
    return best;
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const screenPos = eventToScreenPos(event);
    if (mode === 'guide') {
      setGuidePoints((points) => [...points, screenToBoard(viewport, screenPos)]);
      return;
    }

    const hit = hitTest(screenPos);
    setSelection(hit);
    if (hit == null) return;

    dragRef.current = hit;
    setPreviewSpline(clonePreviewSpline(spline));
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (drag == null || previewSpline == null) return;

    const boardPos = screenToBoard(viewport, eventToScreenPos(event));
    const knot = previewSpline.getControlPoint(drag.knotIndex);
    if (drag.which === 0) {
      knot.setControlPointLocation(boardPos.x, boardPos.y);
    } else {
      moveKnotTangent(knot, drag.which, boardPos.x, boardPos.y);
    }
    setPreviewSpline(previewSpline.clone());
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (drag == null) return;

    const boardPos = screenToBoard(viewport, eventToScreenPos(event));
    dispatch('Move control point', (board) => moveControlPointCommand(board, splineRef, drag.knotIndex, drag.which, boardPos.x, boardPos.y));

    dragRef.current = null;
    setPreviewSpline(null);
  }

  function onPointerCancel() {
    // Gesture was cancelled (touch reinterpreted, stylus left range, OS interruption) -
    // clear drag state WITHOUT dispatching; a cancelled gesture shouldn't commit a change.
    dragRef.current = null;
    setPreviewSpline(null);
  }

  function onDoubleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (mode !== 'edit') return;
    const boardPos = screenToBoard(viewport, eventToScreenPos(event));
    let newKnotIndex = -1;
    dispatch('Add control point', (board) => {
      const result = addControlPointCommand(board, splineRef, boardPos);
      newKnotIndex = result.knotIndex;
      return result.board;
    });
    if (newKnotIndex >= 0) {
      setSelection({ knotIndex: newKnotIndex, which: END_POINT });
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (mode !== 'edit') return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && selection != null && selection.which === 0) {
      dispatch('Delete control point', (board) => deleteControlPointCommand(board, splineRef, selection.knotIndex));
      setSelection(null);
    }
  }

  function fitCurve() {
    dispatch('Fit curve', (board) => fitCurveFromGuidePointsCommand(board, splineRef, guidePoints, isCrossSection));
    setGuidePoints([]);
  }

  function toggleMode() {
    if (mode === 'guide') {
      setGuidePoints([]);
    }
    setMode(mode === 'edit' ? 'guide' : 'edit');
  }

  return (
    <div tabIndex={0} onKeyDown={onKeyDown}>
      <div>
        <button onClick={toggleMode}>{mode === 'edit' ? 'Add Guide Points' : 'Edit Points'}</button>
        {mode === 'guide' && (
          <>
            <button onClick={fitCurve} disabled={guidePoints.length === 0}>
              Fit Curve
            </button>
            <button onClick={() => setGuidePoints([])} disabled={guidePoints.length === 0}>
              Clear Guide Points
            </button>
          </>
        )}
      </div>
      <SplineCanvas
        spline={previewSpline ?? spline}
        viewport={viewport}
        selection={selection}
        guidePoints={guidePoints}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}

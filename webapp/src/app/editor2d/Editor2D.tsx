import { useRef, useState } from 'react';
import type { Point2D } from '../../core/bezier/point';
import { BezierSpline } from '../../core/bezier/bezierSpline';
import { END_POINT } from '../../core/bezier/bezierKnot';
import * as vec from '../../core/bezier/vecMath';
import { moveControlPointCommand, moveKnotTangent, addControlPointCommand, deleteControlPointCommand } from '../../core/commands/editCommands';
import type { SplineRef } from '../../core/commands/splineRef';
import { useBoardState } from '../state/BoardStateContext';
import { SplineCanvas, type KnotSelection } from './SplineCanvas';
import { screenToBoard, type Viewport } from './viewport';

export interface Editor2DProps {
  spline: BezierSpline;
  splineRef: SplineRef;
  viewport: Viewport;
}

const HIT_RADIUS_PX = 8;

function eventToScreenPos(event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): Point2D {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export function Editor2D({ spline, splineRef, viewport }: Editor2DProps) {
  const { dispatch } = useBoardState();
  const [selection, setSelection] = useState<KnotSelection | null>(null);
  const [previewSpline, setPreviewSpline] = useState<BezierSpline | null>(null);
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
    const hit = hitTest(eventToScreenPos(event));
    setSelection(hit);
    if (hit == null) return;

    dragRef.current = hit;
    setPreviewSpline(spline.clone());
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

  function onDoubleClick(event: React.MouseEvent<HTMLCanvasElement>) {
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
    if ((event.key === 'Delete' || event.key === 'Backspace') && selection != null && selection.which === 0) {
      dispatch('Delete control point', (board) => deleteControlPointCommand(board, splineRef, selection.knotIndex));
      setSelection(null);
    }
  }

  return (
    <div tabIndex={0} onKeyDown={onKeyDown}>
      <SplineCanvas
        spline={previewSpline ?? spline}
        viewport={viewport}
        selection={selection}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}

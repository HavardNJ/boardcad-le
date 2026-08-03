import { useLayoutEffect, useRef } from 'react';
import type { Point2D } from '../../core/bezier/point';
import { BezierSpline } from '../../core/bezier/bezierSpline';
import { END_POINT, NEXT_TANGENT, PREVIOUS_TANGENT } from '../../core/bezier/bezierKnot';
import { boardToScreen, type Viewport } from './viewport';

export interface KnotSelection {
  knotIndex: number;
  which: 0 | 1 | 2;
}

export interface SplineCanvasProps {
  spline: BezierSpline;
  viewport: Viewport;
  selection: KnotSelection | null;
  onPointerDown?: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove?: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLCanvasElement>) => void;
}

function drawEndpoint(ctx: CanvasRenderingContext2D, p: Point2D, selected: boolean): void {
  ctx.fillStyle = selected ? '#ef4444' : '#1e293b';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawHandle(ctx: CanvasRenderingContext2D, p: Point2D, selected: boolean): void {
  ctx.fillStyle = selected ? '#ef4444' : '#94a3b8';
  ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
}

export function SplineCanvas(props: SplineCanvasProps) {
  const { spline, viewport, selection, onPointerDown, onPointerMove, onPointerUp, onDoubleClick } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, viewport.width, viewport.height);

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < spline.getNrOfCurves(); i++) {
      const curve = spline.getCurve(i);
      const p0 = boardToScreen(viewport, curve.getStartKnot().endPoint);
      const t1 = boardToScreen(viewport, curve.getStartKnot().tangentToNext);
      const t2 = boardToScreen(viewport, curve.getEndKnot().tangentToPrev);
      const p3 = boardToScreen(viewport, curve.getEndKnot().endPoint);
      if (i === 0) ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(t1.x, t1.y, t2.x, t2.y, p3.x, p3.y);
    }
    ctx.stroke();

    for (let i = 0; i < spline.getNrOfControlPoints(); i++) {
      const knot = spline.getControlPoint(i);
      const isSelectedKnot = selection?.knotIndex === i;
      const endpoint = boardToScreen(viewport, knot.points[0]);
      const prev = boardToScreen(viewport, knot.points[1]);
      const next = boardToScreen(viewport, knot.points[2]);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(endpoint.x, endpoint.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();

      drawHandle(ctx, prev, isSelectedKnot && selection?.which === PREVIOUS_TANGENT);
      drawHandle(ctx, next, isSelectedKnot && selection?.which === NEXT_TANGENT);
      drawEndpoint(ctx, endpoint, isSelectedKnot && selection?.which === END_POINT);
    }
  }, [spline, viewport, selection]);

  return (
    <canvas
      ref={canvasRef}
      width={viewport.width}
      height={viewport.height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{ touchAction: 'none', border: '1px solid #cbd5e1' }}
    />
  );
}

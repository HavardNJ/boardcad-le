import type { Point2D } from '../../core/bezier/point';
import type { BezierSpline } from '../../core/bezier/bezierSpline';

export interface Viewport {
  scale: number; // screen pixels per board unit
  panX: number; // screen pixels
  panY: number;
  flipY: boolean; // true for views where "up" on screen should be +y in board space (rocker/cross-section)
  width: number;
  height: number;
}

export function boardToScreen(viewport: Viewport, p: Point2D): Point2D {
  const x = p.x * viewport.scale + viewport.panX;
  const yBoard = viewport.flipY ? -p.y : p.y;
  const y = yBoard * viewport.scale + viewport.panY;
  return { x, y };
}

export function screenToBoard(viewport: Viewport, p: Point2D): Point2D {
  const x = (p.x - viewport.panX) / viewport.scale;
  const yRaw = (p.y - viewport.panY) / viewport.scale;
  const y = viewport.flipY ? -yRaw : yRaw;
  return { x, y };
}

/** Fits a spline's control-point bounding box into (width, height) with `padding` screen pixels on every side. */
export function fitViewport(spline: BezierSpline, width: number, height: number, padding = 30, flipY = false): Viewport {
  if (spline.getNrOfControlPoints() === 0) {
    return { scale: 1, panX: width / 2, panY: height / 2, flipY, width, height };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < spline.getNrOfControlPoints(); i++) {
    const knot = spline.getControlPoint(i);
    for (const p of knot.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }

  const boardWidth = Math.max(maxX - minX, 0.001);
  const boardHeight = Math.max(maxY - minY, 0.001);
  const scale = Math.min((width - padding * 2) / boardWidth, (height - padding * 2) / boardHeight);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerYBoard = flipY ? -centerY : centerY;

  return {
    scale,
    panX: width / 2 - centerX * scale,
    panY: height / 2 - centerYBoard * scale,
    flipY,
    width,
    height,
  };
}

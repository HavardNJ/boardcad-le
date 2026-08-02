import type { Point2D } from './point';

export function length(p0: Point2D, p1: Point2D = { x: 0, y: 0 }): number {
  const dx = p0.x - p1.x;
  const dy = p0.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function sub(p0: Point2D, p1: Point2D): Point2D {
  return { x: p1.x - p0.x, y: p1.y - p0.y };
}

export function add(p0: Point2D, p1: Point2D): Point2D {
  return { x: p1.x + p0.x, y: p1.y + p0.y };
}

export function scale(p: Point2D, v: number): Point2D {
  return { x: p.x * v, y: p.y * v };
}

export function normalize(p: Point2D): Point2D {
  return scale(p, 1.0 / length(p));
}

export function dot(p0: Point2D, p1: Point2D): number {
  return p0.x * p1.x + p0.y * p1.y;
}

export function angleBetween(p0: Point2D, p1: Point2D): number {
  const angle = Math.acos(dot(p0, p1) / (length(p0) * length(p1)));
  return Number.isNaN(angle) ? 0 : angle;
}

export function rotate(vec: Point2D, rotAngle: number): Point2D {
  const x = Math.cos(rotAngle) * vec.x - Math.sin(rotAngle) * vec.y;
  const y = Math.sin(rotAngle) * vec.x + Math.cos(rotAngle) * vec.y;
  return { x, y };
}

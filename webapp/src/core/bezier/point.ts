export interface Point2D {
  x: number;
  y: number;
}

export function point(x: number, y: number): Point2D {
  return { x, y };
}

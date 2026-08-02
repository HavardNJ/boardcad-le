import { describe, it, expect } from 'vitest';
import { length, sub, add, scale, normalize, angleBetween, rotate } from './vecMath';

describe('vecMath', () => {
  it('length computes euclidean distance from origin', () => {
    expect(length({ x: 3, y: 4 })).toBeCloseTo(5);
  });

  it('sub returns p1 - p0', () => {
    expect(sub({ x: 1, y: 1 }, { x: 4, y: 6 })).toEqual({ x: 3, y: 5 });
  });

  it('add returns p0 + p1', () => {
    expect(add({ x: 1, y: 1 }, { x: 4, y: 6 })).toEqual({ x: 5, y: 7 });
  });

  it('scale multiplies both components', () => {
    expect(scale({ x: 2, y: 3 }, 2)).toEqual({ x: 4, y: 6 });
  });

  it('normalize produces a unit vector', () => {
    const n = normalize({ x: 3, y: 4 });
    expect(length(n)).toBeCloseTo(1);
  });

  it('angleBetween returns 0 for identical vectors', () => {
    expect(angleBetween({ x: 1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
  });

  it('angleBetween returns PI/2 for perpendicular vectors', () => {
    expect(angleBetween({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
  });

  it('angleBetween returns 0 (not NaN) for a zero-length vector', () => {
    expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  });

  it('rotate rotates a vector by the given angle', () => {
    const r = rotate({ x: 1, y: 0 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
  });
});

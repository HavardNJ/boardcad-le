import { describe, it, expect } from 'vitest';
import { getRoot } from './rootFinder';

describe('rootFinder.getRoot', () => {
  it('finds t such that f(t) === targetValue for a linear function', () => {
    const f = (t: number) => t * 10;
    const t = getRoot(f, 5, 0, 1);
    expect(f(t)).toBeCloseTo(5, 2);
  });

  it('finds t for a monotonic cubic function', () => {
    const f = (t: number) => t * t * t;
    const t = getRoot(f, 0.125, 0, 1);
    expect(f(t)).toBeCloseTo(0.125, 2);
  });
});

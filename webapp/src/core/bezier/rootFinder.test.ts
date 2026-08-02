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

  it('falls back to bisect when secant fails to converge within tolerance', () => {
    // A long, nearly-flat region followed by a steep ramp: secant's linear-interpolation
    // guess is dominated by the flat region's shallow slope, so it converges far short of
    // the target and never approaches the steep section closely enough within its
    // iteration budget. Bisect doesn't rely on slope, so it still brackets the root fine.
    const f = (t: number) => (t < 0.9 ? 0.0001 * t : 0.0001 * 0.9 + 50 * (t - 0.9));
    const t = getRoot(f, 0.1, 0, 1);
    expect(f(t)).toBeCloseTo(0.1, 2);
  });
});

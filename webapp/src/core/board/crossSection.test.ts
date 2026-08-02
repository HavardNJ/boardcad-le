import { describe, it, expect } from 'vitest';
import { BezierSpline } from '../bezier/bezierSpline';
import { BezierKnot } from '../bezier/bezierKnot';
import type { CrossSection } from './types';
import { getWidth, getCenterThickness, scaleCrossSection, interpolateCrossSection } from './crossSection';

function makeCrossSection(halfWidth: number, thickness: number): CrossSection {
  const spline = new BezierSpline();
  spline.append(new BezierKnot(0, 0, 0, 0, halfWidth * 0.5, 0));
  spline.append(new BezierKnot(halfWidth, thickness / 2, halfWidth, thickness * 0.2, halfWidth, thickness * 0.8));
  spline.append(new BezierKnot(0, thickness, halfWidth * 0.5, thickness, 0, thickness));
  return { position: 0, spline };
}

describe('CrossSection', () => {
  it('getWidth is twice the max x of the spline', () => {
    const cs = makeCrossSection(10, 5);
    expect(getWidth(cs)).toBeCloseTo(20, 1);
  });

  it('getCenterThickness is the y-span between the first and last control point', () => {
    const cs = makeCrossSection(10, 5);
    expect(getCenterThickness(cs)).toBeCloseTo(5, 6);
  });

  it('scaleCrossSection scales width and thickness proportionally', () => {
    const cs = makeCrossSection(10, 5);
    scaleCrossSection(cs, 10, 40);
    expect(getCenterThickness(cs)).toBeCloseTo(10, 1);
    expect(getWidth(cs)).toBeCloseTo(40, 1);
  });

  it('interpolateCrossSection at t=0 matches the source (scaled to itself)', () => {
    const a = makeCrossSection(10, 5);
    const b = makeCrossSection(12, 6);
    const result = interpolateCrossSection(a, b, 0)!;
    expect(getWidth(result)).toBeCloseTo(getWidth(a), 1);
    expect(getCenterThickness(result)).toBeCloseTo(getCenterThickness(a), 1);
  });

  it('interpolateCrossSection at t=1 matches the target scaled to the source size', () => {
    const a = makeCrossSection(10, 5);
    const b = makeCrossSection(12, 6);
    const result = interpolateCrossSection(a, b, 1)!;
    // Target is rescaled to the source's width/thickness before interpolating, per BezierBoardCrossSection.interpolate.
    expect(getWidth(result)).toBeCloseTo(getWidth(a), 0);
  });
});

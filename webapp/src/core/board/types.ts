import { BezierSpline } from '../bezier/bezierSpline';

export interface CrossSection {
  position: number;
  spline: BezierSpline;
}

export interface Board {
  name: string;
  designer: string;
  surfer: string;
  model: string;
  description: string;
  comments: string;
  outline: BezierSpline;
  deck: BezierSpline;
  bottom: BezierSpline;
  /** Sorted by position ascending. Index 0 and the last index are the tail/nose boundary cross-sections — see Task 6 notes. */
  crossSections: CrossSection[];
}

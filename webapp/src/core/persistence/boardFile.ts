import { BezierKnot } from '../bezier/bezierKnot';
import { BezierSpline } from '../bezier/bezierSpline';
import type { Board, CrossSection } from '../board/types';
import { setLocks } from '../board/board';

const FORMAT_VERSION = 1;

export class BoardFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoardFileError';
  }
}

interface KnotJson {
  point: [number, number];
  tangentPrev: [number, number];
  tangentNext: [number, number];
  continuous: boolean;
}

type SplineJson = KnotJson[];

interface CrossSectionJson {
  position: number;
  spline: SplineJson;
}

interface BoardJson {
  formatVersion: number;
  name: string;
  designer: string;
  surfer: string;
  model: string;
  description: string;
  comments: string;
  outline: SplineJson;
  deck: SplineJson;
  bottom: SplineJson;
  crossSections: CrossSectionJson[];
}

function splineToJson(spline: BezierSpline): SplineJson {
  const knots: KnotJson[] = [];
  for (let i = 0; i < spline.getNrOfControlPoints(); i++) {
    const k = spline.getControlPoint(i);
    knots.push({
      point: [k.points[0].x, k.points[0].y],
      tangentPrev: [k.points[1].x, k.points[1].y],
      tangentNext: [k.points[2].x, k.points[2].y],
      continuous: k.continuous,
    });
  }
  return knots;
}

function isTuple(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

function isKnotJson(value: unknown): value is KnotJson {
  if (typeof value !== 'object' || value == null) return false;
  const k = value as Partial<KnotJson>;
  return isTuple(k.point) && isTuple(k.tangentPrev) && isTuple(k.tangentNext) && typeof k.continuous === 'boolean';
}

function splineFromJson(json: SplineJson): BezierSpline {
  const spline = new BezierSpline();
  for (const k of json) {
    if (!isKnotJson(k)) {
      throw new BoardFileError('Board file contains a malformed control point');
    }
    const knot = new BezierKnot(k.point[0], k.point[1], k.tangentPrev[0], k.tangentPrev[1], k.tangentNext[0], k.tangentNext[1]);
    knot.continuous = k.continuous;
    spline.append(knot);
  }
  return spline;
}

export function serializeBoard(board: Board): string {
  const json: BoardJson = {
    formatVersion: FORMAT_VERSION,
    name: board.name,
    designer: board.designer,
    surfer: board.surfer,
    model: board.model,
    description: board.description,
    comments: board.comments,
    outline: splineToJson(board.outline),
    deck: splineToJson(board.deck),
    bottom: splineToJson(board.bottom),
    crossSections: board.crossSections.map((cs) => ({ position: cs.position, spline: splineToJson(cs.spline) })),
  };
  return JSON.stringify(json, null, 2);
}

export function deserializeBoard(text: string): Board {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BoardFileError('File is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed == null) {
    throw new BoardFileError('File does not contain a board object');
  }
  const json = parsed as Partial<BoardJson>;

  if (json.formatVersion !== FORMAT_VERSION) {
    throw new BoardFileError(`Unsupported board file version: ${String(json.formatVersion)}`);
  }
  if (!Array.isArray(json.outline) || !Array.isArray(json.deck) || !Array.isArray(json.bottom) || !Array.isArray(json.crossSections)) {
    throw new BoardFileError('Board file is missing required spline data');
  }

  const crossSections: CrossSection[] = json.crossSections.map((cs) => {
    if (typeof cs !== 'object' || cs == null || typeof cs.position !== 'number' || !Array.isArray(cs.spline)) {
      throw new BoardFileError('Board file contains a malformed cross-section');
    }
    return { position: cs.position, spline: splineFromJson(cs.spline) };
  });

  const board: Board = {
    name: json.name ?? '',
    designer: json.designer ?? '',
    surfer: json.surfer ?? '',
    model: json.model ?? '',
    description: json.description ?? '',
    comments: json.comments ?? '',
    outline: splineFromJson(json.outline),
    deck: splineFromJson(json.deck),
    bottom: splineFromJson(json.bottom),
    crossSections,
  };

  setLocks(board);
  return board;
}

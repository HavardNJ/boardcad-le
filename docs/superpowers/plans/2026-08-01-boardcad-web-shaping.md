# BoardCAD Web Shaping Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-only React + TypeScript + Three.js web app, at `webapp/` in this repo, that ports the shaping/design part of BoardCAD LE (outline, cross-sections, rocker, Bezier curve fitting, 3D preview) — excluding CAM — as specified in `docs/superpowers/specs/2026-08-01-boardcad-web-shaping-design.md`.

**Architecture:** `webapp/src/core` is a pure TypeScript, framework-free port of the relevant Java classes (`cadcore.BezierKnot/BezierCurve/BezierSpline/BezierFit`, `board.BezierBoard`, `cadcore.BezierBoardCrossSection`, `cadcore.BezierBoardControlPointInterpolationSurfaceModel`, `boardcad.commands.BrdCommand*`). `webapp/src/app` is React UI (2D canvas editor, react-three-fiber 3D viewer, state binding, dialogs) that consumes `core` and never gets ported-to directly — it only calls `core` functions.

**Tech Stack:** Vite, React 18, TypeScript, Vitest (core unit tests), Three.js via `@react-three/fiber` + `@react-three/drei`, plain HTML Canvas 2D for the curve editor, no backend, no state-management library beyond React context/useReducer.

**Path note:** the design doc's `src/core`, `src/app` tree is relative to the new project root. Concretely that is `webapp/src/core/...` and `webapp/src/app/...` in this repo (the existing Java `src/` at the repo root is untouched).

---

## Reference material (Java source this plan ports from)

All paths relative to repo root. Read these before implementing the matching task if the port isn't clear from the code shown inline:

- `src/cadcore/BezierKnot.java`, `BezierCurve.java`, `BezierSpline.java`, `BezierFit.java`, `VecMath.java`, `MathUtils.java`
- `src/board/BezierBoard.java`, `src/cadcore/BezierBoardCrossSection.java`
- `src/cadcore/AbstractBezierBoardSurfaceModel.java`, `BezierBoardControlPointInterpolationSurfaceModel.java`
- `src/boardcad/commands/BrdCommand.java`, `BrdCommandHistory.java`, `BrdAbstractEditCommand.java`, `BrdEditCommand.java`, `BrdAddControlPointCommand.java`, `BrdDeleteControlPointCommand.java`, `BrdFitCurveCommand.java`, `BrdAddCrossSectionCommand.java`, `BrdRemoveCrossSectionCommand.java`

## Deliberate simplifications vs. the Java original (YAGNI, decided during planning)

These are scope cuts, not oversights — call them out if reviewing against the Java code:

1. **Undo/redo model:** instead of porting `BrdCommand`'s mutable per-field diff objects (`ControlPointChange`), each command clones the whole `Board` before/after and the history stores those two snapshots. Boards are small (a handful of splines/cross-sections); whole-snapshot clone-on-command is simpler and far less bug-prone than field-level diffing, and still gives identical linear-history undo/redo semantics to `BrdCommandHistory`.
2. **Drag interaction:** Java calls `moveControlPoints()` on every mouse-move (mutating live state) and only pushes one history entry on mouse-up. The web port does the same: the 2D editor keeps a local (non-undoable) preview copy of the board mutated on every pointer-move for rendering, and dispatches exactly one `moveControlPoint` command on pointer-up.
3. **Surface mesh sampling:** the Java `BezierBoardControlPointInterpolationSurfaceModel` samples cross-sections at angle-weighted `s` positions (biased for CAM cutting precision near sharp rail curvature). The web port samples cross-sections at uniform arc-length `s` steps (`BezierSpline.getPointByS`). This is a preview mesh, not a toolpath — uniform sampling is visually adequate and much simpler.
4. **`BezierBoard` fields dropped:** everything CAM/machine-related (blank, cutter, machine folder, speeds, struts, fins, security level, `topCuts`/`bottomCuts`/`railCuts`, `protected`) and mass/volume/moment-of-inertia calculations (`getVolume`, `getCenterOfMass`, `getMomentOfInertia`, `getArea`) are not ported — out of scope per the design doc.
5. **`BoardCADSettings`-gated behavior** (`isUsingRockerStickAdjustment`, `isUsingBezierFitOnDelete`, `getAdjustCrossectionThickness`) is hardcoded to the simpler default branch (no rocker-stick adjustment; plain tangent-length rescale on control point delete; cross-section endpoint mask always adjustable) — these were user-preference toggles in the desktop app, not needed for a personal v1.
6. **`BezierUtil.java`** is legacy/superseded static-array duplicate of `BezierCurve`'s math — not ported, `BezierCurve` covers everything needed.

---

## Task 0: Project scaffolding

**Goal:** A working Vite + React + TypeScript project at `webapp/` with Vitest and Three.js dependencies installed, `npm run dev` shows a blank page, `npm test` runs (zero tests, exits 0).

**Files:**
- Create: `webapp/` (via `npm create vite@latest`)
- Create: `webapp/vitest.config.ts`
- Modify: `webapp/package.json`
- Create: `webapp/src/core/.gitkeep`, `webapp/src/app/.gitkeep`

**Acceptance Criteria:**
- [ ] `cd webapp && npm run dev` starts Vite dev server without error
- [ ] `cd webapp && npm test` runs Vitest and exits 0 with "no tests found" (not an error)
- [ ] `@react-three/fiber`, `@react-three/drei`, `three` are in `dependencies`
- [ ] `vitest` is in `devDependencies`

**Verify:** `cd "webapp" && npm run build` → exits 0 with no TypeScript errors

**Steps:**

- [ ] **Step 1: Scaffold the Vite React-TS project**

```bash
cd "/Users/janis/VS Code/Boardcad_LE_weiterentwicklung"
npm create vite@latest webapp -- --template react-ts
cd webapp
npm install
```

- [ ] **Step 2: Add Three.js and Vitest**

```bash
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three vitest
```

- [ ] **Step 3: Add Vitest config**

Create `webapp/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/core/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add test script**

In `webapp/package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 5: Create core/app folder skeleton**

```bash
mkdir -p webapp/src/core webapp/src/app
touch webapp/src/core/.gitkeep webapp/src/app/.gitkeep
```

- [ ] **Step 6: Verify and commit**

```bash
cd webapp && npm run build && npm test
cd ..
git add webapp
git commit -m "Scaffold webapp/ with Vite, React, TypeScript, Vitest, Three.js"
```

---

## Task 1: core/bezier — VecMath and MathUtils

**Goal:** Port `cadcore.VecMath` and the `MathUtils.RootFinder` (secant + bisect) that the Java `BezierSpline` uses for its angle/root-based queries.

**Post-implementation note (added during Task 4):** `BezierSpline`'s methods that would have called `RootFinder.getRoot` (`getTTByX`, `getTTByNormal`, `getTTByLineIntersect`) were deliberately not ported in Task 4 — nothing else in this plan currently calls `rootFinder.getRoot`. It's kept anyway: it's a small, fully-tested, self-contained utility ported for fidelity with the Java `cadcore` package, and it's the natural place to add those spline queries later if a future iteration needs them (e.g. angle-weighted mesh sampling). Also: `MathUtils.java`'s `getRoot()` has a real bug at its bisect-fallback comparison (it evaluates the bisect candidate's error using the stale secant `x` instead of the new `bis_x`, so the Java original's bisect fallback can never actually be selected). The TypeScript port fixes this rather than reproducing it, since the function has no existing caller whose behavior would need to match Java bug-for-bug — see the comment in `rootFinder.ts`.

**Files:**
- Create: `webapp/src/core/bezier/point.ts`
- Create: `webapp/src/core/bezier/vecMath.ts`
- Create: `webapp/src/core/bezier/vecMath.test.ts`
- Create: `webapp/src/core/bezier/rootFinder.ts`
- Create: `webapp/src/core/bezier/rootFinder.test.ts`

**Acceptance Criteria:**
- [ ] `vecMath.ts` covers `length`, `sub`, `add`, `scale`, `normalize`, `dot`, `angleBetween`, `rotate` — matching `VecMath.java` behavior exactly (including the `NaN → 0` guard in `getVectorAngle`)
- [ ] `rootFinder.ts` covers secant + bisect root finding matching `MathUtils.RootFinder`'s intended behavior (see the post-implementation note above re: the bisect-fallback bug)

**Verify:** `cd webapp && npx vitest run src/core/bezier/vecMath.test.ts src/core/bezier/rootFinder.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Point type**

Create `webapp/src/core/bezier/point.ts`:

```typescript
export interface Point2D {
  x: number;
  y: number;
}

export function point(x: number, y: number): Point2D {
  return { x, y };
}
```

- [ ] **Step 2: Write vecMath tests**

Create `webapp/src/core/bezier/vecMath.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { length, sub, add, scale, normalize, dot, angleBetween, rotate } from './vecMath';

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
```

- [ ] **Step 3: Run test, verify fails** — `npx vitest run src/core/bezier/vecMath.test.ts` → FAIL (module not found)

- [ ] **Step 4: Implement vecMath.ts**

Create `webapp/src/core/bezier/vecMath.ts` (port of `VecMath.java`):

```typescript
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
```

- [ ] **Step 5: Run test, verify passes** — `npx vitest run src/core/bezier/vecMath.test.ts` → PASS

- [ ] **Step 6: Write rootFinder tests**

Create `webapp/src/core/bezier/rootFinder.test.ts`:

```typescript
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
```

- [ ] **Step 7: Run test, verify fails**

- [ ] **Step 8: Implement rootFinder.ts**

Create `webapp/src/core/bezier/rootFinder.ts` (port of `MathUtils.RootFinder`, secant with bisect fallback; `DerivableFunction`/Newton-Raphson variant is unused by anything in scope and is not ported):

```typescript
const ROOTFINDER_VALUE_TOLERANCE = 0.005;
const SECANT_MAX_ITERATIONS = 50;
const BISECT_MAX_ITERATIONS = 50;

export type Fn = (x: number) => number;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function secantRoot(f: Fn, target: number, minLimit: number, maxLimit: number): number {
  const valueAtMin = f(minLimit);
  const valueAtMax = f(maxLimit);

  let x = (target - valueAtMin) / (valueAtMax - valueAtMin);
  x = clamp(x, minLimit, maxLimit);

  let lastX = x + (maxLimit - minLimit) / 10.0;
  if (lastX > maxLimit) lastX = x - (maxLimit - minLimit) / 10.0;

  let currentValue = f(x);
  let lastValue = f(lastX);
  let currentError = target - currentValue;

  let n = 0;
  while (Math.abs(currentError) > ROOTFINDER_VALUE_TOLERANCE && n++ < SECANT_MAX_ITERATIONS && currentValue !== lastValue) {
    const d = ((x - lastX) / (currentValue - lastValue)) * currentError;
    lastX = x;
    x = x + d;
    x = clamp(x, minLimit, maxLimit);
    lastValue = currentValue;
    currentValue = f(x);
    currentError = target - currentValue;
  }

  return x;
}

function bisectRoot(f: Fn, target: number, minLimit: number, maxLimit: number): number {
  let n = 0;
  let lt = minLimit;
  let ht = maxLimit;
  let lError = f(lt) - target;

  let currentError = 100000000;
  let x = 0;
  while (Math.abs(currentError) > ROOTFINDER_VALUE_TOLERANCE && n++ < BISECT_MAX_ITERATIONS && ht - lt > 0.0001) {
    x = (ht + lt) / 2.0;
    const currentValue = f(x);
    currentError = currentValue - target;

    if (currentError * lError < 0.0) {
      ht = x;
    } else {
      lt = x;
      lError = currentError;
    }
  }
  return x;
}

/** Port of MathUtils.RootFinder.getRoot(Function, targetValue, minLimit, maxLimit). */
export function getRoot(f: Fn, targetValue: number, minLimit = 0.0, maxLimit = 1.0): number {
  const x = secantRoot(f, targetValue, minLimit, maxLimit);
  const secantActual = f(x);

  if (Math.abs(secantActual - targetValue) > ROOTFINDER_VALUE_TOLERANCE) {
    const bisectX = bisectRoot(f, targetValue, minLimit, maxLimit);
    const bisectActual = f(bisectX);

    if (Math.abs(bisectActual - targetValue) > ROOTFINDER_VALUE_TOLERANCE) {
      return Math.abs(bisectActual - targetValue) < Math.abs(secantActual - targetValue) ? bisectX : x;
    }
    return bisectX;
  }

  return x;
}
```

- [ ] **Step 9: Run test, verify passes**

- [ ] **Step 10: Commit**

```bash
git add webapp/src/core/bezier/point.ts webapp/src/core/bezier/vecMath.ts webapp/src/core/bezier/vecMath.test.ts webapp/src/core/bezier/rootFinder.ts webapp/src/core/bezier/rootFinder.test.ts
git commit -m "Port VecMath and MathUtils.RootFinder to core/bezier"
```

---

## Task 2: core/bezier — BezierKnot

**Goal:** Port `cadcore.BezierKnot`: a control point with an endpoint and two tangent handles, supporting masks (axis locks on move), tangent locks (clamp on set), a "slave" knot link, and continuity.

**Files:**
- Create: `webapp/src/core/bezier/bezierKnot.ts`
- Create: `webapp/src/core/bezier/bezierKnot.test.ts`

**Acceptance Criteria:**
- [ ] `points` is a 3-tuple `[endpoint, tangentToPrev, tangentToNext]`, matching Java's index convention (0/1/2) used elsewhere
- [ ] `setControlPointLocation` moves all 3 points by the same delta (masked by `xMask`/`yMask`) and propagates to `slave` if set
- [ ] `setTangentToPrev`/`setTangentToNext` apply lock clamping (`LOCK_X_MORE/LESS`, `LOCK_Y_MORE/LESS`) via `handleLocks`
- [ ] `clone()` deep-copies points (slave reference is NOT deep-cloned — matches Java's `set()`, which copies the slave reference as-is)

**Verify:** `cd webapp && npx vitest run src/core/bezier/bezierKnot.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write tests**

Create `webapp/src/core/bezier/bezierKnot.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BezierKnot, LOCK_X_MORE, LOCK_Y_LESS } from './bezierKnot';

describe('BezierKnot', () => {
  it('constructs with endpoint and tangent points', () => {
    const k = new BezierKnot(1, 2, 0, 0, 3, 4);
    expect(k.points[0]).toEqual({ x: 1, y: 2 });
    expect(k.points[1]).toEqual({ x: 0, y: 0 });
    expect(k.points[2]).toEqual({ x: 3, y: 4 });
  });

  it('setControlPointLocation moves all three points by the same delta', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    k.setControlPointLocation(5, 5);
    expect(k.points[0]).toEqual({ x: 5, y: 5 });
    expect(k.points[1]).toEqual({ x: 4, y: 5 });
    expect(k.points[2]).toEqual({ x: 6, y: 5 });
  });

  it('setControlPointLocation respects xMask/yMask', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    k.setMask(0, 1);
    k.setControlPointLocation(5, 5);
    expect(k.points[0]).toEqual({ x: 0, y: 5 });
  });

  it('setControlPointLocation updates a slave knot endpoint and tangent deltas', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    const slave = new BezierKnot(10, 10, 9, 10, 11, 10);
    // setSlave() itself calls updateSlave() once (endpoint snaps to k's endpoint (0,0);
    // tangents shift by the (10,10) delta between the two endpoints), so slave's
    // tangents are already (19,20)/(21,20) before setControlPointLocation runs.
    k.setSlave(slave);
    // setControlPointLocation(2,3) then applies a further (2,3) delta on top of that.
    k.setControlPointLocation(2, 3);
    expect(slave.points[0]).toEqual({ x: 2, y: 3 });
    expect(slave.points[1]).toEqual({ x: 21, y: 23 });
    expect(slave.points[2]).toEqual({ x: 23, y: 23 });
  });

  it('setTangentToNext clamps against LOCK_X_MORE', () => {
    const k = new BezierKnot(5, 5, 4, 5, 6, 5);
    k.setTangentToNextLocks(LOCK_X_MORE);
    k.setTangentToNext(3, 5);
    expect(k.points[2].x).toBe(5);
  });

  it('setTangentToPrev clamps against LOCK_Y_LESS', () => {
    const k = new BezierKnot(5, 5, 4, 5, 6, 5);
    k.setTangentToPrevLocks(LOCK_Y_LESS);
    k.setTangentToPrev(4, 10);
    expect(k.points[1].y).toBe(5);
  });

  it('getAngleBetweenTangents returns PI for a straight (fully smooth) knot', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    expect(k.getAngleBetweenTangents()).toBeCloseTo(Math.PI);
  });

  it('clone deep-copies points so mutating the clone does not affect the original', () => {
    const k = new BezierKnot(0, 0, -1, 0, 1, 0);
    const c = k.clone();
    c.points[0].x = 99;
    expect(k.points[0].x).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement bezierKnot.ts**

Create `webapp/src/core/bezier/bezierKnot.ts` (port of `BezierKnot.java`; `compareTo`/`toString`/`fromString` from the Java version are used for CAM cross-section matching heuristics and legacy `.brd` text serialization — not needed since v1 uses JSON and doesn't need control-point diffing beyond `equals`):

```typescript
import type { Point2D } from './point';
import * as vec from './vecMath';

export const LOCK_X_MORE = 0x0001;
export const LOCK_X_LESS = 0x0010;
export const LOCK_Y_MORE = 0x0100;
export const LOCK_Y_LESS = 0x1000;

export const END_POINT = 0;
export const PREVIOUS_TANGENT = 1;
export const NEXT_TANGENT = 2;

export class BezierKnot {
  points: [Point2D, Point2D, Point2D];
  continuous = true;
  xMask = 1.0;
  yMask = 1.0;
  tangentPrevLocks = 0;
  tangentNextLocks = 0;
  slave: BezierKnot | null = null;

  constructor(cx = 0, cy = 0, px = 0, py = 0, nx = 0, ny = 0) {
    this.points = [
      { x: cx, y: cy },
      { x: px, y: py },
      { x: nx, y: ny },
    ];
  }

  get endPoint(): Point2D {
    return this.points[0];
  }

  get tangentToPrev(): Point2D {
    return this.points[1];
  }

  get tangentToNext(): Point2D {
    return this.points[2];
  }

  getTangentToPrevLength(): number {
    return vec.length(this.points[1], this.points[0]);
  }

  getTangentToNextLength(): number {
    return vec.length(this.points[2], this.points[0]);
  }

  setControlPointLocation(x: number, y: number): void {
    const xDiff = (x - this.points[0].x) * this.xMask;
    const yDiff = (y - this.points[0].y) * this.yMask;

    this.points[0] = { x: this.points[0].x + xDiff, y: this.points[0].y + yDiff };
    this.points[1] = { x: this.points[1].x + xDiff, y: this.points[1].y + yDiff };
    this.points[2] = { x: this.points[2].x + xDiff, y: this.points[2].y + yDiff };

    if (this.slave != null) {
      this.updateSlave(xDiff, yDiff);
    }
  }

  updateSlave(xDiff: number, yDiff: number): void {
    const s = this.slave!;
    s.points[0] = { x: this.points[0].x, y: this.points[0].y };
    s.points[1] = { x: s.points[1].x + xDiff, y: s.points[1].y + yDiff };
    s.points[2] = { x: s.points[2].x + xDiff, y: s.points[2].y + yDiff };
  }

  setEndPoint(x: number, y: number): void {
    this.points[0] = { x: x * this.xMask, y: y * this.yMask };
  }

  setTangentToPrev(x: number, y: number): void {
    this.points[1] = { x, y };
    this.handleLocks(this.points[1], this.tangentPrevLocks);
  }

  setTangentToNext(x: number, y: number): void {
    this.points[2] = { x, y };
    this.handleLocks(this.points[2], this.tangentNextLocks);
  }

  setLocation(index: 0 | 1 | 2, x: number, y: number): void {
    if (index === 0) this.setEndPoint(x, y);
    else if (index === 1) this.setTangentToPrev(x, y);
    else this.setTangentToNext(x, y);
  }

  scale(scaleX: number, scaleY: number): void {
    this.points = this.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })) as [Point2D, Point2D, Point2D];
  }

  translate(dx: number, dy: number): void {
    this.points = this.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) as [Point2D, Point2D, Point2D];
  }

  scaleTangentToPrev(scale: number): void {
    const v = vec.scale(vec.sub(this.endPoint, this.tangentToPrev), scale);
    const p = vec.add(v, this.endPoint);
    this.setTangentToPrev(p.x, p.y);
  }

  scaleTangentToNext(scale: number): void {
    const v = vec.scale(vec.sub(this.endPoint, this.tangentToNext), scale);
    const p = vec.add(v, this.endPoint);
    this.setTangentToNext(p.x, p.y);
  }

  getTangentToPrevAngle(): number {
    const u = { x: 0, y: 1 };
    const v = vec.sub(this.endPoint, this.tangentToPrev);
    return vec.angleBetween(u, v);
  }

  setTangentToPrevAngle(angle: number): void {
    const next = this.tangentToPrev;
    const sx = next.x - this.endPoint.x;
    const sy = next.y - this.endPoint.y;
    const rotAngle = angle - this.getTangentToPrevAngle();
    const xDiff = Math.cos(rotAngle) * sx - Math.sin(rotAngle) * sy - sx;
    const yDiff = Math.sin(rotAngle) * sx + Math.cos(rotAngle) * sy - sy;
    this.setTangentToPrev(next.x + xDiff, next.y + yDiff);
  }

  getTangentToNextAngle(): number {
    const u = { x: 0, y: 1 };
    const v = vec.sub(this.endPoint, this.tangentToNext);
    return vec.angleBetween(u, v);
  }

  setTangentToNextAngle(angle: number): void {
    const next = this.tangentToNext;
    const sx = next.x - this.endPoint.x;
    const sy = next.y - this.endPoint.y;
    const rotAngle = angle - this.getTangentToNextAngle();
    const xDiff = Math.cos(rotAngle) * sx - Math.sin(rotAngle) * sy - sx;
    const yDiff = Math.sin(rotAngle) * sx + Math.cos(rotAngle) * sy - sy;
    this.setTangentToNext(next.x + xDiff, next.y + yDiff);
  }

  getAngleBetweenTangents(): number {
    const v1 = vec.sub(this.endPoint, this.tangentToPrev);
    const v2 = vec.sub(this.endPoint, this.tangentToNext);
    return vec.angleBetween(v1, v2);
  }

  setMask(x: number, y: number): void {
    this.xMask = x;
    this.yMask = y;
  }

  setTangentToPrevLocks(locks: number): void {
    this.tangentPrevLocks = locks;
  }

  setTangentToNextLocks(locks: number): void {
    this.tangentNextLocks = locks;
  }

  addTangentToPrevLocks(locks: number): void {
    this.tangentPrevLocks |= locks;
  }

  addTangentToNextLocks(locks: number): void {
    this.tangentNextLocks |= locks;
  }

  setSlave(slave: BezierKnot): void {
    this.slave = slave;
    const xDiff = slave.points[0].x - this.points[0].x;
    const yDiff = slave.points[0].y - this.points[0].y;
    this.updateSlave(xDiff, yDiff);
  }

  handleLocks(point: Point2D, locks: number): void {
    if ((locks & LOCK_X_MORE) !== 0 && this.points[0].x > point.x) point.x = this.points[0].x;
    if ((locks & LOCK_X_LESS) !== 0 && this.points[0].x < point.x) point.x = this.points[0].x;
    if ((locks & LOCK_Y_MORE) !== 0 && this.points[0].y > point.y) point.y = this.points[0].y;
    if ((locks & LOCK_Y_LESS) !== 0 && this.points[0].y < point.y) point.y = this.points[0].y;
  }

  switchTangents(): void {
    const tmp = this.points[1];
    this.points[1] = this.points[2];
    this.points[2] = tmp;
  }

  equals(other: BezierKnot): boolean {
    for (let i = 0; i < 3; i++) {
      if (this.points[i].x !== other.points[i].x) return false;
      if (this.points[i].y !== other.points[i].y) return false;
    }
    return this.continuous === other.continuous;
  }

  set(other: BezierKnot): void {
    this.continuous = other.continuous;
    this.slave = other.slave;
    this.tangentPrevLocks = other.tangentPrevLocks;
    this.tangentNextLocks = other.tangentNextLocks;
    this.points = [
      { x: other.points[0].x, y: other.points[0].y },
      { x: other.points[1].x, y: other.points[1].y },
      { x: other.points[2].x, y: other.points[2].y },
    ];
  }

  clone(): BezierKnot {
    const k = new BezierKnot();
    k.continuous = this.continuous;
    k.xMask = this.xMask;
    k.yMask = this.yMask;
    k.tangentPrevLocks = this.tangentPrevLocks;
    k.tangentNextLocks = this.tangentNextLocks;
    k.slave = this.slave;
    k.points = [
      { x: this.points[0].x, y: this.points[0].y },
      { x: this.points[1].x, y: this.points[1].y },
      { x: this.points[2].x, y: this.points[2].y },
    ];
    return k;
  }
}
```

- [ ] **Step 4: Run test, verify passes**

- [ ] **Step 5: Commit**

```bash
git add webapp/src/core/bezier/bezierKnot.ts webapp/src/core/bezier/bezierKnot.test.ts
git commit -m "Port BezierKnot to core/bezier"
```

---

## Task 3: core/bezier — BezierCurve

**Goal:** Port the subset of `cadcore.BezierCurve` actually exercised by the rest of this plan: cubic evaluation, length, `t`-for-`x` search, closest-point search, de Casteljau splitting, and numeric min/max.

**Scope cut:** `getTangent`/`getNormal`/`getCurvature*`/`getTForTangent*`/`getTForDistance` are not ported — nothing in the v1 feature set (outline/cross-section/rocker editing, Bezier fit, uniform-arc-length mesh sampling) calls them. Three.js computes mesh normals itself (`computeVertexNormals()`), so no analytic surface normal is needed either.

**Files:**
- Create: `webapp/src/core/bezier/bezierCurve.ts`
- Create: `webapp/src/core/bezier/bezierCurve.test.ts`

**Acceptance Criteria:**
- [ ] A straight-line curve (P0=P1=tangent-collinear) evaluates `getXValue(0.5)`/`getYValue(0.5)` at the geometric midpoint
- [ ] `getTForX` round-trips: `getXValue(getTForX(x)) ≈ x`
- [ ] `getLength()` of a straight curve matches the Euclidean endpoint distance
- [ ] `getSplitControlPoint(0.5)` produces a knot whose endpoint equals `getValue(0.5)`
- [ ] `getClosestT` finds `t≈0.5` for a point nearest the curve's midpoint

**Verify:** `cd webapp && npx vitest run src/core/bezier/bezierCurve.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write tests**

Create `webapp/src/core/bezier/bezierCurve.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BezierCurve } from './bezierCurve';
import { BezierKnot } from './bezierKnot';

function straightCurve(): BezierCurve {
  // A straight line from (0,0) to (10,0), tangents collinear so the cubic degenerates to a line.
  return new BezierCurve(0, 0, 3.33, 0, 6.66, 0, 10, 0);
}

describe('BezierCurve', () => {
  it('evaluates a straight curve at its geometric midpoint', () => {
    const c = straightCurve();
    expect(c.getXValue(0.5)).toBeCloseTo(5, 1);
    expect(c.getYValue(0.5)).toBeCloseTo(0, 6);
  });

  it('getTForX round-trips to getXValue', () => {
    const c = straightCurve();
    const t = c.getTForX(7);
    expect(c.getXValue(t)).toBeCloseTo(7, 2);
  });

  it('getLength of a straight curve equals the endpoint distance', () => {
    const c = straightCurve();
    expect(c.getLength()).toBeCloseTo(10, 1);
  });

  it('getSplitControlPoint(0.5) endpoint equals getValue(0.5)', () => {
    const c = straightCurve();
    const mid = c.getValue(0.5);
    const split = c.getSplitControlPoint(0.5);
    expect(split.points[0].x).toBeCloseTo(mid.x, 6);
    expect(split.points[0].y).toBeCloseTo(mid.y, 6);
  });

  it('getClosestT finds t near 0.5 for a point near the curve midpoint', () => {
    const c = straightCurve();
    const t = c.getClosestT({ x: 5, y: 0.01 });
    expect(t).toBeCloseTo(0.5, 1);
  });

  it('recomputes coefficients after setDirty() following a knot mutation', () => {
    // Java's BezierCurve listens for knot changes (BezierKnotChangeListener.onChange)
    // and auto-invalidates its cache; that observer pattern was deliberately not
    // ported in Task 2 (see bezierKnot.ts's class doc) — this architecture clones
    // the whole board per command instead, so callers must call setDirty() explicitly
    // if they mutate a knot a curve has already cached coefficients for.
    const start = new BezierKnot(0, 0, 0, 0, 3.33, 0);
    const end = new BezierKnot(10, 0, 6.66, 0, 0, 0);
    const c = new BezierCurve(start, end);
    expect(c.getXValue(1)).toBeCloseTo(10, 1);
    end.setEndPoint(20, 0);
    c.setDirty();
    expect(c.getXValue(1)).toBeCloseTo(20, 1);
  });
});
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement bezierCurve.ts**

Create `webapp/src/core/bezier/bezierCurve.ts` (port of the in-scope subset of `BezierCurve.java`):

```typescript
import type { Point2D } from './point';
import { BezierKnot } from './bezierKnot';
import * as vec from './vecMath';

export const ZERO = 0.0000000001;
export const ONE = 0.9999999999;

const X = 0;
const Y = 1;
const MIN = 0;
const MAX = 1;

const POS_TOLERANCE = 0.003; // 0.03mm
const POS_MAX_ITERATIONS = 30;
const LENGTH_TOLERANCE = 0.001;
const MIN_MAX_TOLERANCE = 0.0001;
const MIN_MAX_SPLITS = 96;

export class BezierCurve {
  private startKnot: BezierKnot;
  private endKnot: BezierKnot;

  private coeff0 = 0;
  private coeff1 = 0;
  private coeff2 = 0;
  private coeff3 = 0;
  private coeff4 = 0;
  private coeff5 = 0;
  private coeff6 = 0;
  private coeff7 = 0;
  private coeffDirty = true;

  constructor(
    p0xOrStart: number | BezierKnot,
    p0yOrEnd?: number | BezierKnot,
    p1x?: number,
    p1y?: number,
    p2x?: number,
    p2y?: number,
    p3x?: number,
    p3y?: number,
  ) {
    if (p0xOrStart instanceof BezierKnot) {
      this.startKnot = p0xOrStart;
      this.endKnot = p0yOrEnd as BezierKnot;
    } else {
      this.startKnot = new BezierKnot(p0xOrStart, p0yOrEnd as number, 0, 0, p1x!, p1y!);
      this.endKnot = new BezierKnot(p3x!, p3y!, p2x!, p2y!, 0, 0);
    }
  }

  getStartKnot(): BezierKnot {
    return this.startKnot;
  }

  getEndKnot(): BezierKnot {
    return this.endKnot;
  }

  setStartKnot(knot: BezierKnot): void {
    this.startKnot = knot;
    this.setDirty();
  }

  setEndKnot(knot: BezierKnot | null): void {
    this.endKnot = knot as BezierKnot;
    this.setDirty();
  }

  setDirty(): void {
    this.coeffDirty = true;
  }

  private calculateCoeff(): void {
    if (!this.coeffDirty) return;

    const p0 = this.startKnot.endPoint;
    const t1 = this.startKnot.tangentToNext;
    const t2 = this.endKnot.tangentToPrev;
    const p3 = this.endKnot.endPoint;

    this.coeff0 = p3.x + 3 * (-t2.x + t1.x) - p0.x;
    this.coeff1 = 3 * (t2.x - 2 * t1.x + p0.x);
    this.coeff2 = 3 * (t1.x - p0.x);
    this.coeff3 = p0.x;

    this.coeff4 = p3.y + 3 * (-t2.y + t1.y) - p0.y;
    this.coeff5 = 3 * (t2.y - 2 * t1.y + p0.y);
    this.coeff6 = 3 * (t1.y - p0.y);
    this.coeff7 = p0.y;

    this.coeffDirty = false;
  }

  getXValue(t: number): number {
    this.calculateCoeff();
    return ((((this.coeff0 * t + this.coeff1) * t) + this.coeff2) * t) + this.coeff3;
  }

  getYValue(t: number): number {
    this.calculateCoeff();
    return ((((this.coeff4 * t + this.coeff5) * t) + this.coeff6) * t) + this.coeff7;
  }

  getValue(t: number): Point2D {
    this.calculateCoeff();
    return { x: this.getXValue(t), y: this.getYValue(t) };
  }

  private getXDerivate(t: number): number {
    return (((3 * this.coeff0 * t) + 2 * this.coeff1) * t) + this.coeff2;
  }

  getTForX(x: number, startT?: number): number {
    this.calculateCoeff();
    const t = startT ?? (x - this.endKnot.endPoint.x) / (this.startKnot.endPoint.x - this.endKnot.endPoint.x);
    return this.getTForXInternal(x, t);
  }

  private getTForXInternal(x: number, startT: number): number {
    let tn = startT;
    let xn = this.getXValue(tn);
    let error = x - xn;
    let n = 0;

    while (Math.abs(error) > POS_TOLERANCE && n++ < POS_MAX_ITERATIONS) {
      const currentSlope = 1 / this.getXDerivate(tn);
      tn = tn + error * currentSlope;
      xn = this.getXValue(tn);
      error = x - xn;
    }

    if (tn < 0 || tn > 1 || Number.isNaN(tn) || n >= POS_MAX_ITERATIONS || Math.abs(error) > POS_TOLERANCE) {
      // Use the full MIN_MAX_SPLITS (96), matching Java's BezierCurve.getTForXInternal
      // fallback (BezierSpline.MIN_MAX_SPLITS) — this fallback runs exactly when Newton's
      // method already failed to converge (near-vertical tangent, tight curvature), which
      // is the wrong place to trade away precision for speed.
      tn = this.getTForXBySearch(x, 0, 1, MIN_MAX_SPLITS);
    }
    return tn;
  }

  private getTForXBySearch(x: number, t0: number, t1: number, nrOfSplits: number): number {
    let bestT = 0;
    let bestError = 1e9;
    const seg = (t1 - t0) / nrOfSplits;

    for (let i = 1; i < nrOfSplits; i++) {
      const currentT = seg * i + t0;
      if (currentT < 0 || currentT > 1) continue;
      const error = Math.abs(x - this.getXValue(currentT));
      if (error < bestError) {
        bestError = error;
        bestT = currentT;
      }
    }

    if (bestError < POS_TOLERANCE) return bestT;
    if (Math.abs(bestT - (t1 - t0) / 2) < MIN_MAX_TOLERANCE) return bestT;
    if (nrOfSplits <= 2) return bestT;
    return this.getTForXBySearch(x, bestT - seg, bestT + seg, Math.floor(nrOfSplits / 2));
  }

  getYForX(x: number): number {
    this.calculateCoeff();
    const t0 = (x - this.startKnot.endPoint.x) / (this.endKnot.endPoint.x - this.startKnot.endPoint.x);
    const t = this.getTForXInternal(x, t0);
    return this.getYValue(t);
  }

  getMinX(): number {
    return this.getMinMaxNumerical(X, MIN);
  }
  getMaxX(): number {
    return this.getMinMaxNumerical(X, MAX);
  }
  getMinY(): number {
    return this.getMinMaxNumerical(Y, MIN);
  }
  getMaxY(): number {
    return this.getMinMaxNumerical(Y, MAX);
  }

  getMinMaxNumerical(xOrY: number, minOrMax: number, t0 = 0, t1 = 1, nrOfSplits = MIN_MAX_SPLITS): number {
    this.calculateCoeff();
    let bestT = 0;
    let bestValue = minOrMax === MAX ? -1e7 : 1e7;
    const seg = (t1 - t0) / nrOfSplits;

    for (let i = 0; i < nrOfSplits; i++) {
      const currentT = seg * i + t0;
      if (currentT < 0 || currentT > 1) continue;
      const currentValue = xOrY === X ? this.getXValue(currentT) : this.getYValue(currentT);
      if (minOrMax === MAX ? currentValue >= bestValue : currentValue <= bestValue) {
        bestValue = currentValue;
        bestT = currentT;
      }
    }

    // Java's BezierCurve.getMinMaxNumerical omits Math.abs() here (`best_t - ((t1-t0)/2) <
    // MIN_MAX_TOLERANCE`), which means the recursive refinement only ever runs when the
    // found extremum falls in the *second* half of the search interval — for the first
    // half, it silently returns the coarse first-pass grid value. Verified empirically:
    // this produces a ~10,000x precision swing (e.g. 7.7e-4 error vs 6.6e-11) purely based
    // on which half of the t-domain the extremum happens to land in. Unlike rootFinder.ts's
    // similar Java quirk (Task 1), nothing needs bug-compatibility with Java's exact values
    // here, and this method has real downstream consumers (BezierSpline's own min/max, board
    // width/thickness, curve-fit range detection) — so this port deliberately fixes it with
    // Math.abs, trading zero cost for materially better accuracy.
    if (Math.abs(bestT - (t1 - t0) / 2) < MIN_MAX_TOLERANCE) return bestValue;
    if (nrOfSplits <= 2) return bestValue;
    return this.getMinMaxNumerical(xOrY, minOrMax, bestT - seg, bestT + seg, Math.floor(nrOfSplits / 2));
  }

  getLength(t0 = ZERO, t1 = ONE): number {
    this.calculateCoeff();
    const x0 = this.getXValue(t0);
    const y0 = this.getYValue(t0);
    const x1 = this.getXValue(t1);
    const y1 = this.getYValue(t1);

    const ts = (t1 - t0) / 2 + t0;
    const sx = this.getXValue(ts);
    const sy = this.getYValue(ts);

    const length = vec.length({ x: x0, y: y0 }, { x: sx, y: sy }) + vec.length({ x: sx, y: sy }, { x: x1, y: y1 });
    const chord = vec.length({ x: x0, y: y0 }, { x: x1, y: y1 });

    if (length - chord > LENGTH_TOLERANCE && t1 - t0 > 0.001) {
      return this.getLength(t0, ts) + this.getLength(ts, t1);
    }
    return length;
  }

  // Two explicit overload signatures — restricts callers to exactly the 1-arg or
  // 3-arg forms. The all-optional single-signature version silently mis-dispatches
  // a 2-arg call into the 3-arg branch with lengthLeft as undefined; TS overloads
  // catch that at compile time instead of producing NaN-driven behavior at runtime.
  getTForLength(lengthLeft: number): number;
  getTForLength(t0: number, t1: number, lengthLeft: number): number;
  getTForLength(lengthLeftOrT0: number, t1?: number, lengthLeft?: number): number {
    this.calculateCoeff();
    if (t1 === undefined) {
      return this.getTForLength(ZERO, ONE, lengthLeftOrT0);
    }
    const t0 = lengthLeftOrT0;
    const remaining = lengthLeft!;

    if (Math.abs(t0 - t1) < 0.00001) return t0;

    const ts = (t1 - t0) / 2 + t0;
    const sl = this.getLength(t0, ts);

    if (Math.abs(sl - remaining) > LENGTH_TOLERANCE) {
      return sl > remaining ? this.getTForLength(t0, ts, remaining) : this.getTForLength(ts, t1, remaining - sl);
    }
    return ts;
  }

  getClosestT(point: Point2D, t0 = 0, t1 = 1, nrOfSplits = 32): number {
    this.calculateCoeff();
    let bestT = 0;
    let minDist = 1e9;
    const seg = (t1 - t0) / nrOfSplits;

    for (let i = 0; i < nrOfSplits; i++) {
      const currentT = seg * i + t0;
      if (currentT < 0 || currentT > 1) continue;
      const dist = vec.length({ x: this.getXValue(currentT), y: this.getYValue(currentT) }, point);
      if (dist <= minDist) {
        minDist = dist;
        bestT = currentT;
      }
    }

    if (bestT - (t1 - t0) / 2 < 0.001) return bestT;
    if (nrOfSplits <= 2) return bestT;
    return this.getClosestT(point, bestT - seg, bestT + seg, Math.floor(nrOfSplits / 2));
  }

  /** De Casteljau split: returns a knot whose endpoint/tangents are the curve's local control polygon at t. */
  getSplitControlPoint(t: number): BezierKnot {
    const q1 = vec.add(vec.scale(vec.sub(this.startKnot.endPoint, this.startKnot.tangentToNext), t), this.startKnot.endPoint);
    const q2 = vec.add(vec.scale(vec.sub(this.startKnot.tangentToNext, this.endKnot.tangentToPrev), t), this.startKnot.tangentToNext);
    const q3 = vec.add(vec.scale(vec.sub(this.endKnot.tangentToPrev, this.endKnot.endPoint), t), this.endKnot.tangentToPrev);

    const r2 = vec.add(vec.scale(vec.sub(q1, q2), t), q1);
    const r3 = vec.add(vec.scale(vec.sub(q2, q3), t), q2);
    const r1 = vec.add(vec.scale(vec.sub(r2, r3), t), r2);

    const ret = new BezierKnot();
    ret.points[0] = r1;
    ret.points[1] = r2;
    ret.points[2] = r3;
    return ret;
  }
}
```

- [ ] **Step 4: Run test, verify passes**

- [ ] **Step 5: Commit**

```bash
git add webapp/src/core/bezier/bezierCurve.ts webapp/src/core/bezier/bezierCurve.test.ts
git commit -m "Port BezierCurve (evaluation, length, split, closest-point) to core/bezier"
```

---

## Task 4: core/bezier — BezierSpline

**Goal:** Port the subset of `cadcore.BezierSpline` needed by board editing, fitting, and mesh sampling: control-point list management, `getValueAt` (used for rocker/deck/width lookups), `getPointByS` (used for uniform arc-length mesh sampling), `getSplitControlPoint` (add-control-point), `scale`/`translate`/`clone`.

**Scope cut:** hit-testing (`findBestMatch`/`getBestMatchWhich`) is reimplemented directly in `app/editor2d` (Task 15) instead of ported here — it's pointer/pixel-space interaction logic, not curve math, so it belongs in the app layer per the design doc's core/app split. `getValueAtReverse`, tangent/normal/angle-based length queries, and `toString`/`fromString` (legacy text format) are not ported — nothing in scope calls them (see the "Deliberate simplifications" section at the top of this plan).

**Files:**
- Create: `webapp/src/core/bezier/bezierSpline.ts`
- Create: `webapp/src/core/bezier/bezierSpline.test.ts`

**Acceptance Criteria:**
- [ ] `append` builds curves incrementally the same way as Java (first knot creates a dangling curve, second completes it, subsequent knots chain)
- [ ] `getValueAt(x)` returns the y-value of the segment containing x
- [ ] `getPointByS(0)`/`getPointByS(1)` return the first/last control point's endpoint
- [ ] `getSplitControlPoint` finds the correct segment and returns an insertion index
- [ ] `clone()` is a deep copy (mutating the clone's control points does not affect the original)

**Verify:** `cd webapp && npx vitest run src/core/bezier/bezierSpline.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write tests**

Create `webapp/src/core/bezier/bezierSpline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BezierSpline } from './bezierSpline';
import { BezierKnot } from './bezierKnot';

function straightSpline(): BezierSpline {
  // Two knots, straight line (0,0) -> (10,0), collinear tangents.
  const s = new BezierSpline();
  s.append(new BezierKnot(0, 0, 0, 0, 3.33, 0));
  s.append(new BezierKnot(10, 0, 6.66, 0, 10, 0));
  return s;
}

describe('BezierSpline', () => {
  it('append builds one curve from two knots', () => {
    const s = straightSpline();
    expect(s.getNrOfControlPoints()).toBe(2);
    expect(s.getNrOfCurves()).toBe(1);
  });

  it('getValueAt returns the y value of the containing segment', () => {
    const s = new BezierSpline();
    s.append(new BezierKnot(0, 0, 0, 0, 3.33, 1));
    s.append(new BezierKnot(10, 2, 6.66, 1.5, 10, 2));
    const y = s.getValueAt(5);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(2);
  });

  it('getPointByS(0) and getPointByS(1) return the endpoints', () => {
    const s = straightSpline();
    const p0 = s.getPointByS(0);
    const p1 = s.getPointByS(1);
    expect(p0.x).toBeCloseTo(0, 3);
    expect(p1.x).toBeCloseTo(10, 3);
  });

  it('getPointByS(0.5) is between the endpoints along x', () => {
    const s = straightSpline();
    const mid = s.getPointByS(0.5);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(10);
  });

  it('insert adds a control point between two existing ones', () => {
    const s = straightSpline();
    const knot = new BezierKnot(5, 0, 4, 0, 6, 0);
    s.insert(1, knot);
    expect(s.getNrOfControlPoints()).toBe(3);
    expect(s.getControlPoint(1)).toBe(knot);
  });

  it('remove deletes a control point and rejoins the curve', () => {
    const s = straightSpline();
    s.insert(1, new BezierKnot(5, 0, 4, 0, 6, 0));
    s.remove(1);
    expect(s.getNrOfControlPoints()).toBe(2);
  });

  it('getSplitControlPoint finds the nearest segment and returns an insertion index', () => {
    const s = straightSpline();
    const out = new BezierKnot();
    const index = s.getSplitControlPoint({ x: 5, y: 0.1 }, out);
    expect(index).toBe(1);
    expect(out.points[0].x).toBeCloseTo(5, 0);
  });

  it('scale multiplies all control points', () => {
    const s = straightSpline();
    s.scale(2, 1);
    expect(s.getControlPoint(1).points[0].x).toBeCloseTo(20, 3);
  });

  it('clone deep-copies control points', () => {
    const s = straightSpline();
    const c = s.clone();
    c.getControlPoint(0).points[0].x = 999;
    expect(s.getControlPoint(0).points[0].x).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement bezierSpline.ts**

Create `webapp/src/core/bezier/bezierSpline.ts` (port of the in-scope subset of `BezierSpline.java`):

```typescript
import type { Point2D } from './point';
import { BezierKnot } from './bezierKnot';
import { BezierCurve, ZERO, ONE } from './bezierCurve';
import * as vec from './vecMath';

const X = 0;
const Y = 1;
const MIN = 0;
const MAX = 1;
const MIN_MAX_SPLITS = 96;

export class BezierSpline {
  private curves: BezierCurve[] = [];

  private isLastControlPointNull(): boolean {
    if (this.curves.length === 0) return true;
    return this.curves[this.curves.length - 1].getEndKnot() == null;
  }

  append(controlPoint: BezierKnot): void {
    if (this.curves.length === 0) {
      this.curves.push(new BezierCurve(controlPoint, null as unknown as BezierKnot));
    } else if (this.curves.length === 1 && this.curves[0].getEndKnot() == null) {
      this.curves[0].setEndKnot(controlPoint);
    } else {
      this.curves.push(new BezierCurve(this.curves[this.curves.length - 1].getEndKnot(), controlPoint));
    }
  }

  insert(i: number, controlPoint: BezierKnot): void {
    let next: BezierKnot | null = null;
    if (i < this.getNrOfControlPoints()) {
      next = this.getControlPoint(i);
    }
    if (i > 0 && i - 1 < this.curves.length) {
      this.curves[i - 1].setEndKnot(controlPoint);
    }
    const newCurve = new BezierCurve(controlPoint, next as BezierKnot);
    this.curves.splice(i, 0, newCurve);
  }

  remove(knotOrIndex: BezierKnot | number): void {
    const i = typeof knotOrIndex === 'number' ? knotOrIndex : this.indexOf(knotOrIndex);
    let removeCurve: BezierCurve | null = null;
    if (i < this.curves.length) removeCurve = this.curves[i];
    if (i > 0 && i - 1 < this.curves.length) {
      this.curves[i - 1].setEndKnot(removeCurve != null ? removeCurve.getEndKnot() : null);
    }
    if (removeCurve != null) {
      const idx = this.curves.indexOf(removeCurve);
      if (idx !== -1) this.curves.splice(idx, 1);
    }
  }

  getControlPoint(i: number): BezierKnot {
    // Valid indices are [0, curves.length] for a complete spline (getNrOfControlPoints()
    // === curves.length + 1). Java's equivalent check (`mCurves.size() < i - 1`) has an
    // off-by-one that throws IndexOutOfBoundsException instead of returning null for
    // i === curves.length + 1 specifically; fixed here since nothing needs bug-compatibility
    // with a crash, and an out-of-range index is a reasonable thing for a caller to probe.
    if (this.curves.length === 0 || i < 0 || i > this.curves.length) return null as unknown as BezierKnot;
    return i === 0 ? this.curves[0].getStartKnot() : this.curves[i - 1].getEndKnot();
  }

  getCurve(i: number): BezierCurve {
    return this.curves[i];
  }

  indexOf(controlPoint: BezierKnot): number {
    for (let i = 0; i < this.curves.length + 1; i++) {
      if (controlPoint === this.getControlPoint(i)) return i;
    }
    return -1;
  }

  getNrOfControlPoints(): number {
    return this.curves.length + (this.isLastControlPointNull() ? 0 : 1);
  }

  getNrOfCurves(): number {
    return this.curves.length;
  }

  clear(): void {
    this.curves = [];
  }

  private findMatchingBezierSegment(pos: number): number {
    for (let i = 0; i < this.curves.length; i++) {
      const lx = this.curves[i].getStartKnot().endPoint.x;
      const ux = this.curves[i].getEndKnot().endPoint.x;
      if (lx <= pos && ux >= pos) return i;
    }
    for (let i = 0; i < this.curves.length; i++) {
      const curve = this.curves[i];
      const lx = curve.getMinMaxNumerical(X, MIN);
      const ux = curve.getMinMaxNumerical(X, MAX);
      if ((lx <= pos && ux >= pos) || (ux <= pos && lx >= pos)) return i;
    }
    return -1;
  }

  getValueAt(pos: number): number {
    const index = this.findMatchingBezierSegment(pos);
    if (index === -1) return 0.0;
    return this.curves[index].getYForX(pos);
  }

  getMaxX(): number {
    let max = -100000;
    for (const c of this.curves) max = Math.max(max, c.getMaxX());
    return max;
  }

  // Java's BezierSpline.getMinX()/getMaxY() genuinely loop `i < mCurves.size() - 1`,
  // skipping the last curve — confirmed against BezierSpline.java directly, not a
  // transcription error. This is a real bug, not an intentional design choice: it can
  // both under-report the true extremum (if it falls in the last segment) and return a
  // bogus sentinel value entirely for a 1-curve spline. getMaxY() feeds getMaxWidth()/
  // getMaxRocker() (Task 6), which Task 7's scaleBoard divides by — a wrong value there
  // produces wrong scaling, not just a cosmetic display glitch. Fixed to loop over all
  // curves (matching the already-correct getMaxX()/getMinY() below), since nothing needs
  // bug-compatibility with Java's under-reported extrema.
  getMinX(): number {
    let min = Number.MAX_VALUE;
    for (const c of this.curves) min = Math.min(min, c.getMinX());
    return min;
  }

  getMaxY(): number {
    let max = -Number.MAX_VALUE;
    for (const c of this.curves) max = Math.max(max, c.getMaxY());
    return max;
  }

  getMinY(): number {
    let min = 100000;
    for (const c of this.curves) min = Math.min(min, c.getMinY());
    return min;
  }

  getLength(): number {
    let length = 0;
    for (const c of this.curves) length += c.getLength();
    return length;
  }

  getPointByS(s: number): Point2D {
    return this.getPointByCurveLength(s * this.getLength());
  }

  getPointByCurveLength(curveLength: number): Point2D {
    let l = curveLength;

    if (curveLength <= 0.0) {
      const c = this.curves[0];
      return { x: c.getXValue(ZERO), y: c.getYValue(ZERO) };
    }
    if (curveLength >= this.getLength()) {
      const c = this.curves[this.curves.length - 1];
      return { x: c.getXValue(ONE), y: c.getYValue(ONE) };
    }

    let curve: BezierCurve | null = null;
    let t = -1;
    for (let i = 0; i < this.curves.length; i++) {
      curve = this.curves[i];
      const currentLength = curve.getLength();
      if (l < currentLength) {
        t = curve.getTForLength(l);
        break;
      }
      l -= currentLength;
    }

    return { x: curve!.getXValue(t), y: curve!.getYValue(t) };
  }

  /** Port of BezierSpline.getSplitControlPoint: finds the closest curve segment to nearPoint, writes the split knot into `returned`, and returns the insertion index. */
  getSplitControlPoint(nearPoint: Point2D, returned: BezierKnot): number {
    let nearestDist = 1e8;
    let index = 0;
    let t = 0;

    for (let i = 0; i < this.curves.length; i++) {
      const curve = this.curves[i];
      const tc = curve.getClosestT(nearPoint);
      const dist = vec.length({ x: curve.getXValue(tc), y: curve.getYValue(tc) }, nearPoint);
      if (nearestDist > dist) {
        nearestDist = dist;
        index = i;
        t = tc;
      }
    }

    returned.set(this.curves[index].getSplitControlPoint(t));
    return index + 1;
  }

  /**
   * Mutates every knot directly (via BezierKnot.scale(), which reassigns `points` with no
   * change notification — see Task 3's note on BezierCurve having no listener wiring).
   * Any curve whose coefficients were already cached (coeffDirty=false, e.g. because
   * something called getMaxX()/getValueAt() on this spline before this scale()) would
   * otherwise silently keep returning pre-scale values. Found during Task 7: crossSection.ts's
   * scaleCrossSection() does exactly that — reads getWidth()/getCenterThickness() (forcing
   * evaluation) before calling scale() on the same spline. Invalidate every curve after the
   * mutation loop, unconditionally (not just the ones whose own knot object was directly
   * touched): the shared-knot invariant means mutating knot i also affects curve i-1's cached
   * value via its shared end knot, so looping over every curve is simpler and equally correct.
   */
  scale(scaleX: number, scaleY: number): void {
    for (let i = 0; i < this.curves.length; i++) {
      if (i === 0) this.curves[i].getStartKnot().scale(scaleX, scaleY);
      const endKnot = this.curves[i].getEndKnot();
      if (endKnot != null) endKnot.scale(scaleX, scaleY);
    }
    for (const c of this.curves) c.setDirty();
  }

  /** Same stale-cache bug as `scale()` above — see its comment for the full explanation. */
  translate(dx: number, dy: number): void {
    for (let i = 0; i < this.curves.length; i++) {
      if (i === 0) this.curves[i].getStartKnot().translate(dx, dy);
      const endKnot = this.curves[i].getEndKnot();
      if (endKnot != null) endKnot.translate(dx, dy);
    }
    for (const c of this.curves) c.setDirty();
  }

  clone(): BezierSpline {
    const spline = new BezierSpline();
    for (let i = 0; i < this.getNrOfControlPoints(); i++) {
      spline.append(this.getControlPoint(i).clone());
    }
    return spline;
  }
}
```

- [ ] **Step 4: Run test, verify passes**

- [ ] **Step 5: Commit**

```bash
git add webapp/src/core/bezier/bezierSpline.ts webapp/src/core/bezier/bezierSpline.test.ts
git commit -m "Port BezierSpline (control point list, evaluation, split, mesh sampling) to core/bezier"
```

---

## Task 5: core/bezier — BezierFit

**Goal:** Port `cadcore.BezierFit.bestFit`: given a list of guide points, least-squares fit a single cubic Bezier (4 control points) through them. The Java version depends on the `ujmp` matrix library (a CAM-era dependency not worth pulling into the browser bundle) — port the same linear algebra with a small local matrix helper instead.

**Files:**
- Create: `webapp/src/core/bezier/matrix.ts`
- Create: `webapp/src/core/bezier/matrix.test.ts`
- Create: `webapp/src/core/bezier/bezierFit.ts`
- Create: `webapp/src/core/bezier/bezierFit.test.ts`

**Acceptance Criteria:**
- [ ] `matrix.ts` provides `multiply`, `transpose`, `invert` (Gauss-Jordan) for `number[][]`, and `invert` round-trips (`invert(A) * A ≈ I`) for a well-conditioned matrix
- [ ] `bestFit` on points sampled exactly from a known Bezier curve recovers that curve's control points (within tolerance)
- [ ] `bestFit` on 3+ noisy-ish collinear points returns 4 points reasonably close to a straight line

**Verify:** `cd webapp && npx vitest run src/core/bezier/matrix.test.ts src/core/bezier/bezierFit.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write matrix tests**

Create `webapp/src/core/bezier/matrix.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { multiply, transpose, invert } from './matrix';

describe('matrix', () => {
  it('multiply computes standard matrix product', () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    expect(multiply(a, b)).toEqual([[19, 22], [43, 50]]);
  });

  it('transpose swaps rows and columns', () => {
    expect(transpose([[1, 2, 3], [4, 5, 6]])).toEqual([[1, 4], [2, 5], [3, 6]]);
  });

  it('invert(A) * A is approximately the identity matrix', () => {
    const a = [
      [4, 3, 2, 1],
      [3, 4, 3, 2],
      [2, 3, 4, 3],
      [1, 2, 3, 4],
    ];
    const inv = invert(a);
    const product = multiply(inv, a);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(product[i][j]).toBeCloseTo(i === j ? 1 : 0, 6);
      }
    }
  });
});
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement matrix.ts**

Create `webapp/src/core/bezier/matrix.ts`:

```typescript
export type Matrix = number[][];

export function multiply(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const inner = b.length;
  const cols = b[0].length;
  const result: Matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) sum += a[i][k] * b[k][j];
      result[i][j] = sum;
    }
  }
  return result;
}

export function transpose(a: Matrix): Matrix {
  const rows = a.length;
  const cols = a[0].length;
  const result: Matrix = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) result[j][i] = a[i][j];
  }
  return result;
}

/** Gauss-Jordan inversion of a square matrix. Throws if the matrix is singular. */
export function invert(a: Matrix): Matrix {
  const n = a.length;
  const augmented: Matrix = a.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivotRow][col])) pivotRow = row;
    }
    // The !Number.isFinite check matters as much as the magnitude check: Math.abs(NaN)
    // is NaN, and `NaN < 1e-12` is false, so a NaN-poisoned pivot (e.g. from dividing by
    // a zero total path length upstream in bezierFit.ts) would otherwise sail through
    // this guard and silently propagate NaN through the rest of the elimination instead
    // of throwing here where the problem is easy to diagnose.
    if (!Number.isFinite(augmented[pivotRow][col]) || Math.abs(augmented[pivotRow][col]) < 1e-12) {
      throw new Error('matrix is singular');
    }
    [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];

    const pivot = augmented[col][col];
    for (let j = 0; j < 2 * n; j++) augmented[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = 0; j < 2 * n; j++) augmented[row][j] -= factor * augmented[col][j];
    }
  }

  return augmented.map((row) => row.slice(n));
}
```

- [ ] **Step 4: Run test, verify passes**

- [ ] **Step 5: Write BezierFit tests**

Create `webapp/src/core/bezier/bezierFit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { bestFit } from './bezierFit';
import { BezierCurve } from './bezierCurve';
import type { Point2D } from './point';

describe('bestFit', () => {
  it('recovers control points from points sampled off a known curve', () => {
    const curve = new BezierCurve(0, 0, 3, 6, 7, 6, 10, 0);
    const points: Point2D[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      points.push(curve.getValue(t));
    }

    const fitted = bestFit(points);

    // Tolerance note: bestFit uses chord-length parametrization (cumulative distance
    // between consecutive points, normalized to [0,1]) as a stand-in for the curve's
    // true t-parameter, since real guide points (mouse clicks) have no known t. For a
    // curve with unequal tangent-handle lengths like this one, chord-length param
    // diverges meaningfully from true-t param (points sampled at even t-steps aren't
    // evenly spaced by arc length), which shows up as real, expected fitting error at
    // the endpoints (verified independently: the OLS solve itself is exact — normal
    // equation residual ~1e-12 — and substituting true-t param instead of chord-length
    // param recovers the original control points to ~1e-13. The ~0.08-0.28 unit
    // deviation here is entirely the chord-length approximation, not a solver bug).
    // toBeCloseTo(x, 0) => within 0.5, loose enough to accommodate that expected error
    // while still catching a genuinely broken fit (which would be off by whole units).
    expect(fitted[0].x).toBeCloseTo(0, 0);
    expect(fitted[0].y).toBeCloseTo(0, 0);
    expect(fitted[3].x).toBeCloseTo(10, 0);
    expect(fitted[3].y).toBeCloseTo(0, 0);
  });

  it('fits a near-straight line for collinear points', () => {
    const points: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 6, y: 0 },
      { x: 10, y: 0 },
    ];
    const fitted = bestFit(points);
    for (const p of fitted) expect(p.y).toBeCloseTo(0, 1);
  });

  it('throws for 1-3 points (normal-equations matrix is rank-deficient)', () => {
    expect(() => bestFit([{ x: 0, y: 0 }])).toThrow('matrix is singular');
    expect(() => bestFit([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow('matrix is singular');
    expect(() => bestFit([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toThrow('matrix is singular');
  });

  it('throws for all-coincident points instead of silently returning NaN control points', () => {
    const points: Point2D[] = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(() => bestFit(points)).toThrow('matrix is singular');
  });

  it('throws (a lower-level TypeError, not "matrix is singular") for zero points', () => {
    // Documented as a distinct, less-clear failure mode in bestFit's doc comment — this
    // test just locks in that it still throws rather than silently misbehaving, since
    // callers are expected to filter empty guide-point lists before calling bestFit.
    expect(() => bestFit([])).toThrow();
  });
});
```

- [ ] **Step 6: Run test, verify fails**

- [ ] **Step 7: Implement bezierFit.ts**

Create `webapp/src/core/bezier/bezierFit.ts` (port of `BezierFit.java`'s `bestFit`; the `M` matrix is the fixed cubic-Bezier-to-power-basis conversion matrix):

```typescript
import type { Point2D } from './point';
import { multiply, transpose, invert, type Matrix } from './matrix';

const M: Matrix = [
  [-1, 3, -3, 1],
  [3, -6, 3, 0],
  [-3, 3, 0, 0],
  [1, 0, 0, 0],
];

function normalizedPathLengths(points: Point2D[]): number[] {
  const pathLength = new Array(points.length).fill(0);
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    pathLength[i] = pathLength[i - 1] + Math.sqrt(dx * dx + dy * dy);
  }
  const total = pathLength[pathLength.length - 1];
  return pathLength.map((l) => l / total);
}

function columnVector(values: number[]): Matrix {
  return values.map((v) => [v]);
}

/**
 * Port of BezierFit.bestFit: least-squares fit of a single cubic Bezier through `points`.
 * Returns [P0, P1(tangent-to-next), P2(tangent-to-prev), P3].
 *
 * Uses chord-length parametrization (cumulative distance between consecutive points,
 * normalized to [0,1]) as a stand-in for the curve's true parameter, since real guide
 * points (e.g. mouse clicks) have no known parameter value. This is an approximation:
 * for points whose true parametrization is far from evenly-spaced-by-arc-length (e.g.
 * very unequal tangent-handle lengths), the fit can deviate from the "true" underlying
 * curve by a non-trivial amount even though the least-squares solve itself is exact —
 * see bezierFit.test.ts's tolerance comment for a worked example and independent proof
 * this is inherent to the method, not a solver bug.
 *
 * Requires at least 4 points, not all coincident, for the normal-equations matrix
 * `A = UT * U` to be non-singular:
 * - `points.length === 0`: throws a TypeError from `transpose()`'s internal `a[0].length`
 *   access (an empty `U` has no rows) — a different, less clear error than the ones below,
 *   since this case is never expected to reach `bestFit` in practice (callers filter empty
 *   guide-point lists before calling this).
 * - `points.length` 1-3: `invert()` throws `'matrix is singular'` (U doesn't have full
 *   column rank).
 * - All points coincident (any count): `normalizedPathLengths` divides by a total path
 *   length of 0, producing NaN t-values that poison `A`; `invert()` throws `'matrix is
 *   singular'` (its pivot guard explicitly checks for non-finite values, not just small
 *   magnitude — see the comment in matrix.ts — specifically so this case throws instead
 *   of silently returning NaN control points).
 * Callers should guard against `points.length < 4` before calling `bestFit`; the
 * all-coincident case is handled by the throw above rather than needing a caller-side guard.
 */
export function bestFit(points: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
  const npls = normalizedPathLengths(points);
  const U: Matrix = npls.map((u) => [u ** 3, u ** 2, u, 1]);
  const X = columnVector(points.map((p) => p.x));
  const Y = columnVector(points.map((p) => p.y));

  const Minv = invert(M);
  const UT = transpose(U);
  const A = multiply(UT, U);
  const B = invert(A);
  const C = multiply(Minv, B);
  const D = multiply(C, UT);
  const E = multiply(D, X);
  const F = multiply(D, Y);

  const result: Point2D[] = [];
  for (let i = 0; i < 4; i++) {
    result.push({ x: E[i][0], y: F[i][0] });
  }
  return result as [Point2D, Point2D, Point2D, Point2D];
}
```

- [ ] **Step 8: Run test, verify passes**

- [ ] **Step 9: Commit**

```bash
git add webapp/src/core/bezier/matrix.ts webapp/src/core/bezier/matrix.test.ts webapp/src/core/bezier/bezierFit.ts webapp/src/core/bezier/bezierFit.test.ts
git commit -m "Port BezierFit (least-squares curve fitting) to core/bezier"
```

---

## Task 6: core/board — Board model and basic accessors

**Goal:** Port the shaping-relevant subset of `board.BezierBoard`: the data model (outline/deck/bottom splines, cross-sections, metadata) and basic derived accessors (length, width-at, rocker-at, deck-at, thickness-at, max width/thickness). CAM/machine fields and mass/volume calculations are dropped per the "Deliberate simplifications" section.

**A note on the nose/tail boundary cross-sections:** in the Java model, `mCrossSections[0]` and `mCrossSections[last]` are always present boundary cross-sections at the tail (`x=0`) and nose (`x=length`) — every loop that iterates "real", user-editable cross-sections runs `1..size-2`, and `BezierBoard.scale()` explicitly keeps the last cross-section pinned to the new length. This plan preserves that convention: `newBoard()` creates a board with exactly these two boundary cross-sections already present, and every board always has at least 2 (never fewer) — "add cross-section" / "remove cross-section" (Task 10) only ever operate on the cross-sections strictly between them.

**Files:**
- Create: `webapp/src/core/board/types.ts`
- Create: `webapp/src/core/board/board.ts`
- Create: `webapp/src/core/board/board.test.ts`

**Acceptance Criteria:**
- [ ] `newBoard()` returns a board with a straight-ish default outline, flat deck/bottom, and the two boundary cross-sections
- [ ] `getLength(board)` returns the outline's max x
- [ ] `getWidthAtPos`/`getRockerAtPos`/`getDeckAtPos`/`getThicknessAtPos` match the Java formulas (`outline.getValueAt(x)*2`, `bottom.getValueAt(x)`, `deck.getValueAt(x)`, `deck-bottom`)
- [ ] `getMaxWidth`/`getMaxThickness` are computed from the splines, not stored
- [ ] `cloneBoard` re-runs `setLocks` on the clone so `slave` links point at the *new* deck/bottom knots, not the pre-clone ones (`BezierKnot.clone()` copies `slave` by reference — see the comment on `cloneBoard`) — verify with a test that clones a board, moves the cloned deck's tail knot via `setControlPointLocation`, and confirms the cloned bottom's tail knot moved too (not the original board's)

**Verify:** `cd webapp && npx vitest run src/core/board/board.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write tests**

Create `webapp/src/core/board/board.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { newBoard, cloneBoard, getLength, getWidthAtPos, getRockerAtPos, getDeckAtPos, getThicknessAtPos, getMaxWidth } from './board';

describe('board basic accessors', () => {
  it('newBoard has two boundary cross-sections and a positive length', () => {
    const b = newBoard();
    expect(b.crossSections.length).toBeGreaterThanOrEqual(2);
    expect(getLength(b)).toBeGreaterThan(0);
  });

  it('getWidthAtPos returns twice the outline value at that x', () => {
    const b = newBoard();
    const half = b.outline.getValueAt(getLength(b) / 2);
    expect(getWidthAtPos(b, getLength(b) / 2)).toBeCloseTo(half * 2, 6);
  });

  it('getThicknessAtPos equals deck minus bottom at that x', () => {
    const b = newBoard();
    const x = getLength(b) / 2;
    expect(getThicknessAtPos(b, x)).toBeCloseTo(getDeckAtPos(b, x) - getRockerAtPos(b, x), 6);
  });

  it('getMaxWidth is derived from the outline spline, not stored', () => {
    const b = newBoard();
    expect(getMaxWidth(b)).toBeCloseTo(b.outline.getMaxY() * 2, 6);
  });

  it('cloneBoard rebinds slave links so editing the clone does not affect the original', () => {
    const b = newBoard();
    const clone = cloneBoard(b);
    const deckTailIndex = clone.deck.getNrOfControlPoints() - 1;
    const bottomTailIndex = clone.bottom.getNrOfControlPoints() - 1;
    const originalBottomTailY = b.bottom.getControlPoint(bottomTailIndex).points[0].y;

    // setLocks() gives deck/bottom nose/tail endpoints xMask=0 (position along the
    // board's length is locked; only thickness/y is user-editable) — so this must move
    // y, not x, to actually exercise the slave link.
    const deckTailKnot = clone.deck.getControlPoint(deckTailIndex);
    deckTailKnot.setControlPointLocation(deckTailKnot.points[0].x, 999);

    // The clone's bottom tail should have followed (slave rebound to the clone's own
    // bottom knot, not the pre-clone one)...
    expect(clone.bottom.getControlPoint(bottomTailIndex).points[0].y).toBeCloseTo(999, 3);
    // ...but the ORIGINAL board's bottom tail must be untouched.
    expect(b.bottom.getControlPoint(bottomTailIndex).points[0].y).toBeCloseTo(originalBottomTailY, 6);
  });
});
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement types.ts**

Create `webapp/src/core/board/types.ts`:

```typescript
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
```

- [ ] **Step 4: Implement board.ts**

Create `webapp/src/core/board/board.ts` (port of the in-scope subset of `BezierBoard.java`):

```typescript
import { BezierSpline } from '../bezier/bezierSpline';
import { BezierKnot, LOCK_X_LESS, LOCK_X_MORE, LOCK_Y_MORE } from '../bezier/bezierKnot';
import type { Board, CrossSection } from './types';

const DEFAULT_LENGTH = 180; // cm, roughly a shortboard
const DEFAULT_HALF_WIDTH = 25;
const DEFAULT_THICKNESS = 6;

function straightOutline(): BezierSpline {
  const s = new BezierSpline();
  s.append(new BezierKnot(0, 2, 0, 2, DEFAULT_LENGTH * 0.2, 2));
  s.append(new BezierKnot(DEFAULT_LENGTH / 2, DEFAULT_HALF_WIDTH, DEFAULT_LENGTH * 0.3, DEFAULT_HALF_WIDTH, DEFAULT_LENGTH * 0.7, DEFAULT_HALF_WIDTH));
  s.append(new BezierKnot(DEFAULT_LENGTH, 2, DEFAULT_LENGTH * 0.8, 2, DEFAULT_LENGTH, 2));
  return s;
}

function flatSpline(y: number): BezierSpline {
  const s = new BezierSpline();
  s.append(new BezierKnot(0, y, 0, y, DEFAULT_LENGTH * 0.3, y));
  s.append(new BezierKnot(DEFAULT_LENGTH, y, DEFAULT_LENGTH * 0.7, y, DEFAULT_LENGTH, y));
  return s;
}

function boundaryCrossSection(position: number): CrossSection {
  // A minimal capsule-shaped half-outline from bottom-center (0,0) around to deck-center (0, thickness).
  const spline = new BezierSpline();
  spline.append(new BezierKnot(0, 0, 0, 0, DEFAULT_HALF_WIDTH * 0.5, 0));
  spline.append(new BezierKnot(DEFAULT_HALF_WIDTH, DEFAULT_THICKNESS / 2, DEFAULT_HALF_WIDTH, DEFAULT_THICKNESS * 0.2, DEFAULT_HALF_WIDTH, DEFAULT_THICKNESS * 0.8));
  spline.append(new BezierKnot(0, DEFAULT_THICKNESS, DEFAULT_HALF_WIDTH * 0.5, DEFAULT_THICKNESS, 0, DEFAULT_THICKNESS));
  return { position, spline };
}

export function newBoard(): Board {
  const board: Board = {
    name: 'New Board',
    designer: '',
    surfer: '',
    model: '',
    description: '',
    comments: '',
    outline: straightOutline(),
    deck: flatSpline(DEFAULT_THICKNESS),
    bottom: flatSpline(0),
    crossSections: [boundaryCrossSection(0), boundaryCrossSection(DEFAULT_LENGTH)],
  };
  setLocks(board);
  return board;
}

export function getLength(board: Board): number {
  let length = 0;
  for (let i = 0; i < board.outline.getNrOfControlPoints(); i++) {
    const x = board.outline.getControlPoint(i).endPoint.x;
    if (x > length) length = x;
  }
  return length;
}

export function getWidthAtPos(board: Board, pos: number): number {
  return board.outline.getValueAt(pos) * 2;
}

export function getRockerAtPos(board: Board, pos: number): number {
  return board.bottom.getValueAt(pos);
}

export function getDeckAtPos(board: Board, pos: number): number {
  return board.deck.getValueAt(pos);
}

export function getThicknessAtPos(board: Board, pos: number): number {
  return getDeckAtPos(board, pos) - getRockerAtPos(board, pos);
}

export function getCenterWidth(board: Board): number {
  return getWidthAtPos(board, getLength(board) / 2);
}

export function getMaxWidth(board: Board): number {
  return board.outline.getMaxY() * 2;
}

export function getThickness(board: Board): number {
  return getThicknessAtPos(board, getLength(board) / 2);
}

export function getMaxThickness(board: Board): number {
  let max = -100000;
  const length = getLength(board);
  for (let i = 0; i < Math.floor(length * 10); i++) {
    const pos = i / 10;
    max = Math.max(max, getThicknessAtPos(board, pos));
  }
  return max;
}

export function getMaxRocker(board: Board): number {
  return board.bottom.getMaxY();
}

export function sortCrossSections(board: Board): void {
  board.crossSections.sort((a, b) => a.position - b.position);
}

/** Port of BezierBoard.setLocks: axis masks on the endpoints, and a slave link between deck/bottom's nose and tail endpoints so they move together. */
export function setLocks(board: Board): void {
  if (board.outline.getNrOfControlPoints() < 2) return;

  const outlineLast = board.outline.getNrOfControlPoints() - 1;
  board.outline.getControlPoint(0).setMask(0, 0);
  board.outline.getControlPoint(outlineLast).setMask(0, 0);

  const deckLast = board.deck.getNrOfControlPoints() - 1;
  board.deck.getControlPoint(0).setMask(0, 1.0);
  board.deck.getControlPoint(deckLast).setMask(0, 1.0);

  const bottomLast = board.bottom.getNrOfControlPoints() - 1;
  board.bottom.getControlPoint(0).setMask(0, 1.0);
  board.bottom.getControlPoint(bottomLast).setMask(0, 1.0);

  for (const cs of board.crossSections) {
    const last = cs.spline.getNrOfControlPoints() - 1;
    cs.spline.getControlPoint(0).setMask(0, 1);
    cs.spline.getControlPoint(last).setMask(0, 1);
  }

  board.deck.getControlPoint(0).setSlave(board.bottom.getControlPoint(0));
  board.deck.getControlPoint(deckLast).setSlave(board.bottom.getControlPoint(bottomLast));
  board.bottom.getControlPoint(0).setSlave(board.deck.getControlPoint(0));
  board.bottom.getControlPoint(bottomLast).setSlave(board.deck.getControlPoint(deckLast));

  for (let i = 0; i < board.outline.getNrOfControlPoints(); i++) {
    board.outline.getControlPoint(i).setTangentToPrevLocks(LOCK_X_LESS);
    board.outline.getControlPoint(i).setTangentToNextLocks(LOCK_X_MORE);
  }
  board.outline.getControlPoint(0).addTangentToNextLocks(LOCK_Y_MORE);
  board.outline.getControlPoint(outlineLast).addTangentToPrevLocks(LOCK_Y_MORE);

  for (let i = 0; i < board.deck.getNrOfControlPoints(); i++) {
    board.deck.getControlPoint(i).setTangentToPrevLocks(LOCK_X_LESS);
    board.deck.getControlPoint(i).setTangentToNextLocks(LOCK_X_MORE);
  }
  for (let i = 0; i < board.bottom.getNrOfControlPoints(); i++) {
    board.bottom.getControlPoint(i).setTangentToPrevLocks(LOCK_X_LESS);
    board.bottom.getControlPoint(i).setTangentToNextLocks(LOCK_X_MORE);
  }
  for (const cs of board.crossSections) {
    const last = cs.spline.getNrOfControlPoints() - 1;
    cs.spline.getControlPoint(0).setTangentToNextLocks(LOCK_X_MORE);
    cs.spline.getControlPoint(last).setTangentToPrevLocks(LOCK_X_MORE);
  }
}

/**
 * IMPORTANT: BezierKnot.clone()/set() copy the `slave` field by reference (matching
 * Java's shallow-clone contract — see core/bezier's BezierKnot). That means a cloned
 * deck knot's `.slave` still points at the *pre-clone* bottom knot, not the fresh one
 * in this same new Board. Every edit command clones the whole board, so without
 * re-running setLocks() here, the deck/bottom nose-tail sync would silently break
 * after the very first edit. setLocks() is idempotent (safe to call on every clone):
 * it deterministically re-derives masks/locks/slave links from the current knots,
 * and since deck/bottom tail endpoints are always coincident when sync is working,
 * re-snapping them is a no-op in practice.
 */
export function cloneBoard(board: Board): Board {
  const next: Board = {
    ...board,
    outline: board.outline.clone(),
    deck: board.deck.clone(),
    bottom: board.bottom.clone(),
    crossSections: board.crossSections.map((cs) => ({ position: cs.position, spline: cs.spline.clone() })),
  };
  setLocks(next);
  return next;
}
```

- [ ] **Step 5: Run test, verify passes**

- [ ] **Step 6: Commit**

```bash
git add webapp/src/core/board/types.ts webapp/src/core/board/board.ts webapp/src/core/board/board.test.ts
git commit -m "Port Board model and basic accessors to core/board"
```

---

## Task 7: core/board — cross-section interpolation and adjust helpers

**Goal:** Port `cadcore.BezierBoardCrossSection` (scale, interpolate) and the `BezierBoard` methods that keep the model consistent after an edit: `getInterpolatedCrossSection`, `adjustCrosssectionsToThicknessAndWidth`, `adjustRockerToZero`, `onOutlineChanged`/`onRockerChanged`/`onCrossSectionChanged`, and `scale`. This is what `core/surface` (Task 8) and the command layer (Task 10) call after every edit.

**Scope cut:** `adjustRockerToCenterTangent` (gated by a `BoardCADSettings` toggle in the original) is not ported — see "Deliberate simplifications" at the top of this plan.

**Files:**
- Create: `webapp/src/core/board/crossSection.ts`
- Create: `webapp/src/core/board/crossSection.test.ts`
- Modify: `webapp/src/core/board/board.ts`
- Create: `webapp/src/core/board/boardAdjust.test.ts`

**Acceptance Criteria:**
- [ ] `getWidth`/`getCenterThickness` match the Java formulas
- [ ] `scale` no-ops (rather than dividing by zero) when the current width/thickness is below `0.1`, matching the Java guard
- [ ] `interpolate(a, b, 0)` returns a cross-section equal to `a` (scaled to match), `interpolate(a, b, 1)` returns one equal to `b`
- [ ] `getInterpolatedCrossSection` returns `null` outside `[0, length]` and interpolates correctly between two boundary/real cross-sections otherwise
- [ ] `adjustRockerToZero` shifts the bottom (and correspondingly the deck) so the bottom's minimum y is exactly 0
- [ ] `scale(board, ...)` updates outline/deck/bottom and re-positions all cross-sections proportionally, pinning the last cross-section to the new length (matches `BezierBoard.scale`)

**Verify:** `cd webapp && npx vitest run src/core/board/crossSection.test.ts src/core/board/boardAdjust.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write CrossSection tests**

Create `webapp/src/core/board/crossSection.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement crossSection.ts**

Create `webapp/src/core/board/crossSection.ts` (port of the in-scope subset of `BezierBoardCrossSection.java`):

```typescript
import { BezierKnot } from '../bezier/bezierKnot';
import { BezierCurve } from '../bezier/bezierCurve';
import * as vec from '../bezier/vecMath';
import type { CrossSection } from './types';

export function getWidth(cs: CrossSection): number {
  return cs.spline.getMaxX() * 2;
}

export function getCenterThickness(cs: CrossSection): number {
  const last = cs.spline.getNrOfControlPoints() - 1;
  return cs.spline.getControlPoint(last).points[0].y - cs.spline.getControlPoint(0).points[0].y;
}

export function scaleCrossSection(cs: CrossSection, newThickness: number, newWidth: number): void {
  const oldWidth = Math.max(getWidth(cs), 0.1);
  const oldThickness = Math.max(getCenterThickness(cs), 0.1);

  const thicknessScale = Math.abs(newThickness / oldThickness);
  const widthScale = Math.abs(newWidth / oldWidth);

  if (oldThickness * thicknessScale <= 0.1) return;
  if (oldWidth * widthScale <= 0.1) return;

  // NOTE: argument order is (widthScale, thicknessScale), NOT (thicknessScale, widthScale)
  // like the Java call site (BezierBoardCrossSection.java:145, mCrossSectionSpline.scale
  // (newThicknessScale, newWidtScale)) reads at a glance. Java's BezierSpline.scale
  // (verticalScale, horizontalScale) secretly swaps arguments before applying them to each
  // knot's scale(scaleX, scaleY); this port's BezierSpline.scale(scaleX, scaleY) (Task 4)
  // deliberately does NOT swap, for a clearer, non-confusing API. Cross-section splines
  // have local x=half-width, local y=height/thickness (see core/surface's mesh builder),
  // so the correct call here is scale(widthScale, thicknessScale) — copying Java's literal
  // argument order would silently swap width and thickness scaling. Caught during Task 4's
  // review before this function was ever implemented.
  cs.spline.scale(widthScale, thicknessScale);
}

function cloneCrossSection(cs: CrossSection): CrossSection {
  return { position: cs.position, spline: cs.spline.clone() };
}

/** Port of BezierBoardCrossSection.interpolate: rescales `target` to `source`'s size, matches control point counts by inserting split points into whichever has fewer, then linearly interpolates knot-by-knot. */
export function interpolateCrossSection(source: CrossSection, target: CrossSection, t: number): CrossSection | null {
  try {
    const sourceCopy = cloneCrossSection(source);
    const targetCopy = cloneCrossSection(target);

    scaleCrossSection(targetCopy, getCenterThickness(source), getWidth(source));

    if (sourceCopy.spline.getNrOfControlPoints() !== targetCopy.spline.getNrOfControlPoints()) {
      let most = sourceCopy.spline.getNrOfControlPoints() >= targetCopy.spline.getNrOfControlPoints() ? sourceCopy.spline : targetCopy.spline;
      let other = most === sourceCopy.spline ? targetCopy.spline : sourceCopy.spline;

      const scaleX = other.getMaxX() / most.getMaxX();
      const scaleY = other.getMaxY() / most.getMaxY();

      while (most.getNrOfControlPoints() > other.getNrOfControlPoints()) {
        let worstMatchPoint: BezierKnot | null = null;
        let worstMatch = 0;

        for (let i = 1; i < most.getNrOfControlPoints() - 1; i++) {
          const current = most.getControlPoint(i);
          let bestMatch = 1e7;
          for (let j = 1; j < other.getNrOfControlPoints() - 1; j++) {
            const otherPoint = other.getControlPoint(j).clone();
            otherPoint.setControlPointLocation(otherPoint.endPoint.x * scaleX, otherPoint.endPoint.y * scaleY);
            const dist = vec.length(current.endPoint, otherPoint.endPoint);
            if (dist < bestMatch) bestMatch = dist;
          }
          if (bestMatch > worstMatch) {
            worstMatch = bestMatch;
            worstMatchPoint = current;
          }
        }

        const newControlPoint = new BezierKnot();
        const index = other.getSplitControlPoint(worstMatchPoint!.endPoint, newControlPoint);
        if (index <= 0) return sourceCopy as unknown as CrossSection;

        other.insert(index, newControlPoint);

        const prev = other.getControlPoint(index - 1);
        const next = other.getControlPoint(index + 1);
        const tmpCurve = new BezierCurve(prev, next);
        const ct = tmpCurve.getClosestT(worstMatchPoint!.endPoint);

        const tmp1 = vec.scale(vec.sub(prev.points[0], prev.points[2]), ct);
        prev.points[2] = vec.add(prev.points[0], tmp1);

        const tmp2 = vec.scale(vec.sub(next.points[1], next.points[0]), ct - 1);
        next.points[1] = vec.add(next.points[0], tmp2);
      }
    }

    const interpolated = cloneCrossSection(targetCopy);
    for (let i = 0; i < targetCopy.spline.getNrOfControlPoints(); i++) {
      const a = sourceCopy.spline.getControlPoint(i);
      const b = targetCopy.spline.getControlPoint(i);
      const v = interpolated.spline.getControlPoint(i);
      for (let j = 0; j < 3; j++) {
        const diff = vec.sub(a.points[j], b.points[j]);
        const scaled = vec.scale(diff, t);
        v.points[j] = vec.add(a.points[j], scaled);
      }
    }
    return interpolated;
  } catch (e) {
    console.error('Error in interpolateCrossSection()', e);
    return null;
  }
}
```

- [ ] **Step 4: Run test, verify passes**

- [ ] **Step 5: Write board-adjust tests**

Create `webapp/src/core/board/boardAdjust.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { newBoard, getLength, getMaxWidth, getMaxThickness } from './board';
import { getInterpolatedCrossSection, adjustRockerToZero, scaleBoard } from './board';

describe('board adjust helpers', () => {
  it('getInterpolatedCrossSection returns null outside [0, length]', () => {
    const b = newBoard();
    expect(getInterpolatedCrossSection(b, -1)).toBeNull();
    expect(getInterpolatedCrossSection(b, getLength(b) + 1)).toBeNull();
  });

  it('getInterpolatedCrossSection returns a cross-section scaled to the board width/thickness at that x', () => {
    const b = newBoard();
    const x = getLength(b) / 2;
    const cs = getInterpolatedCrossSection(b, x)!;
    expect(cs).not.toBeNull();
    expect(cs.position).toBeCloseTo(x, 6);
  });

  it('adjustRockerToZero makes the bottom spline minimum y exactly 0', () => {
    const b = newBoard();
    b.bottom.translate(0, 3); // push it out of alignment
    adjustRockerToZero(b);
    expect(b.bottom.getMinY()).toBeCloseTo(0, 6);
  });

  it('scaleBoard updates length/width/thickness and keeps the last cross-section pinned to the new length', () => {
    const b = newBoard();
    const newLength = getLength(b) * 2;
    scaleBoard(b, newLength, getMaxWidth(b) * 1.5, getMaxThickness(b) * 1.2);
    expect(getLength(b)).toBeCloseTo(newLength, 0);
    expect(b.crossSections[b.crossSections.length - 1].position).toBeCloseTo(newLength, 6);
  });
});
```

- [ ] **Step 6: Run test, verify fails**

- [ ] **Step 7: Add adjust helpers to board.ts**

Append to `webapp/src/core/board/board.ts`:

```typescript
import { getWidth, getCenterThickness, scaleCrossSection, interpolateCrossSection } from './crossSection';

function getNearestCrossSectionIndex(board: Board, pos: number): number {
  let nearest = -1;
  let nearestPos = -300000;
  for (let i = 1; i < board.crossSections.length - 1; i++) {
    const current = board.crossSections[i];
    if (nearest === -1 || Math.abs(nearestPos - pos) > Math.abs(current.position - pos)) {
      nearest = i;
      nearestPos = current.position;
    }
  }
  return nearest;
}

/**
 * Port of BezierBoard.getInterpolatedCrossSection: finds the two bounding cross-sections
 * around x, interpolates between them, then scales the result to the board's actual
 * width/thickness at x.
 *
 * Deviation from the literal Java algorithm: `getNearestCrossSectionIndex` only searches
 * "real" cross-sections (index 1..length-2), so it returns -1 when a board has none —
 * which is `newBoard()`'s default state (exactly 2 cross-sections, both boundary ones),
 * not a rare edge case. Java's literal follow-up (`getCrossSections().get(index)` with
 * index -1) throws `IndexOutOfBoundsException` in that state; the equivalent TS
 * (`board.crossSections[-1].position`) would throw a TypeError. This port instead falls
 * back to interpolating directly between the two boundary cross-sections (index 0 and the
 * last) when `nearest === -1`, which is well-defined and gives a sensible result rather
 * than crashing on a board state this port's own `newBoard()` produces by default.
 */
export function getInterpolatedCrossSection(board: Board, x: number): CrossSection | null {
  if (board.crossSections.length === 0) return null;
  if (x < 0) return null;
  if (x > getLength(board)) return null;

  const nearest = getNearestCrossSectionIndex(board, x);

  let index: number;
  let nextIndex: number;

  if (nearest === -1) {
    index = 0;
    nextIndex = board.crossSections.length - 1;
  } else {
    index = nearest;
    if (board.crossSections[index].position > x) index -= 1;
    nextIndex = index + 1;
  }

  const firstPos = board.crossSections[index].position;
  const secondPos = board.crossSections[nextIndex].position;
  let t = (x - firstPos) / (secondPos - firstPos);
  if (!Number.isFinite(t)) t = 0.0;

  if (nearest !== -1) {
    if (index < 1) index = 1;
    if (nextIndex > board.crossSections.length - 2) {
      index = board.crossSections.length - 2;
      nextIndex = index;
    }
  }

  const c1 = board.crossSections[index];
  const c2 = board.crossSections[nextIndex];
  const interpolated = interpolateCrossSection(c1, c2, t);
  if (interpolated == null) return null;

  const thickness = Math.max(getThicknessAtPos(board, x), 0.5);
  const width = Math.max(getWidthAtPos(board, x), 0.5);
  scaleCrossSection(interpolated, thickness, width);
  interpolated.position = x;

  return interpolated;
}

export function adjustCrosssectionsToThicknessAndWidth(board: Board): void {
  for (let i = 1; i < board.crossSections.length - 1; i++) {
    const current = board.crossSections[i];
    scaleCrossSection(current, getThicknessAtPos(board, current.position), getWidthAtPos(board, current.position));
  }
}

// Uses BezierSpline.translate() (which invalidates curve caches, see its comment) rather
// than a manual per-knot points-mutation loop — a manual loop here would reintroduce the
// exact same stale-cache bug that scale()/translate() themselves needed fixing for, since
// getMinY() (called first, below) forces evaluation before the knots get mutated.
export function adjustRockerToZero(board: Board): void {
  const min = board.bottom.getMinY();
  board.bottom.translate(0, -min);
  board.deck.translate(0, -min);
}

export function onRockerChanged(board: Board): void {
  adjustRockerToZero(board);
  adjustCrosssectionsToThicknessAndWidth(board);
}

export function onOutlineChanged(board: Board): void {
  adjustCrosssectionsToThicknessAndWidth(board);
}

export function onCrossSectionChanged(board: Board): void {
  adjustCrosssectionsToThicknessAndWidth(board);
}

/** Port of BezierBoard.scale: uniformly re-scales outline/deck/bottom and repositions cross-sections proportionally, pinning the last cross-section to the new length. */
export function scaleBoard(board: Board, newLength: number, newWidth: number, newThickness: number): void {
  const lengthScale = newLength / getLength(board);
  const widthScale = newWidth / getMaxWidth(board);
  const thicknessScale = newThickness / getMaxThickness(board);

  // NOTE: argument order here is (lengthScale, widthOrThicknessScale) — i.e. (x,y) order —
  // NOT the order Java's BezierBoard.scale() literally reads (mOutlineSpline.scale
  // (widthScale, lengthScale), etc.). Same reasoning as scaleCrossSection above: Java's
  // BezierSpline.scale(verticalScale, horizontalScale) secretly swaps args before applying
  // them; this port's BezierSpline.scale(scaleX, scaleY) doesn't swap. Outline/deck/bottom
  // splines all have local x=length position, local y=half-width or height, so copying
  // Java's literal argument order here would swap length scaling onto the width/thickness
  // axis and vice versa.
  board.outline.scale(lengthScale, widthScale);
  board.deck.scale(lengthScale, thicknessScale);
  board.bottom.scale(lengthScale, thicknessScale);

  for (let i = 1; i < board.crossSections.length - 1; i++) {
    const cs = board.crossSections[i];
    cs.position = cs.position * lengthScale;
  }
  board.crossSections[board.crossSections.length - 1].position = newLength;

  adjustCrosssectionsToThicknessAndWidth(board);
}
```

- [ ] **Step 8: Run test, verify passes**

- [ ] **Step 9: Commit**

```bash
git add webapp/src/core/board/crossSection.ts webapp/src/core/board/crossSection.test.ts webapp/src/core/board/board.ts webapp/src/core/board/boardAdjust.test.ts
git commit -m "Port cross-section interpolation and board adjust/scale helpers to core/board"
```

---

## Task 8: core/surface — mesh builder

**Goal:** Build a triangle mesh (vertex + index buffers) from a `Board` for `app/viewer3d` to render, using the simplified uniform arc-length sampling decided in "Deliberate simplifications" item 3 (instead of the Java model's angle-weighted `s` sampling).

**Axis convention** (matches `BezierBoardControlPointInterpolationSurfaceModel.getPointAt`'s `Point3d(x, point2D.x, point2D.y)`): mesh-space `x` = position along board length, `y` = half-width offset from centerline, `z` = height including rocker. `app/viewer3d` (Task 18) is responsible for remapping this to Three.js's Y-up convention — that is a rendering concern, not a core one.

**How a ring is built:** each cross-section spline is a single continuous half-outline from bottom-centerline (`local x≈0`) around the rail to deck-centerline (`local x≈0` again), parametrized by arc length `s∈[0,1]` (see `crossSection.ts`, Task 7). Sampling `crossSplits+1` points across `s∈[0,1]` gives one half of a cross-section ring; mirroring those points (negating the half-width) and appending them in reverse closes the ring into a full loop around the board's cross-section at that `x`.

**Files:**
- Create: `webapp/src/core/surface/surfaceMesh.ts`
- Create: `webapp/src/core/surface/surfaceMesh.test.ts`

**Acceptance Criteria:**
- [ ] `buildSurfaceMesh` produces `(lengthSplits + 1) * (2 * crossSplits + 1)` vertices and no `NaN`/`Infinity` values
- [ ] For a fixed length-position ring, the vertex at mirrored index `2*crossSplits - j` has `y ≈ -y` of the vertex at index `j` (mirror symmetry)
- [ ] `indices.length === lengthSplits * 2 * crossSplits * 6` (two triangles per quad)
- [ ] Every triangle index is within `[0, positions.length/3)`

**Verify:** `cd webapp && npx vitest run src/core/surface/surfaceMesh.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write tests**

Create `webapp/src/core/surface/surfaceMesh.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { newBoard } from '../board/board';
import { buildSurfaceMesh } from './surfaceMesh';

describe('buildSurfaceMesh', () => {
  it('produces the expected vertex and index counts', () => {
    const board = newBoard();
    const lengthSplits = 8;
    const crossSplits = 6;
    const mesh = buildSurfaceMesh(board, lengthSplits, crossSplits);

    const expectedVertexCount = (lengthSplits + 1) * (2 * crossSplits + 1);
    expect(mesh.positions.length).toBe(expectedVertexCount * 3);
    expect(mesh.indices.length).toBe(lengthSplits * 2 * crossSplits * 6);
  });

  it('contains no NaN or Infinity values', () => {
    const mesh = buildSurfaceMesh(newBoard(), 8, 6);
    for (const v of mesh.positions) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('mirrors the cross-section ring across the centerline', () => {
    const crossSplits = 6;
    const mesh = buildSurfaceMesh(newBoard(), 8, crossSplits);
    const ringStride = 2 * crossSplits + 1;
    // Second ring (i=1), point j=1 vs its mirror at 2*crossSplits-1.
    const ringBase = 1 * ringStride;
    const j = 1;
    const mirrorJ = 2 * crossSplits - j;
    const yAtJ = mesh.positions[(ringBase + j) * 3 + 1];
    const yAtMirror = mesh.positions[(ringBase + mirrorJ) * 3 + 1];
    expect(yAtMirror).toBeCloseTo(-yAtJ, 3);
  });

  it('every index references a valid vertex', () => {
    const mesh = buildSurfaceMesh(newBoard(), 8, 6);
    const vertexCount = mesh.positions.length / 3;
    for (const idx of mesh.indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(vertexCount);
    }
  });
});
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement surfaceMesh.ts**

Create `webapp/src/core/surface/surfaceMesh.ts`:

```typescript
import type { Board } from '../board/types';
import { getLength, getRockerAtPos, getInterpolatedCrossSection } from '../board/board';

export interface SurfaceMesh {
  /** Flat [x0,y0,z0, x1,y1,z1, ...] vertex positions. x=length pos, y=half-width offset, z=height incl. rocker. */
  positions: Float32Array;
  /** Flat triangle index list, 2 triangles per quad. */
  indices: Uint32Array;
  lengthSplits: number;
  crossSplits: number;
}

/** One closed ring of (2*crossSplits + 1) points around the board's cross-section at position x. */
function buildRing(board: Board, x: number, crossSplits: number): Array<{ y: number; z: number }> {
  const crossSection = getInterpolatedCrossSection(board, x);
  const rocker = getRockerAtPos(board, x);
  const ring: Array<{ y: number; z: number }> = [];

  if (crossSection == null) {
    // Degenerate: collapse to the centerline so the mesh stays well-formed.
    for (let j = 0; j <= 2 * crossSplits; j++) ring.push({ y: 0, z: rocker });
    return ring;
  }

  for (let j = 0; j <= crossSplits; j++) {
    const s = j / crossSplits;
    const p = crossSection.spline.getPointByS(s);
    ring.push({ y: p.x, z: p.y + rocker });
  }
  for (let j = crossSplits + 1; j <= 2 * crossSplits; j++) {
    const k = 2 * crossSplits - j;
    const s = k / crossSplits;
    const p = crossSection.spline.getPointByS(s);
    ring.push({ y: -p.x, z: p.y + rocker });
  }
  return ring;
}

export function buildSurfaceMesh(board: Board, lengthSplits = 40, crossSplits = 24): SurfaceMesh {
  const length = getLength(board);
  const ringStride = 2 * crossSplits + 1;
  const positions = new Float32Array((lengthSplits + 1) * ringStride * 3);

  for (let i = 0; i <= lengthSplits; i++) {
    let x = (i / lengthSplits) * length;
    x = Math.min(Math.max(x, 0.1), length - 0.1);

    const ring = buildRing(board, x, crossSplits);
    for (let j = 0; j < ring.length; j++) {
      const vertexIndex = i * ringStride + j;
      positions[vertexIndex * 3] = x;
      positions[vertexIndex * 3 + 1] = ring[j].y;
      positions[vertexIndex * 3 + 2] = ring[j].z;
    }
  }

  const indices = new Uint32Array(lengthSplits * 2 * crossSplits * 6);
  let idx = 0;
  for (let i = 0; i < lengthSplits; i++) {
    for (let j = 0; j < 2 * crossSplits; j++) {
      const a = i * ringStride + j;
      const b = i * ringStride + j + 1;
      const c = (i + 1) * ringStride + j;
      const d = (i + 1) * ringStride + j + 1;

      indices[idx++] = a;
      indices[idx++] = c;
      indices[idx++] = b;

      indices[idx++] = b;
      indices[idx++] = c;
      indices[idx++] = d;
    }
  }

  return { positions, indices, lengthSplits, crossSplits };
}
```

- [ ] **Step 4: Run test, verify passes**

- [ ] **Step 5: Commit**

```bash
git add webapp/src/core/surface/surfaceMesh.ts webapp/src/core/surface/surfaceMesh.test.ts
git commit -m "Add core/surface mesh builder (uniform arc-length cross-section sampling)"
```

---

## Task 9: core/commands — BoardCommandHistory

**Goal:** Port the linear undo/redo semantics of `BrdCommandHistory`, but storing whole-`Board` before/after snapshots per entry instead of Java's mutable command objects (see "Deliberate simplifications" item 1).

**Files:**
- Create: `webapp/src/core/commands/commandHistory.ts`
- Create: `webapp/src/core/commands/commandHistory.test.ts`

**Acceptance Criteria:**
- [ ] `execute` pushes a new entry and truncates any entries after the current index (matches `BrdCommandHistory.addCommand`'s "redo branch is discarded on new edit" behavior)
- [ ] `undo`/`redo` move the index and return the corresponding snapshot; calling `undo` past the start or `redo` past the end returns `null` and doesn't move the index further
- [ ] `canUndo`/`canRedo` reflect the current index correctly at every point in a execute→undo→redo→execute sequence

**Verify:** `cd webapp && npx vitest run src/core/commands/commandHistory.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write tests**

Create `webapp/src/core/commands/commandHistory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BoardCommandHistory } from './commandHistory';

describe('BoardCommandHistory', () => {
  it('execute records a before/after pair and reports canUndo', () => {
    const h = new BoardCommandHistory();
    expect(h.canUndo()).toBe(false);
    h.execute('move point', { v: 0 } as any, { v: 1 } as any);
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
  });

  it('undo returns the before-snapshot and enables redo', () => {
    const h = new BoardCommandHistory();
    h.execute('move point', { v: 0 } as any, { v: 1 } as any);
    const before = h.undo();
    expect(before).toEqual({ v: 0 });
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
  });

  it('redo returns the after-snapshot', () => {
    const h = new BoardCommandHistory();
    h.execute('move point', { v: 0 } as any, { v: 1 } as any);
    h.undo();
    const after = h.redo();
    expect(after).toEqual({ v: 1 });
  });

  it('undo past the start returns null and does not move further', () => {
    const h = new BoardCommandHistory();
    expect(h.undo()).toBeNull();
  });

  it('redo past the end returns null', () => {
    const h = new BoardCommandHistory();
    h.execute('a', { v: 0 } as any, { v: 1 } as any);
    expect(h.redo()).toBeNull();
  });

  it('a new execute after an undo discards the redo branch', () => {
    const h = new BoardCommandHistory();
    h.execute('a', { v: 0 } as any, { v: 1 } as any);
    h.execute('b', { v: 1 } as any, { v: 2 } as any);
    h.undo(); // back to v:1, "b" now redo-able
    h.execute('c', { v: 1 } as any, { v: 3 } as any); // discards "b"
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toEqual({ v: 1 });
    expect(h.undo()).toEqual({ v: 0 });
    expect(h.undo()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement commandHistory.ts**

Create `webapp/src/core/commands/commandHistory.ts` (port of `BrdCommandHistory.java`'s index/truncation semantics, adapted to whole-state snapshots):

```typescript
export interface HistoryEntry<TState> {
  description: string;
  before: TState;
  after: TState;
}

export class BoardCommandHistory<TState = unknown> {
  private entries: Array<HistoryEntry<TState>> = [];
  private currentIndex = -1;

  execute(description: string, before: TState, after: TState): TState {
    // No `currentIndex >= 0` guard: when undo has walked all the way back to -1,
    // `entries.length > 0` still correctly truncates to length 0 before the new
    // entry is pushed, discarding the whole stale forward branch. Guarding on
    // `currentIndex >= 0` here would skip truncation in exactly that case, leaking
    // the discarded branch's snapshots into later undo() calls.
    if (this.entries.length > this.currentIndex + 1) {
      this.entries.length = this.currentIndex + 1;
    }
    this.entries.push({ description, before, after });
    this.currentIndex = this.entries.length - 1;
    return after;
  }

  undo(): TState | null {
    if (this.currentIndex < 0) return null;
    const entry = this.entries[this.currentIndex];
    this.currentIndex--;
    return entry.before;
  }

  redo(): TState | null {
    if (this.currentIndex >= this.entries.length - 1) return null;
    this.currentIndex++;
    return this.entries[this.currentIndex].after;
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.entries.length - 1;
  }

  clear(): void {
    this.entries = [];
    this.currentIndex = -1;
  }
}
```

- [ ] **Step 4: Run test, verify passes**

- [ ] **Step 5: Commit**

```bash
git add webapp/src/core/commands/commandHistory.ts webapp/src/core/commands/commandHistory.test.ts
git commit -m "Port BrdCommandHistory linear undo/redo semantics to core/commands"
```

---

## Task 10: core/commands — command creators

**Goal:** Pure `(board, ...) => Board` functions the UI dispatches through `BoardCommandHistory`. Each clones the board, mutates the clone, calls the matching `on*Changed` hook (Task 7), and returns the clone. Ported from `BrdEditCommand`, `BrdAddControlPointCommand`, `BrdDeleteControlPointCommand`, `BrdFitCurveCommand`, `BrdAddCrossSectionCommand`, `BrdRemoveCrossSectionCommand`.

**The trickiest sign convention — verify before trusting the port:** Java's `getSelectedControlPointVector` computes `endpoint − tangent`, not `tangent − endpoint`. Concretely, for a continuous knot at `(0,0)` with `tangentToPrev=(-2,0)` and `tangentToNext=(3,0)`, dragging `tangentToNext` to `(0,5)` must move `tangentToPrev` to `≈(0,-2)` — same direction reversal, but **preserving `tangentToPrev`'s own original length (2), not scaling to match the dragged tangent's new length (5)**. The test in Step 1 locks this down exactly.

**Files:**
- Create: `webapp/src/core/commands/splineRef.ts`
- Create: `webapp/src/core/commands/editCommands.ts`
- Create: `webapp/src/core/commands/editCommands.test.ts`

**Acceptance Criteria:**
- [ ] Dragging one tangent of a continuous knot mirrors the other tangent's *direction* while preserving the other tangent's *own* length (see sign convention note above)
- [ ] Dragging a tangent of a non-continuous (`continuous=false`) knot does not move the other tangent at all
- [ ] `addControlPointCommand` inserts a knot at the correct index and the spline still evaluates continuously through it (no gap)
- [ ] `deleteControlPointCommand` refuses to delete a spline's first or last control point (endpoint guard) and converges the neighboring tangent lengths to preserve total curve length within `0.1`
- [ ] `fitCurveFromGuidePointsCommand` moves a curve's control points toward guide points that lie within its x-range, and leaves the curve alone (skips it) when no guide points fall in range
- [ ] `addCrossSectionCommand`/`removeCrossSectionCommand` never touch the boundary (first/last) cross-sections
- [ ] `scaleBoardCommand` produces a board where `getLength`/`getMaxWidth`/`getMaxThickness` match the requested values

**Verify:** `cd webapp && npx vitest run src/core/commands/editCommands.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write tests**

Create `webapp/src/core/commands/editCommands.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { newBoard, getLength, getMaxWidth, getMaxThickness } from '../board/board';
import { BezierKnot } from '../bezier/bezierKnot';
import { BezierSpline } from '../bezier/bezierSpline';
import type { Board } from '../board/types';
import {
  moveControlPointCommand,
  addControlPointCommand,
  deleteControlPointCommand,
  fitCurveFromGuidePointsCommand,
  addCrossSectionCommand,
  removeCrossSectionCommand,
  scaleBoardCommand,
} from './editCommands';

function boardWithSingleOutlineKnot(): Board {
  const b = newBoard();
  b.outline = new BezierSpline();
  b.outline.append(new BezierKnot(0, 0, -2, 0, 3, 0));
  b.outline.append(new BezierKnot(20, 0, 15, 0, 25, 0));
  return b;
}

describe('moveControlPointCommand', () => {
  it('mirrors the opposite tangent direction while preserving its own length (continuous knot)', () => {
    const board = boardWithSingleOutlineKnot();
    const result = moveControlPointCommand(board, 'outline', 0, 2, 0, 5);
    const knot = result.outline.getControlPoint(0);
    expect(knot.points[1].x).toBeCloseTo(0, 1);
    expect(knot.points[1].y).toBeCloseTo(-2, 1);
  });

  it('does not move the opposite tangent when the knot is not continuous', () => {
    const board = boardWithSingleOutlineKnot();
    board.outline.getControlPoint(0).continuous = false;
    const before = { ...board.outline.getControlPoint(0).points[1] };
    const result = moveControlPointCommand(board, 'outline', 0, 2, 0, 5);
    expect(result.outline.getControlPoint(0).points[1]).toEqual(before);
  });

  it('does not mutate the original board (immutability)', () => {
    const board = boardWithSingleOutlineKnot();
    const beforeX = board.outline.getControlPoint(0).points[2].x;
    moveControlPointCommand(board, 'outline', 0, 2, 0, 5);
    expect(board.outline.getControlPoint(0).points[2].x).toBe(beforeX);
  });
});

describe('addControlPointCommand', () => {
  it('inserts a knot and keeps the spline continuous through it', () => {
    const board = boardWithSingleOutlineKnot();
    const before = board.outline.getValueAt(10);
    const { board: result, knotIndex } = addControlPointCommand(board, 'outline', { x: 10, y: 0 });
    expect(knotIndex).toBe(1);
    expect(result.outline.getNrOfControlPoints()).toBe(3);
    expect(result.outline.getValueAt(10)).toBeCloseTo(before, 0);
  });
});

describe('deleteControlPointCommand', () => {
  it('refuses to delete the first or last control point', () => {
    const board = boardWithSingleOutlineKnot();
    expect(deleteControlPointCommand(board, 'outline', 0).outline.getNrOfControlPoints()).toBe(2);
    const lastIndex = board.outline.getNrOfControlPoints() - 1;
    expect(deleteControlPointCommand(board, 'outline', lastIndex).outline.getNrOfControlPoints()).toBe(2);
  });

  it('deletes a middle control point and preserves approximate curve length', () => {
    const board = boardWithSingleOutlineKnot();
    const { board: withMid } = addControlPointCommand(board, 'outline', { x: 10, y: 0 });
    const before = withMid.outline.getLength ? undefined : undefined; // no-op, length computed below
    const totalBefore = withMid.outline.getCurve(0).getLength() + withMid.outline.getCurve(1).getLength();
    const result = deleteControlPointCommand(withMid, 'outline', 1);
    expect(result.outline.getNrOfControlPoints()).toBe(2);
    expect(result.outline.getCurve(0).getLength()).toBeCloseTo(totalBefore, 0);
  });
});

describe('fitCurveFromGuidePointsCommand', () => {
  it('skips curves with no guide points in range', () => {
    const board = boardWithSingleOutlineKnot();
    const beforeP0 = { ...board.outline.getControlPoint(0).points[0] };
    const result = fitCurveFromGuidePointsCommand(board, 'outline', [{ x: 1000, y: 1000 }], false);
    expect(result.outline.getControlPoint(0).points[0]).toEqual(beforeP0);
  });

  it('pulls a curve toward guide points within its x-range', () => {
    const board = boardWithSingleOutlineKnot();
    const guidePoints = Array.from({ length: 10 }, (_, i) => ({ x: (i / 9) * 20, y: 5 }));
    const result = fitCurveFromGuidePointsCommand(board, 'outline', guidePoints, false);
    expect(result.outline.getValueAt(10)).toBeGreaterThan(2);
  });
});

describe('cross-section commands', () => {
  it('addCrossSectionCommand inserts a real (non-boundary) cross-section', () => {
    const board = newBoard();
    const before = board.crossSections.length;
    const result = addCrossSectionCommand(board, getLength(board) / 2);
    expect(result.crossSections.length).toBe(before + 1);
  });

  it('removeCrossSectionCommand refuses to remove boundary cross-sections', () => {
    const board = newBoard();
    const result = removeCrossSectionCommand(board, 0);
    expect(result.crossSections.length).toBe(board.crossSections.length);
  });
});

describe('scaleBoardCommand', () => {
  it('produces a board matching the requested length/width/thickness', () => {
    const board = newBoard();
    const result = scaleBoardCommand(board, 200, 50, 7);
    expect(getLength(result)).toBeCloseTo(200, 0);
    expect(getMaxWidth(result)).toBeCloseTo(50, 0);
    expect(getMaxThickness(result)).toBeCloseTo(7, 0);
  });
});
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement splineRef.ts**

Create `webapp/src/core/commands/splineRef.ts`:

```typescript
import type { Board } from '../board/types';
import { BezierSpline } from '../bezier/bezierSpline';
import { onOutlineChanged, onRockerChanged, onCrossSectionChanged } from '../board/board';

export type SplineRef = 'outline' | 'deck' | 'bottom' | { crossSection: number };

export function resolveSpline(board: Board, ref: SplineRef): BezierSpline {
  if (ref === 'outline') return board.outline;
  if (ref === 'deck') return board.deck;
  if (ref === 'bottom') return board.bottom;
  return board.crossSections[ref.crossSection].spline;
}

export function notifyChanged(board: Board, ref: SplineRef): void {
  if (ref === 'outline') onOutlineChanged(board);
  else if (ref === 'deck' || ref === 'bottom') onRockerChanged(board);
  else onCrossSectionChanged(board);
}
```

- [ ] **Step 4: Implement editCommands.ts**

Create `webapp/src/core/commands/editCommands.ts`:

```typescript
import type { Point2D } from '../bezier/point';
import { BezierKnot } from '../bezier/bezierKnot';
import { BezierCurve } from '../bezier/bezierCurve';
import * as vec from '../bezier/vecMath';
import { bestFit } from '../bezier/bezierFit';
import type { Board } from '../board/types';
import {
  cloneBoard,
  getLength,
  getInterpolatedCrossSection,
  sortCrossSections,
  scaleBoard,
} from '../board/board';
import { resolveSpline, notifyChanged, type SplineRef } from './splineRef';

/** Port of the continuity-mirror branch of BrdEditCommand.moveControlPoints: mutates `which`'s point to (x,y); if the knot is continuous, mirrors the *direction* of the opposite tangent while preserving its own length. */
function moveKnotTangent(knot: BezierKnot, which: 1 | 2, x: number, y: number): void {
  knot.setLocation(which, x, y);
  if (!knot.continuous) return;

  const other = which === 1 ? 2 : 1;
  const otherLength = vec.length(knot.points[other], knot.endPoint);
  const towardEndpoint = vec.sub(knot.points[which], knot.endPoint); // endpoint - tangent[which]
  const newOtherVec = vec.scale(vec.normalize(towardEndpoint), otherLength);
  const newOtherPoint = vec.add(newOtherVec, knot.endPoint);
  knot.setLocation(other, newOtherPoint.x, newOtherPoint.y);
}

/** which=0 moves the whole knot (endpoint + both tangents, rigid translate); which=1|2 moves a single tangent handle. */
export function moveControlPointCommand(board: Board, ref: SplineRef, knotIndex: number, which: 0 | 1 | 2, x: number, y: number): Board {
  const next = cloneBoard(board);
  const spline = resolveSpline(next, ref);
  const knot = spline.getControlPoint(knotIndex);

  if (which === 0) {
    knot.setControlPointLocation(x, y);
  } else {
    moveKnotTangent(knot, which, x, y);
  }

  notifyChanged(next, ref);
  return next;
}

export function setContinuousCommand(board: Board, ref: SplineRef, knotIndex: number, continuous: boolean): Board {
  const next = cloneBoard(board);
  resolveSpline(next, ref).getControlPoint(knotIndex).continuous = continuous;
  notifyChanged(next, ref);
  return next;
}

/** Port of BrdAddControlPointCommand.addControlPoint: splits the nearest curve segment at `pos`, inserts the new knot, and re-derives the adjacent tangent handles so the curve shape is preserved at the split point. */
export function addControlPointCommand(board: Board, ref: SplineRef, pos: Point2D): { board: Board; knotIndex: number } {
  const next = cloneBoard(board);
  const spline = resolveSpline(next, ref);
  if (spline.getNrOfCurves() === 0) return { board: next, knotIndex: -1 };

  const newKnot = new BezierKnot();
  const index = spline.getSplitControlPoint(pos, newKnot);
  spline.insert(index, newKnot);

  const prev = spline.getControlPoint(index - 1);
  const nextKnot = spline.getControlPoint(index + 1);
  const tmpCurve = new BezierCurve(prev, nextKnot);
  const t = tmpCurve.getClosestT(pos);

  prev.points[2] = vec.add(prev.points[0], vec.scale(vec.sub(prev.points[0], prev.points[2]), t));
  nextKnot.points[1] = vec.add(nextKnot.points[0], vec.scale(vec.sub(nextKnot.points[1], nextKnot.points[0]), t - 1));

  notifyChanged(next, ref);
  return { board: next, knotIndex: index };
}

/** Port of BrdDeleteControlPointCommand's simple-rescale branch (the BezierFit-on-delete branch is not ported, see plan header). Refuses to delete a spline's first/last control point. */
export function deleteControlPointCommand(board: Board, ref: SplineRef, knotIndex: number): Board {
  const next = cloneBoard(board);
  const spline = resolveSpline(next, ref);

  if (knotIndex <= 0 || knotIndex >= spline.getNrOfControlPoints() - 1) {
    return next;
  }

  const prevCurve = spline.getCurve(knotIndex - 1);
  const nextCurve = spline.getCurve(knotIndex);
  const prev = spline.getControlPoint(knotIndex - 1);
  const nextKnot = spline.getControlPoint(knotIndex + 1);
  const targetLength = prevCurve.getLength() + nextCurve.getLength();

  spline.remove(knotIndex);

  for (let i = 0; i < 1000; i++) {
    const newLength = prevCurve.getLength();
    if (Math.abs(newLength - targetLength) < 0.1) break;
    const factor = targetLength / newLength;
    prev.scaleTangentToNext(factor);
    nextKnot.scaleTangentToPrev(factor);
    // scaleTangentToNext/Prev mutate the knots directly; BezierCurve has no
    // change-notification wiring to its knots, so the next getLength() call
    // would otherwise return the stale pre-scale length forever, applying the
    // same factor every iteration and diverging instead of converging.
    prevCurve.setDirty();
  }

  notifyChanged(next, ref);
  return next;
}

/** Port of BrdFitCurveCommand.fitCurve for a single spline. `isCrossSection` selects the Java version's x/y-bounded range (cross-sections) vs. x-only range (outline/deck/bottom/rocker) for filtering guide points per curve segment. */
export function fitCurveFromGuidePointsCommand(board: Board, ref: SplineRef, guidePoints: Point2D[], isCrossSection: boolean): Board {
  const next = cloneBoard(board);
  const spline = resolveSpline(next, ref);

  for (let k = 0; k < spline.getNrOfCurves(); k++) {
    const curve = spline.getCurve(k);

    let xmin = 0;
    let xmax = 0;
    let ymin = -10000000;
    let ymax = 10000000;
    if (isCrossSection) {
      xmin = curve.getMinX();
      xmax = curve.getMaxX();
      ymin = curve.getMinY();
      ymax = curve.getMaxY();
    } else {
      xmin = curve.getStartKnot().endPoint.x;
      xmax = curve.getEndKnot().endPoint.x;
    }

    const inRange = guidePoints.filter((p) => p.x >= xmin && p.x <= xmax && p.y >= ymin && p.y <= ymax);
    if (inRange.length === 0) continue;

    const startPoint = curve.getStartKnot().endPoint;
    const endPoint = curve.getEndKnot().endPoint;
    const points = [...inRange, startPoint, startPoint, endPoint, endPoint].sort((a, b) => a.x - b.x);

    const [p0, p1, p2, p3] = bestFit(points);

    curve.getStartKnot().continuous = false;
    curve.getStartKnot().setControlPointLocation(p0.x, p0.y);
    curve.getStartKnot().setTangentToNext(p1.x, p1.y);
    curve.getEndKnot().continuous = false;
    curve.getEndKnot().setControlPointLocation(p3.x, p3.y);
    curve.getEndKnot().setTangentToPrev(p2.x, p2.y);
    // isCrossSection's getMinX/MaxX/MinY/MaxY calls above already forced this curve's
    // coefficient cache to compute (and freeze) against the PRE-fit knot positions;
    // without this, the curve would keep evaluating its old shape until some unrelated
    // later edit happened to call setDirty() on it (same bug class fixed for
    // deleteControlPointCommand's convergence loop above).
    curve.setDirty();
  }

  notifyChanged(next, ref);
  return next;
}

/**
 * Small enough to be invisible in normal use (cm), large enough to keep positions safely
 * distinguishable by both floating-point equality and interpolation math.
 */
export const CROSS_SECTION_MIN_SPACING = 0.1;

/**
 * Finds the position closest to `desiredPosition` that stays at least
 * `CROSS_SECTION_MIN_SPACING` away from EVERY other cross-section in `board.crossSections`
 * - boundaries included; `excludeIndex` is the only entry skipped (used when moving an
 * existing cross-section so it isn't compared against itself).
 *
 * Two cross-sections at (near-)identical positions are ill-defined for more than just the
 * app layer's position-based selection tracking (see app/editor2d/BoardEditorPanel): this
 * board's own `getInterpolatedCrossSection` divides by `secondPos - firstPos`, so a
 * near-zero gap between adjacent cross-sections blows up that division. This is a genuine
 * core-model invariant, not a UI-only concern - hence living here rather than in the app
 * layer, and applying to BOTH `addCrossSectionCommand` (which can otherwise duplicate the
 * position of an already-added cross-section, e.g. two consecutive "Add Cross-Section"
 * clicks at the board's midpoint) and `moveCrossSectionCommand` (which can otherwise move a
 * cross-section directly onto another's exact position, INCLUDING a boundary's - a naive
 * "always nudge forward, clamp at the end" version of this function is provably unsound
 * near the tail: nudging away from a near-tail collision walks position OUTSIDE
 * [0, getLength(board)], and clamping it back in afterward undoes the nudge, landing right
 * back in the collision it was trying to escape).
 *
 * Both boundary cross-sections (index 0 at position 0, and the last at position
 * `getLength(board)`) are ordinary entries in `board.crossSections`, so they take part in
 * this same "forbidden points" list rather than needing separate boundary-clamping logic -
 * this relies on the codebase-wide invariant that boundary positions are always exactly 0
 * and `getLength(board)` (enforced by `moveCrossSectionCommand`/`removeCrossSectionCommand`
 * both refusing to touch index 0 or the last index, and by `scaleBoard` explicitly
 * re-pinning the last boundary to the new length on every scale).
 *
 * Implementation: sorts the forbidden positions, walks every gap between consecutive ones
 * (there are no gaps to consider before the first or after the last, since those ARE the
 * board's own boundaries), and for each gap wide enough to hold a point at least
 * `CROSS_SECTION_MIN_SPACING` from both of its edges, computes the closest point within that
 * gap's safe sub-range to `desiredPosition`. Returns whichever candidate is closest to
 * `desiredPosition` overall. This is a single deterministic pass over a fixed-size list -
 * no iterative nudge-and-recheck loop - so termination is structural, not an empirically
 * observed bound on retry count.
 *
 * Degenerate case: if the board is packed so densely that NO gap anywhere has room for a
 * fully-spaced point (every gap narrower than `2 * CROSS_SECTION_MIN_SPACING`), there is no
 * position that can satisfy the invariant against every neighbor simultaneously - a genuine
 * "too dense to place" scenario a real product would need to refuse outright rather than
 * silently nudge through. Out of scope here; this falls back to clamping `desiredPosition`
 * into `[CROSS_SECTION_MIN_SPACING, length - CROSS_SECTION_MIN_SPACING]`, which keeps it
 * inside the board's own bounds even though it may still collide with some interior
 * cross-section in this pathological case.
 */
function resolveUniqueCrossSectionPosition(board: Board, desiredPosition: number, excludeIndex: number | null): number {
  const length = getLength(board);
  const forbidden = board.crossSections
    .filter((_, i) => i !== excludeIndex)
    .map((cs) => cs.position)
    .sort((a, b) => a - b);

  let best: number | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < forbidden.length - 1; i++) {
    const safeStart = forbidden[i] + CROSS_SECTION_MIN_SPACING;
    const safeEnd = forbidden[i + 1] - CROSS_SECTION_MIN_SPACING;
    if (safeStart > safeEnd) continue; // gap too narrow to hold a fully-spaced point

    const candidate = Math.min(Math.max(desiredPosition, safeStart), safeEnd);
    const dist = Math.abs(candidate - desiredPosition);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  if (best != null) return best;

  // Degenerate fallback - see doc comment above. Also covers forbidden.length < 2, which
  // shouldn't happen given the boundary invariant this function relies on, but a board with
  // fewer than 2 remaining reference points has no gaps to walk regardless of why.
  return Math.min(Math.max(desiredPosition, CROSS_SECTION_MIN_SPACING), length - CROSS_SECTION_MIN_SPACING);
}

/** Port of BrdAddCrossSectionCommand: interpolates a new cross-section at `pos` and inserts it among the real (non-boundary) cross-sections. */
export function addCrossSectionCommand(board: Board, pos: number): Board {
  const next = cloneBoard(board);
  // getInterpolatedCrossSection already sets `.position` and scales to the board's
  // thickness/width at `pos` (with a 0.5 floor) - redoing that here would call
  // scaleCrossSection with unclamped values, silently discarding that floor.
  const interpolated = getInterpolatedCrossSection(next, pos);
  if (interpolated == null) return next;

  // Nudge before pushing: resolveUniqueCrossSectionPosition compares against
  // next.crossSections as it currently stands (interpolated isn't in there yet), so no
  // excludeIndex is needed here.
  interpolated.position = resolveUniqueCrossSectionPosition(next, interpolated.position, null);
  next.crossSections.push(interpolated);
  sortCrossSections(next);
  return next;
}

/** Port of BrdRemoveCrossSectionCommand. Refuses to remove a boundary (first/last) cross-section. */
export function removeCrossSectionCommand(board: Board, index: number): Board {
  const next = cloneBoard(board);
  if (index <= 0 || index >= next.crossSections.length - 1) return next;
  next.crossSections.splice(index, 1);
  return next;
}

/**
 * Returns the actual resulting position alongside the board (not just the board) because
 * the caller can't reliably recover it afterward: `resolveUniqueCrossSectionPosition` may
 * have nudged `newPosition` away from a collision, and `sortCrossSections` may then have
 * moved the entry to a different array index - so `result.crossSections[index]` after the
 * fact is not guaranteed to still be the cross-section that was just moved. Returning the
 * exact value computed here (before any of that reshuffling) sidesteps needing to re-find
 * it by any kind of nearest-position search, which is the same fragile-by-construction
 * pattern this file's `resolveUniqueCrossSectionPosition` and the app layer's
 * `findActiveCrossSectionIndex` exist to work around, not to lean on further. Mirrors
 * `addControlPointCommand`'s existing `{ board, knotIndex }` shape for the same reason.
 */
export function moveCrossSectionCommand(board: Board, index: number, newPosition: number): { board: Board; position: number } {
  const next = cloneBoard(board);
  if (index <= 0 || index >= next.crossSections.length - 1) {
    return { board: next, position: next.crossSections[index]?.position ?? newPosition };
  }
  // resolveUniqueCrossSectionPosition handles both range-clamping and boundary/collision
  // avoidance as one coherent pass - see its doc comment for why doing the range clamp here
  // first (as an earlier version of this function did, with a plain [0.01, length-0.01]
  // range that didn't account for CROSS_SECTION_MIN_SPACING) was the proximate cause of a
  // near-boundary position getting nudged out of range and then clamped right back into a
  // boundary collision.
  const resolved = resolveUniqueCrossSectionPosition(next, newPosition, index);
  next.crossSections[index].position = resolved;
  sortCrossSections(next);
  return { board: next, position: resolved };
}

export function updateMetadataCommand(
  board: Board,
  patch: Partial<Pick<Board, 'name' | 'designer' | 'surfer' | 'model' | 'description' | 'comments'>>,
): Board {
  return { ...cloneBoard(board), ...patch };
}

/** Port of BezierBoard.scale via core/board's scaleBoard. */
export function scaleBoardCommand(board: Board, newLength: number, newWidth: number, newThickness: number): Board {
  const next = cloneBoard(board);
  scaleBoard(next, newLength, newWidth, newThickness);
  return next;
}
```

- [ ] **Step 5: Run test, verify passes**

- [ ] **Step 6: Commit**

```bash
git add webapp/src/core/commands/splineRef.ts webapp/src/core/commands/editCommands.ts webapp/src/core/commands/editCommands.test.ts
git commit -m "Port edit commands (move/add/delete control point, fit curve, cross-sections, scale) to core/commands"
```

---

## Task 11: core/persistence — JSON board format

**Goal:** A new JSON save format for `Board` (per the design doc — no `.brd` compatibility). Pure serialize/deserialize functions, no DOM/File APIs (those belong in `app/state`, Task 13, to keep `core` framework/DOM-free per the design doc).

**Files:**
- Create: `webapp/src/core/persistence/boardFile.ts`
- Create: `webapp/src/core/persistence/boardFile.test.ts`

**Acceptance Criteria:**
- [ ] `serializeBoard`/`deserializeBoard` round-trip: a board's spline values, cross-section count/positions, and metadata are unchanged after `deserializeBoard(serializeBoard(board))`
- [ ] `deserializeBoard` throws a `BoardFileError` (not a generic error) for malformed/non-matching-version JSON, so the app layer can catch it specifically
- [ ] Slave links (deck/bottom nose-tail sync) are not part of the JSON and are re-established by calling `setLocks` after deserializing — not manually re-wired field-by-field

**Verify:** `cd webapp && npx vitest run src/core/persistence/boardFile.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write tests**

Create `webapp/src/core/persistence/boardFile.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { newBoard, getLength, getWidthAtPos, getRockerAtPos } from '../board/board';
import { serializeBoard, deserializeBoard, BoardFileError } from './boardFile';

describe('board JSON persistence', () => {
  it('round-trips a fresh board: same length, width, rocker, and cross-section count', () => {
    const board = newBoard();
    const json = serializeBoard(board);
    const restored = deserializeBoard(json);

    const x = getLength(board) / 2;
    expect(getLength(restored)).toBeCloseTo(getLength(board), 6);
    expect(getWidthAtPos(restored, x)).toBeCloseTo(getWidthAtPos(board, x), 6);
    expect(getRockerAtPos(restored, x)).toBeCloseTo(getRockerAtPos(board, x), 6);
    expect(restored.crossSections.length).toBe(board.crossSections.length);
  });

  it('round-trips metadata fields', () => {
    const board = newBoard();
    board.name = 'Test Board';
    board.designer = 'Jane';
    const restored = deserializeBoard(serializeBoard(board));
    expect(restored.name).toBe('Test Board');
    expect(restored.designer).toBe('Jane');
  });

  it('round-trips knot continuity flags', () => {
    const board = newBoard();
    board.outline.getControlPoint(1).continuous = false;
    const restored = deserializeBoard(serializeBoard(board));
    expect(restored.outline.getControlPoint(1).continuous).toBe(false);
  });

  it('serializeBoard produces valid JSON text', () => {
    const board = newBoard();
    const text = serializeBoard(board);
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('deserializeBoard throws BoardFileError for garbage input', () => {
    expect(() => deserializeBoard('{"not":"a board"}')).toThrow(BoardFileError);
    expect(() => deserializeBoard('not even json')).toThrow(BoardFileError);
  });

  it('deserializeBoard throws BoardFileError for an unsupported formatVersion', () => {
    const board = newBoard();
    const parsed = JSON.parse(serializeBoard(board));
    parsed.formatVersion = 99;
    expect(() => deserializeBoard(JSON.stringify(parsed))).toThrow(BoardFileError);
  });
});
```

- [ ] **Step 2: Run test, verify fails**

- [ ] **Step 3: Implement boardFile.ts**

Create `webapp/src/core/persistence/boardFile.ts`:

```typescript
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
```

- [ ] **Step 4: Run test, verify passes**

- [ ] **Step 5: Commit**

```bash
git add webapp/src/core/persistence/boardFile.ts webapp/src/core/persistence/boardFile.test.ts
git commit -m "Add core/persistence JSON board file format"
```

---

## A note on testing for the remaining (`app/`) tasks

Per the design doc's Testing section, `app/` components are tested manually in the browser for v1 (single-user tool, no CI requirement) — `webapp/` has no React Testing Library / jsdom setup, and Task 0 deliberately didn't install one. From here on, each task's "Verify" step is a concrete manual scenario in the running dev server (`npm run dev`) plus `npm run build` as an objective type-check pass. This matches `core`'s approach (Vitest, TDD) being reserved for framework-free logic, and is a deliberate scope decision, not an oversight.

---

## Task 12: app/state — board context, reducer, and command dispatch

**Goal:** A React context that owns the current `Board`, wraps a `BoardCommandHistory<Board>`, and exposes `dispatch`, `undo`, `redo`, `canUndo`, `canRedo`, and `resetBoard` (for New/Open) to the rest of the app.

**Files:**
- Create: `webapp/src/app/state/BoardStateContext.tsx`
- Create: `webapp/src/app/state/useUndoRedoShortcuts.ts`
- Modify: `webapp/src/main.tsx`

**Acceptance Criteria:**
- [ ] `dispatch(description, commandFn)` computes `commandFn(board)`, pushes it to history, and re-renders consumers with the new board
- [ ] `undo`/`redo` move through history and update the visible board; `canUndo`/`canRedo` reflect whether they're currently possible
- [ ] `resetBoard(board)` (used by New/Open) replaces the board and clears history — undo after Open does nothing
- [ ] Cmd/Ctrl+Z triggers undo and Shift+Cmd/Ctrl+Z triggers redo, except while focus is inside an `<input>`, `<textarea>`, or `[contenteditable]`

**Verify:** `cd webapp && npm run build` (type-checks) — then `npm run dev`, open the app, open the browser console, and confirm no errors on load. (Full interactive verification happens once Task 20 wires this provider into a visible UI with buttons — this task alone has nothing to click yet.)

**Steps:**

- [ ] **Step 1: Implement BoardStateContext.tsx**

Create `webapp/src/app/state/BoardStateContext.tsx`:

```typescript
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { Board } from '../../core/board/types';
import { newBoard } from '../../core/board/board';
import { BoardCommandHistory } from '../../core/commands/commandHistory';

interface BoardStateValue {
  board: Board;
  dispatch: (description: string, commandFn: (board: Board) => Board) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetBoard: (board: Board) => void;
}

const BoardStateContext = createContext<BoardStateValue | null>(null);

export function BoardStateProvider({ children }: { children: ReactNode }) {
  const [board, setBoard] = useState<Board>(() => newBoard());
  // `boardRef` mirrors `board` so dispatch/undo/redo/resetBoard can read the current value
  // synchronously. This can't be a functional `setBoard` updater: React 18 StrictMode
  // double-invokes updater functions in dev, and this updater has a side effect
  // (historyRef.current.execute) that must run exactly once per action. The ref is also
  // written synchronously at each call site below (not just during render) because React 18
  // batches multiple setState calls within one synchronous handler without re-rendering in
  // between - relying on the render-body assignment alone would leave the ref stale for a
  // second call in the same batch (e.g. dispatch() called twice, or dispatch() then undo()).
  const boardRef = useRef(board);
  boardRef.current = board;
  const historyRef = useRef(new BoardCommandHistory<Board>());
  const [, forceRender] = useState(0);

  const dispatch = useCallback((description: string, commandFn: (board: Board) => Board) => {
    const current = boardRef.current;
    const after = commandFn(current);
    historyRef.current.execute(description, current, after);
    boardRef.current = after;
    setBoard(after);
  }, []);

  const undo = useCallback(() => {
    const previous = historyRef.current.undo();
    if (previous != null) {
      boardRef.current = previous;
      setBoard(previous);
    }
  }, []);

  const redo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next != null) {
      boardRef.current = next;
      setBoard(next);
    }
  }, []);

  const resetBoard = useCallback((newB: Board) => {
    historyRef.current.clear();
    boardRef.current = newB;
    setBoard(newB);
    forceRender((n) => n + 1);
  }, []);

  const value: BoardStateValue = {
    board,
    dispatch,
    undo,
    redo,
    canUndo: historyRef.current.canUndo(),
    canRedo: historyRef.current.canRedo(),
    resetBoard,
  };

  return <BoardStateContext.Provider value={value}>{children}</BoardStateContext.Provider>;
}

export function useBoardState(): BoardStateValue {
  const ctx = useContext(BoardStateContext);
  if (ctx == null) throw new Error('useBoardState must be used within a BoardStateProvider');
  return ctx;
}
```

- [ ] **Step 2: Implement useUndoRedoShortcuts.ts**

Create `webapp/src/app/state/useUndoRedoShortcuts.ts`:

```typescript
import { useEffect } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useUndoRedoShortcuts(undo: () => void, redo: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.key.toLowerCase() !== 'z') return;

      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);
}
```

- [ ] **Step 3: Wire the provider into main.tsx**

Modify `webapp/src/main.tsx` to wrap `<App />` in `<BoardStateProvider>`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BoardStateProvider } from './app/state/BoardStateContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BoardStateProvider>
      <App />
    </BoardStateProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: Verify** — `cd webapp && npm run build` → exits 0 with no type errors

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/state/BoardStateContext.tsx webapp/src/app/state/useUndoRedoShortcuts.ts webapp/src/main.tsx
git commit -m "Add app/state board context, command dispatch, and undo/redo keyboard shortcuts"
```

---

## Task 13: app/state — localStorage autosave and file save/open

**Goal:** Per the design doc's Persistence section: the current board is continuously autosaved to `localStorage` (survives a tab reload), and separately can be explicitly saved to / loaded from a downloaded `.json` file.

**Files:**
- Create: `webapp/src/app/state/autosave.ts`
- Create: `webapp/src/app/state/fileIO.ts`
- Modify: `webapp/src/app/state/BoardStateContext.tsx`

**Acceptance Criteria:**
- [ ] On provider mount, if a valid autosave exists in `localStorage`, it is loaded instead of a fresh `newBoard()`
- [ ] Every board change is autosaved to `localStorage` (debounced, so a drag doesn't write on every pointer-move)
- [ ] A corrupt/invalid autosave entry is ignored (falls back to `newBoard()`), matching the design doc's "invalid JSON → error, current state unchanged" error-handling rule
- [ ] `downloadBoardFile`/`readBoardFile` round-trip through the browser's file download/upload — verified manually in Step 4

**Verify:** manual — `cd webapp && npm run dev`, open the app, open DevTools → Application → Local Storage, confirm a `boardcad-web:autosave` key appears within ~1s and its JSON parses; reload the page and confirm the app looks the same (autosave survived reload)

**Steps:**

- [ ] **Step 1: Implement autosave.ts**

Create `webapp/src/app/state/autosave.ts`:

```typescript
import type { Board } from '../../core/board/types';
import { serializeBoard, deserializeBoard } from '../../core/persistence/boardFile';

const STORAGE_KEY = 'boardcad-web:autosave';

export function loadAutosavedBoard(): Board | null {
  const text = localStorage.getItem(STORAGE_KEY);
  if (text == null) return null;
  try {
    return deserializeBoard(text);
  } catch {
    return null;
  }
}

export function saveAutosavedBoard(board: Board): void {
  // localStorage.setItem can throw (quota exceeded, private-browsing restrictions in some
  // browsers). Swallow and warn rather than throw uncaught, especially since this also runs
  // synchronously from a `beforeunload` handler (see Step 3) where an uncaught throw would
  // be silently lost anyway.
  try {
    localStorage.setItem(STORAGE_KEY, serializeBoard(board));
  } catch (err) {
    console.warn('Failed to autosave board:', err);
  }
}
```

- [ ] **Step 2: Implement fileIO.ts**

Create `webapp/src/app/state/fileIO.ts`:

```typescript
import type { Board } from '../../core/board/types';
import { serializeBoard, deserializeBoard } from '../../core/persistence/boardFile';

export function downloadBoardFile(board: Board): void {
  const text = serializeBoard(board);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${board.name || 'board'}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

export async function readBoardFile(file: File): Promise<Board> {
  const text = await file.text();
  return deserializeBoard(text);
}
```

- [ ] **Step 3: Wire autosave into BoardStateContext.tsx**

In `webapp/src/app/state/BoardStateContext.tsx`, replace the `useState<Board>` initializer and add a debounced autosave effect:

```typescript
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Board } from '../../core/board/types';
import { newBoard } from '../../core/board/board';
import { BoardCommandHistory } from '../../core/commands/commandHistory';
import { loadAutosavedBoard, saveAutosavedBoard } from './autosave';

// ... inside BoardStateProvider, replace the existing useState line with:
const [board, setBoard] = useState<Board>(() => loadAutosavedBoard() ?? newBoard());

// ... add after the other hooks, before `const value = ...`:
useEffect(() => {
  const timeout = setTimeout(() => saveAutosavedBoard(board), 500);
  return () => clearTimeout(timeout);
}, [board]);

// The debounce above alone loses the last edit if the tab closes/reloads within the 500ms
// window (browsers don't run pending timers on unload). Flush synchronously on unload too:
useEffect(() => {
  function handleBeforeUnload() {
    saveAutosavedBoard(board);
  }
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [board]);
```

- [ ] **Step 4: Manual verification**

```bash
cd webapp && npm run dev
```

In the browser: open DevTools → Application → Local Storage → confirm `boardcad-web:autosave` appears within ~1s of load and contains valid JSON (paste it into `JSON.parse(...)` in the console — should not throw). Reload the page — the app should come back without error (nothing to visually compare yet since there's no editor UI until Task 14, but no console errors is the bar for this task).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/state/autosave.ts webapp/src/app/state/fileIO.ts webapp/src/app/state/BoardStateContext.tsx
git commit -m "Add localStorage autosave and file save/open to app/state"
```

---

## Task 14: app/editor2d — viewport transform and canvas rendering

**Goal:** A `Viewport` (board-units ↔ screen-pixels transform) and a `SplineCanvas` component that draws one `BezierSpline` (curve + control points + tangent handles) onto an HTML canvas. Pure rendering, no interaction yet (Task 15).

**Why native `bezierCurveTo` instead of sampling:** the canvas 2D API draws exact cubic Beziers directly (`ctx.bezierCurveTo(t1, t2, p3)` from the current point) — no need to sample `curve.getXValue(t)` at many `t` steps to approximate the curve, unlike a from-scratch renderer.

**Files:**
- Create: `webapp/src/app/editor2d/viewport.ts`
- Create: `webapp/src/app/editor2d/SplineCanvas.tsx`

**Acceptance Criteria:**
- [ ] `boardToScreen`/`screenToBoard` are inverses of each other (within floating point tolerance)
- [ ] `fitViewport` computes a scale/pan that fits a spline's control-point bounding box into the given pixel dimensions with padding
- [ ] `SplineCanvas` draws the curve as a single continuous path (each segment's `bezierCurveTo` chains off the previous segment's endpoint — no gaps)
- [ ] Selected control point / tangent handle renders in a distinct color from unselected ones

**Verify:** manual — Task 15 will mount this inside the running app; this task alone has no page to view yet. Use `cd webapp && npm run build` to confirm it type-checks.

**Steps:**

- [ ] **Step 1: Implement viewport.ts**

Create `webapp/src/app/editor2d/viewport.ts`:

```typescript
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
  // A spline with no control points would otherwise leave minX/maxX/minY/maxY at their
  // +/-Infinity sentinels, propagating NaN into centerX/centerY and the returned pan values -
  // silently blank canvas, no error. Return a sane default instead.
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
```

- [ ] **Step 2: Implement SplineCanvas.tsx**

Create `webapp/src/app/editor2d/SplineCanvas.tsx`:

```tsx
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
  onPointerCancel?: (event: React.PointerEvent<HTMLCanvasElement>) => void;
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
  const { spline, viewport, selection, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // `useLayoutEffect`, not `useEffect`: changing the canvas's width/height attributes below
  // resets its bitmap per the HTML spec, and React commits that synchronously before paint.
  // `useEffect` fires after paint, so it would leave a one-frame blank-canvas flash on mount
  // and on every viewport resize; `useLayoutEffect` redraws before that paint happens.
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
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      style={{ touchAction: 'none', border: '1px solid #cbd5e1' }}
    />
  );
}
```

- [ ] **Step 3: Verify** — `cd webapp && npm run build` → exits 0

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/editor2d/viewport.ts webapp/src/app/editor2d/SplineCanvas.tsx
git commit -m "Add app/editor2d viewport transform and SplineCanvas rendering"
```

---

## Task 15: app/editor2d — pointer interaction (select, drag, add, delete)

**Goal:** Wire pointer events to `SplineCanvas`: click-select a control point or tangent handle, drag to move it with live preview, release to dispatch exactly one undoable command (mirrors the Java desktop app's "mutate live during drag, commit one history entry on mouse-up" behavior — see "Deliberate simplifications" item 2), double-click empty curve to add a control point, `Delete`/`Backspace` to remove the selected control point.

**Hit-testing is implemented here, not ported from Java:** `BezierSpline.findBestMatch`/`getBestMatchWhich` were skipped in Task 4 because they're pixel-space interaction heuristics, not curve math. This task's `hitTest` does the equivalent job directly in screen space, which is simpler and belongs at this layer per the design doc's core/app split.

**Files:**
- Modify: `webapp/src/core/commands/editCommands.ts` (export `moveKnotTangent` so the live-preview code and the real command use the exact same primitive — no risk of the two drifting apart)
- Create: `webapp/src/app/editor2d/Editor2D.tsx`

**Acceptance Criteria:**
- [ ] Clicking within ~8 screen pixels of a control point or tangent handle selects it (closest wins); clicking empty space clears selection
- [ ] Dragging a selected point updates a local preview spline every pointer-move (not dispatched to history) and dispatches exactly one `moveControlPointCommand` on pointer-up
- [ ] Double-clicking on empty canvas space dispatches `addControlPointCommand` at the clicked board position and selects the new knot
- [ ] `Delete`/`Backspace` with a control point (not a tangent handle) selected dispatches `deleteControlPointCommand`
- [ ] After Task 20 wires this into the app shell, dragging the outline's middle control point visibly reshapes the curve, and the 3D preview (once Task 18 lands) updates after release

**Verify:** manual, once Task 20 provides a page to mount this in — drag a control point in the browser and confirm: (1) the curve follows the cursor smoothly during the drag, (2) releasing leaves the new shape in place, (3) Ctrl/Cmd+Z immediately after reverts it to the pre-drag shape. Until then, `cd webapp && npm run build` → exits 0.

**Steps:**

- [ ] **Step 1: Export moveKnotTangent from editCommands.ts**

In `webapp/src/core/commands/editCommands.ts`, change:

```typescript
function moveKnotTangent(knot: BezierKnot, which: 1 | 2, x: number, y: number): void {
```

to:

```typescript
export function moveKnotTangent(knot: BezierKnot, which: 1 | 2, x: number, y: number): void {
```

- [ ] **Step 2: Implement Editor2D.tsx**

Create `webapp/src/app/editor2d/Editor2D.tsx`:

```tsx
import { useRef, useState } from 'react';
import type { Point2D } from '../../core/bezier/point';
import { BezierSpline } from '../../core/bezier/bezierSpline';
import { END_POINT } from '../../core/bezier/bezierKnot';
import * as vec from '../../core/bezier/vecMath';
import { moveControlPointCommand, moveKnotTangent, addControlPointCommand, deleteControlPointCommand } from '../../core/commands/editCommands';
import type { SplineRef } from '../../core/commands/splineRef';
import { useBoardState } from '../state/BoardStateContext';
import { SplineCanvas, type KnotSelection } from './SplineCanvas';
import { screenToBoard, type Viewport } from './viewport';

export interface Editor2DProps {
  spline: BezierSpline;
  splineRef: SplineRef;
  viewport: Viewport;
}

const HIT_RADIUS_PX = 8;

function eventToScreenPos(event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): Point2D {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/**
 * `spline.clone()` deep-copies each knot's points but NOT its `.slave` reference (see
 * `BezierKnot.clone()`'s doc comment) - a knot cloned from `board.deck`'s or
 * `board.bottom`'s nose/tail (slave-linked by `setLocks()`) would still have `.slave`
 * pointing at the REAL, live knot on the real board. Since this preview is a scratch,
 * render-only copy that's mutated directly (bypassing `dispatch`/`cloneBoard`) on every
 * pointermove, leaving `.slave` intact would let `updateSlave()` reach through it and
 * mutate the live board in place mid-drag - outside undo history, outside React state.
 * Stripping `.slave` here (the preview never needs real slave-sync; it's discarded once
 * the real command runs and produces a properly `cloneBoard`+`setLocks`-rebound board)
 * makes that impossible.
 */
function clonePreviewSpline(spline: BezierSpline): BezierSpline {
  const preview = spline.clone();
  for (let i = 0; i < preview.getNrOfControlPoints(); i++) {
    preview.getControlPoint(i).slave = null;
  }
  return preview;
}

export function Editor2D({ spline, splineRef, viewport }: Editor2DProps) {
  const { dispatch } = useBoardState();
  const [selection, setSelection] = useState<KnotSelection | null>(null);
  const [previewSpline, setPreviewSpline] = useState<BezierSpline | null>(null);
  const dragRef = useRef<KnotSelection | null>(null);

  function hitTest(screenPos: Point2D): KnotSelection | null {
    const boardPos = screenToBoard(viewport, screenPos);
    const threshold = HIT_RADIUS_PX / viewport.scale;
    let best: KnotSelection | null = null;
    let bestDist = threshold;

    for (let i = 0; i < spline.getNrOfControlPoints(); i++) {
      const knot = spline.getControlPoint(i);
      for (const which of [0, 1, 2] as const) {
        const dist = vec.length(knot.points[which], boardPos);
        if (dist < bestDist) {
          bestDist = dist;
          best = { knotIndex: i, which };
        }
      }
    }
    return best;
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const hit = hitTest(eventToScreenPos(event));
    setSelection(hit);
    if (hit == null) return;

    dragRef.current = hit;
    setPreviewSpline(clonePreviewSpline(spline));
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (drag == null || previewSpline == null) return;

    const boardPos = screenToBoard(viewport, eventToScreenPos(event));
    const knot = previewSpline.getControlPoint(drag.knotIndex);
    if (drag.which === 0) {
      knot.setControlPointLocation(boardPos.x, boardPos.y);
    } else {
      moveKnotTangent(knot, drag.which, boardPos.x, boardPos.y);
    }
    setPreviewSpline(previewSpline.clone());
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (drag == null) return;

    const boardPos = screenToBoard(viewport, eventToScreenPos(event));
    dispatch('Move control point', (board) => moveControlPointCommand(board, splineRef, drag.knotIndex, drag.which, boardPos.x, boardPos.y));

    dragRef.current = null;
    setPreviewSpline(null);
  }

  function onPointerCancel() {
    // Gesture was cancelled (touch reinterpreted, stylus left range, OS interruption) -
    // clear drag state WITHOUT dispatching; a cancelled gesture shouldn't commit a change.
    dragRef.current = null;
    setPreviewSpline(null);
  }

  function onDoubleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const boardPos = screenToBoard(viewport, eventToScreenPos(event));
    // dispatch's commandFn only returns a Board, so capture the inserted knot's index via
    // a closure variable it writes into - safe because dispatch invokes commandFn
    // synchronously, not deferred inside a setState updater (see Task 12).
    let newKnotIndex = -1;
    dispatch('Add control point', (board) => {
      const result = addControlPointCommand(board, splineRef, boardPos);
      newKnotIndex = result.knotIndex;
      return result.board;
    });
    if (newKnotIndex >= 0) {
      setSelection({ knotIndex: newKnotIndex, which: END_POINT });
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selection != null && selection.which === 0) {
      dispatch('Delete control point', (board) => deleteControlPointCommand(board, splineRef, selection.knotIndex));
      setSelection(null);
    }
  }

  return (
    <div tabIndex={0} onKeyDown={onKeyDown}>
      <SplineCanvas
        spline={previewSpline ?? spline}
        viewport={viewport}
        selection={selection}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify** — `cd webapp && npm run build` → exits 0

- [ ] **Step 4: Commit**

```bash
git add webapp/src/core/commands/editCommands.ts webapp/src/app/editor2d/Editor2D.tsx
git commit -m "Add app/editor2d pointer interaction: select, drag, add, delete control points"
```

---

## Task 16: app/editor2d — guide points and Bezier curve fitting

**Goal:** The "Bezier-Kurvenanpassung" feature from the design doc's scope: a "guide point" mode where clicking the canvas drops guide points instead of selecting/dragging, plus a "Fit Curve" button that dispatches `fitCurveFromGuidePointsCommand` (Task 10) using the accumulated points, and a "Clear Guide Points" button. Guide points are transient UI state (like Java's `BoardEdit.getGuidePoints()`), not part of the `Board` model or undo history — only the resulting fit is undoable.

**Files:**
- Modify: `webapp/src/app/editor2d/SplineCanvas.tsx` (draw guide points)
- Modify: `webapp/src/app/editor2d/Editor2D.tsx` (guide-point mode, Fit Curve / Clear buttons)

**Acceptance Criteria:**
- [ ] A mode toggle switches the canvas between "Edit" (Task 15's select/drag/add/delete) and "Guide Points" (click anywhere adds a point, rendered as a small dot)
- [ ] "Fit Curve" dispatches one `fitCurveFromGuidePointsCommand` using all accumulated guide points and the `isCrossSection` prop, then clears the guide points
- [ ] "Clear Guide Points" empties the list without dispatching any command
- [ ] Guide points are lost on unmount/mode-switch-away (they are not saved, autosaved, or undoable) — this is intentional, matching the Java desktop app

**Verify:** manual, once Task 20 wires this in — switch to Guide Points mode, click 4-5 points roughly along an arc away from the current curve, click Fit Curve, and confirm the curve reshapes to approximate those points; confirm Ctrl/Cmd+Z undoes the fit in one step.

**Steps:**

- [ ] **Step 1: Add guide point rendering to SplineCanvas.tsx**

In `webapp/src/app/editor2d/SplineCanvas.tsx`, add a `guidePoints?: Point2D[]` prop and draw them inside the existing `useLayoutEffect` (Task 14's code review changed this from `useEffect` to avoid a blank-canvas flash on mount/resize — see Task 14), and add it to the dependency array:

```typescript
// Add to SplineCanvasProps:
guidePoints?: Point2D[];

// Destructure it alongside the other props:
const { spline, viewport, selection, guidePoints, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick } = props;

// Add at the end of the drawing effect, before the closing brace, and add `guidePoints` to the dependency array:
if (guidePoints) {
  ctx.fillStyle = '#16a34a';
  for (const gp of guidePoints) {
    const p = boardToScreen(viewport, gp);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

- [ ] **Step 2: Add guide-point mode to Editor2D.tsx**

In `webapp/src/app/editor2d/Editor2D.tsx`, add the `isCrossSection` prop, guide-point state, a mode toggle, and Fit/Clear buttons:

```typescript
// Add to imports:
import { fitCurveFromGuidePointsCommand } from '../../core/commands/editCommands';

// Add to Editor2DProps:
isCrossSection: boolean;

// Add inside Editor2D, alongside the other useState calls:
const [mode, setMode] = useState<'edit' | 'guide'>('edit');
const [guidePoints, setGuidePoints] = useState<Point2D[]>([]);

// Replace onPointerDown's body with a mode branch (keep using clonePreviewSpline, not a
// bare spline.clone(), for the drag-preview branch - see Task 15's slave-reference fix):
function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
  const screenPos = eventToScreenPos(event);
  if (mode === 'guide') {
    setGuidePoints((points) => [...points, screenToBoard(viewport, screenPos)]);
    return;
  }

  const hit = hitTest(screenPos);
  setSelection(hit);
  if (hit == null) return;

  dragRef.current = hit;
  setPreviewSpline(clonePreviewSpline(spline));
  event.currentTarget.setPointerCapture(event.pointerId);
}

function fitCurve() {
  dispatch('Fit curve', (board) => fitCurveFromGuidePointsCommand(board, splineRef, guidePoints, isCrossSection));
  setGuidePoints([]);
}

// Add a mode check as the first line of the EXISTING onDoubleClick and onKeyDown (from
// Task 15) - without this, double-clicking while placing guide points close together
// (a plausible motion when tracing a reference curve) still inserts a real control point,
// and Delete/Backspace can delete a stale selection left over from edit mode:
function onDoubleClick(event: React.MouseEvent<HTMLCanvasElement>) {
  if (mode !== 'edit') return;
  // ...rest of the function body is unchanged from Task 15
}

function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  if (mode !== 'edit') return;
  // ...rest of the function body is unchanged from Task 15
}

// toggleMode reads `mode` directly rather than via a setMode functional updater - it's
// only ever called from this button's onClick (a real event handler, not a batched
// context), so the closure's `mode` is always current; no functional-updater form needed:
function toggleMode() {
  if (mode === 'guide') {
    setGuidePoints([]);
  }
  setMode(mode === 'edit' ? 'guide' : 'edit');
}

// Extend the returned JSX to add a toolbar and pass guidePoints to SplineCanvas:
return (
  <div tabIndex={0} onKeyDown={onKeyDown}>
    <div>
      <button onClick={toggleMode}>{mode === 'edit' ? 'Add Guide Points' : 'Edit Points'}</button>
      {mode === 'guide' && (
        <>
          <button onClick={fitCurve} disabled={guidePoints.length === 0}>Fit Curve</button>
          <button onClick={() => setGuidePoints([])} disabled={guidePoints.length === 0}>Clear Guide Points</button>
        </>
      )}
    </div>
    <SplineCanvas
      spline={previewSpline ?? spline}
      viewport={viewport}
      selection={selection}
      guidePoints={guidePoints}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
    />
  </div>
);
```

- [ ] **Step 3: Verify** — `cd webapp && npm run build` → exits 0

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/editor2d/SplineCanvas.tsx webapp/src/app/editor2d/Editor2D.tsx
git commit -m "Add guide points and Bezier curve fitting UI to app/editor2d"
```

---

## Task 17: app/editor2d — view tabs and cross-section switcher

**Goal:** `BoardEditorPanel`, the component that ties Tasks 14-16 together: tabs to switch between editing the Outline, Deck, and Bottom(Rocker) splines, plus a cross-section list (add/select/reposition/remove), all driving a single mounted `Editor2D`.

**Scope simplification vs. the Java original:** the desktop app overlays Deck and Bottom in one combined "profile" 2D view (both share the length axis). This plan keeps them as two separate tabs instead — each individually editable through the same single-spline `Editor2D` from Tasks 14-16, avoiding a second multi-spline rendering path for v1. This can be revisited later if a combined profile view turns out to matter in practice.

**Files:**
- Create: `webapp/src/app/editor2d/BoardEditorPanel.tsx`

**Acceptance Criteria:**
- [ ] Clicking Outline/Deck/Bottom tabs switches the mounted `Editor2D`'s spline, `splineRef`, and re-fits the viewport to that spline's bounding box
- [ ] "Add Cross-Section" inserts one at the board's midpoint and it appears in the list; clicking a list entry switches the editor to that cross-section (`isCrossSection=true`, so Task 16's Fit Curve uses the x/y-bounded range)
- [ ] Editing a cross-section's position number input dispatches `moveCrossSectionCommand`; "Remove" dispatches `removeCrossSectionCommand`
- [ ] The two boundary cross-sections (index 0 and last) never appear in the list and have no Remove button (Task 10's guard prevents removing them even if they did)

**Verify:** manual, once Task 20 mounts this — click through Outline/Deck/Bottom tabs and confirm each shows a different curve at a sensible zoom; add 2-3 cross-sections, confirm they appear in the list sorted by position, click one and confirm the editor switches to it; remove one and confirm it disappears from the list and the 3D preview (once Task 18 lands) updates.

**Steps:**

- [ ] **Step 1: Implement BoardEditorPanel.tsx**

Create `webapp/src/app/editor2d/BoardEditorPanel.tsx`:

**Note: cross-section selection is tracked by remembered POSITION, not array index** — this
underwent several fix rounds after review found that an index-based `ViewMode` (the initial,
simpler design) breaks whenever an unrelated `removeCrossSectionCommand`/`moveCrossSectionCommand`
shifts what's at a given array index. The final design below re-resolves the tracked
cross-section to its current array index every render via nearest-position match. See the
inline comments for the full reasoning — this is the single trickiest part of this task.

```tsx
import { useEffect, useState } from 'react';
import type { Board } from '../../core/board/types';
import { BezierSpline } from '../../core/bezier/bezierSpline';
import { getLength } from '../../core/board/board';
import { addCrossSectionCommand, removeCrossSectionCommand, moveCrossSectionCommand } from '../../core/commands/editCommands';
import type { SplineRef } from '../../core/commands/splineRef';
import { useBoardState } from '../state/BoardStateContext';
import { Editor2D } from './Editor2D';
import { fitViewport, type Viewport } from './viewport';

type ViewMode = 'outline' | 'deck' | 'bottom' | { crossSectionPosition: number };

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

/** Finds the real (non-boundary) cross-section whose position is closest to `position`.
 *  Returns null if there are no real cross-sections. Re-run on every render rather than
 *  cached, so it always reflects the current board - array index alone isn't a stable
 *  identity across dispatches (removeCrossSectionCommand splices, moveCrossSectionCommand
 *  re-sorts), but position survives both as long as the cross-section itself still exists. */
function findActiveCrossSectionIndex(board: Board, viewMode: ViewMode): number | null {
  if (typeof viewMode !== 'object') return null;
  let bestIndex: number | null = null;
  let bestDist = Infinity;
  for (let i = 1; i < board.crossSections.length - 1; i++) {
    const dist = Math.abs(board.crossSections[i].position - viewMode.crossSectionPosition);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function resolveViewSpline(board: Board, mode: ViewMode, activeCrossSectionIndex: number | null): BezierSpline {
  if (mode === 'outline') return board.outline;
  if (mode === 'deck') return board.deck;
  if (mode === 'bottom') return board.bottom;
  return activeCrossSectionIndex != null ? board.crossSections[activeCrossSectionIndex].spline : board.outline;
}

function toSplineRef(mode: ViewMode, activeCrossSectionIndex: number | null): SplineRef {
  if (mode === 'outline' || mode === 'deck' || mode === 'bottom') return mode;
  // Must agree with resolveViewSpline's null-fallback (also 'outline') - otherwise, for the
  // one render where viewMode is still the cross-section variant but the tracked
  // cross-section is gone (reachable via undo/redo/resetBoard removing it out from under
  // the panel, not just this file's own onRemove guard), Editor2D would render the
  // outline's shape while dispatching edits against `{crossSection: 0}` - a boundary
  // spline's knot indices - a mismatched pair, not just a display glitch.
  return activeCrossSectionIndex != null ? { crossSection: activeCrossSectionIndex } : 'outline';
}

function sameMode(a: ViewMode, b: ViewMode): boolean {
  if (typeof a === 'object' || typeof b === 'object') {
    return typeof a === 'object' && typeof b === 'object' && a.crossSectionPosition === b.crossSectionPosition;
  }
  return a === b;
}

/**
 * Position input for a single cross-section row. Kept as local, uncontrolled-ish text
 * state and only dispatches `moveCrossSectionCommand` on blur/Enter (not per keystroke).
 *
 * Why: `moveCrossSectionCommand` calls `sortCrossSections` internally, so dispatching on
 * every keystroke could reorder `board.crossSections` mid-typing - and since the parent
 * list's `<li>` is keyed by array index, a reorder while this input is still focused would
 * make React re-attach the wrong logical row's state to that index, which can also drop
 * focus. Committing only on blur/Enter means the array can only reorder after the user has
 * already left the field, matching Task 15's "edit locally, commit once" convention (e.g.
 * Editor2D's own drag-then-dispatch-on-pointer-up), and avoids spamming one undo-history
 * entry per keystroke for what is logically a single edit.
 */
function CrossSectionRow({
  index,
  position,
  active,
  onSelect,
  onCommitPosition,
  onRemove,
}: {
  index: number;
  position: number;
  active: boolean;
  onSelect: () => void;
  onCommitPosition: (index: number, value: number) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(() => position.toFixed(1));

  useEffect(() => {
    setText(position.toFixed(1));
  }, [position]);

  function commit() {
    const value = Number(text);
    if (text.trim() !== '' && Number.isFinite(value) && value !== position) {
      onCommitPosition(index, value);
    } else {
      setText(position.toFixed(1));
    }
  }

  return (
    <li>
      <button style={{ fontWeight: active ? 'bold' : 'normal' }} onClick={onSelect}>
        {position.toFixed(1)} cm
      </button>
      <input
        type="number"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
      />
      <button onClick={onRemove}>Remove</button>
    </li>
  );
}

/**
 * Cross-section selection is tracked by position (`viewMode`'s `crossSectionPosition`), not
 * array index, re-resolved to the current array index every render via
 * `findActiveCrossSectionIndex`'s nearest-position match - see that function's doc comment
 * for why index alone isn't a stable identity across dispatches. That remembered position
 * can go stale in three distinct ways, each handled by its own mechanism at its own call
 * site rather than one central place, since each is triggered by a different event:
 *  - The active row edits its OWN position -> `onCommitPosition` updates `viewMode` to the
 *    actual committed position (read back from the command result, not the raw typed value).
 *  - The active row is removed via this panel's own Remove button -> `onRemove` explicitly
 *    falls back to the Outline tab (nearest-match alone wouldn't reliably detect this, since
 *    some other remaining row is often still "nearest" to the stale anchor).
 *  - The active row disappears some other way (undo/redo, resetBoard, or any future removal
 *    path that doesn't go through this file's onRemove) -> the `useEffect` below falls back
 *    to Outline whenever nearest-match itself comes up empty (only possible when zero real
 *    cross-sections remain at all).
 */
export function BoardEditorPanel() {
  const { board, dispatch } = useBoardState();
  const [viewMode, setViewMode] = useState<ViewMode>('outline');
  const [viewport, setViewport] = useState<Viewport>(() => fitViewport(board.outline, CANVAS_WIDTH, CANVAS_HEIGHT, 30, false));

  const activeCrossSectionIndex = findActiveCrossSectionIndex(board, viewMode);

  function selectView(mode: ViewMode) {
    setViewMode(mode);
    const resolvedIndex = findActiveCrossSectionIndex(board, mode);
    const spline = resolveViewSpline(board, mode, resolvedIndex);
    const flipY = mode !== 'outline';
    setViewport(fitViewport(spline, CANVAS_WIDTH, CANVAS_HEIGHT, 30, flipY));
  }

  // If the cross-section the user was editing gets removed out from under them (not just
  // reordered - findActiveCrossSectionIndex only returns null when no real cross-section
  // remains close enough to have been "it"), fall back to the Outline tab rather than
  // silently rendering board.outline while isCrossSection stays true and no tab is
  // highlighted as active.
  useEffect(() => {
    if (typeof viewMode === 'object' && activeCrossSectionIndex == null) {
      selectView('outline');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCrossSectionIndex, viewMode]);

  const activeSpline = resolveViewSpline(board, viewMode, activeCrossSectionIndex);
  const realCrossSections = board.crossSections.slice(1, -1);

  return (
    <div>
      <div>
        <button disabled={sameMode(viewMode, 'outline')} onClick={() => selectView('outline')}>Outline</button>
        <button disabled={sameMode(viewMode, 'deck')} onClick={() => selectView('deck')}>Deck</button>
        <button disabled={sameMode(viewMode, 'bottom')} onClick={() => selectView('bottom')}>Bottom / Rocker</button>
      </div>

      <div>
        <button onClick={() => dispatch('Add cross-section', (b) => addCrossSectionCommand(b, getLength(b) / 2))}>
          Add Cross-Section
        </button>
        <ul>
          {realCrossSections.map((cs, i) => {
            const index = i + 1;
            return (
              <CrossSectionRow
                key={cs.position}
                index={index}
                position={cs.position}
                active={activeCrossSectionIndex === index}
                onSelect={() => selectView({ crossSectionPosition: cs.position })}
                onCommitPosition={(idx, value) => {
                  // Read the ACTUAL resulting position back off the command's result rather
                  // than trusting the raw typed `value`: moveCrossSectionCommand may clamp it
                  // to the board's bounds and/or nudge it away from a collision (see
                  // resolveUniqueCrossSectionPosition in Task 10) - `value` alone would go
                  // stale immediately for the same reason a remembered-but-uncommitted anchor
                  // does below. `commandFn` runs synchronously inside `dispatch` (Task 12), so
                  // this closure-capture is the same pattern Editor2D.tsx's onDoubleClick
                  // already uses to read back addControlPointCommand's `knotIndex`.
                  let actualPosition = value;
                  dispatch('Move cross-section', (b) => {
                    const result = moveCrossSectionCommand(b, idx, value);
                    actualPosition = result.position;
                    return result.board;
                  });

                  // viewMode.crossSectionPosition is a remembered anchor for nearest-match
                  // re-resolution (see findActiveCrossSectionIndex) - if it's left stale after
                  // the ACTIVE row moves its own position, the anchor keeps pointing at the old
                  // position, and a large-enough move can put a neighboring row closer to that
                  // stale anchor than this row now is, silently reassigning selection to that
                  // neighbor. Keep the anchor in sync (using the actual committed position,
                  // not the raw input) when the row being committed is the active one.
                  if (idx === activeCrossSectionIndex) {
                    setViewMode({ crossSectionPosition: actualPosition });
                  }
                }}
                onRemove={() => {
                  // findActiveCrossSectionIndex tracks by nearest-position, which is needed
                  // so a selected row survives editing its OWN position - but that same
                  // leniency means removing the currently-active row wouldn't reliably
                  // resolve to null afterward (some other remaining row is often still
                  // "nearest"), so the null-triggered fallback effect below wouldn't fire.
                  // Handle this case explicitly instead of relying on that heuristic.
                  if (index === activeCrossSectionIndex) {
                    selectView('outline');
                  }
                  dispatch('Remove cross-section', (b) => removeCrossSectionCommand(b, index));
                }}
              />
            );
          })}
        </ul>
      </div>

      <Editor2D
        spline={activeSpline}
        splineRef={toSplineRef(viewMode, activeCrossSectionIndex)}
        viewport={viewport}
        isCrossSection={activeCrossSectionIndex != null}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `cd webapp && npm run build` → exits 0

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/editor2d/BoardEditorPanel.tsx
git commit -m "Add view tabs and cross-section switcher (BoardEditorPanel) to app/editor2d"
```

---

## Task 18: app/viewer3d — react-three-fiber 3D preview

**Goal:** Render `core/surface`'s mesh in a `react-three-fiber` `<Canvas>` with orbit controls, per the design doc's data flow: the mesh is rebuilt from the board whenever the board changes (after a command is dispatched — not live during a 2D drag, since the drag preview in Task 15 is local component state, not board-context state; this matches the design doc's documented data flow exactly).

**Axis remap:** `core/surface` uses `(x=length, y=half-width, z=height)` (Task 8). Three.js conventionally treats Y as up, so this task remaps to `(three.x=length, three.y=height, three.z=width)` when building the `BufferGeometry` — this remap is a rendering concern and intentionally does not leak into `core`.

**Files:**
- Create: `webapp/src/app/viewer3d/BoardMesh.tsx`
- Create: `webapp/src/app/viewer3d/Viewer3D.tsx`

**Acceptance Criteria:**
- [ ] `BoardMesh` rebuilds its `BufferGeometry` via `useMemo` keyed on `board` (not on every render)
- [ ] Vertex normals are computed via `computeVertexNormals()` (per the "Deliberate simplifications" section — no analytic normals ported from Java)
- [ ] `Viewer3D` renders a lit, orbit-controllable scene showing the board mesh
- [ ] Changing the board (e.g. via a command dispatch) visibly updates the mesh shape

**Verify:** manual, once Task 20 mounts this next to `BoardEditorPanel` — confirm a board-shaped mesh renders, mouse-drag orbits the camera, and editing a control point in the 2D editor (Task 15) changes the 3D shape after releasing the drag.

**Steps:**

- [ ] **Step 1: Implement BoardMesh.tsx**

Create `webapp/src/app/viewer3d/BoardMesh.tsx`:

```tsx
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Board } from '../../core/board/types';
import { buildSurfaceMesh } from '../../core/surface/surfaceMesh';

// Denser than buildSurfaceMesh's own defaults (40/24): the 2D editor renders
// splines analytically at arbitrary resolution, but the 3D preview bakes a
// fixed-resolution triangle mesh, so we bias toward a smoother surface.
const LENGTH_SPLITS = 60;
const CROSS_SPLITS = 32;

export function BoardMesh({ board }: { board: Board }) {
  const geometry = useMemo(() => {
    const mesh = buildSurfaceMesh(board, LENGTH_SPLITS, CROSS_SPLITS);
    const positions = mesh.positions;

    // core/surface uses (x=length, y=half-width, z=height); remap to Three's Y-up.
    const vertexCount = positions.length / 3;
    const remapped = new Float32Array(positions.length);
    for (let i = 0; i < vertexCount; i++) {
      remapped[i * 3] = positions[i * 3]; // length -> X
      remapped[i * 3 + 1] = positions[i * 3 + 2]; // height -> Y
      remapped[i * 3 + 2] = positions[i * 3 + 1]; // width -> Z
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(remapped, 3));
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [board]);

  // `new THREE.BufferGeometry()` built imperatively here is not owned by R3F's
  // JSX reconciler (it's applied via a plain `geometry` prop, not declared as a
  // JSX child), so it is never auto-disposed. Each board edit creates a new
  // geometry via useMemo above; without this, the old geometry's GPU buffers
  // (VBO/IBO) would leak on every dispatch. The cleanup runs right before the
  // effect re-fires for the next `geometry` (i.e. right when the old one
  // becomes unreferenced), and also on unmount.
  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} />
    </mesh>
  );
}
```

- [ ] **Step 2: Implement Viewer3D.tsx**

Create `webapp/src/app/viewer3d/Viewer3D.tsx`:

```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { getLength } from '../../core/board/board';
import { useBoardState } from '../state/BoardStateContext';
import { BoardMesh } from './BoardMesh';

export function Viewer3D() {
  const { board } = useBoardState();
  // buildSurfaceMesh's coordinates run x=[0, length], not centered at the
  // origin; point OrbitControls' orbit target at the board's midpoint so the
  // initial view frames it, without translating core/surface's geometry itself.
  const target: [number, number, number] = [getLength(board) / 2, 0, 0];

  return (
    <Canvas camera={{ position: [100, 60, 150], fov: 45 }} style={{ width: '100%', height: '480px' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={0.8} />
      <BoardMesh board={board} />
      <OrbitControls target={target} />
    </Canvas>
  );
}
```

- [ ] **Step 3: Verify** — `cd webapp && npm run build` → exits 0

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/viewer3d/BoardMesh.tsx webapp/src/app/viewer3d/Viewer3D.tsx
git commit -m "Add app/viewer3d react-three-fiber 3D board preview"
```

---

## Task 19: app/dialogs — Board Settings dialog

**Goal:** The one dialog the design doc scopes for v1: name/designer + length/width/thickness, dispatching `scaleBoardCommand` (Task 10) and `updateMetadataCommand` together as one undo step.

**Files:**
- Create: `webapp/src/app/dialogs/BoardSettingsDialog.tsx`

**Acceptance Criteria:**
- [ ] Opening the dialog pre-fills fields from the current board (`getLength`/`getMaxWidth`/`getMaxThickness`, `name`, `designer`)
- [ ] Saving dispatches exactly one command that both scales the board and updates its metadata — one undo step reverts both
- [ ] Cancel closes without dispatching anything
- [ ] Re-opening after Cancel shows the current (unchanged) board values again, not stale edits from before Cancel

**Verify:** manual, once Task 20 wires this in — open Board Settings, change length from e.g. 180 to 200, Save, confirm the outline/deck/bottom/3D preview all stretch proportionally and Ctrl/Cmd+Z reverts the whole change in one step.

**Steps:**

- [ ] **Step 1: Implement BoardSettingsDialog.tsx**

Create `webapp/src/app/dialogs/BoardSettingsDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { getLength, getMaxWidth, getMaxThickness } from '../../core/board/board';
import { scaleBoardCommand, updateMetadataCommand } from '../../core/commands/editCommands';
import { useBoardState } from '../state/BoardStateContext';

export interface BoardSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BoardSettingsDialog({ open, onClose }: BoardSettingsDialogProps) {
  const { board, dispatch } = useBoardState();
  const [name, setName] = useState(board.name);
  const [designer, setDesigner] = useState(board.designer);
  const [length, setLength] = useState(getLength(board));
  const [width, setWidth] = useState(getMaxWidth(board));
  const [thickness, setThickness] = useState(getMaxThickness(board));

  useEffect(() => {
    if (!open) return;
    setName(board.name);
    setDesigner(board.designer);
    setLength(getLength(board));
    setWidth(getMaxWidth(board));
    setThickness(getMaxThickness(board));
  }, [open, board]);

  if (!open) return null;

  function onSave() {
    dispatch('Update board settings', (b) => updateMetadataCommand(scaleBoardCommand(b, length, width, thickness), { name, designer }));
    onClose();
  }

  return (
    <div role="dialog" aria-label="Board Settings">
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Designer
        <input value={designer} onChange={(e) => setDesigner(e.target.value)} />
      </label>
      <label>
        Length (cm)
        <input type="number" value={length} onChange={(e) => setLength(Number(e.target.value))} />
      </label>
      <label>
        Width (cm)
        <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
      </label>
      <label>
        Thickness (cm)
        <input type="number" value={thickness} onChange={(e) => setThickness(Number(e.target.value))} />
      </label>
      <button onClick={onSave}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `cd webapp && npm run build` → exits 0

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/dialogs/BoardSettingsDialog.tsx
git commit -m "Add Board Settings dialog to app/dialogs"
```

---

## Task 20: App shell — wire everything together

**Goal:** `App.tsx` becomes the toolbar (New/Open/Save/Undo/Redo/Board Settings) plus a layout hosting `BoardEditorPanel` (Task 17) and `Viewer3D` (Task 18) side by side. This is the first task where the whole app is actually usable end-to-end.

**Files:**
- Modify: `webapp/src/App.tsx`
- Modify: `webapp/src/App.css` (remove the Vite starter template styling, add a minimal flex layout)

**Acceptance Criteria:**
- [ ] New/Open/Save/Undo/Redo/Board Settings are all reachable from the toolbar
- [ ] Undo/Redo buttons are disabled exactly when `canUndo`/`canRedo` are false
- [ ] Opening an invalid file shows an error (via `alert` — acceptable for a personal v1 tool) and leaves the current board unchanged, per the design doc's error-handling rule
- [ ] `BoardEditorPanel` and `Viewer3D` are both visible and both reflect the same board state

**Verify:** manual full smoke test — `cd webapp && npm run dev`, then in the browser: (1) drag an outline control point, confirm the 3D preview updates after release, (2) add and remove a cross-section, (3) switch to Guide Points mode on the outline, place points, Fit Curve, confirm the shape updates, (4) open Board Settings, change length, Save, confirm outline/deck/bottom/3D all rescale, (5) Undo four times, confirming each step reverts in reverse order, (6) Save to a file, refresh the page (autosave restores state), then Open the saved file and confirm it loads, (7) New, confirm a fresh default board appears.

**Steps:**

- [ ] **Step 1: Implement App.tsx**

Replace the contents of `webapp/src/App.tsx`:

```tsx
import { useRef, useState } from 'react';
import './App.css';
import { useBoardState } from './app/state/BoardStateContext';
import { useUndoRedoShortcuts } from './app/state/useUndoRedoShortcuts';
import { downloadBoardFile, readBoardFile } from './app/state/fileIO';
import { newBoard } from './core/board/board';
import { BoardEditorPanel } from './app/editor2d/BoardEditorPanel';
import { Viewer3D } from './app/viewer3d/Viewer3D';
import { BoardSettingsDialog } from './app/dialogs/BoardSettingsDialog';

export default function App() {
  const { board, undo, redo, canUndo, canRedo, resetBoard } = useBoardState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useUndoRedoShortcuts(undo, redo);

  function onNew() {
    const ok = window.confirm('Start a new board? The current board stays in this browser\'s autosave, but any unsaved file changes are lost.');
    if (ok) resetBoard(newBoard());
  }

  async function onOpenFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const loaded = await readBoardFile(file);
      resetBoard(loaded);
    } catch (e) {
      window.alert(`Could not open file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <button onClick={onNew}>New</button>
        <button onClick={() => fileInputRef.current?.click()}>Open</button>
        <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onOpenFile} />
        <button onClick={() => downloadBoardFile(board)}>Save</button>
        <button onClick={undo} disabled={!canUndo}>Undo</button>
        <button onClick={redo} disabled={!canRedo}>Redo</button>
        <button onClick={() => setSettingsOpen(true)}>Board Settings</button>
        <span className="boardName">{board.name}</span>
      </header>

      <main className="workspace">
        <BoardEditorPanel />
        <Viewer3D />
      </main>

      <BoardSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Replace App.css**

Replace the contents of `webapp/src/App.css`:

```css
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #cbd5e1;
}

.boardName {
  margin-left: auto;
  font-weight: 600;
}

.workspace {
  display: flex;
  flex: 1;
  gap: 1rem;
  padding: 1rem;
  overflow: auto;
}
```

- [ ] **Step 3: Run the full manual smoke test from "Verify" above**

```bash
cd webapp && npm run dev
```

Walk through all 7 scenarios listed in this task's Verify section. Fix any issue found before committing.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/App.tsx webapp/src/App.css
git commit -m "Wire app shell: toolbar, BoardEditorPanel + Viewer3D layout, Board Settings dialog"
```

---

## Task 21: Final verification pass and README

**Goal:** Confirm the whole `core` test suite still passes after all the app-layer work, and leave a `webapp/README.md` so a future session (including a future you) can pick this up without re-deriving the architecture from the plan/spec.

**Files:**
- Create: `webapp/README.md`

**Acceptance Criteria:**
- [ ] `npm test` (all `core` unit tests from Tasks 1-11) passes with zero failures
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `README.md` documents: how to run (`npm install && npm run dev`), the `core`/`app` split and why, and the "Deliberate simplifications" list from the top of this plan (so nobody mistakes a scope cut for a bug later)

**Verify:** `cd webapp && npm test && npm run build` → both exit 0

**Steps:**

- [ ] **Step 1: Run the full core test suite**

```bash
cd webapp && npm test
```

If anything fails, fix it now — do not carry a failing test past this task.

- [ ] **Step 2: Run the production build**

```bash
cd webapp && npm run build
```

- [ ] **Step 3: Write README.md**

Create `webapp/README.md`:

```markdown
# BoardCAD Web — Shaping Tool

A client-only React + TypeScript + Three.js port of the shaping/design part of
[BoardCAD LE](../README.md) — outline, cross-sections, rocker, Bezier curve
fitting, and a 3D preview. CAM (toolpath generation) is intentionally not part
of this app; see `docs/superpowers/specs/2026-08-01-boardcad-web-shaping-design.md`
in the repo root for why.

## Running

```bash
npm install
npm run dev
```

Everything runs in the browser — no backend, no account, no deployment. Board
state autosaves to `localStorage` continuously; explicit Save downloads a
`.json` file, and Open loads one back in.

## Architecture

- `src/core/` — pure TypeScript, no React or DOM dependency. Ported from the
  original Java `cadcore`/`board`/`boardcad.commands` packages:
  bezier math (`bezier/`), the board model (`board/`), 3D mesh generation
  (`surface/`), undo/redo commands (`commands/`), and the JSON save format
  (`persistence/`). Covered by Vitest (`npm test`).
- `src/app/` — React UI that consumes `core` and never gets ported to
  directly: the 2D curve editor (`editor2d/`), the 3D viewer
  (`viewer3d/`, react-three-fiber), state/undo-redo binding (`state/`), and
  dialogs (`dialogs/`). Tested manually in the browser (see the plan's task
  list for the smoke-test scenarios) — no CI requirement for a personal tool.

## Known scope cuts vs. the Java desktop app

See "Deliberate simplifications vs. the Java original" at the top of
`docs/superpowers/plans/2026-08-01-boardcad-web-shaping.md` for the full list
and reasoning. In short: no CAM, no `.brd` file compatibility, whole-board
snapshot undo instead of field-level diffing, uniform arc-length mesh
sampling instead of angle-weighted, Deck/Bottom are separate editor tabs
instead of one combined profile view, and a handful of `BoardCADSettings`
toggles from the original are hardcoded to their simpler default.
```

- [ ] **Step 4: Commit**

```bash
git add webapp/README.md
git commit -m "Add webapp README and confirm full test suite + build pass"
```

---

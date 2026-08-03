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

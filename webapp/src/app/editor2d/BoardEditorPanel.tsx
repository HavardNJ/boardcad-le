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
                  // resolveUniqueCrossSectionPosition) - `value` alone would go stale
                  // immediately for the same reason a remembered-but-uncommitted anchor does
                  // below. `commandFn` runs synchronously inside `dispatch` (Task 12), so this
                  // closure-capture is the same pattern Editor2D.tsx's onDoubleClick already
                  // uses to read back addControlPointCommand's `knotIndex`.
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

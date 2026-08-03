import { useEffect, useState } from 'react';
import type { Board } from '../../core/board/types';
import { BezierSpline } from '../../core/bezier/bezierSpline';
import { getLength } from '../../core/board/board';
import { addCrossSectionCommand, removeCrossSectionCommand, moveCrossSectionCommand } from '../../core/commands/editCommands';
import type { SplineRef } from '../../core/commands/splineRef';
import { useBoardState } from '../state/BoardStateContext';
import { Editor2D } from './Editor2D';
import { fitViewport, type Viewport } from './viewport';

type ViewMode = 'outline' | 'deck' | 'bottom' | { crossSection: number };

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

function resolveViewSpline(board: Board, mode: ViewMode): BezierSpline {
  if (mode === 'outline') return board.outline;
  if (mode === 'deck') return board.deck;
  if (mode === 'bottom') return board.bottom;
  return board.crossSections[mode.crossSection].spline;
}

function toSplineRef(mode: ViewMode): SplineRef {
  if (mode === 'outline' || mode === 'deck' || mode === 'bottom') return mode;
  return { crossSection: mode.crossSection };
}

function sameMode(a: ViewMode, b: ViewMode): boolean {
  if (typeof a === 'object' || typeof b === 'object') {
    return typeof a === 'object' && typeof b === 'object' && a.crossSection === b.crossSection;
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

export function BoardEditorPanel() {
  const { board, dispatch } = useBoardState();
  const [viewMode, setViewMode] = useState<ViewMode>('outline');
  const [viewport, setViewport] = useState<Viewport>(() => fitViewport(board.outline, CANVAS_WIDTH, CANVAS_HEIGHT, 30, false));

  function selectView(mode: ViewMode) {
    setViewMode(mode);
    const spline = resolveViewSpline(board, mode);
    const flipY = mode !== 'outline';
    setViewport(fitViewport(spline, CANVAS_WIDTH, CANVAS_HEIGHT, 30, flipY));
  }

  const activeSpline = resolveViewSpline(board, viewMode);
  const activeCrossSectionIndex = typeof viewMode === 'object' ? viewMode.crossSection : null;
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
                key={index}
                index={index}
                position={cs.position}
                active={activeCrossSectionIndex === index}
                onSelect={() => selectView({ crossSection: index })}
                onCommitPosition={(idx, value) =>
                  dispatch('Move cross-section', (b) => moveCrossSectionCommand(b, idx, value))
                }
                onRemove={() => dispatch('Remove cross-section', (b) => removeCrossSectionCommand(b, index))}
              />
            );
          })}
        </ul>
      </div>

      <Editor2D
        spline={activeSpline}
        splineRef={toSplineRef(viewMode)}
        viewport={viewport}
        isCrossSection={activeCrossSectionIndex != null}
      />
    </div>
  );
}

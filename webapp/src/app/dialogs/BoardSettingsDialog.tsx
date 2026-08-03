import { useEffect, useRef, useState } from 'react';
import { getLength, getMaxWidth, getMaxThickness } from '../../core/board/board';
import { scaleBoardCommand, updateMetadataCommand } from '../../core/commands/editCommands';
import { useBoardState } from '../state/BoardStateContext';

export interface BoardSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Sane physical minimum (cm) for length/width/thickness. `scaleBoard` divides the new
 * dimension by the current one to derive a scale factor with no floor/clamp anywhere in the
 * chain, so a non-positive value here (including a cleared input, since `Number('') === 0`)
 * would collapse the board's outline spline to a single point. Validation below refuses to
 * dispatch below this floor.
 */
const MIN_DIMENSION_CM = 0.1;

export function BoardSettingsDialog({ open, onClose }: BoardSettingsDialogProps) {
  const { board, dispatch } = useBoardState();
  const [name, setName] = useState(board.name);
  const [designer, setDesigner] = useState(board.designer);
  const [length, setLength] = useState(getLength(board));
  const [width, setWidth] = useState(getMaxWidth(board));
  const [thickness, setThickness] = useState(getMaxThickness(board));
  const wasOpen = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Only re-sync fields from `board` on the open transition (false -> true), not on every
  // `board` change while the dialog stays open. Re-syncing on every `board` change would
  // silently clobber an in-progress, not-yet-saved edit if the board changes for a reason
  // unrelated to this dialog (e.g. an undo/redo fired while focus is on the Save/Cancel
  // buttons rather than inside an input - useUndoRedoShortcuts' isEditableTarget guard only
  // blocks the shortcut while focus is currently inside an editable element).
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName(board.name);
      setDesigner(board.designer);
      setLength(getLength(board));
      setWidth(getMaxWidth(board));
      setThickness(getMaxThickness(board));
    }
    wasOpen.current = open;
  }, [open, board]);

  // Move focus into the dialog whenever it opens, so Escape works immediately instead of
  // only once focus happens to land inside (e.g. after clicking a field). Also makes the
  // backdrop below meaningfully modal: with focus trapped visually inside the dialog and
  // the backdrop covering/blocking the rest of the app, there's no way to interact with the
  // toolbar (New/Open/Save/Undo/Redo) while this is open.
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const isValid =
    Number.isFinite(length) &&
    length > MIN_DIMENSION_CM &&
    Number.isFinite(width) &&
    width > MIN_DIMENSION_CM &&
    Number.isFinite(thickness) &&
    thickness > MIN_DIMENSION_CM;

  const errorMessage = isValid ? null : `Length, width, and thickness must all be greater than ${MIN_DIMENSION_CM} cm.`;

  function onSave() {
    if (!isValid) return; // unreachable via the disabled button, but a harmless guard
    dispatch('Update board settings', (b) => updateMetadataCommand(scaleBoardCommand(b, length, width, thickness), { name, designer }));
    onClose();
  }

  return (
    // Real modal behavior, not just ARIA attributes: the backdrop covers and functionally
    // blocks the rest of the app (toolbar included) while open, and clicking it closes the
    // dialog like Cancel. Without this, the toolbar's New/Open stayed fully clickable behind
    // the "open" dialog, which could silently apply this dialog's stale fields to a
    // just-reset board - see BoardEditorPanel's resetVersion handling for the analogous
    // stale-view problem on the 2D editor side.
    //
    // Close only when the click's target IS the backdrop itself, not merely a
    // stopPropagation()-guarded bubble from inside .dialog: a text-selection drag that
    // starts inside an input and is released outside the dialog box (but still within the
    // backdrop) makes the browser retarget the resulting click to the nearest common
    // ancestor of mousedown/mouseup, which can be the backdrop - bypassing an inner
    // stopPropagation() entirely and closing the dialog, discarding in-progress edits the
    // user never intended to abandon. Target-equality is immune to that retargeting.
    <div
      className="dialogBackdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Board Settings"
        aria-modal="true"
        tabIndex={-1}
        className="dialog"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
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
        {errorMessage != null && (
          <p role="alert" style={{ color: 'red' }}>
            {errorMessage}
          </p>
        )}
        <button onClick={onSave} disabled={!isValid}>
          Save
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

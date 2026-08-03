import { useEffect, useState } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(board.name);
    setDesigner(board.designer);
    setLength(getLength(board));
    setWidth(getMaxWidth(board));
    setThickness(getMaxThickness(board));
    setError(null);
  }, [open, board]);

  if (!open) return null;

  const isValid =
    Number.isFinite(length) &&
    length > MIN_DIMENSION_CM &&
    Number.isFinite(width) &&
    width > MIN_DIMENSION_CM &&
    Number.isFinite(thickness) &&
    thickness > MIN_DIMENSION_CM;

  function onSave() {
    if (!isValid) {
      setError(`Length, width, and thickness must all be greater than ${MIN_DIMENSION_CM} cm.`);
      return;
    }
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
      {error != null && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}
      <button onClick={onSave} disabled={!isValid}>
        Save
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
}

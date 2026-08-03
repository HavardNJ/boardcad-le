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

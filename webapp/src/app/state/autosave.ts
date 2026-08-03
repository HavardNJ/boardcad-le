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
  localStorage.setItem(STORAGE_KEY, serializeBoard(board));
}

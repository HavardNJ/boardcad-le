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

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

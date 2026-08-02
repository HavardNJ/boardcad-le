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

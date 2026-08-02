import { describe, it, expect } from 'vitest';
import { BoardCommandHistory } from './commandHistory';

type State = { v: number };

describe('BoardCommandHistory', () => {
  it('execute records a before/after pair and reports canUndo', () => {
    const h = new BoardCommandHistory<State>();
    expect(h.canUndo()).toBe(false);
    h.execute('move point', { v: 0 }, { v: 1 });
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
  });

  it('undo returns the before-snapshot and enables redo', () => {
    const h = new BoardCommandHistory<State>();
    h.execute('move point', { v: 0 }, { v: 1 });
    const before = h.undo();
    expect(before).toEqual({ v: 0 });
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
  });

  it('redo returns the after-snapshot', () => {
    const h = new BoardCommandHistory<State>();
    h.execute('move point', { v: 0 }, { v: 1 });
    h.undo();
    const after = h.redo();
    expect(after).toEqual({ v: 1 });
  });

  it('undo past the start returns null and does not move further', () => {
    const h = new BoardCommandHistory<State>();
    expect(h.undo()).toBeNull();
  });

  it('redo past the end returns null', () => {
    const h = new BoardCommandHistory<State>();
    h.execute('a', { v: 0 }, { v: 1 });
    expect(h.redo()).toBeNull();
  });

  it('a new execute after an undo discards the redo branch', () => {
    const h = new BoardCommandHistory<State>();
    h.execute('a', { v: 0 }, { v: 1 });
    h.execute('b', { v: 1 }, { v: 2 });
    h.undo(); // back to v:1, "b" now redo-able
    h.execute('c', { v: 1 }, { v: 3 }); // discards "b"
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toEqual({ v: 1 });
    expect(h.undo()).toEqual({ v: 0 });
    expect(h.undo()).toBeNull();
  });

  it('a new execute after undoing all the way back to the start discards the whole forward branch', () => {
    // Regression test: execute()'s truncation guard used to skip truncation
    // entirely when currentIndex === -1 (fully undone), leaking the discarded
    // branch's snapshots into later undo() calls.
    const h = new BoardCommandHistory<State>();
    h.execute('a', { v: 0 }, { v: 1 });
    h.execute('b', { v: 1 }, { v: 2 });
    h.undo(); // back to v:1
    h.undo(); // back to v:0, fully undone (currentIndex === -1)
    h.execute('c', { v: 0 }, { v: 3 });
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toEqual({ v: 0 }); // before "c"
    expect(h.undo()).toBeNull(); // no leaked "a"/"b" entries
  });

  it('clear empties the history so canUndo and canRedo both report false', () => {
    const h = new BoardCommandHistory<State>();
    h.execute('a', { v: 0 }, { v: 1 });
    h.execute('b', { v: 1 }, { v: 2 });
    h.undo();
    h.clear();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });
});

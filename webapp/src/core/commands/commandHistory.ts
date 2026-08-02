export interface HistoryEntry<TState> {
  description: string;
  before: TState;
  after: TState;
}

export class BoardCommandHistory<TState = unknown> {
  private entries: Array<HistoryEntry<TState>> = [];
  private currentIndex = -1;

  execute(description: string, before: TState, after: TState): TState {
    // No `currentIndex >= 0` guard: when undo has walked all the way back to -1,
    // `entries.length > 0` still correctly truncates to length 0 before the new
    // entry is pushed, discarding the whole stale forward branch. Guarding on
    // `currentIndex >= 0` here would skip truncation in exactly that case, leaking
    // the discarded branch's snapshots into later undo() calls.
    if (this.entries.length > this.currentIndex + 1) {
      this.entries.length = this.currentIndex + 1;
    }
    this.entries.push({ description, before, after });
    this.currentIndex = this.entries.length - 1;
    return after;
  }

  undo(): TState | null {
    if (this.currentIndex < 0) return null;
    const entry = this.entries[this.currentIndex];
    this.currentIndex--;
    return entry.before;
  }

  redo(): TState | null {
    if (this.currentIndex >= this.entries.length - 1) return null;
    this.currentIndex++;
    return this.entries[this.currentIndex].after;
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.entries.length - 1;
  }

  clear(): void {
    this.entries = [];
    this.currentIndex = -1;
  }
}

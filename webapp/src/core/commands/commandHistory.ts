export interface HistoryEntry<TState> {
  description: string;
  before: TState;
  after: TState;
}

export class BoardCommandHistory<TState = unknown> {
  private entries: Array<HistoryEntry<TState>> = [];
  private currentIndex = -1;

  execute(description: string, before: TState, after: TState): TState {
    if (this.currentIndex >= 0 && this.entries.length > this.currentIndex + 1) {
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

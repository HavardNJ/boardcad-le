import { useEffect } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useUndoRedoShortcuts(undo: () => void, redo: () => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.key.toLowerCase() !== 'z') return;

      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);
}

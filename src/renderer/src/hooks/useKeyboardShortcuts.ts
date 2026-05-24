import { useEffect } from 'react';

export interface ShortcutDef {
  /** Lower-case key as produced by KeyboardEvent.key, e.g. 'space', 'arrowleft', 'f11', 'insert'. */
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  /** Human label for the help overlay (e.g. "Play/Pause"). */
  label: string;
  handler: (e: KeyboardEvent) => void;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (TYPING_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

function normKey(k: string): string {
  return k.toLowerCase() === ' ' ? 'space' : k.toLowerCase();
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[], enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent): void => {
      if (isTyping(e.target)) return;
      const k = normKey(e.key);
      for (const s of shortcuts) {
        if (k !== s.key) continue;
        if (!!s.ctrl !== e.ctrlKey) continue;
        if (!!s.shift !== e.shiftKey) continue;
        if (!!s.alt !== e.altKey) continue;
        if (!!s.meta !== e.metaKey) continue;
        e.preventDefault();
        s.handler(e);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts, enabled]);
}

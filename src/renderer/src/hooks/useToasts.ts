import { useState, useCallback } from 'react';

export type ToastKind = 'info' | 'ok' | 'warn' | 'err';
export interface Toast {
  id: number;
  msg: string;
  kind: ToastKind;
}

export function useToasts(): [Toast[], (msg: string, kind?: ToastKind) => void] {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3500);
  }, []);
  return [list, push];
}

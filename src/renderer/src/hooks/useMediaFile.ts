import { useState, useRef, useCallback, useEffect } from 'react';
import type { MediaFile, Track } from '@shared/types';
import type { ToastKind } from './useToasts';

type LogLevel = 'info' | 'ok' | 'warn' | 'err';

export function useMediaFile(
  toast: (msg: string, kind?: ToastKind) => void,
  pushLog: (msg: string, level?: LogLevel) => void
) {
  const [file, setFile] = useState<MediaFile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewAudioId, setPreviewAudioId] = useState<number | null>(null);

  const undoStack = useRef<Track[][]>([]);

  const pushUndo = useCallback(() => {
    undoStack.current.push(tracks.map((x) => ({ ...x })));
    if (undoStack.current.length > 50) undoStack.current.shift();
  }, [tracks]);

  // Ctrl+Z undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const prev = undoStack.current.pop();
        if (prev) setTracks(prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadFile = useCallback(
    async (pathStr: string): Promise<MediaFile | null> => {
      pushUndo();
      const r = await window.api.media.probe(pathStr);
      if (!r.ok || !r.file) {
        toast(r.error || 'שגיאת טעינה', 'err');
        return null;
      }
      const f = r.file;
      setFile(f);
      setTracks(f.tracks.map((t) => ({ ...t })));
      pushLog(`נטען: ${f.name}`, 'info');
      pushLog(
        `probe ok · streams=${f.tracks.length} · audio=${f.tracks.filter((x) => x.kind === 'A').length} · subs=${f.tracks.filter((x) => x.kind === 'S').length}`,
        'ok'
      );

      const audio =
        f.tracks.find((t) => t.kind === 'A' && t.def) || f.tracks.find((t) => t.kind === 'A');
      const sub = f.tracks.find((t) => t.kind === 'S');
      if (audio) {
        setActiveId(String(audio.id));
        setPreviewAudioId(audio.id);
      } else if (sub) {
        setActiveId(String(sub.id));
        setPreviewAudioId(null);
      } else if (f.tracks[0]) {
        setActiveId(String(f.tracks[0].id));
        setPreviewAudioId(null);
      }
      return f;
    },
    [pushUndo, toast, pushLog]
  );

  const onSelectRow = useCallback(
    (id: string) => {
      setActiveId(id);
      if (!id.startsWith('ext:')) {
        const tid = Number(id);
        const tr = tracks.find((t) => t.id === tid);
        if (tr?.kind === 'A') setPreviewAudioId(tid);
      }
    },
    [tracks]
  );

  const toggleKeep = useCallback(
    (id: number) => {
      pushUndo();
      setTracks((tr) =>
        tr.map((t) => {
          if (t.id !== id) return t;
          if (t.locked) {
            toast('מסלול וידאו ראשי נדרש', 'warn');
            return t;
          }
          return { ...t, keep: !t.keep };
        })
      );
    },
    [pushUndo, toast]
  );

  const setDefault = useCallback(
    (id: number) => {
      pushUndo();
      const target = tracks.find((x) => x.id === id);
      if (!target) return;
      setTracks((tr) =>
        tr.map((t) => ({
          ...t,
          def: t.kind === target.kind ? t.id === id : t.def,
        }))
      );
    },
    [pushUndo, tracks]
  );

  const setForced = useCallback(
    (id: number) => {
      pushUndo();
      setTracks((tr) => tr.map((t) => (t.id === id ? { ...t, forced: !t.forced } : t)));
    },
    [pushUndo]
  );

  return {
    file,
    setFile,
    tracks,
    setTracks,
    activeId,
    setActiveId: onSelectRow,
    previewAudioId,
    setPreviewAudioId,
    loadFile,
    toggleKeep,
    setDefault,
    setForced,
    pushUndo,
  };
}

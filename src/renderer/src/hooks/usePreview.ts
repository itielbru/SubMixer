import { useState, useRef, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { MediaFile } from '@shared/types';
import type { ToastKind } from './useToasts';

export interface UsePreviewApi {
  previewT: number;
  playing: boolean;
  audioRef: RefObject<HTMLAudioElement>;
  audioUrl: string | null;
  prepLoading: boolean;
  prepPct: number;
  handleTogglePlay: () => Promise<void>;
  setPreviewTime: (t: number) => void;
}

export function usePreview(
  file: MediaFile | null,
  previewAudioId: number | null,
  toast: (msg: string, kind?: ToastKind) => void
): UsePreviewApi {
  const [previewT, setPreviewT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepPct, setPrepPct] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const extractKeyRef = useRef<string>('');

  // Listen to preview extraction progress from main process
  useEffect(() => {
    return window.api.preview.onProgress((p) => setPrepPct(p.percent));
  }, []);

  // Sync audio element events → state
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl) return;
    const onTime = () => setPreviewT(a.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  // Reset when the source file or selected audio track changes
  useEffect(() => {
    setAudioUrl(null);
    extractKeyRef.current = '';
    setPlaying(false);
    setPrepLoading(false);
  }, [file?.path, previewAudioId]);

  const handleTogglePlay = useCallback(async () => {
    if (!file || previewAudioId === null) {
      toast('אין מסלול אודיו — בחר מסלול A מהרשימה', 'warn');
      return;
    }
    const key = `${file.path}:${previewAudioId}`;
    if (audioUrl && extractKeyRef.current === key) {
      const a = audioRef.current;
      if (a) {
        if (a.paused) void a.play();
        else a.pause();
      }
      return;
    }
    setPrepLoading(true);
    setPrepPct(0);
    extractKeyRef.current = key;
    const r = await window.api.preview.extract(file.path, previewAudioId, file.durationSec);
    setPrepLoading(false);
    if (r.ok && r.url) {
      setAudioUrl(r.url);
      toast('תצוגה מקדימה מוכנה', 'ok');
      setTimeout(() => void audioRef.current?.play(), 50);
    } else {
      toast(r.error || 'שגיאת תצוגה מקדימה', 'err');
      extractKeyRef.current = '';
    }
  }, [file, previewAudioId, audioUrl, toast]);

  const setPreviewTime = useCallback(
    (t: number) => {
      setPreviewT(t);
      const a = audioRef.current;
      if (a && audioUrl) a.currentTime = t;
    },
    [audioUrl]
  );

  return {
    previewT,
    playing,
    audioRef,
    audioUrl,
    prepLoading,
    prepPct,
    handleTogglePlay,
    setPreviewTime,
  };
}

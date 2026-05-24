import { useCallback, useEffect, useRef, useState } from 'react';

import type { MediaFile } from '@shared/types';

import { agentDebug } from '@shared/agent-debug';

import { PREVIEW_QUICK_SECONDS, type PreviewExtractPhase } from '@shared/preview';



function isChromiumDecodableAudio(codecName: string | undefined): boolean {

  if (!codecName) return false;

  const c = codecName.toLowerCase();

  return /^(aac|mp3|mp2|opus|vorbis|flac)$/.test(c);

}



function needsExtractFor(file: MediaFile | null, previewAudioId: number | null): boolean {

  if (!file || previewAudioId === null) return false;

  const audioTrack = file.tracks.find((t) => t.id === previewAudioId);

  return !isChromiumDecodableAudio(audioTrack?.codecName);

}



export type PreviewAudioMode = 'video' | 'quick' | 'full' | 'extracting';



export function usePreview(

  file: MediaFile | null,

  previewAudioId: number | null,

  onError?: (msg: string) => void

) {

  const [previewT, setPreviewT] = useState(0);

  const previewTRef = useRef(0);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [audioPct, setAudioPct] = useState(0);

  const [extractPhase, setExtractPhase] = useState<PreviewExtractPhase | null>(null);

  const [audioMode, setAudioMode] = useState<PreviewAudioMode>('video');

  const [audioLimitSec, setAudioLimitSec] = useState<number | null>(null);

  const pipelineKeyRef = useRef('');

  const pipelineGenRef = useRef(0);

  const onErrorRef = useRef(onError);

  onErrorRef.current = onError;

  const pipelineEffectCountRef = useRef(0);

  const fileRef = useRef(file);

  const previewAudioIdRef = useRef(previewAudioId);

  fileRef.current = file;

  previewAudioIdRef.current = previewAudioId;



  useEffect(() => {

    previewTRef.current = previewT;

  }, [previewT]);



  useEffect(() => {

    return window.api.preview.onProgress((p) => {

      setExtractPhase(p.phase);

      setAudioPct(p.percent);

    });

  }, []);



  const runExtractPipeline = useCallback(async (runGen: number) => {

    const file = fileRef.current;

    const previewAudioId = previewAudioIdRef.current;

    // #region agent log

    agentDebug(

      'usePreview.ts:runExtractPipeline',

      'pipeline_start',

      {

        gen: runGen,

        key: file ? `${file.path}:${previewAudioId}` : null,

        needsExtract: needsExtractFor(file, previewAudioId),

      },

      'H1'

    );

    // #endregion

    if (!file || previewAudioId === null) return;

    if (pipelineGenRef.current !== runGen) return;

    if (!needsExtractFor(file, previewAudioId)) {

      setAudioMode('video');

      setAudioUrl(null);

      setAudioLimitSec(null);

      setExtractPhase(null);

      setAudioPct(0);

      return;

    }



    const key = `${file.path}:${previewAudioId}`;

    const gen = runGen;

    pipelineKeyRef.current = key;



    setAudioUrl(null);

    setAudioLimitSec(null);

    setAudioMode('extracting');

    setExtractPhase('quick');

    setAudioPct(0);



    const quick = await window.api.preview.extract(

      file.path,

      previewAudioId,

      file.durationSec,

      'quick'

    );

    if (pipelineGenRef.current !== gen || pipelineKeyRef.current !== key) {

      // #region agent log

      agentDebug('usePreview.ts:quick', 'pipeline_stale_after_quick', { gen, currentGen: pipelineGenRef.current }, 'H4');

      // #endregion

      return;

    }



    // #region agent log

    agentDebug(

      'usePreview.ts:quick',

      'quick_result',

      { ok: quick.ok, tier: quick.tier, error: quick.error, cached: quick.cached },

      'H2'

    );

    // #endregion



    if (!quick.ok || !quick.url) {

      if (pipelineGenRef.current !== gen || pipelineKeyRef.current !== key) return;

      setAudioMode('video');

      setExtractPhase(null);

      if (quick.error) onErrorRef.current?.(quick.error);

      return;

    }



    if (quick.tier === 'full') {

      setAudioUrl(quick.url);

      setAudioMode('full');

      setExtractPhase(null);

      setAudioPct(100);

      return;

    }



    const limit = quick.limitSec ?? PREVIEW_QUICK_SECONDS;

    setAudioUrl(quick.url);

    setAudioLimitSec(limit);

    setAudioMode('quick');

    setExtractPhase(null);



    setExtractPhase('full');

    setAudioPct(0);

    const full = await window.api.preview.extract(

      file.path,

      previewAudioId,

      file.durationSec,

      'full'

    );

    if (pipelineGenRef.current !== gen || pipelineKeyRef.current !== key) return;



    setExtractPhase(null);

    if (full.ok && full.url) {

      const t = Math.min(previewTRef.current, file.durationSec);

      setAudioUrl(full.url);

      setAudioLimitSec(null);

      setAudioMode('full');

      setPreviewT(t);

      previewTRef.current = t;

    } else if (!full.ok && full.error) {

      onErrorRef.current?.(full.error);

    }

  }, []);



  const requestAudioExtract = useCallback(() => {

    const gen = ++pipelineGenRef.current;

    void runExtractPipeline(gen);

  }, [runExtractPipeline]);



  useEffect(() => {

    if (!file) {

      setVideoUrl(null);

      setPreviewT(0);

      previewTRef.current = 0;

      return;

    }

    setVideoUrl(window.api.media.url(file.path));

    setPreviewT(0);

    previewTRef.current = 0;

  }, [file?.path]);



  useEffect(() => {

    pipelineEffectCountRef.current += 1;

    const gen = ++pipelineGenRef.current;

    // #region agent log

    agentDebug(

      'usePreview.ts:effect',

      'pipeline_effect_fired',

      {

        path: file?.path ?? null,

        previewAudioId,

        effectCount: pipelineEffectCountRef.current,

        gen,

      },

      'H1',

      'post-fix-v3'

    );

    // #endregion

    pipelineKeyRef.current = '';

    setAudioUrl(null);

    setAudioLimitSec(null);

    setExtractPhase(null);

    setAudioPct(0);

    if (!file || previewAudioId === null) {

      setAudioMode('video');

      return;

    }

    void runExtractPipeline(gen);

  }, [file?.path, previewAudioId, runExtractPipeline]);



  const clampTime = useCallback(

    (t: number): number => {

      if (!file) return t;

      const max = audioLimitSec != null ? audioLimitSec : file.durationSec;

      return Math.max(0, Math.min(max, t));

    },

    [file, audioLimitSec]

  );



  const setPreviewTime = useCallback(

    (t: number) => {

      const c = clampTime(t);

      setPreviewT(c);

      previewTRef.current = c;

    },

    [clampTime]

  );



  const resetOnFileChange = useCallback(() => {

    pipelineGenRef.current++;

    pipelineKeyRef.current = '';

    setPreviewT(0);

    previewTRef.current = 0;

    setAudioUrl(null);

    setAudioLimitSec(null);

    setAudioMode('video');

    setExtractPhase(null);

  }, []);



  const audioExtracting = audioMode === 'extracting' || extractPhase !== null;



  return {

    previewT,

    setPreviewT,

    setPreviewTime,

    videoUrl,

    audioUrl,

    audioPct,

    audioExtracting,

    extractPhase,

    audioMode,

    audioLimitSec,

    requestAudioExtract,

    resetOnFileChange,

    clampTime,

  };

}



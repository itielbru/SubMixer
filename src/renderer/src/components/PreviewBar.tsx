import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CueWarningThresholds, SrtCue } from '@shared/types';
import {
  findCueAtMediaTime,
  findCueIndexAtMediaTime,
  fileTimeFromMediaTime,
  mediaTimeForCueStart,
  transformCues,
} from '@shared/cue-sync';
import { fmtTimeMs } from '../lib/format';
import { useT } from '../hooks/useTranslation';
import { isRtlLang } from '../lib/rtl';
import { Timeline } from './Timeline';
import { VideoPreview, type VideoPreviewHandle, type SubOverlayStyle } from './VideoPreview';
import { CueEditor } from './CueEditor';
import { CueListView } from './CueListView';
import { PreviewToolsMenu } from './PreviewToolsMenu';
import { useKeyboardShortcuts, type ShortcutDef } from '../hooks/useKeyboardShortcuts';
import type { PreviewAudioMode } from '../hooks/usePreview';
import type { PreviewExtractPhase } from '@shared/preview';

interface Peaks {
  min: Float32Array;
  max: Float32Array;
  peaksPerSec: number;
  duration: number;
}

interface Props {
  durationSec: number;
  previewT: number;
  onPreviewT: (t: number) => void;
  videoUrl: string | null;
  /** Extracted AAC/M4A (set once ffmpeg finishes); null otherwise. */
  audioUrl: string | null;
  /** Live extraction progress in %. */
  audioPct: number;
  /** True while ffmpeg is running the audio extraction. */
  audioExtracting: boolean;
  extractPhase: PreviewExtractPhase | null;
  audioMode: PreviewAudioMode;
  audioLimitSec: number | null;
  /** Kick off extraction on demand (manual fallback). */
  onRequestAudioExtract: () => void;
  /** True if the last extraction attempt failed (shows Retry button). */
  extractFailed?: boolean;
  /** Surface audio playback failures to the parent (toast). */
  onAudioError?: (msg: string) => void;
  peaks: Peaks | null;
  peaksLoading: boolean;
  peaksPct: number;
  cues: SrtCue[];
  /** Language of the active external sub (for RTL detection). */
  cuesLang?: string;
  onUpdateCue: (idx: number, patch: Partial<SrtCue>) => void;
  onDeleteCue: (idx: number) => void;
  onInsertCue: (atTime: number) => number;
  onShiftCues: (deltaSec: number, indices: number[]) => void;
  onSplitCue?: (idx: number, mode: 'playhead' | 'newline') => void;
  onMergeCue?: (idx: number) => void;
  onOpenShortcuts?: () => void;
  onOpenFixErrors?: () => void;
  onOpenFindReplace?: () => void;
  onAdjustAllTimes?: () => void;
  onDuplicateCue?: () => void;
  onSelectedIdxChange?: (idx: number) => void;
  warnThresholds: CueWarningThresholds;
  subOffset: number;
  subSpeed: number;
  subStyle: SubOverlayStyle;
  /** Custom key overrides; absent actions use the built-in default key. */
  keybindings?: Partial<Record<string, string>>;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5];

export function PreviewBar({
  durationSec,
  previewT,
  onPreviewT,
  videoUrl,
  audioUrl,
  audioPct,
  audioExtracting,
  extractPhase,
  audioMode,
  audioLimitSec,
  onRequestAudioExtract,
  extractFailed,
  onAudioError,
  peaks,
  peaksLoading,
  peaksPct,
  cues,
  cuesLang,
  onUpdateCue,
  onDeleteCue,
  onInsertCue,
  onShiftCues,
  onSplitCue,
  onMergeCue,
  onOpenShortcuts,
  onOpenFixErrors,
  onOpenFindReplace,
  onAdjustAllTimes,
  onDuplicateCue,
  onSelectedIdxChange,
  warnThresholds,
  subOffset,
  subSpeed,
  subStyle,
  keybindings = {},
}: Props) {
  const { t } = useT();
  const syncOpts = useMemo(() => ({ offset: subOffset, speed: subSpeed }), [subOffset, subSpeed]);
  const displayCues = useMemo(
    () => (subOffset === 0 && subSpeed === 1 ? cues : transformCues(cues, syncOpts)),
    [cues, syncOpts, subOffset, subSpeed],
  );
  const handleTimelineUpdateCue = useCallback(
    (idx: number, patch: Partial<SrtCue>) => {
      if (subOffset === 0 && subSpeed === 1) {
        onUpdateCue(idx, patch);
        return;
      }
      const next: Partial<SrtCue> = { ...patch };
      if (patch.start !== undefined) {
        next.start = Math.max(0, fileTimeFromMediaTime(patch.start, syncOpts));
      }
      if (patch.end !== undefined) {
        next.end = Math.max(0, fileTimeFromMediaTime(patch.end, syncOpts));
      }
      onUpdateCue(idx, next);
    },
    [onUpdateCue, syncOpts, subOffset, subSpeed],
  );
  const [selectedIdx, setSelectedIdx] = useState(-1);

  useEffect(() => {
    onSelectedIdxChange?.(selectedIdx);
  }, [selectedIdx, onSelectedIdxChange]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<VideoPreviewHandle | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loopOn, setLoopOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const reportError = (msg: string): void => onAudioError?.(msg);

  const tryPlay = (a: HTMLAudioElement, seekTo: number): void => {
    const run = (): void => {
      try {
        a.currentTime = seekTo;
      } catch {
        /* */
      }
      void a.play().catch((err) => {
        const e = err as Error;
        // Benign cases that fire during normal source swaps (e.g. the quick→full
        // preview transition): a newer load/pause aborts a pending play, or play
        // is attempted a tick before the freshly-set source is ready. These are
        // not user-facing errors — genuine extraction failures are surfaced
        // separately via the preview pipeline's onError.
        if (e.name === 'AbortError') return;
        if (e.name === 'NotSupportedError' && a.readyState < 3) return;
        reportError(`audio.play(): ${e.name} — ${e.message}`);
      });
    };
    // Only play once the element can actually start; otherwise a freshly
    // assigned src rejects play() with NotSupportedError ("no supported sources").
    if (a.readyState >= 3) {
      run();
    } else {
      const onReady = (): void => {
        a.removeEventListener('canplay', onReady);
        run();
      };
      a.addEventListener('canplay', onReady, { once: true });
    }
  };

  useEffect(() => {
    if (selectedIdx >= cues.length) setSelectedIdx(-1);
  }, [cues.length, selectedIdx]);

  const externalAudio = audioMode === 'quick' || audioMode === 'full';
  const vpAudioMode: 'video' | 'extracting' | 'external' = externalAudio
    ? 'external'
    : audioExtracting
      ? 'extracting'
      : 'video';

  // Apply playbackRate to both elements.
  useEffect(() => {
    const v = videoRef.current?.el;
    if (v) v.playbackRate = playbackRate;
    const a = audioRef.current;
    if (a) a.playbackRate = playbackRate;
  }, [playbackRate, audioUrl, videoUrl]);

  useEffect(() => {
    if (!audioUrl) return;
    const a = audioRef.current;
    if (!a) return;
    const syncTime = (): void => {
      try {
        a.currentTime = previewT;
      } catch {
        /* */
      }
    };
    a.addEventListener('loadedmetadata', syncTime);
    if (a.readyState >= 1) syncTime();
    const v = videoRef.current?.el;
    if (v && !v.paused) tryPlay(a, v.currentTime);
    return () => a.removeEventListener('loadedmetadata', syncTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    if (!externalAudio) return;
    const a = audioRef.current;
    if (!a) return;
    if (Math.abs(a.currentTime - previewT) > 0.25) {
      try {
        a.currentTime = previewT;
      } catch {
        /* */
      }
    }
  }, [previewT, externalAudio]);

  // External audio is the timing master (video may fail to decode or drift).
  useEffect(() => {
    if (!externalAudio || !audioUrl) return;
    const a = audioRef.current;
    if (!a) return;
    const onTick = (): void => {
      const t = a.currentTime;
      onPreviewT(t);
      const v = videoRef.current?.el;
      if (v && Math.abs(v.currentTime - t) > 0.2) {
        try {
          v.currentTime = t;
        } catch {
          /* */
        }
      }
    };
    a.addEventListener('timeupdate', onTick);
    return () => a.removeEventListener('timeupdate', onTick);
  }, [externalAudio, audioUrl, onPreviewT]);

  const handleVideoTimeTick = useCallback(
    (t: number) => {
      if (!externalAudio) onPreviewT(t);
    },
    [externalAudio, onPreviewT],
  );

  // Authoritative seek: set state AND imperatively set both media elements in
  // the same synchronous tick. Relying on the previewT effect alone races with
  // the playing audio's timeupdate, which can clobber the jump and leave the
  // subtitle overlay out of sync.
  const handleSeek = useCallback(
    (t: number) => {
      const maxT = audioLimitSec != null ? Math.min(durationSec, audioLimitSec) : durationSec;
      const ct = Math.max(0, Math.min(maxT, t));
      onPreviewT(ct);
      const v = videoRef.current?.el;
      if (v) {
        try {
          v.currentTime = ct;
        } catch {
          /* */
        }
      }
      if (externalAudio) {
        const a = audioRef.current;
        if (a) {
          try {
            a.currentTime = ct;
          } catch {
            /* */
          }
        }
      }
    },
    [onPreviewT, externalAudio, audioLimitSec, durationSec],
  );

  // Loop the selected cue: when the playhead crosses the cue's end,
  // jump back to its start.
  useEffect(() => {
    if (!loopOn || selectedIdx < 0) return;
    const cue = cues[selectedIdx];
    if (!cue) return;
    const mediaEnd = mediaTimeForCueStart(cue.end, syncOpts);
    const mediaStart = mediaTimeForCueStart(cue.start, syncOpts);
    if (previewT >= mediaEnd - 0.01) {
      const v = videoRef.current?.el;
      if (v) {
        try {
          v.currentTime = mediaStart;
        } catch {
          /* */
        }
      }
      onPreviewT(mediaStart);
    }
  }, [previewT, loopOn, selectedIdx, cues, onPreviewT, syncOpts]);

  const handleUserToggle = (willPlay: boolean): void => {
    if (!externalAudio) return;
    const a = audioRef.current;
    if (!a) return;
    if (willPlay) tryPlay(a, previewT);
    else a.pause();
  };

  const handlePlayingChange = (playing: boolean): void => {
    setIsPlaying(playing);
    if (!externalAudio) return;
    const a = audioRef.current;
    if (!a) return;
    if (playing && a.paused) tryPlay(a, previewT);
    else if (!playing && !a.paused) a.pause();
  };

  const onAudioElError = (): void => {
    const a = audioRef.current;
    if (!a || !a.error) return;
    const codeName =
      (
        {
          1: 'MEDIA_ERR_ABORTED',
          2: 'MEDIA_ERR_NETWORK',
          3: 'MEDIA_ERR_DECODE',
          4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
        } as Record<number, string>
      )[a.error.code] || `code=${a.error.code}`;
    reportError(`audio element: ${codeName}`);
  };

  // ── shortcuts ─────────────────────────────────────────────────────────
  const togglePlay = (): void => {
    const v = videoRef.current?.el;
    if (!v) return;
    if (v.paused) void v.play().catch(() => null);
    else v.pause();
  };
  const seekBy = (delta: number): void => {
    const maxT = audioLimitSec != null ? Math.min(durationSec, audioLimitSec) : durationSec;
    const t = Math.max(0, Math.min(maxT, previewT + delta));
    const v = videoRef.current?.el;
    if (v) {
      try {
        v.currentTime = t;
      } catch {
        /* */
      }
    }
    onPreviewT(t);
    if (externalAudio) {
      const a = audioRef.current;
      if (a) {
        try {
          a.currentTime = t;
        } catch {
          /* */
        }
      }
    }
  };
  const stepCue = (dir: 1 | -1): void => {
    if (cues.length === 0) return;
    let idx = selectedIdx;
    if (idx < 0) {
      const at = findCueIndexAtMediaTime(cues, previewT, syncOpts);
      idx = at >= 0 ? at : dir > 0 ? -1 : cues.length;
    }
    const next = Math.max(0, Math.min(cues.length - 1, idx + dir));
    setSelectedIdx(next);
    const cue = cues[next];
    if (cue) {
      const mediaT = mediaTimeForCueStart(cue.start, syncOpts);
      const v = videoRef.current?.el;
      if (v) {
        try {
          v.currentTime = mediaT;
        } catch {
          /* */
        }
      }
      onPreviewT(mediaT);
      if (externalAudio) {
        const a = audioRef.current;
        if (a) {
          try {
            a.currentTime = mediaT;
          } catch {
            /* */
          }
        }
      }
    }
  };
  const setStartHere = (): void => {
    if (selectedIdx < 0) return;
    const cue = cues[selectedIdx];
    if (!cue) return;
    const fileT = fileTimeFromMediaTime(previewT, syncOpts);
    const newStart = Math.min(fileT, cue.end - 0.05);
    onUpdateCue(selectedIdx, { start: Math.max(0, newStart) });
  };
  const setEndHere = (): void => {
    if (selectedIdx < 0) return;
    const cue = cues[selectedIdx];
    if (!cue) return;
    const fileT = fileTimeFromMediaTime(previewT, syncOpts);
    const newEnd = Math.max(fileT, cue.start + 0.05);
    onUpdateCue(selectedIdx, { end: newEnd });
  };
  const insertHere = (): void => {
    const newIdx = onInsertCue(fileTimeFromMediaTime(previewT, syncOpts));
    if (newIdx >= 0) setSelectedIdx(newIdx);
  };
  const deleteHere = (): void => {
    if (selectedIdx < 0) return;
    onDeleteCue(selectedIdx);
  };

  const shortcuts: ShortcutDef[] = useMemo(
    () => [
      { key: 'space', label: t('shortcut_play'), handler: togglePlay },
      { key: 'arrowleft', label: t('shortcut_prev_cue'), handler: () => stepCue(-1) },
      { key: 'arrowright', label: t('shortcut_next_cue'), handler: () => stepCue(1) },
      {
        key: 'arrowleft',
        shift: true,
        label: t('shortcut_seek_100ms_back'),
        handler: () => seekBy(-0.1),
      },
      {
        key: 'arrowright',
        shift: true,
        label: t('shortcut_seek_100ms_fwd'),
        handler: () => seekBy(0.1),
      },
      {
        key: 'arrowleft',
        alt: true,
        label: t('shortcut_seek_10ms_back'),
        handler: () => seekBy(-0.01),
      },
      {
        key: 'arrowright',
        alt: true,
        label: t('shortcut_seek_10ms_fwd'),
        handler: () => seekBy(0.01),
      },
      {
        key: 'arrowleft',
        ctrl: true,
        label: t('shortcut_seek_1s_back'),
        handler: () => seekBy(-1),
      },
      { key: 'arrowright', ctrl: true, label: t('shortcut_seek_1s_fwd'), handler: () => seekBy(1) },
      {
        key: keybindings['set_start'] ?? 'f11',
        label: t('shortcut_set_start'),
        handler: setStartHere,
      },
      {
        key: keybindings['set_end'] ?? 'f12',
        label: t('shortcut_set_end'),
        handler: setEndHere,
      },
      {
        key: keybindings['insert_cue'] ?? 'insert',
        label: t('shortcut_insert_cue'),
        handler: insertHere,
      },
      {
        key: keybindings['delete_cue'] ?? 'delete',
        label: t('shortcut_delete'),
        handler: deleteHere,
      },
      {
        key: keybindings['loop'] ?? 'l',
        ctrl: !keybindings['loop'],
        label: t('shortcut_loop'),
        handler: () => setLoopOn((v) => !v),
      },
      { key: '?', shift: true, label: t('shortcut_help'), handler: () => onOpenShortcuts?.() },
      { key: '/', label: t('shortcut_help'), handler: () => onOpenShortcuts?.() },
    ],
    // The handlers close over previewT/selectedIdx/cues — listing them
    // explicitly keeps the listener fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewT, selectedIdx, cues, durationSec, onOpenShortcuts, t, keybindings],
  );
  useKeyboardShortcuts(shortcuts);

  const activeCue = findCueAtMediaTime(cues, previewT, syncOpts);
  const currentCueIdx = activeCue ? cues.indexOf(activeCue) : -1;
  const currentCue = activeCue;
  const fileCueAtPlayhead =
    subOffset === 0 && subSpeed === 1
      ? currentCue
      : findCueAtMediaTime(cues, previewT, { offset: 0, speed: 1 });
  const selected = selectedIdx >= 0 ? cues[selectedIdx] : undefined;
  const overlayText = activeCue?.text ?? '';
  const overlayRtl = isRtlLang(cuesLang);

  return (
    <div className="preview-bar">
      <audio ref={audioRef} src={audioUrl || undefined} preload="auto" onError={onAudioElError} />

      <div className="pv-head">
        <div className="pv-title">{t('preview_editor_title')}</div>
        <div className="pv-actions">
          <div className="pv-speeds" title={t('playback_rate')}>
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`speed-btn mono ${playbackRate === s ? 'on' : ''}`}
                onClick={() => setPlaybackRate(s)}
              >
                {s}x
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`speed-btn ${loopOn ? 'on' : ''}`}
            onClick={() => setLoopOn((v) => !v)}
            disabled={selectedIdx < 0}
            title={t('loop_cue_tip')}
          >
            ↻ {t('loop_label')}
          </button>
          {onOpenFindReplace && onAdjustAllTimes && onDuplicateCue && (
            <PreviewToolsMenu
              disabled={cues.length === 0}
              canDelete={selectedIdx >= 0}
              onFindReplace={() => onOpenFindReplace()}
              onAdjustAllTimes={() => onAdjustAllTimes()}
              onDuplicate={() => onDuplicateCue()}
              onDelete={() => selectedIdx >= 0 && onDeleteCue(selectedIdx)}
            />
          )}
          {extractFailed && (
            <button
              type="button"
              className="speed-btn warn"
              onClick={onRequestAudioExtract}
              title={t('retry_extract_tip')}
            >
              ↺ {t('retry_label')}
            </button>
          )}
          <button
            type="button"
            className="speed-btn"
            onClick={() => onOpenShortcuts?.()}
            title={t('shortcuts_tip')}
          >
            ?
          </button>
          <div className="pv-info mono">
            {peaksLoading
              ? `${t('peaks_loading')} ${Math.round(peaksPct)}%`
              : cues.length > 0
                ? `${cues.length} ${t('cues_count')} · ${
                    selected ? `${t('selected_cue')} #${selectedIdx + 1}` : t('no_cue_selected')
                  }`
                : t('no_srt_loaded')}
          </div>
        </div>
      </div>

      <VideoPreview
        ref={videoRef}
        src={videoUrl}
        durationSec={durationSec}
        currentT={previewT}
        onTimeTick={handleVideoTimeTick}
        onPlayingChange={handlePlayingChange}
        onUserToggle={handleUserToggle}
        onForceExtract={onRequestAudioExtract}
        externalAudio={externalAudio}
        audioMode={vpAudioMode}
        extractPhase={extractPhase}
        previewAudioMode={audioMode}
        audioLimitSec={audioLimitSec}
        audioPct={audioPct}
        overlayText={overlayText}
        overlayRtl={overlayRtl}
        subStyle={subStyle}
      />

      <Timeline
        durationSec={durationSec}
        cues={displayCues}
        currentT={previewT}
        onSeek={handleSeek}
        onUpdateCue={handleTimelineUpdateCue}
        selectedIdx={selectedIdx}
        onSelect={setSelectedIdx}
        onDelete={onDeleteCue}
        peaks={peaks}
        loading={peaksLoading}
        loadingPct={peaksPct}
        volumeSnap={!!peaks}
        warnThresholds={warnThresholds}
        playing={isPlaying}
      />

      {selectedIdx >= 0 && cues[selectedIdx] && (
        <CueEditor
          cues={cues}
          selectedIdx={selectedIdx}
          warnThresholds={warnThresholds}
          onSelect={setSelectedIdx}
          onUpdateCue={onUpdateCue}
          onDeleteCue={onDeleteCue}
          onSeek={handleSeek}
          rtl={isRtlLang(cuesLang)}
        />
      )}

      {cues.length > 0 && (
        <CueListView
          cues={cues}
          selectedIdx={selectedIdx}
          playheadIdx={currentCueIdx}
          lang={cuesLang}
          warnThresholds={warnThresholds}
          videoDurationSec={durationSec}
          onSelect={setSelectedIdx}
          onUpdateCue={onUpdateCue}
          onDeleteCue={onDeleteCue}
          onShiftSelection={onShiftCues}
          onSeek={handleSeek}
          onSplitCue={onSplitCue}
          onMergeCue={onMergeCue}
          onOpenFixErrors={onOpenFixErrors}
        />
      )}

      <div className="pv-cue">
        <div className="pv-cue-row">
          <span className="pv-cue-label">{selected ? t('selected_cue') : t('synced')}</span>
          <span className="pv-cue-time mono">
            {selected
              ? `${fmtTimeMs(selected.start)} → ${fmtTimeMs(selected.end)} · ${(
                  selected.end - selected.start
                ).toFixed(2)}s`
              : currentCue
                ? `${fmtTimeMs(currentCue.start)} → ${fmtTimeMs(currentCue.end)}`
                : '—'}
          </span>
          <span className="pv-cue-text">
            {selected ? selected.text : currentCue ? currentCue.text : t('no_cue_at_point')}
          </span>
        </div>
        {!selected && (subOffset !== 0 || subSpeed !== 1) && fileCueAtPlayhead && (
          <div className="pv-cue-row adj">
            <span className="pv-cue-label">{t('original')}</span>
            <span className="pv-cue-time mono">
              {`${fmtTimeMs(fileCueAtPlayhead.start)} → ${fmtTimeMs(fileCueAtPlayhead.end)}`}
            </span>
            <span className="pv-cue-text">{fileCueAtPlayhead.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

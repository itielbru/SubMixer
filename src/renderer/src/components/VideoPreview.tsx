import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Ico, I } from './ui/Icons';
import { fmtTime } from '../lib/format';
import { useT } from '../hooks/useTranslation';
import { renderCueText } from '../lib/sub-format';
import type { PreviewAudioMode } from '../hooks/usePreview';
import type { PreviewExtractPhase } from '@shared/preview';
import type { SubStyleMode } from '@shared/types';

export interface SubOverlayStyle {
  fontScale: number;
  color: string;
  style: SubStyleMode;
  position: 'bottom' | 'top';
}

interface Props {
  src: string | null;
  durationSec: number;
  currentT: number;
  onTimeTick: (t: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  /** Called synchronously from the user click — lets the parent start a
   *  paired audio element in the same gesture. */
  onUserToggle?: (willPlay: boolean) => void;
  /** Manual fallback — user clicks the "force extract" button if the
   *  codec detection in App.tsx didn't trigger automatically. */
  onForceExtract?: () => void;
  /** When true, the video element is muted and audio comes from the
   *  parent's <audio> element. */
  externalAudio: boolean;
  /** Status of the optional extracted-audio fallback. */
  audioMode: 'video' | 'extracting' | 'external';
  extractPhase?: PreviewExtractPhase | null;
  previewAudioMode?: PreviewAudioMode;
  audioLimitSec?: number | null;
  audioPct: number;
  overlayText?: string;
  overlayRtl?: boolean;
  subStyle?: SubOverlayStyle;
}

export interface VideoPreviewHandle {
  play: () => Promise<void>;
  pause: () => void;
  el: HTMLVideoElement | null;
}

const DEFAULT_SUB_STYLE: SubOverlayStyle = {
  fontScale: 1,
  color: '#ffffff',
  style: 'outline',
  position: 'bottom',
};

export const VideoPreview = forwardRef<VideoPreviewHandle, Props>(function VideoPreview(
  {
    src,
    durationSec,
    currentT,
    onTimeTick,
    onPlayingChange,
    onUserToggle,
    onForceExtract,
    externalAudio,
    audioMode,
    extractPhase,
    previewAudioMode,
    audioLimitSec,
    audioPct,
    overlayText = '',
    overlayRtl = false,
    subStyle = DEFAULT_SUB_STYLE,
  },
  fwRef
) {
  const { t } = useT();
  const ref = useRef<HTMLVideoElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isFs, setIsFs] = useState(false);

  useImperativeHandle(fwRef, () => ({
    play: async () => {
      try {
        await ref.current?.play();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    pause: () => ref.current?.pause(),
    el: ref.current,
  }));

  useEffect(() => {
    setError(null);
    setReady(false);
    setPlaying(false);
  }, [src]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !ready) return;
    if (Math.abs(v.currentTime - currentT) > 0.25) {
      try {
        v.currentTime = currentT;
      } catch {
        /* */
      }
    }
  }, [currentT, ready]);

  // Mirror the externalAudio flag onto the video element's muted prop.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = externalAudio;
  }, [externalAudio]);

  // Track fullscreen state to swap the toggle icon.
  useEffect(() => {
    const onFsChange = (): void => {
      setIsFs(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => null);
    } else {
      void rootRef.current?.requestFullscreen().catch((err) => setError((err as Error).message));
    }
  };

  const onPlayButton = () => {
    const v = ref.current;
    if (!v) return;
    const willPlay = v.paused;
    onUserToggle?.(willPlay);
    if (willPlay) {
      void v.play().catch((err) => setError((err as Error).message));
    } else {
      v.pause();
    }
  };

  const audioStatus = (() => {
    if (audioMode === 'extracting') {
      const label =
        extractPhase === 'quick'
          ? t('audio_extracting_quick')
          : extractPhase === 'full'
            ? t('audio_extracting_full')
            : t('audio_extracting');
      return (
        <span className="vp-audio mono">
          {label} {Math.round(audioPct)}%
        </span>
      );
    }
    if (previewAudioMode === 'quick' && audioLimitSec) {
      return (
        <span className="vp-audio ok mono">
          {t('audio_quick_playing')} {Math.round(audioLimitSec)}s
          {extractPhase === 'full' ? ` · ${t('audio_extracting_full')} ${Math.round(audioPct)}%` : ''}
        </span>
      );
    }
    if (audioMode === 'external') {
      return <span className="vp-audio ok mono">{t('audio_external_ok')}</span>;
    }
    return <span className="vp-audio mono faint">{t('audio_from_video')}</span>;
  })();

  return (
    <div className="vp" ref={rootRef}>
      <div className="vp-stage">
        {src && (
          <video
            ref={ref}
            src={src}
            preload="auto"
            playsInline
            onClick={onPlayButton}
            onTimeUpdate={(e) => onTimeTick(e.currentTarget.currentTime)}
            onPlay={() => {
              setPlaying(true);
              onPlayingChange?.(true);
            }}
            onPause={() => {
              setPlaying(false);
              onPlayingChange?.(false);
            }}
            onLoadedMetadata={() => setReady(true)}
            onError={() => setError(t('video_codec_error'))}
          />
        )}
        {!src && <div className="vp-empty">{t('no_file')}</div>}
        {overlayText && (
          <div
            className={`vp-sub-overlay sub-${subStyle.style} sub-pos-${subStyle.position}`}
            dir={overlayRtl ? 'rtl' : 'ltr'}
            style={
              {
                color: subStyle.color,
                '--sub-scale': String(subStyle.fontScale),
              } as React.CSSProperties
            }
          >
            {renderCueText(overlayText)}
          </div>
        )}
        {error && <div className="vp-error">{error}</div>}
        {src && (
          <button
            className="vp-fs-btn"
            type="button"
            onClick={toggleFullscreen}
            title={isFs ? t('exit_fullscreen') : t('fullscreen')}
          >
            <Ico d={isFs ? I.compress : I.expand} size={15} />
          </button>
        )}
      </div>

      <div className="vp-controls">
        <button
          className="vp-btn primary lg"
          type="button"
          onClick={onPlayButton}
          disabled={!src || !!error}
          title={playing ? t('pause') : t('play')}
        >
          <Ico d={playing ? I.pause : I.play} size={16} />
        </button>
        <div className="vp-time mono">
          <span className="vp-time-now">{fmtTime(currentT)}</span>
          <span className="vp-time-tot faint">/ {fmtTime(durationSec)}</span>
        </div>
        <div className="vp-audio-status">{audioStatus}</div>
        {(audioMode === 'video' || previewAudioMode === 'quick') && onForceExtract && (
          <button
            className="vp-btn small"
            type="button"
            onClick={onForceExtract}
            title={t('force_extract_audio_tip')}
          >
            {t('force_extract_audio')}
          </button>
        )}
      </div>
    </div>
  );
});

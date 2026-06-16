// Peaks model used by the timeline. Each bin stores both the min (negative
// trough) and max (positive crest) amplitude in the source PCM, in the
// range [-1, 1]. Drawing both yields a "Subtitle Edit"-style symmetric
// waveform rather than a one-sided envelope.

export interface PeaksResult {
  min: Float32Array;
  max: Float32Array;
  /** Bins per second of audio */
  peaksPerSec: number;
  /** Duration in seconds */
  duration: number;
}

const PEAKS_PER_SEC = 100;

let sharedCtx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

/** Browser-side fallback: decode an audio URL via WebAudio. Used only when
 *  the main-process PCM extraction path isn't available (e.g. legacy
 *  audio-only previews). Otherwise prefer `window.api.peaks.get`. */
export async function decodePeaks(
  url: string,
  onProgress?: (pct: number) => void,
): Promise<PeaksResult> {
  onProgress?.(5);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  onProgress?.(35);
  const audio = await getCtx().decodeAudioData(buf.slice(0));
  onProgress?.(65);

  const channels = audio.numberOfChannels;
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(audio.getChannelData(c));
  const samplesPerBin = Math.max(1, Math.floor(audio.sampleRate / PEAKS_PER_SEC));
  const total = Math.max(1, Math.floor(audio.length / samplesPerBin));
  const min = new Float32Array(total);
  const max = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const start = i * samplesPerBin;
    const end = Math.min(start + samplesPerBin, audio.length);
    let mn = 1,
      mx = -1;
    for (let s = start; s < end; s++) {
      let v = 0;
      for (let c = 0; c < channels; c++) v += data[c][s];
      v /= channels;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    min[i] = mn;
    max[i] = mx;
  }
  onProgress?.(100);
  return { min, max, peaksPerSec: PEAKS_PER_SEC, duration: audio.duration };
}

/** Snap a time to the nearest volume peak within a window (for timeline drag). */
export function nearestVolumePeakTime(
  t: number,
  peaks: { min: Float32Array; max: Float32Array; peaksPerSec: number },
  windowSec = 0.05,
): number {
  const pps = peaks.peaksPerSec;
  const center = Math.round(t * pps);
  const radius = Math.max(1, Math.round(windowSec * pps));
  let bestIdx = center;
  let bestAmp = -1;
  for (let i = center - radius; i <= center + radius; i++) {
    if (i < 0 || i >= peaks.max.length) continue;
    const amp = Math.max(Math.abs(peaks.min[i]), Math.abs(peaks.max[i]));
    if (amp > bestAmp) {
      bestAmp = amp;
      bestIdx = i;
    }
  }
  return bestIdx / pps;
}

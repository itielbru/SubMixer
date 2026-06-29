// Pure assembly of an ExportPlan from the current editor state.
//
// Extracted from the renderer (App.tsx) so the logic is unit-testable in
// isolation, with no React or Electron dependencies. The renderer passes the
// raw pieces of state in; this module decides video/audio/embedded/external
// track membership, the burn-in target, and the output container.

import type { ExportPlan, ExternalSub, MediaFile, Track, VideoEncodeOptions } from './types';

export interface BuildPlanInput {
  file: MediaFile | null;
  tracks: Track[];
  extSubs: ExternalSub[];
  /** Full output path (folder + filename). */
  outPath: string;
  /** Output filename including extension; the stem becomes the metadata title. */
  outName: string;
  /** Container chosen in the UI, e.g. "MKV" or "mp4" (case-insensitive). */
  container: string;
  /** When true, burn the active external sub into the video (re-encode). */
  burnInSubs: boolean;
  /** Id of the currently active external subtitle, or null. */
  activeSubId: string | null;
  /** Video encode options applied only when a burn-in re-encode happens. */
  videoEncode?: VideoEncodeOptions;
}

/**
 * Build an {@link ExportPlan} from editor state, or `null` when no file is
 * loaded. Behaviour mirrors the previous inline `buildPlan` in App.tsx:
 *
 * - Video track = first kept video stream, else first video stream.
 * - Audio / embedded-sub tracks = every kept stream of that kind.
 * - External subs are passed through with their offset/speed/encoding.
 * - Burn-in index is set only when `burnInSubs` is on and an external sub is
 *   active (its position within `extSubs`).
 * - Container is `mp4` only when explicitly chosen, otherwise `mkv`.
 */
export function buildExportPlan(input: BuildPlanInput): ExportPlan | null {
  const { file, tracks, extSubs, outPath, outName, container, burnInSubs, activeSubId, videoEncode } =
    input;
  if (!file) return null;

  const v = tracks.find((t) => t.kind === 'V' && t.keep) || tracks.find((t) => t.kind === 'V');
  const videoTrackId = v?.id ?? null;

  const audioTracks = tracks
    .filter((t) => t.kind === 'A' && t.keep)
    .map((t) => ({ id: t.id, lang: t.lang, def: t.def, forced: t.forced, codecName: t.codecName }));

  const embeddedSubs = tracks
    .filter((t) => t.kind === 'S' && t.keep)
    .map((t) => ({ id: t.id, lang: t.lang, def: t.def, forced: t.forced, codecName: t.codecName }));

  const externalSubs = extSubs.map((s) => ({
    path: s.path,
    lang: s.lang,
    def: s.def,
    forced: s.forced,
    offset: s.offset,
    speed: s.speed,
    trackName: s.trackName,
    encoding: s.encoding,
  }));

  const activeExtIdx = extSubs.findIndex((s) => s.id === activeSubId);
  const burnInSubIndex = burnInSubs && activeExtIdx >= 0 ? activeExtIdx : null;

  return {
    inputFile: file.path,
    externalSubs,
    videoTrackId,
    audioTracks,
    embeddedSubs,
    outputPath: outPath,
    metadataTitle: outName.replace(/\.[^.]+$/, ''),
    container: container.toLowerCase() === 'mp4' ? 'mp4' : 'mkv',
    burnInSubIndex,
    // Only attach encode options when we'll actually burn in (and thus re-encode).
    videoEncode: burnInSubIndex !== null ? videoEncode : undefined,
  };
}

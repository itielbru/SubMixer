import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppSettings,
  CueWarningThresholds,
  ExportPlan,
  ExternalSub,
  MediaFile,
  ProjectData,
  SrtCue,
  Track,
} from '@shared/types';
import { fileTimeFromMediaTime, mediaTimeForCueStart } from '@shared/cue-sync';
import { TopBar } from './components/TopBar';
import { SourcePanel } from './components/SourcePanel';
import { ContentDetails } from './components/ContentDetails';
import { TracksList, type Filter } from './components/TracksList';
import { PreviewBar } from './components/PreviewBar';
import type { SubOverlayStyle } from './components/VideoPreview';
import { SubsDrawer } from './components/SubsDrawer';
import { BottomBar } from './components/BottomBar';
import { OpenDialog } from './components/modals/OpenDialog';
import { HistoryModal } from './components/modals/HistoryModal';
import { FFmpegCommandModal } from './components/modals/FFmpegCommand';
import { SettingsModal } from './components/modals/Settings';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { VisualSyncModal } from './components/modals/VisualSyncModal';
import { AdjustAllTimesModal } from './components/modals/AdjustAllTimesModal';
import { FixCommonErrorsModal } from './components/modals/FixCommonErrorsModal';
import { FindReplaceModal } from './components/modals/FindReplaceModal';
import { ExportConfirmModal } from './components/modals/ExportConfirmModal';
import { BatchQueueModal, type BatchItem } from './components/modals/BatchQueueModal';
import { DiagnosticsModal } from './components/modals/DiagnosticsModal';
import { WhatsNewModal } from './components/modals/WhatsNewModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { visibleLen } from './lib/cue-warnings';
import { useToasts } from './hooks/useToasts';
import { useSettings } from './hooks/useSettings';
import { useExport } from './hooks/useExport';
import { usePreview } from './hooks/usePreview';
import { joinPath } from './lib/path';
import { showNotification } from './lib/notify';
import { I18nProvider, useT } from './hooks/useTranslation';

interface LogLine {
  time: string;
  level: 'info' | 'ok' | 'warn' | 'err';
  msg: string;
}

function cloneTracks(t: Track[]): Track[] {
  return t.map((x) => ({ ...x }));
}

function AppContent({
  settings,
  setOne,
}: {
  settings: AppSettings;
  setOne: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}) {
  const { t } = useT();
  const [toasts, toast] = useToasts();
  const [logs, setLogs] = useState<LogLine[]>([]);
  const pushLog = useCallback((msg: string, level: LogLine['level'] = 'info') => {
    const time = new Date().toTimeString().slice(0, 8);
    setLogs((l) => [...l, { time, level, msg }].slice(-400));
  }, []);

  const onExportLog = useCallback(
    (line: string) => {
      pushLog(line, 'info');
    },
    [pushLog],
  );

  const {
    exporting,
    progress,
    eta: exportEta,
    start: runExportJob,
    cancel: cancelExportJob,
    runBatch,
  } = useExport(onExportLog);

  const [isWin, setIsWin] = useState(true);
  const [appVer, setAppVer] = useState('');
  const [ffLine, setFfLine] = useState('');
  const [ffmpegOk, setFfmpegOk] = useState(true);

  const [file, setFile] = useState<MediaFile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [extSubs, setExtSubs] = useState<ExternalSub[]>([]);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [cuesBySubId, setCuesBySubId] = useState<Record<string, SrtCue[]>>({});
  const [editedSubIds, setEditedSubIds] = useState<Set<string>>(() => new Set());
  const cues: SrtCue[] = activeSubId ? (cuesBySubId[activeSubId] ?? []) : [];

  const [contentType, setContentType] = useState<'movie' | 'series'>('movie');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [season, setSeason] = useState('01');
  const [episode, setEpisode] = useState('01');
  const [container, setContainer] = useState('MKV');
  const [destFolder, setDestFolder] = useState('');
  const destInited = useRef(false);
  const [overrideName, setOverrideName] = useState(false);
  const [customName, setCustomName] = useState('');

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [centerTab, setCenterTab] = useState<'tracks' | 'preview'>('tracks');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewAudioId, setPreviewAudioId] = useState<number | null>(null);

  const [peaks, setPeaks] = useState<{
    min: Float32Array;
    max: Float32Array;
    peaksPerSec: number;
    duration: number;
  } | null>(null);
  const [peaksLoading, setPeaksLoading] = useState(false);
  const [peaksPct, setPeaksPct] = useState(0);

  const onPreviewError = useCallback(
    (msg?: string) => toast(msg || t('preview_error'), 'err'),
    [toast, t],
  );

  const {
    previewT,
    setPreviewTime,
    videoUrl,
    audioUrl,
    audioPct,
    audioExtracting,
    extractPhase,
    audioMode,
    audioLimitSec,
    extractFailed,
    requestAudioExtract,
    resetOnFileChange,
  } = usePreview(file, previewAudioId, onPreviewError);

  const [history, setHistory] = useState<import('@shared/types').ExportRecord[]>([]);

  const [showOpen, setShowOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showVisualSync, setShowVisualSync] = useState(false);
  const [showAdjustAll, setShowAdjustAll] = useState(false);
  const [showFixErrors, setShowFixErrors] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [exportConfirm, setExportConfirm] = useState<
    'mux' | 'overwrite' | { kind: 'srt'; sub: ExternalSub } | null
  >(null);
  const [overwriteFileInfo, setOverwriteFileInfo] = useState<{
    size: number;
    mtimeMs: number;
  } | null>(null);
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [showBatchQueue, setShowBatchQueue] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [whatsNewVersion, setWhatsNewVersion] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [autosaveOffer, setAutosaveOffer] = useState<ProjectData | null>(null);
  const [previewSelectedIdx, setPreviewSelectedIdx] = useState(-1);
  const [cmdStr, setCmdStr] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [update, setUpdate] = useState<{
    status: 'available' | 'downloading' | 'ready';
    version: string;
    percent?: number;
  } | null>(null);

  // ── Unified undo/redo: track toggles + cue edits, in one chronological stack ─
  type HistoryEntry =
    | { kind: 'tracks'; tracks: Track[] }
    | { kind: 'cues'; subId: string; cues: SrtCue[] };
  const HISTORY_LIMIT = 100;
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  // Coalesces a run of identical edits (e.g. dragging one cue) into one entry.
  const coalesceKey = useRef<string | null>(null);

  // Fresh-state mirrors so the global key handler (stable deps) reads current state.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const cuesRef = useRef(cuesBySubId);
  cuesRef.current = cuesBySubId;

  // Refs for project save (stable closure without re-subscribing menu listeners)
  const fileRef = useRef(file);
  fileRef.current = file;
  const extSubsRef = useRef(extSubs);
  extSubsRef.current = extSubs;
  const activeSubIdRef = useRef(activeSubId);
  activeSubIdRef.current = activeSubId;
  const metaRef = useRef({
    contentType,
    title,
    year,
    season,
    episode,
    container,
    overrideName,
    customName,
  });
  metaRef.current = {
    contentType,
    title,
    year,
    season,
    episode,
    container,
    overrideName,
    customName,
  };
  const editedSubIdsRef = useRef(editedSubIds);
  editedSubIdsRef.current = editedSubIds;

  const pushUndo = useCallback(() => {
    undoStack.current.push({ kind: 'tracks', tracks: cloneTracks(tracksRef.current) });
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    coalesceKey.current = null;
  }, []);

  // Snapshot the active sub's cues *before* a mutation. Pass a `key` to coalesce
  // consecutive identical edits; pass null for discrete one-shot operations.
  const snapshotCues = useCallback((subId: string, key: string | null) => {
    if (key && coalesceKey.current === key) return;
    const current = cuesRef.current[subId];
    if (!current) return;
    undoStack.current.push({ kind: 'cues', subId, cues: current });
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    coalesceKey.current = key;
  }, []);

  const restoreEntry = useCallback((entry: HistoryEntry): HistoryEntry | null => {
    if (entry.kind === 'tracks') {
      const inverse: HistoryEntry = { kind: 'tracks', tracks: cloneTracks(tracksRef.current) };
      setTracks(entry.tracks);
      return inverse;
    }
    const current = cuesRef.current[entry.subId];
    const inverse: HistoryEntry | null = current
      ? { kind: 'cues', subId: entry.subId, cues: current }
      : null;
    setActiveSubId(entry.subId);
    setCuesBySubId((m) => ({ ...m, [entry.subId]: entry.cues }));
    setExtSubs((subs) =>
      subs.map((s) => (s.id === entry.subId ? { ...s, cues: entry.cues.length } : s)),
    );
    return inverse;
  }, []);

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    const inverse = restoreEntry(entry);
    if (inverse) redoStack.current.push(inverse);
    coalesceKey.current = null;
  }, [restoreEntry]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    const inverse = restoreEntry(entry);
    if (inverse) undoStack.current.push(inverse);
    coalesceKey.current = null;
  }, [restoreEntry]);

  // ── bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const [plat, ver, ff, hist, s, autosave] = await Promise.all([
        window.api.app.platform(),
        window.api.app.version(),
        window.api.ffmpeg.status(),
        window.api.history.list(),
        window.api.settings.get(),
        window.api.project.getAutosave(),
      ]);
      setIsWin(plat === 'win32');
      setAppVer(ver);
      setFfLine(ff.version ? ff.version.replace(/^ffmpeg\s+/i, '').slice(0, 42) : '');
      setFfmpegOk(ff.available);
      setHistory(hist);
      // Show "What's New" modal on first launch of a new version.
      if (s.lastSeenVersion !== ver) {
        setWhatsNewVersion(ver);
        void window.api.settings.setOne('lastSeenVersion', ver);
      }
      // Offer to restore autosaved project if one exists.
      if (autosave) {
        const videoExists = await window.api.fs.exists(autosave.videoPath);
        if (videoExists) setAutosaveOffer(autosave);
        else void window.api.project.clearAutosave();
      }
    })();
  }, []);

  // Autosave every 60s when a video is loaded
  useEffect(() => {
    const id = setInterval(() => {
      const data = buildProjectData();
      if (data) void window.api.project.autosave(data);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!destInited.current && settings.defaultDestFolder) {
      setDestFolder(settings.defaultDestFolder);
      destInited.current = true;
    }
  }, [settings.defaultDestFolder]);

  useEffect(() => {
    return window.api.peaks.onProgress((pct) => setPeaksPct(pct));
  }, []);

  // Auto-update lifecycle → non-blocking banner (packaged builds only).
  useEffect(() => {
    const offs = [
      window.api.update.onAvailable((version) => setUpdate({ status: 'available', version })),
      window.api.update.onProgress((percent) =>
        setUpdate((u) => (u ? { ...u, status: 'downloading', percent } : u)),
      ),
      window.api.update.onDownloaded((version) => setUpdate({ status: 'ready', version })),
      window.api.update.onError((msg) => {
        setUpdate(null);
        toast(msg || t('update_error'), 'err');
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [toast, t]);

  useEffect(() => {
    if (!activeSubId) return;
    if (cuesBySubId[activeSubId]) return;
    const sub = extSubs.find((s) => s.id === activeSubId);
    if (!sub) return;
    void window.api.srt.read(sub.path).then((r) => {
      if (r.ok && r.cues) {
        setCuesBySubId((m) => ({ ...m, [activeSubId]: r.cues! }));
      } else {
        setCuesBySubId((m) => ({ ...m, [activeSubId]: [] }));
      }
    });
  }, [activeSubId, extSubs, cuesBySubId]);

  useEffect(() => {
    if (!file || previewAudioId === null) {
      setPeaks(null);
      setPeaksLoading(false);
      return;
    }
    let cancelled = false;
    setPeaks(null);
    setPeaksLoading(true);
    setPeaksPct(0);
    void window.api.peaks
      .get(file.path, previewAudioId, file.durationSec)
      .then((r) => {
        if (cancelled) return;
        if (r.ok && r.min && r.max && r.peaksPerSec && r.durationSec !== undefined) {
          setPeaks({
            min: r.min,
            max: r.max,
            peaksPerSec: r.peaksPerSec,
            duration: r.durationSec,
          });
        }
        setPeaksLoading(false);
      })
      .catch(() => {
        if (!cancelled) setPeaksLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on the identifying fields only; re-running on every
    // `file` object identity change would redundantly re-extract peaks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.path, file?.durationSec, previewAudioId]);

  const updateCue = useCallback(
    (idx: number, patch: Partial<SrtCue>) => {
      if (!activeSubId) return;
      snapshotCues(activeSubId, `upd:${activeSubId}:${idx}`);
      setCuesBySubId((m) => {
        const list = m[activeSubId];
        if (!list || !list[idx]) return m;
        const next = list.slice();
        next[idx] = { ...next[idx], ...patch };
        return { ...m, [activeSubId]: next };
      });
      setEditedSubIds((s) => {
        if (s.has(activeSubId)) return s;
        const n = new Set(s);
        n.add(activeSubId);
        return n;
      });
    },
    [activeSubId, snapshotCues],
  );

  const deleteCue = useCallback(
    (idx: number) => {
      if (!activeSubId) return;
      snapshotCues(activeSubId, null);
      setCuesBySubId((m) => {
        const list = m[activeSubId];
        if (!list || !list[idx]) return m;
        const next = list.slice();
        next.splice(idx, 1);
        return { ...m, [activeSubId]: next };
      });
      setEditedSubIds((s) => {
        if (s.has(activeSubId)) return s;
        const n = new Set(s);
        n.add(activeSubId);
        return n;
      });
      setExtSubs((subs) =>
        subs.map((s) => (s.id === activeSubId ? { ...s, cues: Math.max(0, s.cues - 1) } : s)),
      );
    },
    [activeSubId, snapshotCues],
  );

  const insertCue = useCallback(
    (atTime: number): number => {
      if (!activeSubId) return -1;
      snapshotCues(activeSubId, null);
      const list = cuesBySubId[activeSubId] || [];
      const start = Math.max(0, atTime);
      const end = start + 2;
      const newCue = { idx: list.length + 1, start, end, text: '' };
      const next = list.slice();
      let pos = next.findIndex((c) => c.start > start);
      if (pos < 0) pos = next.length;
      next.splice(pos, 0, newCue);
      setCuesBySubId((m) => ({ ...m, [activeSubId]: next }));
      setEditedSubIds((s) => {
        if (s.has(activeSubId)) return s;
        const n = new Set(s);
        n.add(activeSubId);
        return n;
      });
      setExtSubs((subs) =>
        subs.map((s) => (s.id === activeSubId ? { ...s, cues: s.cues + 1 } : s)),
      );
      return pos;
    },
    [activeSubId, cuesBySubId, snapshotCues],
  );

  const markSubEdited = useCallback(() => {
    if (!activeSubId) return;
    setEditedSubIds((s) => {
      if (s.has(activeSubId)) return s;
      const n = new Set(s);
      n.add(activeSubId);
      return n;
    });
  }, [activeSubId]);

  const shiftCues = useCallback(
    (deltaSec: number, indices: number[]): void => {
      if (!activeSubId || indices.length === 0) return;
      snapshotCues(activeSubId, `shift:${activeSubId}:${indices.join(',')}`);
      setCuesBySubId((m) => {
        const list = m[activeSubId];
        if (!list) return m;
        const next = list.slice();
        for (const i of indices) {
          if (i < 0 || i >= next.length) continue;
          const c = next[i];
          next[i] = {
            ...c,
            start: Math.max(0, c.start + deltaSec),
            end: Math.max(0, c.end + deltaSec),
          };
        }
        return { ...m, [activeSubId]: next };
      });
      markSubEdited();
    },
    [activeSubId, markSubEdited, snapshotCues],
  );

  const shiftAllCues = useCallback(
    (deltaSec: number, fromIdx: number, speed = 1): void => {
      if (!activeSubId) return;
      snapshotCues(activeSubId, `shiftAll:${activeSubId}:${fromIdx}`);
      setCuesBySubId((m) => {
        const list = m[activeSubId];
        if (!list) return m;
        const next = list.slice();
        for (let i = fromIdx; i < next.length; i++) {
          next[i] = {
            ...next[i],
            start: Math.max(0, next[i].start * speed + deltaSec),
            end: Math.max(0, next[i].end * speed + deltaSec),
          };
        }
        return { ...m, [activeSubId]: next };
      });
      markSubEdited();
    },
    [activeSubId, markSubEdited, snapshotCues],
  );

  const setCuesForActiveSub = useCallback(
    (next: SrtCue[]): void => {
      if (!activeSubId) return;
      snapshotCues(activeSubId, null);
      setCuesBySubId((m) => ({ ...m, [activeSubId]: next }));
      setExtSubs((subs) =>
        subs.map((s) => (s.id === activeSubId ? { ...s, cues: next.length } : s)),
      );
      markSubEdited();
    },
    [activeSubId, markSubEdited, snapshotCues],
  );

  const splitCue = useCallback(
    (idx: number, mode: 'playhead' | 'newline'): void => {
      if (!activeSubId) return;
      const list = cuesBySubId[activeSubId];
      const cue = list?.[idx];
      if (!cue) return;
      const sub = extSubs.find((s) => s.id === activeSubId);
      const syncOpts = { offset: sub?.offset ?? 0, speed: sub?.speed ?? 1 };

      let splitT: number;
      let textA: string;
      let textB: string;

      if (mode === 'newline') {
        const nl = cue.text.indexOf('\n');
        if (nl < 0) return;
        textA = cue.text.slice(0, nl).trim();
        textB = cue.text.slice(nl + 1).trim();
        if (!textA || !textB) return;
        const total = Math.max(1, visibleLen(cue.text));
        const ratio = visibleLen(textA) / total;
        splitT = cue.start + (cue.end - cue.start) * ratio;
      } else {
        splitT = fileTimeFromMediaTime(previewT, syncOpts);
        if (splitT <= cue.start + 0.05 || splitT >= cue.end - 0.05) return;
        textA = cue.text;
        textB = '';
      }

      const next = list.slice();
      next[idx] = { ...cue, end: splitT, text: textA };
      next.splice(idx + 1, 0, {
        idx: cue.idx + 1,
        start: splitT,
        end: cue.end,
        text: textB,
      });
      setCuesForActiveSub(next);
    },
    [activeSubId, cuesBySubId, extSubs, previewT, setCuesForActiveSub],
  );

  const mergeCue = useCallback(
    (idx: number): void => {
      if (!activeSubId) return;
      const list = cuesBySubId[activeSubId];
      const a = list?.[idx];
      const b = list?.[idx + 1];
      if (!a || !b) return;
      const text = a.text ? (b.text ? `${a.text}\n${b.text}` : a.text) : b.text;
      const next = list.slice();
      next[idx] = { ...a, end: b.end, text };
      next.splice(idx + 1, 1);
      setCuesForActiveSub(next);
    },
    [activeSubId, cuesBySubId, setCuesForActiveSub],
  );

  const duplicateCue = useCallback(
    (idx: number, offsetSec = 2): void => {
      if (!activeSubId) return;
      const list = cuesBySubId[activeSubId];
      const cue = list?.[idx];
      if (!cue) return;
      const dur = Math.max(0.05, cue.end - cue.start);
      const gap = 0.05;
      const copy: SrtCue = {
        ...cue,
        idx: cue.idx + 1,
        start: cue.end + gap + offsetSec,
        end: cue.end + gap + offsetSec + dur,
        text: cue.text,
      };
      const next = list.slice();
      next.splice(idx + 1, 0, copy);
      setCuesForActiveSub(next);
    },
    [activeSubId, cuesBySubId, setCuesForActiveSub],
  );

  const warnThresholds: CueWarningThresholds = useMemo(
    () => ({
      minCueDurationSec: settings.minCueDurationSec,
      maxCueDurationSec: settings.maxCueDurationSec,
      maxCps: settings.maxCps,
      hardMaxCps: settings.hardMaxCps,
      minGapSec: settings.minGapSec,
    }),
    [
      settings.minCueDurationSec,
      settings.maxCueDurationSec,
      settings.maxCps,
      settings.hardMaxCps,
      settings.minGapSec,
    ],
  );

  const subOverlayStyle: SubOverlayStyle = useMemo(
    () => ({
      fontScale: settings.subFontScale,
      color: settings.subColor,
      style: settings.subStyle,
      position: settings.subPosition,
    }),
    [settings.subFontScale, settings.subColor, settings.subStyle, settings.subPosition],
  );

  const seekToFileCue = useCallback(
    (fileT: number): void => {
      const sub = extSubs.find((s) => s.id === activeSubId);
      const opts = { offset: sub?.offset ?? 0, speed: sub?.speed ?? 1 };
      setPreviewTime(mediaTimeForCueStart(fileT, opts));
      setCenterTab('preview');
    },
    [activeSubId, extSubs, setPreviewTime],
  );

  // Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo (tracks + cue edits).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const refreshHistory = useCallback(async () => {
    const h = await window.api.history.list();
    setHistory(h);
  }, []);

  const loadFile = async (pathStr: string) => {
    pushUndo();
    const r = await window.api.media.probe(pathStr);
    if (!r.ok || !r.file) {
      toast(r.error || t('load_error'), 'err');
      return;
    }
    const f = r.file;
    setFile(f);
    setTracks(f.tracks.map((t) => ({ ...t })));
    setExtSubs([]);
    setActiveSubId(null);
    setCuesBySubId({});
    setEditedSubIds(new Set());
    resetOnFileChange();
    setTitle(f.title);
    setYear(f.year);
    setOverrideName(false);
    setCustomName('');
    setContainer(settings.defaultContainer.toUpperCase());
    pushLog(`נטען: ${f.name}`, 'info');
    pushLog(
      `probe ok · streams=${f.tracks.length} · audio=${f.tracks.filter((x) => x.kind === 'A').length} · subs=${f.tracks.filter((x) => x.kind === 'S').length}`,
      'ok',
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
  };

  const addSrtFromPaths = useCallback(
    async (paths: string[]) => {
      let added = false;
      for (const p of paths) {
        const r = await window.api.srt.add(p);
        if (r.ok && r.sub) {
          setExtSubs((s) => [...s, r.sub!]);
          setActiveSubId(r.sub!.id);
          if (r.cues) {
            setCuesBySubId((m) => ({ ...m, [r.sub!.id]: r.cues! }));
          }
          toast(`${t('subs_added')}: ${r.sub!.name}`, 'ok');
          added = true;
        } else toast(r.error || t('error'), 'err');
      }
      if (added) setCenterTab('preview');
    },
    [t, toast],
  );

  const pickSrtFiles = async () => {
    const paths = await window.api.dialog.openSrt();
    await addSrtFromPaths(paths);
  };

  const subNeedsDoubleApplyWarn = useCallback(
    (sub: ExternalSub): boolean => {
      const global = Math.abs(sub.offset) > 1e-6 || Math.abs(sub.speed - 1) > 1e-5;
      return editedSubIds.has(sub.id) && global;
    },
    [editedSubIds],
  );

  const anyExtSubDoubleApply = useCallback(
    (): boolean => extSubs.some((s) => subNeedsDoubleApplyWarn(s)),
    [extSubs, subNeedsDoubleApplyWarn],
  );

  const doExportSrt = async (sub: ExternalSub): Promise<void> => {
    const base = sub.name.replace(/\.[^.]+$/, '');
    const defaultName = `${base}_synced.srt`;
    const destPath = await window.api.dialog.saveSrt(defaultName);
    if (!destPath) return;

    let sourcePath = sub.path;
    if (editedSubIds.has(sub.id)) {
      const list = cuesBySubId[sub.id];
      if (list && list.length > 0) {
        const wr = await window.api.srt.writeCues(list, sub.name.replace(/\.srt$/i, ''));
        if (wr.ok && wr.path) sourcePath = wr.path;
        else {
          toast(`${t('write_edited_srt_failed')}: ${sub.name}`, 'err');
          return;
        }
      }
    }

    toast(t('exporting_subs'), 'info');
    const r = await window.api.srt.save({
      sourcePath,
      destPath,
      offset: sub.offset,
      speed: sub.speed,
      encoding: sub.encoding,
    });

    if (r.ok) {
      toast(t('subs_saved'), 'ok');
      pushLog(`ייצוא כתוביות הושלם: ${destPath.split(/[/\\]/).pop()}`, 'ok');
    } else {
      toast(r.error || t('subs_export_failed'), 'err');
      pushLog(`ייצוא כתוביות נכשל: ${r.error}`, 'err');
    }
  };

  const handleExportSrt = async (sub: ExternalSub): Promise<void> => {
    if (subNeedsDoubleApplyWarn(sub)) {
      setExportConfirm({ kind: 'srt', sub });
      return;
    }
    await doExportSrt(sub);
  };

  const buildProjectData = (): ProjectData | null => {
    const f = fileRef.current;
    if (!f) return null;
    const m = metaRef.current;
    const subs = extSubsRef.current;
    const cuesMap = cuesRef.current;
    const edited = editedSubIdsRef.current;
    const activePath = (() => {
      const id = activeSubIdRef.current;
      if (!id) return null;
      const s = subs.find((x) => x.id === id);
      return s?.path ?? null;
    })();
    return {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      videoPath: f.path,
      trackOverrides: tracksRef.current.map(({ id, keep, def, forced }) => ({
        id,
        keep,
        def,
        forced,
      })),
      extSubs: subs.map((s) => ({
        path: s.path,
        name: s.name,
        lang: s.lang,
        trackName: s.trackName,
        offset: s.offset,
        speed: s.speed,
        def: s.def,
        forced: s.forced,
        encoding: s.encoding,
        editedCues: edited.has(s.id) ? (cuesMap[s.id] ?? undefined) : undefined,
      })),
      activeSubPath: activePath,
      metadata: {
        contentType: m.contentType,
        title: m.title,
        year: m.year,
        season: m.season,
        episode: m.episode,
        container: m.container,
        overrideName: m.overrideName,
        customName: m.customName,
      },
    };
  };

  const saveProject = async (path?: string): Promise<void> => {
    const data = buildProjectData();
    if (!data) {
      toast(t('project_no_file'), 'warn');
      return;
    }
    const target =
      path ??
      projectPath ??
      (await window.api.project.saveDialog(`${data.metadata.title || 'project'}.submixer`));
    if (!target) return;
    const r = await window.api.project.save(data, target);
    if (r.ok) {
      setProjectPath(target);
      void window.api.project.clearAutosave();
      toast(t('project_saved'), 'ok');
    } else {
      toast(`${t('project_save_failed')}: ${r.error}`, 'err');
    }
  };

  const loadProjectData = async (data: ProjectData): Promise<void> => {
    const exists = await window.api.fs.exists(data.videoPath);
    if (!exists) {
      toast(t('project_video_missing'), 'err');
      return;
    }
    await loadFile(data.videoPath);
    // Apply track overrides after probe
    setTracks((trs) =>
      trs.map((tr) => {
        const ov = data.trackOverrides.find((o) => o.id === tr.id);
        return ov ? { ...tr, keep: ov.keep, def: ov.def, forced: ov.forced } : tr;
      }),
    );
    // Restore metadata
    setContentType(data.metadata.contentType);
    setTitle(data.metadata.title);
    setYear(data.metadata.year);
    setSeason(data.metadata.season);
    setEpisode(data.metadata.episode);
    setContainer(data.metadata.container);
    setOverrideName(data.metadata.overrideName);
    setCustomName(data.metadata.customName);
    // Load external subs
    const newSubs: ExternalSub[] = [];
    const newCues: Record<string, SrtCue[]> = {};
    const newEdited = new Set<string>();
    for (const ps of data.extSubs) {
      const subExists = await window.api.fs.exists(ps.path);
      if (!subExists) {
        toast(`${ps.name}: not found`, 'warn');
        continue;
      }
      const r = await window.api.srt.add(ps.path);
      if (!r.ok || !r.sub) {
        toast(`${ps.name}: ${r.error || t('error')}`, 'warn');
        continue;
      }
      const sub: ExternalSub = {
        ...r.sub,
        lang: ps.lang,
        trackName: ps.trackName,
        offset: ps.offset,
        speed: ps.speed,
        def: ps.def,
        forced: ps.forced,
        encoding: ps.encoding,
      };
      newSubs.push(sub);
      if (ps.editedCues && ps.editedCues.length > 0) {
        newCues[sub.id] = ps.editedCues;
        newEdited.add(sub.id);
      } else if (r.cues) {
        newCues[sub.id] = r.cues;
      }
    }
    setExtSubs(newSubs);
    setCuesBySubId(newCues);
    setEditedSubIds(newEdited);
    // Set active sub to the one that was active when saved
    if (data.activeSubPath) {
      const activeSub = newSubs.find((s) => s.path === data.activeSubPath);
      if (activeSub) setActiveSubId(activeSub.id);
    }
    void window.api.project.clearAutosave();
    toast(t('project_loaded'), 'ok');
  };

  const onDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0] as File & { path?: string };
    if (f?.path) void loadFile(f.path);
  };

  const onSelectRow = (id: string) => {
    setActiveId(id);
    if (!id.startsWith('ext:')) {
      const tid = Number(id);
      const tr = tracks.find((t) => t.id === tid);
      if (tr?.kind === 'A') setPreviewAudioId(tid);
    }
  };

  const toggleKeep = (id: number) => {
    pushUndo();
    setTracks((tr) =>
      tr.map((track) => {
        if (track.id !== id) return track;
        if (track.locked) {
          toast(t('video_locked_tip'), 'warn');
          return track;
        }
        return { ...track, keep: !track.keep };
      }),
    );
  };

  const setDefault = (id: number) => {
    pushUndo();
    const target = tracks.find((x) => x.id === id);
    if (!target) return;
    setTracks((tr) =>
      tr.map((t) => ({
        ...t,
        def: t.kind === target.kind ? t.id === id : t.def,
      })),
    );
  };

  const setForced = (id: number) => {
    pushUndo();
    setTracks((tr) => tr.map((t) => (t.id === id ? { ...t, forced: !t.forced } : t)));
  };

  const updateSub = (id: string, patch: Partial<ExternalSub>) => {
    setExtSubs((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeSub = (id: string) => {
    setExtSubs((s) => s.filter((x) => x.id !== id));
    setCuesBySubId((m) => {
      if (!(id in m)) return m;
      const n = { ...m };
      delete n[id];
      return n;
    });
    setEditedSubIds((s) => {
      if (!s.has(id)) return s;
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    if (activeSubId === id) {
      const rest = extSubs.filter((x) => x.id !== id);
      setActiveSubId(rest[0]?.id ?? null);
    }
  };

  const outName = useMemo(() => {
    const c = container.toLowerCase();
    if (overrideName) {
      const stem = customName.trim() || title.trim();
      if (stem) return `${stem}.${c}`;
    }
    if (contentType === 'movie') return `${title} (${year}).${c}`;
    return `${title} - S${season}E${episode}.${c}`;
  }, [overrideName, customName, container, contentType, title, year, season, episode]);

  const outPath = useMemo(() => {
    if (!settings.exportUseContentFolder) {
      return joinPath(isWin, destFolder, outName);
    }
    const base = contentType === 'movie' ? `${title} (${year})` : `${title} S${season}E${episode}`;
    return joinPath(isWin, destFolder, base, outName);
  }, [
    isWin,
    destFolder,
    contentType,
    title,
    year,
    season,
    episode,
    outName,
    settings.exportUseContentFolder,
  ]);

  const estSize = useMemo(() => {
    if (!file) return 0;
    const dropped = tracks.filter((tr) => !tr.keep);
    let droppedRatio = 0;
    dropped.forEach((tr) => {
      if (tr.kind === 'A') droppedRatio += 0.05;
      else if (tr.kind === 'S') droppedRatio += 0.005;
    });
    return file.sizeBytes * (1 - droppedRatio) * (1 / 1024);
  }, [file, tracks]);

  const audioCount = tracks.filter((t) => t.keep && t.kind === 'A').length;
  const subCount = tracks.filter((t) => t.keep && t.kind === 'S').length + extSubs.length;

  const activeSub = extSubs.find((s) => s.id === activeSubId);

  const buildPlan = useCallback((): ExportPlan | null => {
    if (!file) return null;
    const v = tracks.find((t) => t.kind === 'V' && t.keep) || tracks.find((t) => t.kind === 'V');
    const videoTrackId = v?.id ?? null;
    const audioTracks = tracks
      .filter((t) => t.kind === 'A' && t.keep)
      .map((t) => ({
        id: t.id,
        lang: t.lang,
        def: t.def,
        forced: t.forced,
        codecName: t.codecName,
      }));
    const embeddedSubs = tracks
      .filter((t) => t.kind === 'S' && t.keep)
      .map((t) => ({
        id: t.id,
        lang: t.lang,
        def: t.def,
        forced: t.forced,
        codecName: t.codecName,
      }));
    const extMeta = extSubs.map((s) => ({
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
    const burnInSubIndex = settings.burnInSubs && activeExtIdx >= 0 ? activeExtIdx : null;
    return {
      inputFile: file.path,
      externalSubs: extMeta,
      videoTrackId,
      audioTracks,
      embeddedSubs,
      outputPath: outPath,
      metadataTitle: outName.replace(/\.[^.]+$/, ''),
      container: container.toLowerCase() === 'mp4' ? 'mp4' : 'mkv',
      burnInSubIndex,
      encodePreset: settings.encodePreset,
      encodeCrf: settings.encodeCrf,
      burnInFontSize: settings.burnInFontSize,
      burnInPrimaryColor: settings.burnInPrimaryColor,
      burnInOutline: settings.burnInOutline,
      mp4AudioBitrate: settings.mp4AudioBitrate,
    };
  }, [
    file,
    tracks,
    extSubs,
    outPath,
    outName,
    container,
    settings.burnInSubs,
    activeSubId,
    settings.encodePreset,
    settings.encodeCrf,
    settings.burnInFontSize,
    settings.burnInPrimaryColor,
    settings.burnInOutline,
    settings.mp4AudioBitrate,
  ]);

  const openCmdModal = async () => {
    const plan = buildPlan();
    if (!plan) {
      toast(t('no_file'), 'warn');
      return;
    }
    const s = await window.api.exporting.cmdString(plan);
    setCmdStr(s);
    setShowCmd(true);
  };

  const doMuxExport = async (): Promise<void> => {
    if (!file || !title.trim()) {
      toast(t('missing_title_file'), 'warn');
      return;
    }
    if (!destFolder.trim()) {
      toast(t('dest_folder_missing'), 'warn');
      return;
    }
    const plan = buildPlan();
    if (!plan) return;
    if (
      plan.container === 'mp4' &&
      plan.embeddedSubs.some((s) => {
        const c = (s.codecName || '').toLowerCase();
        return c.includes('pgs') || c.includes('dvd_subtitle') || c.includes('dvb_subtitle');
      })
    ) {
      toast(t('export_mp4_bitmap_subs'), 'warn');
      return;
    }
    const extForRun: { path: string; offset: number; speed: number; encoding?: string }[] = [];
    const planExt = plan.externalSubs.slice();
    for (let i = 0; i < extSubs.length; i++) {
      const s = extSubs[i];
      let p = s.path;
      if (editedSubIds.has(s.id)) {
        const list = cuesBySubId[s.id];
        if (list && list.length > 0) {
          const wr = await window.api.srt.writeCues(list, s.name.replace(/\.srt$/i, ''));
          if (wr.ok && wr.path) {
            p = wr.path;
            planExt[i] = { ...planExt[i], path: p };
          } else {
            toast(`${t('write_edited_srt_failed')}: ${s.name}`, 'err');
            return;
          }
        }
      }
      extForRun.push({ path: p, offset: s.offset, speed: s.speed, encoding: s.encoding });
    }
    plan.externalSubs = planExt;
    pushLog(`מתחיל ייצוא · יעד: ${outName}`, 'info');
    toast(t('export_started'), 'info');
    const r = await runExportJob(plan, file.durationSec, extForRun);
    if (r.ok) {
      toast(t('export_success'), 'ok');
      pushLog(`נכתב: ${outName}`, 'ok');
      showNotification('SubMixer', t('notify_export_done'));
    } else if (r.cancelled) {
      toast(t('export_cancelled'), 'warn');
      pushLog(t('export_cancelled'), 'warn');
    } else {
      toast(r.error || t('export_failed'), 'err');
      pushLog(r.error || t('export_failed'), 'err');
    }
    await refreshHistory();
  };

  const handleExport = async (): Promise<void> => {
    if (!file || !title.trim() || !destFolder.trim()) {
      await doMuxExport(); // let doMuxExport show the specific validation toast
      return;
    }
    const exists = await window.api.fs.exists(outPath);
    if (exists) {
      const info = await window.api.fs.stat(outPath);
      setOverwriteFileInfo(info);
      setExportConfirm('overwrite');
      return;
    }
    if (anyExtSubDoubleApply()) {
      setExportConfirm('mux');
      return;
    }
    await doMuxExport();
  };

  const addToBatch = async (): Promise<void> => {
    if (!file || !title.trim()) {
      toast(t('missing_title_file'), 'warn');
      return;
    }
    if (!destFolder.trim()) {
      toast(t('dest_folder_missing'), 'warn');
      return;
    }
    const plan = buildPlan();
    if (!plan) return;
    const extForRun: { path: string; offset: number; speed: number; encoding?: string }[] = [];
    const planExt = plan.externalSubs.slice();
    for (let i = 0; i < extSubs.length; i++) {
      const s = extSubs[i];
      let p = s.path;
      if (editedSubIds.has(s.id)) {
        const list = cuesBySubId[s.id];
        if (list && list.length > 0) {
          const wr = await window.api.srt.writeCues(list, s.name.replace(/\.srt$/i, ''));
          if (wr.ok && wr.path) {
            p = wr.path;
            planExt[i] = { ...planExt[i], path: p };
          } else {
            toast(`${t('write_edited_srt_failed')}: ${s.name}`, 'err');
            return;
          }
        }
      }
      extForRun.push({ path: p, offset: s.offset, speed: s.speed, encoding: s.encoding });
    }
    plan.externalSubs = planExt;
    const item: BatchItem = {
      id: `${Date.now()}-${Math.random()}`,
      label: outName,
      plan,
      durationSec: file.durationSec,
      extSubs: extForRun,
      status: 'pending',
    };
    setBatchQueue((q) => [...q, item]);
    toast(`${t('batch_added')}: ${outName}`, 'ok');
  };

  const addMultipleVideosToBatch = async (): Promise<void> => {
    if (!destFolder.trim()) {
      toast(t('dest_folder_missing'), 'warn');
      return;
    }
    const paths = await window.api.dialog.openMultipleVideos();
    if (paths.length === 0) return;
    toast(t('batch_probing'), 'info');
    const newItems: BatchItem[] = [];
    for (const vPath of paths) {
      const r = await window.api.media.probe(vPath);
      if (!r.ok || !r.file) {
        toast(`${r.error ?? 'probe failed'}: ${vPath.split(/[/\\]/).pop()}`, 'err');
        continue;
      }
      const vFile = r.file;
      const stem = vFile.name.replace(/\.[^.]+$/, '');
      const dir = vPath.includes('/')
        ? vPath.slice(0, vPath.lastIndexOf('/'))
        : vPath.slice(0, vPath.lastIndexOf('\\'));
      const cont = container.toLowerCase() === 'mp4' ? 'mp4' : 'mkv';
      const itemOutName = `${stem}.${cont}`;
      const itemOutPath = joinPath(isWin, destFolder, itemOutName);

      // Auto-detect matching subtitle in same directory
      const subExts = ['srt', 'vtt', 'ass'];
      const matchingSubPath = await (async () => {
        for (const ext of subExts) {
          const candidate = `${dir}${isWin ? '\\' : '/'}${stem}.${ext}`;
          const exists = await window.api.fs.exists(candidate);
          if (exists) return candidate;
        }
        return null;
      })();

      let matchingSub: { path: string; name: string } | null = null;
      if (matchingSubPath) {
        const subName = matchingSubPath.split(/[/\\]/).pop() ?? matchingSubPath;
        const parsed = await window.api.srt.read(matchingSubPath);
        if (parsed.ok) {
          matchingSub = { path: matchingSubPath, name: subName };
        }
      }

      const videoTrack = vFile.tracks.find((tr) => tr.kind === 'V') ?? null;
      const audioTracks = vFile.tracks
        .filter((tr) => tr.kind === 'A')
        .map((tr) => ({
          id: tr.id,
          lang: tr.lang,
          def: tr.def,
          forced: tr.forced,
          codecName: tr.codecName,
        }));
      const embeddedSubs = vFile.tracks
        .filter((tr) => tr.kind === 'S')
        .map((tr) => ({
          id: tr.id,
          lang: tr.lang,
          def: tr.def,
          forced: tr.forced,
          codecName: tr.codecName,
        }));

      const extSubsForItem = matchingSub
        ? [
            {
              path: matchingSub.path,
              lang: 'und',
              def: true,
              forced: false,
              offset: 0,
              speed: 1,
              trackName: matchingSub.name,
              encoding: 'utf-8',
            },
          ]
        : [];
      const extForRun = matchingSub
        ? [{ path: matchingSub.path, offset: 0, speed: 1, encoding: 'utf-8' }]
        : [];

      const plan: ExportPlan = {
        inputFile: vPath,
        externalSubs: extSubsForItem,
        videoTrackId: videoTrack?.id ?? null,
        audioTracks,
        embeddedSubs,
        outputPath: itemOutPath,
        metadataTitle: stem,
        container: cont,
        burnInSubIndex: null,
        encodePreset: settings.encodePreset,
        encodeCrf: settings.encodeCrf,
        burnInFontSize: settings.burnInFontSize,
        burnInPrimaryColor: settings.burnInPrimaryColor,
        burnInOutline: settings.burnInOutline,
        mp4AudioBitrate: settings.mp4AudioBitrate,
      };

      newItems.push({
        id: `${Date.now()}-${Math.random()}-${stem}`,
        label: itemOutName,
        plan,
        durationSec: vFile.durationSec,
        extSubs: extForRun,
        status: 'pending',
      });
    }
    if (newItems.length > 0) {
      setBatchQueue((q) => [...q, ...newItems]);
      toast(`${t('batch_added')}: ${newItems.length}`, 'ok');
    }
  };

  const runBatchQueue = async (): Promise<void> => {
    const pending = batchQueue.filter((x) => x.status === 'pending');
    await runBatch(pending, (idx, ok, cancelled, error) => {
      const item = pending[idx];
      setBatchQueue((q) =>
        q.map((x) =>
          x.id === item.id
            ? { ...x, status: ok ? 'done' : cancelled ? 'pending' : 'failed', error }
            : x,
        ),
      );
    });
    await refreshHistory();
    showNotification('SubMixer', t('notify_batch_done'));
  };

  const handleReExport = useCallback(
    async (plan: ExportPlan, durationSec: number): Promise<void> => {
      if (exporting) {
        toast(t('export_already_running'), 'warn');
        return;
      }
      setShowHistory(false);
      const extForRun = plan.externalSubs.map((s) => ({
        path: s.path,
        offset: s.offset,
        speed: s.speed,
        encoding: s.encoding,
      }));
      const label = plan.outputPath.split(/[/\\]/).pop() ?? plan.outputPath;
      pushLog(`מריץ שוב: ${label}`, 'info');
      toast(t('export_started'), 'info');
      const r = await runExportJob(plan, durationSec, extForRun);
      if (r.ok) {
        toast(t('export_success'), 'ok');
        pushLog(`נכתב: ${label}`, 'ok');
        showNotification('SubMixer', t('notify_export_done'));
      } else if (r.cancelled) {
        toast(t('export_cancelled'), 'warn');
        pushLog(t('export_cancelled'), 'warn');
      } else {
        toast(r.error || t('export_failed'), 'err');
        pushLog(r.error || t('export_failed'), 'err');
      }
      await refreshHistory();
    },
    [exporting, t, toast, runExportJob, refreshHistory, pushLog],
  );

  const browseDest = async () => {
    const d = await window.api.dialog.chooseFolder(destFolder);
    if (d) setDestFolder(d);
  };

  const menuRef = useRef({
    pickSrtFiles,
    handleExport,
    cancelExportJob,
    refreshHistory,
    openCmdModal,
    saveProject,
    loadProjectData,
    toast,
  });
  menuRef.current = {
    pickSrtFiles,
    handleExport,
    cancelExportJob,
    refreshHistory,
    openCmdModal,
    saveProject,
    loadProjectData,
    toast,
  };

  // Menu IPC — menuRef avoids stale closures while listeners stay registered once
  useEffect(() => {
    const openFile = () => setShowOpen(true);
    const addSrt = () => void menuRef.current.pickSrtFiles();
    const doExport = () => void menuRef.current.handleExport();
    const cancelEx = () => void menuRef.current.cancelExportJob();
    const toggleDr = () => setDrawerOpen((d) => !d);
    const hist = () => void menuRef.current.refreshHistory().then(() => setShowHistory(true));
    const ffmpegDlg = () => void menuRef.current.openCmdModal();
    const checkFf = () =>
      void window.api.ffmpeg.status(true).then((ff) => {
        setFfmpegOk(ff.available);
        menuRef.current.toast(
          ff.available ? t('ffmpeg_available') : t('ffmpeg_not_found'),
          ff.available ? 'ok' : 'warn',
        );
      });
    const about = () =>
      void window.api.app.version().then((v) => alert(`SubMixer ${v}\n\n${t('about_text')}`));

    const unsubs = [
      window.api.menu.on('menu:openFile', openFile),
      window.api.menu.on('menu:addSrt', addSrt),
      window.api.menu.on('menu:export', doExport),
      window.api.menu.on('menu:cancelExport', cancelEx),
      window.api.menu.on('menu:toggleDrawer', toggleDr),
      window.api.menu.on('menu:history', hist),
      window.api.menu.on('menu:ffmpegCmd', ffmpegDlg),
      window.api.menu.on('menu:checkFFmpeg', checkFf),
      window.api.menu.on('menu:about', about),
      window.api.menu.on('menu:diagnostics', () => setShowDiagnostics(true)),
      window.api.menu.on('menu:whatsnew', () => {
        void window.api.app.version().then((v) => setWhatsNewVersion(v));
      }),
      window.api.menu.on('menu:saveProject', () => void menuRef.current.saveProject()),
      window.api.menu.on(
        'menu:openProject',
        () =>
          void window.api.project.openDialog().then((p) => {
            if (!p) return;
            void window.api.project.load(p).then((r) => {
              if (r.ok && r.data) {
                void menuRef.current.loadProjectData(r.data).then(() => setProjectPath(p));
              } else {
                menuRef.current.toast(`${t('project_load_failed')}: ${r.error}`, 'err');
              }
            });
          }),
      ),
    ];
    return () => unsubs.forEach((u) => u());
    // Register native-menu listeners once; handlers read fresh state via menuRef,
    // so this must not re-run (and thus re-subscribe) when `t`/state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="proto"
      data-testid="app-root"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDropFile}
    >
      {!ffmpegOk && (
        <div className="ffmpeg-banner">
          <span>{t('ffmpeg_missing')}</span>
          <button
            className="btn compact"
            type="button"
            onClick={() => window.api.ffmpeg.openInstallPage()}
          >
            {t('download')}
          </button>
        </div>
      )}

      {autosaveOffer && (
        <div className="update-banner">
          <span>{t('project_autosave_restore')}</span>
          <button
            className="btn compact"
            type="button"
            onClick={() => {
              const data = autosaveOffer;
              setAutosaveOffer(null);
              void loadProjectData(data);
            }}
          >
            {t('project_restore')}
          </button>
          <button
            className="btn compact ghost"
            type="button"
            onClick={() => {
              setAutosaveOffer(null);
              void window.api.project.clearAutosave();
            }}
          >
            {t('project_discard')}
          </button>
        </div>
      )}

      {update && (
        <div className="update-banner">
          {update.status === 'available' && (
            <>
              <span>{t('update_available').replace('{v}', update.version)}</span>
              <button
                className="btn compact"
                type="button"
                onClick={() => {
                  setUpdate({ ...update, status: 'downloading', percent: 0 });
                  void window.api.update.download();
                }}
              >
                {t('update_download')}
              </button>
              <button className="btn compact ghost" type="button" onClick={() => setUpdate(null)}>
                {t('later')}
              </button>
            </>
          )}
          {update.status === 'downloading' && (
            <span>{t('update_downloading').replace('{p}', String(update.percent ?? 0))}</span>
          )}
          {update.status === 'ready' && (
            <>
              <span>{t('update_ready').replace('{v}', update.version)}</span>
              <button
                className="btn compact"
                type="button"
                onClick={() => void window.api.update.install()}
              >
                {t('update_restart')}
              </button>
              <button className="btn compact ghost" type="button" onClick={() => setUpdate(null)}>
                {t('later')}
              </button>
            </>
          )}
        </div>
      )}

      <TopBar
        file={file}
        contentType={contentType}
        title={title}
        year={year}
        season={season}
        episode={episode}
        appVersion={appVer}
        ffVersion={ffLine}
        onOpenFile={() => setShowOpen(true)}
        onOpenHistory={() => void refreshHistory().then(() => setShowHistory(true))}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="main">
        <aside className="col-left">
          <SourcePanel file={file} onOpenFile={() => setShowOpen(true)} />
          <ContentDetails
            contentType={contentType}
            onContentType={setContentType}
            title={title}
            onTitle={(v) => {
              setTitle(v);
              if (overrideName) setCustomName(v);
            }}
            year={year}
            onYear={setYear}
            season={season}
            onSeason={setSeason}
            episode={episode}
            onEpisode={setEpisode}
            container={container}
            onContainer={(c) => {
              setContainer(c);
              void setOne('defaultContainer', c.toLowerCase() as 'mkv' | 'mp4');
            }}
            destFolder={destFolder}
            onDestFolder={setDestFolder}
            onBrowseFolder={() => void browseDest()}
            exportUseContentFolder={settings.exportUseContentFolder}
            onExportUseContentFolder={(v) => void setOne('exportUseContentFolder', v)}
            overrideName={overrideName}
            onOverrideName={(v) => {
              setOverrideName(v);
              if (v && !customName.trim()) {
                const stem = outName.replace(/\.[^.]+$/, '');
                setCustomName(stem);
                setTitle(stem);
              }
            }}
            customName={customName}
            onCustomName={(v) => {
              setCustomName(v);
              if (overrideName) setTitle(v);
            }}
          />
          <div className="out-card">
            <div className="out-l">{t('will_save_as')}</div>
            <div className="out-n mono" title={outPath}>
              {outName}
            </div>
            <div className="out-path mono">{outPath}</div>
          </div>
        </aside>

        <main className="col-center">
          {file && (
            <div className="center-tabs">
              <button
                type="button"
                className={`center-tab ${centerTab === 'tracks' ? 'on' : ''}`}
                onClick={() => setCenterTab('tracks')}
              >
                {t('center_tab_tracks')}
                <span className="center-tab-count mono">
                  {tracks.filter((tr) => tr.keep).length}/{tracks.length}
                </span>
              </button>
              <button
                type="button"
                className={`center-tab ${centerTab === 'preview' ? 'on' : ''}`}
                onClick={() => setCenterTab('preview')}
              >
                {t('center_tab_preview')}
                {cues.length > 0 && <span className="center-tab-count mono">{cues.length}</span>}
              </button>
            </div>
          )}
          {(!file || centerTab === 'tracks') && (
            <TracksList
              tracks={tracks}
              extSubs={extSubs}
              activeId={activeId}
              filter={filter}
              search={search}
              onFilter={setFilter}
              onSearch={setSearch}
              onSelect={onSelectRow}
              onToggleKeep={toggleKeep}
              onSetDefault={setDefault}
              onSetForced={setForced}
            />
          )}
          {file && centerTab === 'preview' && (
            <PreviewBar
              durationSec={file.durationSec}
              previewT={previewT}
              onPreviewT={setPreviewTime}
              videoUrl={videoUrl}
              audioUrl={audioUrl}
              audioPct={audioPct}
              audioExtracting={audioExtracting}
              extractPhase={extractPhase}
              audioMode={audioMode}
              audioLimitSec={audioLimitSec}
              onRequestAudioExtract={requestAudioExtract}
              extractFailed={extractFailed}
              onAudioError={(m) => toast(m, 'err')}
              peaks={peaks}
              peaksLoading={peaksLoading}
              peaksPct={peaksPct}
              cues={cues}
              cuesLang={activeSub?.lang}
              warnThresholds={warnThresholds}
              onUpdateCue={updateCue}
              onDeleteCue={deleteCue}
              onInsertCue={insertCue}
              onShiftCues={shiftCues}
              onSplitCue={splitCue}
              onMergeCue={mergeCue}
              onOpenShortcuts={() => setShowShortcuts(true)}
              onOpenFixErrors={() => setShowFixErrors(true)}
              onOpenFindReplace={() => setShowFindReplace(true)}
              onAdjustAllTimes={() => {
                if (cues.length > 0) setShowAdjustAll(true);
                else toast(t('no_srt_loaded'), 'warn');
              }}
              onDuplicateCue={() => {
                if (previewSelectedIdx >= 0) duplicateCue(previewSelectedIdx);
              }}
              onSelectedIdxChange={setPreviewSelectedIdx}
              subOffset={activeSub?.offset ?? 0}
              subSpeed={activeSub?.speed ?? 1}
              subStyle={subOverlayStyle}
            />
          )}
        </main>

        {drawerOpen && (
          <SubsDrawer
            extSubs={extSubs}
            activeSubId={activeSubId}
            onSelectSub={setActiveSubId}
            onAddSubs={() => void pickSrtFiles()}
            onDropFiles={addSrtFromPaths}
            onRemoveSub={removeSub}
            onUpdateSub={updateSub}
            onExportSrt={(s) => void handleExportSrt(s)}
            fileEdited={!!activeSubId && editedSubIds.has(activeSubId)}
            onVisualSync={() => {
              if (cues.length > 0) {
                setCenterTab('preview');
                setShowVisualSync(true);
              } else toast(t('no_srt_loaded'), 'warn');
            }}
          />
        )}
      </div>

      <BottomBar
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((d) => !d)}
        onShowFfmpeg={() => void openCmdModal()}
        onOpenQueue={() => setShowBatchQueue(true)}
        batchCount={batchQueue.filter((x) => x.status === 'pending').length}
        logs={logs}
        estMB={estSize}
        audioCount={audioCount}
        subCount={subCount}
        exporting={exporting}
        progress={progress}
        exportEta={exportEta}
        onExport={() => void handleExport()}
        onAddToQueue={() => void addToBatch()}
        onCancelExport={() => void cancelExportJob()}
        canExport={!!file && !!title.trim() && ffmpegOk}
      />

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast t-${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {showOpen && (
        <OpenDialog
          recents={settings.recentFiles}
          onClose={() => setShowOpen(false)}
          onPick={(p) => {
            setShowOpen(false);
            void loadFile(p);
          }}
          onBrowse={async () => {
            const p = await window.api.dialog.openVideo();
            if (p) {
              setShowOpen(false);
              void loadFile(p);
            }
          }}
        />
      )}

      {showHistory && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistory(false)}
          onClear={() => void window.api.history.clear().then(refreshHistory)}
          onShow={(p) => void window.api.shellOps.showItem(p)}
          onReExport={handleReExport}
        />
      )}

      {showCmd && (
        <FFmpegCommandModal
          cmd={cmdStr}
          onClose={() => setShowCmd(false)}
          onCopy={() => toast(t('cmd_copied'), 'ok')}
        />
      )}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {showVisualSync && activeSub && cues.length > 0 && (
        <VisualSyncModal
          cues={cues}
          previewT={previewT}
          onSeek={seekToFileCue}
          onApply={(offset, speed) => updateSub(activeSub.id, { offset, speed })}
          onClose={() => setShowVisualSync(false)}
        />
      )}

      {showAdjustAll && cues.length > 0 && (
        <AdjustAllTimesModal
          cueCount={cues.length}
          selectedCueIdx={previewSelectedIdx}
          onApply={(deltaSec, fromIdx) => shiftAllCues(deltaSec, fromIdx)}
          onClose={() => setShowAdjustAll(false)}
        />
      )}

      {showFixErrors && cues.length > 0 && (
        <FixCommonErrorsModal
          cues={cues}
          minGapSec={settings.minGapSec}
          onApply={setCuesForActiveSub}
          onClose={() => setShowFixErrors(false)}
        />
      )}

      {showFindReplace && cues.length > 0 && (
        <FindReplaceModal
          cues={cues}
          selectedIdx={previewSelectedIdx}
          onApply={setCuesForActiveSub}
          onDuplicate={(idx) => duplicateCue(idx)}
          onClose={() => setShowFindReplace(false)}
        />
      )}

      {exportConfirm && (
        <ExportConfirmModal
          kind={exportConfirm === 'overwrite' ? 'overwrite' : 'double-apply'}
          fileInfo={exportConfirm === 'overwrite' ? overwriteFileInfo : undefined}
          onClose={() => {
            setExportConfirm(null);
            setOverwriteFileInfo(null);
          }}
          onConfirm={() => {
            const pending = exportConfirm;
            setExportConfirm(null);
            setOverwriteFileInfo(null);
            if (pending === 'mux' || pending === 'overwrite') void doMuxExport();
            else if (pending && typeof pending === 'object') void doExportSrt(pending.sub);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onChange={setOne}
          onChooseFolder={async () => window.api.dialog.chooseFolder(settings.defaultDestFolder)}
        />
      )}

      {showBatchQueue && (
        <BatchQueueModal
          items={batchQueue}
          exporting={exporting}
          onClose={() => setShowBatchQueue(false)}
          onRemove={(id) => setBatchQueue((q) => q.filter((x) => x.id !== id))}
          onAddMultiple={() => void addMultipleVideosToBatch()}
          onRunAll={() => {
            setShowBatchQueue(false);
            void runBatchQueue();
          }}
          onClearDone={() =>
            setBatchQueue((q) => q.filter((x) => x.status === 'pending' || x.status === 'running'))
          }
        />
      )}

      {showDiagnostics && <DiagnosticsModal onClose={() => setShowDiagnostics(false)} />}
      {whatsNewVersion && (
        <WhatsNewModal version={whatsNewVersion} onClose={() => setWhatsNewVersion(null)} />
      )}

      {dragOver && <div className="drop-overlay">{t('drag_overlay')}</div>}
    </div>
  );
}

export default function App() {
  const [settings, setOne] = useSettings();
  return (
    <ErrorBoundary>
      <I18nProvider lang={settings.lang ?? 'he'}>
        <AppContent settings={settings} setOne={setOne} />
      </I18nProvider>
    </ErrorBoundary>
  );
}

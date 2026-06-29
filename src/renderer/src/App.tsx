import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppSettings,
  CueWarningThresholds,
  ExportPlan,
  ExternalSub,
  MediaFile,
  SrtCue,
  Track,
} from '@shared/types';
import { mediaTimeForCueStart, transformCues } from '@shared/cue-sync';
import { buildExportPlan } from '@shared/export-plan';
import { estimateSubtitleOffset } from '@shared/auto-sync';
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
import { ErrorBoundary } from './components/ErrorBoundary';
import { useToasts } from './hooks/useToasts';
import { useSettings } from './hooks/useSettings';
import { useExport } from './hooks/useExport';
import { usePreview } from './hooks/usePreview';
import { joinPath } from './lib/path';
import { showNotification } from './lib/notify';
import { I18nProvider, useT } from './hooks/useTranslation';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useCueEditing } from './hooks/useCueEditing';

interface LogLine {
  time: string;
  level: 'info' | 'ok' | 'warn' | 'err';
  msg: string;
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
    [pushLog]
  );

  const { exporting, progress, eta: exportEta, start: runExportJob, cancel: cancelExportJob, runBatch } =
    useExport(onExportLog);

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
  const cues: SrtCue[] = activeSubId ? cuesBySubId[activeSubId] ?? [] : [];

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
    [toast, t]
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
  const [exportConfirm, setExportConfirm] = useState<'mux' | 'overwrite' | { kind: 'srt'; sub: ExternalSub } | null>(
    null
  );
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [showBatchQueue, setShowBatchQueue] = useState(false);
  const [previewSelectedIdx, setPreviewSelectedIdx] = useState(-1);
  const [cmdStr, setCmdStr] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // ── Unified undo/redo: track toggles + cue edits, in one chronological stack ─
  const { pushUndo, snapshotCues } = useUndoRedo({
    tracks,
    cuesBySubId,
    setTracks,
    setActiveSubId,
    setCuesBySubId,
    setExtSubs,
  });

  // ── bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const [plat, ver, ff, hist] = await Promise.all([
        window.api.app.platform(),
        window.api.app.version(),
        window.api.ffmpeg.status(),
        window.api.history.list(),
      ]);
      setIsWin(plat === 'win32');
      setAppVer(ver);
      setFfLine(ff.version ? ff.version.replace(/^ffmpeg\s+/i, '').slice(0, 42) : '');
      setFfmpegOk(ff.available);
      setHistory(hist);
    })();
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
  }, [file?.path, file?.durationSec, previewAudioId]);

  const {
    updateCue,
    deleteCue,
    insertCue,
    shiftCues,
    shiftAllCues,
    setCuesForActiveSub,
    splitCue,
    mergeCue,
    duplicateCue,
  } = useCueEditing({
    activeSubId,
    cuesBySubId,
    extSubs,
    previewT,
    snapshotCues,
    setCuesBySubId,
    setExtSubs,
    setEditedSubIds,
  });

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
    ]
  );

  const subOverlayStyle: SubOverlayStyle = useMemo(
    () => ({
      fontScale: settings.subFontScale,
      color: settings.subColor,
      style: settings.subStyle,
      position: settings.subPosition,
    }),
    [settings.subFontScale, settings.subColor, settings.subStyle, settings.subPosition]
  );

  const autoSyncActiveSub = useCallback((): void => {
    const sub = extSubs.find((s) => s.id === activeSubId);
    if (!sub || !peaks) {
      toast(t('auto_sync_hint'), 'warn');
      return;
    }
    const list = activeSubId ? cuesBySubId[activeSubId] ?? [] : [];
    if (list.length === 0) {
      toast(t('no_srt_loaded'), 'warn');
      return;
    }
    // Transform by current speed only; the estimate then equals the offset to set.
    const transformed = transformCues(list, { offset: 0, speed: sub.speed });
    const result = estimateSubtitleOffset(transformed, {
      min: peaks.min,
      max: peaks.max,
      peaksPerSec: peaks.peaksPerSec,
      duration: peaks.duration,
    });
    if (!result || result.score < 0.25) {
      toast(t('auto_sync_failed'), 'warn');
      return;
    }
    const offset = Math.round(result.offsetSec * 100) / 100;
    setExtSubs((subs) => subs.map((s) => (s.id === sub.id ? { ...s, offset } : s)));
    toast(`${t('auto_sync_applied')}: ${offset >= 0 ? '+' : ''}${offset.toFixed(2)}s`, 'ok');
  }, [activeSubId, extSubs, peaks, cuesBySubId, t, toast]);

  const seekToFileCue = useCallback(
    (fileT: number): void => {
      const sub = extSubs.find((s) => s.id === activeSubId);
      const opts = { offset: sub?.offset ?? 0, speed: sub?.speed ?? 1 };
      setPreviewTime(mediaTimeForCueStart(fileT, opts));
      setCenterTab('preview');
    },
    [activeSubId, extSubs, setPreviewTime]
  );

  const refreshHistory = async () => {
    const h = await window.api.history.list();
    setHistory(h);
  };

  const loadFile = async (pathStr: string) => {
    pushUndo();
    const r = await window.api.media.probe(pathStr);
    if (!r.ok) {
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
    setContainer(f.container || 'MKV');
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
  };

  const addSrtFromPaths = useCallback(async (paths: string[]) => {
    let added = false;
    for (const p of paths) {
      const r = await window.api.srt.add(p);
      if (r.ok) {
        const sub = r.sub;
        setExtSubs((s) => [...s, sub]);
        setActiveSubId(sub.id);
        if (r.cues) {
          setCuesBySubId((m) => ({ ...m, [sub.id]: r.cues! }));
        }
        toast(`${t('subs_added')}: ${sub.name}`, 'ok');
        added = true;
      } else toast(r.error || t('error'), 'err');
    }
    if (added) setCenterTab('preview');
  }, [t]);

  const pickSrtFiles = async () => {
    const paths = await window.api.dialog.openSrt();
    await addSrtFromPaths(paths);
  };

  const subNeedsDoubleApplyWarn = useCallback(
    (sub: ExternalSub): boolean => {
      const global = Math.abs(sub.offset) > 1e-6 || Math.abs(sub.speed - 1) > 1e-5;
      return editedSubIds.has(sub.id) && global;
    },
    [editedSubIds]
  );

  const anyExtSubDoubleApply = useCallback(
    (): boolean => extSubs.some((s) => subNeedsDoubleApplyWarn(s)),
    [extSubs, subNeedsDoubleApplyWarn]
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
      })
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
      }))
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
    const base =
      contentType === 'movie' ? `${title} (${year})` : `${title} S${season}E${episode}`;
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
  const subCount =
    tracks.filter((t) => t.keep && t.kind === 'S').length + extSubs.length;

  const activeSub = extSubs.find((s) => s.id === activeSubId);

  const buildPlan = useCallback(
    (): ExportPlan | null =>
      buildExportPlan({
        file,
        tracks,
        extSubs,
        outPath,
        outName,
        container,
        burnInSubs: settings.burnInSubs,
        activeSubId,
        videoEncode: {
          encoder: settings.videoEncoder,
          preset: settings.videoPreset,
          quality: settings.videoQuality,
        },
      }),
    [
      file,
      tracks,
      extSubs,
      outPath,
      outName,
      container,
      settings.burnInSubs,
      activeSubId,
      settings.videoEncoder,
      settings.videoPreset,
      settings.videoQuality,
    ]
  );

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
    if (!file || !title.trim()) { toast(t('missing_title_file'), 'warn'); return; }
    if (!destFolder.trim()) { toast(t('dest_folder_missing'), 'warn'); return; }
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
          if (wr.ok && wr.path) { p = wr.path; planExt[i] = { ...planExt[i], path: p }; }
          else { toast(`${t('write_edited_srt_failed')}: ${s.name}`, 'err'); return; }
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

  const runBatchQueue = async (): Promise<void> => {
    const pending = batchQueue.filter((x) => x.status === 'pending');
    await runBatch(pending, (idx, ok, cancelled, error) => {
      const item = pending[idx];
      setBatchQueue((q) =>
        q.map((x) =>
          x.id === item.id
            ? { ...x, status: ok ? 'done' : cancelled ? 'pending' : 'failed', error }
            : x
        )
      );
    });
    await refreshHistory();
    showNotification('SubMixer', t('notify_batch_done'));
  };

  const handleReExport = useCallback(async (plan: ExportPlan, durationSec: number): Promise<void> => {
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
  }, [exporting, t, runExportJob, refreshHistory, pushLog]);

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
    toast,
  });
  menuRef.current = {
    pickSrtFiles,
    handleExport,
    cancelExportJob,
    refreshHistory,
    openCmdModal,
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
          ff.available ? 'ok' : 'warn'
        );
      });
    const about = () =>
      void window.api.app.version().then((v) =>
        alert(`SubMixer ${v}\n\n${t('about_text')}`)
      );

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
    ];
    return () => unsubs.forEach((u) => u());
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
          <button className="btn compact" type="button" onClick={() => window.api.ffmpeg.openInstallPage()}>
            {t('download')}
          </button>
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
            onContainer={setContainer}
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
                {cues.length > 0 && (
                  <span className="center-tab-count mono">{cues.length}</span>
                )}
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
            onAutoSync={autoSyncActiveSub}
            autoSyncReady={!!peaks && cues.length > 0}
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
          onClose={() => setExportConfirm(null)}
          onConfirm={() => {
            const pending = exportConfirm;
            setExportConfirm(null);
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
          onRunAll={() => { setShowBatchQueue(false); void runBatchQueue(); }}
          onClearDone={() => setBatchQueue((q) => q.filter((x) => x.status === 'pending' || x.status === 'running'))}
        />
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExportPlan, ExternalSub, MediaFile, SrtCue, Track } from '@shared/types';
import { TopBar } from './components/TopBar';
import { SourcePanel } from './components/SourcePanel';
import { ContentDetails } from './components/ContentDetails';
import { TracksList, type Filter } from './components/TracksList';
import { PreviewBar } from './components/PreviewBar';
import { SubsDrawer } from './components/SubsDrawer';
import { BottomBar } from './components/BottomBar';
import { OpenDialog } from './components/modals/OpenDialog';
import { HistoryModal } from './components/modals/HistoryModal';
import { FFmpegCommandModal } from './components/modals/FFmpegCommand';
import { SettingsModal } from './components/modals/Settings';
import { useToasts } from './hooks/useToasts';
import { useSettings } from './hooks/useSettings';
import { useExport } from './hooks/useExport';
import { joinPath } from './lib/path';

interface LogLine {
  time: string;
  level: 'info' | 'ok' | 'warn' | 'err';
  msg: string;
}

function cloneTracks(t: Track[]): Track[] {
  return t.map((x) => ({ ...x }));
}

export default function App() {
  const [settings, setOne] = useSettings();
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

  const { exporting, progress, eta: exportEta, start: runExportJob, cancel: cancelExportJob } =
    useExport(onExportLog);

  const [isWin, setIsWin] = useState(true);
  const [appVer, setAppVer] = useState('');
  const [ffLine, setFfLine] = useState('');
  const [ffmpegOk, setFfmpegOk] = useState(true);

  const [file, setFile] = useState<MediaFile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [extSubs, setExtSubs] = useState<ExternalSub[]>([]);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [cues, setCues] = useState<SrtCue[]>([]);

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewAudioId, setPreviewAudioId] = useState<number | null>(null);

  const [previewT, setPreviewT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepPct, setPrepPct] = useState(0);
  const extractKeyRef = useRef<string>('');

  const [history, setHistory] = useState<import('@shared/types').ExportRecord[]>([]);

  const [showOpen, setShowOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cmdStr, setCmdStr] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const undoStack = useRef<Track[][]>([]);
  const pushUndo = useCallback(() => {
    undoStack.current.push(cloneTracks(tracks));
    if (undoStack.current.length > 50) undoStack.current.shift();
  }, [tracks]);

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
    return window.api.preview.onProgress((p) => setPrepPct(p.percent));
  }, []);

  // Reload cues when active external sub changes
  useEffect(() => {
    const sub = extSubs.find((s) => s.id === activeSubId);
    if (!sub) {
      setCues([]);
      return;
    }
    void window.api.srt.read(sub.path).then((r) => {
      if (r.ok && r.cues) setCues(r.cues);
      else setCues([]);
    });
  }, [activeSubId, extSubs]);

  // Ctrl+Z undo tracks
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

  // Audio element — sync time → preview scrubber
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

  // Reset preview extract when file / audio target changes
  useEffect(() => {
    setAudioUrl(null);
    extractKeyRef.current = '';
    setPlaying(false);
    setPrepLoading(false);
  }, [file?.path, previewAudioId]);

  const refreshHistory = async () => {
    const h = await window.api.history.list();
    setHistory(h);
  };

  const loadFile = async (pathStr: string) => {
    pushUndo();
    const r = await window.api.media.probe(pathStr);
    if (!r.ok || !r.file) {
      toast(r.error || 'שגיאת טעינה', 'err');
      return;
    }
    const f = r.file;
    setFile(f);
    setTracks(f.tracks.map((t) => ({ ...t })));
    setExtSubs([]);
    setActiveSubId(null);
    setTitle(f.title);
    setYear(f.year);
    setContainer(f.container || 'MKV');
    setPreviewT(0);
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

  const pickSrtFiles = async () => {
    const paths = await window.api.dialog.openSrt();
    for (const p of paths) {
      const r = await window.api.srt.add(p);
      if (r.ok && r.sub) {
        setExtSubs((s) => [...s, r.sub!]);
        setActiveSubId(r.sub!.id);
        toast(`נוספו כתוביות: ${r.sub!.name}`, 'ok');
      } else toast(r.error || 'שגיאה', 'err');
    }
  };

  const onDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0] as File & { path?: string };
    if (f?.path) void loadFile(f.path);
  };

  const setPreviewTime = (t: number) => {
    setPreviewT(t);
    const a = audioRef.current;
    if (a && audioUrl) a.currentTime = t;
  };

  const handleTogglePlay = async () => {
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
      tr.map((t) => {
        if (t.id !== id) return t;
        if (t.locked) {
          toast('מסלול וידאו ראשי נדרש', 'warn');
          return t;
        }
        return { ...t, keep: !t.keep };
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
    if (activeSubId === id) {
      const rest = extSubs.filter((x) => x.id !== id);
      setActiveSubId(rest[0]?.id ?? null);
    }
  };

  const outName = useMemo(() => {
    const c = container.toLowerCase();
    if (overrideName && customName) return customName + '.' + c;
    if (contentType === 'movie') return `${title} (${year}).${c}`;
    return `${title} - S${season}E${episode}.${c}`;
  }, [overrideName, customName, container, contentType, title, year, season, episode]);

  const outPath = useMemo(() => {
    const base =
      contentType === 'movie' ? `${title} (${year})` : `${title} S${season}E${episode}`;
    return joinPath(isWin, destFolder, base, outName);
  }, [isWin, destFolder, contentType, title, year, season, episode, outName]);

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

  const buildPlan = useCallback((): ExportPlan | null => {
    if (!file) return null;
    const v = tracks.find((t) => t.kind === 'V' && t.keep) || tracks.find((t) => t.kind === 'V');
    const videoTrackId = v?.id ?? null;
    const audioTracks = tracks
      .filter((t) => t.kind === 'A' && t.keep)
      .map((t) => ({ id: t.id, lang: t.lang, def: t.def, forced: t.forced }));
    const embeddedSubs = tracks
      .filter((t) => t.kind === 'S' && t.keep)
      .map((t) => ({ id: t.id, lang: t.lang, def: t.def, forced: t.forced }));
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
    return {
      inputFile: file.path,
      externalSubs: extMeta,
      videoTrackId,
      audioTracks,
      embeddedSubs,
      outputPath: outPath,
      container: container.toLowerCase() === 'mp4' ? 'mp4' : 'mkv',
    };
  }, [file, tracks, extSubs, outPath, container]);

  const openCmdModal = async () => {
    const plan = buildPlan();
    if (!plan) {
      toast('אין קובץ טעון', 'warn');
      return;
    }
    const paths = extSubs.map((s) => s.path);
    const s = await window.api.exporting.cmdString(plan, paths);
    setCmdStr(s);
    setShowCmd(true);
  };

  const handleExport = async () => {
    if (!file || !title.trim()) {
      toast('חסר כותרת או קובץ', 'warn');
      return;
    }
    const plan = buildPlan();
    if (!plan) return;
    const extForRun = extSubs.map((s) => ({
      path: s.path,
      offset: s.offset,
      speed: s.speed,
      encoding: s.encoding,
    }));
    pushLog(`מתחיל ייצוא · יעד: ${outName}`, 'info');
    toast('ייצוא התחיל', 'info');
    const r = await runExportJob(plan, file.durationSec, extForRun);
    if (r.ok) {
      toast('הייצוא הסתיים בהצלחה ✓', 'ok');
      pushLog(`נכתב: ${outName}`, 'ok');
    } else if (r.cancelled) {
      toast('הייצוא בוטל', 'warn');
      pushLog('הייצוא בוטל', 'warn');
    } else {
      toast(r.error || 'ייצוא נכשל', 'err');
      pushLog(r.error || 'ייצוא נכשל', 'err');
    }
    await refreshHistory();
  };

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
          ff.available ? 'FFmpeg זמין' : 'FFmpeg לא נמצא ב-PATH',
          ff.available ? 'ok' : 'warn'
        );
      });
    const about = () =>
      void window.api.app.version().then((v) =>
        alert(`SubMixer ${v}\n\nElectron + React + FFmpeg מהמערכת (PATH).`)
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
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDropFile}
    >
      {!ffmpegOk && (
        <div className="ffmpeg-banner">
          <span>FFmpeg/FFprobe לא זוהו ב-PATH — תצוגה מקדימה וייצוא לא יעבדו.</span>
          <button className="btn compact" type="button" onClick={() => window.api.ffmpeg.openInstallPage()}>
            הורד
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
            onTitle={setTitle}
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
            overrideName={overrideName}
            onOverrideName={setOverrideName}
            customName={customName}
            onCustomName={setCustomName}
          />
          <div className="out-card">
            <div className="out-l">יישמר בתור</div>
            <div className="out-n mono" title={outPath}>
              {outName}
            </div>
            <div className="out-path mono">{outPath}</div>
          </div>
        </aside>

        <main className="col-center">
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
          {file && (
            <PreviewBar
              durationSec={file.durationSec}
              previewT={previewT}
              onPreviewT={setPreviewTime}
              playing={playing}
              onTogglePlay={() => void handleTogglePlay()}
              prepLoading={prepLoading}
              prepPct={prepPct}
              audioReady={previewAudioId !== null}
              audioRef={audioRef}
              audioUrl={audioUrl}
              cues={cues}
              subOffset={activeSub?.offset ?? 0}
              subSpeed={activeSub?.speed ?? 1}
            />
          )}
        </main>

        {drawerOpen && (
          <SubsDrawer
            extSubs={extSubs}
            activeSubId={activeSubId}
            onSelectSub={setActiveSubId}
            onAddSubs={() => void pickSrtFiles()}
            onRemoveSub={removeSub}
            onUpdateSub={updateSub}
          />
        )}
      </div>

      <BottomBar
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((d) => !d)}
        onShowFfmpeg={() => void openCmdModal()}
        logs={logs}
        estMB={estSize}
        audioCount={audioCount}
        subCount={subCount}
        exporting={exporting}
        progress={progress}
        exportEta={exportEta}
        onExport={() => void handleExport()}
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
        />
      )}

      {showCmd && (
        <FFmpegCommandModal
          cmd={cmdStr}
          onClose={() => setShowCmd(false)}
          onCopy={() => toast('הפקודה הועתקה', 'ok')}
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

      {dragOver && <div className="drop-overlay">שחרר כאן כדי לפתוח קובץ</div>}
    </div>
  );
}

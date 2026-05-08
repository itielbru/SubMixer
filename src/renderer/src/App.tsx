import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExportPlan } from '@shared/types';
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
import { ExportValidationModal, type Warning } from './components/modals/ExportValidation';
import { useToasts } from './hooks/useToasts';
import { useSettings } from './hooks/useSettings';
import { useExport } from './hooks/useExport';
import { useMediaFile } from './hooks/useMediaFile';
import { usePreview } from './hooks/usePreview';
import { useSubtitles } from './hooks/useSubtitles';
import { joinPath } from './lib/path';

interface LogLine {
  time: string;
  level: 'info' | 'ok' | 'warn' | 'err';
  msg: string;
}

export default function App() {
  const [settings, setOne] = useSettings();
  const [toasts, toast] = useToasts();
  const [logs, setLogs] = useState<LogLine[]>([]);

  const pushLog = useCallback((msg: string, level: LogLine['level'] = 'info') => {
    const time = new Date().toTimeString().slice(0, 8);
    setLogs((l) => [...l, { time, level, msg }].slice(-400));
  }, []);

  const onExportLog = useCallback((line: string) => pushLog(line, 'info'), [pushLog]);

  const {
    exporting,
    progress,
    eta: exportEta,
    start: runExportJob,
    cancel: cancelExportJob,
  } = useExport(onExportLog);

  // ── Domain hooks ──────────────────────────────────────────────────────────
  const {
    file,
    tracks,
    activeId,
    setActiveId,
    previewAudioId,
    loadFile: loadMediaFile,
    toggleKeep,
    setDefault,
    setForced,
    undoTracks,
  } = useMediaFile(toast, pushLog);

  const {
    extSubs,
    activeSubId,
    setActiveSubId,
    cues,
    activeSub,
    pickSrtFiles,
    updateSub,
    removeSub,
    resetSubs,
    undoSub,
    reorderSubs,
  } = useSubtitles(toast);

  const {
    previewT,
    playing,
    audioRef,
    audioUrl,
    prepLoading,
    prepPct,
    handleTogglePlay,
    setPreviewTime,
  } = usePreview(file, previewAudioId, toast);

  // ── App-level state ───────────────────────────────────────────────────────
  const [isWin, setIsWin] = useState(true);
  const [appVer, setAppVer] = useState('');
  const [ffLine, setFfLine] = useState('');
  const [ffmpegOk, setFfmpegOk] = useState(true);

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

  const [history, setHistory] = useState<import('@shared/types').ExportRecord[]>([]);

  const [showOpen, setShowOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<Warning[] | null>(null);
  const [cmdStr, setCmdStr] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
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

  // ── Unified Ctrl+Z ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        if (!undoSub()) undoTracks();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoSub, undoTracks]);

  // ── File loading ──────────────────────────────────────────────────────────
  const loadFile = useCallback(
    async (pathStr: string) => {
      resetSubs();
      const f = await loadMediaFile(pathStr);
      if (!f) return;
      setTitle(f.title);
      setYear(f.year);
      setContainer(f.container || 'MKV');
    },
    [loadMediaFile, resetSubs]
  );

  const onDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0] as File & { path?: string };
    if (f?.path) void loadFile(f.path);
  };

  // ── Derived values ────────────────────────────────────────────────────────
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

  // Size estimate using actual per-track bitrates where available
  const estSize = useMemo(() => {
    if (!file) return 0;
    const dur = file.durationSec;
    if (dur <= 0) return file.sizeBytes / 1024;
    let savedBytes = 0;
    for (const tr of tracks.filter((t) => !t.keep)) {
      if (tr.bitrate) {
        savedBytes += tr.bitrate * dur;
      } else {
        if (tr.kind === 'A') savedBytes += file.sizeBytes * 0.05;
        else if (tr.kind === 'S') savedBytes += file.sizeBytes * 0.005;
      }
    }
    return Math.max(0, file.sizeBytes - savedBytes) / 1024;
  }, [file, tracks]);

  const audioCount = tracks.filter((t) => t.keep && t.kind === 'A').length;
  const subCount = tracks.filter((t) => t.keep && t.kind === 'S').length + extSubs.length;

  // ── Export ────────────────────────────────────────────────────────────────
  const buildPlan = useCallback((): ExportPlan | null => {
    if (!file) return null;
    const v = tracks.find((t) => t.kind === 'V' && t.keep) || tracks.find((t) => t.kind === 'V');
    return {
      inputFile: file.path,
      externalSubs: extSubs.map((s) => ({
        path: s.path,
        lang: s.lang,
        def: s.def,
        forced: s.forced,
        offset: s.offset,
        speed: s.speed,
        trackName: s.trackName,
        encoding: s.encoding,
      })),
      videoTrackId: v?.id ?? null,
      audioTracks: tracks
        .filter((t) => t.kind === 'A' && t.keep)
        .map((t) => ({ id: t.id, lang: t.lang, def: t.def, forced: t.forced, codec: t.codecName })),
      embeddedSubs: tracks
        .filter((t) => t.kind === 'S' && t.keep)
        .map((t) => ({ id: t.id, lang: t.lang, def: t.def, forced: t.forced })),
      outputPath: outPath,
      container: container.toLowerCase() === 'mp4' ? 'mp4' : 'mkv',
    };
  }, [file, tracks, extSubs, outPath, container]);

  const refreshHistory = async () => {
    setHistory(await window.api.history.list());
  };

  const openCmdModal = async () => {
    const plan = buildPlan();
    if (!plan) {
      toast('אין קובץ טעון', 'warn');
      return;
    }
    setCmdStr(await window.api.exporting.cmdString(plan, extSubs.map((s) => s.path)));
    setShowCmd(true);
  };

  const validateBeforeExport = useCallback((): Warning[] => {
    const w: Warning[] = [];
    const audioKept = tracks.filter((t) => t.kind === 'A' && t.keep);
    const audioDef = audioKept.filter((t) => t.def);
    const subKept = tracks.filter((t) => t.kind === 'S' && t.keep);
    const allSubs = subKept.length + extSubs.length;

    if (audioKept.length === 0)
      w.push({ level: 'err', msg: 'אין מסלול אודיו מסומן לשמירה — הקובץ ייוצא ללא קול.' });
    if (audioDef.length === 0 && audioKept.length > 0)
      w.push({ level: 'warn', msg: 'אף מסלול אודיו אינו מסומן כברירת מחדל.' });
    if (audioDef.length > 1)
      w.push({ level: 'warn', msg: `יש ${audioDef.length} מסלולי אודיו מסומנים כברירת מחדל — נגנים יבחרו אחד שרירותית.` });

    const subDef = [
      ...subKept.filter((t) => t.def),
      ...extSubs.filter((s) => s.def),
    ];
    if (subDef.length > 1)
      w.push({ level: 'warn', msg: `יש ${subDef.length} כתוביות מסומנות כברירת מחדל.` });
    if (allSubs === 0)
      w.push({ level: 'info', msg: 'אין כתוביות בקובץ הסופי.' });

    if (!destFolder.trim())
      w.push({ level: 'err', msg: 'תיקיית יעד ריקה — בחר תיקייה ב"תוכן ויעד".' });

    const estGB = estSize / (1024 * 1024);
    if (estGB > 10)
      w.push({ level: 'warn', msg: `אומדן גודל קובץ פלט ~${estGB.toFixed(1)}GB — ודא שיש מקום בכונן.` });

    if (container.toLowerCase() === 'mp4' && extSubs.length > 0)
      w.push({ level: 'warn', msg: 'MP4 תומך בכתוביות mov_text בלבד — ASS/SSA יומרו ועיצוב יאבד.' });

    return w;
  }, [tracks, extSubs, destFolder, estSize, container]);

  const runActualExport = async () => {
    if (!file) return;
    const plan = buildPlan();
    if (!plan) return;
    pushLog(`מתחיל ייצוא · יעד: ${outName}`, 'info');
    toast('ייצוא התחיל', 'info');
    const r = await runExportJob(
      plan,
      file.durationSec,
      extSubs.map((s) => ({ path: s.path, offset: s.offset, speed: s.speed, encoding: s.encoding }))
    );
    if (r.ok) {
      toast('הייצוא הסתיים בהצלחה ✓', 'ok');
      pushLog(`נכתב: ${outName}`, 'ok');
    } else if (r.cancelled) {
      toast('הייצוא בוטל', 'warn');
      pushLog('הייצוא בוטל', 'warn');
    } else {
      toast(r.error || 'ייצוא נכשל', 'err');
      pushLog(r.error || 'ייצוא נכשל', 'err');
      if (r.stderrTail) {
        setCmdStr(r.stderrTail);
        setShowCmd(true);
      }
    }
    await refreshHistory();
  };

  const handleExport = async () => {
    if (!file || !title.trim()) {
      toast('חסר כותרת או קובץ', 'warn');
      return;
    }
    const warnings = validateBeforeExport();
    if (warnings.length > 0) {
      setValidationWarnings(warnings);
      return;
    }
    const plan = buildPlan();
    if (!plan) return;
    pushLog(`מתחיל ייצוא · יעד: ${outName}`, 'info');
    toast('ייצוא התחיל', 'info');
    const r = await runExportJob(
      plan,
      file.durationSec,
      extSubs.map((s) => ({ path: s.path, offset: s.offset, speed: s.speed, encoding: s.encoding }))
    );
    if (r.ok) {
      toast('הייצוא הסתיים בהצלחה ✓', 'ok');
      pushLog(`נכתב: ${outName}`, 'ok');
    } else if (r.cancelled) {
      toast('הייצוא בוטל', 'warn');
      pushLog('הייצוא בוטל', 'warn');
    } else {
      toast(r.error || 'ייצוא נכשל', 'err');
      pushLog(r.error || 'ייצוא נכשל', 'err');
      if (r.stderrTail) {
        setCmdStr(r.stderrTail);
        setShowCmd(true);
      }
    }
    await refreshHistory();
  };

  // ── Menu IPC ──────────────────────────────────────────────────────────────
  const menuRef = useRef({ pickSrtFiles, handleExport, cancelExportJob, refreshHistory, openCmdModal, toast });
  menuRef.current = { pickSrtFiles, handleExport, cancelExportJob, refreshHistory, openCmdModal, toast };

  useEffect(() => {
    const unsubs = [
      window.api.menu.on('menu:openFile', () => setShowOpen(true)),
      window.api.menu.on('menu:addSrt', () => void menuRef.current.pickSrtFiles()),
      window.api.menu.on('menu:export', () => void menuRef.current.handleExport()),
      window.api.menu.on('menu:cancelExport', () => void menuRef.current.cancelExportJob()),
      window.api.menu.on('menu:toggleDrawer', () => setDrawerOpen((d) => !d)),
      window.api.menu.on('menu:history', () =>
        void menuRef.current.refreshHistory().then(() => setShowHistory(true))
      ),
      window.api.menu.on('menu:ffmpegCmd', () => void menuRef.current.openCmdModal()),
      window.api.menu.on('menu:checkFFmpeg', () =>
        void window.api.ffmpeg.status(true).then((ff) => {
          setFfmpegOk(ff.available);
          menuRef.current.toast(
            ff.available ? 'FFmpeg זמין' : 'FFmpeg לא נמצא ב-PATH',
            ff.available ? 'ok' : 'warn'
          );
        })
      ),
      window.api.menu.on('menu:about', () =>
        void window.api.app.version().then((v) =>
          alert(`SubMixer ${v}\n\nElectron + React + FFmpeg מהמערכת (PATH).`)
        )
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
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
          <button
            className="btn compact"
            type="button"
            onClick={() => window.api.ffmpeg.openInstallPage()}
          >
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
            onBrowseFolder={async () => {
              const d = await window.api.dialog.chooseFolder(destFolder);
              if (d) setDestFolder(d);
            }}
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
          {!file ? (
            <div className="welcome">
              <div className="welcome-card">
                <div className="welcome-icon">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="m10 11 5 3-5 3z" fill="currentColor" />
                  </svg>
                </div>
                <div className="welcome-title">ברוך הבא ל-SubMixer</div>
                <div className="welcome-sub">
                  ערכו ומזגו מסלולי וידאו, אודיו וכתוביות חיצוניות עם סנכרון מדויק —
                  <br />
                  הכול דרך FFmpeg של המערכת.
                </div>
                <div className="welcome-actions">
                  <button className="btn primary" type="button" onClick={() => setShowOpen(true)}>
                    פתח קובץ וידאו
                  </button>
                  <button className="btn" type="button" onClick={() => void pickSrtFiles()}>
                    הוסף כתוביות
                  </button>
                </div>
                <div className="welcome-steps">
                  <div className="welcome-step">
                    <div className="welcome-step-n">1</div>
                    <div className="welcome-step-t">פתח וידאו</div>
                    <div className="welcome-step-d">גרור או בחר קובץ MKV / MP4</div>
                  </div>
                  <div className="welcome-step">
                    <div className="welcome-step-n">2</div>
                    <div className="welcome-step-t">סדר מסלולים</div>
                    <div className="welcome-step-d">בחר אילו לשמור, סנכרן כתוביות</div>
                  </div>
                  <div className="welcome-step">
                    <div className="welcome-step-n">3</div>
                    <div className="welcome-step-t">ייצא</div>
                    <div className="welcome-step-d">קובץ חדש נשמר ביעד שבחרת</div>
                  </div>
                </div>
                <div className="welcome-hint">
                  טיפ: גרירת קובץ לכל מקום בחלון תפתח אותו · <kbd>Ctrl</kbd>+<kbd>O</kbd> לפתיחה ·{' '}
                  <kbd>Ctrl</kbd>+<kbd>E</kbd> לייצוא
                </div>
              </div>
            </div>
          ) : (
            <>
              <TracksList
                tracks={tracks}
                extSubs={extSubs}
                activeId={activeId}
                filter={filter}
                search={search}
                onFilter={setFilter}
                onSearch={setSearch}
                onSelect={setActiveId}
                onToggleKeep={toggleKeep}
                onSetDefault={setDefault}
                onSetForced={setForced}
              />
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
            </>
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
            onReorderSubs={reorderSubs}
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

      {validationWarnings && (
        <ExportValidationModal
          warnings={validationWarnings}
          onClose={() => setValidationWarnings(null)}
          onConfirm={() => {
            setValidationWarnings(null);
            void runActualExport();
          }}
        />
      )}

      {dragOver && <div className="drop-overlay">שחרר כאן כדי לפתוח קובץ</div>}
    </div>
  );
}

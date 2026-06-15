import React from 'react';
import type { AppSettings, ExportPlan, ExternalSub, SrtCue } from '@shared/types';
import { useT } from '../hooks/useTranslation';
import { OpenDialog } from '../components/modals/OpenDialog';
import { HistoryModal } from '../components/modals/HistoryModal';
import { FFmpegCommandModal } from '../components/modals/FFmpegCommand';
import { ShortcutsModal } from '../components/modals/ShortcutsModal';
import { VisualSyncModal } from '../components/modals/VisualSyncModal';
import { AdjustAllTimesModal } from '../components/modals/AdjustAllTimesModal';
import { FixCommonErrorsModal } from '../components/modals/FixCommonErrorsModal';
import { FindReplaceModal } from '../components/modals/FindReplaceModal';
import { ExportConfirmModal } from '../components/modals/ExportConfirmModal';
import { SettingsModal } from '../components/modals/Settings';
import { BatchQueueModal, type BatchItem } from '../components/modals/BatchQueueModal';
import { DiagnosticsModal } from '../components/modals/DiagnosticsModal';
import { WhatsNewModal } from '../components/modals/WhatsNewModal';
import { useModalStore } from '../state/modalStore';
import type { ExportRecord } from '@shared/types';
import type { ToastKind } from '../hooks/useToasts';

export interface ModalsHostCtx {
  settings: AppSettings;
  setOne: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  cues: SrtCue[];
  activeSub: ExternalSub | null | undefined;
  previewT: number;
  previewSelectedIdx: number;
  exporting: boolean;
  batchQueue: BatchItem[];
  cmdStr: string;
  history: ExportRecord[];
  loadFile: (p: string) => Promise<void>;
  handleReExport: (plan: ExportPlan, durationSec: number) => Promise<void>;
  toast: (msg: string, kind?: ToastKind) => void;
  seekToFileCue: (t: number) => void;
  updateSub: (id: string, patch: Partial<ExternalSub>) => void;
  shiftAllCues: (deltaSec: number, fromIdx: number) => void;
  setCuesForActiveSub: (next: SrtCue[]) => void;
  duplicateCue: (idx: number) => void;
  doMuxExport: () => Promise<void>;
  doExportSrt: (sub: ExternalSub) => Promise<void>;
  refreshHistory: () => Promise<void>;
  runBatchQueue: () => Promise<void>;
  addMultipleVideosToBatch: () => Promise<void>;
  removeBatchItem: (id: string) => void;
  clearDoneBatch: () => void;
}

interface Props {
  ctx: ModalsHostCtx;
}

export function ModalsHost({ ctx }: Props) {
  const { t } = useT();
  const {
    showOpen,
    showHistory,
    showCmd,
    showSettings,
    showShortcuts,
    showVisualSync,
    showAdjustAll,
    showFixErrors,
    showFindReplace,
    showBatchQueue,
    showDiagnostics,
    exportConfirm,
    overwriteFileInfo,
    whatsNewVersion,
    closeModal,
    setExportConfirm,
    setOverwriteFileInfo,
    setWhatsNewVersion,
  } = useModalStore();

  const {
    settings,
    setOne,
    cues,
    activeSub,
    previewT,
    previewSelectedIdx,
    exporting,
    batchQueue,
    cmdStr,
    history,
    loadFile,
    handleReExport,
    toast,
    seekToFileCue,
    updateSub,
    shiftAllCues,
    setCuesForActiveSub,
    duplicateCue,
    doMuxExport,
    doExportSrt,
    refreshHistory,
    runBatchQueue,
    addMultipleVideosToBatch,
    removeBatchItem,
    clearDoneBatch,
  } = ctx;

  return (
    <>
      {showOpen && (
        <OpenDialog
          recents={settings.recentFiles}
          onClose={() => closeModal('open')}
          onPick={(p) => {
            closeModal('open');
            void loadFile(p);
          }}
          onBrowse={async () => {
            const p = await window.api.dialog.openVideo();
            if (p) {
              closeModal('open');
              void loadFile(p);
            }
          }}
        />
      )}

      {showHistory && (
        <HistoryModal
          history={history}
          onClose={() => closeModal('history')}
          onClear={() => void window.api.history.clear().then(refreshHistory)}
          onShow={(p) => void window.api.shellOps.showItem(p)}
          onReExport={handleReExport}
        />
      )}

      {showCmd && (
        <FFmpegCommandModal
          cmd={cmdStr}
          onClose={() => closeModal('cmd')}
          onCopy={() => toast(t('cmd_copied'), 'ok')}
        />
      )}

      {showShortcuts && (
        <ShortcutsModal
          keybindings={settings.keybindings}
          onSaveKeybinding={(id, key) =>
            setOne('keybindings', { ...settings.keybindings, [id]: key })
          }
          onResetKeybinding={(id) => {
            const next = { ...settings.keybindings };
            delete next[id];
            setOne('keybindings', next);
          }}
          onClose={() => closeModal('shortcuts')}
        />
      )}

      {showVisualSync && activeSub && cues.length > 0 && (
        <VisualSyncModal
          cues={cues}
          previewT={previewT}
          onSeek={seekToFileCue}
          onApply={(offset, speed) => updateSub(activeSub.id, { offset, speed })}
          onClose={() => closeModal('visualSync')}
        />
      )}

      {showAdjustAll && cues.length > 0 && (
        <AdjustAllTimesModal
          cueCount={cues.length}
          selectedCueIdx={previewSelectedIdx}
          onApply={(deltaSec, fromIdx) => shiftAllCues(deltaSec, fromIdx)}
          onClose={() => closeModal('adjustAll')}
        />
      )}

      {showFixErrors && cues.length > 0 && (
        <FixCommonErrorsModal
          cues={cues}
          minGapSec={settings.minGapSec}
          onApply={setCuesForActiveSub}
          onClose={() => closeModal('fixErrors')}
        />
      )}

      {showFindReplace && cues.length > 0 && (
        <FindReplaceModal
          cues={cues}
          selectedIdx={previewSelectedIdx}
          onApply={setCuesForActiveSub}
          onDuplicate={(idx) => duplicateCue(idx)}
          onClose={() => closeModal('findReplace')}
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
          onClose={() => closeModal('settings')}
          onChange={setOne}
          onChooseFolder={async () => window.api.dialog.chooseFolder(settings.defaultDestFolder)}
        />
      )}

      {showBatchQueue && (
        <BatchQueueModal
          items={batchQueue}
          exporting={exporting}
          onClose={() => closeModal('batchQueue')}
          onRemove={(id) => removeBatchItem(id)}
          onAddMultiple={() => void addMultipleVideosToBatch()}
          onRunAll={() => {
            closeModal('batchQueue');
            void runBatchQueue();
          }}
          onClearDone={() => clearDoneBatch()}
        />
      )}

      {showDiagnostics && <DiagnosticsModal onClose={() => closeModal('diagnostics')} />}

      {whatsNewVersion && (
        <WhatsNewModal version={whatsNewVersion} onClose={() => setWhatsNewVersion(null)} />
      )}
    </>
  );
}

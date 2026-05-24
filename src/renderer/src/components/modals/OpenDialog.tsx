import React from 'react';
import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';

interface OpenDialogProps {
  recents: string[];
  onClose: () => void;
  onPick: (path: string) => void;
  onBrowse: () => void;
}

export function OpenDialog({ recents, onClose, onPick, onBrowse }: OpenDialogProps) {
  const { t } = useT();
  const [drag, setDrag] = React.useState(false);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div className="modal-t">{t('open_dialog_title')}</div>
          <button className="icon-btn" onClick={onClose}>
            <Ico d={I.x} />
          </button>
        </div>
        <div className="modal-b">
          <div className="dlg-hint">{t('recent_hint')}</div>
          {recents.length === 0 && (
            <div className="dlg-hint" style={{ padding: '6px 0' }}>
              {t('no_recent_files')}
            </div>
          )}
          {recents.map((p) => {
            const name = p.replace(/^.*[\\/]/, '');
            const folder = p.replace(/[\\/][^\\/]*$/, '');
            return (
              <div key={p} className="dlg-row" onClick={() => onPick(p)}>
                <Ico d={I.file} size={16} />
                <div className="dlg-i">
                  <div className="dlg-n">{name}</div>
                  <div className="dlg-m mono">{folder}</div>
                </div>
              </div>
            );
          })}
          <button className="btn ghost full mt8" onClick={onBrowse}>
            <Ico d={I.folder} size={14} /> {t('browse_files')}
          </button>
          <div
            className="dlg-drop"
            style={drag ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0] as File & { path?: string };
              if (f?.path) onPick(f.path);
            }}
          >
            <Ico d={I.upload} size={20} />
            <div>{t('drop_mkv_mp4')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

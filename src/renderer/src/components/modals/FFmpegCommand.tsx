import React from 'react';
import { Ico, I } from '../ui/Icons';

interface Props {
  cmd: string;
  onClose: () => void;
  onCopy: () => void;
}

export function FFmpegCommandModal({ cmd, onClose, onCopy }: Props) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal cmd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div className="modal-t">פקודת FFmpeg</div>
          <button className="icon-btn" onClick={onClose}>
            <Ico d={I.x} />
          </button>
        </div>
        <div className="modal-b">
          <pre className="cmd-pre mono">{cmd}</pre>
          <button
            className="btn primary mt12"
            onClick={() => {
              navigator.clipboard?.writeText(cmd);
              onCopy();
            }}
          >
            <Ico d={I.copy} size={12} /> העתק ללוח
          </button>
        </div>
      </div>
    </div>
  );
}

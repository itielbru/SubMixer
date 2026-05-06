import React from 'react';
import type { MediaFile } from '@shared/types';
import { Section } from './ui/Section';
import { Ico, I } from './ui/Icons';

interface Props {
  file: MediaFile | null;
  onOpenFile: () => void;
}

export function SourcePanel({ file, onOpenFile }: Props) {
  if (!file) {
    return (
      <Section title="מקור">
        <div className="src-empty">
          <div className="src-empty-i">
            <Ico d={I.file} size={22} />
          </div>
          <div>לא נטען קובץ</div>
          <button className="btn primary mt8" onClick={onOpenFile}>
            <Ico d={I.folder} size={13} /> פתח קובץ וידאו
          </button>
        </div>
      </Section>
    );
  }

  return (
    <Section title="מקור">
      <div className="src-card">
        <div className="src-head">
          <Ico d={I.file} size={15} />
          <div className="src-name" title={file.name}>
            {file.name}
          </div>
        </div>
        <div className="src-meta">
          <span>
            <span className="k">CONT</span>
            {file.container}
          </span>
          <span>
            <span className="k">SIZE</span>
            {file.size}
          </span>
          <span>
            <span className="k">VID</span>
            {file.video}
          </span>
          <span>
            <span className="k">RES</span>
            {file.res}
          </span>
          <span>
            <span className="k">FPS</span>
            {file.fps}
          </span>
          <span>
            <span className="k">STR</span>
            {file.tracks.length}
          </span>
        </div>
        <button className="btn ghost full" onClick={onOpenFile}>
          <Ico d={I.upload} size={12} /> החלף קובץ
        </button>
      </div>
    </Section>
  );
}

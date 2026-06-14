import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CueWarningThresholds, SrtCue } from '@shared/types';
import { fmtTimeMs } from '../lib/format';
import { computeWarnings, type CueWarnings } from '../lib/cue-warnings';
import { warningReasonText } from '../lib/warning-text';
import { isRtlLang } from '../lib/rtl';
import { Ico, I } from './ui/Icons';
import { useT } from '../hooks/useTranslation';
import type { I18nKey } from '@shared/i18n';

interface Props {
  cues: SrtCue[];
  selectedIdx: number;
  playheadIdx: number;
  lang: string | undefined;
  onSelect: (idx: number) => void;
  onUpdateCue: (idx: number, patch: Partial<SrtCue>) => void;
  onDeleteCue: (idx: number) => void;
  onShiftSelection: (deltaSec: number, indices: number[]) => void;
  onSeek: (t: number) => void;
  warnThresholds: CueWarningThresholds;
  videoDurationSec?: number;
  onSplitCue?: (idx: number, mode: 'playhead' | 'newline') => void;
  onMergeCue?: (idx: number) => void;
  onOpenFixErrors?: () => void;
}

function countTimingIssues(warnings: CueWarnings[]): number {
  let n = 0;
  for (const w of warnings) {
    if (w.overlapsPrev || w.overlapsNext || w.shortGapPrev || w.shortGapNext) n++;
  }
  return n;
}

function CueListViewImpl({
  cues,
  selectedIdx,
  playheadIdx,
  lang,
  onSelect,
  onUpdateCue,
  onDeleteCue,
  onShiftSelection,
  onSeek,
  warnThresholds,
  videoDurationSec,
  onSplitCue,
  onMergeCue,
  onOpenFixErrors,
}: Props) {
  const { t } = useT();
  const rtl = isRtlLang(lang);
  const [multi, setMulti] = useState<Set<number>>(() => new Set());
  const [editingIdx, setEditingIdx] = useState(-1);
  const [draft, setDraft] = useState('');
  const [ctx, setCtx] = useState<{ idx: number; x: number; y: number } | null>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);

  // Virtualized rows: only render what is in (or near) the viewport so a list
  // with thousands of cues stays responsive while scrolling and during playback.
  const ROW_EST = 29;
  const OVERSCAN = 8;
  const [rowH, setRowH] = useState(ROW_EST);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(320);
  const scrollRafRef = useRef(0);

  const warnings = useMemo<CueWarnings[]>(
    () =>
      cues.map((c, i) =>
        computeWarnings(c, cues[i - 1], cues[i + 1], warnThresholds, videoDurationSec),
      ),
    [cues, warnThresholds, videoDurationSec],
  );

  const timingIssueCount = useMemo(() => countTimingIssues(warnings), [warnings]);

  // Measure the viewport height and actual row height for virtualization.
  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    const measure = (): void => {
      setViewH(el.clientHeight || 320);
      const row = el.querySelector<HTMLElement>('.cl-row');
      if (row && row.offsetHeight > 0) setRowH(row.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cues.length]);

  // Cancel a pending scroll rAF on unmount.
  useEffect(
    () => () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    },
    [],
  );

  // Keep the selected row in view — computed from the index so it works even
  // when the row is not currently mounted (virtualized off-screen).
  useEffect(() => {
    if (selectedIdx < 0) return;
    const el = rowsRef.current;
    if (!el) return;
    const top = selectedIdx * rowH;
    const bottom = top + rowH;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  }, [selectedIdx, rowH]);

  useEffect(() => {
    if (editingIdx >= 0 && editingIdx !== selectedIdx) {
      commitEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx]);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [ctx]);

  const commitEdit = (): void => {
    if (editingIdx >= 0 && cues[editingIdx] && draft !== cues[editingIdx].text) {
      onUpdateCue(editingIdx, { text: draft });
    }
    setEditingIdx(-1);
  };
  const cancelEdit = (): void => {
    setEditingIdx(-1);
  };
  const startEdit = (idx: number): void => {
    setEditingIdx(idx);
    setDraft(cues[idx]?.text ?? '');
    setTimeout(() => {
      editRef.current?.focus();
      editRef.current?.select();
    }, 0);
  };

  const onRowClick = (idx: number, e: React.MouseEvent): void => {
    if (e.shiftKey && selectedIdx >= 0) {
      const [lo, hi] = idx < selectedIdx ? [idx, selectedIdx] : [selectedIdx, idx];
      const next = new Set<number>();
      for (let i = lo; i <= hi; i++) next.add(i);
      setMulti(next);
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(multi);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      setMulti(next);
    } else {
      setMulti(new Set([idx]));
    }
    onSelect(idx);
    onSeek(cues[idx].start);
  };

  const selectedIndices: number[] = useMemo(() => {
    if (multi.size > 0) return Array.from(multi).sort((a, b) => a - b);
    if (selectedIdx >= 0) return [selectedIdx];
    return [];
  }, [multi, selectedIdx]);

  // Visible window for virtualization.
  const total = cues.length;
  const startIdx = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
  const endIdx = Math.min(total, Math.ceil((scrollTop + viewH) / rowH) + OVERSCAN);
  const topPad = startIdx * rowH;
  const botPad = Math.max(0, (total - endIdx) * rowH);

  const onRowsScroll = (): void => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const el = rowsRef.current;
      if (el) setScrollTop(el.scrollTop);
    });
  };

  const deleteSelection = (): void => {
    const sorted = selectedIndices.slice().sort((a, b) => b - a);
    for (const i of sorted) onDeleteCue(i);
    setMulti(new Set());
  };

  const openCtx = (idx: number, e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(idx);
    setCtx({ idx, x: e.clientX, y: e.clientY });
  };

  const fixLabel = t('fix_errors_btn_count' as I18nKey).replace('{n}', String(timingIssueCount));

  return (
    <div className="cl">
      <div className="cl-toolbar">
        <span className="cl-title">{t('cue_list_title')}</span>
        {selectedIndices.length > 1 && (
          <span className="cl-counter mono">
            {t('n_selected').replace('{n}', String(selectedIndices.length))}
          </span>
        )}
        <div className="cl-tools">
          {timingIssueCount > 0 && onOpenFixErrors && (
            <button className="cl-btn cl-btn-fix" type="button" onClick={onOpenFixErrors}>
              {fixLabel}
            </button>
          )}
          <button
            className="cl-btn"
            type="button"
            onClick={() => onShiftSelection(-0.1, selectedIndices)}
            disabled={selectedIndices.length === 0}
            title={t('shift_cues_tooltip')}
          >
            −100ms
          </button>
          <button
            className="cl-btn"
            type="button"
            onClick={() => onShiftSelection(0.1, selectedIndices)}
            disabled={selectedIndices.length === 0}
            title={t('shift_cues_tooltip')}
          >
            +100ms
          </button>
          <button
            className="cl-btn danger"
            type="button"
            onClick={deleteSelection}
            disabled={selectedIndices.length === 0}
            title={t('delete_selection_tip')}
          >
            <Ico d={I.trash} size={11} /> {t('delete_label')}
          </button>
        </div>
      </div>

      <p className="cl-file-hint">{t('file_edit_hint')}</p>

      <div className="cl-head" role="row" aria-hidden>
        <span>#</span>
        <span>{t('cl_start')}</span>
        <span>{t('cl_end')}</span>
        <span>{t('duration')}</span>
        <span>CPS</span>
        <span>{t('th_name_info')}</span>
        <span></span>
      </div>

      <div
        className="cl-rows"
        ref={rowsRef}
        onScroll={onRowsScroll}
        role="grid"
        aria-multiselectable="true"
        aria-rowcount={total}
        aria-label={t('cue_list_title')}
      >
        {topPad > 0 && <div style={{ height: topPad }} aria-hidden />}
        {cues.slice(startIdx, endIdx).map((cue, j) => {
          const i = startIdx + j;
          const w = warnings[i];
          const isSelected = selectedIdx === i || multi.has(i);
          const isPlayhead = playheadIdx === i;
          const isEditing = editingIdx === i;
          const dur = cue.end - cue.start;
          return (
            <div
              key={i}
              role="row"
              aria-selected={isSelected}
              aria-rowindex={i + 1}
              className={`cl-row lvl-${w.level} ${isSelected ? 'sel' : ''} ${
                isPlayhead ? 'now' : ''
              }`}
              data-idx={i}
              onClick={(e) => onRowClick(i, e)}
              onDoubleClick={() => startEdit(i)}
              onContextMenu={(e) => openCtx(i, e)}
              title={warningReasonText(w, t)}
            >
              <span className="cl-c-num mono">{i + 1}</span>
              <span className="cl-c-time mono">{fmtTimeMs(cue.start)}</span>
              <span className="cl-c-time mono">{fmtTimeMs(cue.end)}</span>
              <span className="cl-c-dur mono">{dur.toFixed(2)}s</span>
              <span className="cl-c-cps mono">{w.cps > 0 ? w.cps.toFixed(0) : '—'}</span>
              <span
                className="cl-c-text"
                dir={rtl ? 'rtl' : 'ltr'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isSelected) onRowClick(i, e);
                }}
              >
                {isEditing ? (
                  <textarea
                    ref={editRef}
                    className="cl-edit"
                    dir={rtl ? 'rtl' : 'ltr'}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        commitEdit();
                      }
                    }}
                  />
                ) : (
                  cue.text.replace(/\n/g, ' ⏎ ')
                )}
              </span>
              <span className="cl-c-actions">
                {onSplitCue && (
                  <>
                    <button
                      type="button"
                      className="cl-row-act"
                      title={t('ctx_split_playhead')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSplitCue(i, 'playhead');
                      }}
                    >
                      ⊘
                    </button>
                    <button
                      type="button"
                      className="cl-row-act"
                      title={t('ctx_split_newline')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSplitCue(i, 'newline');
                      }}
                    >
                      ⏎
                    </button>
                  </>
                )}
                {onMergeCue && i < cues.length - 1 && (
                  <button
                    type="button"
                    className="cl-row-act"
                    title={t('ctx_merge_next')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMergeCue(i);
                    }}
                  >
                    ⊕
                  </button>
                )}
                <span className="cl-c-warn" aria-hidden>
                  {w.level === 'err' ? '⛔' : w.level === 'warn' ? '⚠' : ''}
                </span>
              </span>
            </div>
          );
        })}
        {botPad > 0 && <div style={{ height: botPad }} aria-hidden />}
        {cues.length === 0 && <div className="cl-empty">{t('cl_no_cues')}</div>}
      </div>

      {ctx && (
        <div
          className="cl-ctx-menu"
          style={{ left: ctx.x, top: ctx.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {onSplitCue && (
            <>
              <button
                type="button"
                onClick={() => {
                  onSplitCue(ctx.idx, 'playhead');
                  setCtx(null);
                }}
              >
                {t('ctx_split_playhead')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSplitCue(ctx.idx, 'newline');
                  setCtx(null);
                }}
              >
                {t('ctx_split_newline')}
              </button>
            </>
          )}
          {onMergeCue && ctx.idx < cues.length - 1 && (
            <button
              type="button"
              onClick={() => {
                onMergeCue(ctx.idx);
                setCtx(null);
              }}
            >
              {t('ctx_merge_next')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Memoized so playback ticks (which only change unrelated parent state) do not
// re-render the entire cue list.
export const CueListView = React.memo(CueListViewImpl);

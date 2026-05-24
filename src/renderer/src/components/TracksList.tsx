import React from 'react';
import type { Track, ExternalSub } from '@shared/types';
import { Ico, I } from './ui/Icons';
import { useT } from '../hooks/useTranslation';

export type Filter = 'all' | 'audio' | 'sub';

interface UnifiedTrack {
  id: string;
  intId: number;
  external: boolean;
  extId?: string;
  kind: 'V' | 'A' | 'S';
  name: string;
  info: string;
  lang: string;
  def: boolean;
  forced: boolean;
  keep: boolean;
  locked?: boolean;
}

interface Props {
  tracks: Track[];
  extSubs: ExternalSub[];
  activeId: string | null;
  filter: Filter;
  search: string;
  onFilter: (f: Filter) => void;
  onSearch: (s: string) => void;
  onSelect: (id: string) => void;
  onToggleKeep: (id: number) => void;
  onSetDefault: (id: number) => void;
  onSetForced: (id: number) => void;
}

export function TracksList({
  tracks,
  extSubs,
  activeId,
  filter,
  search,
  onFilter,
  onSearch,
  onSelect,
  onToggleKeep,
  onSetDefault,
  onSetForced,
}: Props) {
  const { t } = useT();

  const all: UnifiedTrack[] = [
    ...tracks.map<UnifiedTrack>((tr) => ({
      id: String(tr.id),
      intId: tr.id,
      external: false,
      kind: tr.kind,
      name: tr.name,
      info: tr.info,
      lang: tr.lang,
      def: tr.def,
      forced: tr.forced,
      keep: tr.keep,
      locked: tr.locked,
    })),
    ...extSubs.map<UnifiedTrack>((s) => ({
      id: `ext:${s.id}`,
      intId: -1,
      external: true,
      extId: s.id,
      kind: 'S',
      name: `${s.trackName} · ${t('ext_file_suffix')}`,
      info: `${s.name} · ${s.size} · ${s.cues.toLocaleString()} cues · ${s.encoding}`,
      lang: s.lang,
      def: s.def,
      forced: s.forced,
      keep: true,
    })),
  ];

  const visible = all.filter((tr) => {
    if (filter === 'audio' && tr.kind !== 'A') return false;
    if (filter === 'sub' && tr.kind !== 'S') return false;
    if (
      search &&
      !(tr.name + ' ' + tr.info + ' ' + tr.lang).toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <>
      <div className="center-h">
        <div className="left-grp">
          <div className="title">{t('tracks')}</div>
          <div className="counter mono">
            {tracks.filter((x) => x.keep).length}/{tracks.length}
          </div>
        </div>
        <div className="right-grp">
          <div className="search">
            <Ico d={I.search} size={13} />
            <input
              placeholder={t('search_placeholder')}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <div className="seg">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => onFilter('all')}>
              {t('filter_all')}
            </button>
            <button className={filter === 'audio' ? 'on' : ''} onClick={() => onFilter('audio')}>
              {t('filter_audio')}
            </button>
            <button className={filter === 'sub' ? 'on' : ''} onClick={() => onFilter('sub')}>
              {t('filter_subs')}
            </button>
          </div>
        </div>
      </div>

      <div className="tracks-h">
        <span></span>
        <span></span>
        <span>#</span>
        <span>{t('th_name_info')}</span>
        <span>{t('th_lang')}</span>
        <span className="cf">D</span>
        <span className="cf">F</span>
        <span style={{ textAlign: 'end' }}>{t('th_keep')}</span>
      </div>

      <div className="tracks-body">
        {visible.length === 0 ? (
          <div className="empty">{t('no_tracks')}</div>
        ) : (
          visible.map((tr) => {
            const tone = tr.kind === 'V' ? 'video' : tr.kind === 'A' ? 'audio' : 'sub';
            const idStr = tr.external ? '·' : String(tr.intId).padStart(2, '0');
            return (
              <div
                key={tr.id}
                className="trow"
                data-keep={tr.keep}
                data-active={activeId === tr.id}
                onClick={() => onSelect(tr.id)}
              >
                <span className="rail"></span>
                <span className={`tag tag-${tone}`}>{tr.kind}</span>
                <span className="idx mono">{idStr}</span>
                <div className="info">
                  <div className="info-name">{tr.name}</div>
                  <div className="info-meta mono">{tr.info}</div>
                </div>
                <span className="lang mono">{tr.lang}</span>
                <span
                  className={`flag ${tr.def ? 'on' : ''}`}
                  style={tr.external ? { opacity: 0.25, pointerEvents: 'none' } : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!tr.locked && !tr.external) onSetDefault(tr.intId);
                  }}
                >
                  {tr.external ? '·' : 'D'}
                </span>
                <span
                  className={`flag ${tr.forced ? 'on' : ''}`}
                  style={tr.external ? { opacity: 0.25, pointerEvents: 'none' } : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!tr.locked && !tr.external) onSetForced(tr.intId);
                  }}
                >
                  {tr.external ? '·' : 'F'}
                </span>
                <div
                  className={`tog ${tr.keep ? 'on' : ''} ${tr.locked ? 'locked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!tr.external) onToggleKeep(tr.intId);
                  }}
                  style={tr.external ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
                >
                  <div className="tog-knob" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

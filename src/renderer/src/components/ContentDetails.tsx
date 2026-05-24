import React from 'react';
import { Section, Field } from './ui/Section';
import { Dropdown } from './ui/Dropdown';
import { Ico, I } from './ui/Icons';
import { useT } from '../hooks/useTranslation';

interface Props {
  contentType: 'movie' | 'series';
  onContentType: (v: 'movie' | 'series') => void;
  title: string;
  onTitle: (v: string) => void;
  year: string;
  onYear: (v: string) => void;
  season: string;
  onSeason: (v: string) => void;
  episode: string;
  onEpisode: (v: string) => void;
  container: string;
  onContainer: (v: string) => void;
  destFolder: string;
  onDestFolder: (v: string) => void;
  onBrowseFolder: () => void;
  exportUseContentFolder: boolean;
  onExportUseContentFolder: (v: boolean) => void;
  overrideName: boolean;
  onOverrideName: (v: boolean) => void;
  customName: string;
  onCustomName: (v: string) => void;
}

export function ContentDetails({
  contentType,
  onContentType,
  title,
  onTitle,
  year,
  onYear,
  season,
  onSeason,
  episode,
  onEpisode,
  container,
  onContainer,
  destFolder,
  onDestFolder,
  onBrowseFolder,
  exportUseContentFolder,
  onExportUseContentFolder,
  overrideName,
  onOverrideName,
  customName,
  onCustomName,
}: Props) {
  const { t } = useT();

  return (
    <Section title={t('content_details')}>
      <Field label={t('content_type')}>
        <div className="seg-mode">
          <button
            className={contentType === 'movie' ? 'on' : ''}
            type="button"
            onClick={() => onContentType('movie')}
          >
            {t('movie')}
          </button>
          <button
            className={contentType === 'series' ? 'on' : ''}
            type="button"
            onClick={() => onContentType('series')}
          >
            {t('series')}
          </button>
        </div>
      </Field>
      <Field label={t('name_label')}>
        <input value={title} onChange={(e) => onTitle(e.target.value)} />
      </Field>
      {contentType === 'movie' ? (
        <Field label={t('year_container')}>
          <div className="grp">
            <input
              className="mono"
              value={year}
              onChange={(e) => onYear(e.target.value)}
              style={{ width: 88, flex: '0 0 88px', textAlign: 'center' }}
            />
            <Dropdown value={container} onChange={onContainer} options={['MKV', 'MP4']} />
          </div>
        </Field>
      ) : (
        <Field label={t('season_ep_container')}>
          <div className="grp">
            <input
              className="mono"
              value={season}
              onChange={(e) => onSeason(e.target.value)}
              style={{ width: 60, textAlign: 'center' }}
            />
            <input
              className="mono"
              value={episode}
              onChange={(e) => onEpisode(e.target.value)}
              style={{ width: 60, textAlign: 'center' }}
            />
            <Dropdown value={container} onChange={onContainer} options={['MKV', 'MP4']} />
          </div>
        </Field>
      )}
      <Field label={t('dest_folder')}>
        <div className="grp">
          <input value={destFolder} onChange={(e) => onDestFolder(e.target.value)} />
          <button className="btn ghost compact" type="button" title={t('browse_title')} onClick={onBrowseFolder}>
            <Ico d={I.folder} size={13} />
          </button>
        </div>
      </Field>
      <label className="cb">
        <span
          className={`cb-box ${exportUseContentFolder ? 'on' : ''}`}
          onClick={() => onExportUseContentFolder(!exportUseContentFolder)}
        >
          {exportUseContentFolder && <Ico d={I.check} size={10} />}
        </span>
        <span onClick={() => onExportUseContentFolder(!exportUseContentFolder)}>
          {t('export_content_folder')}
        </span>
      </label>
      <div className="small" style={{ opacity: 0.75, marginTop: -4, marginBottom: 6 }}>
        {t('export_content_folder_hint')}
      </div>
      <label className="cb">
        <span
          className={`cb-box ${overrideName ? 'on' : ''}`}
          onClick={() => onOverrideName(!overrideName)}
        >
          {overrideName && <Ico d={I.check} size={10} />}
        </span>
        <span onClick={() => onOverrideName(!overrideName)}>{t('override_name')}</span>
      </label>
      {overrideName && (
        <Field label={t('custom_name')}>
          <input
            dir="ltr"
            placeholder={t('custom_name_placeholder')}
            value={customName}
            onChange={(e) => onCustomName(e.target.value)}
          />
        </Field>
      )}
    </Section>
  );
}

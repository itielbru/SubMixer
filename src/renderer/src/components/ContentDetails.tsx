import React from 'react';
import { Section, Field } from './ui/Section';
import { Dropdown } from './ui/Dropdown';
import { Ico, I } from './ui/Icons';

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
  overrideName,
  onOverrideName,
  customName,
  onCustomName,
}: Props) {
  return (
    <Section title="פרטי תוכן">
      <Field label="סוג">
        <div className="seg-mode">
          <button
            className={contentType === 'movie' ? 'on' : ''}
            type="button"
            onClick={() => onContentType('movie')}
          >
            סרט
          </button>
          <button
            className={contentType === 'series' ? 'on' : ''}
            type="button"
            onClick={() => onContentType('series')}
          >
            סדרה
          </button>
        </div>
      </Field>
      <Field label="שם">
        <input value={title} onChange={(e) => onTitle(e.target.value)} />
      </Field>
      {contentType === 'movie' ? (
        <Field label="שנה · מיכל">
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
        <Field label="עונה · פרק · מיכל">
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
      <Field label="תיקיית יעד">
        <div className="grp">
          <input value={destFolder} onChange={(e) => onDestFolder(e.target.value)} />
          <button className="btn ghost compact" type="button" title="עיון" onClick={onBrowseFolder}>
            <Ico d={I.folder} size={13} />
          </button>
        </div>
      </Field>
      <label className="cb">
        <span className={`cb-box ${overrideName ? 'on' : ''}`}>
          {overrideName && <Ico d={I.check} size={10} />}
        </span>
        <span onClick={() => onOverrideName(!overrideName)}>שם מותאם אישית</span>
      </label>
      {overrideName && (
        <input
          className="mt6"
          placeholder="שם הקובץ ללא סיומת"
          value={customName}
          onChange={(e) => onCustomName(e.target.value)}
        />
      )}
    </Section>
  );
}

import { Ico, I } from '../ui/Icons';
import { useT } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';

interface Props {
  version: string;
  onClose: () => void;
}

const REPO_URL = 'https://github.com/itielbru/submixer';

export function AboutModal({ version, onClose }: Props) {
  const { t } = useT();

  return (
    <Modal onClose={onClose} label={t('about_title')} className="about-modal">
      <div className="modal-h">
        <div className="modal-t">{t('about_title')}</div>
        <button className="icon-btn" type="button" onClick={onClose}>
          <Ico d={I.x} />
        </button>
      </div>
      <div className="modal-b">
        <div className="about-brand">
          <div className="mark">S</div>
          <div className="about-brand-text">
            <div className="about-name">{t('app_title')}</div>
            <div className="about-ver mono">v{version}</div>
          </div>
        </div>
        <p className="about-desc">{t('about_text')}</p>
        <div className="about-links">
          <a
            className="btn ghost compact"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Ico d={I.external} size={12} /> {t('about_repo')}
          </a>
        </div>
      </div>
    </Modal>
  );
}

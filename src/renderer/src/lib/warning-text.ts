import type { I18nKey } from '@shared/i18n';
import type { CueWarnings } from './cue-warnings';

/**
 * Build a localized, human-readable label for a cue's worst warning.
 * Numeric values (CPS, duration) are appended here so the i18n catalog stays
 * free of string interpolation.
 */
export function warningReasonText(w: CueWarnings, t: (key: I18nKey) => string): string {
  switch (w.reasonKey) {
    case 'overlap':
      return t('warn_overlap');
    case 'veryFastCps':
      return `${t('warn_cps_very')} (${w.cps.toFixed(0)})`;
    case 'fastCps':
      return `${t('warn_cps_high')} (${w.cps.toFixed(0)})`;
    case 'short':
      return `${t('warn_short')} (${w.durationSec.toFixed(2)}s)`;
    case 'long':
      return `${t('warn_long')} (${w.durationSec.toFixed(1)}s)`;
    case 'shortGap':
      return t('warn_short_gap');
    default:
      return '';
  }
}

import { describe, it, expect } from 'vitest';
import { warningReasonText } from './warning-text';
import { computeWarnings } from './cue-warnings';
import { t as translate, type I18nKey } from '@shared/i18n';
import type { SrtCue } from '@shared/types';

const cue = (start: number, end: number, text = 'hello'): SrtCue => ({
  idx: 1,
  start,
  end,
  text,
});

const he = (k: I18nKey): string => translate('he', k);
const en = (k: I18nKey): string => translate('en', k);

describe('warningReasonText', () => {
  it('returns an empty string for an ok cue', () => {
    const w = computeWarnings(cue(0, 3, 'fine'), undefined, undefined);
    expect(warningReasonText(w, he)).toBe('');
  });

  it('localizes the overlap reason', () => {
    const w = computeWarnings(cue(4, 6), cue(0, 5), undefined);
    expect(warningReasonText(w, he)).toBe('חפיפה עם cue שכן');
    expect(warningReasonText(w, en)).toBe('Overlaps adjacent cue');
  });

  it('appends the rounded CPS value', () => {
    const w = computeWarnings(cue(0, 1, 'x'.repeat(30)), undefined, undefined);
    expect(warningReasonText(w, en)).toBe('High CPS (30)');
  });

  it('appends the duration for a short cue', () => {
    const w = computeWarnings(cue(0, 0.5, 'hi'), undefined, undefined);
    expect(warningReasonText(w, en)).toBe('Too short (0.50s)');
  });

  it('localizes the overrun reason', () => {
    const w = computeWarnings(cue(58, 62, 'hi'), undefined, undefined, undefined, 60);
    expect(warningReasonText(w, en)).toBe('Cue extends past video end');
    expect(warningReasonText(w, he)).toBe('Cue חורג מעבר לסוף הסרט');
  });

  it('appends the rounded CPS value for a very-fast cue', () => {
    // 40 chars in 1s → cps 40 > hardMaxCps (35) → veryFastCps
    const w = computeWarnings(cue(0, 1, 'x'.repeat(40)), undefined, undefined);
    expect(w.reasonKey).toBe('veryFastCps');
    expect(warningReasonText(w, en)).toBe('Very high CPS (40)');
  });

  it('appends the duration for a long cue', () => {
    // 10s duration > maxCueDurationSec (8), low CPS → long
    const w = computeWarnings(cue(0, 10, 'short text'), undefined, undefined);
    expect(w.reasonKey).toBe('long');
    expect(warningReasonText(w, en)).toBe('Too long (10.0s)');
  });

  it('localizes the short-gap reason', () => {
    // 0.05s gap after prev (< minGapSec 0.12), no overlap, normal duration/CPS
    const w = computeWarnings(cue(5.05, 8, 'ok text'), cue(0, 5), undefined);
    expect(w.reasonKey).toBe('shortGap');
    expect(warningReasonText(w, he)).toBe(he('warn_short_gap'));
  });
});

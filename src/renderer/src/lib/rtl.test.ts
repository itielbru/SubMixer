import { describe, it, expect } from 'vitest';
import { isRtlLang, reverseRtlPunctuation } from './rtl';

describe('isRtlLang', () => {
  it('detects Hebrew and Arabic codes', () => {
    expect(isRtlLang('he')).toBe(true);
    expect(isRtlLang('heb')).toBe(true);
    expect(isRtlLang('AR')).toBe(true);
    expect(isRtlLang('iw')).toBe(true);
  });

  it('returns false for LTR languages and empty input', () => {
    expect(isRtlLang('en')).toBe(false);
    expect(isRtlLang('')).toBe(false);
    expect(isRtlLang(null)).toBe(false);
    expect(isRtlLang(undefined)).toBe(false);
  });
});

describe('reverseRtlPunctuation', () => {
  it('moves trailing punctuation inside a closing paren in visual order', () => {
    expect(reverseRtlPunctuation('(טקסט).')).toBe('(טקסט.)');
  });

  it('moves punctuation before an opening paren inside it', () => {
    expect(reverseRtlPunctuation('.(טקסט)')).toBe('(.טקסט)');
  });

  it('leaves text without paren/punctuation pairs untouched', () => {
    expect(reverseRtlPunctuation('שלום עולם')).toBe('שלום עולם');
  });
});

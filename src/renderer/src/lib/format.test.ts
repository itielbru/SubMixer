import { describe, it, expect } from 'vitest';
import { fmtTime, fmtTimeMs, fmtSizeMB, fmtSizeBytes } from './format';

describe('fmtTime', () => {
  it('formats minutes:seconds when under an hour', () => {
    expect(fmtTime(75)).toBe('1:15');
  });

  it('formats hours:minutes:seconds when an hour or more', () => {
    expect(fmtTime(3661)).toBe('1:01:01');
  });

  it('clamps negatives to zero', () => {
    expect(fmtTime(-5)).toBe('0:00');
  });
});

describe('fmtTimeMs', () => {
  it('appends zero-padded milliseconds', () => {
    expect(fmtTimeMs(1.5)).toBe('0:01,500');
  });
});

describe('fmtSizeMB', () => {
  it('shows MB below 1024', () => {
    expect(fmtSizeMB(512)).toBe('512 MB');
  });

  it('shows GB at or above 1024', () => {
    expect(fmtSizeMB(2048)).toBe('2.00 GB');
  });
});

describe('fmtSizeBytes', () => {
  it('returns a dash for falsy / non-finite values', () => {
    expect(fmtSizeBytes(0)).toBe('—');
    expect(fmtSizeBytes(Infinity)).toBe('—');
  });

  it('scales across units', () => {
    expect(fmtSizeBytes(500)).toBe('500 B');
    expect(fmtSizeBytes(2048)).toBe('2.0 KB');
    expect(fmtSizeBytes(5 * 1024 ** 2)).toBe('5.0 MB');
    expect(fmtSizeBytes(3 * 1024 ** 3)).toBe('3.00 GB');
  });
});

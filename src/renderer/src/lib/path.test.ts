import { describe, it, expect } from 'vitest';
import { joinPath } from './path';

describe('joinPath', () => {
  it('joins with backslashes on Windows', () => {
    expect(joinPath(true, 'C:\\Users\\me', 'Videos', 'out.mkv')).toBe('C:\\Users\\me\\Videos\\out.mkv');
  });

  it('joins with forward slashes elsewhere', () => {
    expect(joinPath(false, '/home/me', 'Videos', 'out.mkv')).toBe('/home/me/Videos/out.mkv');
  });

  it('trims stray separators between segments', () => {
    expect(joinPath(false, '/home/me/', '/Videos/', '/out.mkv')).toBe('/home/me/Videos/out.mkv');
  });

  it('drops empty and whitespace-only segments', () => {
    expect(joinPath(false, '/home/me', '', '   ', 'out.mkv')).toBe('/home/me/out.mkv');
  });

  it('preserves a leading separator on the first segment', () => {
    expect(joinPath(false, '/abs', 'b')).toBe('/abs/b');
  });

  it('returns an empty string when given no usable parts', () => {
    expect(joinPath(true, '', '  ')).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { parseFfmpegError } from './ffmpeg';

describe('parseFfmpegError', () => {
  it('detects a full disk', () => {
    expect(parseFfmpegError('av_interleaved_write_frame(): No space left on device')).toMatch(
      /disk is full/i,
    );
  });

  it('detects permission denied', () => {
    expect(parseFfmpegError('Error opening output file: Permission denied')).toMatch(
      /permission denied/i,
    );
  });

  it('detects a codec/container mismatch', () => {
    expect(
      parseFfmpegError('[mp4 @ 0x1] Subtitle codec not currently supported in container'),
    ).toMatch(/not supported by the chosen container|switch to mkv/i);
  });

  it('detects a corrupt/incomplete source', () => {
    expect(parseFfmpegError('moov atom not found')).toMatch(/corrupt or incomplete/i);
    expect(parseFfmpegError('Invalid data found when processing input')).toMatch(
      /corrupt or incomplete/i,
    );
  });

  it('detects refused overwrite', () => {
    expect(parseFfmpegError("Output file 'x.mkv' already exists. Exiting.")).toMatch(
      /already exists/i,
    );
  });

  it('detects a subtitle encoding problem', () => {
    expect(
      parseFfmpegError('Invalid UTF-8 in the input subtitle stream\nsub_charenc failed'),
    ).toMatch(/subtitle encoding/i);
  });

  it('falls back to the last stderr error lines for unknown failures', () => {
    const out = parseFfmpegError(
      'harmless banner line\nWidget: an error occurred\nfatal: could not finish muxing',
    );
    expect(out).toContain('could not finish muxing');
  });

  it('returns a generic message for empty stderr', () => {
    expect(parseFfmpegError('')).toMatch(/ffmpeg/i);
  });
});

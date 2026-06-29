import { describe, it, expect } from 'vitest';
import { DEFAULT_VIDEO_ENCODE, videoEncodeArgs } from './video-encode';

describe('videoEncodeArgs', () => {
  it('defaults to software x264 with crf', () => {
    expect(videoEncodeArgs()).toEqual([
      '-c:v', 'libx264', '-preset', 'faster', '-crf', '20', '-pix_fmt', 'yuv420p',
    ]);
    expect(videoEncodeArgs(DEFAULT_VIDEO_ENCODE)).toContain('libx264');
  });

  it('maps presets per encoder family', () => {
    expect(videoEncodeArgs({ encoder: 'libx264', preset: 'slow', quality: 18 })).toContain('slow');
    expect(videoEncodeArgs({ encoder: 'h264_nvenc', preset: 'fast', quality: 23 })).toContain('p2');
    expect(videoEncodeArgs({ encoder: 'h264_qsv', preset: 'slow', quality: 23 })).toContain('veryslow');
  });

  it('uses -cq for nvenc and -global_quality for qsv', () => {
    const nv = videoEncodeArgs({ encoder: 'hevc_nvenc', preset: 'medium', quality: 24 });
    expect(nv).toEqual(
      expect.arrayContaining(['-c:v', 'hevc_nvenc', '-rc', 'vbr', '-cq', '24'])
    );
    const qsv = videoEncodeArgs({ encoder: 'h264_qsv', preset: 'medium', quality: 24 });
    expect(qsv).toEqual(expect.arrayContaining(['-global_quality', '24']));
  });

  it('uses cqp qp pairs for amf', () => {
    const amf = videoEncodeArgs({ encoder: 'h264_amf', preset: 'medium', quality: 22 });
    expect(amf).toEqual(
      expect.arrayContaining(['-quality', 'balanced', '-rc', 'cqp', '-qp_i', '22', '-qp_p', '22'])
    );
  });

  it('inverts quality for videotoolbox (higher = better) and has no preset', () => {
    const vt = videoEncodeArgs({ encoder: 'h264_videotoolbox', preset: 'fast', quality: 20 });
    // 100 - 20*2 = 60
    expect(vt).toEqual(['-c:v', 'h264_videotoolbox', '-q:v', '60', '-pix_fmt', 'yuv420p']);
  });

  it('clamps out-of-range and non-finite quality', () => {
    expect(videoEncodeArgs({ encoder: 'libx264', preset: 'fast', quality: 999 })).toContain('51');
    expect(videoEncodeArgs({ encoder: 'libx264', preset: 'fast', quality: -5 })).toContain('0');
    expect(videoEncodeArgs({ encoder: 'libx264', preset: 'fast', quality: NaN })).toContain('20');
  });

  it('always appends yuv420p pixel format', () => {
    expect(videoEncodeArgs({ encoder: 'libx265', preset: 'medium', quality: 20 }).slice(-2)).toEqual([
      '-pix_fmt', 'yuv420p',
    ]);
  });
});

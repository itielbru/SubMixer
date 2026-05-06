export const fmtTime = (s: number): string => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    x = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
    : `${m}:${String(x).padStart(2, '0')}`;
};

export const fmtTimeMs = (s: number): string => {
  const ms = Math.floor((s % 1) * 1000);
  return `${fmtTime(s)},${String(ms).padStart(3, '0')}`;
};

export const fmtSizeMB = (mb: number): string =>
  mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;

export const fmtSizeBytes = (bytes: number): string => {
  if (!bytes || !isFinite(bytes)) return '—';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
};

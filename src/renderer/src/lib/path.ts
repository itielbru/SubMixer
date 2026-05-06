/** Join path segments for display / output paths (renderer has no `path` module). */
export function joinPath(isWin: boolean, ...parts: string[]): string {
  const sep = isWin ? '\\' : '/';
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p, i) => (i === 0 ? p.replace(/[/\\]+$/g, '') : p.replace(/^[/\\]+|[/\\]+$/g, '')))
    .filter(Boolean)
    .join(sep);
}

export interface AgentDebugPayload {
  sessionId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  hypothesisId: string;
  timestamp: number;
  runId?: string;
}

/**
 * Lightweight diagnostic hook. Forwards to the main-process log through the
 * preload bridge, where it is recorded at `debug` level (below the production
 * file threshold, so it is effectively a no-op in release builds).
 *
 * Note: this previously POSTed to a local debug-ingest server during
 * development — that network call has been removed for release.
 */
export function agentDebug(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId?: string
): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & {
    api?: { debug?: { log: (p: AgentDebugPayload) => Promise<void> } };
  };
  if (!w.api?.debug?.log) return;
  void w.api.debug.log({
    sessionId: 'renderer',
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId,
  });
}
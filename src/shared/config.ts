// Centralized operational constants previously hard-coded across the main
// process. Grouping them here documents the budgets/limits in one place and
// keeps magic numbers out of the call sites.

/** Kill an ffmpeg preview-extraction child if it runs longer than this. */
export const PREVIEW_EXTRACT_TIMEOUT_MS = 180_000; // 3 minutes

/** Kill an ffmpeg peaks-extraction child if it runs longer than this. */
export const PEAKS_EXTRACT_TIMEOUT_MS = 120_000; // 2 minutes

/** Disk budget for the extracted-audio preview cache before age eviction. */
export const PREVIEW_CACHE_MAX_BYTES = 500 * 1024 * 1024; // 500 MB

/** Disk budget for the waveform peaks cache before age eviction. */
export const PEAKS_CACHE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

/** Peaks cache entries older than this are evicted on startup. */
export const PEAKS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

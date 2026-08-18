/**
 * Mirror AI Loader limits (src/lib/dm2-import-file-content.ts).
 * Compile splits only when a brand file would exceed these caps.
 */
export const AI_LOADER_MAX_FILE_BYTES = 200 * 1024 * 1024;
export const AI_LOADER_MAX_ROWS_PER_FILE = 2_000_000;

/** Safety margin so compiled files reliably pass client + server validation. */
export const COMPILE_TARGET_MAX_BYTES = 190 * 1024 * 1024;
export const COMPILE_TARGET_MAX_ROWS = 1_900_000;

export const AI_LOADER_MAX_FILES_PER_SESSION = 10;

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const DM2_IMPORT_DEBUG_STORAGE_KEY = "dm2ImportDebug";

declare global {
  interface Window {
    __DM2_IMPORT_DEBUG__?: boolean;
    enableDm2ImportDebug?: () => void;
    disableDm2ImportDebug?: () => void;
  }
}

export function isDm2ImportDebugEnabled(): boolean {
  if (typeof window !== "undefined") {
    if (window.__DM2_IMPORT_DEBUG__ === true) return true;
    try {
      if (window.localStorage.getItem(DM2_IMPORT_DEBUG_STORAGE_KEY) === "1") {
        return true;
      }
    } catch {
      // ignore storage access errors
    }
  }

  return process.env.NEXT_PUBLIC_DM2_IMPORT_DEBUG === "1";
}

export function enableDm2ImportDebug(): void {
  if (typeof window === "undefined") return;
  window.__DM2_IMPORT_DEBUG__ = true;
  try {
    window.localStorage.setItem(DM2_IMPORT_DEBUG_STORAGE_KEY, "1");
  } catch {
    // ignore storage access errors
  }
  console.info(
    "[DM2 Import] Debug logging enabled. Move Refs and session updates will log to the console."
  );
}

export function disableDm2ImportDebug(): void {
  if (typeof window === "undefined") return;
  window.__DM2_IMPORT_DEBUG__ = false;
  try {
    window.localStorage.removeItem(DM2_IMPORT_DEBUG_STORAGE_KEY);
  } catch {
    // ignore storage access errors
  }
  console.info("[DM2 Import] Debug logging disabled.");
}

export function registerDm2ImportDebugConsoleHelpers(): void {
  if (typeof window === "undefined") return;
  window.enableDm2ImportDebug = enableDm2ImportDebug;
  window.disableDm2ImportDebug = disableDm2ImportDebug;
}

export function dm2ImportDebugLog(
  scope: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!isDm2ImportDebugEnabled()) return;

  if (data) {
    console.info(`[DM2 Import:${scope}] ${message}`, data);
    return;
  }

  console.info(`[DM2 Import:${scope}] ${message}`);
}

export function dm2ImportDebugWarn(
  scope: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!isDm2ImportDebugEnabled()) return;

  if (data) {
    console.warn(`[DM2 Import:${scope}] ${message}`, data);
    return;
  }

  console.warn(`[DM2 Import:${scope}] ${message}`);
}

export function summarizeDm2Proposals(
  proposals: Array<{
    id: string;
    entityType: string;
    proposedName: string;
    referenceCount: number;
    normalizedKey?: string;
  }>
) {
  return proposals.map((proposal) => ({
    id: proposal.id,
    entityType: proposal.entityType,
    proposedName: proposal.proposedName,
    refs: proposal.referenceCount,
    normalizedKey: proposal.normalizedKey,
  }));
}

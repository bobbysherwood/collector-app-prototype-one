import type { Dm2CareerStatus } from "@/lib/dm2-player-profile";
import { isDm2CareerStatus } from "@/lib/dm2-player-profile";
import { normalizePersonName } from "@/lib/player-stats/wikidata";
import type { PlayerProfileSignals } from "@/types/player-opportunity";

export interface CatalogProfileFields {
  birthYear?: number | null;
  careerStatus?: string | null;
  team?: string | null;
}

export interface PersistableProfilePatch {
  birthYear?: number;
  team?: string;
  careerStatus?: Dm2CareerStatus;
}

export function isExactPlayerNameMatch(
  catalogName: string,
  resolvedName: string | null | undefined
): boolean {
  const left = normalizePersonName(catalogName);
  const right = normalizePersonName(resolvedName ?? "");
  return Boolean(left) && left === right;
}

export function buildEmptyProfilePatch(
  existing: CatalogProfileFields,
  live: PlayerProfileSignals | null | undefined
): PersistableProfilePatch | null {
  if (!live) return null;
  const patch: PersistableProfilePatch = {};

  if (existing.birthYear == null && live.birthYear != null) {
    patch.birthYear = live.birthYear;
  }
  if (!existing.team?.trim() && live.team?.trim()) {
    patch.team = live.team.trim();
  }
  if (!existing.careerStatus && live.careerStatus && isDm2CareerStatus(live.careerStatus)) {
    patch.careerStatus = live.careerStatus;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function profilePatchToDbRow(patch: PersistableProfilePatch) {
  return {
    ...(patch.birthYear != null ? { birth_year: patch.birthYear } : {}),
    ...(patch.team != null ? { team: patch.team } : {}),
    ...(patch.careerStatus != null ? { career_status: patch.careerStatus } : {}),
  };
}

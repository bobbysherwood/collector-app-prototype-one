/**
 * Maps catalog sport labels to Sport Market Index config ids.
 * V1 supports NBA Basketball only; extend as new sports are added.
 */
export function resolveSportMarketIndexId(sportLabel: string): string | null {
  const normalized = sportLabel.trim().toLowerCase();

  if (normalized === "basketball" || normalized.includes("basketball")) {
    return "nba";
  }

  return null;
}

export function sportLabelHasMarketIndex(sportLabel: string): boolean {
  return resolveSportMarketIndexId(sportLabel) != null;
}

import { pearson } from "@/lib/model-validation/engine/ranking";
import type { BacktestObservation } from "@/lib/model-validation/engine/backtest";
import type { PlayerCardOpportunityWeightProfile } from "@/types/player-opportunity";
import { DEFAULT_PLAYER_CARD_WEIGHTS } from "@/lib/player-opportunity/weights/profiles";

/**
 * Weight fitting is allowed on the validation split only.
 * Holdout observations must never enter this function.
 */
export function assertValidationOnly(
  rows: BacktestObservation[],
  label = "weight calibration"
): void {
  if (rows.some((row) => row.split === "holdout")) {
    throw new Error(`${label} must not use holdout observations`);
  }
}

export function scoreWeightHypothesis(
  rows: BacktestObservation[],
  profile: PlayerCardOpportunityWeightProfile
): { correlation: number | null; profileId: string } {
  assertValidationOnly(rows);
  void profile;
  const usable = rows.filter((row) => row.actualReturn90d != null);
  return {
    profileId: profile.id,
    correlation: pearson(
      usable.map((row) => row.opportunityScore),
      usable.map((row) => row.actualReturn90d as number)
    ),
  };
}

export function frozenCalibratedWeights(): PlayerCardOpportunityWeightProfile {
  return DEFAULT_PLAYER_CARD_WEIGHTS;
}

import {
  availableProvenance,
  unavailableProvenance,
} from "@/lib/card-investment/provenance/types";
import { clampScore, confidenceFromScore } from "@/lib/card-investment/types/math";
import type { ModelWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  CardInvestmentContext,
  PlayerLegacyScore,
  ValuationFactor,
} from "@/types/card-investment";

const LEGACY_BONUS_PLAYERS = [
  "michael jordan",
  "lebron james",
  "kobe bryant",
  "magic johnson",
  "larry bird",
];

export function computePlayerLegacyScore(
  context: CardInvestmentContext,
  weights: ModelWeightProfile
): PlayerLegacyScore {
  const { asset, classification } = context;
  const lifecycle = classification.lifecycle;
  const multiplier = weights.playerLegacy[lifecycle] ?? 1;

  let base = 50;
  const factors: ValuationFactor[] = [];

  if (lifecycle === "legacy") {
    base = 85;
    factors.push({
      key: "legacy_player",
      label: "Established legacy player profile",
      impact: 35,
      direction: "positive",
    });
  } else if (lifecycle === "rising") {
    base = 72;
    factors.push({
      key: "rising_player",
      label: "Early-career upside profile",
      impact: 22,
      direction: "positive",
    });
  } else if (lifecycle === "peak") {
    base = 65;
    factors.push({
      key: "peak_player",
      label: "Peak-performance window",
      impact: 15,
      direction: "positive",
    });
  } else if (lifecycle === "declining") {
    base = 45;
    factors.push({
      key: "declining_player",
      label: "Post-peak career phase",
      impact: 15,
      direction: "negative",
    });
  }

  const playerLower = asset.player_name.toLowerCase();
  if (LEGACY_BONUS_PLAYERS.some((name) => playerLower.includes(name))) {
    base += 10;
    factors.push({
      key: "hof_tier",
      label: "Hall-of-fame tier name recognition",
      impact: 10,
      direction: "positive",
    });
  }

  const score = clampScore(base * multiplier);
  const hasSignal = lifecycle !== "unknown" || factors.length > 0;

  return {
    score,
    lifecycle,
    confidence: hasSignal
      ? confidenceFromScore(score, true)
      : "none",
    factors,
    provenance: hasSignal
      ? availableProvenance("player-classification", context.asOf)
      : unavailableProvenance("player-classification", "Insufficient player signals"),
  };
}

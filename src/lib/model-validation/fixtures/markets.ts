import { makeSportMarket } from "@/lib/model-validation/fixtures/builders";
import type { SportMarketSnapshot } from "@/types/card-investment";

export const markets = {
  bull: makeSportMarket({
    healthScore: 85,
    momentumScore: 82,
    outlookScore: 84,
    forecast3mPct: 8,
    confidenceScore: 80,
    riskRating: "low",
    seasonPhase: "playoffs",
  }),
  neutral: makeSportMarket({
    healthScore: 50,
    momentumScore: 50,
    outlookScore: 50,
    forecast3mPct: 0,
    confidenceScore: 70,
    riskRating: "medium",
    seasonPhase: "regular",
  }),
  bear: makeSportMarket({
    healthScore: 25,
    momentumScore: 22,
    outlookScore: 24,
    forecast3mPct: -6,
    confidenceScore: 68,
    riskRating: "high",
    seasonPhase: "offseason",
  }),
} satisfies Record<string, SportMarketSnapshot>;

export function marketWithPhase(
  phase: string,
  base: SportMarketSnapshot = markets.neutral
): SportMarketSnapshot {
  return { ...base, seasonPhase: phase };
}

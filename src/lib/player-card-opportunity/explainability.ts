import type { MispricingMetrics } from "@/lib/player-card-opportunity/mispricing";
import type { PlayerCardRecommendation } from "@/types/player-opportunity";

export function computePlayerCardOpportunityExplanation(input: {
  opportunityScore: number;
  recommendation: PlayerCardRecommendation;
  playerOpportunityScore: number;
  expectedReturn90d: number;
  positiveDrivers: string[];
  negativeDrivers: string[];
  mispricing: MispricingMetrics;
}): { summary: string } {
  const label = input.recommendation.replace(/_/g, " ").toUpperCase();

  const parts = [
    `Player/Card Opportunity: ${input.opportunityScore} — ${label}.`,
    `Player Opportunity: ${input.playerOpportunityScore}.`,
    `Expected 90-day return: ${input.expectedReturn90d >= 0 ? "+" : ""}${input.expectedReturn90d.toFixed(1)}%.`,
  ];

  if (input.mispricing.fairMarketValue > 0) {
    parts.push(
      `Price/FMV ratio: ${input.mispricing.priceToFairValueRatio.toFixed(2)} (margin of safety ${input.mispricing.marginOfSafety.toFixed(1)}%).`
    );
  }

  if (input.positiveDrivers.length) {
    parts.push(input.positiveDrivers[0]);
  }
  if (input.negativeDrivers.length) {
    parts.push(`Risk: ${input.negativeDrivers[0]}`);
  }

  return { summary: parts.join(" ") };
}

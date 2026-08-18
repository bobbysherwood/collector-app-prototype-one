import type { SportMarketSnapshot } from "@/types/card-investment";

export function computePlayerOpportunityExplanation(input: {
  opportunityScore: number;
  trend: string;
  positiveDrivers: string[];
  negativeDrivers: string[];
  expectedDemandChange90d: number;
  sportMarket: SportMarketSnapshot | null;
}): { summary: string } {
  const trendLabel = input.trend.replace(/_/g, " ");
  const strength =
    input.opportunityScore >= 75
      ? "Strong"
      : input.opportunityScore >= 60
        ? "Moderate"
        : input.opportunityScore >= 45
          ? "Neutral"
          : "Weak";

  const parts = [
    `Player Opportunity: ${input.opportunityScore} — ${strength} (${trendLabel}).`,
    `Expected 90-day demand change: ${input.expectedDemandChange90d >= 0 ? "+" : ""}${input.expectedDemandChange90d}%.`,
  ];

  if (input.positiveDrivers.length) {
    parts.push(`Key positives: ${input.positiveDrivers.slice(0, 2).join(" ")}`);
  }
  if (input.negativeDrivers.length) {
    parts.push(`Key risks: ${input.negativeDrivers.slice(0, 2).join(" ")}`);
  }

  return { summary: parts.join(" ") };
}

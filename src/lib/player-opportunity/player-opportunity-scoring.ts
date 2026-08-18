import { clampScore } from "@/lib/card-investment/types/math";
import type { SportMarketSnapshot } from "@/types/card-investment";
import type {
  OpportunityCatalyst,
  PlayerDemandSignals,
  PlayerOpportunityContext,
  PlayerOpportunityTrend,
  PlayerQualitySignals,
} from "@/types/player-opportunity";

export function scorePlayerQuality(
  signals: PlayerQualitySignals | undefined,
  lifecycle: PlayerOpportunityContext["lifecycle"]
): { score: number; confidencePenalty: number } {
  if (!signals || signals.availableFieldCount === 0) {
    const baseline =
      lifecycle === "retired" || lifecycle === "deceased"
        ? 70
        : lifecycle === "prospect"
          ? 55
          : 50;
    return { score: baseline, confidencePenalty: 25 };
  }

  const values = [
    signals.careerStrength,
    signals.legacyStrength,
    signals.culturalRelevance,
  ].filter((v): v is number => v != null);

  if (values.length === 0) {
    return { score: 50, confidencePenalty: 20 };
  }

  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  let score = avg;
  if (signals.injuryRisk != null && lifecycle === "active") {
    score -= signals.injuryRisk * 0.15;
  }

  const confidencePenalty = Math.max(0, 15 - signals.availableFieldCount * 3);
  return { score: clampScore(score), confidencePenalty };
}

export function scoreFutureOutlook(lifecycle: PlayerOpportunityContext["lifecycle"]): number {
  switch (lifecycle) {
    case "prospect":
      return 72;
    case "active":
      return 58;
    case "retired":
      return 52;
    case "deceased":
      return 48;
    default:
      return 50;
  }
}

export function scorePlayerDemand(signals: PlayerDemandSignals | undefined): {
  score: number;
  attentionScore: number;
  sentimentScore: number;
  confidencePenalty: number;
} {
  if (!signals || signals.sourceCount === 0) {
    return {
      score: 50,
      attentionScore: 50,
      sentimentScore: 50,
      confidencePenalty: 30,
    };
  }

  const attention = signals.attentionScore ?? 50;
  const sentiment = signals.sentimentScore ?? 50;
  const search = signals.searchInterestScore ?? 50;
  const growth = signals.discussionGrowthScore ?? 50;

  const score = clampScore(
    attention * 0.25 + sentiment * 0.35 + search * 0.2 + growth * 0.2
  );

  return {
    score,
    attentionScore: attention,
    sentimentScore: sentiment,
    confidencePenalty: Math.max(0, 20 - signals.sourceCount * 4),
  };
}

export function scoreSportMarketContext(
  sportMarket: SportMarketSnapshot | null
): { score: number; momentumScore: number; confidencePenalty: number } {
  if (!sportMarket?.provenance.available) {
    return { score: 50, momentumScore: 50, confidencePenalty: 20 };
  }

  const score = clampScore(
    sportMarket.healthScore * 0.45 + sportMarket.outlookScore * 0.35 + sportMarket.momentumScore * 0.2
  );

  return {
    score,
    momentumScore: sportMarket.momentumScore,
    confidencePenalty: sportMarket.confidenceScore < 40 ? 15 : 0,
  };
}

export function expectedDemandChange90d(input: {
  momentumScore: number;
  demandScore: number;
  sportMarket: SportMarketSnapshot | null;
  catalysts: OpportunityCatalyst[];
}): number {
  let change = 0;

  change += ((input.momentumScore - 50) / 50) * 6;
  change += ((input.demandScore - 50) / 50) * 8;

  if (input.sportMarket?.provenance.available) {
    change += input.sportMarket.forecast3mPct;
  }

  for (const catalyst of input.catalysts) {
    const sign =
      catalyst.direction === "positive" ? 1 : catalyst.direction === "negative" ? -1 : 0;
    change += sign * catalyst.expectedMagnitude * 0.5;
  }

  return Math.round(change * 10) / 10;
}

export function playerRiskScore(input: {
  lifecycle: PlayerOpportunityContext["lifecycle"];
  qualitySignals?: PlayerQualitySignals;
  sportMarket: SportMarketSnapshot | null;
  confidencePenalty: number;
}): number {
  let risk = 40;

  if (input.lifecycle === "prospect") risk += 15;
  if (input.lifecycle === "active" && (input.qualitySignals?.injuryRisk ?? 0) > 50) {
    risk += 12;
  }
  if (input.sportMarket?.riskRating === "high") risk += 10;
  if (input.sportMarket?.riskRating === "low") risk -= 8;

  risk += input.confidencePenalty * 0.2;
  return clampScore(risk);
}

export function trendFromExpectedChange(change: number): PlayerOpportunityTrend {
  if (change >= 8) return "strongly_increasing";
  if (change >= 3) return "increasing";
  if (change <= -8) return "strongly_declining";
  if (change <= -3) return "declining";
  return "neutral";
}

export function weightedPlayerOpportunityScore(
  components: {
    qualityScore: number;
    futureOutlookScore: number;
    demandScore: number;
    sportMarketScore: number;
    momentumScore: number;
    catalystScore: number;
  },
  weights: {
    playerQuality: number;
    futureOutlook: number;
    demand: number;
    sportMarket: number;
    momentum: number;
    catalysts: number;
  }
): number {
  const total =
    weights.playerQuality +
    weights.futureOutlook +
    weights.demand +
    weights.sportMarket +
    weights.momentum +
    weights.catalysts;

  const composite =
    components.qualityScore * weights.playerQuality +
    components.futureOutlookScore * weights.futureOutlook +
    components.demandScore * weights.demand +
    components.sportMarketScore * weights.sportMarket +
    components.momentumScore * weights.momentum +
    components.catalystScore * weights.catalysts;

  return clampScore(composite / total);
}

export function catalystImpactScore(catalysts: OpportunityCatalyst[]): number {
  if (catalysts.length === 0) return 50;

  let net = 0;
  for (const c of catalysts) {
    const sign = c.direction === "positive" ? 1 : c.direction === "negative" ? -1 : 0;
    net += sign * c.expectedMagnitude;
  }

  return clampScore(50 + net);
}

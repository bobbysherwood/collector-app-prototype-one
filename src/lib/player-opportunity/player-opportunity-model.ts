import { computePlayerLegacyScore } from "@/lib/card-investment/player/player-legacy-model";
import { computeCardValuation } from "@/lib/card-investment/valuation/card-valuation-model";
import { resolveWeightProfile } from "@/lib/card-investment/weights/profiles";
import { computePlayerOpportunityExplanation } from "@/lib/player-opportunity/explainability";
import {
  catalystImpactScore,
  expectedDemandChange90d,
  playerRiskScore,
  scoreFutureOutlook,
  scorePlayerDemand,
  scorePlayerQuality,
  scoreSportMarketContext,
  trendFromExpectedChange,
  weightedPlayerOpportunityScore,
} from "@/lib/player-opportunity/player-opportunity-scoring";
import { resolvePlayerOpportunityWeights } from "@/lib/player-opportunity/weights/profiles";
import { clampScore } from "@/lib/card-investment/types/math";
import type { CardInvestmentContext } from "@/types/card-investment";
import type {
  OpportunityCatalyst,
  PlayerOpportunity,
  PlayerOpportunityContext,
} from "@/types/player-opportunity";
import { PLAYER_OPPORTUNITY_MODEL_VERSION } from "@/types/player-opportunity";

function buildCatalysts(context: PlayerOpportunityContext): OpportunityCatalyst[] {
  if (context.catalysts?.length) return context.catalysts;

  const catalysts: OpportunityCatalyst[] = [];

  if (context.sportMarket?.seasonPhase === "playoffs") {
    catalysts.push({
      id: "nba-playoffs",
      label: "NBA playoff season",
      type: "seasonality",
      direction: "positive",
      expectedImpact: "positive",
      expectedMagnitude: 6,
      expectedDurationDays: 45,
      windowDays: 45,
      confidence: "medium",
    });
  }

  if (context.lifecycle === "prospect") {
    catalysts.push({
      id: "prospect-upside",
      label: "Prospect career development window",
      type: "career_trajectory",
      direction: "positive",
      expectedImpact: "positive",
      expectedMagnitude: 8,
      expectedDurationDays: 90,
      windowDays: 90,
      confidence: "low",
    });
  }

  return catalysts;
}

function enrichQualityFromLegacy(
  context: PlayerOpportunityContext,
  cardContext?: CardInvestmentContext
): { qualityScore: number; confidencePenalty: number } {
  const base = scorePlayerQuality(context.qualitySignals, context.lifecycle);

  if (!cardContext) {
    return {
      qualityScore: base.score,
      confidencePenalty: base.confidencePenalty,
    };
  }

  const weights = resolveWeightProfile({
    sport: cardContext.asset.sport,
    era: cardContext.classification.era,
    lifecycle: cardContext.classification.lifecycle,
    archetype: cardContext.classification.archetype,
  });

  const legacy = computePlayerLegacyScore(cardContext, weights);
  const blended = clampScore(base.score * 0.4 + legacy.score * 0.6);

  return {
    qualityScore: blended,
    confidencePenalty:
      legacy.confidence === "none" ? base.confidencePenalty + 10 : base.confidencePenalty,
  };
}

export function computePlayerOpportunity(
  context: PlayerOpportunityContext,
  cardContext?: CardInvestmentContext
): PlayerOpportunity {
  const weights = resolvePlayerOpportunityWeights(context.lifecycle);
  const catalysts = buildCatalysts(context);

  const quality = enrichQualityFromLegacy(context, cardContext);
  const futureOutlookScore = scoreFutureOutlook(context.lifecycle);
  const demand = scorePlayerDemand(context.demandSignals);
  const sport = scoreSportMarketContext(context.sportMarket);
  const catalystScore = catalystImpactScore(catalysts);

  const confidencePenalty =
    quality.confidencePenalty + demand.confidencePenalty + sport.confidencePenalty;

  const opportunityScore = weightedPlayerOpportunityScore(
    {
      qualityScore: quality.qualityScore,
      futureOutlookScore,
      demandScore: demand.score,
      sportMarketScore: sport.score,
      momentumScore: sport.momentumScore,
      catalystScore,
    },
    weights
  );

  const demandChange90d = expectedDemandChange90d({
    momentumScore: sport.momentumScore,
    demandScore: demand.score,
    sportMarket: context.sportMarket,
    catalysts,
  });

  const riskScore = playerRiskScore({
    lifecycle: context.lifecycle,
    qualitySignals: context.qualitySignals,
    sportMarket: context.sportMarket,
    confidencePenalty,
  });

  const confidenceScore = clampScore(
    100 - confidencePenalty - (context.sportMarket?.provenance.available ? 0 : 10)
  );

  const trend = trendFromExpectedChange(demandChange90d);

  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  if (demand.score >= 60) positiveDrivers.push("Player demand signals are favorable.");
  if (demand.score <= 40) negativeDrivers.push("Player demand signals are weak.");
  if (demand.attentionScore > 70 && demand.sentimentScore < 45) {
    negativeDrivers.push("High attention is not translating into positive sentiment.");
  }
  if (sport.momentumScore >= 60) {
    positiveDrivers.push("Sport market momentum is supportive.");
  } else if (sport.momentumScore <= 40) {
    negativeDrivers.push("Sport market momentum is soft.");
  }
  if (quality.qualityScore >= 70) positiveDrivers.push("Player quality/legacy profile is strong.");
  if (context.sportMarket?.provenance.available && context.sportMarket.outlookScore >= 60) {
    positiveDrivers.push("Basketball market index outlook is bullish.");
  }
  if (confidenceScore < 45) {
    negativeDrivers.push("Model confidence is reduced due to missing external inputs.");
  }

  const computedAt = new Date().toISOString();

  let referenceFairValue: number | null = null;
  if (cardContext) {
    const cardWeights = resolveWeightProfile({
      sport: cardContext.asset.sport,
      era: cardContext.classification.era,
      lifecycle: cardContext.classification.lifecycle,
      archetype: cardContext.classification.archetype,
    });
    referenceFairValue = computeCardValuation(cardContext, cardWeights).fairValue;
  }

  const explanation = computePlayerOpportunityExplanation({
    opportunityScore,
    trend,
    positiveDrivers,
    negativeDrivers,
    expectedDemandChange90d: demandChange90d,
    sportMarket: context.sportMarket,
  });

  return {
    playerId: context.playerId,
    playerName: context.playerName,
    sport: context.sport,
    lifecycle: context.lifecycle,
    modelVersion: PLAYER_OPPORTUNITY_MODEL_VERSION,
    computedAt,
    opportunityScore,
    qualityScore: quality.qualityScore,
    futureOutlookScore,
    demandScore: demand.score,
    sportMarketScore: sport.score,
    momentumScore: sport.momentumScore,
    expectedDemandChange90d: demandChange90d,
    riskScore,
    confidenceScore,
    trend,
    positiveDrivers,
    negativeDrivers,
    catalysts,
    summary: explanation.summary,
    weightProfileId: weights.id,
    referenceFairValue,
    inputs: {
      asOf: context.asOf,
      qualityAvailableFields: context.qualitySignals?.availableFieldCount ?? 0,
      demandSourceCount: context.demandSignals?.sourceCount ?? 0,
      sportMarketAvailable: context.sportMarket?.provenance.available ?? false,
    },
  };
}

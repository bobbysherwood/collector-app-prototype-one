import { computeCardDemandScore } from "@/lib/card-investment/demand/card-demand-model";
import { computeCardForecast } from "@/lib/card-investment/forecast/card-forecast-model";
import { computeCardRisk } from "@/lib/card-investment/risk/card-risk-model";
import { computeScarcityScore } from "@/lib/card-investment/scarcity/card-scarcity-model";
import { computeSeasonalityForecast } from "@/lib/card-investment/seasonality/card-seasonality-model";
import { clampScore, roundCurrency } from "@/lib/card-investment/types/math";
import { computeCardValuation } from "@/lib/card-investment/valuation/card-valuation-model";
import { resolveWeightProfile } from "@/lib/card-investment/weights/profiles";
import { classifyPlayerOpportunityLifecycle } from "@/lib/player-opportunity/classification/lifecycle";
import { computePlayerCardOpportunityExplanation } from "@/lib/player-card-opportunity/explainability";
import {
  computeMispricing,
  scenarioValues,
} from "@/lib/player-card-opportunity/mispricing";
import {
  DEFAULT_OPPORTUNITY_THRESHOLDS,
  recommendationFromScore,
  resolvePlayerCardOpportunityWeights,
} from "@/lib/player-opportunity/weights/profiles";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import type { CardInvestmentContext } from "@/types/card-investment";
import type { PlayerOpportunity } from "@/types/player-opportunity";
import type { PlayerCardOpportunity } from "@/types/player-opportunity";
import { PLAYER_CARD_OPPORTUNITY_MODEL_VERSION } from "@/types/player-opportunity";
import type { PlayerOpportunityContext } from "@/types/player-opportunity";

export interface PlayerCardOpportunityInput {
  cardContext: CardInvestmentContext;
  playerContext: PlayerOpportunityContext;
  playerOpportunity?: PlayerOpportunity;
}

function riskAdjustedReturnScore(
  expectedReturn90d: number,
  riskScore: number,
  volatilityScore: number
): number {
  const penalty = riskScore * 0.35 + volatilityScore * 0.15;
  return clampScore(50 + expectedReturn90d * 2 - penalty * 0.3);
}

function applyRiskConfidenceConstraints(
  rawScore: number,
  riskScore: number,
  confidenceScore: number
): number {
  let score = rawScore;

  if (riskScore >= 75) score *= 0.75;
  else if (riskScore >= 60) score *= 0.88;

  if (confidenceScore < 35) score *= 0.7;
  else if (confidenceScore < 50) score *= 0.85;

  return clampScore(score);
}

export function computePlayerCardOpportunity(
  input: PlayerCardOpportunityInput
): PlayerCardOpportunity {
  const { cardContext, playerContext } = input;
  const cardWeights = resolveWeightProfile({
    sport: cardContext.asset.sport,
    era: cardContext.classification.era,
    lifecycle: cardContext.classification.lifecycle,
    archetype: cardContext.classification.archetype,
  });

  const playerOpportunity =
    input.playerOpportunity ?? computePlayerOpportunity(playerContext, cardContext);

  const valuation = computeCardValuation(cardContext, cardWeights);
  const scarcity = computeScarcityScore(cardContext, cardWeights);
  const demand = computeCardDemandScore(cardContext, valuation, cardWeights);
  const risk = computeCardRisk(cardContext, valuation, cardWeights);
  const seasonality = computeSeasonalityForecast(cardContext, cardWeights);
  const forecast = computeCardForecast({
    valuation,
    demand,
    risk,
    seasonality,
    sportMarket: cardContext.sportMarket,
    asOf: cardContext.asOf,
    weights: cardWeights,
  });

  const lifecycle = classifyPlayerOpportunityLifecycle(
    cardContext.asset,
    cardContext.classification.lifecycle
  );
  const weights = resolvePlayerCardOpportunityWeights({
    era: cardContext.classification.era,
    archetype: cardContext.classification.archetype,
    lifecycle,
  });

  const fairMarketValue =
    playerOpportunity.referenceFairValue ??
    valuation.fairValue ??
    0;
  const currentMarketValue =
    cardContext.sales[0]?.sale_price ?? valuation.median30d ?? fairMarketValue;

  const mispricing = computeMispricing(currentMarketValue, fairMarketValue);

  const expectedReturn90d = forecast.predictedChangePct ?? playerOpportunity.expectedDemandChange90d;
  const expectedValue90d =
    forecast.predictedValue ??
    roundCurrency(fairMarketValue * (1 + expectedReturn90d / 100));

  const scenarios = scenarioValues(fairMarketValue, expectedReturn90d);

  const returnScore = clampScore(50 + expectedReturn90d * 2.5);
  const volatilityScore = risk.volatilityScore;
  const liquidityScore = risk.liquidityScore;
  const riskAdjustedReturn = riskAdjustedReturnScore(
    expectedReturn90d,
    playerOpportunity.riskScore,
    volatilityScore
  );

  const totalWeight =
    weights.playerOpportunity +
    weights.valuation +
    weights.scarcity +
    weights.demand +
    weights.expectedReturn +
    weights.riskAdjustedReturn +
    weights.liquidity;

  const rawComposite =
    playerOpportunity.opportunityScore * weights.playerOpportunity +
    mispricing.valuationScore * weights.valuation +
    scarcity.score * weights.scarcity +
    demand.score * weights.demand +
    returnScore * weights.expectedReturn +
    riskAdjustedReturn * weights.riskAdjustedReturn +
    liquidityScore * weights.liquidity;

  const compositeBeforeConstraints = clampScore(rawComposite / totalWeight);
  const confidenceScore = clampScore(
    Math.min(
      playerOpportunity.confidenceScore,
      valuation.confidence === "none" ? 30 : valuation.confidenceScore
    )
  );

  const opportunityScore = applyRiskConfidenceConstraints(
    compositeBeforeConstraints,
    Math.max(playerOpportunity.riskScore, risk.volatilityScore),
    confidenceScore
  );

  const recommendation = recommendationFromScore(
    opportunityScore,
    DEFAULT_OPPORTUNITY_THRESHOLDS
  );

  const positiveDrivers: string[] = [];
  const negativeDrivers: string[] = [];

  positiveDrivers.push(`Player Opportunity: ${playerOpportunity.opportunityScore}.`);

  if (mispricing.isUnderpriced) {
    positiveDrivers.push(
      `Card trades ${Math.abs(mispricing.marginOfSafety).toFixed(0)}% below estimated fair market value.`
    );
  }
  if (mispricing.isOverpriced) {
    negativeDrivers.push(
      `Card trades ${Math.abs(mispricing.marginOfSafety).toFixed(0)}% above estimated fair market value.`
    );
  }
  if (scarcity.score >= 65) positiveDrivers.push("Scarcity profile is favorable.");
  if (demand.score >= 60) positiveDrivers.push("Card demand is accelerating.");
  if (playerOpportunity.opportunityScore >= 75 && mispricing.isOverpriced) {
    negativeDrivers.push(
      "Strong player outlook does not offset current overvaluation."
    );
  }
  if (risk.overallRisk === "high") {
    negativeDrivers.push("Card risk and volatility are elevated.");
  }

  const computedAt = new Date().toISOString();
  const explanation = computePlayerCardOpportunityExplanation({
    opportunityScore,
    recommendation,
    playerOpportunityScore: playerOpportunity.opportunityScore,
    expectedReturn90d,
    positiveDrivers,
    negativeDrivers,
    mispricing,
  });

  return {
    cardId: cardContext.asset.id,
    playerId: playerContext.playerId,
    modelVersion: PLAYER_CARD_OPPORTUNITY_MODEL_VERSION,
    computedAt,
    opportunityScore,
    playerOpportunityScore: playerOpportunity.opportunityScore,
    valuationScore: mispricing.valuationScore,
    scarcityScore: scarcity.score,
    demandScore: demand.score,
    returnScore,
    riskAdjustedReturnScore: riskAdjustedReturn,
    liquidityScore,
    currentMarketValue,
    fairMarketValue,
    expectedValue90d,
    expectedReturn90d,
    upsideScenario: scenarios.upsideScenario,
    baseScenario: scenarios.baseScenario,
    downsideScenario: scenarios.downsideScenario,
    marginOfSafety: mispricing.marginOfSafety,
    priceToFairValueRatio: mispricing.priceToFairValueRatio,
    riskScore: playerOpportunity.riskScore,
    volatilityScore,
    confidenceScore,
    recommendation,
    positiveDrivers,
    negativeDrivers,
    catalysts: playerOpportunity.catalysts,
    summary: explanation.summary,
    weightProfileId: weights.id,
    inputs: {
      asOf: cardContext.asOf,
      compCount: cardContext.sales.length,
      playerOpportunityProfile: playerOpportunity.weightProfileId,
      valuationConfidence: valuation.confidence,
    },
  };
}

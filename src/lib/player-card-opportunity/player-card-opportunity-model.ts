import { computeCardDemandScore } from "@/lib/card-investment/demand/card-demand-model";
import { computeCardForecast } from "@/lib/card-investment/forecast/card-forecast-model";
import { computeCardRisk } from "@/lib/card-investment/risk/card-risk-model";
import { computeScarcityScore } from "@/lib/card-investment/scarcity/card-scarcity-model";
import { computeSeasonalityForecast } from "@/lib/card-investment/seasonality/card-seasonality-model";
import { clampScore, roundCurrency } from "@/lib/card-investment/types/math";
import { computeCardValuation } from "@/lib/card-investment/valuation/card-valuation-model";
import { currentMarketValueFromSales } from "@/lib/card-investment/valuation/current-price";
import { resolveWeightProfile } from "@/lib/card-investment/weights/profiles";
import { classifyPlayerOpportunityLifecycle } from "@/lib/player-opportunity/classification/lifecycle";
import { driversFromComponentScores } from "@/lib/player-opportunity/explainability";
import { computePlayerCardOpportunityExplanation } from "@/lib/player-card-opportunity/explainability";
import {
  computeMispricing,
  scenarioValues,
} from "@/lib/player-card-opportunity/mispricing";
import {
  DEFAULT_OPPORTUNITY_THRESHOLDS,
  constrainRecommendation,
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
  permanentLossRisk: number,
  volatilityScore: number
): number {
  const penalty = permanentLossRisk * 0.35 + volatilityScore * 0.15;
  return clampScore(50 + expectedReturn90d * 2 - penalty * 0.3);
}

function applyRiskConfidenceConstraints(
  rawScore: number,
  permanentLossRisk: number,
  confidenceScore: number
): number {
  let score = rawScore;

  if (permanentLossRisk >= 75) score *= 0.75;
  else if (permanentLossRisk >= 60) score *= 0.88;

  if (confidenceScore < 35) score *= 0.7;
  else if (confidenceScore < 50) score *= 0.85;

  return clampScore(score);
}

function permanentLossRiskScore(input: {
  playerRisk: number;
  priceToFairValueRatio: number;
  liquidityScore: number;
  populationGrowthPct: number;
}): number {
  const overpayRisk =
    input.priceToFairValueRatio > 1
      ? clampScore((input.priceToFairValueRatio - 1) * 100)
      : 0;
  const illiquidityRisk = clampScore(100 - input.liquidityScore);
  const popGrowthRisk = clampScore(input.populationGrowthPct * 3);
  return clampScore(
    input.playerRisk * 0.4 + overpayRisk * 0.25 + illiquidityRisk * 0.2 + popGrowthRisk * 0.15
  );
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
    input.playerOpportunity ?? computePlayerOpportunity(playerContext);

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
    cardContext.classification.lifecycle,
    new Date(cardContext.asOf).getFullYear(),
    playerContext.playerProfile
  );
  const weights = resolvePlayerCardOpportunityWeights({
    era: cardContext.classification.era,
    archetype: cardContext.classification.archetype,
    lifecycle,
  });

  const fairMarketValue = valuation.fairValue ?? 0;
  const currentMarketValue = currentMarketValueFromSales(
    cardContext.sales,
    cardContext.asOf,
    valuation.median30d ?? fairMarketValue
  );

  const mispricing = computeMispricing(currentMarketValue, fairMarketValue);

  const sportReturn = cardContext.sportMarket?.provenance.available
    ? cardContext.sportMarket.forecast3mPct * 0.5
    : 0;
  const forecastReturn = (forecast.predictedChangePct ?? 0) * 0.2;
  const expectedReturn90d = roundCurrency(
    mispricing.marginOfSafety * 0.25 + sportReturn + forecastReturn
  );
  const expectedValue90d = roundCurrency(
    currentMarketValue * (1 + expectedReturn90d / 100)
  );

  const scenarios = scenarioValues(fairMarketValue, expectedReturn90d);

  const returnScore = clampScore(50 + expectedReturn90d * 2.5);
  const volatilityScore = risk.volatilityScore;
  const liquidityScore = risk.liquidityScore;
  const confidenceScore = clampScore(
    Math.min(
      playerOpportunity.confidenceScore,
      valuation.confidence === "none" ? 30 : valuation.confidenceScore
    )
  );
  const uncertaintyScore = clampScore(100 - confidenceScore);
  const riskScore = permanentLossRiskScore({
    playerRisk: playerOpportunity.riskScore,
    priceToFairValueRatio: mispricing.priceToFairValueRatio,
    liquidityScore,
    populationGrowthPct: cardContext.supply?.populationGrowthPct ?? 0,
  });
  const riskAdjustedReturn = riskAdjustedReturnScore(
    expectedReturn90d,
    riskScore,
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
  const opportunityScore = applyRiskConfidenceConstraints(
    compositeBeforeConstraints,
    riskScore,
    confidenceScore
  );

  const rawRecommendation = recommendationFromScore(
    opportunityScore,
    DEFAULT_OPPORTUNITY_THRESHOLDS
  );
  const recommendation = constrainRecommendation(rawRecommendation, {
    confidenceScore,
    priceToFairValueRatio: mispricing.priceToFairValueRatio,
    marginOfSafety: mispricing.marginOfSafety,
    sportBear: cardContext.sportMarket?.riskRating === "high",
  });

  const fromScores = driversFromComponentScores(
    {
      playerOpportunity: playerOpportunity.opportunityScore,
      valuation: mispricing.valuationScore,
      scarcity: scarcity.score,
      demand: demand.score,
      expectedReturn: returnScore,
      liquidity: liquidityScore,
    },
    {
      playerOpportunity: "Player outlook",
      valuation: "Valuation versus fair value",
      scarcity: "Scarcity",
      demand: "Card demand",
      expectedReturn: "Expected 90-day return",
      liquidity: "Liquidity",
    }
  );
  const positiveDrivers = [...fromScores.positiveDrivers];
  const negativeDrivers = [...fromScores.negativeDrivers];

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
  if ((cardContext.supply?.populationGrowthPct ?? 0) > 10 && scarcity.score <= 50) {
    negativeDrivers.push("Increasing population is reducing scarcity.");
  }
  if (playerOpportunity.opportunityScore >= 75 && mispricing.isOverpriced) {
    negativeDrivers.push("Strong player outlook does not offset current overvaluation.");
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
    riskScore,
    playerRiskScore: playerOpportunity.riskScore,
    volatilityScore,
    uncertaintyScore,
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
      currentPriceRule: "latest-or-7d-median",
    },
  };
}

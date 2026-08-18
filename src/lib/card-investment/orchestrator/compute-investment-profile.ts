import { computeCardDemandScore } from "@/lib/card-investment/demand/card-demand-model";
import {
  collectEvidenceKeys,
  computeInvestmentExplanation,
  validateExplanationTraceability,
} from "@/lib/card-investment/explainability/investment-explanation-model";
import { computeCardForecast } from "@/lib/card-investment/forecast/card-forecast-model";
import { singleCardPortfolioAnalysis } from "@/lib/card-investment/portfolio/portfolio-risk-model";
import { computePlayerLegacyScore } from "@/lib/card-investment/player/player-legacy-model";
import { computeInvestmentRecommendation } from "@/lib/card-investment/recommendation/investment-recommendation-model";
import { computeCardRisk } from "@/lib/card-investment/risk/card-risk-model";
import { computeScarcityScore } from "@/lib/card-investment/scarcity/card-scarcity-model";
import { computeSeasonalityForecast } from "@/lib/card-investment/seasonality/card-seasonality-model";
import { computeCardValuation } from "@/lib/card-investment/valuation/card-valuation-model";
import { resolveWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  CardInvestmentContext,
  CardInvestmentProfile,
} from "@/types/card-investment";
import { CARD_INVESTMENT_MODEL_VERSION } from "@/types/card-investment";

export function computeInvestmentProfile(
  context: CardInvestmentContext
): CardInvestmentProfile {
  const weights = resolveWeightProfile({
    sport: context.asset.sport,
    era: context.classification.era,
    lifecycle: context.classification.lifecycle,
    archetype: context.classification.archetype,
  });

  const valuation = computeCardValuation(context, weights);
  const playerLegacy = computePlayerLegacyScore(context, weights);
  const scarcity = computeScarcityScore(context, weights);
  const demand = computeCardDemandScore(context, valuation, weights);
  const risk = computeCardRisk(context, valuation, weights);
  const seasonality = computeSeasonalityForecast(context, weights);
  const forecast = computeCardForecast({
    valuation,
    demand,
    risk,
    seasonality,
    sportMarket: context.sportMarket,
    asOf: context.asOf,
    weights,
  });
  const recommendation = computeInvestmentRecommendation({
    valuation,
    playerLegacy,
    scarcity,
    demand,
    risk,
    seasonality,
    forecast,
    weights,
  });

  const explanationInput = {
    valuation,
    playerLegacy,
    scarcity,
    demand,
    risk,
    seasonality,
    forecast,
    recommendation,
  };

  const explanation = computeInvestmentExplanation(explanationInput);
  const allowedKeys = collectEvidenceKeys(explanationInput);
  if (!validateExplanationTraceability(explanation, allowedKeys)) {
    throw new Error("Explainability traceability validation failed");
  }

  const portfolio = singleCardPortfolioAnalysis(context);
  const computedAt = new Date().toISOString();

  return {
    assetId: context.asset.id,
    modelVersion: CARD_INVESTMENT_MODEL_VERSION,
    computedAt,
    classification: context.classification,
    valuation,
    playerLegacy,
    scarcity,
    demand,
    risk,
    seasonality,
    forecast,
    recommendation,
    explanation,
    portfolio,
    sportMarket: context.sportMarket,
    inputs: {
      asOf: context.asOf,
      compCount: context.sales.length,
      weightProfileId: weights.id,
      sportIndexAvailable: context.sportMarket?.provenance.available ?? false,
    },
  };
}

import type {
  CardDemandScore,
  CardForecast,
  CardMarketValuation,
  CardRisk,
  ExplanationClaim,
  InvestmentExplanation,
  InvestmentRecommendation,
  PlayerLegacyScore,
  ScarcityScore,
  SeasonalityForecast,
} from "@/types/card-investment";

export interface ExplanationModelInput {
  valuation: CardMarketValuation;
  playerLegacy: PlayerLegacyScore;
  scarcity: ScarcityScore;
  demand: CardDemandScore;
  risk: CardRisk;
  seasonality: SeasonalityForecast;
  forecast: CardForecast;
  recommendation: InvestmentRecommendation;
}

function factorClaims(
  sourceModel: string,
  factors: { key: string; label: string }[]
): ExplanationClaim[] {
  return factors.map((factor) => ({
    claim: factor.label,
    sourceModel,
    evidenceKeys: [factor.key],
  }));
}

export function computeInvestmentExplanation(
  input: ExplanationModelInput
): InvestmentExplanation {
  const claims: ExplanationClaim[] = [];

  if (input.valuation.fairValue != null) {
    claims.push({
      claim: `Fair value estimated at $${input.valuation.fairValue.toFixed(2)} from ${input.valuation.compCount} comp(s)`,
      sourceModel: "card-valuation",
      evidenceKeys: ["fair_value", "comp_count"],
    });
  } else {
    claims.push({
      claim: "Fair value unavailable due to missing comparable sales",
      sourceModel: "card-valuation",
      evidenceKeys: ["fair_value"],
    });
  }

  if (input.valuation.outliersRejected > 0) {
    claims.push({
      claim: `${input.valuation.outliersRejected} outlier sale(s) excluded from valuation`,
      sourceModel: "card-valuation",
      evidenceKeys: ["outlier_rejection"],
    });
  }

  claims.push(
    ...factorClaims("player-legacy", input.playerLegacy.factors),
    ...factorClaims("scarcity", input.scarcity.factors),
    ...factorClaims("demand", input.demand.factors),
    ...factorClaims("risk", input.risk.factors),
    ...factorClaims("seasonality", input.seasonality.factors),
    ...factorClaims("forecast", input.forecast.factors)
  );

  if (input.forecast.predictedChangePct != null) {
    claims.push({
      claim: `90-day forecast: ${input.forecast.predictedChangePct >= 0 ? "+" : ""}${input.forecast.predictedChangePct.toFixed(1)}% (${input.forecast.direction})`,
      sourceModel: "forecast",
      evidenceKeys: ["predicted_change_pct"],
    });
  }

  claims.push({
    claim: `Recommendation: ${input.recommendation.rating.replace("_", " ")} — ${input.recommendation.summary}`,
    sourceModel: "recommendation",
    evidenceKeys: ["rating", "composite_score"],
  });

  const confidenceScores = [
    input.valuation.confidenceScore,
    input.recommendation.confidence === "none" ? 0 : input.recommendation.score,
  ].filter((value) => value > 0);

  const avgConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((sum, value) => sum + value, 0) / confidenceScores.length
      : 0;

  let confidence: InvestmentExplanation["confidence"] = "none";
  if (avgConfidence >= 70) confidence = "high";
  else if (avgConfidence >= 40) confidence = "medium";
  else if (avgConfidence > 0) confidence = "low";

  return {
    summary: input.recommendation.summary,
    claims,
    confidence,
  };
}

/** Ensures every claim maps to a known evidence key from model factors. */
export function validateExplanationTraceability(
  explanation: InvestmentExplanation,
  allowedEvidenceKeys: Set<string>
): boolean {
  return explanation.claims.every((claim) =>
    claim.evidenceKeys.every((key) => allowedEvidenceKeys.has(key))
  );
}

export function collectEvidenceKeys(
  input: ExplanationModelInput
): Set<string> {
  const keys = new Set<string>([
    "fair_value",
    "comp_count",
    "outlier_rejection",
    "predicted_change_pct",
    "rating",
    "composite_score",
  ]);

  for (const model of [
    input.playerLegacy,
    input.scarcity,
    input.demand,
    input.risk,
    input.seasonality,
    input.forecast,
    input.recommendation,
  ]) {
    for (const factor of "factors" in model ? model.factors : []) {
      keys.add(factor.key);
    }
  }

  return keys;
}

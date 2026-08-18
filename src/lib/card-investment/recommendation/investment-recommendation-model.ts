import { clampScore, confidenceFromScore } from "@/lib/card-investment/types/math";
import type { ModelWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  CardDemandScore,
  CardForecast,
  CardMarketValuation,
  CardRisk,
  InvestmentRating,
  InvestmentRecommendation,
  PlayerLegacyScore,
  ScarcityScore,
  SeasonalityForecast,
  ValuationFactor,
} from "@/types/card-investment";

export interface RecommendationModelInput {
  valuation: CardMarketValuation;
  playerLegacy: PlayerLegacyScore;
  scarcity: ScarcityScore;
  demand: CardDemandScore;
  risk: CardRisk;
  seasonality: SeasonalityForecast;
  forecast: CardForecast;
  weights: ModelWeightProfile;
}

function riskToScore(risk: CardRisk): number {
  if (risk.overallRisk === "low") return 75;
  if (risk.overallRisk === "medium") return 50;
  return 25;
}

function ratingFromScore(score: number): InvestmentRating {
  if (score >= 75) return "strong_buy";
  if (score >= 60) return "buy";
  if (score >= 45) return "hold";
  if (score >= 30) return "avoid";
  return "insufficient_data";
}

export function computeInvestmentRecommendation(
  input: RecommendationModelInput
): InvestmentRecommendation {
  const { valuation, playerLegacy, scarcity, demand, risk, seasonality, forecast, weights } =
    input;

  if (valuation.fairValue == null || valuation.confidence === "none") {
    return {
      rating: "insufficient_data",
      score: 0,
      confidence: "none",
      horizonDays: 90,
      summary: "Insufficient comparable sales to form a recommendation.",
      factors: [],
    };
  }

  const w = weights.recommendation;
  const composite =
    valuation.confidenceScore * w.valuation +
    playerLegacy.score * w.playerLegacy +
    scarcity.score * w.scarcity +
    demand.score * w.demand +
    riskToScore(risk) * w.risk +
    seasonality.seasonalityScore * w.seasonality +
    (forecast.predictedChangePct != null
      ? clampScore(50 + forecast.predictedChangePct * 2)
      : 50) *
      w.forecast;

  const totalWeight =
    w.valuation +
    w.playerLegacy +
    w.scarcity +
    w.demand +
    w.risk +
    w.seasonality +
    w.forecast;

  const score = clampScore(composite / totalWeight);
  const rating = ratingFromScore(score);

  const factors: ValuationFactor[] = [
    {
      key: "composite_score",
      label: "Weighted model composite",
      impact: score,
      direction: score >= 55 ? "positive" : score <= 45 ? "negative" : "neutral",
    },
  ];

  const summaryParts: string[] = [];
  if (forecast.direction === "up") {
    summaryParts.push("90-day outlook is positive");
  } else if (forecast.direction === "down") {
    summaryParts.push("90-day outlook is negative");
  }
  if (demand.sentiment === "bullish") {
    summaryParts.push("demand is bullish");
  } else if (demand.sentiment === "bearish") {
    summaryParts.push("demand is bearish");
  }
  summaryParts.push(`overall ${rating.replace("_", " ")}`);

  return {
    rating,
    score,
    confidence: confidenceFromScore(score, true),
    horizonDays: 90,
    summary: summaryParts.join("; ") + ".",
    factors,
  };
}

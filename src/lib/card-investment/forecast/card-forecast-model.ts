import {
  availableProvenance,
  unavailableProvenance,
} from "@/lib/card-investment/provenance/types";
import {
  clampScore,
  confidenceFromScore,
  percentChange,
  roundCurrency,
} from "@/lib/card-investment/types/math";
import type { ModelWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  CardDemandScore,
  CardForecast,
  CardMarketValuation,
  CardRisk,
  SeasonalityForecast,
  SportMarketSnapshot,
  ValuationFactor,
} from "@/types/card-investment";

export interface ForecastModelInput {
  valuation: CardMarketValuation;
  demand: CardDemandScore;
  risk: CardRisk;
  seasonality: SeasonalityForecast;
  sportMarket: SportMarketSnapshot | null;
  asOf: string;
  weights: ModelWeightProfile;
}

export function computeCardForecast(input: ForecastModelInput): CardForecast {
  const { valuation, demand, seasonality, sportMarket, weights, asOf } = input;
  const factors: ValuationFactor[] = [];

  if (valuation.fairValue == null) {
    return {
      horizonDays: 90,
      predictedValue: null,
      predictedChangePct: null,
      direction: "unknown",
      confidence: "none",
      factors: [],
      provenance: unavailableProvenance("forecast", "Fair value unavailable"),
    };
  }

  let changePct = 0;

  if (valuation.median7d != null && valuation.median30d != null) {
    const trend = percentChange(valuation.median30d, valuation.median7d) ?? 0;
    changePct += trend * weights.forecast.valuationTrend;
    if (Math.abs(trend) > 1) {
      factors.push({
        key: "valuation_trend",
        label: `Recent valuation trend ${trend.toFixed(1)}%`,
        impact: Math.abs(trend),
        direction: trend > 0 ? "positive" : trend < 0 ? "negative" : "neutral",
      });
    }
  }

  const demandAdj = ((demand.score - 50) / 50) * 8 * weights.forecast.demand;
  changePct += demandAdj;
  factors.push({
    key: "demand_adj",
    label: `Demand score ${demand.score}/100`,
    impact: Math.abs(demandAdj),
    direction: demandAdj > 0 ? "positive" : demandAdj < 0 ? "negative" : "neutral",
  });

  if (sportMarket?.provenance.available) {
    const sportAdj =
      (sportMarket.forecast3mPct / 3) * weights.forecast.sportForecast;
    changePct += sportAdj;
    factors.push({
      key: "sport_forecast",
      label: `Sport 3m forecast ${sportMarket.forecast3mPct.toFixed(1)}%`,
      impact: Math.abs(sportAdj),
      direction: sportAdj > 0 ? "positive" : sportAdj < 0 ? "negative" : "neutral",
    });
  }

  const seasonAdj =
    ((seasonality.seasonalityScore - 50) / 50) * 5 * weights.forecast.seasonality;
  changePct += seasonAdj;

  const predictedChangePct = roundCurrency(changePct);
  const predictedValue = roundCurrency(
    valuation.fairValue * (1 + predictedChangePct / 100)
  );

  let direction: CardForecast["direction"] = "flat";
  if (predictedChangePct > 2) direction = "up";
  else if (predictedChangePct < -2) direction = "down";

  const confidenceInputs = [
    valuation.confidenceScore,
    demand.confidence === "none" ? 0 : demand.score,
    seasonality.confidence === "none" ? 0 : seasonality.seasonalityScore,
  ];
  const avgConfidence =
    confidenceInputs.reduce((sum, value) => sum + value, 0) /
    confidenceInputs.length;

  return {
    horizonDays: 90,
    predictedValue,
    predictedChangePct,
    direction,
    confidence: confidenceFromScore(clampScore(avgConfidence), true),
    factors,
    provenance: availableProvenance("forecast-composite", asOf),
  };
}

import { clampScore } from "@/lib/market-sentiment/fetch-utils";
import { getForecastRules, getRiskThresholds } from "@/lib/market-index/engine/validate-config";
import type {
  SportMarketIndexConfig,
  SportMarketIndexRiskRating,
} from "@/types/market-index";

export interface ForecastComputation {
  forecast3mPct: number;
  forecast6mPct: number;
  forecast12mPct: number;
  confidenceScore: number;
  riskRating: SportMarketIndexRiskRating;
}

function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeForecast(input: {
  config: SportMarketIndexConfig;
  healthScore: number;
  momentumScore: number;
  outlookScore: number;
  providerConfidence: number;
  vectorCoverage: number;
  supplyHeadwinds: number;
}): ForecastComputation {
  const { coefficients } = getForecastRules(input.config);
  const outlookTo3m = coefficients.outlook_to_3m ?? 0.25;
  const momentumAdj = coefficients.momentum_adj ?? 0.08;
  const mult6 = coefficients.horizon_6m_multiplier ?? 1.6;
  const mult12 = coefficients.horizon_12m_multiplier ?? 2.4;
  const decayPull = coefficients.decay_pull_strength ?? 0.35;

  const outlookCentered = input.outlookScore - 50;
  const momentumCentered = input.momentumScore - 50;

  let forecast3m =
    outlookCentered * outlookTo3m + momentumCentered * momentumAdj * 0.1;

  const confidenceScore = clampScore(
    input.providerConfidence * 0.7 + input.vectorCoverage * 100 * 0.3
  );

  const decayFactor = 1 - ((100 - confidenceScore) / 100) * decayPull;
  forecast3m *= decayFactor;

  const forecast6m = forecast3m * mult6 * 0.75;
  const forecast12m = forecast3m * mult12 * 0.65;

  const thresholds = getRiskThresholds(input.config);
  let riskRating: SportMarketIndexRiskRating = "medium";
  if (
    confidenceScore >= thresholds.lowConfidenceMin &&
    input.supplyHeadwinds < thresholds.highSupplyHeadwindCount
  ) {
    riskRating = "low";
  } else if (confidenceScore < thresholds.mediumConfidenceMin) {
    riskRating = "high";
  }

  return {
    forecast3mPct: roundPct(forecast3m),
    forecast6mPct: roundPct(forecast6m),
    forecast12mPct: roundPct(forecast12m),
    confidenceScore,
    riskRating,
  };
}

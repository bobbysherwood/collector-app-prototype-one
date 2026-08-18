import { clampScore, roundCurrency } from "@/lib/card-investment/types/math";

export interface MispricingMetrics {
  currentMarketValue: number;
  fairMarketValue: number;
  priceToFairValueRatio: number;
  marginOfSafety: number;
  valuationScore: number;
  isOverpriced: boolean;
  isUnderpriced: boolean;
}

export function computeMispricing(
  currentMarketValue: number,
  fairMarketValue: number
): MispricingMetrics {
  if (fairMarketValue <= 0) {
    return {
      currentMarketValue,
      fairMarketValue,
      priceToFairValueRatio: 1,
      marginOfSafety: 0,
      valuationScore: 50,
      isOverpriced: false,
      isUnderpriced: false,
    };
  }

  const ratio = roundCurrency(currentMarketValue / fairMarketValue);
  const marginOfSafety = roundCurrency((1 - ratio) * 100);

  // Neutral at fair value (50); each 1% mispricing moves score by 2.5 points.
  const deviationPct = marginOfSafety;
  const valuationScore = clampScore(50 + deviationPct * 2.5);

  return {
    currentMarketValue,
    fairMarketValue,
    priceToFairValueRatio: ratio,
    marginOfSafety,
    valuationScore,
    isOverpriced: ratio > 1.03,
    isUnderpriced: ratio < 0.97,
  };
}

export function scenarioValues(fairMarketValue: number, expectedReturn90d: number): {
  upsideScenario: number;
  baseScenario: number;
  downsideScenario: number;
} {
  const base = roundCurrency(fairMarketValue * (1 + expectedReturn90d / 100));
  return {
    upsideScenario: roundCurrency(base * 1.15),
    baseScenario: base,
    downsideScenario: roundCurrency(base * 0.85),
  };
}

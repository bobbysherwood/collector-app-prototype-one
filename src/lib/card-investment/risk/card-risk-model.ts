import {
  availableProvenance,
  unavailableProvenance,
} from "@/lib/card-investment/provenance/types";
import {
  clampScore,
  confidenceFromScore,
  filterSalesByWindow,
  median,
} from "@/lib/card-investment/types/math";
import type { ModelWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  CardInvestmentContext,
  CardMarketValuation,
  CardRisk,
  ValuationFactor,
} from "@/types/card-investment";

function volatilityFromSales(
  context: CardInvestmentContext
): { score: number; factor: ValuationFactor | null } {
  const recent = filterSalesByWindow(context.sales, 90, context.asOf);
  if (recent.length < 2) {
    return { score: 70, factor: null };
  }

  const prices = recent.map((sale) => sale.sale_price);
  const med = median(prices);
  if (med == null || med === 0) {
    return { score: 70, factor: null };
  }

  const deviations = prices.map((price) => Math.abs(price - med) / med);
  const avgDev = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
  const volatilityScore = clampScore(avgDev * 100);
  const riskScore = clampScore(100 - volatilityScore);

  return {
    score: riskScore,
    factor: {
      key: "price_volatility",
      label: `90-day price dispersion ${Math.round(avgDev * 100)}%`,
      impact: volatilityScore,
      direction: avgDev > 0.25 ? "negative" : "neutral",
    },
  };
}

function liquidityFromValuation(valuation: CardMarketValuation): {
  score: number;
  factor: ValuationFactor | null;
} {
  if (valuation.compCount === 0) {
    return { score: 20, factor: null };
  }

  const score = clampScore(Math.min(valuation.compCount / 10, 1) * 100);
  return {
    score,
    factor: {
      key: "liquidity",
      label: `${valuation.compCount} comps indicate ${score >= 60 ? "active" : "thin"} liquidity`,
      impact: score,
      direction: score >= 60 ? "positive" : "negative",
    },
  };
}

function overallRiskLevel(score: number): CardRisk["overallRisk"] {
  if (score >= 65) return "low";
  if (score >= 40) return "medium";
  return "high";
}

export function computeCardRisk(
  context: CardInvestmentContext,
  valuation: CardMarketValuation,
  weights: ModelWeightProfile
): CardRisk {
  const factors: ValuationFactor[] = [];
  const volatility = volatilityFromSales(context);
  const liquidity = liquidityFromValuation(valuation);

  if (volatility.factor) factors.push(volatility.factor);
  if (liquidity.factor) factors.push(liquidity.factor);

  let score =
    volatility.score * weights.risk.volatility +
    liquidity.score * weights.risk.liquidity;

  const sport = context.sportMarket;
  if (sport?.provenance.available) {
    const sportRiskScore =
      sport.riskRating === "low" ? 80 : sport.riskRating === "medium" ? 55 : 30;
    score += sportRiskScore * weights.risk.sportRisk;
    factors.push({
      key: "sport_risk",
      label: `Sport market risk: ${sport.riskRating}`,
      impact: sportRiskScore,
      direction: sport.riskRating === "low" ? "positive" : "negative",
    });
  } else {
    score += 45 * weights.risk.sportRisk;
  }

  const finalScore = clampScore(score);
  const hasData = valuation.compCount > 0 || sport?.provenance.available;

  return {
    overallRisk: overallRiskLevel(finalScore),
    volatilityScore: clampScore(100 - volatility.score),
    liquidityScore: liquidity.score,
    confidence: hasData ? confidenceFromScore(finalScore, true) : "none",
    factors,
    provenance: hasData
      ? availableProvenance("risk-composite", context.asOf)
      : unavailableProvenance("risk-composite", "Insufficient risk inputs"),
  };
}

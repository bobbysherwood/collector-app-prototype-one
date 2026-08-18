import {
  availableProvenance,
  unavailableProvenance,
} from "@/lib/card-investment/provenance/types";
import { clampScore, confidenceFromScore } from "@/lib/card-investment/types/math";
import type { ModelWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  CardDemandScore,
  CardInvestmentContext,
  CardMarketValuation,
  ValuationFactor,
} from "@/types/card-investment";

export function computeCardDemandScore(
  context: CardInvestmentContext,
  valuation: CardMarketValuation,
  weights: ModelWeightProfile
): CardDemandScore {
  const factors: ValuationFactor[] = [];
  const sport = context.sportMarket;

  if (!sport?.provenance.available) {
    return {
      score: 50,
      sentiment: "neutral",
      confidence: "none",
      factors: [],
      provenance: unavailableProvenance(
        "sport-market-index",
        "Sport market index unavailable"
      ),
    };
  }

  let score =
    sport.momentumScore * weights.demand.sportMomentum +
    sport.outlookScore * weights.demand.sportOutlook;

  factors.push({
    key: "sport_momentum",
    label: `Sport momentum ${sport.momentumScore}/100`,
    impact: sport.momentumScore * weights.demand.sportMomentum,
    direction:
      sport.momentumScore >= 55
        ? "positive"
        : sport.momentumScore <= 45
          ? "negative"
          : "neutral",
  });

  factors.push({
    key: "sport_outlook",
    label: `Sport outlook ${sport.outlookScore}/100`,
    impact: sport.outlookScore * weights.demand.sportOutlook,
    direction:
      sport.outlookScore >= 55
        ? "positive"
        : sport.outlookScore <= 45
          ? "negative"
          : "neutral",
  });

  const compBoost = Math.min(valuation.compCount / 10, 1) * 20 * weights.demand.compVolume;
  score += compBoost;
  if (valuation.compCount > 0) {
    factors.push({
      key: "comp_volume",
      label: `${valuation.compCount} comparable sales`,
      impact: compBoost,
      direction: valuation.compCount >= 5 ? "positive" : "neutral",
    });
  }

  const finalScore = clampScore(score);
  let sentiment: CardDemandScore["sentiment"] = "neutral";
  if (finalScore >= 60) sentiment = "bullish";
  else if (finalScore <= 40) sentiment = "bearish";

  return {
    score: finalScore,
    sentiment,
    confidence: confidenceFromScore(finalScore, true),
    factors,
    provenance: availableProvenance("sport-market-index", sport.asOf),
  };
}

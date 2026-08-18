import {
  availableProvenance,
  unavailableProvenance,
} from "@/lib/card-investment/provenance/types";
import { clampScore, confidenceFromScore } from "@/lib/card-investment/types/math";
import type { ModelWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  CardInvestmentContext,
  Catalyst,
  SeasonalityForecast,
  ValuationFactor,
} from "@/types/card-investment";

function nbaCatalysts(phase: string, asOf: string): Catalyst[] {
  const catalysts: Catalyst[] = [];

  if (phase === "playoffs") {
    catalysts.push({
      id: "nba-playoffs",
      label: "NBA playoffs performance window",
      expectedImpact: "positive",
      windowDays: 45,
      confidence: "medium",
    });
  }

  if (phase === "draft") {
    catalysts.push({
      id: "nba-draft",
      label: "NBA draft cycle attention",
      expectedImpact: "neutral",
      windowDays: 14,
      confidence: "medium",
    });
  }

  if (phase === "offseason") {
    catalysts.push({
      id: "nba-offseason",
      label: "Offseason liquidity slowdown",
      expectedImpact: "negative",
      windowDays: 60,
      confidence: "low",
    });
  }

  if (catalysts.length === 0) {
    catalysts.push({
      id: "nba-regular",
      label: "Regular season baseline demand",
      expectedImpact: "neutral",
      windowDays: 30,
      confidence: "low",
    });
  }

  void asOf;
  return catalysts;
}

export function computeSeasonalityForecast(
  context: CardInvestmentContext,
  weights: ModelWeightProfile
): SeasonalityForecast {
  const sport = context.sportMarket;
  const phase = sport?.seasonPhase ?? "unknown";
  const factors: ValuationFactor[] = [];

  if (!sport?.provenance.available || context.asset.sport !== "Basketball") {
    return {
      seasonalityScore: 50,
      phase,
      catalysts: [],
      confidence: "none",
      factors: [],
      provenance: unavailableProvenance(
        "seasonality",
        "Seasonality requires NBA sport market context"
      ),
    };
  }

  let modifier = 1;
  if (phase === "playoffs") modifier = weights.seasonality.playoffs;
  else if (phase === "draft") modifier = weights.seasonality.draft;
  else if (phase === "offseason") modifier = weights.seasonality.offseason;

  const score = clampScore(50 * modifier + (sport.momentumScore - 50) * 0.2);
  factors.push({
    key: "season_phase",
    label: `NBA season phase: ${phase}`,
    impact: Math.abs(score - 50),
    direction: score >= 50 ? "positive" : "negative",
  });

  return {
    seasonalityScore: score,
    phase,
    catalysts: nbaCatalysts(phase, context.asOf),
    confidence: confidenceFromScore(score, true),
    factors,
    provenance: availableProvenance("sport-market-index", sport.asOf),
  };
}

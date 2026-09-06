import {
  availableProvenance,
  unavailableProvenance,
} from "@/lib/card-investment/provenance/types";
import { clampScore, confidenceFromScore } from "@/lib/card-investment/types/math";
import type { ModelWeightProfile } from "@/lib/card-investment/weights/profiles";
import type {
  CardInvestmentContext,
  ScarcityScore,
  ValuationFactor,
} from "@/types/card-investment";

function scarcityTier(
  score: number
): ScarcityScore["tier"] {
  if (score >= 85) return "ultra_rare";
  if (score >= 70) return "rare";
  if (score >= 50) return "scarce";
  if (score >= 30) return "common";
  return "unknown";
}

export function computeScarcityScore(
  context: CardInvestmentContext,
  weights: ModelWeightProfile
): ScarcityScore {
  const { asset, classification } = context;
  const factors: ValuationFactor[] = [];
  let score = 40;

  if (classification.archetype === "parallel") {
    score += 20 * weights.scarcity.parallel;
    factors.push({
      key: "parallel",
      label: "Parallel / insert scarcity",
      impact: 20,
      direction: "positive",
    });
  }

  if (classification.archetype === "rookie") {
    score += 15 * weights.scarcity.rookie;
    factors.push({
      key: "rookie",
      label: "Rookie card demand premium",
      impact: 15,
      direction: "positive",
    });
  }

  if (classification.archetype === "auto" || classification.archetype === "memorabilia") {
    score += 18 * weights.scarcity.auto;
    factors.push({
      key: "hit_card",
      label: "Autograph or memorabilia scarcity",
      impact: 18,
      direction: "positive",
    });
  }

  if (classification.lifecycle === "legacy") {
    score += 10;
    factors.push({
      key: "legacy",
      label: "Hall-of-fame / legacy player supply is naturally constrained",
      impact: 10,
      direction: "positive",
    });
  }

  if (classification.era === "vintage" || classification.era === "pre_war") {
    score += 12 * weights.scarcity.vintage;
    factors.push({
      key: "vintage",
      label: "Vintage supply constraints",
      impact: 12,
      direction: "positive",
    });
  }

  const supply = context.supply;
  if (supply?.population != null) {
    const population = supply.population;
    if (population >= 10000) {
      const impact = 18 * weights.scarcity.population;
      score -= impact;
      factors.push({
        key: "population",
        label: `High graded population (${population.toLocaleString()})`,
        impact,
        direction: "negative",
      });
    } else if (population >= 1000) {
      const impact = 10 * weights.scarcity.population;
      score -= impact;
      factors.push({
        key: "population",
        label: `Elevated graded population (${population.toLocaleString()})`,
        impact,
        direction: "negative",
      });
    } else if (population <= 50) {
      const impact = 12 * weights.scarcity.population;
      score += impact;
      factors.push({
        key: "population",
        label: `Low graded population (${population})`,
        impact,
        direction: "positive",
      });
    } else if (population <= 200) {
      const impact = 6 * weights.scarcity.population;
      score += impact;
      factors.push({
        key: "population",
        label: `Constrained graded population (${population})`,
        impact,
        direction: "positive",
      });
    }
  }

  if (supply?.populationGrowthPct != null && supply.populationGrowthPct > 10) {
    const impact = Math.min(15, supply.populationGrowthPct * 0.4) * weights.scarcity.populationGrowth;
    score -= impact;
    factors.push({
      key: "population_growth",
      label: `Population growing ${supply.populationGrowthPct.toFixed(0)}%`,
      impact,
      direction: "negative",
    });
  }

  const parallel = (asset.insert_parallel ?? "").toLowerCase();
  if (parallel.includes("/")) {
    const match = parallel.match(/\/(\d+)/);
    if (match) {
      const denom = Number(match[1]);
      if (denom <= 25) {
        score += 15;
        factors.push({
          key: "numbered",
          label: `Numbered to ${denom}`,
          impact: 15,
          direction: "positive",
        });
      } else if (denom <= 99) {
        score += 8;
        factors.push({
          key: "numbered",
          label: `Numbered to ${denom}`,
          impact: 8,
          direction: "positive",
        });
      }
    }
  }

  const finalScore = clampScore(score);
  const hasSignal = factors.length > 0;

  return {
    score: finalScore,
    tier: scarcityTier(finalScore),
    confidence: hasSignal ? confidenceFromScore(finalScore, true) : "low",
    factors,
    provenance: hasSignal
      ? availableProvenance("card-metadata", context.asOf)
      : unavailableProvenance("card-metadata", "Limited scarcity metadata"),
  };
}

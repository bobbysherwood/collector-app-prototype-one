import { inferManufacturer } from "@/lib/card-investment/scarcity/infer-supply";
import { clampScore, confidenceFromScore } from "@/lib/card-investment/types/math";
import type {
  CardInvestmentContext,
  CardRiskLevel,
  PortfolioAnalysis,
  PortfolioExposure,
} from "@/types/card-investment";

export interface PortfolioModelInput {
  context: CardInvestmentContext;
  peerContexts?: CardInvestmentContext[];
}

function concentrationFromWeights(weights: number[]): CardRiskLevel {
  const maxWeight = Math.max(...weights, 0);
  if (maxWeight >= 60) return "high";
  if (maxWeight >= 40) return "medium";
  return "low";
}

function bucketWeights(
  contexts: CardInvestmentContext[],
  keyFn: (context: CardInvestmentContext) => string
): number[] {
  const total = contexts.length || 1;
  const counts = new Map<string, number>();
  for (const context of contexts) {
    const key = keyFn(context);
    counts.set(key, (counts.get(key) ?? 0) + 100 / total);
  }
  return [...counts.values()];
}

function graderOf(context: CardInvestmentContext): string {
  return context.grader ?? context.sales[0]?.grader ?? "unknown";
}

export function computePortfolioAnalysis(
  input: PortfolioModelInput
): PortfolioAnalysis {
  const { context, peerContexts = [] } = input;
  const allContexts = [context, ...peerContexts];
  const total = allContexts.length;

  const bucket = new Map<string, PortfolioExposure>();

  for (const entry of allContexts) {
    const manufacturer = entry.manufacturer ?? inferManufacturer(entry.asset);
    const grader = graderOf(entry);
    const key = `${entry.classification.era}:${entry.classification.archetype}:${entry.asset.sport}:${entry.asset.player_name}:${manufacturer}:${grader}`;
    const existing = bucket.get(key);
    if (existing) {
      existing.weightPct += 100 / total;
    } else {
      bucket.set(key, {
        sport: entry.asset.sport,
        era: entry.classification.era,
        archetype: entry.classification.archetype,
        playerName: entry.asset.player_name,
        manufacturer,
        grader,
        weightPct: 100 / total,
      });
    }
  }

  const exposures = [...bucket.values()].map((entry) => ({
    ...entry,
    weightPct: Math.round(entry.weightPct * 10) / 10,
  }));

  const playerConcentration = concentrationFromWeights(
    bucketWeights(allContexts, (entry) => entry.asset.player_name)
  );
  const sportConcentration = concentrationFromWeights(
    bucketWeights(allContexts, (entry) => entry.asset.sport)
  );
  const eraConcentration = concentrationFromWeights(
    bucketWeights(allContexts, (entry) => entry.classification.era)
  );
  const manufacturerConcentration = concentrationFromWeights(
    bucketWeights(allContexts, (entry) => entry.manufacturer ?? inferManufacturer(entry.asset))
  );
  const graderConcentration = concentrationFromWeights(
    bucketWeights(allContexts, graderOf)
  );

  const levels = [
    playerConcentration,
    sportConcentration,
    eraConcentration,
    manufacturerConcentration,
    graderConcentration,
  ];
  const concentrationRisk: CardRiskLevel = levels.includes("high")
    ? "high"
    : levels.includes("medium")
      ? "medium"
      : "low";

  const diversificationScore = clampScore(
    100 - Math.max(...exposures.map((entry) => entry.weightPct), 100)
  );

  const speculativeCount = allContexts.filter((entry) => {
    const era = entry.classification.era;
    const growth = entry.supply?.populationGrowthPct ?? 0;
    return (
      era === "ultra_modern" ||
      entry.classification.lifecycle === "rising" ||
      growth > 15
    );
  }).length;
  const speculativeSharePct = Math.round((speculativeCount / total) * 1000) / 10;

  const opportunities: string[] = [];
  const risks: string[] = [];

  if (context.classification.archetype === "rookie") {
    opportunities.push("Rookie archetype may benefit from performance catalysts");
  }
  if (context.classification.era === "vintage" || context.classification.era === "pre_war") {
    opportunities.push("Vintage era cards often retain long-term collector demand");
  }
  if (concentrationRisk === "high") {
    risks.push("Portfolio concentration in a single segment is elevated");
  }
  if (playerConcentration === "high") {
    risks.push("Player concentration is elevated");
  }
  if (manufacturerConcentration === "high") {
    risks.push("Manufacturer concentration is elevated");
  }
  if (graderConcentration === "high") {
    risks.push("Grading-company concentration is elevated");
  }
  if (speculativeSharePct >= 50) {
    risks.push("Speculative exposure (ultra-modern / rising / fast pop growth) is elevated");
  }
  if (context.sportMarket?.riskRating === "high") {
    risks.push("Underlying sport market risk is elevated");
  }

  return {
    concentrationRisk,
    diversificationScore,
    exposures,
    playerConcentration,
    sportConcentration,
    eraConcentration,
    manufacturerConcentration,
    graderConcentration,
    speculativeSharePct,
    opportunities,
    risks,
    confidence: peerContexts.length > 0 ? confidenceFromScore(diversificationScore, true) : "low",
  };
}

export function singleCardPortfolioAnalysis(
  context: CardInvestmentContext
): PortfolioAnalysis {
  return computePortfolioAnalysis({ context });
}

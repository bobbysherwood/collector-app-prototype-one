import { clampScore, confidenceFromScore } from "@/lib/card-investment/types/math";
import type {
  CardClassification,
  CardInvestmentContext,
  CardRiskLevel,
  PortfolioAnalysis,
  PortfolioExposure,
} from "@/types/card-investment";

export interface PortfolioModelInput {
  context: CardInvestmentContext;
  peerContexts?: CardInvestmentContext[];
}

function concentrationFromExposures(
  exposures: PortfolioExposure[]
): CardRiskLevel {
  const maxWeight = Math.max(...exposures.map((entry) => entry.weightPct), 0);
  if (maxWeight >= 60) return "high";
  if (maxWeight >= 40) return "medium";
  return "low";
}

export function computePortfolioAnalysis(
  input: PortfolioModelInput
): PortfolioAnalysis {
  const { context, peerContexts = [] } = input;
  const allContexts = [context, ...peerContexts];
  const total = allContexts.length;

  const bucket = new Map<string, PortfolioExposure>();

  for (const entry of allContexts) {
    const key = `${entry.classification.era}:${entry.classification.archetype}:${entry.asset.sport}`;
    const existing = bucket.get(key);
    if (existing) {
      existing.weightPct += 100 / total;
    } else {
      bucket.set(key, {
        sport: entry.asset.sport,
        era: entry.classification.era,
        archetype: entry.classification.archetype,
        weightPct: 100 / total,
      });
    }
  }

  const exposures = [...bucket.values()].map((entry) => ({
    ...entry,
    weightPct: Math.round(entry.weightPct * 10) / 10,
  }));

  const concentrationRisk = concentrationFromExposures(exposures);
  const diversificationScore = clampScore(
    100 - Math.max(...exposures.map((entry) => entry.weightPct), 100)
  );

  const opportunities: string[] = [];
  const risks: string[] = [];

  if (context.classification.archetype === "rookie") {
    opportunities.push("Rookie archetype may benefit from performance catalysts");
  }
  if (context.classification.era === "vintage") {
    opportunities.push("Vintage era cards often retain long-term collector demand");
  }
  if (concentrationRisk === "high") {
    risks.push("Portfolio concentration in a single segment is elevated");
  }
  if (context.sportMarket?.riskRating === "high") {
    risks.push("Underlying sport market risk is elevated");
  }

  return {
    concentrationRisk,
    diversificationScore,
    exposures,
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

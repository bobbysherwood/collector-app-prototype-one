import type { ScoreComputation } from "@/lib/market-index/engine/index-engine";
import type { IndexDriver, SportFeatureVector } from "@/types/market-index";
import { humanizeFeatureKey } from "@/types/market-index";
import { getFeatureDelta } from "@/lib/market-index/features/normalize";

function toDriver(
  featureKey: string,
  impactPoints: number,
  vector: SportFeatureVector
): IndexDriver {
  const deltaPct = getFeatureDelta(vector, featureKey);
  const direction: IndexDriver["direction"] =
    impactPoints > 0.5 ? "positive" : impactPoints < -0.5 ? "negative" : "neutral";

  return {
    featureKey,
    label: humanizeFeatureKey(featureKey),
    deltaPct: deltaPct || null,
    impactPoints: Math.round(impactPoints * 10) / 10,
    direction,
  };
}

export function buildIndexDrivers(input: {
  health: ScoreComputation;
  momentum: ScoreComputation;
  vector: SportFeatureVector;
}): { positiveDrivers: IndexDriver[]; negativeDrivers: IndexDriver[] } {
  const merged = [...input.health.contributions, ...input.momentum.contributions];
  const byKey = new Map<string, number>();

  for (const entry of merged) {
    byKey.set(
      entry.featureKey,
      (byKey.get(entry.featureKey) ?? 0) + entry.impactPoints - 50
    );
  }

  const drivers = [...byKey.entries()].map(([featureKey, impact]) =>
    toDriver(featureKey, impact, input.vector)
  );

  const positiveDrivers = drivers
    .filter((driver) => driver.direction === "positive")
    .sort((a, b) => b.impactPoints - a.impactPoints)
    .slice(0, 5);

  const negativeDrivers = drivers
    .filter((driver) => driver.direction === "negative")
    .sort((a, b) => a.impactPoints - b.impactPoints)
    .slice(0, 5);

  return { positiveDrivers, negativeDrivers };
}

export function buildIndexExplanation(input: {
  sportName: string;
  healthScore: number;
  momentumScore: number;
  outlookScore: number;
  forecast3mPct: number;
  forecast6mPct: number;
  forecast12mPct: number;
  confidenceScore: number;
  riskRating: string;
  positiveDrivers: IndexDriver[];
  negativeDrivers: IndexDriver[];
  seasonPhase: string;
}): string {
  const formatDriver = (driver: IndexDriver) => {
    const delta =
      driver.deltaPct != null
        ? ` (${driver.deltaPct > 0 ? "+" : ""}${Math.round(driver.deltaPct)}%)`
        : "";
    return `• ${driver.label}${delta}`;
  };

  const positives =
    input.positiveDrivers.length > 0
      ? input.positiveDrivers.map(formatDriver).join("\n")
      : "• Limited positive drivers detected in current feature set.";

  const negatives =
    input.negativeDrivers.length > 0
      ? input.negativeDrivers.map(formatDriver).join("\n")
      : "• No major headwinds detected.";

  return [
    `${input.sportName} Sport Market Index (${input.seasonPhase} phase)`,
    "",
    `Current Health: ${input.healthScore}/100`,
    `Momentum: ${input.momentumScore}/100`,
    `Forward Outlook: ${input.outlookScore}/100`,
    "",
    `3-month forecast: ${input.forecast3mPct > 0 ? "+" : ""}${input.forecast3mPct}%`,
    `6-month forecast: ${input.forecast6mPct > 0 ? "+" : ""}${input.forecast6mPct}%`,
    `12-month forecast: ${input.forecast12mPct > 0 ? "+" : ""}${input.forecast12mPct}%`,
    `Confidence: ${input.confidenceScore}% · Risk: ${input.riskRating}`,
    "",
    "Top drivers:",
    positives,
    "",
    "Headwinds:",
    negatives,
  ].join("\n");
}

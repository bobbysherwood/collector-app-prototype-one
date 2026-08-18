import { clampScore } from "@/lib/market-sentiment/fetch-utils";
import {
  getFeatureDelta,
  getFeatureValue,
  normalizeDeltaToScore,
} from "@/lib/market-index/features/normalize";
import type {
  SportFeatureVector,
  SportIndexWeightMap,
  SportMarketIndexConfig,
  SportSeasonPhase,
} from "@/types/market-index";

export interface ScoreComputation {
  score: number;
  contributions: Array<{
    featureKey: string;
    weight: number;
    value: number;
    impactPoints: number;
  }>;
}

function weightedScore(
  vector: SportFeatureVector,
  weights: SportIndexWeightMap,
  mode: "level" | "momentum"
): ScoreComputation {
  const contributions: ScoreComputation["contributions"] = [];
  let weightedSum = 0;
  let weightSum = 0;

  for (const [featureKey, weight] of Object.entries(weights)) {
    if (!Number.isFinite(weight) || weight === 0) continue;

    const rawValue =
      mode === "momentum"
        ? normalizeDeltaToScore(getFeatureDelta(vector, featureKey))
        : getFeatureValue(vector, featureKey);

    const effectiveValue = weight < 0 ? 100 - rawValue : rawValue;
    const effectiveWeight = Math.abs(weight);
    const impactPoints = effectiveWeight * effectiveValue;

    weightedSum += impactPoints;
    weightSum += effectiveWeight;

    contributions.push({
      featureKey,
      weight,
      value: rawValue,
      impactPoints: (weight / Math.max(weightSum || 1, effectiveWeight)) * 0,
    });
  }

  const score = weightSum > 0 ? weightedSum / weightSum : 50;

  const finalizedContributions = contributions.map((entry) => {
    const effectiveWeight = Math.abs(entry.weight);
    const effectiveValue = entry.weight < 0 ? 100 - entry.value : entry.value;
    return {
      ...entry,
      impactPoints:
        weightSum > 0 ? (effectiveWeight * effectiveValue) / weightSum : 0,
    };
  });

  return {
    score: clampScore(score),
    contributions: finalizedContributions,
  };
}

function computeLeadingBundle(
  vector: SportFeatureVector,
  featureKeys: string[]
): number {
  if (featureKeys.length === 0) return 50;
  const sum = featureKeys.reduce(
    (acc, key) => acc + getFeatureValue(vector, key),
    0
  );
  return clampScore(sum / featureKeys.length);
}

function applySeasonModifier(
  score: number,
  config: SportMarketIndexConfig,
  seasonPhase: SportSeasonPhase,
  scoreType: "health" | "momentum"
): number {
  const modifiers = config.seasonModifiers[seasonPhase];
  if (!modifiers) return score;

  let adjusted = score;
  if (scoreType === "health" && modifiers.health != null) {
    adjusted += modifiers.health * 100;
  }
  if (scoreType === "momentum" && modifiers.momentum != null) {
    adjusted += modifiers.momentum * 100;
  }

  return clampScore(adjusted);
}

export function computeIndexScores(input: {
  config: SportMarketIndexConfig;
  vector: SportFeatureVector;
  seasonPhase: SportSeasonPhase;
}): {
  health: ScoreComputation;
  momentum: ScoreComputation;
  outlook: ScoreComputation;
  leadingBundle: number;
} {
  const healthRaw = weightedScore(
    input.vector,
    input.config.indexWeights.health,
    "level"
  );
  const momentumRaw = weightedScore(
    input.vector,
    input.config.indexWeights.momentum,
    "momentum"
  );

  const healthScore = applySeasonModifier(
    healthRaw.score,
    input.config,
    input.seasonPhase,
    "health"
  );
  const momentumScore = applySeasonModifier(
    momentumRaw.score,
    input.config,
    input.seasonPhase,
    "momentum"
  );

  const leadingBundle = computeLeadingBundle(
    input.vector,
    input.config.forecastConfig.leadingIndicatorFeatures ?? []
  );

  const blend = input.config.indexWeights.outlook_blend;
  const outlookScore = clampScore(
    healthScore * blend.health +
      momentumScore * blend.momentum +
      leadingBundle * blend.leading_bundle
  );

  return {
    health: { ...healthRaw, score: healthScore },
    momentum: { ...momentumRaw, score: momentumScore },
    outlook: {
      score: outlookScore,
      contributions: [
        ...healthRaw.contributions,
        ...momentumRaw.contributions,
      ],
    },
    leadingBundle,
  };
}

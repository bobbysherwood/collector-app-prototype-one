import { clampScore } from "@/lib/market-sentiment/fetch-utils";
import type {
  RawFeatureObservation,
  SportFeatureVector,
  SportMarketFeatureRecord,
} from "@/types/market-index";

const NEUTRAL_FEATURE_VALUE = 50;

export function buildFeatureVector(input: {
  observations: RawFeatureObservation[];
  priorFeatures?: SportMarketFeatureRecord[];
  observedAt: string;
  providerSuccessCount: number;
  providerTotalCount: number;
}): SportFeatureVector {
  const values: Record<string, number> = {};
  const deltas30dPct: Record<string, number> = {};
  let dataPointCount = 0;

  for (const observation of input.observations) {
    values[observation.featureKey] = clampScore(observation.value);
    if (observation.delta30dPct != null) {
      deltas30dPct[observation.featureKey] = observation.delta30dPct;
    }
    dataPointCount += 1;
  }

  for (const prior of input.priorFeatures ?? []) {
    if (values[prior.featureKey] != null) continue;
    values[prior.featureKey] = clampScore(prior.value);
    if (prior.delta30dPct != null) {
      deltas30dPct[prior.featureKey] = prior.delta30dPct;
    }
  }

  return {
    values,
    deltas30dPct,
    observedAt: input.observedAt,
    providerCoverage:
      input.providerTotalCount > 0
        ? input.providerSuccessCount / input.providerTotalCount
        : 0,
    dataPointCount,
  };
}

export function getFeatureValue(
  vector: SportFeatureVector,
  featureKey: string
): number {
  return vector.values[featureKey] ?? NEUTRAL_FEATURE_VALUE;
}

export function getFeatureDelta(
  vector: SportFeatureVector,
  featureKey: string
): number {
  return vector.deltas30dPct[featureKey] ?? 0;
}

export function normalizeDeltaToScore(deltaPct: number): number {
  const clamped = Math.max(-50, Math.min(50, deltaPct));
  return clampScore(50 + clamped);
}

export function computeDeltaFromPrior(
  current: number,
  priorValue: number | undefined
): number | null {
  if (priorValue == null || priorValue === 0) return null;
  return ((current - priorValue) / Math.abs(priorValue)) * 100;
}

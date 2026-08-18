import { resolveSeasonPhase } from "@/lib/market-index/config/season";
import {
  buildIndexDrivers,
  buildIndexExplanation,
} from "@/lib/market-index/engine/explainability";
import { computeForecast } from "@/lib/market-index/engine/forecast-engine";
import { computeIndexScores } from "@/lib/market-index/engine/index-engine";
import { validateSportMarketIndexConfig } from "@/lib/market-index/engine/validate-config";
import {
  buildFeatureVector,
  computeDeltaFromPrior,
} from "@/lib/market-index/features/normalize";
import { getSportMarketIndexProvider } from "@/lib/market-index/providers/registry";
import {
  computeProviderConfidence,
} from "@/lib/market-index/providers/sentiment-composite-provider";
import type { ProviderFetchResult } from "@/lib/market-index/providers/types";
import type {
  RawFeatureObservation,
  SportMarketFeatureRecord,
  SportMarketIndexConfig,
  SportMarketIndexResult,
} from "@/types/market-index";
import { SPORT_MARKET_INDEX_MODEL_VERSION } from "@/types/market-index";

function countSupplyHeadwinds(observations: RawFeatureObservation[]): number {
  return observations.filter(
    (observation) =>
      observation.featureCategory === "supply" && observation.value > 60
  ).length;
}

function enrichObservationsWithDeltas(
  observations: RawFeatureObservation[],
  priorFeatures: SportMarketFeatureRecord[]
): RawFeatureObservation[] {
  const priorByKey = new Map(
    priorFeatures.map((feature) => [feature.featureKey, feature.value])
  );

  return observations.map((observation) => ({
    ...observation,
    delta30dPct:
      observation.delta30dPct ??
      computeDeltaFromPrior(
        observation.value,
        priorByKey.get(observation.featureKey)
      ),
  }));
}

export async function computeSportMarketIndex(input: {
  config: SportMarketIndexConfig;
  priorFeatures?: SportMarketFeatureRecord[];
  asOf?: Date;
}): Promise<{ error?: string; result?: SportMarketIndexResult; observations?: RawFeatureObservation[] }> {
  const validation = validateSportMarketIndexConfig(input.config);
  if (!validation.valid) {
    return { error: validation.errors.join(" ") };
  }

  const asOf = input.asOf ?? new Date();
  const seasonPhase = resolveSeasonPhase(input.config, asOf);
  const observedAt = asOf.toISOString().slice(0, 10);
  const enabledProviders = input.config.providerConfig?.enabledProviders ?? [];

  const providerResults: ProviderFetchResult[] = [];
  const allObservations: RawFeatureObservation[] = [];

  for (const slug of enabledProviders) {
    const provider = getSportMarketIndexProvider(slug);
    if (!provider) {
      providerResults.push({
        success: false,
        observations: [],
        dataPointCount: 0,
        error: `Unknown provider "${slug}".`,
        fetchedAt: new Date().toISOString(),
      });
      continue;
    }

    const result = await provider.fetch({
      sportId: input.config.id,
      config: input.config,
      asOf,
      seasonPhase,
    });

    providerResults.push(result);
    allObservations.push(...result.observations);
  }

  const observations = enrichObservationsWithDeltas(
    allObservations,
    input.priorFeatures ?? []
  );

  const vector = buildFeatureVector({
    observations,
    priorFeatures: input.priorFeatures,
    observedAt,
    providerSuccessCount: providerResults.filter((result) => result.success).length,
    providerTotalCount: providerResults.length,
  });

  const scores = computeIndexScores({
    config: input.config,
    vector,
    seasonPhase,
  });

  const providerConfidence = computeProviderConfidence(providerResults);
  const supplyHeadwinds = countSupplyHeadwinds(observations);

  const forecast = computeForecast({
    config: input.config,
    healthScore: scores.health.score,
    momentumScore: scores.momentum.score,
    outlookScore: scores.outlook.score,
    providerConfidence,
    vectorCoverage: vector.providerCoverage,
    supplyHeadwinds,
  });

  const { positiveDrivers, negativeDrivers } = buildIndexDrivers({
    health: scores.health,
    momentum: scores.momentum,
    vector,
  });

  const explanation = buildIndexExplanation({
    sportName: input.config.name,
    healthScore: scores.health.score,
    momentumScore: scores.momentum.score,
    outlookScore: scores.outlook.score,
    forecast3mPct: forecast.forecast3mPct,
    forecast6mPct: forecast.forecast6mPct,
    forecast12mPct: forecast.forecast12mPct,
    confidenceScore: forecast.confidenceScore,
    riskRating: forecast.riskRating,
    positiveDrivers,
    negativeDrivers,
    seasonPhase,
  });

  const result: SportMarketIndexResult = {
    sportId: input.config.id,
    sportName: input.config.name,
    healthScore: scores.health.score,
    momentumScore: scores.momentum.score,
    outlookScore: scores.outlook.score,
    forecast3mPct: forecast.forecast3mPct,
    forecast6mPct: forecast.forecast6mPct,
    forecast12mPct: forecast.forecast12mPct,
    confidenceScore: forecast.confidenceScore,
    riskRating: forecast.riskRating,
    positiveDrivers,
    negativeDrivers,
    explanation,
    modelVersion: SPORT_MARKET_INDEX_MODEL_VERSION,
    seasonPhase,
    asOf: asOf.toISOString(),
    featureSnapshot: vector,
  };

  return { result, observations };
}

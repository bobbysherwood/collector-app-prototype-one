import { getActiveMarketSentimentSources } from "@/lib/market-sentiment-data";
import {
  computeConfidenceScore,
  runMarketSentimentAnalysis,
  validateActiveSourceWeights,
} from "@/lib/market-sentiment/engine";
import { primarySentimentSearchTerm } from "@/lib/market-index/config/season";
import type { IDataProvider } from "@/lib/market-index/providers/types";
import {
  emptyValidation,
  validProviderResult,
} from "@/lib/market-index/providers/types";
import type { RawFeatureObservation } from "@/types/market-index";
import type { MarketSentimentSourceScore } from "@/types/market-sentiment";

const SLUG_TO_FEATURE: Record<string, string> = {
  news: "sentiment.news.score",
  reddit: "sentiment.reddit.score",
  youtube: "sentiment.youtube.score",
  social: "sentiment.social.score",
  search_interest: "demand.google.trends_index",
};

function mapSourceScore(source: MarketSentimentSourceScore): RawFeatureObservation | null {
  const featureKey = SLUG_TO_FEATURE[source.slug];
  if (!featureKey) return null;

  const category = featureKey.startsWith("demand.")
    ? "demand"
    : "sentiment";

  return {
    featureKey,
    featureCategory: category,
    value: source.score,
    delta30dPct: null,
    providerSlug: "market-sentiment-composite",
    metadata: {
      sourceSlug: source.slug,
      sourceName: source.name,
      weightPercent: source.weightPercent,
      dataPointCount: source.dataPointCount,
      error: source.error,
    },
  };
}

export const sentimentCompositeProvider: IDataProvider = {
  slug: "market-sentiment-composite",

  validate() {
    return emptyValidation();
  },

  normalize() {
    return [];
  },

  async fetch(ctx) {
    const sources = await getActiveMarketSentimentSources();
    if (sources.length === 0) {
      return validProviderResult({
        success: false,
        observations: [],
        dataPointCount: 0,
        error: "No active sentiment sources configured.",
      });
    }

    const weightValidation = validateActiveSourceWeights(sources);
    if (!weightValidation.valid) {
      return validProviderResult({
        success: false,
        observations: [],
        dataPointCount: 0,
        error: weightValidation.message,
      });
    }

    const searchTerm = primarySentimentSearchTerm(ctx.config);

    try {
      const result = await runMarketSentimentAnalysis(
        {
          playerName: searchTerm,
          sport: ctx.config.name,
          cardLabel: `${ctx.config.name} market`,
        },
        sources
      );

      const observations: RawFeatureObservation[] = [
        {
          featureKey: "sentiment.composite.score",
          featureCategory: "sentiment",
          value: result.demandSentimentScore,
          delta30dPct: null,
          providerSlug: this.slug,
          metadata: { trend: result.trend },
        },
        {
          featureKey: "sentiment.composite.confidence",
          featureCategory: "sentiment",
          value: result.confidenceScore,
          delta30dPct: null,
          providerSlug: this.slug,
        },
        ...result.sourceScores
          .map(mapSourceScore)
          .filter((item): item is RawFeatureObservation => item != null),
      ];

      const dataPointCount = result.sourceScores.reduce(
        (sum, source) => sum + source.dataPointCount,
        0
      );

      return validProviderResult({
        success: true,
        observations,
        dataPointCount,
      });
    } catch (error) {
      return validProviderResult({
        success: false,
        observations: [],
        dataPointCount: 0,
        error:
          error instanceof Error
            ? error.message
            : "Sentiment composite provider failed.",
      });
    }
  },
};

export function computeProviderConfidence(
  results: Array<{ success: boolean; dataPointCount: number; error?: string }>
): number {
  return computeConfidenceScore(
    results.map((result) => ({
      success: result.success,
      dataPointCount: result.dataPointCount,
      score: result.success ? 70 : 20,
      error: result.error,
    }))
  );
}

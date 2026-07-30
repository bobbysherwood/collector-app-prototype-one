import type {
  MarketSentimentAnalysisInput,
  MarketSentimentAnalysisResult,
  MarketSentimentSource,
  MarketSentimentTrend,
} from "@/types/market-sentiment";
import { MARKET_SENTIMENT_TREND_LABELS } from "@/types/market-sentiment";
import { calculateSourceScore } from "@/lib/market-sentiment/calculators/registry";
import { clampScore } from "@/lib/market-sentiment/fetch-utils";
import type {
  NewsScrapeData,
  RedditScrapeData,
  ScraperResult,
  SearchInterestScrapeData,
  SocialScrapeData,
  SourceScrapePayload,
  YouTubeScrapeData,
} from "@/lib/market-sentiment/internal-types";
import { buildExplainability } from "@/lib/market-sentiment/explainability";
import { getSentimentScraper } from "@/lib/market-sentiment/scrapers/registry";
import { buildSearchTerms } from "@/lib/market-sentiment/sentiment-text";

export function classifySentimentTrend(score: number): MarketSentimentTrend {
  if (score >= 90) return "strongly_increasing";
  if (score >= 70) return "increasing";
  if (score >= 40) return "neutral";
  if (score >= 20) return "declining";
  return "strongly_declining";
}

export function computeConfidenceScore(
  sourceResults: Array<{
    success: boolean;
    dataPointCount: number;
    score: number;
    error?: string;
  }>
): number {
  if (sourceResults.length === 0) return 20;

  const successful = sourceResults.filter((result) => result.success);
  const totalPoints = sourceResults.reduce(
    (sum, result) => sum + result.dataPointCount,
    0
  );
  const coverageRatio = successful.length / sourceResults.length;
  const dataRichness = Math.min(1, totalPoints / 20);

  const scores = successful.map((result) => result.score);
  const avg = scores.reduce((sum, value) => sum + value, 0) / Math.max(scores.length, 1);
  const variance =
    scores.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    Math.max(scores.length, 1);
  const agreementBoost = Math.max(0, 25 - variance / 4);

  const confidence = 30 + coverageRatio * 35 + dataRichness * 25 + agreementBoost;
  return clampScore(confidence);
}

export async function runMarketSentimentAnalysis(
  input: MarketSentimentAnalysisInput,
  sources: MarketSentimentSource[]
): Promise<MarketSentimentAnalysisResult> {
  const activeSources = sources.filter((source) => source.active);
  const searchTerms = buildSearchTerms(input);
  const scrapeResults: ScraperResult<SourceScrapePayload>[] = [];

  for (const source of activeSources) {
    const scraper = getSentimentScraper(source.slug);
    if (!scraper) {
      scrapeResults.push({
        ...emptyScrapeResult(source.slug),
        error: `No scraper registered for "${source.slug}".`,
      });
      continue;
    }

    scrapeResults.push(
      await scraper({
        input,
        source,
        searchTerms,
      })
    );
  }

  const sourceScores = activeSources.map((source) => {
    const scrape = scrapeResults.find((result) => result.slug === source.slug);
    const calculated = calculateSourceScore(
      source.slug,
      scrape ?? emptyScrapeResult(source.slug)
    );

    return {
      slug: source.slug,
      name: source.name,
      score: calculated.score,
      weightPercent: source.weightPercent,
      weightedContribution: (calculated.score * source.weightPercent) / 100,
      dataPointCount: calculated.dataPointCount,
      error: scrape?.error,
      positiveDrivers: calculated.positiveDrivers,
      negativeDrivers: calculated.negativeDrivers,
    };
  });

  const demandSentimentScore = clampScore(
    sourceScores.reduce((sum, item) => sum + item.weightedContribution, 0)
  );
  const trend = classifySentimentTrend(demandSentimentScore);
  const confidenceScore = computeConfidenceScore(
    sourceScores.map((item) => ({
      success: !item.error,
      dataPointCount: item.dataPointCount,
      score: item.score,
      error: item.error,
    }))
  );

  const positiveDrivers = sourceScores.flatMap(
    (item) => item.positiveDrivers ?? []
  );
  const negativeDrivers = sourceScores.flatMap(
    (item) => item.negativeDrivers ?? []
  );

  const { summary, explanation } = buildExplainability({
    input,
    demandSentimentScore,
    trend,
    confidenceScore,
    positiveDrivers,
    negativeDrivers,
    sourceScores,
  });

  return {
    demandSentimentScore,
    trend,
    trendLabel: MARKET_SENTIMENT_TREND_LABELS[trend],
    confidenceScore,
    positiveDrivers: positiveDrivers.slice(0, 5),
    negativeDrivers: negativeDrivers.slice(0, 5),
    summary,
    explanation,
    sourceScores: sourceScores.map(
      ({ positiveDrivers: _p, negativeDrivers: _n, ...rest }) => rest
    ),
    asOf: new Date().toISOString(),
  };
}

export function validateActiveSourceWeights(sources: MarketSentimentSource[]): {
  valid: boolean;
  total: number;
  message?: string;
} {
  const total = sources
    .filter((source) => source.active)
    .reduce((sum, source) => sum + source.weightPercent, 0);

  if (total !== 100) {
    return {
      valid: false,
      total,
      message: `Active source weights must sum to 100 (currently ${total}).`,
    };
  }

  return { valid: true, total };
}

function emptyScrapeResult(slug: string): ScraperResult<SourceScrapePayload> {
  const collectedAt = new Date().toISOString();
  switch (slug) {
    case "news":
      return {
        slug,
        success: false,
        data: { articles: [] } satisfies NewsScrapeData,
        dataPointCount: 0,
        collectedAt,
      };
    case "reddit":
      return {
        slug,
        success: false,
        data: {
          posts: [],
          totalDiscussions: 0,
          totalComments: 0,
          totalUpvotes: 0,
          commonTopics: [],
        } satisfies RedditScrapeData,
        dataPointCount: 0,
        collectedAt,
      };
    case "youtube":
      return {
        slug,
        success: false,
        data: { videos: [], totalVideos: 0, totalViews: 0 } satisfies YouTubeScrapeData,
        dataPointCount: 0,
        collectedAt,
      };
    case "social":
      return {
        slug,
        success: false,
        data: {
          posts: [],
          mentionCount: 0,
          totalEngagement: 0,
          trendingHashtags: [],
        } satisfies SocialScrapeData,
        dataPointCount: 0,
        collectedAt,
      };
    case "search_interest":
      return {
        slug,
        success: false,
        data: {
          trendScore: 50,
          direction: "flat",
          growthPercent: null,
          relatedQueries: [],
        } satisfies SearchInterestScrapeData,
        dataPointCount: 0,
        collectedAt,
      };
    default:
      return {
        slug,
        success: false,
        data: { articles: [] } satisfies NewsScrapeData,
        dataPointCount: 0,
        collectedAt,
      };
  }
}

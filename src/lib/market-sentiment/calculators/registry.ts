import { calculateNewsScore } from "@/lib/market-sentiment/calculators/news-calculator";
import { calculateRedditScore } from "@/lib/market-sentiment/calculators/reddit-calculator";
import { calculateYouTubeScore } from "@/lib/market-sentiment/calculators/youtube-calculator";
import { calculateSocialScore } from "@/lib/market-sentiment/calculators/social-calculator";
import { calculateSearchInterestScore } from "@/lib/market-sentiment/calculators/search-interest-calculator";
import type {
  NewsScrapeData,
  RedditScrapeData,
  ScraperResult,
  SearchInterestScrapeData,
  SocialScrapeData,
  SourceCalculatorResult,
  SourceScrapePayload,
  YouTubeScrapeData,
} from "@/lib/market-sentiment/internal-types";
import type { MarketSentimentSourceSlug } from "@/types/market-sentiment";

type SourceCalculator = (result: ScraperResult<SourceScrapePayload>) => SourceCalculatorResult;

const CALCULATORS: Record<MarketSentimentSourceSlug, SourceCalculator> = {
  news: (result) => calculateNewsScore(result as ScraperResult<NewsScrapeData>),
  reddit: (result) => calculateRedditScore(result as ScraperResult<RedditScrapeData>),
  youtube: (result) => calculateYouTubeScore(result as ScraperResult<YouTubeScrapeData>),
  social: (result) => calculateSocialScore(result as ScraperResult<SocialScrapeData>),
  search_interest: (result) =>
    calculateSearchInterestScore(result as ScraperResult<SearchInterestScrapeData>),
};

export function calculateSourceScore(
  slug: string,
  result: ScraperResult<SourceScrapePayload>
): SourceCalculatorResult {
  const calculator = CALCULATORS[slug as MarketSentimentSourceSlug];
  if (!calculator) {
    return {
      score: 50,
      positiveDrivers: [],
      negativeDrivers: [`No calculator registered for source "${slug}".`],
      dataPointCount: 0,
    };
  }
  return calculator(result);
}

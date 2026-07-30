import { scrapeNewsSource } from "@/lib/market-sentiment/scrapers/news-scraper";
import { scrapeRedditSource } from "@/lib/market-sentiment/scrapers/reddit-scraper";
import { scrapeYouTubeSource } from "@/lib/market-sentiment/scrapers/youtube-scraper";
import { scrapeSocialSource } from "@/lib/market-sentiment/scrapers/social-scraper";
import { scrapeSearchInterestSource } from "@/lib/market-sentiment/scrapers/google-trends-scraper";
import type {
  ScraperResult,
  SentimentScrapeContext,
  SourceScrapePayload,
} from "@/lib/market-sentiment/internal-types";
import type { MarketSentimentSourceSlug } from "@/types/market-sentiment";

export type SourceScraper = (
  context: SentimentScrapeContext
) => Promise<ScraperResult<SourceScrapePayload>>;

const SCRAPERS: Record<MarketSentimentSourceSlug, SourceScraper> = {
  news: scrapeNewsSource,
  reddit: scrapeRedditSource,
  youtube: scrapeYouTubeSource,
  social: scrapeSocialSource,
  search_interest: scrapeSearchInterestSource,
};

export function getSentimentScraper(slug: string): SourceScraper | null {
  return SCRAPERS[slug as MarketSentimentSourceSlug] ?? null;
}

export function listRegisteredSentimentScrapers(): MarketSentimentSourceSlug[] {
  return Object.keys(SCRAPERS) as MarketSentimentSourceSlug[];
}

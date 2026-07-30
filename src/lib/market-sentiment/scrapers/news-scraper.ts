import { fetchPublicText } from "@/lib/market-sentiment/fetch-utils";
import type {
  NewsScrapeData,
  ScraperResult,
  SentimentScrapeContext,
} from "@/lib/market-sentiment/internal-types";
import {
  analyzeTextSentiment,
  extractRssItems,
  playerMentioned,
} from "@/lib/market-sentiment/sentiment-text";

interface NewsFeedConfig {
  name: string;
  url: string;
  quality?: number;
}

export async function scrapeNewsSource(
  context: SentimentScrapeContext
): Promise<ScraperResult<NewsScrapeData>> {
  const collectedAt = new Date().toISOString();
  const feeds = (context.source.config.feeds as NewsFeedConfig[] | undefined) ?? [];
  const articles: NewsScrapeData["articles"] = [];

  for (const feed of feeds) {
    try {
      const xml = await fetchPublicText(feed.url, { timeoutMs: 10_000 });
      const items = extractRssItems(xml).slice(0, 25);

      for (const item of items) {
        const mentioned = context.searchTerms.some((term) =>
          playerMentioned(item.title, term)
        );
        if (!mentioned) continue;

        const sentiment = analyzeTextSentiment(item.title);
        articles.push({
          publishDate: item.pubDate,
          headline: item.title,
          source: feed.name,
          playerMentioned: true,
          sentiment,
          importanceScore: feed.quality ?? 0.7,
        });
      }
    } catch {
      // Skip unavailable feeds in V1 prototype
    }
  }

  return {
    slug: context.source.slug,
    success: articles.length > 0,
    data: { articles },
    dataPointCount: articles.length,
    error: articles.length === 0 ? "No matching news articles found." : undefined,
    collectedAt,
  };
}

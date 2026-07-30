import type { MarketSentimentSource } from "@/types/market-sentiment";

const FALLBACK_TIMESTAMP = "1970-01-01T00:00:00.000Z";

/** Default V1 sources — used when migration 038 has not been applied yet. */
export const DEFAULT_MARKET_SENTIMENT_SOURCES: MarketSentimentSource[] = [
  {
    id: "default-news",
    slug: "news",
    name: "Sports News",
    description:
      "Recent articles from major sports news RSS feeds (ESPN, CBS Sports, Yahoo Sports, Bleacher Report, NBA.com).",
    weightPercent: 30,
    active: true,
    sortOrder: 1,
    config: {
      feeds: [
        { name: "ESPN", url: "https://www.espn.com/espn/rss/news", quality: 0.9 },
        {
          name: "CBS Sports",
          url: "https://www.cbssports.com/rss/headlines/",
          quality: 0.85,
        },
        { name: "Yahoo Sports", url: "https://sports.yahoo.com/rss/", quality: 0.8 },
        {
          name: "Bleacher Report",
          url: "https://bleacherreport.com/articles/feed",
          quality: 0.75,
        },
        { name: "NBA.com", url: "https://www.nba.com/news/rss", quality: 0.85 },
      ],
    },
    createdAt: FALLBACK_TIMESTAMP,
    updatedAt: FALLBACK_TIMESTAMP,
  },
  {
    id: "default-reddit",
    slug: "reddit",
    name: "Reddit",
    description:
      "Public Reddit discussions from basketball cards, sports cards, NBA, and team subreddits.",
    weightPercent: 20,
    active: true,
    sortOrder: 2,
    config: {
      subreddits: ["basketballcards", "sportscards", "nba", "bostonceltics", "lakers"],
    },
    createdAt: FALLBACK_TIMESTAMP,
    updatedAt: FALLBACK_TIMESTAMP,
  },
  {
    id: "default-youtube",
    slug: "youtube",
    name: "YouTube",
    description:
      "Recent public YouTube videos mentioning the player or card via search.",
    weightPercent: 20,
    active: true,
    sortOrder: 3,
    config: { maxResults: 15 },
    createdAt: FALLBACK_TIMESTAMP,
    updatedAt: FALLBACK_TIMESTAMP,
  },
  {
    id: "default-social",
    slug: "social",
    name: "X (Twitter)",
    description:
      "Public social mentions via accessible web search snippets (no authenticated API).",
    weightPercent: 15,
    active: true,
    sortOrder: 4,
    config: { querySuffix: "sports cards" },
    createdAt: FALLBACK_TIMESTAMP,
    updatedAt: FALLBACK_TIMESTAMP,
  },
  {
    id: "default-search-interest",
    slug: "search_interest",
    name: "Google Trends",
    description: "Public search interest signals where available.",
    weightPercent: 15,
    active: true,
    sortOrder: 5,
    config: { geo: "US" },
    createdAt: FALLBACK_TIMESTAMP,
    updatedAt: FALLBACK_TIMESTAMP,
  },
];

export function isMissingSentimentSourcesTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("market_sentiment_sources") ?? false)
  );
}

export function getDefaultMarketSentimentSources(options?: {
  activeOnly?: boolean;
}): MarketSentimentSource[] {
  const sources = DEFAULT_MARKET_SENTIMENT_SOURCES;
  if (options?.activeOnly) {
    return sources.filter((source) => source.active);
  }
  return sources;
}

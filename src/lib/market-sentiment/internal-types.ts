import type { MarketSentimentSource } from "@/types/market-sentiment";
import type { MarketSentimentAnalysisInput } from "@/types/market-sentiment";

export type TextSentiment = "positive" | "neutral" | "negative";

export interface SentimentScrapeContext {
  input: MarketSentimentAnalysisInput;
  source: MarketSentimentSource;
  searchTerms: string[];
}

export interface ScraperResult<T> {
  slug: string;
  success: boolean;
  data: T;
  dataPointCount: number;
  error?: string;
  collectedAt: string;
}

export interface NewsArticleSignal {
  publishDate: string | null;
  headline: string;
  source: string;
  playerMentioned: boolean;
  sentiment: TextSentiment;
  importanceScore: number;
}

export interface NewsScrapeData {
  articles: NewsArticleSignal[];
}

export interface RedditPostSignal {
  title: string;
  subreddit: string;
  score: number;
  numComments: number;
  sentiment: TextSentiment;
  createdUtc: number;
}

export interface RedditScrapeData {
  posts: RedditPostSignal[];
  totalDiscussions: number;
  totalComments: number;
  totalUpvotes: number;
  commonTopics: string[];
}

export interface YouTubeVideoSignal {
  title: string;
  publishedAt: string | null;
  viewCount: number | null;
  sentiment: TextSentiment;
}

export interface YouTubeScrapeData {
  videos: YouTubeVideoSignal[];
  totalVideos: number;
  totalViews: number;
}

export interface SocialPostSignal {
  text: string;
  engagementEstimate: number;
  sentiment: TextSentiment;
}

export interface SocialScrapeData {
  posts: SocialPostSignal[];
  mentionCount: number;
  totalEngagement: number;
  trendingHashtags: string[];
}

export interface SearchInterestScrapeData {
  trendScore: number;
  direction: "up" | "down" | "flat";
  growthPercent: number | null;
  relatedQueries: string[];
}

export type SourceScrapePayload =
  | NewsScrapeData
  | RedditScrapeData
  | YouTubeScrapeData
  | SocialScrapeData
  | SearchInterestScrapeData;

export interface SourceCalculatorResult {
  score: number;
  positiveDrivers: string[];
  negativeDrivers: string[];
  dataPointCount: number;
}

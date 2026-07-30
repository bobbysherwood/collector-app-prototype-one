export type MarketSentimentTrend =
  | "strongly_increasing"
  | "increasing"
  | "neutral"
  | "declining"
  | "strongly_declining";

export const MARKET_SENTIMENT_TREND_LABELS: Record<MarketSentimentTrend, string> = {
  strongly_increasing: "Strongly Increasing",
  increasing: "Increasing",
  neutral: "Neutral",
  declining: "Declining",
  strongly_declining: "Strongly Declining",
};

export interface MarketSentimentSource {
  id: string;
  slug: string;
  name: string;
  description: string;
  weightPercent: number;
  active: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MarketSentimentSourceScore {
  slug: string;
  name: string;
  score: number;
  weightPercent: number;
  weightedContribution: number;
  dataPointCount: number;
  error?: string;
}

export interface MarketSentimentAnalysisResult {
  demandSentimentScore: number;
  trend: MarketSentimentTrend;
  trendLabel: string;
  confidenceScore: number;
  positiveDrivers: string[];
  negativeDrivers: string[];
  summary: string;
  explanation: string;
  sourceScores: MarketSentimentSourceScore[];
  asOf: string;
}

export interface MarketSentimentAnalysisInput {
  playerName: string;
  cardLabel?: string;
  sport?: string;
  year?: number;
  brandName?: string;
  cardSetName?: string;
  parallelName?: string | null;
}

export const MARKET_SENTIMENT_SOURCE_SLUGS = [
  "news",
  "reddit",
  "youtube",
  "social",
  "search_interest",
] as const;

export type MarketSentimentSourceSlug =
  (typeof MARKET_SENTIMENT_SOURCE_SLUGS)[number];

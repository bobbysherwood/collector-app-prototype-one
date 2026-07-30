export type MarketOutlook = "bullish" | "bearish" | "neutral";
export type MarketTrendDirection = "up" | "down" | "flat";

export interface MarketIndexSnapshot {
  label: string;
  category: "sport" | "player" | "card";
  value: number;
  change30d: number;
}

export interface RecentSalesTrend {
  direction: MarketTrendDirection;
  change30d: number;
  change90d: number;
  volume30d: number;
  volume90d: number;
  avgPrice30d: number | null;
  avgPrice90d: number | null;
  summary: string;
}

export interface MarketPredictionInsight {
  outlook: MarketOutlook;
  confidence: "high" | "medium" | "low";
  currentEstimate: number | null;
  predictedValue30d: number | null;
  predictedValue90d: number | null;
  predictedChange30d: number;
  predictedChange90d: number;
  recentTrend: RecentSalesTrend;
  indexes: MarketIndexSnapshot[];
  commentary: string[];
  catalysts: string[];
  risks: string[];
  asOf: string;
}

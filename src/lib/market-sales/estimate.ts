import type { MarketSale } from "@/types/market-sales";

export type MarketEstimateConfidence = "high" | "medium" | "low" | "none";

export interface MarketEstimatedValue {
  value: number | null;
  confidence: MarketEstimateConfidence;
  /** 0–100 score derived from comp volume and recency (placeholder formula). */
  confidence_score: number;
  comp_count: number;
  auction_count: number;
  recent_comp_count: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
  }
  return sorted[mid];
}

function recentCutoff(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function computeConfidenceScore(
  compCount: number,
  auctionCount: number,
  recentCompCount: number
): number {
  if (compCount === 0) return 0;

  const volumeScore = Math.min(compCount / 10, 1) * 45;
  const recencyScore = Math.min(recentCompCount / 5, 1) * 35;
  const auctionShare = auctionCount / compCount;
  const auctionScore = auctionShare * 20;

  return Math.round(volumeScore + recencyScore + auctionScore);
}

function confidenceFromScore(
  score: number,
  compCount: number
): MarketEstimateConfidence {
  if (compCount === 0) return "none";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Placeholder market estimate from recent comps. Replace with production formula
 * when marketplace integrations are live.
 */
export function estimateMarketValue(
  sales: MarketSale[]
): MarketEstimatedValue {
  const cutoff30 = recentCutoff(30);
  const recentComps = sales.filter((sale) => sale.sale_date >= cutoff30);
  const auctionComps = sales.filter((sale) => sale.sale_type === "auction");
  const compCount = sales.length;
  const auctionCount = auctionComps.length;
  const recentCompCount = recentComps.length;

  if (compCount === 0) {
    return {
      value: null,
      confidence: "none",
      confidence_score: 0,
      comp_count: 0,
      auction_count: 0,
      recent_comp_count: 0,
    };
  }

  const confidenceScore = computeConfidenceScore(
    compCount,
    auctionCount,
    recentCompCount
  );
  const confidence = confidenceFromScore(confidenceScore, compCount);

  // Weight recent sales slightly higher in the dummy estimate.
  const weightedPrices: number[] = [];
  for (const sale of sales) {
    const weight = sale.sale_date >= cutoff30 ? 1.5 : 1;
    for (let i = 0; i < weight; i++) {
      weightedPrices.push(sale.sale_price);
    }
  }

  const base = median(weightedPrices) ?? median(sales.map((s) => s.sale_price));

  return {
    value: base,
    confidence,
    confidence_score: confidenceScore,
    comp_count: compCount,
    auction_count: auctionCount,
    recent_comp_count: recentCompCount,
  };
}

export const MARKET_ESTIMATE_CONFIDENCE_LABELS: Record<
  MarketEstimateConfidence,
  string
> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  none: "Insufficient data",
};

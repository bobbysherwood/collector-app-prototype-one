import type { MarketSale } from "@/types/market-sales";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return roundCurrency((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return roundCurrency(sorted[mid]);
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function cutoffDate(days: number, asOf: string): string {
  const date = new Date(asOf);
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

export function filterSalesByWindow(
  sales: MarketSale[],
  days: number,
  asOf: string
): MarketSale[] {
  const cutoff = cutoffDate(days, asOf);
  return sales.filter((sale) => sale.sale_date >= cutoff && sale.sale_date <= asOf.slice(0, 10));
}

export function rejectOutliers(prices: number[]): {
  cleaned: number[];
  rejected: number;
} {
  if (prices.length < 4) {
    return { cleaned: prices, rejected: 0 };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  const cleaned = prices.filter((price) => price >= lower && price <= upper);
  return {
    cleaned: cleaned.length > 0 ? cleaned : prices,
    rejected: prices.length - cleaned.length,
  };
}

export function trimmedMedian(prices: number[]): {
  value: number | null;
  outliersRejected: number;
} {
  if (prices.length === 0) {
    return { value: null, outliersRejected: 0 };
  }
  const { cleaned, rejected } = rejectOutliers(prices);
  return { value: median(cleaned), outliersRejected: rejected };
}

export function percentChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return roundCurrency(((to - from) / from) * 100);
}

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export function confidenceFromScore(
  score: number,
  hasData: boolean
): ConfidenceLevel {
  if (!hasData) return "none";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function valuationConfidenceScore(
  compCount: number,
  recentCompCount: number,
  outliersRejected: number
): number {
  if (compCount === 0) return 0;
  const volume = Math.min(compCount / 8, 1) * 50;
  const recency = Math.min(recentCompCount / 4, 1) * 35;
  const outlierPenalty = Math.min(outliersRejected / compCount, 0.5) * 30;
  return clampScore(volume + recency - outlierPenalty);
}

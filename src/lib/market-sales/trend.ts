import type { MarketTrendDirection } from "@/types/market-predictions";
import type { MarketSale } from "@/types/market-sales";

export interface RecentSalesTrendMetrics {
  direction: MarketTrendDirection;
  change30d: number;
  change90d: number;
  volume30d: number;
  volume90d: number;
  avgPrice30d: number | null;
  avgPrice90d: number | null;
}

function recentCutoff(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function salesSince(sales: MarketSale[], days: number): MarketSale[] {
  const cutoff = recentCutoff(days);
  return sales.filter((sale) => sale.sale_date >= cutoff);
}

function averagePrice(sales: MarketSale[]): number | null {
  if (sales.length === 0) return null;
  const sum = sales.reduce((total, sale) => total + sale.sale_price, 0);
  return Math.round((sum / sales.length) * 100) / 100;
}

function percentChange(from: number | null, to: number | null): number {
  if (from == null || to == null || from === 0) return 0;
  return Math.round(((to - from) / from) * 1000) / 10;
}

function trendDirection(change: number): MarketTrendDirection {
  if (change > 2) return "up";
  if (change < -2) return "down";
  return "flat";
}

export function computeRecentSalesTrend(
  sales: MarketSale[]
): RecentSalesTrendMetrics {
  const sales30d = salesSince(sales, 30);
  const sales90d = salesSince(sales, 90);
  const sales31to90 = sales90d.filter((sale) => sale.sale_date < recentCutoff(30));

  const avg30d = averagePrice(sales30d);
  const avg90d = averagePrice(sales90d);
  const avgPriorWindow = averagePrice(sales31to90);

  const change30d = percentChange(avgPriorWindow ?? avg90d, avg30d);
  const change90d = percentChange(averagePrice(salesSince(sales, 180)), avg90d);

  return {
    direction: trendDirection(change30d),
    change30d,
    change90d,
    volume30d: sales30d.length,
    volume90d: sales90d.length,
    avgPrice30d: avg30d,
    avgPrice90d: avg90d,
  };
}

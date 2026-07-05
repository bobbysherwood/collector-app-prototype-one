import type { MarketSale, MarketSalesSummary } from "@/types/market-sales";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
  }
  return sorted[mid];
}

export function buildMarketSalesSummary(sales: MarketSale[]): MarketSalesSummary {
  if (sales.length === 0) {
    return {
      sale_count: 0,
      median_price: null,
      average_price: null,
      low_price: null,
      high_price: null,
      last_sale_date: null,
    };
  }

  const prices = sales.map((s) => s.sale_price);
  const sum = prices.reduce((total, price) => total + price, 0);
  const sortedDates = sales.map((s) => s.sale_date).sort();

  return {
    sale_count: sales.length,
    median_price: median(prices),
    average_price: Math.round((sum / prices.length) * 100) / 100,
    low_price: Math.min(...prices),
    high_price: Math.max(...prices),
    last_sale_date: sortedDates[sortedDates.length - 1] ?? null,
  };
}

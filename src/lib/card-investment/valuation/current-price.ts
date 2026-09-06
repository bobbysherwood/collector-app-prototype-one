import { filterSalesByWindow, median } from "@/lib/card-investment/types/math";
import type { MarketSale } from "@/types/market-sales";

export function salesAvailableAsOf(sales: MarketSale[], asOf: string): MarketSale[] {
  const cutoff = asOf.slice(0, 10);
  return sales.filter((sale) => sale.sale_date <= cutoff);
}

export function latestSaleAsOf(sales: MarketSale[], asOf: string): MarketSale | undefined {
  const available = salesAvailableAsOf(sales, asOf);
  if (available.length === 0) return undefined;
  return [...available].sort((a, b) => {
    const byDate = b.sale_date.localeCompare(a.sale_date);
    if (byDate !== 0) return byDate;
    return b.id.localeCompare(a.id);
  })[0];
}

/** Latest in-window print, or the 7-day median when several recent prints exist. */
export function currentMarketValueFromSales(
  sales: MarketSale[],
  asOf: string,
  fallback = 0
): number {
  const recent = filterSalesByWindow(salesAvailableAsOf(sales, asOf), 7, asOf);
  if (recent.length >= 2) {
    return median(recent.map((sale) => sale.sale_price)) ?? fallback;
  }
  return latestSaleAsOf(sales, asOf)?.sale_price ?? fallback;
}

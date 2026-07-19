import type {
  MarketListing,
  MarketListingType,
  MarketSale,
  MarketSaleSource,
} from "@/types/market-sales";

export type MarketSalesPeriodFilter = "30d" | "90d" | "ytd" | "1y" | "all";

export type MarketSalesSourceFilter = "all" | MarketSaleSource;

export const MARKET_SALES_PERIOD_OPTIONS: {
  value: MarketSalesPeriodFilter;
  label: string;
}[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "Last year" },
  { value: "all", label: "All time" },
];

export function periodCutoff(
  period: MarketSalesPeriodFilter,
  now = new Date()
): string | null {
  if (period === "all") return null;

  const date = new Date(now);

  switch (period) {
    case "30d":
      date.setDate(date.getDate() - 30);
      break;
    case "90d":
      date.setDate(date.getDate() - 90);
      break;
    case "ytd":
      return `${now.getFullYear()}-01-01`;
    case "1y":
      date.setFullYear(date.getFullYear() - 1);
      break;
  }

  return date.toISOString().split("T")[0];
}

export function filterMarketSales(
  sales: MarketSale[],
  source: MarketSalesSourceFilter,
  period: MarketSalesPeriodFilter,
  now = new Date()
): MarketSale[] {
  const cutoff = periodCutoff(period, now);

  return sales.filter((sale) => {
    if (source !== "all" && sale.source !== source) return false;
    if (cutoff && sale.sale_date < cutoff) return false;
    return true;
  });
}

export function buildMarketSalesChartPoints(
  sales: MarketSale[]
): MarketSalesChartPoint[] {
  return [...sales]
    .sort((a, b) => a.sale_date.localeCompare(b.sale_date))
    .map((sale) => ({
      date: sale.sale_date,
      label: formatChartDateLabel(sale.sale_date),
      price: sale.sale_price,
      source: sale.source,
      saleType: sale.sale_type,
    }));
}

export interface MarketSalesChartPoint {
  date: string;
  label: string;
  price: number;
  source: MarketSaleSource;
  saleType: MarketSale["sale_type"];
  trendPrice?: number | null;
}

export function buildMarketSalesChartPointsWithTrend(
  sales: MarketSale[]
): MarketSalesChartPoint[] {
  const points = buildMarketSalesChartPoints(sales);
  if (points.length < 2) {
    return points.map((point) => ({ ...point, trendPrice: null }));
  }

  const trendValues = computeLinearTrendValues(points);
  return points.map((point, index) => ({
    ...point,
    trendPrice: trendValues[index],
  }));
}

function computeLinearTrendValues(
  points: Pick<MarketSalesChartPoint, "date" | "price">[]
): number[] {
  const xs = points.map((point) => parseChartDate(point.date).getTime());
  const ys = points.map((point) => point.price);
  const count = points.length;
  const sumX = xs.reduce((total, value) => total + value, 0);
  const sumY = ys.reduce((total, value) => total + value, 0);
  const sumXY = xs.reduce((total, value, index) => total + value * ys[index], 0);
  const sumXX = xs.reduce((total, value) => total + value * value, 0);
  const denominator = count * sumXX - sumX * sumX;

  if (denominator === 0) {
    return points.map(() => ys[0] ?? 0);
  }

  const slope = (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;

  return xs.map(
    (value) => Math.round((slope * value + intercept) * 100) / 100
  );
}

function parseChartDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatChartDateLabel(isoDate: string): string {
  return parseChartDate(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export type MarketListingsTypeFilter = "all" | MarketListingType;

export function filterMarketListings(
  listings: MarketListing[],
  source: MarketSalesSourceFilter,
  listingType: MarketListingsTypeFilter
): MarketListing[] {
  return listings
    .filter((listing) => {
      if (source !== "all" && listing.source !== source) return false;
      if (listingType !== "all" && listing.listing_type !== listingType) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.ends_at.localeCompare(b.ends_at));
}

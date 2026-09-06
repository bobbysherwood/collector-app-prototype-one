export type ResearchChartRange = "1M" | "3M" | "6M" | "1Y" | "2Y" | "All";

export const RESEARCH_CHART_RANGES: ResearchChartRange[] = [
  "1M",
  "3M",
  "6M",
  "1Y",
  "2Y",
  "All",
];

export interface ResearchSeriesPoint {
  date: string;
  label: string;
  value: number;
  kind: "history" | "forecast";
}

const RANGE_DAYS: Record<ResearchChartRange, number | null> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "2Y": 730,
  All: null,
};

export function filterSeriesByRange(
  points: ResearchSeriesPoint[],
  range: ResearchChartRange,
  asOf?: Date
): ResearchSeriesPoint[] {
  const days = RANGE_DAYS[range];
  if (days == null) return points;
  const lastHistory = [...points].reverse().find((point) => point.kind === "history");
  const cutoff = new Date(asOf ?? lastHistory?.date ?? Date.now());
  cutoff.setDate(cutoff.getDate() - days);
  return points.filter((point) => new Date(point.date) >= cutoff);
}

function addDays(iso: string, days: number): Date {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date;
}

function formatAxisLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Builds a short series from a current model value plus optional 30d/90d
 * implied moves. This is derived from the latest snapshot, not fabricated ticks.
 */
export function buildImpliedIndexSeries(input: {
  asOf: string;
  current: number;
  prior30d?: number | null;
  forecast90dPct?: number | null;
}): ResearchSeriesPoint[] {
  const points: ResearchSeriesPoint[] = [];
  const asOf = new Date(input.asOf);

  if (input.prior30d != null && Number.isFinite(input.prior30d)) {
    const prior = addDays(input.asOf, -30);
    points.push({
      date: prior.toISOString(),
      label: formatAxisLabel(prior),
      value: roundSeries(input.prior30d),
      kind: "history",
    });
  }

  points.push({
    date: asOf.toISOString(),
    label: formatAxisLabel(asOf),
    value: roundSeries(input.current),
    kind: "history",
  });

  if (input.forecast90dPct != null && Number.isFinite(input.forecast90dPct)) {
    const future = addDays(input.asOf, 90);
    const projected = input.current * (1 + input.forecast90dPct / 100);
    points.push({
      date: future.toISOString(),
      label: formatAxisLabel(future),
      value: roundSeries(Math.min(100, Math.max(0, projected))),
      kind: "forecast",
    });
  }

  return points;
}

export function buildPriceSeriesFromSales(
  sales: Array<{ sale_date: string; sale_price: number }>,
  forecast?: { date: string; value: number }
): ResearchSeriesPoint[] {
  const points: ResearchSeriesPoint[] = [...sales]
    .sort((a, b) => a.sale_date.localeCompare(b.sale_date))
    .map((sale) => ({
      date: sale.sale_date,
      label: formatAxisLabel(new Date(sale.sale_date)),
      value: sale.sale_price,
      kind: "history",
    }));

  if (forecast) {
    points.push({
      date: forecast.date,
      label: formatAxisLabel(new Date(forecast.date)),
      value: forecast.value,
      kind: "forecast",
    });
  }

  return points;
}

function roundSeries(value: number): number {
  return Math.round(value * 10) / 10;
}

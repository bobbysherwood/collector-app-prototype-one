import type { CardValuation, Lot } from "@/types/card";
import {
  filterHeldLots,
  filterHeldPositions,
  type AssetPosition,
  type HeldLotPosition,
} from "@/types/card";

export type TimeRangeKey = "ytd" | "1y" | "3y" | "5y" | "10y" | "max";

export const TIME_RANGES: { key: TimeRangeKey; label: string }[] = [
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1Y" },
  { key: "3y", label: "3Y" },
  { key: "5y", label: "5Y" },
  { key: "10y", label: "10Y" },
  { key: "max", label: "Max" },
];

export interface PortfolioHistoryPoint {
  date: string;
  label: string;
  returns: number;
}

export interface SportAllocationSlice {
  sport: string;
  count: number;
  costBasis: number;
  currentValue: number | null;
  value: number;
  percentage: number;
}

function getRangeStart(
  range: TimeRangeKey,
  heldLots: Lot[],
  now = new Date()
): Date {
  const end = new Date(now);
  switch (range) {
    case "ytd":
      return new Date(end.getFullYear(), 0, 1);
    case "1y": {
      const d = new Date(end);
      d.setFullYear(d.getFullYear() - 1);
      return d;
    }
    case "3y": {
      const d = new Date(end);
      d.setFullYear(d.getFullYear() - 3);
      return d;
    }
    case "5y": {
      const d = new Date(end);
      d.setFullYear(d.getFullYear() - 5);
      return d;
    }
    case "10y": {
      const d = new Date(end);
      d.setFullYear(d.getFullYear() - 10);
      return d;
    }
    case "max": {
      if (heldLots.length === 0) return new Date(end.getFullYear() - 1, 0, 1);
      const earliest = Math.min(
        ...heldLots.map((l) => new Date(`${l.purchase_date}T12:00:00`).getTime())
      );
      return new Date(earliest);
    }
    default:
      return new Date(end.getFullYear() - 3, end.getMonth(), end.getDate());
  }
}

function monthEndsBetween(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    months.push(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export interface PeriodSummary {
  returns: number;
  periodLabel: string;
  /** Annualized rate of return (%), or null when unavailable (YTD or < 12 months). */
  rateOfReturn: number | null;
}

function valuationAtDate(
  valuations: CardValuation[],
  lotId: string,
  asOf: Date
): number | null {
  let latest: CardValuation | null = null;

  for (const v of valuations) {
    if (v.lot_id !== lotId) continue;
    const recorded = new Date(v.recorded_at);
    if (recorded > asOf) continue;
    if (
      !latest ||
      recorded.getTime() > new Date(latest.recorded_at).getTime()
    ) {
      latest = v;
    }
  }

  return latest?.value ?? null;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );
}

function periodStartKey(periodStart: Date): string {
  return formatDateKey(periodStart);
}

/**
 * Asset gains for currently held lots from periodStart through asOf.
 * Lots acquired during the period contribute (current value − purchase cost).
 * Lots held at period start contribute (current value − value at period start).
 * Sold lots are excluded (only filterHeldPositions).
 */
export function getPeriodReturns(
  positions: AssetPosition[],
  valuations: CardValuation[],
  periodStart: Date,
  asOf: Date
): number {
  const heldPositions = filterHeldPositions(positions);
  const startKey = periodStartKey(periodStart);
  const asOfEnd = endOfDay(asOf);
  const asOfKey = formatDateKey(asOfEnd);
  const periodStartEnd = endOfDay(periodStart);
  let total = 0;

  for (const { lots } of heldPositions) {
    for (const lot of lots) {
      if (lot.purchase_date > asOfKey) continue;

      const endVal =
        valuationAtDate(valuations, lot.id, asOfEnd) ?? lot.unit_cost;

      if (lot.purchase_date > startKey) {
        total += endVal - lot.unit_cost;
      } else {
        const startVal =
          valuationAtDate(valuations, lot.id, periodStartEnd) ?? lot.unit_cost;
        total += endVal - startVal;
      }
    }
  }

  return Math.round(total * 100) / 100;
}

function annualizationMonths(
  range: TimeRangeKey,
  periodStart: Date,
  asOf: Date
): number {
  switch (range) {
    case "1y":
      return 12;
    case "3y":
      return 36;
    case "5y":
      return 60;
    case "10y":
      return 120;
    default:
      return monthsInPeriod(periodStart, asOf);
  }
}

/**
 * Capital base for rate-of-return: value at period start for lots held then,
 * plus purchase cost for lots acquired during the period.
 */
function getPeriodCapitalBase(
  positions: AssetPosition[],
  valuations: CardValuation[],
  periodStart: Date,
  asOf: Date
): number {
  const heldPositions = filterHeldPositions(positions);
  const startKey = periodStartKey(periodStart);
  const asOfEnd = endOfDay(asOf);
  const asOfKey = formatDateKey(asOfEnd);
  const periodStartEnd = endOfDay(periodStart);
  let total = 0;

  for (const { lots } of heldPositions) {
    for (const lot of lots) {
      if (lot.purchase_date > asOfKey) continue;

      if (lot.purchase_date > startKey) {
        total += lot.unit_cost;
      } else {
        total +=
          valuationAtDate(valuations, lot.id, periodStartEnd) ?? lot.unit_cost;
      }
    }
  }

  return Math.round(total * 100) / 100;
}

const MIN_RATE_OF_RETURN_MONTHS = 12;

/** Fixed ranges span full years; "max" needs 12+ calendar months of history. */
function meetsRateOfReturnMinimum(
  range: TimeRangeKey,
  periodStart: Date,
  asOf: Date
): boolean {
  if (range === "ytd") return false;
  if (range === "1y" || range === "3y" || range === "5y" || range === "10y") {
    return true;
  }
  const calendarMonths =
    (asOf.getFullYear() - periodStart.getFullYear()) * 12 +
    (asOf.getMonth() - periodStart.getMonth());
  return calendarMonths >= MIN_RATE_OF_RETURN_MONTHS;
}

/** Months elapsed between two dates (fractional, for annualization). */
function monthsInPeriod(start: Date, end: Date): number {
  const msPerMonth = (365.25 / 12) * 24 * 60 * 60 * 1000;
  return (end.getTime() - start.getTime()) / msPerMonth;
}

/**
 * Annualized rate of return for the selected period.
 * Returns null for YTD, periods shorter than 12 months, or zero capital base.
 */
export function getPeriodRateOfReturn(
  positions: AssetPosition[],
  valuations: CardValuation[],
  range: TimeRangeKey,
  periodStart: Date,
  asOf: Date,
  periodReturns: number
): number | null {
  if (!meetsRateOfReturnMinimum(range, periodStart, asOf)) return null;

  const months = annualizationMonths(range, periodStart, asOf);

  const capitalBase = getPeriodCapitalBase(
    positions,
    valuations,
    periodStart,
    asOf
  );
  if (capitalBase <= 0) return null;

  const periodRate = periodReturns / capitalBase;
  const annualized = (Math.pow(1 + periodRate, 12 / months) - 1) * 100;

  return Math.round(annualized * 10) / 10;
}

export function getPeriodSummary(
  positions: AssetPosition[],
  valuations: CardValuation[],
  lots: Lot[],
  range: TimeRangeKey,
  now = new Date()
): PeriodSummary | null {
  const heldPositions = filterHeldPositions(positions);
  if (heldPositions.length === 0) return null;

  const rangeStart = getRangeStart(range, filterHeldLots(lots), now);
  const periodLabel =
    TIME_RANGES.find((entry) => entry.key === range)?.label ?? range;
  const returns = getPeriodReturns(heldPositions, valuations, rangeStart, now);

  return {
    returns,
    periodLabel,
    rateOfReturn: getPeriodRateOfReturn(
      heldPositions,
      valuations,
      range,
      rangeStart,
      now,
      returns
    ),
  };
}

export function buildPortfolioHistory(
  positions: AssetPosition[],
  valuations: CardValuation[],
  lots: Lot[],
  range: TimeRangeKey,
  now = new Date()
): PortfolioHistoryPoint[] {
  const heldPositions = filterHeldPositions(positions);
  if (heldPositions.length === 0) return [];

  const heldLots = filterHeldLots(lots);
  const rangeStart = getRangeStart(range, heldLots, now);
  const monthEnds = monthEndsBetween(rangeStart, now);

  return monthEnds.map((monthEnd) => {
    const asOf = endOfDay(monthEnd);

    return {
      date: monthEnd.toISOString().split("T")[0],
      label: formatMonthLabel(monthEnd),
      returns: getPeriodReturns(
        heldPositions,
        valuations,
        rangeStart,
        asOf
      ),
    };
  });
}

export function buildSportAllocation(
  heldLotPositions: HeldLotPosition[],
  latestValuations: Map<string, CardValuation>
): SportAllocationSlice[] {
  const sportMap = new Map<
    string,
    { count: number; costBasis: number; currentValue: number }
  >();

  for (const { asset, lot } of heldLotPositions) {
    if (lot.quantity_remaining <= 0) continue;

    const costBasis = lot.unit_cost;
    const latest = latestValuations.get(lot.id);
    const positionValue = latest?.value ?? null;

    const existing = sportMap.get(asset.sport) ?? {
      count: 0,
      costBasis: 0,
      currentValue: 0,
    };
    existing.count += 1;
    existing.costBasis += costBasis;
    if (positionValue != null) {
      existing.currentValue += positionValue;
    }
    sportMap.set(asset.sport, existing);
  }

  const totalForPie = Array.from(sportMap.values()).reduce(
    (sum, data) => sum + (data.currentValue > 0 ? data.currentValue : data.costBasis),
    0
  );

  return Array.from(sportMap.entries())
    .map(([sport, data]) => {
      const pieValue =
        data.currentValue > 0 ? data.currentValue : data.costBasis;
      return {
        sport,
        count: data.count,
        costBasis: Math.round(data.costBasis * 100) / 100,
        currentValue:
          data.currentValue > 0
            ? Math.round(data.currentValue * 100) / 100
            : null,
        value: Math.round(pieValue * 100) / 100,
        percentage: totalForPie > 0 ? (pieValue / totalForPie) * 100 : 0,
      };
    })
    .sort((a, b) => b.costBasis - a.costBasis);
}

export const SPORT_COLORS: Record<string, string> = {
  Baseball: "oklch(0.52 0.19 265)",
  Basketball: "oklch(0.58 0.18 45)",
  Football: "oklch(0.48 0.16 145)",
  Hockey: "oklch(0.55 0.14 220)",
  Pokemon: "oklch(0.62 0.2 320)",
  Soccer: "oklch(0.5 0.12 170)",
  Other: "oklch(0.55 0.03 265)",
};

export function sportColor(sport: string, index: number): string {
  if (SPORT_COLORS[sport]) return SPORT_COLORS[sport];
  const hue = (index * 47) % 360;
  return `oklch(0.55 0.15 ${hue})`;
}

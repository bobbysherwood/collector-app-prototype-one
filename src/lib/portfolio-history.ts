import type { Card, CardValuation } from "@/types/card";
import { cardCostBasis, cardMarketValue, cardWasHeldAt } from "@/types/card";

export interface CardSale {
  id: string;
  card_id: string | null;
  user_id: string;
  sale_date: string;
  sale_price: number;
  quantity: number;
  notes: string | null;
  created_at: string;
}

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
  value: number;
  returns: number;
  costBasis: number;
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
  cards: Card[],
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
      if (cards.length === 0) return new Date(end.getFullYear() - 1, 0, 1);
      const earliest = Math.min(
        ...cards.map((c) => new Date(`${c.purchase_date}T12:00:00`).getTime())
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
  value: number;
  costBasis: number;
  returns: number;
  periodLabel: string;
  startLabel: string;
  endLabel: string;
  startValue: number;
  startCostBasis: number;
  endValue: number;
  endCostBasis: number;
}

export function getPortfolioSnapshotAt(
  cards: Card[],
  valuations: CardValuation[],
  asOf: Date
): { value: number; costBasis: number; returns: number } {
  let value = 0;
  let costBasis = 0;

  for (const card of cards) {
    const purchased = new Date(`${card.purchase_date}T12:00:00`);
    if (purchased > asOf) continue;
    if (!cardWasHeldAt(card, asOf)) continue;

    const basis = cardCostBasis(card);
    costBasis += basis;

    const unitValue =
      valuationAtDate(valuations, card.id, asOf) ?? card.purchase_price;
    value += cardMarketValue(unitValue, card.quantity);
  }

  const roundedValue = Math.round(value * 100) / 100;
  const roundedCostBasis = Math.round(costBasis * 100) / 100;

  return {
    value: roundedValue,
    costBasis: roundedCostBasis,
    returns: Math.round((roundedValue - roundedCostBasis) * 100) / 100,
  };
}

export function getPeriodSummary(
  cards: Card[],
  valuations: CardValuation[],
  range: TimeRangeKey,
  now = new Date()
): PeriodSummary | null {
  if (cards.length === 0) return null;

  const rangeStart = getRangeStart(range, cards, now);
  const current = getPortfolioSnapshotAt(cards, valuations, now);
  const periodCostBasis = getCostBasisForPurchasesInRange(cards, rangeStart, now);
  const periodLabel =
    TIME_RANGES.find((entry) => entry.key === range)?.label ?? range;

  const latestValue = current.value;
  const returns = Math.round((latestValue - periodCostBasis) * 100) / 100;

  return {
    value: latestValue,
    costBasis: periodCostBasis,
    returns,
    periodLabel,
    startLabel: formatMonthLabel(rangeStart),
    endLabel: formatMonthLabel(now),
    startValue: latestValue,
    startCostBasis: periodCostBasis,
    endValue: latestValue,
    endCostBasis: periodCostBasis,
  };
}

function getCostBasisForPurchasesInRange(
  cards: Card[],
  rangeStart: Date,
  now: Date
): number {
  const start = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    rangeStart.getDate(),
    0,
    0,
    0
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );

  let total = 0;

  for (const card of cards) {
    const purchased = new Date(`${card.purchase_date}T12:00:00`);
    if (purchased < start || purchased > end) continue;
    total += cardCostBasis(card);
  }

  return Math.round(total * 100) / 100;
}

function valuationAtDate(
  valuations: CardValuation[],
  cardId: string,
  asOf: Date
): number | null {
  let latest: CardValuation | null = null;

  for (const v of valuations) {
    if (v.card_id !== cardId) continue;
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

export function buildPortfolioHistory(
  cards: Card[],
  valuations: CardValuation[],
  range: TimeRangeKey,
  now = new Date()
): PortfolioHistoryPoint[] {
  const rangeStart = getRangeStart(range, cards, now);
  const monthEnds = monthEndsBetween(rangeStart, now);

  const valuationsByCard = new Map<string, CardValuation[]>();
  for (const v of valuations) {
    const list = valuationsByCard.get(v.card_id) ?? [];
    list.push(v);
    valuationsByCard.set(v.card_id, list);
  }

  return monthEnds.map((monthEnd) => {
    const asOf = new Date(
      monthEnd.getFullYear(),
      monthEnd.getMonth(),
      monthEnd.getDate(),
      23,
      59,
      59
    );

    const snapshot = getPortfolioSnapshotAt(cards, valuations, asOf);

    return {
      date: monthEnd.toISOString().split("T")[0],
      label: formatMonthLabel(monthEnd),
      value: snapshot.value,
      returns: snapshot.returns,
      costBasis: snapshot.costBasis,
    };
  });
}

export function buildSportAllocation(
  cards: Card[],
  latestValuations: Map<string, CardValuation>
): SportAllocationSlice[] {
  const sportMap = new Map<
    string,
    { count: number; costBasis: number; currentValue: number }
  >();

  for (const card of cards) {
    const costBasis = cardCostBasis(card);
    const latest = latestValuations.get(card.id);
    const positionValue = latest
      ? cardMarketValue(latest.value, card.quantity)
      : null;

    const existing = sportMap.get(card.sport) ?? {
      count: 0,
      costBasis: 0,
      currentValue: 0,
    };
    existing.count += card.quantity;
    existing.costBasis += costBasis;
    if (positionValue != null) {
      existing.currentValue += positionValue;
    }
    sportMap.set(card.sport, existing);
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
        currentValue: data.currentValue > 0 ? Math.round(data.currentValue * 100) / 100 : null,
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

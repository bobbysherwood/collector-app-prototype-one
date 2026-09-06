import { dm2CardToSyntheticAsset } from "@/lib/dm2-card-to-asset";
import { formatResearchCardName } from "@/lib/market-research/catalog";
import {
  buildImpliedIndexSeries,
  buildPriceSeriesFromSales,
  type ResearchSeriesPoint,
} from "@/lib/market-research/series";
import { getMockMarketSales } from "@/lib/market-sales/mock-provider";
import {
  listPlayerOpportunitySnapshots,
  recordPlayerOpportunitySnapshotIfStale,
} from "@/lib/player-opportunity/data/player-opportunity-data";
import type { SportMarketIndexResult } from "@/types/market-index";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";
import type { PlayerOpportunity } from "@/types/player-opportunity";

export const PLAYER_COMP_CARD_LIMIT = 24;
export const PLAYER_TRENDS_RECENT_SALES = 8;

export interface PlayerCompSale {
  date: string;
  price: number;
  cardName: string;
  href: string;
}

export interface PlayerCardComps {
  saleCount: number;
  volume: number;
  medianPrice: number | null;
  lastSale: PlayerCompSale | null;
  cardCount: number;
  sourceNote: string;
  priceSeries: ResearchSeriesPoint[];
  recentSales: PlayerCompSale[];
}

export interface PlayerMarketTrends {
  opportunitySeries: ResearchSeriesPoint[];
  sportIndexSeries: ResearchSeriesPoint[];
  sportIndex: SportMarketIndexResult | null;
  sportIndexHref: string;
  snapshotCount: number;
  comps: PlayerCardComps;
}

export function medianNumber(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

export function dailyMedianPriceSeries(
  sales: Array<{ sale_date: string; sale_price: number }>
): ResearchSeriesPoint[] {
  const byDate = new Map<string, number[]>();
  for (const sale of sales) {
    const list = byDate.get(sale.sale_date) ?? [];
    list.push(sale.sale_price);
    byDate.set(sale.sale_date, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, prices]) => {
      const value = medianNumber(prices);
      if (value == null) return [];
      return [
        {
          date,
          label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          value,
          kind: "history" as const,
        },
      ];
    });
}

export function aggregatePlayerCardComps(
  cards: Dm2CardSearchResult[],
  limit = PLAYER_COMP_CARD_LIMIT
): PlayerCardComps {
  const sample = cards.slice(0, limit);
  const sales: PlayerCompSale[] = [];

  for (const card of sample) {
    const asset = dm2CardToSyntheticAsset(card);
    const tape = getMockMarketSales(asset).sales;
    const name = formatResearchCardName(card);
    const href = `/market-research/cards/${card.id}`;
    for (const sale of tape) {
      sales.push({
        date: sale.sale_date,
        price: sale.sale_price,
        cardName: name,
        href,
      });
    }
  }

  const sorted = [...sales].sort((a, b) => b.date.localeCompare(a.date));
  const prices = sorted.map((sale) => sale.price);
  const volume = prices.reduce((sum, price) => sum + price, 0);

  return {
    saleCount: sorted.length,
    volume: Math.round(volume * 100) / 100,
    medianPrice: medianNumber(prices),
    lastSale: sorted[0] ?? null,
    cardCount: sample.length,
    sourceNote:
      sample.length === 0
        ? "No linked catalog cards are available to build a comps tape."
        : "Sold comps currently use the market-sales mock tape across linked catalog cards. Live eBay data is used for listings on card pages.",
    priceSeries:
      sorted.length > 0
        ? dailyMedianPriceSeries(
            sorted.map((sale) => ({
              sale_date: sale.date,
              sale_price: sale.price,
            }))
          )
        : buildPriceSeriesFromSales([]),
    recentSales: sorted.slice(0, PLAYER_TRENDS_RECENT_SALES),
  };
}

export function opportunitySeriesFromSnapshots(
  snapshots: Array<{ computedAt: string; opportunityScore: number }>,
  current: PlayerOpportunity | null
): ResearchSeriesPoint[] {
  const points = snapshots
    .filter((row) => Number.isFinite(row.opportunityScore))
    .map((row) => {
      const date = new Date(row.computedAt);
      return {
        date: date.toISOString(),
        label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: Math.round(row.opportunityScore * 10) / 10,
        kind: "history" as const,
      };
    });

  if (current) {
    const alreadyHasCurrent = points.some(
      (point) =>
        Math.abs(Date.parse(point.date) - Date.parse(current.computedAt)) < 60_000
    );
    if (!alreadyHasCurrent) {
      const asOf = new Date(current.computedAt);
      points.push({
        date: asOf.toISOString(),
        label: asOf.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: current.opportunityScore,
        kind: "history",
      });
    }

    if (points.length >= 2) {
      const forecastDate = new Date(current.computedAt);
      forecastDate.setDate(forecastDate.getDate() + 90);
      const forecast =
        current.opportunityScore * (1 + current.expectedDemandChange90d / 100);
      points.push({
        date: forecastDate.toISOString(),
        label: forecastDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        value: Math.round(forecast * 10) / 10,
        kind: "forecast",
      });
      return points.sort((a, b) => a.date.localeCompare(b.date));
    }

    return buildImpliedIndexSeries({
      asOf: current.computedAt,
      current: current.opportunityScore,
      prior30d: current.opportunityScore - current.momentumScore * 0.08,
      forecast90dPct: current.expectedDemandChange90d,
    });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

function sportIndexSeriesFromResult(
  index: SportMarketIndexResult | null
): ResearchSeriesPoint[] {
  if (!index) return [];
  const prior30d =
    index.healthScore - index.momentumScore * 0.08;
  return buildImpliedIndexSeries({
    asOf: index.asOf,
    current: index.healthScore,
    prior30d,
    forecast90dPct: index.forecast3mPct,
  });
}

export async function buildPlayerMarketTrends(input: {
  cards: Dm2CardSearchResult[];
  playerOpportunity: PlayerOpportunity | null;
  sportIndex: SportMarketIndexResult | null;
  sportSlug: string;
}): Promise<PlayerMarketTrends> {
  if (input.playerOpportunity) {
    await recordPlayerOpportunitySnapshotIfStale(input.playerOpportunity);
  }

  const snapshots = input.playerOpportunity
    ? await listPlayerOpportunitySnapshots(input.playerOpportunity.playerId)
    : [];

  return {
    opportunitySeries: opportunitySeriesFromSnapshots(
      snapshots,
      input.playerOpportunity
    ),
    sportIndexSeries: sportIndexSeriesFromResult(input.sportIndex),
    sportIndex: input.sportIndex,
    sportIndexHref: `/market-research/markets/${input.sportSlug}`,
    snapshotCount: snapshots.length,
    comps: aggregatePlayerCardComps(input.cards),
  };
}

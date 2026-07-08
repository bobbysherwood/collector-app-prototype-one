import { createHash } from "crypto";
import { buildLotPerformanceLeaders } from "@/lib/data";
import {
  buildSportAllocation,
  getPeriodSummary,
  type TimeRangeKey,
} from "@/lib/portfolio-history";
import type { PortfolioData } from "@/lib/data";
import { buildLatestValuationMap } from "@/lib/valuations";
import {
  PORTFOLIO_INSIGHTS_PROMPT_VERSION,
  STALE_VALUATION_THRESHOLD_DAYS,
} from "@/types/portfolio-insights";
import { filterHeldLots } from "@/types/card";

const PERIOD_RANGES: TimeRangeKey[] = ["ytd", "1y", "3y"];

export interface PortfolioInsightSnapshot {
  asOf: string;
  summary: {
    heldLotCount: number;
    heldAssetCount: number;
    soldAssetCount: number;
    totalCostBasis: number;
    totalCurrentValue: number;
    totalUnrealizedGain: number;
    totalUnrealizedGainPercent: number | null;
    lotsMissingValuation: number;
    lotsWithStaleValuation: number;
    staleValuationThresholdDays: number;
  };
  periodPerformance: Record<
    string,
    {
      returns: number;
      rateOfReturn: number | null;
      periodLabel: string;
    } | null
  >;
  sportAllocation: Array<{
    sport: string;
    count: number;
    costBasis: number;
    currentValue: number | null;
    percentage: number;
  }>;
  topPerformers: Array<{
    playerName: string;
    year: number;
    sport: string;
    cardType: string;
    costBasis: number;
    currentValue: number;
    gainPercent: number;
  }>;
  underperformers: Array<{
    playerName: string;
    year: number;
    sport: string;
    cardType: string;
    costBasis: number;
    currentValue: number;
    gainPercent: number;
    daysSinceLastValuation: number | null;
  }>;
  playerConcentration: Array<{
    playerName: string;
    lotCount: number;
    totalCurrentValue: number;
    portfolioPercent: number;
    rank: number;
  }>;
  topHoldingsByValue: Array<{
    playerName: string;
    year: number;
    sport: string;
    cardType: string;
    currentValue: number;
    portfolioPercent: number;
  }>;
  staleValuations: Array<{
    playerName: string;
    year: number;
    sport: string;
    cardType: string;
    daysSinceLastValuation: number;
    lastValuationDate: string;
  }>;
  dataQuality: {
    hasMarketComps: boolean;
    valuationCoveragePercent: number;
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function daysSince(dateIso: string, now = new Date()): number {
  const recorded = new Date(dateIso);
  return Math.floor((now.getTime() - recorded.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildPortfolioInsightSnapshot(
  data: PortfolioData,
  now = new Date()
): PortfolioInsightSnapshot {
  const latestValuations = buildLatestValuationMap(data.valuations);
  const heldLots = filterHeldLots(data.lots);
  const heldAssetIds = new Set(heldLots.map((lot) => lot.asset_id));
  const soldAssetCount = data.assets.filter(
    (asset) => !heldAssetIds.has(asset.id)
  ).length;

  let totalCostBasis = 0;
  let totalCurrentValue = 0;
  let lotsMissingValuation = 0;
  let lotsWithStaleValuation = 0;

  const playerValueMap = new Map<
    string,
    { lotCount: number; totalCurrentValue: number }
  >();

  const holdingRows: Array<{
    playerName: string;
    year: number;
    sport: string;
    cardType: string;
    currentValue: number;
    lotId: string;
    lastValuationDate: string | null;
  }> = [];

  const staleValuations: PortfolioInsightSnapshot["staleValuations"] = [];

  for (const { asset, lot } of data.heldLotPositions) {
    const costBasis = lot.unit_cost * lot.quantity_remaining;
    totalCostBasis += costBasis;

    const latest = latestValuations.get(lot.id);
    if (!latest) {
      lotsMissingValuation += 1;
      continue;
    }

    const currentValue = latest.value;
    totalCurrentValue += currentValue;

    const days = daysSince(latest.recorded_at, now);
    if (days > STALE_VALUATION_THRESHOLD_DAYS) {
      lotsWithStaleValuation += 1;
      staleValuations.push({
        playerName: asset.player_name,
        year: asset.year,
        sport: asset.sport,
        cardType: asset.card_type,
        daysSinceLastValuation: days,
        lastValuationDate: latest.recorded_at.split("T")[0],
      });
    }

    const playerEntry = playerValueMap.get(asset.player_name) ?? {
      lotCount: 0,
      totalCurrentValue: 0,
    };
    playerEntry.lotCount += 1;
    playerEntry.totalCurrentValue += currentValue;
    playerValueMap.set(asset.player_name, playerEntry);

    holdingRows.push({
      playerName: asset.player_name,
      year: asset.year,
      sport: asset.sport,
      cardType: asset.card_type,
      currentValue,
      lotId: lot.id,
      lastValuationDate: latest.recorded_at,
    });
  }

  const totalUnrealizedGain = totalCurrentValue - totalCostBasis;
  const totalUnrealizedGainPercent =
    totalCostBasis > 0
      ? roundPercent((totalUnrealizedGain / totalCostBasis) * 100)
      : null;

  const sportAllocation = buildSportAllocation(
    data.heldLotPositions,
    latestValuations
  ).map((slice) => ({
    sport: slice.sport,
    count: slice.count,
    costBasis: slice.costBasis,
    currentValue: slice.currentValue,
    percentage: roundPercent(slice.percentage),
  }));

  const { topPerformers, underperformers } = buildLotPerformanceLeaders(
    data.heldLotPositions,
    data.valuations,
    5
  );

  const mapTopPerformer = (entry: (typeof topPerformers)[number]) => ({
    playerName: entry.asset.player_name,
    year: entry.asset.year,
    sport: entry.asset.sport,
    cardType: entry.asset.card_type,
    costBasis: roundMoney(entry.costBasis),
    currentValue: roundMoney(entry.currentValue),
    gainPercent: roundPercent(entry.gainPercent),
  });

  const mapUnderperformer = (entry: (typeof underperformers)[number]) => {
    const latest = latestValuations.get(entry.lot.id);
    return {
      playerName: entry.asset.player_name,
      year: entry.asset.year,
      sport: entry.asset.sport,
      cardType: entry.asset.card_type,
      costBasis: roundMoney(entry.costBasis),
      currentValue: roundMoney(entry.currentValue),
      gainPercent: roundPercent(entry.gainPercent),
      daysSinceLastValuation: latest
        ? daysSince(latest.recorded_at, now)
        : null,
    };
  };

  const playerConcentration = Array.from(playerValueMap.entries())
    .map(([playerName, stats]) => ({
      playerName,
      lotCount: stats.lotCount,
      totalCurrentValue: roundMoney(stats.totalCurrentValue),
      portfolioPercent:
        totalCurrentValue > 0
          ? roundPercent((stats.totalCurrentValue / totalCurrentValue) * 100)
          : 0,
      rank: 0,
    }))
    .sort((a, b) => b.totalCurrentValue - a.totalCurrentValue)
    .slice(0, 5)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const topHoldingsByValue = [...holdingRows]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5)
    .map((row) => ({
      playerName: row.playerName,
      year: row.year,
      sport: row.sport,
      cardType: row.cardType,
      currentValue: roundMoney(row.currentValue),
      portfolioPercent:
        totalCurrentValue > 0
          ? roundPercent((row.currentValue / totalCurrentValue) * 100)
          : 0,
    }));

  const valuationCoveragePercent =
    heldLots.length > 0
      ? roundPercent(
          ((heldLots.length - lotsMissingValuation) / heldLots.length) * 100
        )
      : 100;

  const periodPerformance = Object.fromEntries(
    PERIOD_RANGES.map((range) => [
      range,
      getPeriodSummary(data.positions, data.valuations, data.lots, range, now),
    ])
  );

  return {
    asOf: now.toISOString(),
    summary: {
      heldLotCount: heldLots.length,
      heldAssetCount: heldAssetIds.size,
      soldAssetCount,
      totalCostBasis: roundMoney(totalCostBasis),
      totalCurrentValue: roundMoney(totalCurrentValue),
      totalUnrealizedGain: roundMoney(totalUnrealizedGain),
      totalUnrealizedGainPercent,
      lotsMissingValuation,
      lotsWithStaleValuation,
      staleValuationThresholdDays: STALE_VALUATION_THRESHOLD_DAYS,
    },
    periodPerformance: Object.fromEntries(
      Object.entries(periodPerformance).map(([key, value]) => [
        key,
        value
          ? {
              returns: roundMoney(value.returns),
              rateOfReturn: value.rateOfReturn,
              periodLabel: value.periodLabel,
            }
          : null,
      ])
    ),
    sportAllocation,
    topPerformers: topPerformers.map(mapTopPerformer),
    underperformers: underperformers.map(mapUnderperformer),
    playerConcentration,
    topHoldingsByValue,
    staleValuations: staleValuations
      .sort((a, b) => b.daysSinceLastValuation - a.daysSinceLastValuation)
      .slice(0, 5),
    dataQuality: {
      hasMarketComps: false,
      valuationCoveragePercent,
    },
  };
}

export function computePortfolioSnapshotHash(
  snapshot: PortfolioInsightSnapshot
): string {
  const cacheInput = {
    promptVersion: PORTFOLIO_INSIGHTS_PROMPT_VERSION,
    summary: snapshot.summary,
    periodPerformance: snapshot.periodPerformance,
    sportAllocation: snapshot.sportAllocation,
    topPerformers: snapshot.topPerformers,
    underperformers: snapshot.underperformers,
    playerConcentration: snapshot.playerConcentration,
    topHoldingsByValue: snapshot.topHoldingsByValue,
    staleValuations: snapshot.staleValuations,
    dataQuality: snapshot.dataQuality,
  };

  return createHash("sha256").update(JSON.stringify(cacheInput)).digest("hex");
}

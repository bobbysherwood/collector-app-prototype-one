import { describe, expect, it } from "vitest";
import {
  aggregatePlayerCardComps,
  dailyMedianPriceSeries,
  medianNumber,
  opportunitySeriesFromSnapshots,
} from "@/lib/market-research/player-market-trends";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";
import type { PlayerOpportunity } from "@/types/player-opportunity";

function card(id: string): Dm2CardSearchResult {
  return {
    id,
    cardSetId: "set-1",
    sportName: "Basketball",
    year: 2017,
    manufacturerName: "Panini",
    brandName: "Prizm",
    cardSetCategoryName: "Basketball",
    cardSetName: "Prizm",
    cardNumber: "16",
    player: "Jayson Tatum",
    parallelName: null,
    imagePath: null,
    attributeNames: [],
  };
}

function opportunity(overrides: Partial<PlayerOpportunity> = {}): PlayerOpportunity {
  return {
    playerId: "jayson-tatum--basketball",
    playerName: "Jayson Tatum",
    sport: "Basketball",
    lifecycle: "active",
    modelVersion: "player-opportunity-v1.0.0",
    computedAt: "2026-09-05T18:00:00.000Z",
    opportunityScore: 72,
    qualityScore: 80,
    futureOutlookScore: 70,
    demandScore: 55,
    sportMarketScore: 60,
    momentumScore: 50,
    expectedDemandChange90d: 6,
    riskScore: 40,
    confidenceScore: 70,
    trend: "increasing",
    positiveDrivers: [],
    negativeDrivers: [],
    catalysts: [],
    summary: "Test",
    weightProfileId: "test",
    inputs: {},
    ...overrides,
  };
}

describe("player market trends", () => {
  it("computes a median", () => {
    expect(medianNumber([1, 3, 2])).toBe(2);
    expect(medianNumber([2, 4])).toBe(3);
    expect(medianNumber([])).toBeNull();
  });

  it("rolls sales into a daily median series", () => {
    const series = dailyMedianPriceSeries([
      { sale_date: "2026-09-01", sale_price: 100 },
      { sale_date: "2026-09-01", sale_price: 200 },
      { sale_date: "2026-09-02", sale_price: 150 },
    ]);
    expect(series).toHaveLength(2);
    expect(series[0]?.value).toBe(150);
    expect(series[1]?.value).toBe(150);
  });

  it("aggregates mock comps across linked cards", () => {
    const comps = aggregatePlayerCardComps([card("a"), card("b")]);
    expect(comps.cardCount).toBe(2);
    expect(comps.saleCount).toBeGreaterThan(0);
    expect(comps.volume).toBeGreaterThan(0);
    expect(comps.medianPrice).toBeGreaterThan(0);
    expect(comps.lastSale).not.toBeNull();
    expect(comps.priceSeries.length).toBeGreaterThan(0);
    expect(comps.sourceNote).toMatch(/mock tape/i);
  });

  it("uses stored snapshots once two points exist", () => {
    const series = opportunitySeriesFromSnapshots(
      [
        { computedAt: "2026-08-01T10:00:00.000Z", opportunityScore: 60 },
        { computedAt: "2026-09-01T10:00:00.000Z", opportunityScore: 68 },
      ],
      opportunity()
    );
    const history = series.filter((point) => point.kind === "history");
    const forecast = series.filter((point) => point.kind === "forecast");
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(forecast).toHaveLength(1);
    expect(history.map((point) => point.value)).toContain(60);
    expect(history.map((point) => point.value)).toContain(72);
  });

  it("falls back to an implied series when only the current score exists", () => {
    const series = opportunitySeriesFromSnapshots([], opportunity());
    expect(series.some((point) => point.kind === "history")).toBe(true);
    expect(series.some((point) => point.kind === "forecast")).toBe(true);
  });
});

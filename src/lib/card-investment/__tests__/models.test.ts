import { describe, expect, it } from "vitest";
import { assertNoLookAhead } from "@/lib/card-investment/backtesting/types";
import { buildCardInvestmentContextSync } from "@/lib/card-investment/build-card-context";
import {
  collectEvidenceKeys,
  computeInvestmentExplanation,
  validateExplanationTraceability,
} from "@/lib/card-investment/explainability/investment-explanation-model";
import { sportMarketSnapshotFromResult } from "@/lib/card-investment/market/sport-market-client";
import { computeInvestmentProfile } from "@/lib/card-investment/orchestrator/compute-investment-profile";
import { trimmedMedian } from "@/lib/card-investment/types/math";
import type { Asset } from "@/types/asset";
import type { SportMarketSnapshot } from "@/types/card-investment";
import type { MarketSale } from "@/types/market-sales";
import type { SportMarketIndexResult } from "@/types/market-index";

function baseAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-test-1",
    user_id: "user-1",
    player_name: "Victor Wembanyama",
    year: 2023,
    card_type: "Panini Prizm Rookie",
    sport: "Basketball",
    card_number: "275",
    insert_parallel: "Silver Prizm",
    image_path: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function sale(
  daysAgo: number,
  price: number,
  asOf = "2026-08-08T12:00:00Z"
): MarketSale {
  const date = new Date(asOf);
  date.setDate(date.getDate() - daysAgo);
  return {
    id: `sale-${daysAgo}-${price}`,
    source: "ebay",
    title: "Test sale",
    grader: "PSA",
    grade: "10",
    sale_price: price,
    hammer_price: null,
    buyers_premium_pct: null,
    currency: "USD",
    sale_date: date.toISOString().split("T")[0],
    sale_type: "auction",
    listing_url: "https://example.com",
    match_confidence: "high",
  };
}

function mockSportMarket(
  overrides: Partial<SportMarketIndexResult> = {}
): SportMarketSnapshot {
  const result: SportMarketIndexResult = {
    sportId: "nba",
    sportName: "NBA Basketball",
    healthScore: 62,
    momentumScore: 58,
    outlookScore: 60,
    forecast3mPct: 4,
    forecast6mPct: 6,
    forecast12mPct: 8,
    confidenceScore: 70,
    riskRating: "medium",
    positiveDrivers: [],
    negativeDrivers: [],
    explanation: "Test market",
    modelVersion: "sport-index-v1.0.0",
    seasonPhase: "regular",
    asOf: "2026-08-08T10:00:00Z",
    ...overrides,
  };
  return sportMarketSnapshotFromResult(result)!;
}

describe("Card Investment Models V1", () => {
  const asOf = "2026-08-08T12:00:00Z";

  it("scores a modern rookie with sport market context", () => {
    const asset = baseAsset();
    const sales = [sale(3, 220), sale(10, 210), sale(20, 205), sale(45, 200)];
    const context = buildCardInvestmentContextSync(asset, sales, {
      asOf,
      sportMarketOverride: mockSportMarket({
        momentumScore: 72,
        outlookScore: 68,
        forecast3mPct: 8,
      }),
    });

    const profile = computeInvestmentProfile(context);

    expect(profile.classification.archetype).toBe("rookie");
    expect(profile.classification.lifecycle).toBe("rising");
    expect(profile.valuation.fairValue).not.toBeNull();
    expect(profile.demand.score).toBeGreaterThanOrEqual(55);
    expect(profile.recommendation.rating).not.toBe("insufficient_data");
  });

  it("scores vintage HOF legacy card", () => {
    const asset = baseAsset({
      player_name: "Michael Jordan",
      year: 1986,
      card_type: "Fleer Rookie",
      insert_parallel: null,
    });
    const sales = [sale(5, 5000), sale(15, 4800), sale(40, 5100), sale(70, 4950)];
    const context = buildCardInvestmentContextSync(asset, sales, {
      asOf,
      sportMarketOverride: mockSportMarket({ momentumScore: 55 }),
    });

    const profile = computeInvestmentProfile(context);

    expect(profile.classification.era).toBe("junk_wax");
    expect(profile.classification.lifecycle).toBe("legacy");
    expect(profile.playerLegacy.score).toBeGreaterThan(80);
    expect(profile.scarcity.tier).not.toBe("common");
  });

  it("marks unavailable inputs when sales are missing", () => {
    const asset = baseAsset();
    const context = buildCardInvestmentContextSync(asset, [], {
      asOf,
      sportMarketOverride: null,
    });

    const profile = computeInvestmentProfile(context);

    expect(profile.valuation.fairValue).toBeNull();
    expect(profile.valuation.confidence).toBe("none");
    expect(profile.valuation.provenance.available).toBe(false);
    expect(profile.demand.confidence).toBe("none");
    expect(profile.recommendation.rating).toBe("insufficient_data");
  });

  it("rejects outlier sales in valuation", () => {
    const prices = [200, 205, 210, 208, 5000];
    const { value, outliersRejected } = trimmedMedian(prices);

    expect(outliersRejected).toBeGreaterThan(0);
    expect(value).toBeLessThan(500);
    expect(value).toBeGreaterThan(190);
  });

  it("responds to bull vs bear sport market", () => {
    const asset = baseAsset();
    const sales = [sale(3, 200), sale(12, 195), sale(25, 198), sale(50, 190)];

    const bull = computeInvestmentProfile(
      buildCardInvestmentContextSync(asset, sales, {
        asOf,
        sportMarketOverride: mockSportMarket({
          momentumScore: 85,
          outlookScore: 82,
          forecast3mPct: 12,
        }),
      })
    );

    const bear = computeInvestmentProfile(
      buildCardInvestmentContextSync(asset, sales, {
        asOf,
        sportMarketOverride: mockSportMarket({
          momentumScore: 25,
          outlookScore: 30,
          forecast3mPct: -8,
        }),
      })
    );

    expect(bull.demand.score).toBeGreaterThan(bear.demand.score);
    expect(bull.forecast.predictedChangePct!).toBeGreaterThan(
      bear.forecast.predictedChangePct!
    );
  });

  it("enforces no look-ahead in backtesting types", () => {
    expect(() =>
      assertNoLookAhead("2026-01-01T00:00:00Z", "2026-06-01T00:00:00Z")
    ).toThrow(/Look-ahead violation/);

    expect(() =>
      assertNoLookAhead("2026-08-01T00:00:00Z", "2026-01-01T00:00:00Z")
    ).not.toThrow();
  });

  it("keeps explainability traceable without invented facts", () => {
    const asset = baseAsset();
    const sales = [sale(3, 220), sale(10, 210), sale(20, 205)];
    const profile = computeInvestmentProfile(
      buildCardInvestmentContextSync(asset, sales, {
        asOf,
        sportMarketOverride: mockSportMarket(),
      })
    );

    const explanationInput = {
      valuation: profile.valuation,
      playerLegacy: profile.playerLegacy,
      scarcity: profile.scarcity,
      demand: profile.demand,
      risk: profile.risk,
      seasonality: profile.seasonality,
      forecast: profile.forecast,
      recommendation: profile.recommendation,
    };

    const explanation = computeInvestmentExplanation(explanationInput);
    const allowedKeys = collectEvidenceKeys(explanationInput);

    expect(validateExplanationTraceability(explanation, allowedKeys)).toBe(true);
    expect(explanation.claims.every((claim) => claim.sourceModel.length > 0)).toBe(
      true
    );
    expect(explanation.claims.some((claim) => claim.claim.includes("$"))).toBe(
      true
    );
  });
});

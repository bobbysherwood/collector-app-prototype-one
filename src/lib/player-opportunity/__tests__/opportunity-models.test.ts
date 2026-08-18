import { describe, expect, it } from "vitest";
import { buildCardInvestmentContextSync } from "@/lib/card-investment/build-card-context";
import { sportMarketSnapshotFromResult } from "@/lib/card-investment/market/sport-market-client";
import { computeMispricing } from "@/lib/player-card-opportunity/mispricing";
import { computePlayerCardOpportunity } from "@/lib/player-card-opportunity/player-card-opportunity-model";
import { buildPlayerOpportunityContextSync } from "@/lib/player-opportunity/build-player-context";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import type { Asset } from "@/types/asset";
import type { MarketSale } from "@/types/market-sales";
import type { SportMarketIndexResult } from "@/types/market-index";

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "card-1",
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

function sale(price: number): MarketSale {
  return {
    id: `sale-${price}`,
    source: "ebay",
    title: "Test",
    grader: "PSA",
    grade: "10",
    sale_price: price,
    hammer_price: null,
    buyers_premium_pct: null,
    currency: "USD",
    sale_date: "2026-08-01",
    sale_type: "auction",
    listing_url: "https://example.com",
    match_confidence: "high",
  };
}

function bullMarket() {
  const result: SportMarketIndexResult = {
    sportId: "nba",
    sportName: "NBA",
    healthScore: 72,
    momentumScore: 68,
    outlookScore: 70,
    forecast3mPct: 6,
    forecast6mPct: 8,
    forecast12mPct: 10,
    confidenceScore: 75,
    riskRating: "medium",
    positiveDrivers: [],
    negativeDrivers: [],
    explanation: "Bull",
    modelVersion: "sport-index-v1.0.0",
    seasonPhase: "playoffs",
    asOf: "2026-08-08T10:00:00Z",
  };
  return sportMarketSnapshotFromResult(result)!;
}

describe("Player Opportunity Model", () => {
  it("scores rising prospect with bullish sport market", () => {
    const ctx = buildPlayerOpportunityContextSync(asset(), {
      sportMarketOverride: bullMarket(),
      demandSignals: {
        attentionScore: 70,
        sentimentScore: 65,
        searchInterestScore: 72,
        discussionGrowthScore: 68,
        sourceCount: 4,
      },
    });

    const result = computePlayerOpportunity(ctx);
    expect(result.opportunityScore).toBeGreaterThan(55);
    expect(result.positiveDrivers.length).toBeGreaterThan(0);
    expect(result.summary).toContain("Player Opportunity");
  });

  it("reduces confidence when external inputs are missing", () => {
    const ctx = buildPlayerOpportunityContextSync(asset(), {
      sportMarketOverride: null,
    });
    const result = computePlayerOpportunity(ctx);
    expect(result.confidenceScore).toBeLessThan(75);
  });
});

describe("Player/Card Opportunity Model", () => {
  it("does not equate high player score with high card score when overpriced", () => {
    const cardAsset = asset({ player_name: "Victor Wembanyama" });
    const sales = [sale(500), sale(480), sale(510), sale(495), sale(505)];

    const cardContext = buildCardInvestmentContextSync(cardAsset, sales, {
      sportMarketOverride: bullMarket(),
    });

    const playerContext = buildPlayerOpportunityContextSync(cardAsset, {
      sportMarketOverride: bullMarket(),
      demandSignals: {
        attentionScore: 75,
        sentimentScore: 70,
        searchInterestScore: 72,
        discussionGrowthScore: 68,
        sourceCount: 4,
      },
    });

    const playerOpp = computePlayerOpportunity(playerContext, cardContext);
    expect(playerOpp.opportunityScore).toBeGreaterThan(60);

    const overpricedSales = [sale(650), sale(640), sale(660), sale(645), sale(655)];
    const overpricedContext = buildCardInvestmentContextSync(cardAsset, overpricedSales, {
      sportMarketOverride: bullMarket(),
    });

    const cardOpp = computePlayerCardOpportunity({
      cardContext: overpricedContext,
      playerContext,
      playerOpportunity: playerOpp,
    });

    expect(cardOpp.playerOpportunityScore).toBeGreaterThan(60);
    expect(cardOpp.opportunityScore).toBeLessThan(playerOpp.opportunityScore);
    expect(cardOpp.negativeDrivers.some((d) => /over/i.test(d) || /above/i.test(d))).toBe(true);
  });

  it("rewards underpriced card with strong player outlook", () => {
    const cardAsset = asset();
    const fairSales = [sale(400), sale(410), sale(395), sale(405), sale(400)];
    const underpricedSales = [sale(320), sale(330), sale(325), sale(315), sale(328)];

    const playerContext = buildPlayerOpportunityContextSync(cardAsset, {
      sportMarketOverride: bullMarket(),
      demandSignals: {
        attentionScore: 72,
        sentimentScore: 68,
        searchInterestScore: 70,
        discussionGrowthScore: 66,
        sourceCount: 3,
      },
    });

    const fairContext = buildCardInvestmentContextSync(cardAsset, fairSales, {
      sportMarketOverride: bullMarket(),
    });
    const underContext = buildCardInvestmentContextSync(cardAsset, underpricedSales, {
      sportMarketOverride: bullMarket(),
    });

    const playerOpp = computePlayerOpportunity(playerContext, fairContext);

    const fairCard = computePlayerCardOpportunity({
      cardContext: fairContext,
      playerContext,
      playerOpportunity: playerOpp,
    });
    const underCard = computePlayerCardOpportunity({
      cardContext: underContext,
      playerContext,
      playerOpportunity: playerOpp,
    });

    expect(underCard.valuationScore).toBeGreaterThan(fairCard.valuationScore);
    expect(underCard.opportunityScore).toBeGreaterThanOrEqual(fairCard.opportunityScore);
  });
});

describe("Mispricing", () => {
  it("computes margin of safety and valuation score", () => {
    const m = computeMispricing(860, 1000);
    expect(m.priceToFairValueRatio).toBe(0.86);
    expect(m.marginOfSafety).toBe(14);
    expect(m.valuationScore).toBeGreaterThan(100 - 20);
    expect(m.isUnderpriced).toBe(true);
  });
});

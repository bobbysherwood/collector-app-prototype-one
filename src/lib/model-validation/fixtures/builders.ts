import { sportMarketSnapshotFromResult } from "@/lib/card-investment/market/sport-market-client";
import { VALIDATION_AS_OF } from "@/lib/model-validation/config";
import type { Asset } from "@/types/asset";
import type { SportMarketSnapshot } from "@/types/card-investment";
import type { MarketSale } from "@/types/market-sales";
import type { SportMarketIndexResult } from "@/types/market-index";
import type {
  OpportunityCatalyst,
  PlayerDemandSignals,
  PlayerQualitySignals,
} from "@/types/player-opportunity";

export function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-validation-1",
    user_id: "user-validation",
    player_name: "Jayson Tatum",
    year: 2017,
    card_type: "Panini Prizm Base",
    sport: "Basketball",
    card_number: "16",
    insert_parallel: null,
    image_path: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makeSale(
  price: number,
  daysBeforeAsOf: number,
  asOf = VALIDATION_AS_OF,
  idSuffix = ""
): MarketSale {
  const date = new Date(asOf);
  date.setUTCDate(date.getUTCDate() - daysBeforeAsOf);
  return {
    id: `sale-${price}-${daysBeforeAsOf}${idSuffix}`,
    source: "ebay",
    title: "Validation sale",
    grader: "PSA",
    grade: "10",
    sale_price: price,
    hammer_price: null,
    buyers_premium_pct: null,
    currency: "USD",
    sale_date: date.toISOString().slice(0, 10),
    sale_type: "auction",
    listing_url: "https://example.com/sale",
    match_confidence: "high",
  };
}

export function makeSalesAround(
  currentPrice: number,
  fairPrice: number,
  count = 6,
  asOf = VALIDATION_AS_OF
): MarketSale[] {
  const comps = Array.from({ length: Math.max(count - 1, 0) }, (_, index) => {
    const wobble = ((index % 3) - 1) * Math.round(fairPrice * 0.01);
    return makeSale(fairPrice + wobble, 10 + index * 6, asOf, `-comp-${index}`);
  });
  return [makeSale(currentPrice, 1, asOf, "-current"), ...comps];
}

export function makeQuality(
  overrides: Partial<PlayerQualitySignals> = {}
): PlayerQualitySignals {
  return {
    careerStrength: 70,
    legacyStrength: 65,
    culturalRelevance: 68,
    injuryRisk: 15,
    availableFieldCount: 4,
    provenanceNotes: ["Synthetic validation fixture"],
    ...overrides,
  };
}

export function makeDemand(
  overrides: Partial<PlayerDemandSignals> = {}
): PlayerDemandSignals {
  return {
    attentionScore: 55,
    sentimentScore: 55,
    searchInterestScore: 55,
    discussionGrowthScore: 55,
    sourceCount: 4,
    provenanceNotes: ["Synthetic validation fixture"],
    ...overrides,
  };
}

export function makeCatalyst(
  overrides: Partial<OpportunityCatalyst> = {}
): OpportunityCatalyst {
  return {
    id: "validation-catalyst",
    label: "Validation catalyst",
    type: "performance",
    direction: "positive",
    expectedImpact: "positive",
    expectedMagnitude: 6,
    expectedDurationDays: 30,
    windowDays: 30,
    confidence: "medium",
    ...overrides,
  };
}

export function makeSportMarket(
  overrides: Partial<SportMarketIndexResult> = {}
): SportMarketSnapshot {
  const result: SportMarketIndexResult = {
    sportId: "nba",
    sportName: "NBA Basketball",
    healthScore: 55,
    momentumScore: 52,
    outlookScore: 54,
    forecast3mPct: 2,
    forecast6mPct: 3,
    forecast12mPct: 4,
    confidenceScore: 70,
    riskRating: "medium",
    positiveDrivers: [],
    negativeDrivers: [],
    explanation: "Synthetic market",
    modelVersion: "sport-index-v1.0.0",
    seasonPhase: "regular",
    asOf: VALIDATION_AS_OF,
    ...overrides,
  };
  return sportMarketSnapshotFromResult(result)!;
}

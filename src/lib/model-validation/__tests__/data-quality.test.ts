import { describe, expect, it } from "vitest";
import { buildCardInvestmentContextSync } from "@/lib/card-investment/build-card-context";
import { computeCardValuation } from "@/lib/card-investment/valuation/card-valuation-model";
import { resolveWeightProfile } from "@/lib/card-investment/weights/profiles";
import { VALIDATION_AS_OF } from "@/lib/model-validation/config";
import { makeAsset, makeSale } from "@/lib/model-validation/fixtures/builders";
import { markets } from "@/lib/model-validation/fixtures/markets";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { cloneContext, scorePlayer } from "@/lib/model-validation/helpers";
import { computePlayerCardOpportunity } from "@/lib/player-card-opportunity/player-card-opportunity-model";
import { buildPlayerOpportunityContextSync } from "@/lib/player-opportunity/build-player-context";

function scoreFromSales(sales: ReturnType<typeof makeSale>[], asOf = VALIDATION_AS_OF) {
  const asset = makeAsset({ id: "dq-card", player_name: "Jayson Tatum", year: 2017 });
  const cardContext = buildCardInvestmentContextSync(asset, sales, {
    asOf,
    sportMarketOverride: markets.neutral,
  });
  const playerContext = buildPlayerOpportunityContextSync(asset, {
    asOf,
    sportMarketOverride: markets.neutral,
    qualitySignals: playerFixtures.establishedSuperstar().qualitySignals,
    demandSignals: playerFixtures.establishedSuperstar().demandSignals,
  });
  const opportunity = computePlayerCardOpportunity({ cardContext, playerContext });
  const weights = resolveWeightProfile({
    sport: cardContext.asset.sport,
    era: cardContext.classification.era,
    lifecycle: cardContext.classification.lifecycle,
    archetype: cardContext.classification.archetype,
  });
  return { opportunity, valuation: computeCardValuation(cardContext, weights) };
}

describe("Data quality", () => {
  it("does not fabricate a price when there are no sales", () => {
    const { opportunity, valuation } = scoreFromSales([]);
    expect(valuation.fairValue).toBeNull();
    expect(opportunity.confidenceScore).toBeLessThan(50);
    expect(opportunity.fairMarketValue).toBe(0);
  });

  it("treats a single sale as low-confidence and high-uncertainty", () => {
    const { opportunity, valuation } = scoreFromSales([makeSale(1000, 3)]);
    expect(valuation.compCount).toBe(1);
    expect(opportunity.confidenceScore).toBeLessThan(70);
  });

  it("does not let one outlier rewrite fair value when enough comps exist", () => {
    const sales = [
      makeSale(1000, 2),
      makeSale(980, 6),
      makeSale(1020, 10),
      makeSale(1010, 14),
      makeSale(990, 18),
      makeSale(10000, 4),
    ];
    const { valuation } = scoreFromSales(sales);
    expect(valuation.outliersRejected).toBeGreaterThan(0);
    expect(valuation.fairValue).not.toBeNull();
    expect(valuation.fairValue!).toBeLessThan(2000);
    expect(valuation.fairValue!).toBeGreaterThan(800);
  });

  it("increases uncertainty for conflicting or stale sales", () => {
    const conflicting = scoreFromSales([
      makeSale(400, 2),
      makeSale(1600, 5),
      makeSale(450, 8),
      makeSale(1550, 11),
    ]);
    const fresh = scoreFromSales([
      makeSale(1000, 2),
      makeSale(1010, 4),
      makeSale(990, 6),
      makeSale(1005, 8),
    ]);
    const stale = scoreFromSales(
      [makeSale(1000, 2, "2025-01-15T12:00:00Z"), makeSale(1010, 8, "2025-01-15T12:00:00Z")],
      VALIDATION_AS_OF
    );
    expect(conflicting.opportunity.confidenceScore).toBeLessThanOrEqual(fresh.opportunity.confidenceScore + 5);
    expect(stale.opportunity.confidenceScore).toBeLessThan(fresh.opportunity.confidenceScore);
  });

  it("missing sentiment does not invent a bullish demand score", () => {
    const missing = cloneContext(playerFixtures.establishedSuperstar());
    missing.demandSignals = {
      attentionScore: null,
      sentimentScore: null,
      searchInterestScore: null,
      discussionGrowthScore: null,
      sourceCount: 0,
      provenanceNotes: ["missing"],
    };
    const scored = scorePlayer(missing);
    expect(scored.demandScore).toBe(50);
    expect(scored.confidenceScore).toBeLessThan(
      scorePlayer(playerFixtures.establishedSuperstar()).confidenceScore
    );
  });

  it("missing player statistics fall back without fabricating elite quality", () => {
    const missing = cloneContext(playerFixtures.averageVeteran());
    missing.qualitySignals = {
      careerStrength: null,
      legacyStrength: null,
      culturalRelevance: null,
      injuryRisk: null,
      availableFieldCount: 0,
    };
    const scored = scorePlayer(missing);
    expect(scored.qualityScore).toBeLessThanOrEqual(55);
    expect(scored.confidenceScore).toBeLessThan(
      scorePlayer(playerFixtures.averageVeteran()).confidenceScore
    );
  });
});

describe("Boundary values", () => {
  it("keeps scores finite and inside 0–100 for extreme inputs", () => {
    const extremePlayer = cloneContext(playerFixtures.establishedSuperstar());
    extremePlayer.qualitySignals = {
      careerStrength: 1000,
      legacyStrength: -40,
      culturalRelevance: 0,
      injuryRisk: 400,
      availableFieldCount: 4,
    };
    extremePlayer.demandSignals = {
      attentionScore: 1000,
      sentimentScore: -20,
      searchInterestScore: 0,
      discussionGrowthScore: 500,
      sourceCount: 4,
    };
    const player = scorePlayer(extremePlayer);
    for (const score of [
      player.opportunityScore,
      player.qualityScore,
      player.riskScore,
      player.confidenceScore,
      player.demandScore,
    ]) {
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }

    const zeroPrice = scoreFromSales([makeSale(0, 1), makeSale(0, 5), makeSale(0, 9)]);
    expect(zeroPrice.opportunity.currentMarketValue).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(zeroPrice.opportunity.opportunityScore)).toBe(true);
    expect(["strong_buy", "buy", "hold", "sell", "strong_sell"]).toContain(
      zeroPrice.opportunity.recommendation
    );

    const huge = scoreFromSales([makeSale(1e9, 1)]);
    expect(Number.isFinite(huge.opportunity.opportunityScore)).toBe(true);
    expect(huge.opportunity.opportunityScore).toBeLessThanOrEqual(100);
  });
});

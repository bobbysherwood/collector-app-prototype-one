import { describe, expect, it } from "vitest";
import { inspectMispricing } from "@/lib/model-validation/diagnostics";
import { cardFixtures } from "@/lib/model-validation/fixtures/cards";
import { scoreCard, scoreCardWithPlayer, scorePlayer } from "@/lib/model-validation/helpers";
import { runScenarioCases } from "@/lib/model-validation/run-suite";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import { recommendationFromScore } from "@/lib/player-opportunity/weights/profiles";
import { testConfig } from "@/lib/model-validation/config";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { cloneContext } from "@/lib/model-validation/helpers";

describe("Player/Card Opportunity", () => {
  it("passes data-driven card scenario expectations", () => {
    const failures = runScenarioCases().filter(
      (item) => item.group === "card_opportunity" && item.status === "fail"
    );
    expect(failures, failures.map((item) => `${item.name}: ${item.why}`).join("\n")).toEqual([]);
  });

  it("does not treat a strong player as an automatic buy on every card", () => {
    const fair = scoreCard(cardFixtures.fairlyValued());
    const overpriced = scoreCard(cardFixtures.overpriced());
    const undervalued = scoreCard(cardFixtures.undervalued());

    expect(fair.playerOpportunityScore).toBeGreaterThan(55);
    expect(overpriced.playerOpportunityScore).toBe(fair.playerOpportunityScore);
    expect(overpriced.opportunityScore).toBeLessThan(fair.opportunityScore);
    expect(overpriced.opportunityScore).toBeLessThan(overpriced.playerOpportunityScore);
    expect(["hold", "sell", "strong_sell"]).toContain(overpriced.recommendation);
    expect(undervalued.opportunityScore).toBeGreaterThan(overpriced.opportunityScore);
  });

  it("low liquidity reduces opportunity versus the same undervalued card", () => {
    const liquid = scoreCard(cardFixtures.undervalued());
    const thin = scoreCard(cardFixtures.lowLiquidity());
    expect(thin.liquidityScore).toBeLessThan(liquid.liquidityScore);
    expect(thin.opportunityScore).toBeLessThanOrEqual(liquid.opportunityScore);
    expect(thin.confidenceScore).toBeLessThanOrEqual(liquid.confidenceScore);
  });

  it("high population / unnumbered cards score lower scarcity than numbered parallels", () => {
    const common = scoreCard(cardFixtures.highPopulation());
    const scarce = scoreCard(cardFixtures.scarceNumbered());
    expect(common.scarcityScore).toBeLessThan(scarce.scarcityScore);
  });
});

describe("Mispricing", () => {
  it.each([
    [0.6, "strongly_positive"],
    [0.8, "positive"],
    [1.0, "neutral"],
    [1.2, "negative"],
    [1.5, "strongly_negative"],
  ] as const)("price/fair value %s produces a %s valuation signal", (ratio, signal) => {
    const metrics = inspectMispricing(1000 * ratio, 1000);
    if (signal === "strongly_positive") expect(metrics.valuationScore).toBeGreaterThanOrEqual(80);
    if (signal === "positive") expect(metrics.valuationScore).toBeGreaterThan(55);
    if (signal === "neutral") expect(metrics.valuationScore).toBeGreaterThanOrEqual(45);
    if (signal === "neutral") expect(metrics.valuationScore).toBeLessThanOrEqual(55);
    if (signal === "negative") expect(metrics.valuationScore).toBeLessThan(45);
    if (signal === "strongly_negative") expect(metrics.valuationScore).toBeLessThanOrEqual(20);
    expect(metrics.isUnderpriced).toBe(ratio < 0.97);
    expect(metrics.isOverpriced).toBe(ratio > 1.03);
  });

  it("excludes the latest print from fair value so a spike cannot inflate FMV", () => {
    const overpriced = scoreCard(cardFixtures.overpriced());
    expect(overpriced.currentMarketValue).toBe(2000);
    expect(overpriced.fairMarketValue).toBeLessThan(1200);
    expect(overpriced.fairMarketValue).toBeGreaterThan(900);
    expect(overpriced.expectedReturn90d).toBeLessThan(0);
  });

  it("ties expected 90-day return to mispricing rather than copying player outlook", () => {
    const under = scoreCard(cardFixtures.undervalued());
    const over = scoreCard(cardFixtures.overpriced());
    expect(under.expectedReturn90d).toBeGreaterThan(over.expectedReturn90d);
    expect(under.expectedReturn90d).toBeGreaterThan(0);
  });

  it("valuation is a primary differentiator across the same player", () => {
    const fair = scoreCard(cardFixtures.fairlyValued());
    const overpriced = scoreCard(cardFixtures.overpriced());
    const undervalued = scoreCard(cardFixtures.undervalued());
    expect(undervalued.valuationScore - overpriced.valuationScore).toBeGreaterThan(20);
    expect(undervalued.opportunityScore).toBeGreaterThan(fair.opportunityScore);
    expect(fair.opportunityScore).toBeGreaterThan(overpriced.opportunityScore);
  });
});

describe("Player/card interaction matrix", () => {
  function withPlayerScore(base: ReturnType<typeof cardFixtures.undervalued>, score: number) {
    const fixture = cloneContext(base);
    const player = computePlayerOpportunity(fixture.playerContext, fixture.cardContext);
    return scoreCardWithPlayer(fixture, { ...player, opportunityScore: score });
  }

  it("combines player outlook with card valuation instead of copying either", () => {
    const attractive = cardFixtures.undervalued();
    const fair = cardFixtures.fairlyValued();
    const overpriced = cardFixtures.overpriced();

    const highAttractive = withPlayerScore(attractive, 85);
    const highFair = withPlayerScore(fair, 85);
    const highOver = withPlayerScore(overpriced, 85);
    const moderateCheap = withPlayerScore(attractive, 55);
    const lowAttractive = withPlayerScore(attractive, 35);
    const lowOver = withPlayerScore(overpriced, 35);
    const veryLowCheap = withPlayerScore(attractive, 20);

    expect(highAttractive.opportunityScore).toBeGreaterThan(highFair.opportunityScore);
    expect(highFair.opportunityScore).toBeGreaterThan(highOver.opportunityScore);
    expect(moderateCheap.opportunityScore).toBeGreaterThan(lowOver.opportunityScore);
    expect(lowAttractive.opportunityScore).toBeLessThan(highAttractive.opportunityScore);
    expect(lowOver.opportunityScore).toBeLessThan(50);
    expect(veryLowCheap.confidenceScore).toBeLessThanOrEqual(highAttractive.confidenceScore);
  });
});

describe("Recommendation thresholds", () => {
  const t = testConfig.recommendationThresholds;

  it.each([
    [t.strongBuy - 1, "buy"],
    [t.strongBuy, "strong_buy"],
    [t.strongBuy + 1, "strong_buy"],
    [t.buy - 1, "hold"],
    [t.buy, "buy"],
    [t.hold - 1, "sell"],
    [t.hold, "hold"],
    [t.sell - 1, "strong_sell"],
    [t.sell, "sell"],
  ] as const)("score %s maps to %s", (score, recommendation) => {
    expect(recommendationFromScore(score)).toBe(recommendation);
  });

  it("card recommendations stay inside the official enum", () => {
    const recs = [
      scoreCard(cardFixtures.fairlyValued()).recommendation,
      scoreCard(cardFixtures.overpriced()).recommendation,
      scoreCard(cardFixtures.undervalued()).recommendation,
    ];
    for (const rec of recs) {
      expect(["strong_buy", "buy", "hold", "sell", "strong_sell"]).toContain(rec);
    }
  });

  it("a strong player score is still constrained when the card is badly overpriced", () => {
    const player = scorePlayer(playerFixtures.establishedSuperstar());
    const overpriced = scoreCard(cardFixtures.overpriced());
    expect(player.opportunityScore).toBeGreaterThan(55);
    expect(["strong_buy"]).not.toContain(overpriced.recommendation);
  });
});

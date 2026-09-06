import { describe, expect, it } from "vitest";
import { cardFixtures, cardWithMarket } from "@/lib/model-validation/fixtures/cards";
import { markets } from "@/lib/model-validation/fixtures/markets";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { cloneContext, scoreCard, scorePlayer } from "@/lib/model-validation/helpers";

describe("Sport market regimes", () => {
  it("bull / neutral / bear markets move player opportunity in the expected direction", () => {
    const base = playerFixtures.establishedSuperstar();
    const bull = cloneContext(base);
    const bear = cloneContext(base);
    bull.sportMarket = markets.bull;
    bear.sportMarket = markets.bear;
    expect(markets.bull.healthScore).toBe(85);
    expect(markets.neutral.healthScore).toBe(50);
    expect(markets.bear.healthScore).toBe(25);
    expect(scorePlayer(bull).opportunityScore).toBeGreaterThan(scorePlayer(base).opportunityScore);
    expect(scorePlayer(bear).opportunityScore).toBeLessThan(scorePlayer(base).opportunityScore);
  });

  it("does not force every undervalued card to Sell in a bear market", () => {
    const bearCheap = scoreCard(cardWithMarket(cardFixtures.undervalued(), markets.bear));
    expect(["sell", "strong_sell"]).not.toContain(bearCheap.recommendation);
    expect(bearCheap.valuationScore).toBeGreaterThan(60);
  });

  it("bear market lowers opportunity without erasing card-level undervaluation", () => {
    const bullCheap = scoreCard(cardWithMarket(cardFixtures.undervalued(), markets.bull));
    const bearCheap = scoreCard(cardWithMarket(cardFixtures.undervalued(), markets.bear));
    const bearRich = scoreCard(cardWithMarket(cardFixtures.overpriced(), markets.bear));
    expect(bearCheap.opportunityScore).toBeLessThanOrEqual(bullCheap.opportunityScore);
    expect(bearCheap.opportunityScore).toBeGreaterThan(bearRich.opportunityScore);
  });
});

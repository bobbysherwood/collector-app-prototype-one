import { describe, expect, it } from "vitest";
import { inspectCard, inspectPlayer } from "@/lib/model-validation/helpers";
import { cardFixtures } from "@/lib/model-validation/fixtures/cards";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { cloneContext } from "@/lib/model-validation/helpers";

describe("Explainability", () => {
  it("positive demand produces a demand driver and does not invent injury language", () => {
    const young = inspectPlayer(playerFixtures.youngSuperstar());
    expect(young.result.positiveDrivers.some((line) => /demand/i.test(line))).toBe(true);
    expect(young.result.negativeDrivers.join(" ")).not.toMatch(/injury/i);
    expect(young.result.summary).toContain(String(young.result.opportunityScore));
    expect(Object.values(young.weightedContributions).every((value) => Number.isFinite(value))).toBe(
      true
    );
  });

  it("overvaluation explanations match the valuation contribution", () => {
    const over = inspectCard(cardFixtures.overpriced());
    expect(over.result.priceToFairValueRatio).toBeGreaterThan(1.2);
    expect(over.result.negativeDrivers.some((line) => /above|over|expensive|valuation/i.test(line))).toBe(true);
    expect(over.result.summary).toMatch(/Price\/FMV|over|above/i);
    expect(over.components.valuation).toBeLessThan(40);
  });

  it("undervaluation explanations match a positive valuation contribution", () => {
    const under = inspectCard(cardFixtures.undervalued());
    expect(under.result.positiveDrivers.some((line) => /below/i.test(line))).toBe(true);
    expect(under.components.valuation).toBeGreaterThan(under.components.valuation ? 50 : 0);
    expect(under.weightedContributions.valuation).toBeGreaterThan(
      inspectCard(cardFixtures.overpriced()).weightedContributions.valuation
    );
  });

  it("scarcity explanations track numbered vs common cards", () => {
    const scarce = inspectCard(cardFixtures.scarceNumbered());
    const common = inspectCard(cardFixtures.highPopulation());
    expect(scarce.components.scarcity).toBeGreaterThan(common.components.scarcity);
    if (scarce.result.scarcityScore >= 65) {
      expect(scarce.result.positiveDrivers.some((line) => /scarcity/i.test(line))).toBe(true);
    }
    expect(common.result.positiveDrivers.join(" ")).not.toMatch(/Numbered to 10/);
  });

  it("does not claim a missing sentiment input drove the score", () => {
    const missing = cloneContext(playerFixtures.averageVeteran());
    missing.demandSignals = {
      attentionScore: null,
      sentimentScore: null,
      searchInterestScore: null,
      discussionGrowthScore: null,
      sourceCount: 0,
    };
    const scored = inspectPlayer(missing);
    expect(scored.result.positiveDrivers.join(" ")).not.toMatch(/sentiment/i);
    expect(scored.result.demandScore).toBe(50);
  });

  it("weighted contributions sum to approximately the pre-clamp composite scale", () => {
    const card = inspectCard(cardFixtures.fairlyValued());
    const total = Object.values(card.weightedContributions).reduce((sum, value) => sum + value, 0);
    expect(total).toBeGreaterThan(20);
    expect(total).toBeLessThan(120);
  });
});

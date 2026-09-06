import { describe, expect, it } from "vitest";
import {
  buildRankingUniverse,
  kendallTau,
  rankByOpportunity,
  spearmanCorrelation,
  topOverlap,
} from "@/lib/model-validation/engine/ranking";

describe("Ranking", () => {
  const universe = buildRankingUniverse();
  const ranked = rankByOpportunity(universe);

  it("scores a synthetic universe of at least 50 cards", () => {
    expect(universe.length).toBeGreaterThanOrEqual(50);
    expect(ranked[0].opportunity.opportunityScore).toBeGreaterThanOrEqual(
      ranked[ranked.length - 1].opportunity.opportunityScore
    );
  });

  it("does not put extremely overpriced cards at the top solely because of player popularity", () => {
    const top10 = ranked.slice(0, 10);
    expect(top10.filter((card) => card.valuation === "extreme_overpriced").length).toBeLessThanOrEqual(2);

    const cheapStars = universe.filter(
      (card) => card.playerTier === "star" && card.valuation === "undervalued"
    );
    for (const cheap of cheapStars) {
      const richTwin = universe.find(
        (card) =>
          card.playerTier === cheap.playerTier &&
          card.scarcity === cheap.scarcity &&
          card.label.split(" ").slice(0, 2).join(" ") === cheap.label.split(" ").slice(0, 2).join(" ") &&
          card.valuation === "extreme_overpriced"
      );
      if (richTwin) {
        expect(cheap.opportunity.opportunityScore).toBeGreaterThan(richTwin.opportunity.opportunityScore);
      }
    }
    expect(cheapStars.some((card) => top10.some((top) => top.id === card.id))).toBe(true);
  });

  it("generally ranks stronger fundamentals above weaker ones", () => {
    const median = (tier: (typeof universe)[number]["playerTier"]) => {
      const scores = universe
        .filter((card) => card.playerTier === tier && card.valuation === "fair")
        .map((card) => card.opportunity.opportunityScore)
        .sort((a, b) => a - b);
      return scores[Math.floor(scores.length / 2)] ?? 0;
    };
    expect(median("star")).toBeGreaterThan(median("weak"));
  });

  it("is stable when the universe is rebuilt from the same fixtures", () => {
    const reranked = rankByOpportunity(buildRankingUniverse());
    const original = ranked.map((card) => card.id);
    const next = reranked.map((card) => card.id);
    expect(topOverlap(original, next, 10)).toBe(1);
    expect(topOverlap(original, next, 20)).toBe(1);
    expect(
      spearmanCorrelation(
        ranked.map((card) => card.opportunity.opportunityScore),
        reranked.map((card) => card.opportunity.opportunityScore)
      )
    ).toBe(1);
  });

  it("small score noise does not invert the ranking", () => {
    const scores = ranked.map((card) => card.opportunity.opportunityScore);
    const nudged = scores.map((score, index) => score + (index % 2 === 0 ? 0.4 : -0.4));
    expect(kendallTau(scores, nudged)).toBeGreaterThan(0.8);
  });
});

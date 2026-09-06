import { describe, expect, it } from "vitest";
import { inspectCard, inspectPlayer } from "@/lib/model-validation/helpers";
import { cardFixtures } from "@/lib/model-validation/fixtures/cards";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";

describe("Score contribution diagnostics", () => {
  it("exposes player component scores and weighted contributions", () => {
    const diag = inspectPlayer(playerFixtures.youngSuperstar());
    expect(diag.result.opportunityScore).toBeGreaterThan(0);
    expect(diag.components.quality).toBeGreaterThan(0);
    expect(diag.components.futureOutlook).toBeGreaterThan(0);
    expect(diag.weightedContributions.quality).toBeGreaterThan(0);
    expect(diag.weightedContributions.demand).toBeGreaterThan(0);
  });

  it("exposes card component scores using the implementation weights", () => {
    const diag = inspectCard(cardFixtures.undervalued());
    expect(diag.components.playerOpportunity).toBe(diag.result.playerOpportunityScore);
    expect(diag.components.valuation).toBe(diag.result.valuationScore);
    expect(diag.components.scarcity).toBe(diag.result.scarcityScore);
    expect(diag.weightedContributions.valuation).toBeGreaterThan(0);
    expect(diag.weightedContributions.playerOpportunity).toBeGreaterThan(0);
  });
});

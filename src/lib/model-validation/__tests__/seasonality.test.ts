import { describe, expect, it } from "vitest";
import { computeSeasonalityForecast } from "@/lib/card-investment/seasonality/card-seasonality-model";
import { resolveWeightProfile } from "@/lib/card-investment/weights/profiles";
import { classifyCardEra } from "@/lib/card-investment/classification/card-era";
import { cardFixtures, cardWithPhase } from "@/lib/model-validation/fixtures/cards";
import { scoreCard } from "@/lib/model-validation/helpers";
import { VALIDATION_AS_OF } from "@/lib/model-validation/config";

function seasonality(phase: string) {
  const fixture = cardWithPhase(cardFixtures.fairlyValued(), phase);
  const weights = resolveWeightProfile({
    sport: fixture.cardContext.asset.sport,
    era: fixture.cardContext.classification.era,
    lifecycle: fixture.cardContext.classification.lifecycle,
    archetype: fixture.cardContext.classification.archetype,
  });
  return {
    fixture,
    forecast: computeSeasonalityForecast(fixture.cardContext, weights),
    opportunity: scoreCard(fixture),
  };
}

describe("Seasonality", () => {
  it("maps calendar-like NBA states onto seasonPhase rather than month numbers", () => {
    const offseason = seasonality("offseason");
    const regular = seasonality("regular");
    const playoffs = seasonality("playoffs");
    const draft = seasonality("draft");

    expect(offseason.forecast.phase).toBe("offseason");
    expect(regular.forecast.phase).toBe("regular");
    expect(playoffs.forecast.seasonalityScore).toBeGreaterThan(offseason.forecast.seasonalityScore);
    expect(playoffs.forecast.catalysts.some((c) => /playoff/i.test(c.label))).toBe(true);
    expect(draft.forecast.catalysts.some((c) => /draft/i.test(c.label))).toBe(true);
  });

  it("treats playoffs / finals as an elevated seasonal catalyst versus offseason", () => {
    const august = seasonality("offseason");
    const playoffs = seasonality("playoffs");
    expect(playoffs.forecast.seasonalityScore).toBeGreaterThan(august.forecast.seasonalityScore);
    expect(playoffs.opportunity.catalysts.some((c) => /playoff/i.test(c.label))).toBe(true);
  });

  it("distinguishes seasonal effect from player-fundamental quality", () => {
    const offseason = seasonality("offseason");
    const playoffs = seasonality("playoffs");
    expect(offseason.opportunity.playerOpportunityScore).toBeGreaterThan(0);
    expect(playoffs.forecast.seasonalityScore).not.toBe(playoffs.opportunity.playerOpportunityScore);
  });
});

describe("Era-adjusted seasonality", () => {
  it("classifies requested eras with the current vintage/modern/ultra-modern taxonomy", () => {
    const asOfYear = new Date(VALIDATION_AS_OF).getFullYear();
    expect(classifyCardEra(1933, asOfYear)).toBe("pre_war");
    expect(classifyCardEra(1965, asOfYear)).toBe("vintage");
    expect(classifyCardEra(1989, asOfYear)).toBe("junk_wax");
    expect(classifyCardEra(1995, asOfYear)).toBe("early_modern");
    expect(classifyCardEra(2015, asOfYear)).toBe("modern");
    expect(classifyCardEra(2024, asOfYear)).toBe("ultra_modern");
  });

  it("applies higher seasonal sensitivity to modern and ultra-modern than vintage", () => {
    const asOfYear = new Date(VALIDATION_AS_OF).getFullYear();
    const sensitivity = (year: number) => {
      const era = classifyCardEra(year, asOfYear);
      const weights = resolveWeightProfile({
        sport: "Basketball",
        era,
        lifecycle: era === "vintage" ? "legacy" : "peak",
        archetype: "base",
      });
      return weights.seasonality.playoffs - weights.seasonality.offseason;
    };
    expect(sensitivity(1933)).toBeLessThan(sensitivity(1965));
    expect(sensitivity(1965)).toBeLessThan(sensitivity(1989));
    expect(sensitivity(1989)).toBeLessThan(sensitivity(2015));
    expect(sensitivity(2015)).toBeLessThan(sensitivity(2024));
  });
});

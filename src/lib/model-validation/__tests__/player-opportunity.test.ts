import { describe, expect, it } from "vitest";
import { classifyPlayerLifecycle } from "@/lib/card-investment/classification/player-lifecycle";
import { makeAsset } from "@/lib/model-validation/fixtures/builders";
import { playerFixtures } from "@/lib/model-validation/fixtures/players";
import { scorePlayer } from "@/lib/model-validation/helpers";
import { classifyPlayerOpportunityLifecycle } from "@/lib/player-opportunity/classification/lifecycle";
import { runScenarioCases } from "@/lib/model-validation/run-suite";
import { playerOpportunityScenarios } from "@/lib/model-validation/scenarios/playerOpportunityScenarios";

describe("Player Opportunity scenarios", () => {
  it("defines baseline scenarios A–J", () => {
    const ids = playerOpportunityScenarios.map((scenario) => scenario.id);
    expect(ids).toEqual(
      expect.arrayContaining(["A", "B", "C", "D", "E", "F-healthy", "F-injured", "G", "H", "I", "J"])
    );
  });

  it("passes data-driven scenario expectations", () => {
    const failures = runScenarioCases().filter(
      (item) => item.group === "player_opportunity" && item.status === "fail"
    );
    expect(failures, failures.map((item) => `${item.name}: ${item.why}`).join("\n")).toEqual([]);
  });

  it("young superstar outranks average veteran and aging star", () => {
    const young = scorePlayer(playerFixtures.youngSuperstar());
    const veteran = scorePlayer(playerFixtures.averageVeteran());
    const aging = scorePlayer(playerFixtures.agingSuperstar());
    expect(young.opportunityScore).toBeGreaterThan(veteran.opportunityScore);
    expect(young.opportunityScore).toBeGreaterThan(aging.opportunityScore);
    expect(["increasing", "strongly_increasing"]).toContain(young.trend);
  });

  it("established star has lower momentum than improving young superstar", () => {
    const young = scorePlayer(playerFixtures.youngSuperstar());
    const established = scorePlayer(playerFixtures.establishedSuperstar());
    expect(established.momentumScore).toBeLessThan(young.momentumScore);
    expect(established.opportunityScore).toBeLessThanOrEqual(young.opportunityScore);
  });

  it("breakout player has more uncertainty than the established star", () => {
    const breakout = scorePlayer(playerFixtures.breakoutYoung());
    const established = scorePlayer(playerFixtures.establishedSuperstar());
    expect(breakout.confidenceScore).toBeLessThan(established.confidenceScore);
    expect(breakout.opportunityScore).toBeGreaterThan(50);
  });

  it("does not let hype alone create an extremely high-confidence opportunity", () => {
    const hyped = scorePlayer(playerFixtures.hypedProspect());
    const established = scorePlayer(playerFixtures.establishedSuperstar());
    expect(hyped.demandScore).toBeGreaterThan(hyped.qualityScore);
    expect(hyped.opportunityScore).toBeLessThan(90);
    expect(hyped.confidenceScore).toBeLessThan(established.confidenceScore);
    expect(hyped.riskScore).toBeGreaterThan(40);
  });

  it("keeps legacy high for an aging star while opportunity falls", () => {
    const aging = scorePlayer(playerFixtures.agingSuperstar());
    const established = scorePlayer(playerFixtures.establishedSuperstar());
    expect(aging.qualityScore).toBeGreaterThan(55);
    expect(aging.opportunityScore).toBeLessThan(established.opportunityScore);
    expect(aging.riskScore).toBeGreaterThan(established.riskScore);
  });

  it("injury lowers score and raises risk without rewriting demand", () => {
    const healthy = scorePlayer(playerFixtures.healthySuperstar());
    const injured = scorePlayer(playerFixtures.injuredSuperstar());
    expect(injured.opportunityScore).toBeLessThan(healthy.opportunityScore);
    expect(injured.riskScore).toBeGreaterThan(healthy.riskScore);
    expect(Math.abs(injured.demandScore - healthy.demandScore)).toBeLessThanOrEqual(1);
    expect(injured.futureOutlookScore).toBeLessThan(healthy.futureOutlookScore);
  });

  it("retired and deceased icons are not penalized as missing active players", () => {
    const retired = scorePlayer(playerFixtures.retiredGreat());
    const deceased = scorePlayer(playerFixtures.deceasedIcon());
    const veteran = scorePlayer(playerFixtures.averageVeteran());
    expect(retired.lifecycle).toBe("retired");
    expect(deceased.lifecycle).toBe("deceased");
    expect(retired.qualityScore).toBeGreaterThan(80);
    expect(deceased.qualityScore).toBeGreaterThan(80);
    expect(retired.opportunityScore).toBeGreaterThan(veteran.opportunityScore);
    expect(deceased.opportunityScore).toBeGreaterThan(veteran.opportunityScore);
  });

  it("average veteran is not artificially bullish", () => {
    const veteran = scorePlayer(playerFixtures.averageVeteran());
    expect(veteran.opportunityScore).toBeLessThan(70);
    expect(veteran.trend).not.toBe("strongly_increasing");
  });

  it("classifies lifecycle from the asOf year, not the wall clock", () => {
    const rookie = makeAsset({
      player_name: "Anthony Edwards",
      year: 2024,
      card_type: "Panini Prizm Rookie",
    });
    expect(
      classifyPlayerOpportunityLifecycle(rookie, classifyPlayerLifecycle(rookie, 2024), 2024)
    ).toBe("prospect");
    expect(
      classifyPlayerOpportunityLifecycle(rookie, classifyPlayerLifecycle(rookie, 2030), 2030)
    ).not.toBe("prospect");
  });

  it("negative sentiment lowers demand and opportunity and adds a negative driver", () => {
    const base = scorePlayer(playerFixtures.averageVeteran());
    const negative = scorePlayer(playerFixtures.negativeSentiment());
    expect(negative.demandScore).toBeLessThan(base.demandScore);
    expect(negative.opportunityScore).toBeLessThan(base.opportunityScore);
    expect(negative.negativeDrivers.length).toBeGreaterThan(0);
  });
});

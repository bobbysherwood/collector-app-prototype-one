import { describe, expect, it } from "vitest";
import {
  estimatedDraftYear,
  rankPlayerComparables,
  scorePlayerComparable,
  teamsMatch,
  type ComparableProfile,
} from "@/lib/market-research/player-comparables";

function subject(overrides: Partial<ComparableProfile> = {}): ComparableProfile {
  return {
    playerId: "tatum-id",
    playerName: "Jayson Tatum",
    sport: "Basketball",
    birthYear: 1998,
    careerStatus: "active",
    team: "Boston Celtics",
    draftYear: 2017,
    opportunityScore: 72,
    ...overrides,
  };
}

function peer(overrides: Partial<ComparableProfile> = {}): ComparableProfile {
  return {
    playerId: "brown-id",
    playerName: "Jaylen Brown",
    sport: "Basketball",
    birthYear: 1996,
    careerStatus: "active",
    team: "Celtics",
    draftYear: 2016,
    opportunityScore: 68,
    cardCount: 40,
    ...overrides,
  };
}

describe("player comparables", () => {
  it("rejects a different sport", () => {
    expect(scorePlayerComparable(subject(), peer({ sport: "Football" }))).toBeNull();
  });

  it("rejects the same player id or name", () => {
    expect(scorePlayerComparable(subject(), peer({ playerId: "tatum-id" }))).toBeNull();
    expect(
      scorePlayerComparable(subject(), peer({ playerId: "other", playerName: "Jayson Tatum" }))
    ).toBeNull();
  });

  it("scores a same-team, same-era peer highly", () => {
    const scored = scorePlayerComparable(subject(), peer());
    expect(scored).not.toBeNull();
    expect(scored?.matchScore).toBeGreaterThanOrEqual(80);
    expect(scored?.reasons.map((reason) => reason.key)).toEqual(
      expect.arrayContaining(["career", "birth-year", "team", "draft", "opportunity"])
    );
  });

  it("matches team nicknames", () => {
    expect(teamsMatch("Boston Celtics", "Celtics")).toBe(true);
    expect(teamsMatch("Los Angeles Lakers", "the Lakers")).toBe(true);
    expect(teamsMatch("Boston Celtics", "Miami Heat")).toBe(false);
  });

  it("estimates draft year from birth year when needed", () => {
    expect(estimatedDraftYear({ draftYear: 2017, birthYear: 1998 })).toBe(2017);
    expect(estimatedDraftYear({ draftYear: null, birthYear: 1998 })).toBe(2020);
  });

  it("still returns a same-sport match when profile fields are missing", () => {
    const scored = scorePlayerComparable(
      subject({ birthYear: null, careerStatus: null, team: null, draftYear: null, opportunityScore: null }),
      peer({ birthYear: null, careerStatus: null, team: null, draftYear: null, opportunityScore: null })
    );
    expect(scored?.matchScore).toBeGreaterThanOrEqual(40);
    expect(scored?.reasons).toEqual([{ key: "sport", label: "Same sport" }]);
  });

  it("ranks closer peers ahead of weaker ones", () => {
    const ranked = rankPlayerComparables(subject(), [
      peer({
        playerId: "older-id",
        playerName: "Older Star",
        birthYear: 1984,
        team: "Miami Heat",
        draftYear: 2003,
        opportunityScore: 40,
        cardCount: 200,
      }),
      peer({ playerName: "Jaylen Brown", cardCount: 12 }),
    ]);

    expect(ranked[0]?.playerName).toBe("Jaylen Brown");
    expect(ranked[0]?.matchScore).toBeGreaterThan(ranked[1]?.matchScore ?? 0);
  });
});

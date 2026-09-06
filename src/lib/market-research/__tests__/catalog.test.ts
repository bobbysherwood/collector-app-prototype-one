import { describe, expect, it } from "vitest";
import {
  formatCatalogCardLoadError,
  sportBallImageUrl,
} from "@/lib/market-research/catalog";

describe("formatCatalogCardLoadError", () => {
  it("rewrites statement timeouts into a retry message", () => {
    expect(
      formatCatalogCardLoadError(
        "canceling statement due to statement timeout"
      )
    ).toBe(
      "The card catalog timed out loading this player's cards. Try again."
    );
  });

  it("passes through other catalog errors", () => {
    expect(formatCatalogCardLoadError("Player id is required.")).toBe(
      "Player id is required."
    );
  });
});

describe("sportBallImageUrl", () => {
  it("returns a basketball photo for NBA", () => {
    expect(sportBallImageUrl({ slug: "nba", sportLabel: "Basketball" })).toMatch(
      /Basketball_ball_without_shadow\.png$/
    );
  });

  it("returns a football photo for NFL", () => {
    expect(sportBallImageUrl({ slug: "nfl", sportLabel: "Football" })).toMatch(
      /Wilson_American_football\.jpg$/
    );
  });

  it("returns a baseball photo for MLB", () => {
    expect(sportBallImageUrl({ slug: "mlb", sportLabel: "Baseball" })).toMatch(
      /Baseball_%28crop%29\.jpg$/
    );
  });

  it("returns a hockey puck photo for NHL", () => {
    expect(sportBallImageUrl({ slug: "nhl", sportLabel: "Hockey" })).toMatch(
      /Ice-hockey_puck_2\.JPG$/
    );
  });

  it("returns a soccer ball photo for soccer", () => {
    expect(sportBallImageUrl({ slug: "soccer", sportLabel: "Soccer" })).toMatch(
      /Football_Pallo_valmiina-cropped\.jpg$/
    );
  });

  it("returns null for unknown sports", () => {
    expect(sportBallImageUrl({ slug: "lacrosse", sportLabel: "Lacrosse" })).toBeNull();
  });
});

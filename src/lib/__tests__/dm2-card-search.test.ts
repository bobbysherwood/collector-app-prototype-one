import { describe, expect, it } from "vitest";
import {
  formatCatalogSearchError,
  pickUniqueSearchPlayer,
  pickUniqueSearchSport,
} from "@/lib/dm2-card-search";

describe("pickUniqueSearchPlayer", () => {
  const lebron = { id: "lbj", player: "LeBron James" };
  const lebronJr = { id: "jr", player: "LeBron James Jr" };
  const james = { id: "jh", player: "James Harden" };

  it("uses an exact full-name match", () => {
    expect(pickUniqueSearchPlayer("LeBron James", [lebron, james])).toEqual(
      lebron
    );
  });

  it("uses a single all-token hit when the query is a unique prefix", () => {
    expect(pickUniqueSearchPlayer("lebron", [lebron, james])).toEqual(lebron);
  });

  it("does not pick a player when several names contain the tokens", () => {
    expect(pickUniqueSearchPlayer("james", [lebron, james])).toBeNull();
  });

  it("prefers the exact name when a junior also matches the tokens", () => {
    expect(pickUniqueSearchPlayer("lebron james", [lebron, lebronJr])).toEqual(
      lebron
    );
  });
});

describe("pickUniqueSearchSport", () => {
  const basketball = { id: "bb", label: "Basketball" };
  const baseball = { id: "ba", label: "Baseball" };

  it("uses an exact sport label", () => {
    expect(pickUniqueSearchSport("Basketball", [basketball, baseball])).toEqual(
      basketball
    );
  });

  it("does not pick a sport when several labels contain the token", () => {
    expect(pickUniqueSearchSport("ball", [basketball, baseball])).toBeNull();
  });
});

describe("formatCatalogSearchError", () => {
  it("rewrites statement timeouts", () => {
    expect(
      formatCatalogSearchError("canceling statement due to statement timeout")
    ).toBe("The card catalog timed out for this search. Try a more specific query.");
  });

  it("rewrites plpgsql result-type mismatches into a migration instruction", () => {
    expect(
      formatCatalogSearchError(
        "structure of query does not match function result type"
      )
    ).toMatch(/064_dm2_cards_search_cast_fix\.sql/);
  });
});

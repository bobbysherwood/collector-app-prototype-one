import { describe, expect, it } from "vitest";
import { pickCatalogPlayerForHoldings } from "@/lib/holdings-player";
import { normalizeDm2PlayerProfile } from "@/lib/dm2-player-profile";

describe("holdings player resolve", () => {
  const tatum = {
    id: "tatum-id",
    name: "Jayson Tatum",
    sport: "Basketball",
  };

  it("resolves by catalog id when the sport matches", () => {
    expect(
      pickCatalogPlayerForHoldings([tatum], {
        playerId: "tatum-id",
        playerName: "ignored",
        sport: "Basketball",
      })
    ).toEqual(tatum);
  });

  it("resolves by exact name and sport when no id is set", () => {
    expect(
      pickCatalogPlayerForHoldings([tatum], {
        playerName: "jayson  tatum",
        sport: "Basketball",
      })
    ).toEqual(tatum);
  });

  it("rejects a sport mismatch", () => {
    expect(
      pickCatalogPlayerForHoldings([tatum], {
        playerId: "tatum-id",
        playerName: "Jayson Tatum",
        sport: "Football",
      })
    ).toBeNull();
  });
});

describe("player profile normalize", () => {
  it("accepts empty optional fields", () => {
    expect(normalizeDm2PlayerProfile({})).toEqual({
      profile: {
        birthYear: null,
        careerStatus: null,
        injuryStatus: null,
        team: null,
      },
    });
  });

  it("rejects an invalid birth year", () => {
    expect(normalizeDm2PlayerProfile({ birthYear: 1800 }).error).toMatch(
      /Birth year/
    );
  });
});

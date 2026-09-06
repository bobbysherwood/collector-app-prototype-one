import { describe, expect, it } from "vitest";
import {
  pickCatalogMatchForPsaCert,
  scoreCatalogCardAgainstPsa,
} from "@/lib/psa/catalog-match";
import type { PsaCertIdentity } from "@/lib/psa/types";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

function card(
  patch: Partial<Dm2CardSearchResult> & Pick<Dm2CardSearchResult, "id" | "player" | "cardNumber">
): Dm2CardSearchResult {
  return {
    cardSetId: "set-1",
    sportName: "Football",
    year: 2018,
    manufacturerName: "Panini",
    brandName: "Prizm",
    cardSetCategoryName: "Base Set",
    cardSetName: "Prizm",
    parallelName: "Silver",
    imagePath: null,
    attributeNames: [],
    ...patch,
  };
}

const PSA: PsaCertIdentity = {
  subject: "Patrick Mahomes",
  year: 2018,
  cardNumber: "201",
  brand: "2018 Panini Prizm",
  variety: "Silver",
};

describe("catalog match against a PSA cert", () => {
  it("auto-selects a unique high-confidence catalog card", () => {
    const silver = card({
      id: "mahomes-silver",
      player: "Patrick Mahomes",
      cardNumber: "201",
    });
    const result = pickCatalogMatchForPsaCert([silver], PSA);
    expect(result.status).toBe("auto");
    expect(result.cards[0]?.id).toBe("mahomes-silver");
    expect(scoreCatalogCardAgainstPsa(silver, PSA).decision).toBe("auto");
  });

  it("asks for review when the same number has several parallels", () => {
    const silver = card({
      id: "mahomes-silver",
      player: "Patrick Mahomes",
      cardNumber: "201",
      parallelName: "Silver",
    });
    const disco = card({
      id: "mahomes-disco",
      player: "Patrick Mahomes",
      cardNumber: "201",
      parallelName: "Disco",
    });
    const result = pickCatalogMatchForPsaCert([silver, disco], {
      ...PSA,
      variety: "",
    });
    expect(result.status).toBe("review");
    expect(result.cards.map((row) => row.id)).toContain("mahomes-silver");
    expect(result.cards.map((row) => row.id)).toContain("mahomes-disco");
  });

  it("rejects a different player or number", () => {
    const other = card({
      id: "other",
      player: "Tom Brady",
      cardNumber: "1",
      year: 2017,
    });
    expect(pickCatalogMatchForPsaCert([other], PSA)).toEqual({
      status: "none",
      cards: [],
    });
  });
});

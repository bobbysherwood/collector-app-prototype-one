import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePsaHeadingId } from "@/lib/card-population-lookup/heading";
import { planPsaPopulationIngest } from "@/lib/card-population-lookup/ingest";
import { parsePsaPopulationJson } from "@/lib/card-population-lookup/parse-psa-json";
import type { CatalogCardIdentity } from "@/lib/card-population-lookup/types";

const FIXTURE = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "src/lib/card-population-lookup/__fixtures__/psa-donruss-rookies-2017.json"
    ),
    "utf8"
  )
) as unknown;

function card(
  patch: Partial<CatalogCardIdentity> & Pick<CatalogCardIdentity, "id" | "player" | "cardNumber">
): CatalogCardIdentity {
  return {
    sportName: "Basketball",
    year: 2017,
    manufacturerName: "Panini",
    brandName: "Donruss",
    cardSetName: "The Rookies",
    parallelName: null,
    ...patch,
  };
}

const SET_CARDS: CatalogCardIdentity[] = [
  card({ id: "fultz-base", player: "Markelle Fultz", cardNumber: "1" }),
  card({
    id: "fultz-green",
    player: "Markelle Fultz",
    cardNumber: "1",
    parallelName: "Green Flood",
  }),
  card({
    id: "fultz-blue",
    player: "Markelle Fultz",
    cardNumber: "1",
    parallelName: "Press Proof Blue",
  }),
  card({ id: "lonzo-base", player: "Lonzo Ball", cardNumber: "2" }),
];

describe("PSA heading and JSON ingest", () => {
  it("reads a heading id from a pop report URL", () => {
    expect(
      parsePsaHeadingId(
        "https://www.psacard.com/pop/basketball-cards/2017/panini-donruss-rookies/154126"
      )
    ).toBe(154126);
    expect(parsePsaHeadingId("154126")).toBe(154126);
  });

  it("parses Grade columns from captured set JSON", () => {
    const rows = parsePsaPopulationJson(FIXTURE, "2017 Panini Donruss the Rookies");
    expect(rows).toHaveLength(4);
    expect(rows[0]?.counts.psa_10).toBe(17);
    expect(rows[3]?.subject).toBe("Lonzo Ball");
  });

  it("auto-matches base and parallel rows inside one set", () => {
    const plan = planPsaPopulationIngest({
      json: FIXTURE,
      setName: "2017 Panini Donruss the Rookies",
      headingId: 154126,
      cards: SET_CARDS,
    });
    expect(plan.auto.map((row) => row.cardId).sort()).toEqual([
      "fultz-base",
      "fultz-blue",
      "fultz-green",
      "lonzo-base",
    ]);
    expect(plan.auto.find((row) => row.cardId === "fultz-base")?.psaCounts.psa_10).toBe(17);
    expect(plan.auto.find((row) => row.cardId === "fultz-green")?.psaCounts.psa_10).toBe(1);
    expect(plan.reject).toHaveLength(0);
  });

  it("does not auto-write a same-number card from another player", () => {
    const plan = planPsaPopulationIngest({
      json: FIXTURE,
      setName: "2017 Panini Donruss the Rookies",
      cards: [card({ id: "wrong", player: "Jayson Tatum", cardNumber: "1" })],
    });
    expect(plan.auto).toHaveLength(0);
    expect(plan.reject.length + plan.review.length).toBeGreaterThan(0);
  });
});

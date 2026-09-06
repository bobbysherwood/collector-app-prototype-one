import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARD_POPULATION_ADMIN_TITLE,
  CARD_POPULATION_FIELDS,
  CARD_POPULATION_IDENTITY_FIELDS,
  CARD_POPULATION_KEYS,
  applyPopulationPatch,
  cardSearchHaystack,
  countsToFormValues,
  emptyPopulationCounts,
  formatPopulationCount,
  isCardUuid,
  matchesCardPopulationSearch,
  parsePopulationForm,
  parsePopulationInput,
  populationRecordStatus,
} from "@/lib/dm2-card-population";
import {
  cardMatchesLeftoverLookups,
  leftoverSearchTokens,
  selectBestPlayerIds,
} from "@/lib/dm2-card-population-search";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

const MIGRATION = readFileSync(
  resolve(process.cwd(), "supabase/migrations/056_dm2_card_populations.sql"),
  "utf8"
);
const PANEL_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/admin-data-model-v2-panel.tsx"),
  "utf8"
);
const SECTION_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/admin-dm2-card-population-section.tsx"),
  "utf8"
);

function card(overrides: Partial<Dm2CardSearchResult> = {}): Dm2CardSearchResult {
  return {
    id: "7d6f0a12-1234-4abc-8def-0123456789ab",
    cardSetId: "set-1",
    sportName: "Basketball",
    year: 2024,
    manufacturerName: "Panini",
    brandName: "Prizm",
    cardSetCategoryName: "Base",
    cardSetName: "Base Set",
    cardNumber: "136",
    player: "Victor Wembanyama",
    parallelName: "Silver",
    imagePath: null,
    attributeNames: [],
    ...overrides,
  };
}

describe("Card Population database model", () => {
  it("creates one population row per existing card", () => {
    expect(MIGRATION).toContain("create table if not exists public.dm2_card_populations");
    expect(MIGRATION).toContain(
      "card_id uuid primary key references public.dm2_cards (id) on delete cascade"
    );
  });

  it("rejects a population row for a nonexistent card via foreign key", () => {
    expect(MIGRATION).toMatch(/references public\.dm2_cards \(id\)/);
  });

  it("rejects a duplicate population row for the same card via primary key", () => {
    expect(MIGRATION).toContain("card_id uuid primary key");
  });

  it("allows NULL and zero, rejects negatives, and uses integer columns", () => {
    for (const key of CARD_POPULATION_KEYS) {
      expect(MIGRATION).toContain(`${key} integer`);
      expect(MIGRATION).toContain(
        `constraint dm2_card_populations_${key}_nonneg check (${key} is null or ${key} >= 0)`
      );
    }
    expect(MIGRATION).not.toMatch(/\b\w+_1 numeric/);
    expect(MIGRATION).not.toMatch(/\b\w+_1 text/);
  });

  it("does not introduce a new audit pattern", () => {
    expect(MIGRATION).toContain("created_at timestamptz not null default now()");
    expect(MIGRATION).toContain("updated_at timestamptz not null default now()");
    expect(MIGRATION).not.toContain("created_by");
    expect(MIGRATION).not.toContain("updated_by");
  });

  it("does not duplicate card metadata columns", () => {
    expect(MIGRATION).not.toMatch(/player varchar|card_number|manufacturer|parallel_id/);
  });
});

describe("Card Population admin", () => {
  it("appears in Data Model v2 Admin", () => {
    expect(PANEL_SOURCE).toContain("AdminDm2CardPopulationSection");
    expect(CARD_POPULATION_ADMIN_TITLE).toBe("Card Population");
  });

  it("searches cards using player, year, set, brand, and parallel — not card #, sport, or UUID", () => {
    const wemby = card();
    expect(matchesCardPopulationSearch(wemby, "Wembanyama")).toBe(true);
    expect(matchesCardPopulationSearch(wemby, "Base Set")).toBe(true);
    expect(matchesCardPopulationSearch(wemby, "Silver")).toBe(true);
    expect(matchesCardPopulationSearch(wemby, "2024 Panini Prizm")).toBe(true);
    expect(matchesCardPopulationSearch(wemby, "LeBron")).toBe(false);
    expect(matchesCardPopulationSearch(wemby, "136")).toBe(false);
    expect(matchesCardPopulationSearch(wemby, "Basketball")).toBe(false);
    expect(matchesCardPopulationSearch(wemby, wemby.id)).toBe(false);
    expect(cardSearchHaystack(wemby)).not.toContain("136");
    expect(cardSearchHaystack(wemby)).not.toContain("basketball");
    expect(cardSearchHaystack(wemby)).not.toContain(wemby.id);
    expect(SECTION_SOURCE).not.toMatch(/Search by player, card #, sport/);
    expect(SECTION_SOURCE).not.toMatch(/unique card ID\. Cards appear/);
  });

  it("narrows multi-word queries to the best player and leftover set tokens", () => {
    const tokens = ["jayson", "tatum", "the", "rookies"];
    const playerIds = selectBestPlayerIds(
      [
        { id: "p-tatum", name: "Jayson Tatum" },
        { id: "p-other", name: "Jayson Williams" },
      ],
      tokens
    );
    expect(playerIds).toEqual(["p-tatum"]);
    expect(leftoverSearchTokens(tokens, ["Jayson Tatum"])).toEqual(["rookies"]);
    expect(
      matchesCardPopulationSearch(
        card({
          player: "Jayson Tatum",
          cardSetName: "The Rookies",
        }),
        "jayson tatum the rookies"
      )
    ).toBe(true);
    expect(
      cardMatchesLeftoverLookups(
        { card_set_id: "set-rookies", parallel_id: "par-base" },
        ["set-rookies"],
        ["par-other"]
      )
    ).toBe(true);
  });

  it("can locate cards that do not yet have a population record", () => {
    expect(populationRecordStatus(false)).toBe("Not Created");
    expect(populationRecordStatus(true)).toBe("Exists");
    expect(matchesCardPopulationSearch(card(), "Wembanyama")).toBe(true);
  });

  it("creates a new population record from entered values only", () => {
    const parsed = parsePopulationForm({
      psa_10: "100",
      sgc_10: "25",
    });
    expect(parsed.error).toBeUndefined();
    expect(parsed.counts.psa_10).toBe(100);
    expect(parsed.counts.sgc_10).toBe(25);
    expect(parsed.counts.psa_9).toBeNull();
    expect(parsed.counts.bgs_9_5).toBeNull();
    expect(CARD_POPULATION_KEYS.every((key) => key in parsed.counts)).toBe(true);
  });

  it("edits an existing record without turning blank fields into zero", () => {
    const existing = applyPopulationPatch(null, { psa_10: 100, sgc_10: 25 });
    const form = countsToFormValues(existing);
    form.psa_10 = "105";
    const parsed = parsePopulationForm(form);
    expect(parsed.counts.psa_10).toBe(105);
    expect(parsed.counts.sgc_10).toBe(25);
    expect(parsed.counts.psa_9).toBeNull();
    expect(parsed.counts.psa_8).not.toBe(0);
  });

  it("keeps NULL values NULL when other values are updated", () => {
    const next = applyPopulationPatch(
      { ...emptyPopulationCounts(), psa_10: 100, sgc_10: 25 },
      { psa_10: 105 }
    );
    expect(next.psa_10).toBe(105);
    expect(next.sgc_10).toBe(25);
    expect(next.bgs_10).toBeNull();
  });

  it("keeps card identification fields read-only in the population editor", () => {
    const identitySource = SECTION_SOURCE.slice(
      SECTION_SOURCE.indexOf("function CardIdentity"),
      SECTION_SOURCE.indexOf("export function AdminDm2CardPopulationSection")
    );
    expect(identitySource).toContain("<dd className");
    expect(identitySource).not.toContain("<Input");
    expect(CARD_POPULATION_IDENTITY_FIELDS).toEqual([
      "Player",
      "Card #",
      "Sport",
      "Year",
      "Manufacturer",
      "Brand",
      "Card Set",
      "Card Set Category",
      "Parallel",
      "Unique Card ID",
    ]);
  });
});

describe("Card Population validation", () => {
  it("accepts NULL, zero, and whole numbers", () => {
    expect(parsePopulationInput("")).toEqual({ value: null });
    expect(parsePopulationInput("   ")).toEqual({ value: null });
    expect(parsePopulationInput(null)).toEqual({ value: null });
    expect(parsePopulationInput("0")).toEqual({ value: 0 });
    expect(parsePopulationInput("1,247")).toEqual({ value: 1247 });
    expect(formatPopulationCount(1247)).toBe("1,247");
  });

  it("rejects negatives, decimals, and text", () => {
    expect(parsePopulationInput("-1")).toHaveProperty("error");
    expect(parsePopulationInput(-3)).toHaveProperty("error");
    expect(parsePopulationInput("1.5")).toHaveProperty("error");
    expect(parsePopulationInput("12.0")).toHaveProperty("error");
    expect(parsePopulationInput("abc")).toHaveProperty("error");
  });

  it("includes the required grading-company / grade matrix", () => {
    const keys = CARD_POPULATION_FIELDS.map((field) => field.key);
    expect(keys).toContain("psa_1");
    expect(keys).toContain("psa_10");
    expect(keys).toContain("bgs_9_5");
    expect(keys).toContain("sgc_9_5");
    expect(keys).toContain("cgc_10");
    expect(keys).toHaveLength(43);
    expect(isCardUuid("7d6f0a12-1234-4abc-8def-0123456789ab")).toBe(true);
    expect(isCardUuid("not-an-id")).toBe(false);
  });
});

describe("Card Population end-to-end save workflow", () => {
  it("creates, reloads, then updates one count without clobbering the other", () => {
    const created = parsePopulationForm({
      ...countsToFormValues(emptyPopulationCounts()),
      psa_10: "100",
      sgc_10: "25",
    });
    expect(created.counts.psa_10).toBe(100);
    expect(created.counts.sgc_10).toBe(25);
    expect(
      CARD_POPULATION_KEYS.filter((key) => key !== "psa_10" && key !== "sgc_10").every(
        (key) => created.counts[key] === null
      )
    ).toBe(true);

    const reloaded = countsToFormValues(created.counts);
    expect(reloaded.psa_10).toBe("100");
    expect(reloaded.sgc_10).toBe("25");
    expect(reloaded.psa_9).toBe("");

    reloaded.psa_10 = "105";
    const updated = parsePopulationForm(reloaded);
    expect(updated.counts.psa_10).toBe(105);
    expect(updated.counts.sgc_10).toBe(25);
    expect(updated.counts.psa_9).toBeNull();
  });
});

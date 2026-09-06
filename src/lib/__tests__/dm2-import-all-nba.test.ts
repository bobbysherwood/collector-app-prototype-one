import { describe, expect, it } from "vitest";
import {
  mergeFragmentedParallelSplit,
  reconcileExtractedRowsWithCatalogParallels,
} from "@/lib/dm2-import-parallel-reconcile";
import {
  cardSetNameParallelWordsDisjoint,
  findSharedCardSetNameFromValues,
  suffixAfterWordPrefix,
} from "@/lib/dm2-import-spreadsheet-split";
import type {
  Dm2ExtractedRow,
  Dm2ImportCatalogContext,
} from "@/types/dm2-import";

function catalogWithParallels(
  parallels: string[],
  cardSetNames: string[] = []
): Dm2ImportCatalogContext {
  return {
    entityDescriptions: [],
    sports: [],
    manufacturers: [],
    brands: [],
    cardSetCategories: [],
    cardSetNames: cardSetNames.map((name, index) => ({
      id: `set-${index}`,
      name,
      active: true,
    })),
    parallels: parallels.map((name, index) => ({
      id: `par-${index}`,
      name,
      active: true,
    })),
    cardSets: [],
    cards: [],
  };
}

function row(
  cardSetName: string,
  parallel?: string
): Dm2ExtractedRow {
  return {
    id: `row-${cardSetName}-${parallel ?? "base"}`,
    sourceFileName: "2021 Panini Mosaic.csv",
    sourceRowIndex: 1,
    cardSetName,
    cardSetCategory: "Subset",
    parallel,
    confidence: 1,
    excluded: false,
  };
}

describe("All NBA subset splits", () => {
  const family = [
    "Base All NBA",
    "Base All NBA Mosaic",
    "Base All NBA Mosaic Gold",
    "Base All NBA Mosaic NBA 75th Anniversary",
    "Base All NBA Silver",
    "Base All NBA White Sparkle",
  ];

  it("keeps All NBA as the shared family name even when a parallel contains NBA", () => {
    expect(
      cardSetNameParallelWordsDisjoint(
        "Base All NBA",
        family.map((value) => suffixAfterWordPrefix(value, "Base All NBA"))
      )
    ).toBe(true);
    expect(findSharedCardSetNameFromValues(family)).toBe("Base All NBA");
  });

  it("does not fold All NBA into All when the catalog contains an NBA parallel", () => {
    const merged = mergeFragmentedParallelSplit(
      {
        cardSetName: "All NBA",
        parallel: "Mosaic Gold",
        cardSetCategory: "Subset",
      },
      ["NBA", "Mosaic", "Mosaic Gold", "Gold"]
    );

    expect(merged.cardSetName).toBe("All NBA");
    expect(merged.parallel).toBe("Mosaic Gold");
  });

  it("does not peel NBA off All NBA rows during catalog parallel reconcile", () => {
    const catalog = catalogWithParallels(
      ["NBA", "Mosaic", "Mosaic Gold", "Silver", "White Sparkle"],
      ["All"]
    );
    const rows = [
      row("All NBA"),
      row("All NBA", "Mosaic Gold"),
      row("All NBA", "Silver"),
      row("All NBA", "Mosaic NBA 75th Anniversary"),
    ];

    const reconciled = reconcileExtractedRowsWithCatalogParallels(rows, catalog);

    expect(reconciled.map((item) => item.cardSetName)).toEqual([
      "All NBA",
      "All NBA",
      "All NBA",
      "All NBA",
    ]);
    expect(reconciled.map((item) => item.parallel ?? "")).toEqual([
      "",
      "Mosaic Gold",
      "Silver",
      "Mosaic NBA 75th Anniversary",
    ]);
  });
});

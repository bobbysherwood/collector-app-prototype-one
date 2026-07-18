import type { Dm2ImportCatalogContext } from "@/types/dm2-import";
import {
  DM2_IMPORT_MAPPING_INSTRUCTIONS,
  DM2_IMPORT_PARALLEL_SPLIT_GUIDANCE,
  DM2_IMPORT_SPREADSHEET_CHECKLIST_GUIDANCE,
} from "@/lib/dm2-import-prompt";

const MAX_ITEMS_PER_LIST = 40;

function listNames(
  items: Array<{ name: string; active: boolean }>,
  label: string
): string {
  const names = items
    .slice(0, MAX_ITEMS_PER_LIST)
    .map((item) => `${item.name}${item.active ? "" : " (inactive)"}`);
  if (names.length === 0) return `${label}: none`;
  const suffix =
    items.length > MAX_ITEMS_PER_LIST
      ? ` (+${items.length - MAX_ITEMS_PER_LIST} more)`
      : "";
  return `${label}: ${names.join(", ")}${suffix}`;
}

function buildEntityDescriptionSection(
  catalog: Dm2ImportCatalogContext
): string {
  if (catalog.entityDescriptions.length === 0) {
    return [
      "Data Model v2 schema — entity definitions:",
      "- Sport classifies the product category (Baseball, Basketball, etc.), not the player.",
      "- Manufacturer is the parent company; Brand is the product line under that manufacturer.",
      "- Card Set Category classifies the checklist section type: Base Set (main sequential checklist), Subset (specialized group using base checklist numbering — within the base range e.g. #201-250 or appended after it e.g. #301-350), Insert (separate numbering like IN1 or FW-1).",
      "- Card Set Name is the section title (e.g., Base Set, Rated Rookies, Downtown).",
      "- Parallel is the manufacturer-defined variation name — preserve exactly as published.",
      "- Card Set = sport + year + brand + category + set name; Cards = card set + card # + player + parallel.",
    ].join("\n");
  }

  const lines = [
    "Data Model v2 schema — entity definitions (from database):",
    "",
  ];

  for (const entity of catalog.entityDescriptions) {
    const tableRef = entity.tableName ? ` (${entity.tableName})` : "";
    lines.push(`${entity.title}${tableRef}`);
    lines.push(entity.description);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function buildDm2CatalogSummary(catalog: Dm2ImportCatalogContext): string {
  const sports = catalog.sports.map((sport) => ({
    name: sport.label,
    active: sport.active,
  }));

  const brandLines = catalog.brands
    .slice(0, MAX_ITEMS_PER_LIST)
    .map(
      (brand) =>
        `${brand.manufacturerName} → ${brand.name}${brand.active ? "" : " (inactive)"}`
    );

  const cardSetExamples = catalog.cardSets.slice(0, 20).map((cardSet) => {
    const sport = catalog.sports.find((item) => item.id === cardSet.sportId);
    const brand = catalog.brands.find((item) => item.id === cardSet.brandId);
    const category = catalog.cardSetCategories.find(
      (item) => item.id === cardSet.cardSetCategoryId
    );
    const setName = catalog.cardSetNames.find(
      (item) => item.id === cardSet.cardSetNameId
    );
    return `${sport?.label ?? "?"} | ${cardSet.year} | ${brand?.manufacturerName ?? "?"} | ${brand?.name ?? "?"} | ${category?.name ?? "?"} | ${setName?.name ?? "?"}`;
  });

  return [
    buildEntityDescriptionSection(catalog),
    "",
    "Existing Data Model v2 catalog values (use for matching and naming consistency):",
    listNames(sports, "Sports"),
    listNames(catalog.manufacturers, "Manufacturers"),
    brandLines.length > 0
      ? `Brands (manufacturer → brand): ${brandLines.join("; ")}`
      : "Brands: none",
    listNames(catalog.cardSetCategories, "Card Set Categories"),
    listNames(catalog.cardSetNames, "Card Set Names"),
    listNames(catalog.parallels, "Parallels"),
    cardSetExamples.length > 0
      ? `Card Set key examples (sport | year | manufacturer | brand | category | set name):\n${cardSetExamples.join("\n")}`
      : "Card Set examples: none",
    "",
    DM2_IMPORT_MAPPING_INSTRUCTIONS,
    "",
    DM2_IMPORT_PARALLEL_SPLIT_GUIDANCE,
    "",
    DM2_IMPORT_SPREADSHEET_CHECKLIST_GUIDANCE,
  ].join("\n");
}

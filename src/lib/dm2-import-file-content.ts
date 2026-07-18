import * as XLSX from "xlsx";
import {
  buildCardSetSplitIndex,
  findCardSetRoots,
  inferCardSetCategory,
  normalizeBrandProgramName,
  normalizeCardSetRootName,
  resolveManufacturerFromBrand,
} from "@/lib/dm2-import-spreadsheet-split";
import { applyBasePrefixedCatalogSplits } from "@/lib/dm2-import-parallel-reconcile";
import type {
  Dm2ColumnMapping,
  Dm2ExtractedRow,
  Dm2ImportCatalogContext,
  Dm2ImportSessionContext,
} from "@/types/dm2-import";

export const DM2_IMPORT_MAX_FILES = 10;
export const DM2_IMPORT_MAX_TOTAL_ROWS = 50_000;
export const DM2_IMPORT_MAX_ROWS_PER_FILE = 50_000;
export const DM2_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DM2_IMPORT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const DM2_IMPORT_AI_SAMPLE_ROWS = 60;
export const DM2_IMPORT_LARGE_ROW_THRESHOLD = 1_000;
export const DM2_IMPORT_MAX_DISTINCT_VALUES_FOR_AI = 200;

const MAX_CONTENT_CHARS = 120_000;

const COLUMN_ALIASES: Record<
  keyof Dm2ColumnMapping["columns"],
  string[]
> = {
  sport: ["sport"],
  year: ["year", "season", "release year"],
  manufacturer: ["manufacturer", "company", "maker"],
  brand: ["program", "product line", "product", "release"],
  cardSetCategory: ["category", "product type", "box type", "set category"],
  cardSetName: ["set name", "subset", "product name"],
  cardNumber: [
    "card number",
    "card #",
    "card no",
    "card#",
    "card num",
    "#",
  ],
  player: ["athlete", "player", "player name", "subject"],
  parallel: ["parallel", "variant", "finish"],
};

const EXACT_HEADER_FIELDS: Record<string, keyof Dm2ColumnMapping["columns"]> = {
  sport: "sport",
  year: "year",
  program: "brand",
  athlete: "player",
  "card number": "cardNumber",
  "card set": "cardSetName",
};

export interface Dm2SpreadsheetSheet {
  name: string;
  rows: unknown[][];
}

export interface Dm2SpreadsheetData {
  sheets: Dm2SpreadsheetSheet[];
  primarySheetIndex: number;
  totalRowCount: number;
}

export type { Dm2ColumnMapping };

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export function isSpreadsheetFile(fileName: string, mimeType: string): boolean {
  const extension = extensionOf(fileName);
  return (
    extension === "xlsx" ||
    extension === "xls" ||
    extension === "csv" ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  );
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function readCsvRows(buffer: ArrayBuffer): Dm2SpreadsheetData {
  const workbook = XLSX.read(buffer, { type: "array", raw: false });
  const sheetName = workbook.SheetNames[0] ?? "CSV";
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  return {
    sheets: [{ name: sheetName, rows }],
    primarySheetIndex: 0,
    totalRowCount: rows.length,
  };
}

export function readSpreadsheetData(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string
): Dm2SpreadsheetData {
  const extension = extensionOf(fileName);
  if (extension === "csv" || mimeType.includes("csv")) {
    return readCsvRows(buffer);
  }

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets: Dm2SpreadsheetSheet[] = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];
    return { name: sheetName, rows };
  });

  let primarySheetIndex = 0;
  let maxRows = 0;
  sheets.forEach((sheet, index) => {
    if (sheet.rows.length > maxRows) {
      maxRows = sheet.rows.length;
      primarySheetIndex = index;
    }
  });

  return {
    sheets,
    primarySheetIndex,
    totalRowCount: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
  };
}

export function buildSpreadsheetSampleContent(
  data: Dm2SpreadsheetData,
  maxRows = DM2_IMPORT_AI_SAMPLE_ROWS
): string {
  const sheet = data.sheets[data.primarySheetIndex];
  if (!sheet) return "";

  const lines = [
    `Sheet: ${sheet.name}`,
    `Total rows in file: ${sheet.rows.length}`,
    `Sample (first ${maxRows} rows):`,
  ];

  for (const row of sheet.rows.slice(0, maxRows)) {
    lines.push(row.map((cell) => cellToString(cell)).join("\t"));
  }

  const content = lines.join("\n");
  if (content.length <= MAX_CONTENT_CHARS) return content;
  return `${content.slice(0, MAX_CONTENT_CHARS)}\n\n[Sample truncated]`;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function headerLabels(headerRow: unknown[]): string[] {
  return headerRow.map((cell) => cellToString(cell));
}

export function applySpreadsheetColumnFixes(
  mapping: Dm2ColumnMapping,
  headerRow: unknown[]
): Dm2ColumnMapping {
  const headers = headerLabels(headerRow);
  const columns = { ...mapping.columns };
  let combinedCardSetColumn = mapping.combinedCardSetColumn;

  for (const [header, field] of Object.entries(EXACT_HEADER_FIELDS)) {
    const index = headers.findIndex(
      (label) => normalizeKey(label) === normalizeKey(header)
    );
    if (index >= 0) {
      columns[field] = index;
    }
  }

  const programIndex = headers.findIndex(
    (label) => normalizeKey(label) === "program"
  );
  const brandHeaderIndex = headers.findIndex(
    (label) => normalizeKey(label) === "brand"
  );
  const cardSetIndex = headers.findIndex(
    (label) => normalizeKey(label) === "card set"
  );

  if (programIndex >= 0) {
    columns.brand = programIndex;
    delete columns.manufacturer;
  }

  if (cardSetIndex >= 0 && columns.parallel == null) {
    columns.cardSetName = cardSetIndex;
    combinedCardSetColumn = cardSetIndex;
  }

  if (brandHeaderIndex >= 0 && programIndex >= 0) {
    delete columns.manufacturer;
  }

  return {
    ...mapping,
    columns,
    combinedCardSetColumn,
  };
}

/** Skip AI column mapping when standard checklist headers are present. */
export function canUseHeuristicSpreadsheetMapping(
  mapping: Dm2ColumnMapping | null,
  _headers: string[]
): boolean {
  if (!mapping) return false;

  const { columns } = mapping;
  if (columns.cardNumber == null || columns.player == null) return false;

  const hasCombinedCardSet =
    mapping.combinedCardSetColumn != null || columns.cardSetName != null;
  if (!hasCombinedCardSet) return false;

  if (columns.brand == null && columns.sport == null) return false;

  return true;
}

export function inferColumnMappingHeuristic(
  data: Dm2SpreadsheetData,
  sheetIndex = data.primarySheetIndex
): Dm2ColumnMapping | null {
  const sheet = data.sheets[sheetIndex];
  if (!sheet || sheet.rows.length === 0) return null;

  let headerRowIndex = 0;
  let bestScore = 0;
  for (let rowIndex = 0; rowIndex < Math.min(10, sheet.rows.length); rowIndex++) {
    const row = sheet.rows[rowIndex];
    let score = 0;
    for (const cell of row) {
      const normalized = cellToString(cell).toLowerCase();
      for (const aliases of Object.values(COLUMN_ALIASES)) {
        if (aliases.some((alias) => normalized.includes(alias))) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = rowIndex;
    }
  }

  const headerRow = sheet.rows[headerRowIndex];
  const columns: Dm2ColumnMapping["columns"] = {};

  for (const [header, field] of Object.entries(EXACT_HEADER_FIELDS)) {
    const index = headerLabels(headerRow).findIndex(
      (label) => normalizeKey(label) === normalizeKey(header)
    );
    if (index >= 0) {
      columns[field] = index;
    }
  }

  headerRow.forEach((cell, index) => {
    const normalized = cellToString(cell).toLowerCase();
    if (normalized === "brand") return;
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (
        aliases.some(
          (alias) => normalized === alias || normalized.includes(alias)
        ) &&
        columns[field as keyof Dm2ColumnMapping["columns"]] == null
      ) {
        columns[field as keyof Dm2ColumnMapping["columns"]] = index;
      }
    }
  });

  if (columns.cardNumber == null && columns.player == null) return null;

  return applySpreadsheetColumnFixes(
    {
      sheetIndex,
      headerRowIndex,
      dataStartRowIndex: headerRowIndex + 1,
      columns,
      defaultMetadata: {},
      confidence: 0.65,
    },
    headerRow
  );
}

export function collectDistinctColumnValues(input: {
  data: Dm2SpreadsheetData;
  sheetIndex: number;
  headerRowIndex: number;
  dataStartRowIndex: number;
  columnIndex?: number;
}): string[] {
  const sheet = input.data.sheets[input.sheetIndex];
  if (!sheet || input.columnIndex == null) return [];

  const values = new Set<string>();
  for (let rowIndex = input.dataStartRowIndex; rowIndex < sheet.rows.length; rowIndex++) {
    const row = sheet.rows[rowIndex];
    if (!row) continue;
    const value = cellToString(row[input.columnIndex]);
    if (value) values.add(value);
  }

  return [...values].sort((a, b) => a.localeCompare(b));
}

/** Prefer roots and representative variants so AI learns split patterns for every insert/base family. */
export function capDistinctValuesForAi(
  values: string[],
  max = DM2_IMPORT_MAX_DISTINCT_VALUES_FOR_AI
): { values: string[]; totalCount: number; truncated: boolean } {
  const sorted = [...values]
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (sorted.length <= max) {
    return { values: sorted, totalCount: sorted.length, truncated: false };
  }

  const selected = new Set<string>();
  const roots = findCardSetRoots(sorted);

  for (const root of roots) {
    selected.add(root);
    const members = sorted.filter(
      (value) => value === root || value.startsWith(`${root} `)
    );
    if (members.length <= 4) {
      for (const member of members) selected.add(member);
      continue;
    }

    const parallels = members.filter((value) => value !== root);
    if (parallels.length > 0) {
      selected.add(parallels[0]);
      selected.add(parallels[Math.floor(parallels.length / 2)]);
      selected.add(parallels[parallels.length - 1]);
    }
  }

  const unselected = sorted.filter((value) => !selected.has(value));
  const remainingBudget = max - selected.size;
  if (remainingBudget > 0 && unselected.length > 0) {
    const step = unselected.length / remainingBudget;
    for (let index = 0; index < remainingBudget; index++) {
      selected.add(unselected[Math.floor(index * step)]);
    }
  }

  const sampled = [...selected].sort((a, b) => a.localeCompare(b)).slice(0, max);
  return {
    values: sampled,
    totalCount: sorted.length,
    truncated: sampled.length < sorted.length,
  };
}

function parseYearValue(value: unknown): number | undefined {
  const raw = cellToString(value);
  if (!raw) return undefined;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1800 || year > 2100) return undefined;
  return year;
}

function readMappedCell(row: unknown[], columnIndex?: number): string | undefined {
  if (columnIndex == null || columnIndex < 0) return undefined;
  const value = cellToString(row[columnIndex]);
  return value || undefined;
}

function rowIsEmpty(row: unknown[]): boolean {
  return row.every((cell) => !cellToString(cell));
}

export function extractRowsFromSpreadsheet(input: {
  data: Dm2SpreadsheetData;
  mapping: Dm2ColumnMapping;
  fileName: string;
  maxRows?: number;
  catalog?: Dm2ImportCatalogContext;
}): {
  rows: Array<Omit<Dm2ExtractedRow, "id">>;
  sessionContext: Dm2ImportSessionContext;
} {
  const maxRows = input.maxRows ?? DM2_IMPORT_MAX_ROWS_PER_FILE;
  const sheet = input.data.sheets[input.mapping.sheetIndex];
  if (!sheet) {
    return { rows: [], sessionContext: input.mapping.defaultMetadata };
  }

  const headerRow = sheet.rows[input.mapping.headerRowIndex] ?? [];
  const mapping = applySpreadsheetColumnFixes(input.mapping, headerRow);
  const { columns, defaultMetadata, dataStartRowIndex } = mapping;
  const combinedColumn =
    mapping.combinedCardSetColumn ?? columns.cardSetName;
  const aiSplits = mapping.cardSetValueSplits ?? {};
  const extracted: Array<Omit<Dm2ExtractedRow, "id">> = [];

  for (
    let rowIndex = dataStartRowIndex;
    rowIndex < sheet.rows.length && extracted.length < maxRows;
    rowIndex++
  ) {
    const row = sheet.rows[rowIndex];
    if (!row || rowIsEmpty(row)) continue;

    const sport = readMappedCell(row, columns.sport) ?? defaultMetadata.sport;
    const year =
      (columns.year != null ? parseYearValue(row[columns.year]) : undefined) ??
      defaultMetadata.year;

    const rawBrand =
      readMappedCell(row, columns.brand) ?? defaultMetadata.brand;
    const brand = rawBrand ? normalizeBrandProgramName(rawBrand) : undefined;
    const manufacturer =
      resolveManufacturerFromBrand({
        brand,
        catalogBrands: input.catalog?.brands,
      }) ?? defaultMetadata.manufacturer;

    let cardSetCategory =
      readMappedCell(row, columns.cardSetCategory) ??
      defaultMetadata.cardSetCategory;
    let cardSetName =
      readMappedCell(row, columns.cardSetName) ?? defaultMetadata.cardSetName;
    let parallel = readMappedCell(row, columns.parallel);

    const rawCombinedValue =
      combinedColumn != null ? readMappedCell(row, combinedColumn) : undefined;
    if (rawCombinedValue && aiSplits[rawCombinedValue]) {
      const split = aiSplits[rawCombinedValue];
      cardSetName = split.cardSetName;
      parallel = split.parallel ?? undefined;
      cardSetCategory =
        split.cardSetCategory ?? cardSetCategory ?? defaultMetadata.cardSetCategory;
    }

    const cardNumber = readMappedCell(row, columns.cardNumber);
    const player = readMappedCell(row, columns.player);

    if (!cardNumber && !player && !brand && !cardSetName) continue;

    extracted.push({
      sourceFileName: input.fileName,
      sourceRowIndex: rowIndex + 1,
      sport,
      year,
      manufacturer,
      brand,
      cardSetCategory,
      cardSetName,
      cardNumber,
      player,
      parallel,
      confidence: mapping.confidence,
      excluded: false,
    });
  }

  const sessionContext: Dm2ImportSessionContext = {
    ...defaultMetadata,
    manufacturer:
      defaultMetadata.manufacturer ??
      resolveManufacturerFromBrand({
        brand: defaultMetadata.brand,
        catalogBrands: input.catalog?.brands,
      }),
    brand: defaultMetadata.brand
      ? normalizeBrandProgramName(defaultMetadata.brand)
      : undefined,
  };

  return { rows: extracted, sessionContext };
}

export type Dm2CardSetValueSplit = {
  cardSetName: string;
  parallel: string | null;
  cardSetCategory: string | null;
};

function buildProgrammaticCardSetValueSplits(
  distinctValues: string[]
): Record<string, Dm2CardSetValueSplit> {
  const index = buildCardSetSplitIndex(distinctValues);
  const splits: Record<string, Dm2CardSetValueSplit> = {};

  for (const [rawValue, split] of index) {
    splits[rawValue] = {
      cardSetName: split.cardSetName,
      parallel: split.parallel ?? null,
      cardSetCategory: split.cardSetCategory,
    };
  }

  return splits;
}

function longestSharedWordPrefix(a: string, b: string): string {
  const wordsA = a.trim().split(/\s+/);
  const wordsB = b.trim().split(/\s+/);
  const sharedWords: string[] = [];

  for (let i = 0; i < Math.min(wordsA.length, wordsB.length); i++) {
    if (wordsA[i].toLowerCase() !== wordsB[i].toLowerCase()) break;
    sharedWords.push(wordsA[i]);
  }

  if (sharedWords.length === 0) return "";

  const prefix = sharedWords.join(" ");
  const remainderA = a.trim().slice(prefix.length).trim();
  const remainderB = b.trim().slice(prefix.length).trim();
  if (!remainderA || !remainderB) return "";

  return prefix;
}

function canonicalPrefixFromValue(rawValue: string, prefixWordCount: number): string {
  return rawValue.trim().split(/\s+/).slice(0, prefixWordCount).join(" ");
}

function collectSharedInsertPrefixCandidates(
  distinctValues: string[],
  catalogCardSetNames: string[]
): Array<{ prefixKey: string; wordCount: number }> {
  const candidates = new Map<string, number>();

  for (const name of catalogCardSetNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    candidates.set(trimmed.toLowerCase(), trimmed.split(/\s+/).length);
  }

  const roots = findCardSetRoots(distinctValues);
  for (const root of roots) {
    const members = distinctValues.filter(
      (value) => value === root || value.startsWith(`${root} `)
    );
    if (members.length < 2) continue;

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const prefix = longestSharedWordPrefix(members[i], members[j]);
        const wordCount = prefix.split(/\s+/).filter(Boolean).length;
        if (wordCount >= 2) {
          candidates.set(prefix.toLowerCase(), wordCount);
        }
      }
    }
  }

  return [...candidates.entries()]
    .map(([prefixKey, wordCount]) => ({ prefixKey, wordCount }))
    .sort((a, b) => b.wordCount - a.wordCount || b.prefixKey.length - a.prefixKey.length);
}

function applySharedInsertPrefixSplits(
  enriched: Record<string, Dm2CardSetValueSplit>,
  distinctValues: string[],
  catalogCardSetNames: string[],
  catalogInsertSetNames: string[]
): void {
  const insertNameKeys = new Set(
    catalogInsertSetNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
  );
  const values = distinctValues.map((value) => value.trim()).filter(Boolean);
  const prefixCandidates = collectSharedInsertPrefixCandidates(
    values,
    catalogCardSetNames
  );

  for (const { prefixKey, wordCount } of prefixCandidates) {
    const members = values.filter((value) => {
      const lower = value.toLowerCase();
      return lower === prefixKey || lower.startsWith(`${prefixKey} `);
    });
    const isCatalogInsert = insertNameKeys.has(prefixKey);
    if (members.length < (isCatalogInsert ? 1 : 2)) continue;

    for (const rawValue of members) {
      const split = enriched[rawValue];
      if (!split || split.parallel) continue;

      const insertName = canonicalPrefixFromValue(rawValue, wordCount);
      const remainder = rawValue.slice(insertName.length).trim();
      const defaultCategory =
        split.cardSetCategory ??
        (isCatalogInsert || insertNameKeys.has(insertName.trim().toLowerCase())
          ? "Insert"
          : null);

      enriched[rawValue] = {
        ...split,
        cardSetName: insertName,
        parallel: remainder || null,
        cardSetCategory: defaultCategory,
      };
    }
  }

  for (const rawValue of values) {
    const split = enriched[rawValue];
    if (!split?.cardSetName || split.cardSetCategory) continue;

    const nameKey = split.cardSetName.trim().toLowerCase();
    if (insertNameKeys.has(nameKey)) {
      enriched[rawValue] = {
        ...split,
        cardSetCategory: "Insert",
      };
    }
  }
}

function catalogSetNameKeySet(catalogCardSetNames: string[]): Set<string> {
  return new Set(
    catalogCardSetNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
  );
}

function resolveCatalogCardSetNameForPrefix(
  prefix: string,
  catalogCardSetNames: string[]
): string | undefined {
  const trimmed = prefix.trim();
  if (!trimmed) return undefined;

  const catalogByKey = new Map(
    catalogCardSetNames
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => [name.toLowerCase(), name])
  );

  const direct = catalogByKey.get(trimmed.toLowerCase());
  if (direct) return direct;

  const normalizedRoot = normalizeCardSetRootName(trimmed);
  const fromRoot = catalogByKey.get(normalizedRoot.toLowerCase());
  if (fromRoot) return fromRoot;

  if (trimmed.toLowerCase() === "base") return "Base Set";

  return undefined;
}

/** True when any catalog card set name contains the parallel token (e.g. "Black Gold"). */
function parallelTokenAppearsInCatalogSetNames(
  catalogCardSetNames: string[],
  parallel: string
): boolean {
  const parallelKey = parallel.trim().toLowerCase();
  if (!parallelKey) return false;

  return catalogCardSetNames.some((name) => {
    const key = name.trim().toLowerCase();
    return (
      key === parallelKey ||
      key.endsWith(` ${parallelKey}`) ||
      key.startsWith(`${parallelKey} `) ||
      key.includes(` ${parallelKey} `)
    );
  });
}

function applyCatalogInformedParallelSplits(
  enriched: Record<string, Dm2CardSetValueSplit>,
  distinctValues: string[],
  catalogParallels: string[],
  catalogCardSetNames: string[]
): void {
  const catalogSetKeys = catalogSetNameKeySet(catalogCardSetNames);
  const sortedParallels = [...catalogParallels]
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const rawValue of distinctValues) {
    const trimmed = rawValue.trim();
    if (!trimmed) continue;

    const split = enriched[rawValue];
    if (!split || split.parallel) continue;

    if (catalogSetKeys.has(trimmed.toLowerCase())) continue;

    for (const parallel of sortedParallels) {
      const parallelLower = parallel.toLowerCase();
      const rawLower = trimmed.toLowerCase();
      if (!rawLower.endsWith(parallelLower)) continue;
      if (rawLower.length <= parallelLower.length) continue;

      const boundaryIndex = trimmed.length - parallel.length;
      if (boundaryIndex > 0 && trimmed[boundaryIndex - 1] !== " ") continue;

      const prefix = trimmed.slice(0, boundaryIndex).trim();
      if (!prefix) continue;

      const parallelInSetNames = parallelTokenAppearsInCatalogSetNames(
        catalogCardSetNames,
        parallel
      );
      const resolvedSetName = resolveCatalogCardSetNameForPrefix(
        prefix,
        catalogCardSetNames
      );

      if (parallelInSetNames) {
        if (!resolvedSetName) continue;
        if (catalogSetKeys.has(`${resolvedSetName} ${parallel}`.toLowerCase())) {
          continue;
        }
      } else if (!resolvedSetName) {
        continue;
      }

      enriched[rawValue] = {
        ...split,
        cardSetName: resolvedSetName!,
        parallel,
        cardSetCategory: inferCardSetCategory(resolvedSetName!, trimmed),
      };
      break;
    }
  }
}

export function enrichCardSetValueSplits(input: {
  distinctValues: string[];
  splits: Record<string, Dm2CardSetValueSplit>;
  catalogParallels: string[];
  catalogCardSetNames?: string[];
  catalogInsertSetNames?: string[];
}): Record<string, Dm2CardSetValueSplit> {
  const programmatic = buildProgrammaticCardSetValueSplits(input.distinctValues);
  const enriched = { ...programmatic, ...input.splits };

  for (const rawValue of input.distinctValues) {
    const trimmed = rawValue.trim();
    if (!trimmed) continue;
    if (!enriched[rawValue]) {
      enriched[rawValue] = {
        cardSetName: trimmed,
        parallel: null,
        cardSetCategory: null,
      };
    }
  }

  const parallelNames = new Set(
    input.catalogParallels.map((name) => name.trim()).filter(Boolean)
  );

  for (const split of Object.values(enriched)) {
    if (split.parallel) parallelNames.add(split.parallel);
  }

  const sortedParallels = [...parallelNames].sort((a, b) => b.length - a.length);

  for (const rawValue of input.distinctValues) {
    const split = enriched[rawValue];
    if (!split?.cardSetName || split.parallel) continue;

    const normalizedRaw = rawValue.trim();
    if (!normalizedRaw) continue;

    for (const parallel of sortedParallels) {
      const rawLower = normalizedRaw.toLowerCase();
      const parallelLower = parallel.toLowerCase();
      if (!rawLower.endsWith(parallelLower)) continue;

      const prefix = normalizedRaw
        .slice(0, normalizedRaw.length - parallel.length)
        .trim();
      if (!prefix) continue;

      const nameLower = split.cardSetName.toLowerCase();
      let nextName: string | null = null;

      if (nameLower.endsWith(parallelLower)) {
        nextName = split.cardSetName
          .slice(0, split.cardSetName.length - parallel.length)
          .trim();
        if (!nextName) {
          nextName =
            resolveCatalogCardSetNameForPrefix(
              prefix,
              input.catalogCardSetNames ?? []
            ) ?? normalizeCardSetRootName(prefix);
        }
      } else if (nameLower === prefix.toLowerCase()) {
        nextName = split.cardSetName;
      } else if (
        nameLower === rawLower ||
        split.cardSetName.trim() === normalizedRaw
      ) {
        nextName =
          resolveCatalogCardSetNameForPrefix(
            prefix,
            input.catalogCardSetNames ?? []
          ) ?? normalizeCardSetRootName(prefix);
      } else {
        continue;
      }

      if (!nextName) continue;

      if (
        catalogSetNameKeySet(input.catalogCardSetNames ?? []).has(
          normalizedRaw.toLowerCase()
        )
      ) {
        continue;
      }

      enriched[rawValue] = {
        ...split,
        cardSetName: nextName,
        parallel,
        cardSetCategory:
          split.cardSetCategory ??
          inferCardSetCategory(nextName, normalizedRaw),
      };
      break;
    }
  }

  applyCatalogInformedParallelSplits(
    enriched,
    input.distinctValues,
    input.catalogParallels,
    input.catalogCardSetNames ?? []
  );

  applySharedInsertPrefixSplits(
    enriched,
    input.distinctValues,
    input.catalogCardSetNames ?? [],
    input.catalogInsertSetNames ?? []
  );

  applyBasePrefixedCatalogSplits(
    enriched,
    input.distinctValues,
    input.catalogParallels,
    input.catalogCardSetNames ?? []
  );

  return enriched;
}

export function finalizeCardSetValueSplits(input: {
  data: Dm2SpreadsheetData;
  mapping: Dm2ColumnMapping;
  catalogParallels: string[];
  catalogCardSetNames: string[];
  catalogInsertSetNames?: string[];
}): Dm2ColumnMapping {
  const combinedColumn =
    input.mapping.combinedCardSetColumn ?? input.mapping.columns.cardSetName;
  if (combinedColumn == null) return input.mapping;

  const distinctValues = collectDistinctColumnValues({
    data: input.data,
    sheetIndex: input.mapping.sheetIndex,
    headerRowIndex: input.mapping.headerRowIndex,
    dataStartRowIndex: input.mapping.dataStartRowIndex,
    columnIndex: combinedColumn,
  });

  if (distinctValues.length === 0) return input.mapping;

  return {
    ...input.mapping,
    cardSetValueSplits: enrichCardSetValueSplits({
      distinctValues,
      splits: Object.fromEntries(
        Object.entries(input.mapping.cardSetValueSplits ?? {}).flatMap(
          ([rawValue, split]) => {
            if (!split?.cardSetName) return [];
            return [
              [
                rawValue,
                {
                  cardSetName: split.cardSetName,
                  parallel: split.parallel ?? null,
                  cardSetCategory: split.cardSetCategory ?? null,
                },
              ],
            ];
          }
        )
      ),
      catalogParallels: input.catalogParallels,
      catalogCardSetNames: input.catalogCardSetNames,
      catalogInsertSetNames: input.catalogInsertSetNames,
    }),
  };
}

export async function extractFileContent(input: {
  fileName: string;
  mimeType: string;
  buffer: ArrayBuffer;
}): Promise<string> {
  if (isSpreadsheetFile(input.fileName, input.mimeType)) {
    const data = readSpreadsheetData(
      input.buffer,
      input.fileName,
      input.mimeType
    );
    return buildSpreadsheetSampleContent(data);
  }

  if (extensionOf(input.fileName) === "pdf" || input.mimeType.includes("pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Buffer.from(input.buffer) });
    try {
      const result = await parser.getText();
      const text = result.text ?? "";
      if (text.length <= MAX_CONTENT_CHARS) return text;
      return `${text.slice(0, MAX_CONTENT_CHARS)}\n\n[Content truncated for processing]`;
    } finally {
      await parser.destroy();
    }
  }

  throw new Error(
    `Unsupported file type for ${input.fileName}. Use PDF, XLSX, XLS, or CSV.`
  );
}

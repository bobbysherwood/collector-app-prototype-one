import fs from "node:fs";
import { performance } from "node:perf_hooks";
import {
  extractRowsFromSpreadsheet,
  finalizeCardSetValueSplits,
  inferColumnMappingHeuristic,
  readSpreadsheetData,
  applySpreadsheetColumnFixes,
} from "../src/lib/dm2-import-file-content";
import {
  resolveBrandFromProgramAndBrand,
  resolveManufacturerFromProgramAndBrand,
} from "../src/lib/dm2-import-spreadsheet-split";

type BenchmarkCase = {
  name: string;
  raw: string;
  formatted: string;
};

const TEST_DIR =
  "C:/Users/bsherwood/OneDrive - HealthEdge Software, Inc/Archive/Desktop/App/Test Files/Test Files";

const CASES: BenchmarkCase[] = [
  {
    name: "Donruss 2014-15",
    raw: `${TEST_DIR}/2014 Donruss Base Brand Donruss (14-15) (Basketball).csv`,
    formatted: `${TEST_DIR}/2014 Donruss Base Brand Donruss (14-15) (Basketball)-FORMATTED.csv`,
  },
  {
    name: "Donruss 2024-25",
    raw: `${TEST_DIR}/2024 Donruss Donruss (24-25) (Basketball).csv`,
    formatted: `${TEST_DIR}/2024 Donruss Donruss (24-25) (Basketball)-FORMATTED.csv`,
  },
  {
    name: "Donruss Optic 2024-25",
    raw: `${TEST_DIR}/2024 Donruss Donruss Optic (24-25) (Basketball) (1).csv`,
    formatted: `${TEST_DIR}/2024 Donruss Donruss Optic (24-25) (Basketball) FORMATTED.csv`,
  },
  {
    name: "Spectra 2023-24",
    raw: `${TEST_DIR}/2023 Panini Spectra (23-24) (Basketball).csv`,
    formatted: `${TEST_DIR}/2023 Panini Spectra (23-24) (Basketball)-FORMATTED.csv`,
  },
  {
    name: "Select 2012-13",
    raw: `${TEST_DIR}/2012 Panini Select (12-13) (Basketball).csv`,
    formatted: `${TEST_DIR}/2012 Panini Select (12-13) (Basketball)-FORMATTED.csv`,
  },
  {
    name: "Select 2023-24",
    raw: `${TEST_DIR}/2023 Panini Select (23-24) (Basketball) - UNFORMATTED.csv`,
    formatted: `${TEST_DIR}/2023 Panini Select (23-24) (Basketball) - FORMATTED.csv`,
  },
  {
    name: "Hoops 2011-12",
    raw: `${TEST_DIR}/2011 Panini (2011-12) Hoops (Basketball).csv`,
    formatted: `${TEST_DIR}/2011 Panini (2011-12) Hoops (Basketball)-FORMATTED.csv`,
  },
  {
    name: "Hoops 2021-22",
    raw: `${TEST_DIR}/2021 Panini Hoops (21-22) (Basketball).csv`,
    formatted: `${TEST_DIR}/2021 Panini Hoops (21-22) (Basketball)-FORMATTED.csv`,
  },
  {
    name: "Mosaic 2023-24",
    raw: `${TEST_DIR}/2023 Panini Mosaic (23-24) (Basketball) - UNFORMATTED.xlsx`,
    formatted: `${TEST_DIR}/2023 Panini Mosaic (23-24) (Basketball) - FORMATTED.xlsx`,
  },
  {
    name: "Mosaic 2024-25",
    raw: `${TEST_DIR}/2024 Panini Mosaic (24-25) (Basketball).csv`,
    formatted: `${TEST_DIR}/2024 Panini Mosaic (24-25) (Basketball)-FORMATTED.csv`,
  },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function toRecordsFromSpreadsheet(path: string, buffer: ArrayBuffer): Record<string, string>[] {
  const mimeType = path.toLowerCase().endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
  const data = readSpreadsheetData(buffer, path, mimeType);
  const sheet = data.sheets[data.primarySheetIndex];
  const rows = sheet?.rows ?? [];
  if (rows.length === 0) return [];

  const headers = rows[0].map((cell) => String(cell ?? "").trim());
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, String(cells[index] ?? "").trim()]))
  );
}

function toRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const headers = rows[0];
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))
  );
}

function norm(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function cardNumberFrom(record: Record<string, string>): string {
  return norm(record["CARD NUMBER"] ?? record["Card Number"]);
}

function playerFrom(record: Record<string, string>): string {
  return norm(
    record.ATHLETE ??
      record["Player Name"] ??
      record["Palyer Name"] ??
      record["PLAYER NAME"] ??
      record.Player
  );
}

function rawCardSetFrom(record: Record<string, string>): string {
  return norm(record["CARD SET"]);
}

function expectedCardSetNameFrom(record: Record<string, string>): string {
  return norm(record["Card Set Name"] ?? record["CARD SET"]);
}

function alignmentKey(input: {
  cardNumber: string;
  player: string;
  rawCardSet?: string;
  cardSetName?: string;
  parallel?: string;
}): string {
  const cardSet =
    input.rawCardSet ||
    `${input.cardSetName ?? ""}|${input.parallel ?? ""}`;
  return `${input.cardNumber}|${input.player}|${cardSet}`;
}

function splitAlignmentKey(input: {
  cardNumber: string;
  player: string;
  cardSetName: string;
  parallel: string;
}): string {
  return `${input.cardNumber}|${input.player}|${input.cardSetName}|${input.parallel}`;
}

type ExpectedRow = {
  manufacturer: string;
  brand: string;
  cardSetName: string;
  cardSetCategory: string;
  parallel: string;
};

function expectedFromFormatted(record: Record<string, string>): ExpectedRow {
  return {
    manufacturer: norm(record.Manufacturer ?? record.Manufacterer),
    brand: norm(record.BRAND ?? record.Brand),
    cardSetName: expectedCardSetNameFrom(record),
    cardSetCategory: norm(record["Card Set Category"] ?? record["Card Set Type"]),
    parallel: norm(record.Parallel),
  };
}

function buildFormattedIndexes(formattedRecords: Record<string, string>[]) {
  const byRawKey = new Map<string, ExpectedRow>();
  const bySplitKey = new Map<string, ExpectedRow>();

  for (const record of formattedRecords) {
    const expected = expectedFromFormatted(record);
    const cardNumber = cardNumberFrom(record);
    const player = playerFrom(record);
    const rawCardSet = rawCardSetFrom(record);
    const cardSetName = expected.cardSetName;

    bySplitKey.set(
      splitAlignmentKey({
        cardNumber,
        player,
        cardSetName,
        parallel: expected.parallel,
      }),
      expected
    );

    if (
      rawCardSet &&
      rawCardSet !== cardSetName &&
      !byRawKey.has(alignmentKey({ cardNumber, player, rawCardSet }))
    ) {
      byRawKey.set(
        alignmentKey({ cardNumber, player, rawCardSet }),
        expected
      );
    }
  }

  return { byRawKey, bySplitKey };
}

function runCase(testCase: BenchmarkCase) {
  if (!fs.existsSync(testCase.raw) || !fs.existsSync(testCase.formatted)) {
    return {
      name: testCase.name,
      skipped: true as const,
      reason: "File not found",
    };
  }

  const rawBuffer = fs.readFileSync(testCase.raw);
  const rawArrayBuffer = rawBuffer.buffer.slice(
    rawBuffer.byteOffset,
    rawBuffer.byteOffset + rawBuffer.byteLength
  );
  const rawMime = testCase.raw.toLowerCase().endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
  const rawRecords =
    rawMime === "text/csv"
      ? toRecords(rawBuffer.toString("utf8"))
      : toRecordsFromSpreadsheet(testCase.raw, rawArrayBuffer);

  const formattedBuffer = fs.readFileSync(testCase.formatted);
  const formattedArrayBuffer = formattedBuffer.buffer.slice(
    formattedBuffer.byteOffset,
    formattedBuffer.byteOffset + formattedBuffer.byteLength
  );
  const formattedRecords = testCase.formatted.toLowerCase().endsWith(".xlsx")
    ? toRecordsFromSpreadsheet(testCase.formatted, formattedArrayBuffer)
    : toRecords(formattedBuffer.toString("utf8"));
  const { byRawKey, bySplitKey } = buildFormattedIndexes(formattedRecords);
  const expectedByRowIndex = formattedRecords.map((record) =>
    expectedFromFormatted(record)
  );

  const start = performance.now();
  const spreadsheet = readSpreadsheetData(rawArrayBuffer, testCase.raw, rawMime);
  const heuristic = inferColumnMappingHeuristic(spreadsheet);
  if (!heuristic) {
    return {
      name: testCase.name,
      skipped: true as const,
      reason: "Heuristic mapping failed",
    };
  }

  const sheet = spreadsheet.sheets[heuristic.sheetIndex];
  const headerRow = sheet.rows[heuristic.headerRowIndex] ?? [];
  const mapping = finalizeCardSetValueSplits({
    data: spreadsheet,
    mapping: applySpreadsheetColumnFixes(heuristic, headerRow),
    catalogParallels: [],
    catalogCardSetNames: [],
    catalogInsertSetNames: [],
  });
  const { rows } = extractRowsFromSpreadsheet({
    data: spreadsheet,
    mapping,
    fileName: testCase.raw,
  });
  const elapsedMs = performance.now() - start;

  let fullMatch = 0;
  let splitMatch = 0;
  let metadataMatch = 0;
  let nameMismatch = 0;
  let parallelMismatch = 0;
  let categoryMismatch = 0;
  let brandMismatch = 0;
  let manufacturerMismatch = 0;
  let unmatched = 0;
  const sampleMismatches: string[] = [];

  const rawBySourceRow = new Map<number, Record<string, string>>();
  for (let i = 0; i < rawRecords.length; i++) {
    const rawRecord = rawRecords[i];
    const cardNumber = cardNumberFrom(rawRecord);
    const player = playerFrom(rawRecord);
    const rawCardSet = rawCardSetFrom(rawRecord);
    if (!cardNumber && !player && !rawCardSet) continue;
    rawBySourceRow.set(i + 2, rawRecord);
  }

  for (const got of rows) {
    const rawRecord = rawBySourceRow.get(got.sourceRowIndex);
    const rawCardSet = rawRecord ? rawCardSetFrom(rawRecord) : "";

    const gotView = {
      manufacturer: norm(got.manufacturer),
      brand: norm(got.brand),
      cardSetName: norm(got.cardSetName),
      cardSetCategory: norm(got.cardSetCategory),
      parallel: norm(got.parallel),
    };

    const expected =
      bySplitKey.get(
        splitAlignmentKey({
          cardNumber: norm(got.cardNumber),
          player: norm(got.player),
          cardSetName: gotView.cardSetName,
          parallel: gotView.parallel,
        })
      ) ??
      (rawCardSet
        ? byRawKey.get(
            alignmentKey({
              cardNumber: norm(got.cardNumber),
              player: norm(got.player),
              rawCardSet,
            })
          )
        : undefined) ??
      expectedByRowIndex[got.sourceRowIndex - 2];

    if (!expected) {
      unmatched++;
      continue;
    }

    const splitOk =
      gotView.cardSetName === expected.cardSetName &&
      gotView.cardSetCategory === expected.cardSetCategory &&
      gotView.parallel === expected.parallel;

    const metadataOk =
      gotView.manufacturer === expected.manufacturer &&
      gotView.brand === expected.brand;

    if (splitOk) splitMatch++;
    if (metadataOk) metadataMatch++;
    if (splitOk && metadataOk) {
      fullMatch++;
      continue;
    }

    if (gotView.manufacturer !== expected.manufacturer) manufacturerMismatch++;
    if (gotView.brand !== expected.brand) brandMismatch++;
    if (gotView.cardSetName !== expected.cardSetName) nameMismatch++;
    if (gotView.cardSetCategory !== expected.cardSetCategory) categoryMismatch++;
    if (gotView.parallel !== expected.parallel) parallelMismatch++;

    if (sampleMismatches.length < 5) {
      sampleMismatches.push(
        `${norm(got.cardNumber)} ${norm(got.player)} raw=${rawCardSet}: got ${JSON.stringify(gotView)} vs ${JSON.stringify(expected)}`
      );
    }
  }

  const compared = rows.length - unmatched;

  return {
    name: testCase.name,
    skipped: false as const,
    rowCount: rows.length,
    compared,
    unmatched,
    fullMatch,
    splitMatch,
    metadataMatch,
    matchPct: compared > 0 ? ((fullMatch / compared) * 100).toFixed(1) : "0.0",
    splitPct: compared > 0 ? ((splitMatch / compared) * 100).toFixed(1) : "0.0",
    metadataPct:
      compared > 0 ? ((metadataMatch / compared) * 100).toFixed(1) : "0.0",
    nameMismatch,
    categoryMismatch,
    parallelMismatch,
    brandMismatch,
    manufacturerMismatch,
    elapsedMs: Math.round(elapsedMs),
    defaultBrand: mapping.defaultMetadata.brand ?? "",
    defaultManufacturer: mapping.defaultMetadata.manufacturer ?? "",
    sampleMismatches,
  };
}

console.log("Loader regression benchmark\n");
const results = CASES.map(runCase);
let totalRows = 0;
let totalMs = 0;

console.log(
  "| Case | Rows | Compared | Full % | Split % | Metadata % | Time (ms) |"
);
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

for (const result of results) {
  if (result.skipped) {
    console.log(`| ${result.name} | SKIPPED | | | | | (${result.reason}) |`);
    continue;
  }

  totalRows += result.rowCount;
  totalMs += result.elapsedMs;

  console.log(
    `| ${result.name} | ${result.rowCount.toLocaleString()} | ${result.compared.toLocaleString()} | ${result.matchPct}% | ${result.splitPct}% | ${result.metadataPct}% | ${result.elapsedMs.toLocaleString()} |`
  );

  if (
    result.unmatched > 0 ||
    result.nameMismatch > 0 ||
    result.parallelMismatch > 0 ||
    result.categoryMismatch > 0 ||
    result.brandMismatch > 0 ||
    result.manufacturerMismatch > 0
  ) {
    console.log(`\n${result.name} details:`);
    if (result.unmatched > 0) {
      console.log(`  Unmatched rows: ${result.unmatched}`);
    }
    console.log(
      `  Mismatches — name: ${result.nameMismatch}, parallel: ${result.parallelMismatch}, category: ${result.categoryMismatch}, brand: ${result.brandMismatch}, manufacturer: ${result.manufacturerMismatch}`
    );
    console.log(
      `  Default metadata — brand: ${result.defaultBrand || "—"}, manufacturer: ${result.defaultManufacturer || "—"}`
    );
    if (result.sampleMismatches.length > 0) {
      console.log("  Samples:");
      for (const sample of result.sampleMismatches) {
        console.log(`    ${sample}`);
      }
    }
    console.log("");
  }
}

console.log(
  `\nTotal: ${totalRows.toLocaleString()} rows processed in ${totalMs.toLocaleString()}ms (${(totalRows / (totalMs / 1000)).toFixed(0)} rows/sec)`
);

console.log("\nBrand / manufacturer resolver:");
const resolverCases: Array<[string, string, string | undefined, string | undefined]> = [
  ["Base Brand Donruss (14-15)", "Donruss", undefined, undefined],
  ["Donruss (24-25)", "Donruss", undefined, undefined],
  ["Donruss Optic (24-25)", "Donruss", undefined, undefined],
  ["Spectra (23-24)", "Panini", undefined, undefined],
  ["Spectra(15-16)", "Panini", undefined, undefined],
  ["Hoops (21-22)", "Panini", undefined, undefined],
  ["(2011-12) Hoops", "Panini", undefined, undefined],
];
for (const [program, brand, ,] of resolverCases) {
  const resolvedBrand = resolveBrandFromProgramAndBrand(program, brand);
  const resolvedManufacturer = resolveManufacturerFromProgramAndBrand(
    program,
    brand,
    resolvedBrand
  );
  console.log(
    `  PROGRAM="${program}" BRAND="${brand}" → brand="${resolvedBrand ?? "—"}", manufacturer="${resolvedManufacturer ?? "—"}"`
  );
}

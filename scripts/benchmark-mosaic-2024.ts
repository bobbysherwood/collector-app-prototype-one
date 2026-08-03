import fs from "node:fs";
import { performance } from "node:perf_hooks";
import {
  buildCardSetSplitIndex,
  resolveBrandFromProgramAndBrand,
  resolveManufacturerFromProgramAndBrand,
} from "../src/lib/dm2-import-spreadsheet-split";
import {
  enrichCardSetValueSplits,
  extractRowsFromSpreadsheet,
  finalizeCardSetValueSplits,
  inferColumnMappingHeuristic,
  readSpreadsheetData,
  applySpreadsheetColumnFixes,
} from "../src/lib/dm2-import-file-content";

const TEST_DIR =
  "C:/Users/bsherwood/OneDrive - HealthEdge Software, Inc/Archive/Desktop/App/Test Files/Test Files";
const RAW = `${TEST_DIR}/2024 Panini Mosaic (24-25) (Basketball).csv`;
const FMT = `${TEST_DIR}/2024 Panini Mosaic (24-25) (Basketball)-FORMATTED.csv`;

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
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

type Expected = { name: string; category: string; parallel: string };

const raw = parseCsv(fs.readFileSync(RAW, "utf8"));
const fmt = parseCsv(fs.readFileSync(FMT, "utf8"));
const ri = Object.fromEntries(raw[0].map((h, i) => [h, i]));
const fi = Object.fromEntries(fmt[0].map((h, i) => [h, i]));
const categoryCol =
  fi["Card Set Category"] != null ? "Card Set Category" : "Card Set Type";

const expected = new Map<string, Expected>();
for (let i = 1; i < raw.length; i++) {
  const cs = raw[i][ri["CARD SET"]].trim();
  expected.set(cs, {
    name: fmt[i][fi["Card Set Name"]].trim(),
    category: (fmt[i][fi[categoryCol]] ?? "").trim(),
    parallel: (fmt[i][fi["Parallel"]] ?? "").trim(),
  });
}

const distinctValues = [...expected.keys()].sort();
const splitIndex = buildCardSetSplitIndex(distinctValues);
const enriched = enrichCardSetValueSplits({
  distinctValues,
  splits: Object.fromEntries(
    [...splitIndex.entries()].map(([k, s]) => [
      k,
      {
        cardSetName: s.cardSetName,
        parallel: s.parallel ?? null,
        cardSetCategory: s.cardSetCategory,
      },
    ])
  ),
  catalogParallels: [],
  catalogCardSetNames: [],
  catalogInsertSetNames: [],
});

console.log("2024 Panini Mosaic (24-25) — CARD SET split benchmark\n");
console.log(`Raw rows: ${raw.length - 1}`);
console.log(`Formatted rows: ${fmt.length - 1}`);
console.log(`Distinct CARD SET values: ${distinctValues.length}\n`);

let match = 0;
type MismatchDetail = {
  rawVal: string;
  got: { name: string; category: string; parallel: string };
  exp: Expected;
  fields: string[];
};
const mismatches: MismatchDetail[] = [];

for (const rawVal of distinctValues) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  const got = {
    name: act.cardSetName,
    category: act.cardSetCategory ?? "",
    parallel: act.parallel ?? "",
  };
  const fields: string[] = [];
  if (got.name !== exp.name) fields.push("name");
  if (got.category !== exp.category) fields.push("category");
  if (got.parallel !== exp.parallel) fields.push("parallel");
  const ok = fields.length === 0;
  if (ok) {
    match++;
    continue;
  }
  mismatches.push({ rawVal, got, exp, fields });
}

// Group by pattern: field issues + expected tuple
const patternGroups = new Map<
  string,
  { count: number; samples: MismatchDetail[]; rowImpact: number }
>();
const rowCounts = new Map<string, number>();
for (let i = 1; i < raw.length; i++) {
  const cs = raw[i][ri["CARD SET"]].trim();
  rowCounts.set(cs, (rowCounts.get(cs) ?? 0) + 1);
}

for (const m of mismatches) {
  const patternKey = `[${m.fields.join("+")}] exp="${m.exp.name}|${m.exp.category}|${m.exp.parallel || "(empty)"}" → got="${m.got.name}|${m.got.category}|${m.got.parallel || "(empty)"}"`;
  const group = patternGroups.get(patternKey) ?? {
    count: 0,
    samples: [],
    rowImpact: 0,
  };
  group.count++;
  group.rowImpact += rowCounts.get(m.rawVal) ?? 0;
  if (group.samples.length < 3) group.samples.push(m);
  patternGroups.set(patternKey, group);
}

const sortedPatterns = [...patternGroups.entries()].sort(
  (a, b) => b[1].rowImpact - a[1].rowImpact
);

console.log("=== Top mismatch patterns (by row impact) ===\n");
for (const [pattern, group] of sortedPatterns.slice(0, 25)) {
  console.log(`${pattern}`);
  console.log(`  distinct: ${group.count}, rows: ${group.rowImpact}`);
  for (const s of group.samples) {
    console.log(`    raw="${s.rawVal}"`);
  }
  console.log("");
}

let missedRows = 0;
for (const m of mismatches) {
  missedRows += rowCounts.get(m.rawVal) ?? 0;
}

const program = raw[1]?.[ri["PROGRAM"]]?.trim() ?? "";
const brand = raw[1]?.[ri["BRAND"]]?.trim() ?? "";
const resolvedBrand = resolveBrandFromProgramAndBrand(program, brand);
const resolvedMfr = resolveManufacturerFromProgramAndBrand(program, brand);

console.log("=== Summary ===");
console.log(
  `Distinct match: ${match}/${distinctValues.length} (${((match / distinctValues.length) * 100).toFixed(1)}%)`
);
console.log(
  `Row impact: ${missedRows}/${raw.length - 1} (${((missedRows / (raw.length - 1)) * 100).toFixed(1)}%)`
);
console.log(
  `Brand: PROGRAM="${program}" BRAND="${brand}" → brand="${resolvedBrand}", mfr="${resolvedMfr}" (expected: Mosaic / Panini)`
);

// Full pipeline
const t0 = performance.now();
const rawBuffer = fs.readFileSync(RAW);
const rawArrayBuffer = rawBuffer.buffer.slice(
  rawBuffer.byteOffset,
  rawBuffer.byteOffset + rawBuffer.byteLength
);
const spreadsheet = readSpreadsheetData(rawArrayBuffer, RAW, "text/csv");
const heuristic = inferColumnMappingHeuristic(spreadsheet);
const sheet = spreadsheet.sheets[heuristic!.sheetIndex];
const headerRow = sheet.rows[heuristic!.headerRowIndex] ?? [];
const mapping = finalizeCardSetValueSplits({
  data: spreadsheet,
  mapping: applySpreadsheetColumnFixes(heuristic!, headerRow),
  catalogParallels: [],
  catalogCardSetNames: [],
  catalogInsertSetNames: [],
});
const { rows } = extractRowsFromSpreadsheet({
  data: spreadsheet,
  mapping,
  fileName: RAW,
});
const pipelineMs = performance.now() - t0;

// Row-level full match (split + metadata)
const fmtManufacturer = fmt[1]?.[fi["Manufacturer"]]?.trim() ?? "Panini";
const fmtBrand = fmt[1]?.[fi["Brand"]]?.trim() ?? "Mosaic";

let rowFullMatch = 0;
let rowSplitMatch = 0;
for (let i = 0; i < rows.length; i++) {
  const got = rows[i];
  const expIdx = got.sourceRowIndex - 2;
  if (expIdx < 0 || expIdx >= fmt.length - 1) continue;
  const exp = {
    name: fmt[expIdx + 1][fi["Card Set Name"]].trim(),
    category: (fmt[expIdx + 1][fi[categoryCol]] ?? "").trim(),
    parallel: (fmt[expIdx + 1][fi["Parallel"]] ?? "").trim(),
    manufacturer: fmtManufacturer,
    brand: fmtBrand,
  };
  const splitOk =
    got.cardSetName === exp.name &&
    (got.cardSetCategory ?? "") === exp.category &&
    (got.parallel ?? "") === exp.parallel;
  const metaOk =
    (got.manufacturer ?? "") === exp.manufacturer &&
    (got.brand ?? "") === exp.brand;
  if (splitOk) rowSplitMatch++;
  if (splitOk && metaOk) rowFullMatch++;
}

console.log(
  `Row split match: ${rowSplitMatch}/${rows.length} (${((rowSplitMatch / rows.length) * 100).toFixed(1)}%)`
);
console.log(
  `Row full match: ${rowFullMatch}/${rows.length} (${((rowFullMatch / rows.length) * 100).toFixed(1)}%)`
);
console.log(
  `Full pipeline: ${rows.length} rows in ${Math.round(pipelineMs)}ms (${Math.round(rows.length / (pipelineMs / 1000))} rows/sec)`
);
console.log(
  `Default metadata: brand="${mapping.defaultMetadata.brand ?? ""}", manufacturer="${mapping.defaultMetadata.manufacturer ?? ""}"`
);

// Field-level mismatch counts at distinct level
const fieldCounts = { name: 0, category: 0, parallel: 0 };
for (const m of mismatches) {
  for (const f of m.fields) fieldCounts[f as keyof typeof fieldCounts]++;
}
console.log(
  `\nDistinct-level field mismatches: name=${fieldCounts.name}, category=${fieldCounts.category}, parallel=${fieldCounts.parallel}`
);

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
const RAW = `${TEST_DIR}/2021 Panini Hoops (21-22) (Basketball).csv`;
const FMT = `${TEST_DIR}/2021 Panini Hoops (21-22) (Basketball)-FORMATTED.csv`;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

const raw = parseCsv(fs.readFileSync(RAW, "utf8"));
const fmt = parseCsv(fs.readFileSync(FMT, "utf8"));
const ri = Object.fromEntries(raw[0].map((h, i) => [h, i]));
const fi = Object.fromEntries(fmt[0].map((h, i) => [h, i]));

const categoryCol = fi["Card Set Category"] != null ? "Card Set Category" : "Card Set Type";

const expected = new Map<string, { name: string; category: string; parallel: string }>();
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
      { cardSetName: s.cardSetName, parallel: s.parallel ?? null, cardSetCategory: s.cardSetCategory },
    ])
  ),
  catalogParallels: [],
  catalogCardSetNames: [],
  catalogInsertSetNames: [],
});

console.log("2021 Panini Hoops — CARD SET split benchmark\n");
console.log(`Distinct CARD SET values: ${distinctValues.length}\n`);

let match = 0;
const mismatchPatterns = new Map<string, string[]>();

for (const rawVal of distinctValues) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  const ok =
    act.cardSetName === exp.name &&
    (act.cardSetCategory ?? "") === exp.category &&
    (act.parallel ?? "") === exp.parallel;
  if (ok) {
    match++;
    continue;
  }
  const pattern = `${exp.name}|${exp.category}|${exp.parallel || "(empty)"}`;
  if (!mismatchPatterns.has(pattern)) mismatchPatterns.set(pattern, []);
  mismatchPatterns.get(pattern)!.push(
    `raw="${rawVal}" → ${act.cardSetName}|${act.cardSetCategory}|${act.parallel ?? "(empty)"}`
  );
}

for (const [pattern, samples] of mismatchPatterns) {
  console.log(`Expected: ${pattern}`);
  for (const s of samples.slice(0, 3)) console.log(`  ${s}`);
  if (samples.length > 3) console.log(`  ... +${samples.length - 3} more`);
}

const counts = new Map<string, number>();
for (let i = 1; i < raw.length; i++) {
  counts.set(raw[i][ri["CARD SET"]].trim(), (counts.get(raw[i][ri["CARD SET"]].trim()) ?? 0) + 1);
}
let missedRows = 0;
for (const rawVal of distinctValues) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  const ok = act.cardSetName === exp.name && (act.cardSetCategory ?? "") === exp.category && (act.parallel ?? "") === exp.parallel;
  if (!ok) missedRows += counts.get(rawVal) ?? 0;
}

const program = raw[1]?.[ri["PROGRAM"]]?.trim() ?? "";
const brand = raw[1]?.[ri["BRAND"]]?.trim() ?? "";
console.log(`\nMatch: ${match}/${distinctValues.length} (${((match / distinctValues.length) * 100).toFixed(1)}%)`);
console.log(`Row impact: ${missedRows}/${raw.length - 1} rows (${((missedRows / (raw.length - 1)) * 100).toFixed(1)}%)`);
console.log(
  `Brand: PROGRAM="${program}" BRAND="${brand}" → brand="${resolveBrandFromProgramAndBrand(program, brand)}", mfr="${resolveManufacturerFromProgramAndBrand(program, brand)}" (expected: Hoops / Panini)`
);

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
console.log(
  `\nFull pipeline: ${rows.length} rows in ${Math.round(pipelineMs)}ms (${Math.round(rows.length / (pipelineMs / 1000))} rows/sec)`
);

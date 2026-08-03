import fs from "node:fs";
import { performance } from "node:perf_hooks";
import {
  extractRowsFromSpreadsheet,
  finalizeCardSetValueSplits,
  inferColumnMappingHeuristic,
  readSpreadsheetData,
  applySpreadsheetColumnFixes,
} from "../src/lib/dm2-import-file-content";

const RAW =
  "C:/Users/bsherwood/OneDrive - HealthEdge Software, Inc/Archive/Desktop/App/Test Files/Test Files/2024 Panini Mosaic (24-25) (Basketball).csv";
const FMT =
  "C:/Users/bsherwood/OneDrive - HealthEdge Software, Inc/Archive/Desktop/App/Test Files/Test Files/2024 Panini Mosaic (24-25) (Basketball)-FORMATTED.csv";

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

const fmt = parseCsv(fs.readFileSync(FMT, "utf8"));
const fi = Object.fromEntries(fmt[0].map((h, i) => [h, i]));
const categoryCol =
  fi["Card Set Category"] != null ? "Card Set Category" : "Card Set Type";
const fmtManufacturer = fmt[1]?.[fi["Manufacturer"]]?.trim() ?? "Panini";
const fmtBrand = fmt[1]?.[fi["Brand"]]?.trim() ?? "Mosaic";

console.log("Loading raw spreadsheet...");
const t0 = performance.now();
const rawBuffer = fs.readFileSync(RAW);
const rawArrayBuffer = rawBuffer.buffer.slice(
  rawBuffer.byteOffset,
  rawBuffer.byteOffset + rawBuffer.byteLength
);
const spreadsheet = readSpreadsheetData(rawArrayBuffer, RAW, "text/csv");
console.log(`  readSpreadsheetData: ${Math.round(performance.now() - t0)}ms`);

const t1 = performance.now();
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
console.log(`  finalizeCardSetValueSplits: ${Math.round(performance.now() - t1)}ms`);

const t2 = performance.now();
const { rows } = extractRowsFromSpreadsheet({
  data: spreadsheet,
  mapping,
  fileName: RAW,
});
const pipelineMs = performance.now() - t0;
const extractMs = performance.now() - t2;
console.log(`  extractRowsFromSpreadsheet: ${Math.round(extractMs)}ms`);
console.log(`Full pipeline: ${rows.length} rows in ${Math.round(pipelineMs)}ms (${Math.round(rows.length / (pipelineMs / 1000))} rows/sec)`);
console.log(
  `Default metadata: brand="${mapping.defaultMetadata.brand ?? ""}", manufacturer="${mapping.defaultMetadata.manufacturer ?? ""}"`
);

const t3 = performance.now();
let rowFullMatch = 0;
let rowSplitMatch = 0;
let nameMiss = 0;
let parallelMiss = 0;
let categoryMiss = 0;

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
  if (got.cardSetName !== exp.name) nameMiss++;
  if ((got.cardSetCategory ?? "") !== exp.category) categoryMiss++;
  if ((got.parallel ?? "") !== exp.parallel) parallelMiss++;

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

console.log(`Row comparison: ${Math.round(performance.now() - t3)}ms`);
console.log(
  `Row split match: ${rowSplitMatch}/${rows.length} (${((rowSplitMatch / rows.length) * 100).toFixed(1)}%)`
);
console.log(
  `Row full match: ${rowFullMatch}/${rows.length} (${((rowFullMatch / rows.length) * 100).toFixed(1)}%)`
);
console.log(
  `Row mismatches — name: ${nameMiss}, parallel: ${parallelMiss}, category: ${categoryMiss}`
);

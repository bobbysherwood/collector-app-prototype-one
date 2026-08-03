import fs from "node:fs";
import {
  buildCardSetSplitIndex,
  resolveBrandFromProgramAndBrand,
  resolveManufacturerFromProgramAndBrand,
} from "../src/lib/dm2-import-spreadsheet-split";
import { enrichCardSetValueSplits } from "../src/lib/dm2-import-file-content";

const TEST_DIR =
  "C:/Users/bsherwood/OneDrive - HealthEdge Software, Inc/Archive/Desktop/App/Test Files/Test Files";
const RAW = `${TEST_DIR}/2011 Panini (2011-12) Hoops (Basketball).csv`;
const FMT = `${TEST_DIR}/2011 Panini (2011-12) Hoops (Basketball)-FORMATTED.csv`;

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
console.log(`Distinct CARD SET values: ${distinctValues.length}\n`);
for (const rawVal of distinctValues) {
  const exp = expected.get(rawVal)!;
  const n = raw.slice(1).filter((row) => row[ri["CARD SET"]].trim() === rawVal).length;
  console.log(`${n}x ${rawVal} => ${exp.name} | ${exp.category} | ${exp.parallel || "(empty)"}`);
}
console.log("");

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

console.log("2011 Panini Hoops — CARD SET split benchmark\n");
let match = 0;
for (const rawVal of distinctValues) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  const ok =
    act.cardSetName === exp.name &&
    (act.cardSetCategory ?? "") === exp.category &&
    (act.parallel ?? "") === exp.parallel;
  if (ok) {
    match++;
  } else {
    console.log(`MISS ${rawVal}`);
    console.log(`  expected: ${exp.name} | ${exp.category} | ${exp.parallel || "(empty)"}`);
    console.log(`  actual:   ${act.cardSetName} | ${act.cardSetCategory} | ${act.parallel ?? "(empty)"}`);
  }
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

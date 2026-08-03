import fs from "node:fs";
import {
  buildCardSetSplitIndex,
} from "../src/lib/dm2-import-spreadsheet-split";
import { enrichCardSetValueSplits } from "../src/lib/dm2-import-file-content";
import {
  resolveBrandFromProgramAndBrand,
  resolveManufacturerFromProgramAndBrand,
} from "../src/lib/dm2-import-spreadsheet-split";

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

const raw = parseCsv(fs.readFileSync("C:/Users/bsherwood/Downloads/2012 Panini Select (12-13) (Basketball).csv", "utf8"));
const fmt = parseCsv(fs.readFileSync("C:/Users/bsherwood/Downloads/2012 Panini Select (12-13) (Basketball)-FORMATTED.csv", "utf8"));
const ri = Object.fromEntries(raw[0].map((h, i) => [h, i]));
const fi = Object.fromEntries(fmt[0].map((h, i) => [h, i]));

const expected = new Map<string, { name: string; category: string; parallel: string }>();
for (let i = 1; i < raw.length; i++) {
  const cs = raw[i][ri["CARD SET"]].trim();
  expected.set(cs, {
    name: fmt[i][fi["Card Set Name"]].trim(),
    category: fmt[i][fi["Card Set Category"]].trim(),
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

console.log("2012 Panini Select — CARD SET split benchmark\n");
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
    console.log(`  programmatic: ${splitIndex.get(rawVal)?.cardSetName} | ${splitIndex.get(rawVal)?.parallel ?? ""}`);
  }
}
console.log(`\nMatch: ${match}/${distinctValues.length} (${((match / distinctValues.length) * 100).toFixed(1)}%)`);
console.log(`Brand: ${resolveBrandFromProgramAndBrand("Select (12-13)", "Panini")} / ${resolveManufacturerFromProgramAndBrand("Select (12-13)", "Panini")}`);

const counts = new Map<string, number>();
for (let i = 1; i < raw.length; i++) {
  const cs = raw[i][ri["CARD SET"]].trim();
  counts.set(cs, (counts.get(cs) ?? 0) + 1);
}
let missedRows = 0;
for (const rawVal of distinctValues) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  const ok = act.cardSetName === exp.name && (act.cardSetCategory ?? "") === exp.category && (act.parallel ?? "") === exp.parallel;
  if (!ok) missedRows += counts.get(rawVal) ?? 0;
}
console.log(`Row impact: ${missedRows}/${raw.length - 1} rows (${((missedRows / (raw.length - 1)) * 100).toFixed(1)}%) affected by split mismatches`);

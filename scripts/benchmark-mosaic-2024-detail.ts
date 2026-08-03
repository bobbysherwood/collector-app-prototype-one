import fs from "node:fs";
import { buildCardSetSplitIndex } from "../src/lib/dm2-import-spreadsheet-split";
import { enrichCardSetValueSplits } from "../src/lib/dm2-import-file-content";

const TEST_DIR = "C:/Users/bsherwood/OneDrive - HealthEdge Software, Inc/Archive/Desktop/App/Test Files/Test Files";
const RAW = `${TEST_DIR}/2024 Panini Mosaic (24-25) (Basketball).csv`;
const FMT = `${TEST_DIR}/2024 Panini Mosaic (24-25) (Basketball)-FORMATTED.csv`;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) { if (ch === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else inQuotes = false; } else cell += ch; continue; }
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
const categoryCol = "Card Set Category";

const expected = new Map<string, { name: string; category: string; parallel: string }>();
for (let i = 1; i < raw.length; i++) {
  const cs = raw[i][ri["CARD SET"]].trim();
  expected.set(cs, { name: fmt[i][fi["Card Set Name"]].trim(), category: fmt[i][fi[categoryCol]].trim(), parallel: fmt[i][fi["Parallel"]].trim() });
}

const distinctValues = [...expected.keys()];
const splitIndex = buildCardSetSplitIndex(distinctValues);
const enriched = enrichCardSetValueSplits({
  distinctValues,
  splits: Object.fromEntries([...splitIndex.entries()].map(([k, s]) => [k, { cardSetName: s.cardSetName, parallel: s.parallel ?? null, cardSetCategory: s.cardSetCategory }])),
  catalogParallels: [], catalogCardSetNames: [], catalogInsertSetNames: [],
});

const rowCounts = new Map<string, number>();
for (let i = 1; i < raw.length; i++) {
  const cs = raw[i][ri["CARD SET"]].trim();
  rowCounts.set(cs, (rowCounts.get(cs) ?? 0) + 1);
}

console.log("=== Parallel-only mismatches (name+category match) ===\n");
let caseOnly = 0, typo = 0, structural = 0;
for (const rawVal of distinctValues) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  if (act.cardSetName !== exp.name || (act.cardSetCategory ?? "") !== exp.category) continue;
  if ((act.parallel ?? "") === exp.parallel) continue;
  const actP = act.parallel ?? "";
  const caseDiff = actP.toLowerCase() === exp.parallel.toLowerCase();
  if (caseDiff) { caseOnly++; continue; }
  if (exp.parallel.includes("Vinyal") || exp.parallel.includes("vinyal")) { typo++; console.log(`[TYPO in formatted] raw="${rawVal}" exp="${exp.parallel}" got="${actP}" rows=${rowCounts.get(rawVal)}`); continue; }
  structural++;
  console.log(`[STRUCTURAL] raw="${rawVal}" exp="${exp.parallel}" got="${actP}" rows=${rowCounts.get(rawVal)}`);
}
console.log(`\nCase-only: ${caseOnly}, Formatted typos: ${typo}, Structural: ${structural}`);

console.log("\n=== Cross-product values detail ===");
for (const rawVal of distinctValues.filter(v => /^\d{4} Panini/.test(v))) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  console.log(`raw="${rawVal}"`);
  console.log(`  exp: ${exp.name}|${exp.category}|${exp.parallel}`);
  console.log(`  got: ${act.cardSetName}|${act.cardSetCategory}|${act.parallel ?? ""}`);
}

console.log("\n=== Rookie Variations category ===");
for (const rawVal of distinctValues.filter(v => v.startsWith("Rookie Variations"))) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  if ((act.cardSetCategory ?? "") !== exp.category) {
    console.log(`raw="${rawVal}" expCat=${exp.category} gotCat=${act.cardSetCategory}`);
  }
}

import fs from "node:fs";
import {
  buildCardSetSplitIndex,
} from "../src/lib/dm2-import-spreadsheet-split";
import {
  enrichCardSetValueSplits,
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

const distinctValues = [...expected.keys()];
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

const rowCounts = new Map<string, number>();
for (let i = 1; i < raw.length; i++) {
  const cs = raw[i][ri["CARD SET"]].trim();
  rowCounts.set(cs, (rowCounts.get(cs) ?? 0) + 1);
}

// Categorize mismatches
type Cat = { label: string; count: number; rows: number; samples: string[] };
const cats = new Map<string, Cat>();

function addCat(label: string, rawVal: string, detail: string) {
  const c = cats.get(label) ?? { label, count: 0, rows: 0, samples: [] };
  c.count++;
  c.rows += rowCounts.get(rawVal) ?? 0;
  if (c.samples.length < 3) c.samples.push(`${rawVal} → ${detail}`);
  cats.set(label, c);
}

for (const rawVal of distinctValues) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  const ok = act.cardSetName === exp.name && (act.cardSetCategory ?? "") === exp.category && (act.parallel ?? "") === exp.parallel;
  if (ok) continue;

  const got = `${act.cardSetName}|${act.cardSetCategory}|${act.parallel ?? ""}`;
  const expStr = `${exp.name}|${exp.category}|${exp.parallel}`;

  if (exp.name === "Base" && act.cardSetName === "Base Set" && exp.category === act.cardSetCategory) {
    addCat("Base → Base Set name normalization", rawVal, got);
  } else if (rawVal.startsWith("2024 Panini") || rawVal.match(/^\d{4} Panini/)) {
    addCat("Cross-product year-prefixed values (Origins/Hoops/etc)", rawVal, `exp=${expStr} got=${got}`);
  } else if (rawVal.includes("Mosaic") && exp.parallel && !act.parallel) {
    addCat("Mosaic tier not peeled to parallel", rawVal, `exp=${expStr} got=${got}`);
  } else if (rawVal.includes("Fast Break") && exp.parallel && !act.parallel?.includes("Fast Break")) {
    addCat("Fast Break tier not peeled", rawVal, `exp=${expStr} got=${got}`);
  } else if (exp.parallel && act.parallel && exp.parallel !== act.parallel) {
    addCat("Parallel text mismatch", rawVal, `exp=${expStr} got=${got}`);
  } else if (exp.name !== act.cardSetName) {
    addCat("Card set name mismatch (other)", rawVal, `exp=${expStr} got=${got}`);
  } else if (exp.category !== (act.cardSetCategory ?? "")) {
    addCat("Category mismatch", rawVal, `exp=${expStr} got=${got}`);
  } else {
    addCat("Other", rawVal, `exp=${expStr} got=${got}`);
  }
}

console.log("Mismatch categories by row impact:\n");
for (const c of [...cats.values()].sort((a, b) => b.rows - a.rows)) {
  console.log(`${c.label}: ${c.count} distinct, ${c.rows} rows`);
  for (const s of c.samples) console.log(`  ${s}`);
  console.log("");
}

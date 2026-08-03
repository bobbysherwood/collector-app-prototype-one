import fs from "node:fs";
import {
  buildCardSetSplitIndex,
} from "../src/lib/dm2-import-spreadsheet-split";
import {
  enrichCardSetValueSplits,
  readSpreadsheetData,
} from "../src/lib/dm2-import-file-content";

const TEST_DIR =
  "C:/Users/bsherwood/OneDrive - HealthEdge Software, Inc/Archive/Desktop/App/Test Files/Test Files";
const RAW = `${TEST_DIR}/2023 Panini Mosaic (23-24) (Basketball) - UNFORMATTED.xlsx`;
const FMT = `${TEST_DIR}/2023 Panini Mosaic (23-24) (Basketball) - FORMATTED.xlsx`;

function toRecords(path: string, buffer: ArrayBuffer): Record<string, string>[] {
  const mime =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const data = readSpreadsheetData(buffer, path, mime);
  const sheet = data.sheets[data.primarySheetIndex];
  const rows = sheet?.rows ?? [];
  if (rows.length === 0) return [];
  const headers = rows[0].map((cell) => String(cell ?? "").trim());
  return rows.slice(1).map((cells) =>
    Object.fromEntries(
      headers.map((header, index) => [header, String(cells[index] ?? "").trim()])
    )
  );
}

const rawBuffer = fs.readFileSync(RAW);
const rawArrayBuffer = rawBuffer.buffer.slice(
  rawBuffer.byteOffset,
  rawBuffer.byteOffset + rawBuffer.byteLength
);
const fmtBuffer = fs.readFileSync(FMT);
const fmtArrayBuffer = fmtBuffer.buffer.slice(
  fmtBuffer.byteOffset,
  fmtBuffer.byteOffset + fmtBuffer.byteLength
);

const rawRecords = toRecords(RAW, rawArrayBuffer);
const fmtRecords = toRecords(FMT, fmtArrayBuffer);

const categoryCol = fmtRecords[0]
  ? Object.keys(fmtRecords[0]).find(
      (k) => k === "Card Set Category" || k === "Card Set Type"
    ) ?? "Card Set Category"
  : "Card Set Category";

const expected = new Map<
  string,
  { name: string; category: string; parallel: string }
>();
for (let i = 0; i < rawRecords.length; i++) {
  const cs = (rawRecords[i]["CARD SET"] ?? "").trim();
  const fmt = fmtRecords[i];
  if (!cs || !fmt) continue;
  expected.set(cs, {
    name: (fmt["Card Set Name"] ?? fmt["CARD SET"] ?? "").trim(),
    category: (fmt[categoryCol] ?? "").trim(),
    parallel: (fmt["Parallel"] ?? "").trim(),
  });
}

const distinctValues = [...expected.keys()];
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

const rowCounts = new Map<string, number>();
for (const record of rawRecords) {
  const cs = (record["CARD SET"] ?? "").trim();
  if (!cs) continue;
  rowCounts.set(cs, (rowCounts.get(cs) ?? 0) + 1);
}

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
  const ok =
    act.cardSetName === exp.name &&
    (act.cardSetCategory ?? "") === exp.category &&
    (act.parallel ?? "") === exp.parallel;
  if (ok) continue;

  const got = `${act.cardSetName}|${act.cardSetCategory}|${act.parallel ?? ""}`;
  const expStr = `${exp.name}|${exp.category}|${exp.parallel}`;

  if (exp.name === "Base Set" && act.cardSetName === "Base" && exp.category === act.cardSetCategory) {
    addCat("Base Set expected, got Base", rawVal, got);
  } else if (exp.name === "Base" && act.cardSetName === "Base Set" && exp.category === act.cardSetCategory) {
    addCat("Base expected, got Base Set", rawVal, got);
  } else if (rawVal.startsWith("2023 Panini") || rawVal.match(/^\d{4} Panini/)) {
    addCat("Cross-product year-prefixed values", rawVal, `exp=${expStr} got=${got}`);
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

let matchRows = 0;
let totalRows = 0;
for (const rawVal of distinctValues) {
  const exp = expected.get(rawVal)!;
  const act = enriched[rawVal];
  const rows = rowCounts.get(rawVal) ?? 0;
  totalRows += rows;
  if (
    act.cardSetName === exp.name &&
    (act.cardSetCategory ?? "") === exp.category &&
    (act.parallel ?? "") === exp.parallel
  ) {
    matchRows += rows;
  }
}

console.log(`Mosaic 2023-24 split match: ${((matchRows / totalRows) * 100).toFixed(1)}% (${matchRows}/${totalRows} rows)\n`);
console.log("Mismatch categories by row impact:\n");
for (const c of [...cats.values()].sort((a, b) => b.rows - a.rows)) {
  console.log(`${c.label}: ${c.count} distinct, ${c.rows} rows`);
  for (const s of c.samples) console.log(`  ${s}`);
  console.log("");
}

// Sample formatted base naming
const baseSamples = fmtRecords
  .filter((r) => (r["CARD SET"] ?? "").trim().toLowerCase() === "base")
  .slice(0, 3)
  .map((r) => ({
    raw: r["CARD SET"],
    name: r["Card Set Name"],
    category: r[categoryCol],
    parallel: r["Parallel"],
  }));
console.log("Formatted 'Base' samples:", JSON.stringify(baseSamples, null, 2));

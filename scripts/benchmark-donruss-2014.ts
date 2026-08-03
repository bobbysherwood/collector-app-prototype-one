import fs from "node:fs";
import {
  buildCardSetSplitIndex,
  resolveManufacturerFromBrand,
  normalizeBrandProgramName,
} from "../src/lib/dm2-import-spreadsheet-split";
import { enrichCardSetValueSplits } from "../src/lib/dm2-import-file-content";

const RAW =
  "C:/Users/bsherwood/Downloads/2014 Donruss Base Brand Donruss (14-15) (Basketball).csv";
const FMT =
  "C:/Users/bsherwood/OneDrive - HealthEdge Software, Inc/Archive/Desktop/App/2014 Donruss Base Brand Donruss (14-15) (Basketball)-FORMATTED.csv";

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

function toRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const headers = rows[0];
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))
  );
}

const rawRecords = toRecords(fs.readFileSync(RAW, "utf8"));
const fmtRecords = toRecords(fs.readFileSync(FMT, "utf8"));

const distinctValues = [
  ...new Set(rawRecords.map((row) => row["CARD SET"]?.trim()).filter(Boolean)),
];

const splitIndex = buildCardSetSplitIndex(distinctValues);
const enriched = enrichCardSetValueSplits({
  distinctValues,
  splits: Object.fromEntries(
    [...splitIndex.entries()].map(([key, split]) => [
      key,
      {
        cardSetName: split.cardSetName,
        parallel: split.parallel ?? null,
        cardSetCategory: split.cardSetCategory,
      },
    ])
  ),
  catalogParallels: [],
  catalogCardSetNames: [],
  catalogInsertSetNames: [],
});

const manufacturer = resolveManufacturerFromBrand({
  brand: normalizeBrandProgramName("Donruss"),
});

let nameMismatch = 0;
let categoryMismatch = 0;
let parallelMismatch = 0;
let fullMatch = 0;
const mismatchSamples = new Map<string, number>();

for (let i = 0; i < rawRecords.length; i++) {
  const raw = rawRecords[i];
  const expected = fmtRecords[i];
  const cardSetRaw = raw["CARD SET"]?.trim() ?? "";
  const split = enriched[cardSetRaw];

  const got = {
    manufacturer: manufacturer ?? "",
    brand: "Donruss",
    cardSetName: split?.cardSetName ?? cardSetRaw,
    cardSetCategory: split?.cardSetCategory ?? "",
    parallel: split?.parallel ?? "",
  };

  const exp = {
    manufacturer: expected.Manufacturer ?? "",
    brand: expected.BRAND ?? "",
    cardSetName: expected["Card Set Name"] ?? "",
    cardSetCategory: expected["Card Set Category"] ?? "",
    parallel: expected.Parallel ?? "",
  };

  const nameOk = got.cardSetName === exp.cardSetName;
  const categoryOk = got.cardSetCategory === exp.cardSetCategory;
  const parallelOk = got.parallel === exp.parallel;

  if (nameOk && categoryOk && parallelOk) {
    fullMatch++;
    continue;
  }

  if (!nameOk) nameMismatch++;
  if (!categoryOk) categoryMismatch++;
  if (!parallelOk) parallelMismatch++;

  const key = `${cardSetRaw} => name:${got.cardSetName}/${exp.cardSetName} cat:${got.cardSetCategory}/${exp.cardSetCategory} par:${got.parallel}/${exp.parallel}`;
  mismatchSamples.set(key, (mismatchSamples.get(key) ?? 0) + 1);
}

console.log(`Rows: ${rawRecords.length}`);
console.log(`Full match: ${fullMatch} (${((fullMatch / rawRecords.length) * 100).toFixed(1)}%)`);
console.log(`Name mismatches: ${nameMismatch}`);
console.log(`Category mismatches: ${categoryMismatch}`);
console.log(`Parallel mismatches: ${parallelMismatch}`);
console.log("\nTop mismatch patterns:");
[...mismatchSamples.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([pattern, count]) => console.log(`${count}\t${pattern}`));

console.log("\nDistinct CARD SET mapping (problem values):");
const problemPrefixes = ["Elite", "Status", "Production", "Rated Rookie", "Court Kings"];
const mapping = new Map<string, { name: string; cat: string; par: string }>();
for (let i = 0; i < rawRecords.length; i++) {
  const cardSetRaw = rawRecords[i]["CARD SET"]?.trim() ?? "";
  if (!cardSetRaw || mapping.has(cardSetRaw)) continue;
  mapping.set(cardSetRaw, {
    name: fmtRecords[i]["Card Set Name"] ?? "",
    cat: fmtRecords[i]["Card Set Category"] ?? "",
    par: fmtRecords[i].Parallel ?? "",
  });
}

for (const [raw, expected] of [...mapping.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (!problemPrefixes.some((prefix) => raw.startsWith(prefix))) continue;
  const split = enriched[raw];
  console.log(
    `${raw}\n  expected: ${expected.name} | ${expected.cat} | ${expected.par}\n  actual:   ${split?.cardSetName ?? ""} | ${split?.cardSetCategory ?? ""} | ${split?.parallel ?? ""}`
  );
}

/**
 * Dry-run a captured PSA set JSON against the built-in matcher.
 * Does not fetch psacard.com and does not write unless you use the admin UI.
 *
 *   npx tsx scripts/ingest-psa-pop.ts
 *   npx tsx scripts/ingest-psa-pop.ts --file path/to/captured.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePsaHeadingId } from "@/lib/card-population-lookup/heading";
import { planPsaPopulationIngest } from "@/lib/card-population-lookup/ingest";
import type { CatalogCardIdentity } from "@/lib/card-population-lookup/types";

const DEFAULT_FILE = resolve(
  process.cwd(),
  "src/lib/card-population-lookup/__fixtures__/psa-donruss-rookies-2017.json"
);

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

const sampleCards: CatalogCardIdentity[] = [
  {
    id: "fultz-base",
    sportName: "Basketball",
    year: 2017,
    manufacturerName: "Panini",
    brandName: "Donruss",
    cardSetName: "The Rookies",
    cardNumber: "1",
    player: "Markelle Fultz",
  },
  {
    id: "fultz-green",
    sportName: "Basketball",
    year: 2017,
    manufacturerName: "Panini",
    brandName: "Donruss",
    cardSetName: "The Rookies",
    cardNumber: "1",
    player: "Markelle Fultz",
    parallelName: "Green Flood",
  },
  {
    id: "lonzo-base",
    sportName: "Basketball",
    year: 2017,
    manufacturerName: "Panini",
    brandName: "Donruss",
    cardSetName: "The Rookies",
    cardNumber: "2",
    player: "Lonzo Ball",
  },
];

function main() {
  const file = resolve(process.cwd(), readArg("--file") ?? DEFAULT_FILE);
  const json = JSON.parse(readFileSync(file, "utf8")) as {
    headingId?: number;
    setName?: string;
  };
  const heading =
    parsePsaHeadingId(String(json.headingId ?? "")) ??
    parsePsaHeadingId(readArg("--heading") ?? "");
  const plan = planPsaPopulationIngest({
    json,
    setName: json.setName ?? "2017 Panini Donruss the Rookies",
    headingId: heading,
    cards: sampleCards,
  });

  console.log(`File: ${file}`);
  console.log(`Heading: ${plan.headingId ?? "none"}`);
  console.log(
    `Candidates ${plan.candidates} · auto ${plan.auto.length} · review ${plan.review.length} · reject ${plan.reject.length}`
  );
  for (const row of [...plan.auto, ...plan.review, ...plan.reject]) {
    console.log(
      `  ${row.decision.toUpperCase()} ${row.cardLabel} ← ${row.candidate.subject} ${row.candidate.variety} PSA10=${row.psaCounts.psa_10 ?? "—"}`
    );
  }
}

main();

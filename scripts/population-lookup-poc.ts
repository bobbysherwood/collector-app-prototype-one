/**
 * Dry-run POC for graded-population lookup.
 *
 * Default: score built-in catalog identities against saved PSA HTML.
 * Optional: load a few dm2_cards and/or probe one live PSA search page.
 * Never writes to dm2_card_populations.
 *
 *   npx tsx scripts/population-lookup-poc.ts
 *   npx tsx scripts/population-lookup-poc.ts --catalog --limit 5
 *   npx tsx scripts/population-lookup-poc.ts --live
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatPopulationPocReport,
  probePsaSearchPage,
  runPopulationLookupPoc,
} from "@/lib/card-population-lookup/run-poc";
import { SAMPLE_POPULATION_CARDS } from "@/lib/card-population-lookup/sample-cards";
import type { CatalogCardIdentity } from "@/lib/card-population-lookup/types";

function loadEnvLocal() {
  try {
    const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // use the existing environment
  }
}

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function loadCatalogCards(limit: number): Promise<CatalogCardIdentity[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.PROBE_EMAIL;
  const password = process.env.PROBE_PASSWORD;
  if (!url || !anonKey || !email || !password) {
    console.log(
      "No PROBE_EMAIL/PROBE_PASSWORD in .env.local — using built-in sample cards.\n"
    );
    return SAMPLE_POPULATION_CARDS;
  }

  const supabase = createClient(url, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) {
    console.log(`Catalog sign-in failed (${authError.message}) — using sample cards.\n`);
    return SAMPLE_POPULATION_CARDS;
  }

  const { data, error } = await supabase
    .from("dm2_cards")
    .select(
      "id, card_number, dm2_parallels(name), dm2_card_sets(year, pick_list_options(label), dm2_brands(name, dm2_manufacturers(name)), dm2_card_set_names(name)), dm2_card_players(sort_order, dm2_players(name))"
    )
    .eq("active", true)
    .not("card_number", "is", null)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 3, 15));

  if (error || !data?.length) {
    console.log(
      `${error ? `Catalog query failed (${error.message})` : "No catalog cards"} — using sample cards.\n`
    );
    return SAMPLE_POPULATION_CARDS;
  }

  const mapped = data.flatMap((row) => {
    const players = (Array.isArray(row.dm2_card_players) ? row.dm2_card_players : [])
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map((link) => firstRel(link.dm2_players)?.name?.trim())
      .filter((name): name is string => Boolean(name));
    const player = players.join("/");
    if (!player || !row.card_number) return [];

    const set = firstRel(row.dm2_card_sets) as {
      year?: number;
      pick_list_options?: { label?: string } | { label?: string }[] | null;
      dm2_brands?: {
        name?: string;
        dm2_manufacturers?: { name?: string } | { name?: string }[] | null;
      } | null;
      dm2_card_set_names?: { name?: string } | { name?: string }[] | null;
    } | null;
    const brand = set?.dm2_brands ?? null;
    const manufacturer = firstRel(brand?.dm2_manufacturers);
    return [
      {
        id: String(row.id),
        sportName: labelOf(set?.pick_list_options) || "Basketball",
        year: Number(set?.year ?? 0),
        manufacturerName: (manufacturer as { name?: string } | null)?.name ?? "",
        brandName: brand?.name ?? "",
        cardSetName: (firstRel(set?.dm2_card_set_names) as { name?: string } | null)?.name ?? "",
        cardNumber: String(row.card_number ?? ""),
        player,
        parallelName: (firstRel(row.dm2_parallels) as { name?: string } | null)?.name ?? null,
      },
    ];
  });

  if (mapped.length === 0) {
    console.log("No linked catalog players — using sample cards.\n");
    return SAMPLE_POPULATION_CARDS;
  }

  console.log(`Loaded ${Math.min(mapped.length, limit)} catalog card(s) from dm2_cards.\n`);
  return mapped.slice(0, limit);
}

function firstRel<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function labelOf(
  value: { label?: string } | { label?: string }[] | null | undefined
): string {
  const row = firstRel(value);
  return row?.label ?? "";
}

async function main() {
  loadEnvLocal();
  const useLive = readFlag("--live");
  const useCatalog = readFlag("--catalog");
  const limit = Math.max(1, Number(readArg("--limit") ?? 5) || 5);

  console.log(formatPopulationPocReport(runPopulationLookupPoc()));

  if (useCatalog) {
    const catalogCards = await loadCatalogCards(limit);
    const fromDb = catalogCards[0]?.id !== SAMPLE_POPULATION_CARDS[0]?.id;
    if (fromDb) {
      console.log("\nCatalog identities (query preview only; scored against the Wembanyama fixture)");
      console.log(formatPopulationPocReport(runPopulationLookupPoc(catalogCards)));
    }
  }

  if (useLive) {
    console.log("\nLive PSA search probe (one request, no write, no Cloudflare bypass)");
    const probe = await probePsaSearchPage(SAMPLE_POPULATION_CARDS[0]!);
    console.log(`  url: ${probe.url}`);
    console.log(`  status: ${probe.status ?? "n/a"}  bytes: ${probe.bytes}`);
    console.log(`  ${probe.note}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

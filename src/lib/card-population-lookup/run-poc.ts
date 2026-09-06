import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pickBestPopulationMatch } from "@/lib/card-population-lookup/match";
import { parsePsaSearchTableHtml } from "@/lib/card-population-lookup/parse-psa-html";
import { buildAllGraderQueries } from "@/lib/card-population-lookup/query";
import { SAMPLE_POPULATION_CARDS } from "@/lib/card-population-lookup/sample-cards";
import type {
  CatalogCardIdentity,
  PopulationMatchResult,
} from "@/lib/card-population-lookup/types";

export interface PopulationPocCardResult {
  card: CatalogCardIdentity;
  queries: ReturnType<typeof buildAllGraderQueries>;
  match: PopulationMatchResult | null;
}

export interface LiveSearchProbe {
  url: string;
  status: number | null;
  ok: boolean;
  bytes: number;
  note: string;
}

export function loadPsaFixtureCandidates(
  fixturePath = resolve(
    process.cwd(),
    "src/lib/card-population-lookup/__fixtures__/psa-prizm-2023-wembanyama.html"
  )
) {
  const html = readFileSync(fixturePath, "utf8");
  return parsePsaSearchTableHtml(html, "2023-24 Panini Prizm Basketball");
}

export function runPopulationLookupPoc(
  cards: CatalogCardIdentity[] = SAMPLE_POPULATION_CARDS
): PopulationPocCardResult[] {
  const candidates = loadPsaFixtureCandidates();
  return cards.map((card) => ({
    card,
    queries: buildAllGraderQueries(card),
    match: pickBestPopulationMatch(card, candidates),
  }));
}

export async function probePsaSearchPage(
  card: CatalogCardIdentity,
  fetcher: typeof fetch = fetch
): Promise<LiveSearchProbe> {
  const query = buildAllGraderQueries(card).find((item) => item.grader === "PSA");
  if (!query) {
    return { url: "", status: null, ok: false, bytes: 0, note: "No PSA query" };
  }

  try {
    const response = await fetcher(query.url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "CollectorAppPopulationPoc/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    const blocked = response.status === 403 || /cloudflare|attention required/i.test(text);
    return {
      url: query.url,
      status: response.status,
      ok: response.ok && !blocked,
      bytes: text.length,
      note: blocked
        ? "Search page blocked or JS-gated. Matching still works against saved HTML."
        : response.ok
          ? "Search page returned HTML. Parse only if a results table is present."
          : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      url: query.url,
      status: null,
      ok: false,
      bytes: 0,
      note: error instanceof Error ? error.message : "Live probe failed",
    };
  }
}

export function formatPopulationPocReport(results: PopulationPocCardResult[]): string {
  const lines = [
    "Population lookup POC (fixture matching, no database writes)",
    "",
  ];

  for (const result of results) {
    const { card, match } = result;
    lines.push(
      `${card.year} ${card.brandName} ${card.cardSetName} #${card.cardNumber} ${card.player}${card.parallelName ? ` (${card.parallelName})` : " (Base)"}`
    );
    lines.push(`  PSA search: ${result.queries.find((query) => query.grader === "PSA")?.url}`);
    if (!match) {
      lines.push("  result: no candidates");
      lines.push("");
      continue;
    }
    lines.push(
      `  result: ${match.decision.toUpperCase()}  confidence=${match.confidence}  reasons=${match.reasons.join(",") || "none"}`
    );
    lines.push(
      `  matched: #${match.candidate.cardNumber} ${match.candidate.subject} · ${match.candidate.variety} · PSA10=${match.candidate.counts.psa_10 ?? "—"}`
    );
    lines.push("");
  }

  const auto = results.filter((result) => result.match?.decision === "auto").length;
  const review = results.filter((result) => result.match?.decision === "review").length;
  const reject = results.filter((result) => result.match?.decision === "reject" || !result.match).length;
  lines.push(`Summary: auto=${auto} review=${review} reject=${reject}`);
  return lines.join("\n");
}

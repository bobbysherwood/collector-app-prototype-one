import type {
  CatalogCardIdentity,
  PopulationGrader,
  PopulationLookupQuery,
} from "@/lib/card-population-lookup/types";

function sportCategory(sportName: string): string {
  const value = sportName.trim().toLowerCase();
  if (value === "basketball" || value === "nba") return "basketball";
  if (value === "football" || value === "nfl") return "football";
  if (value === "baseball" || value === "mlb") return "baseball";
  if (value === "hockey" || value === "nhl") return "hockey";
  return value;
}

export function buildPopulationSearchQuery(
  card: CatalogCardIdentity,
  grader: PopulationGrader = "PSA"
): PopulationLookupQuery {
  const parts = [
    String(card.year),
    card.manufacturerName,
    card.brandName,
    card.cardSetName,
    card.player,
    card.cardNumber ? `#${card.cardNumber}` : "",
    card.parallelName ?? "",
  ]
    .map((part) => part.trim())
    .filter(Boolean);
  const q = parts.join(" ");
  const category = sportCategory(card.sportName);

  const url = (() => {
    switch (grader) {
      case "PSA": {
        const search = new URL("https://www.psacard.com/pop/search");
        search.searchParams.set("q", q);
        return search.toString();
      }
      case "SGC": {
        const search = new URL("https://www.gosgc.com/pop-report");
        search.searchParams.set("q", q);
        return search.toString();
      }
      case "BGS": {
        const search = new URL("https://www.beckett.com/grading/population-report");
        search.searchParams.set("search", q);
        return search.toString();
      }
      case "CGC": {
        const search = new URL("https://www.cgccards.com/census/");
        search.searchParams.set("q", q);
        search.searchParams.set("category", category);
        return search.toString();
      }
    }
  })();

  return { grader, q, url };
}

export function buildAllGraderQueries(card: CatalogCardIdentity): PopulationLookupQuery[] {
  return (["PSA", "SGC", "BGS", "CGC"] as const).map((grader) =>
    buildPopulationSearchQuery(card, grader)
  );
}

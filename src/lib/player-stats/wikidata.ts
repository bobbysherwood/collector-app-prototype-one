import { TtlCache, normalizeCacheKey } from "@/lib/player-stats/cache";
import { fetchJson } from "@/lib/player-stats/fetch";
import type { PlayerStatsSport } from "@/lib/player-stats/sport";
import type {
  JsonFetcher,
  WikidataBio,
  WikidataSearchHit,
} from "@/lib/player-stats/types";

const SEARCH_TTL_MS = 12 * 60 * 60 * 1000;
const searchCache = new TtlCache<WikidataSearchHit | null>(SEARCH_TTL_MS);
const bioCache = new TtlCache<WikidataBio | null>(SEARCH_TTL_MS);

export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function looksLikeBasketballDescription(text: string | undefined): boolean {
  return looksLikeSportDescription(text, "basketball");
}

export function looksLikeSportDescription(
  text: string | undefined,
  sport: PlayerStatsSport
): boolean {
  if (!text) return false;
  const value = text.toLowerCase();
  switch (sport) {
    case "basketball":
      if (/\b(tennis|american football|soccer|baseball|hockey|golf)\b/.test(value)) {
        if (!/\bbasketball\b|\bnba\b/.test(value)) return false;
      }
      return /\bbasketball\b|\bnba\b/.test(value);
    case "football":
      if (/\b(soccer|association football)\b/.test(value) && !/\bnfl\b/.test(value)) {
        return false;
      }
      return /\bamerican football\b/.test(value) || /\bnfl\b/.test(value);
    case "baseball":
      return /\bbaseball\b/.test(value) || /\bmlb\b/.test(value);
    case "hockey":
      if (/\bfield hockey\b/.test(value) && !/\bice hockey\b|\bnhl\b/.test(value)) {
        return false;
      }
      return /\bice hockey\b/.test(value) || /\bnhl\b/.test(value) || /\bhockey\b/.test(value);
  }
}

export function isOtherMajorSportDescription(
  text: string | undefined,
  sport: PlayerStatsSport
): boolean {
  if (!text) return false;
  return PLAYER_STATS_SPORT_LIST.some(
    (candidate) => candidate !== sport && looksLikeSportDescription(text, candidate)
  );
}

const PLAYER_STATS_SPORT_LIST: PlayerStatsSport[] = [
  "basketball",
  "football",
  "baseball",
  "hockey",
];

export function isExactWikidataNameMatch(
  hit: Pick<WikidataSearchHit, "label">,
  playerName: string
): boolean {
  const target = normalizePersonName(playerName);
  return Boolean(target) && normalizePersonName(hit.label) === target;
}

export function isHighConfidenceWikidataMatch(
  hit: WikidataSearchHit,
  playerName: string,
  sport: PlayerStatsSport
): boolean {
  return (
    isExactWikidataNameMatch(hit, playerName) &&
    looksLikeSportDescription(hit.description, sport)
  );
}

export function pickWikidataSearchHit(
  hits: WikidataSearchHit[],
  playerName: string,
  sport: PlayerStatsSport = "basketball"
): WikidataSearchHit | null {
  const target = normalizePersonName(playerName);
  if (!target) return null;

  const scored = hits
    .map((hit) => {
      const label = normalizePersonName(hit.label);
      const sportMatch = looksLikeSportDescription(hit.description, sport);
      const otherSport = isOtherMajorSportDescription(hit.description, sport);
      let score = 0;
      if (label === target) score += 10;
      else if (label.includes(target) || target.includes(label)) score += 4;
      else return { hit, score: 0 };
      if (otherSport && !sportMatch) return { hit, score: 0 };
      if (sportMatch) score += 6;
      return { hit, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;
  if (best.score < 10 && !looksLikeSportDescription(best.hit.description, sport)) {
    return null;
  }
  return best.hit;
}

interface WikidataSearchResponse {
  search?: Array<{
    id?: string;
    label?: string;
    description?: string;
  }>;
}

interface WikidataSparqlResponse {
  results?: {
    bindings?: Array<Record<string, { value?: string }>>;
  };
}

function readBinding(
  row: Record<string, { value?: string }> | undefined,
  key: string
): string | null {
  const value = row?.[key]?.value?.trim();
  return value ? value : null;
}

export function parseWikidataBirth(value: string | null): {
  birthDate: string | null;
  birthYear: number | null;
} {
  if (!value) return { birthDate: null, birthYear: null };
  const match = value.match(/(-?\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const yearOnly = value.match(/(-?\d{4})/);
    return {
      birthDate: null,
      birthYear: yearOnly ? Number(yearOnly[1]) : null,
    };
  }
  return {
    birthDate: `${match[1]}-${match[2]}-${match[3]}`,
    birthYear: Number(match[1]),
  };
}

export function parseWikidataSparqlBio(
  wikidataId: string,
  label: string,
  bindings: Array<Record<string, { value?: string }>>
): WikidataBio {
  const currentTeams = new Set<string>();
  const colleges = new Set<string>();
  let birthDate: string | null = null;
  let birthYear: number | null = null;
  let nbaPersonId: string | null = null;
  let draftYear: number | null = null;
  let imageUrl: string | null = null;

  for (const row of bindings) {
    const birth = parseWikidataBirth(readBinding(row, "dob"));
    birthDate ??= birth.birthDate;
    birthYear ??= birth.birthYear;
    nbaPersonId ??= readBinding(row, "nbaId");
    imageUrl ??= readBinding(row, "image");
    const team = readBinding(row, "teamLabel");
    if (team && !/^Q\d+$/i.test(team)) currentTeams.add(team);
    const college = readBinding(row, "collegeLabel");
    if (college && !/^Q\d+$/i.test(college)) colleges.add(college);
    const draftTime = parseWikidataBirth(readBinding(row, "draftTime"));
    draftYear ??= draftTime.birthYear;
  }

  return {
    wikidataId,
    label,
    birthDate,
    birthYear,
    team: pickTeamLabel([...currentTeams]),
    college: pickCollegeLabel([...colleges]),
    draftYear,
    nbaPersonId,
    imageUrl,
  };
}

function pickTeamLabel(labels: string[]): string | null {
  const clubTeams = labels.filter(
    (label) => !/national|olympic|united states men|team usa|world cup/i.test(label)
  );
  return (clubTeams[0] ?? labels[0]) ?? null;
}

function pickCollegeLabel(labels: string[]): string | null {
  if (labels.length === 0) return null;
  const notPrep = labels.filter(
    (label) => !/preparatory|high school|secondary school/i.test(label)
  );
  const university = notPrep.find((label) =>
    /university|college|duke|kentucky|kansas|north carolina|ucla|connecticut/i.test(
      label
    )
  );
  const raw = university ?? notPrep[0] ?? null;
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s+men'?s (basketball|football|baseball|ice hockey|hockey)$/i, "")
    .replace(/\s+women'?s (basketball|football|baseball|ice hockey|hockey)$/i, "")
    .trim();
  return cleaned || null;
}

export async function searchWikidataBasketballPlayer(
  playerName: string,
  fetcher: JsonFetcher = fetchJson
): Promise<WikidataSearchHit | null> {
  return searchWikidataPlayer(playerName, "basketball", fetcher);
}

export async function searchWikidataPlayer(
  playerName: string,
  sport: PlayerStatsSport,
  fetcher: JsonFetcher = fetchJson
): Promise<WikidataSearchHit | null> {
  const cacheKey = normalizeCacheKey(["wikidata-search", sport, playerName]);
  const cached = searchCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", playerName);
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("type", "item");
  url.searchParams.set("limit", "10");
  url.searchParams.set("origin", "*");

  try {
    const json = (await fetcher(url.toString())) as WikidataSearchResponse;
    const hits = (json.search ?? [])
      .filter((hit): hit is { id: string; label: string; description?: string } =>
        Boolean(hit.id && hit.label)
      )
      .map((hit) => ({
        id: hit.id,
        label: hit.label,
        description: hit.description,
      }));
    return searchCache.set(cacheKey, pickWikidataSearchHit(hits, playerName, sport));
  } catch {
    return searchCache.set(cacheKey, null);
  }
}

export async function fetchWikidataPlayerBio(
  hit: WikidataSearchHit,
  fetcher: JsonFetcher = fetchJson
): Promise<WikidataBio | null> {
  const cacheKey = normalizeCacheKey(["wikidata-bio", hit.id]);
  const cached = bioCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const query = `
SELECT ?dob ?nbaId ?image ?teamLabel ?collegeLabel ?draftTime WHERE {
  BIND(wd:${hit.id} AS ?item)
  OPTIONAL { ?item wdt:P569 ?dob. }
  OPTIONAL { ?item wdt:P3647 ?nbaId. }
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL {
    ?item p:P54 ?teamStmt.
    ?teamStmt ps:P54 ?team.
    FILTER NOT EXISTS { ?teamStmt pq:P582 ?end. }
  }
  OPTIONAL { ?item wdt:P69 ?college. }
  OPTIONAL {
    ?item p:P647 ?draftStmt.
    OPTIONAL { ?draftStmt pq:P585 ?draftTime. }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`.trim();

  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");

  try {
    const json = (await fetcher(url.toString(), {
      headers: { Accept: "application/sparql-results+json" },
    })) as WikidataSparqlResponse;
    const bio = parseWikidataSparqlBio(
      hit.id,
      hit.label,
      json.results?.bindings ?? []
    );
    return bioCache.set(cacheKey, bio);
  } catch {
    return bioCache.set(cacheKey, null);
  }
}

export function clearWikidataCaches(): void {
  searchCache.clear();
  bioCache.clear();
}

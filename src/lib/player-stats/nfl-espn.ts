import { TtlCache, normalizeCacheKey } from "@/lib/player-stats/cache";
import { createHeaderFetcher } from "@/lib/player-stats/fetch";
import { normalizePersonName } from "@/lib/player-stats/wikidata";
import { asNumber, asString, readRecordNumber } from "@/lib/player-stats/values";
import type { JsonFetcher, PlayerSeasonLine } from "@/lib/player-stats/types";

const NFL_TTL_MS = 6 * 60 * 60 * 1000;
const searchCache = new TtlCache<EspnAthleteHit | null>(NFL_TTL_MS);
const bioCache = new TtlCache<EspnAthleteBio | null>(NFL_TTL_MS);
const statsCache = new TtlCache<{
  seasons: PlayerSeasonLine[];
  career: PlayerSeasonLine | null;
}>(NFL_TTL_MS);

export const ESPN_NFL_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://www.espn.com",
  Referer: "https://www.espn.com/",
};

const defaultEspnFetcher = createHeaderFetcher(ESPN_NFL_HEADERS);

export interface EspnAthleteHit {
  id: string;
  displayName: string;
}

export interface EspnAthleteBio {
  espnAthleteId: string;
  displayName: string;
  team: string | null;
  birthDate: string | null;
  birthYear: number | null;
  college: string | null;
  position: string | null;
  draftYear: number | null;
}

function isFootballAthlete(record: Record<string, unknown>): boolean {
  const haystack = [
    asString(record.sport),
    asString(record.league),
    asString((record.league as { abbreviation?: string } | undefined)?.abbreviation),
    asString(record.uid),
    asString(record.type),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!haystack) return true;
  return /football|nfl/.test(haystack) && !/soccer|basketball|baseball|hockey/.test(haystack);
}

export function parseEspnSearchHits(json: unknown): EspnAthleteHit[] {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const bags: unknown[] = [];
  if (Array.isArray(root.items)) bags.push(...root.items);
  if (Array.isArray(root.athletes)) bags.push(...root.athletes);
  if (Array.isArray(root.results)) {
    for (const result of root.results) {
      if (result && typeof result === "object") {
        const contents = (result as { contents?: unknown[] }).contents;
        if (Array.isArray(contents)) bags.push(...contents);
        else bags.push(result);
      }
    }
  }

  return bags.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    const athlete =
      record.athlete && typeof record.athlete === "object"
        ? (record.athlete as Record<string, unknown>)
        : record;
    if (!isFootballAthlete({ ...record, ...athlete })) return [];
    const id =
      asString(athlete.id) ??
      asString(record.id) ??
      (asString(athlete.uid) ?? asString(record.uid))?.match(/a:(\d+)/)?.[1] ??
      null;
    const displayName = asString(athlete.displayName) ?? asString(record.displayName);
    if (!id || !displayName) return [];
    return [{ id, displayName }];
  });
}

export function pickEspnAthlete(
  hits: EspnAthleteHit[],
  playerName: string
): EspnAthleteHit | null {
  const target = normalizePersonName(playerName);
  if (!target) return null;
  return hits.find((hit) => normalizePersonName(hit.displayName) === target) ?? null;
}

function parseBirth(value: string | null): { birthDate: string | null; birthYear: number | null } {
  if (!value) return { birthDate: null, birthYear: null };
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const year = value.match(/(\d{4})/);
    return { birthDate: null, birthYear: year ? Number(year[1]) : null };
  }
  return { birthDate: `${match[1]}-${match[2]}-${match[3]}`, birthYear: Number(match[1]) };
}

export function parseEspnAthleteBio(json: unknown, athleteId: string): EspnAthleteBio | null {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const athlete =
    root.athlete && typeof root.athlete === "object"
      ? (root.athlete as Record<string, unknown>)
      : root;
  const displayName = asString(athlete.displayName) ?? asString(athlete.fullName);
  if (!displayName) return null;
  const birth = parseBirth(
    asString(athlete.dateOfBirth) ?? asString(athlete.displayDOB) ?? asString(athlete.birthDate)
  );
  const team =
    asString((athlete.team as { displayName?: string } | undefined)?.displayName) ??
    asString((root.team as { displayName?: string } | undefined)?.displayName) ??
    null;
  const college =
    asString((athlete.college as { name?: string } | undefined)?.name) ??
    asString(athlete.college) ??
    null;
  const position =
    asString((athlete.position as { abbreviation?: string } | undefined)?.abbreviation) ??
    asString(athlete.position) ??
    null;
  const draftYear =
    asNumber((athlete.draft as { year?: unknown } | undefined)?.year) ??
    asNumber(athlete.debutYear);

  return {
    espnAthleteId: athleteId,
    displayName,
    team,
    birthDate: birth.birthDate,
    birthYear: birth.birthYear,
    college,
    position,
    draftYear,
  };
}

function namedTotals(category: Record<string, unknown>): Record<string, number> {
  const fromStats =
    category.stats && typeof category.stats === "object" && !Array.isArray(category.stats)
      ? (category.stats as Record<string, unknown>)
      : null;
  const names = Array.isArray(category.names)
    ? category.names.map((name) => String(name))
    : Array.isArray(category.keys)
      ? category.keys.map((name) => String(name))
      : [];
  const totals = Array.isArray(category.totals)
    ? category.totals
    : Array.isArray(category.statistics)
      ? category.statistics
      : [];
  const out: Record<string, number> = {};
  if (fromStats) {
    for (const [key, value] of Object.entries(fromStats)) {
      const numeric = asNumber(value);
      if (numeric != null) out[key] = numeric;
    }
  }
  names.forEach((name, index) => {
    const numeric = asNumber(totals[index]);
    if (numeric != null) out[name] = numeric;
  });
  return out;
}

function footballProduction(stats: Record<string, number>): number | null {
  const passYds = readRecordNumber(stats, ["passingYards", "passYards"]);
  const rushYds = readRecordNumber(stats, ["rushingYards", "rushYards"]);
  const recYds = readRecordNumber(stats, ["receivingYards", "recYards"]);
  const passTd = readRecordNumber(stats, ["passingTouchdowns", "passTD", "passingTDs"]);
  const rushTd = readRecordNumber(stats, ["rushingTouchdowns", "rushTD"]);
  const recTd = readRecordNumber(stats, ["receivingTouchdowns", "recTD"]);
  const games = readRecordNumber(stats, ["gamesPlayed", "GP", "games"]) ?? 0;
  const yards = (passYds ?? 0) + (rushYds ?? 0) + (recYds ?? 0);
  const tds = (passTd ?? 0) + (rushTd ?? 0) + (recTd ?? 0);
  if (yards === 0 && tds === 0) return null;
  const yardsPerGame = games > 0 ? yards / games : yards;
  const tdPerGame = games > 0 ? tds / games : tds;
  const passHeavy = (passYds ?? 0) > (rushYds ?? 0) + (recYds ?? 0);
  const yardScale = passHeavy
    ? Math.max(0, Math.min(1, (yardsPerGame - 140) / 220))
    : Math.max(0, Math.min(1, (yardsPerGame - 25) / 100));
  return Math.round(30 + yardScale * 58 + Math.min(12, tdPerGame * 6));
}

function footballLine(
  season: string,
  team: string | null,
  stats: Record<string, number>,
  isCareer = false
): PlayerSeasonLine | null {
  const games = readRecordNumber(stats, ["gamesPlayed", "GP", "games"]);
  const passYds = readRecordNumber(stats, ["passingYards", "passYards"]);
  const rushYds = readRecordNumber(stats, ["rushingYards", "rushYards"]);
  const recYds = readRecordNumber(stats, ["receivingYards", "recYards"]);
  const yards = (passYds ?? 0) + (rushYds ?? 0) + (recYds ?? 0);
  const tds =
    (readRecordNumber(stats, ["passingTouchdowns", "passTD", "passingTDs"]) ?? 0) +
    (readRecordNumber(stats, ["rushingTouchdowns", "rushTD"]) ?? 0) +
    (readRecordNumber(stats, ["receivingTouchdowns", "recTD"]) ?? 0);
  const production = footballProduction(stats);
  if (games == null && yards === 0 && production == null) return null;
  return {
    season,
    team,
    games,
    minutes: null,
    points: games && games > 0 ? yards / games : yards || null,
    rebounds: readRecordNumber(stats, ["receptions", "rec", "carries", "rushingAttempts"]),
    assists: games && games > 0 ? tds / games : tds || null,
    steals: null,
    blocks: null,
    turnovers: readRecordNumber(stats, ["interceptions", "INT"]),
    fgPct: null,
    threePct: null,
    ftPct: null,
    production,
    isCareer,
  };
}

export function parseEspnNflStats(json: unknown): {
  seasons: PlayerSeasonLine[];
  career: PlayerSeasonLine | null;
} {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const seasons: PlayerSeasonLine[] = [];
  let career: PlayerSeasonLine | null = null;

  const categories = Array.isArray(root.categories)
    ? root.categories
    : Array.isArray((root.statistics as { categories?: unknown[] } | undefined)?.categories)
      ? ((root.statistics as { categories: unknown[] }).categories)
      : [];

  const merged: Record<string, number> = {};
  for (const category of categories) {
    if (!category || typeof category !== "object") continue;
    Object.assign(merged, namedTotals(category as Record<string, unknown>));
  }
  if (Object.keys(merged).length > 0) {
    const season =
      asString((root.season as { displayName?: string } | undefined)?.displayName) ??
      (asNumber((root.season as { year?: unknown } | undefined)?.year) != null
        ? String((root.season as { year: unknown }).year)
        : "Career");
    const line = footballLine(season, null, merged, /career/i.test(season));
    if (line) {
      if (line.isCareer) career = line;
      else seasons.push(line);
    }
  }

  const seasonRows = Array.isArray(root.seasonTypes)
    ? root.seasonTypes
    : Array.isArray((root.statistics as { splits?: unknown[] } | undefined)?.splits)
      ? ((root.statistics as { splits: unknown[] }).splits)
      : [];

  for (const row of seasonRows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const season =
      asString(item.displayName) ??
      asString((item.season as { displayName?: string } | undefined)?.displayName) ??
      (asNumber(item.year) != null ? String(item.year) : null);
    if (!season) continue;
    const cats = Array.isArray(item.categories) ? item.categories : [];
    const stats: Record<string, number> = {};
    for (const category of cats) {
      if (category && typeof category === "object") {
        Object.assign(stats, namedTotals(category as Record<string, unknown>));
      }
    }
    const line = footballLine(season, asString((item.team as { displayName?: string })?.displayName), stats, /career/i.test(season));
    if (!line) continue;
    if (line.isCareer) career = line;
    else seasons.push(line);
  }

  return { seasons, career };
}

export function espnNflHeadshotUrl(athleteId: string): string {
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${encodeURIComponent(athleteId)}.png`;
}

export async function searchEspnNflAthlete(
  playerName: string,
  fetcher: JsonFetcher = defaultEspnFetcher
): Promise<EspnAthleteHit | null> {
  const cacheKey = normalizeCacheKey(["espn-nfl-search", playerName]);
  const cached = searchCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const url = new URL("https://site.web.api.espn.com/apis/common/v3/search");
  url.searchParams.set("region", "us");
  url.searchParams.set("lang", "en");
  url.searchParams.set("query", playerName);
  url.searchParams.set("limit", "8");
  try {
    const json = await fetcher(url.toString());
    return searchCache.set(cacheKey, pickEspnAthlete(parseEspnSearchHits(json), playerName));
  } catch {
    return searchCache.set(cacheKey, null);
  }
}

export async function fetchEspnNflAthlete(
  athleteId: string,
  fetcher: JsonFetcher = defaultEspnFetcher
): Promise<EspnAthleteBio | null> {
  const cacheKey = normalizeCacheKey(["espn-nfl-bio", athleteId]);
  const cached = bioCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const urls = [
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${encodeURIComponent(athleteId)}`,
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${encodeURIComponent(athleteId)}`,
  ];
  for (const url of urls) {
    try {
      const json = await fetcher(url);
      const bio = parseEspnAthleteBio(json, athleteId);
      if (bio) return bioCache.set(cacheKey, bio);
    } catch {
      // try the next public ESPN shape
    }
  }
  return bioCache.set(cacheKey, null);
}

export async function fetchEspnNflStats(
  athleteId: string,
  fetcher: JsonFetcher = defaultEspnFetcher
): Promise<{ seasons: PlayerSeasonLine[]; career: PlayerSeasonLine | null }> {
  const cacheKey = normalizeCacheKey(["espn-nfl-stats", athleteId]);
  const cached = statsCache.get(cacheKey);
  if (cached) return cached;

  const urls = [
    `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${encodeURIComponent(athleteId)}/stats`,
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/${encodeURIComponent(athleteId)}/stats`,
  ];
  for (const url of urls) {
    try {
      const json = await fetcher(url);
      const parsed = parseEspnNflStats(json);
      if (parsed.seasons.length > 0 || parsed.career) {
        return statsCache.set(cacheKey, parsed);
      }
    } catch {
      // try the next public ESPN shape
    }
  }
  return { seasons: [], career: null };
}

export function clearNflEspnCaches(): void {
  searchCache.clear();
  bioCache.clear();
  statsCache.clear();
}

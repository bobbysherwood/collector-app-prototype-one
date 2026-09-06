import { TtlCache, normalizeCacheKey } from "@/lib/player-stats/cache";
import { createHeaderFetcher, NBA_STATS_HEADERS } from "@/lib/player-stats/fetch";
import { normalizePersonName } from "@/lib/player-stats/wikidata";
import type {
  JsonFetcher,
  NbaPlayerBio,
  NbaResultSet,
  NbaStatsResponse,
  PlayerSeasonLine,
} from "@/lib/player-stats/types";

const NBA_TTL_MS = 6 * 60 * 60 * 1000;
const ALL_PLAYERS_TTL_MS = 24 * 60 * 60 * 1000;
const bioCache = new TtlCache<NbaPlayerBio | null>(NBA_TTL_MS);
const careerCache = new TtlCache<PlayerSeasonLine[]>(NBA_TTL_MS);
const allPlayersCache = new TtlCache<Array<{ id: string; name: string }>>(
  ALL_PLAYERS_TTL_MS
);

const defaultNbaFetcher = createHeaderFetcher(NBA_STATS_HEADERS);

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function rowsFromNbaResultSet(
  set: NbaResultSet | undefined
): Array<Record<string, unknown>> {
  if (!set) return [];
  return (set.rowSet ?? []).map((row) => {
    const next: Record<string, unknown> = {};
    set.headers.forEach((header, index) => {
      next[header] = row[index];
    });
    return next;
  });
}

export function findNbaResultSet(
  response: NbaStatsResponse | null | undefined,
  name: string
): NbaResultSet | undefined {
  return response?.resultSets?.find((set) => set.name === name);
}

function parseBirth(value: unknown): { birthDate: string | null; birthYear: number | null } {
  const text = asString(value);
  if (!text) return { birthDate: null, birthYear: null };
  const match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { birthDate: null, birthYear: null };
  return {
    birthDate: `${match[1]}-${match[2]}-${match[3]}`,
    birthYear: Number(match[1]),
  };
}

function parseDraftYear(value: unknown): {
  draftYear: number | null;
  undrafted: boolean;
} {
  const text = asString(value);
  if (text && /^undrafted$/i.test(text)) {
    return { draftYear: null, undrafted: true };
  }
  const year = asNumber(value);
  return { draftYear: year, undrafted: false };
}

export function parseNbaCommonPlayerInfo(
  response: NbaStatsResponse
): NbaPlayerBio | null {
  const row = rowsFromNbaResultSet(findNbaResultSet(response, "CommonPlayerInfo"))[0];
  if (!row) return null;

  const nbaPersonId = asString(row.PERSON_ID) ?? String(row.PERSON_ID ?? "");
  if (!nbaPersonId || nbaPersonId === "undefined") return null;

  const city = asString(row.TEAM_CITY);
  const teamName = asString(row.TEAM_NAME);
  const team =
    city && teamName ? `${city} ${teamName}` : teamName ?? asString(row.TEAM_ABBREVIATION);
  const birth = parseBirth(row.BIRTHDATE);
  const draft = parseDraftYear(row.DRAFT_YEAR);

  return {
    nbaPersonId,
    displayName: asString(row.DISPLAY_FIRST_LAST) ?? nbaPersonId,
    team,
    birthDate: birth.birthDate,
    birthYear: birth.birthYear,
    college: asString(row.SCHOOL),
    draftYear: draft.draftYear,
    draftRound: asNumber(row.DRAFT_ROUND),
    draftPick: asNumber(row.DRAFT_NUMBER),
    undrafted: draft.undrafted,
    position: asString(row.POSITION),
    fromYear: asNumber(row.FROM_YEAR),
    toYear: asNumber(row.TO_YEAR),
  };
}

export function parseNbaCareerPerGame(
  response: NbaStatsResponse
): { seasons: PlayerSeasonLine[]; career: PlayerSeasonLine | null } {
  const seasons = rowsFromNbaResultSet(
    findNbaResultSet(response, "SeasonTotalsRegularSeason")
  ).map((row) => toSeasonLine(row, false));

  const careerRow = rowsFromNbaResultSet(
    findNbaResultSet(response, "CareerTotalsRegularSeason")
  )[0];

  return {
    seasons,
    career: careerRow ? toSeasonLine(careerRow, true) : null,
  };
}

function toSeasonLine(
  row: Record<string, unknown>,
  isCareer: boolean
): PlayerSeasonLine {
  return {
    season: isCareer ? "Career" : asString(row.SEASON_ID) ?? "Season",
    team: asString(row.TEAM_ABBREVIATION),
    games: asNumber(row.GP),
    minutes: asNumber(row.MIN),
    points: asNumber(row.PTS),
    rebounds: asNumber(row.REB),
    assists: asNumber(row.AST),
    steals: asNumber(row.STL),
    blocks: asNumber(row.BLK),
    turnovers: asNumber(row.TOV),
    fgPct: asNumber(row.FG_PCT),
    threePct: asNumber(row.FG3_PCT),
    ftPct: asNumber(row.FT_PCT),
    isCareer,
  };
}

export async function fetchNbaCommonPlayerInfo(
  nbaPersonId: string,
  fetcher: JsonFetcher = defaultNbaFetcher
): Promise<NbaPlayerBio | null> {
  const cacheKey = normalizeCacheKey(["nba-info", nbaPersonId]);
  const cached = bioCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const url = `https://stats.nba.com/stats/commonplayerinfo?PlayerID=${encodeURIComponent(nbaPersonId)}`;
  try {
    const json = (await fetcher(url)) as NbaStatsResponse;
    return bioCache.set(cacheKey, parseNbaCommonPlayerInfo(json));
  } catch {
    return bioCache.set(cacheKey, null);
  }
}

export async function fetchNbaCareerPerGame(
  nbaPersonId: string,
  fetcher: JsonFetcher = defaultNbaFetcher
): Promise<{ seasons: PlayerSeasonLine[]; career: PlayerSeasonLine | null }> {
  const cacheKey = normalizeCacheKey(["nba-career", nbaPersonId]);
  const cached = careerCache.get(cacheKey);
  if (cached) {
    return {
      seasons: cached.filter((line) => !line.isCareer),
      career: cached.find((line) => line.isCareer) ?? null,
    };
  }

  const url = `https://stats.nba.com/stats/playercareerstats?PlayerID=${encodeURIComponent(nbaPersonId)}&PerMode=PerGame`;
  try {
    const json = (await fetcher(url)) as NbaStatsResponse;
    const parsed = parseNbaCareerPerGame(json);
    careerCache.set(cacheKey, [
      ...parsed.seasons,
      ...(parsed.career ? [parsed.career] : []),
    ]);
    return parsed;
  } catch {
    return { seasons: [], career: null };
  }
}

export async function lookupNbaPersonIdByName(
  playerName: string,
  fetcher: JsonFetcher = defaultNbaFetcher
): Promise<string | null> {
  const cacheKey = "nba-all-players";
  let players = allPlayersCache.get(cacheKey);
  if (!players) {
    const season = currentNbaSeasonId();
    const url = `https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=${season}&IsOnlyCurrentSeason=0`;
    try {
      const json = (await fetcher(url)) as NbaStatsResponse;
      players = rowsFromNbaResultSet(
        findNbaResultSet(json, "CommonAllPlayers")
      ).flatMap((row) => {
        const id = asString(row.PERSON_ID) ?? String(row.PERSON_ID ?? "");
        const name = asString(row.DISPLAY_FIRST_LAST);
        return id && name ? [{ id, name }] : [];
      });
      allPlayersCache.set(cacheKey, players);
    } catch {
      return null;
    }
  }

  const target = normalizePersonName(playerName);
  const exact = players.find((player) => normalizePersonName(player.name) === target);
  return exact?.id ?? null;
}

export function currentNbaSeasonId(asOf = new Date()): string {
  const startYear =
    asOf.getUTCMonth() >= 9 ? asOf.getUTCFullYear() : asOf.getUTCFullYear() - 1;
  const end = String(startYear + 1).slice(-2);
  return `${startYear}-${end}`;
}

export function currentNbaSeasonStartYear(asOf = new Date()): number {
  return asOf.getUTCMonth() >= 9 ? asOf.getUTCFullYear() : asOf.getUTCFullYear() - 1;
}

export function seasonStartYear(seasonId: string): number | null {
  const match = seasonId.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

export function clearNbaCaches(): void {
  bioCache.clear();
  careerCache.clear();
  allPlayersCache.clear();
}

import { TtlCache, normalizeCacheKey } from "@/lib/player-stats/cache";
import { fetchJson } from "@/lib/player-stats/fetch";
import { normalizePersonName } from "@/lib/player-stats/wikidata";
import { asNumber, asString, readRecordNumber } from "@/lib/player-stats/values";
import type {
  JsonFetcher,
  PlayerPublicBio,
  PlayerSeasonLine,
} from "@/lib/player-stats/types";

const MLB_TTL_MS = 6 * 60 * 60 * 1000;
const searchCache = new TtlCache<MlbPersonHit | null>(MLB_TTL_MS);
const bioCache = new TtlCache<MlbPersonBio | null>(MLB_TTL_MS);
const careerCache = new TtlCache<{
  seasons: PlayerSeasonLine[];
  career: PlayerSeasonLine | null;
}>(MLB_TTL_MS);

export interface MlbPersonHit {
  id: string;
  fullName: string;
}

export interface MlbPersonBio {
  mlbPersonId: string;
  displayName: string;
  team: string | null;
  birthDate: string | null;
  birthYear: number | null;
  position: string | null;
  draftYear: number | null;
}

interface MlbPeopleResponse {
  people?: Array<Record<string, unknown>>;
}

interface MlbStatsResponse {
  stats?: Array<{
    type?: { displayName?: string };
    group?: { displayName?: string };
    splits?: Array<Record<string, unknown>>;
  }>;
}

function readPerson(row: Record<string, unknown>): MlbPersonHit | null {
  const id = asString(row.id) ?? (row.id != null ? String(row.id) : null);
  const fullName = asString(row.fullName) ?? asString(row.nameFirstLast);
  if (!id || !fullName) return null;
  return { id, fullName };
}

export function pickMlbPerson(
  people: MlbPersonHit[],
  playerName: string
): MlbPersonHit | null {
  const target = normalizePersonName(playerName);
  if (!target) return null;
  const exact = people.find((person) => normalizePersonName(person.fullName) === target);
  return exact ?? null;
}

export function parseMlbPeopleSearch(json: unknown): MlbPersonHit[] {
  const people = (json as MlbPeopleResponse).people ?? [];
  return people.flatMap((row) => {
    const person = readPerson(row);
    return person ? [person] : [];
  });
}

export function parseMlbPersonBio(
  json: unknown,
  fallbackId: string
): MlbPersonBio | null {
  const person = (json as MlbPeopleResponse).people?.[0];
  if (!person) return null;
  const id = asString(person.id) ?? fallbackId;
  const displayName = asString(person.fullName);
  if (!displayName) return null;
  const birthDate = asString(person.birthDate);
  const birthYear = birthDate ? Number(birthDate.slice(0, 4)) : null;
  const team =
    asString((person.currentTeam as { name?: string } | undefined)?.name) ?? null;
  const position =
    asString(
      (person.primaryPosition as { abbreviation?: string } | undefined)?.abbreviation
    ) ?? null;
  return {
    mlbPersonId: String(id),
    displayName,
    team,
    birthDate,
    birthYear: Number.isFinite(birthYear) ? birthYear : null,
    position,
    draftYear: null,
  };
}

function hittingProduction(stat: Record<string, unknown>): number | null {
  const ops = readRecordNumber(stat, ["ops", "obpPlusSlg"]);
  const avg = readRecordNumber(stat, ["avg", "battingAverage"]);
  if (ops == null && avg == null) return null;
  const opsValue = ops ?? (avg != null ? avg + 0.32 : null);
  if (opsValue == null) return null;
  const hr = readRecordNumber(stat, ["homeRuns", "hr"]) ?? 0;
  const t = Math.max(0, Math.min(1, (opsValue - 0.65) / 0.4));
  return Math.round(28 + t * 64 + Math.min(8, hr / 6));
}

function pitchingProduction(stat: Record<string, unknown>): number | null {
  const era = readRecordNumber(stat, ["era"]);
  if (era == null) return null;
  const t = Math.max(0, Math.min(1, (5.5 - era) / 3));
  const wins = readRecordNumber(stat, ["wins", "w"]) ?? 0;
  return Math.round(28 + t * 64 + Math.min(8, wins / 2));
}

function hittingLine(
  season: string,
  team: string | null,
  stat: Record<string, unknown>,
  isCareer = false
): PlayerSeasonLine | null {
  const games = readRecordNumber(stat, ["gamesPlayed", "g"]);
  const ops = readRecordNumber(stat, ["ops"]);
  const production = hittingProduction(stat);
  if (games == null && ops == null && production == null) return null;
  return {
    season,
    team,
    games,
    minutes: null,
    points: ops,
    rebounds: readRecordNumber(stat, ["homeRuns", "hr"]),
    assists: readRecordNumber(stat, ["rbi", "runsBattedIn"]),
    steals: readRecordNumber(stat, ["stolenBases", "sb"]),
    blocks: null,
    turnovers: null,
    fgPct: readRecordNumber(stat, ["avg"]),
    threePct: null,
    ftPct: null,
    production,
    isCareer,
  };
}

function pitchingLine(
  season: string,
  team: string | null,
  stat: Record<string, unknown>,
  isCareer = false
): PlayerSeasonLine | null {
  const games = readRecordNumber(stat, ["gamesPlayed", "g"]);
  const era = readRecordNumber(stat, ["era"]);
  const production = pitchingProduction(stat);
  if (games == null && era == null && production == null) return null;
  return {
    season,
    team,
    games,
    minutes: readRecordNumber(stat, ["inningsPitched", "ip"]),
    points: era,
    rebounds: readRecordNumber(stat, ["strikeOuts", "so"]),
    assists: readRecordNumber(stat, ["wins", "w"]),
    steals: null,
    blocks: null,
    turnovers: null,
    fgPct: readRecordNumber(stat, ["whip"]),
    threePct: null,
    ftPct: null,
    production,
    isCareer,
  };
}

export function parseMlbPlayerStats(json: unknown): {
  seasons: PlayerSeasonLine[];
  career: PlayerSeasonLine | null;
} {
  const groups = (json as MlbStatsResponse).stats ?? [];
  const hittingSeasons: PlayerSeasonLine[] = [];
  const pitchingSeasons: PlayerSeasonLine[] = [];
  let hittingCareer: PlayerSeasonLine | null = null;
  let pitchingCareer: PlayerSeasonLine | null = null;

  for (const group of groups) {
    const groupName = (group.group?.displayName ?? "").toLowerCase();
    const typeName = (group.type?.displayName ?? "").toLowerCase();
    const isCareer = typeName.includes("career");
    const isPitching = groupName.includes("pitch");
    for (const split of group.splits ?? []) {
      const stat = (split.stat ?? {}) as Record<string, unknown>;
      const season = asString(split.season) ?? (isCareer ? "Career" : null);
      if (!season) continue;
      const team =
        asString((split.team as { name?: string } | undefined)?.name) ??
        asString((split.team as { abbreviation?: string } | undefined)?.abbreviation) ??
        null;
      const line = isPitching
        ? pitchingLine(season, team, stat, isCareer)
        : hittingLine(season, team, stat, isCareer);
      if (!line) continue;
      if (isCareer) {
        if (isPitching) pitchingCareer = line;
        else hittingCareer = line;
      } else if (isPitching) {
        pitchingSeasons.push(line);
      } else {
        hittingSeasons.push(line);
      }
    }
  }

  const hittingGames = hittingSeasons.reduce((sum, line) => sum + (line.games ?? 0), 0);
  const pitchingGames = pitchingSeasons.reduce((sum, line) => sum + (line.games ?? 0), 0);
  const usePitching = hittingSeasons.length === 0 || pitchingGames > hittingGames * 1.5;

  return usePitching
    ? { seasons: pitchingSeasons, career: pitchingCareer }
    : { seasons: hittingSeasons, career: hittingCareer };
}

export function mlbBioToPublic(bio: MlbPersonBio): Partial<PlayerPublicBio> {
  return {
    team: bio.team,
    birthDate: bio.birthDate,
    birthYear: bio.birthYear,
    position: bio.position,
    draftYear: bio.draftYear,
    mlbPersonId: bio.mlbPersonId,
  };
}

export async function searchMlbPerson(
  playerName: string,
  fetcher: JsonFetcher = fetchJson
): Promise<MlbPersonHit | null> {
  const cacheKey = normalizeCacheKey(["mlb-search", playerName]);
  const cached = searchCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const url = new URL("https://statsapi.mlb.com/api/v1/people/search");
  url.searchParams.set("names", playerName);
  try {
    const json = await fetcher(url.toString());
    const hit = pickMlbPerson(parseMlbPeopleSearch(json), playerName);
    return searchCache.set(cacheKey, hit);
  } catch {
    return searchCache.set(cacheKey, null);
  }
}

export async function fetchMlbPersonBio(
  personId: string,
  fetcher: JsonFetcher = fetchJson
): Promise<MlbPersonBio | null> {
  const cacheKey = normalizeCacheKey(["mlb-bio", personId]);
  const cached = bioCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const url = `https://statsapi.mlb.com/api/v1/people/${encodeURIComponent(personId)}?hydrate=currentTeam`;
  try {
    const json = await fetcher(url);
    return bioCache.set(cacheKey, parseMlbPersonBio(json, personId));
  } catch {
    return bioCache.set(cacheKey, null);
  }
}

export async function fetchMlbCareerStats(
  personId: string,
  fetcher: JsonFetcher = fetchJson
): Promise<{ seasons: PlayerSeasonLine[]; career: PlayerSeasonLine | null }> {
  const cacheKey = normalizeCacheKey(["mlb-career", personId]);
  const cached = careerCache.get(cacheKey);
  if (cached) return cached;

  const url = `https://statsapi.mlb.com/api/v1/people/${encodeURIComponent(personId)}/stats?stats=yearByYear,career&group=hitting,pitching`;
  try {
    const json = await fetcher(url);
    return careerCache.set(cacheKey, parseMlbPlayerStats(json));
  } catch {
    return { seasons: [], career: null };
  }
}

export function clearMlbCaches(): void {
  searchCache.clear();
  bioCache.clear();
  careerCache.clear();
}

import { TtlCache, normalizeCacheKey } from "@/lib/player-stats/cache";
import { fetchJson } from "@/lib/player-stats/fetch";
import { normalizePersonName } from "@/lib/player-stats/wikidata";
import { asNumber, asString, readRecordNumber } from "@/lib/player-stats/values";
import type { JsonFetcher, PlayerSeasonLine } from "@/lib/player-stats/types";

const NHL_TTL_MS = 6 * 60 * 60 * 1000;
const searchCache = new TtlCache<NhlPlayerHit | null>(NHL_TTL_MS);
const landingCache = new TtlCache<NhlLandingSnapshot | null>(NHL_TTL_MS);

export interface NhlPlayerHit {
  id: string;
  name: string;
}

export interface NhlPlayerBio {
  nhlPlayerId: string;
  displayName: string;
  team: string | null;
  birthDate: string | null;
  birthYear: number | null;
  position: string | null;
}

export interface NhlLandingSnapshot {
  bio: NhlPlayerBio;
  seasons: PlayerSeasonLine[];
  career: PlayerSeasonLine | null;
}

function localizedName(value: unknown): string | null {
  if (typeof value === "string") return asString(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asString(record.default) ?? asString(record.en);
  }
  return null;
}

export function parseNhlSearchHits(json: unknown): NhlPlayerHit[] {
  const rows = Array.isArray(json)
    ? json
    : Array.isArray((json as { players?: unknown[] }).players)
      ? (json as { players: unknown[] }).players
      : Array.isArray((json as { suggestions?: unknown[] }).suggestions)
        ? (json as { suggestions: unknown[] }).suggestions
        : [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    const id =
      asString(record.playerId) ??
      (record.playerId != null ? String(record.playerId) : null) ??
      asString(record.id);
    const name =
      asString(record.name) ??
      [localizedName(record.firstName), localizedName(record.lastName)]
        .filter(Boolean)
        .join(" ")
        .trim();
    if (!id || !name) return [];
    return [{ id: String(id), name }];
  });
}

export function pickNhlPlayer(
  hits: NhlPlayerHit[],
  playerName: string
): NhlPlayerHit | null {
  const target = normalizePersonName(playerName);
  if (!target) return null;
  return hits.find((hit) => normalizePersonName(hit.name) === target) ?? null;
}

function hockeyProduction(goals: number | null, assists: number | null, points: number | null) {
  const pts = points ?? ((goals ?? 0) + (assists ?? 0) || null);
  if (pts == null) return null;
  const perGameLike = pts > 8 ? pts / 82 : pts;
  const t = Math.max(0, Math.min(1, (perGameLike - 0.25) / 1.25));
  return Math.round(28 + t * 64);
}

function hockeyLine(
  season: string,
  team: string | null,
  stats: Record<string, unknown>,
  isCareer = false
): PlayerSeasonLine | null {
  const games = readRecordNumber(stats, ["gamesPlayed", "gp"]);
  const goals = readRecordNumber(stats, ["goals", "g"]);
  const assists = readRecordNumber(stats, ["assists", "a"]);
  const points = readRecordNumber(stats, ["points", "p"]);
  const production = hockeyProduction(goals, assists, points);
  if (games == null && points == null && production == null) return null;
  return {
    season,
    team,
    games,
    minutes: readRecordNumber(stats, ["avgToi", "timeOnIcePerGame"]),
    points: points,
    rebounds: goals,
    assists,
    steals: null,
    blocks: readRecordNumber(stats, ["blockedShots"]),
    turnovers: null,
    fgPct: null,
    threePct: null,
    ftPct: null,
    production,
    isCareer,
  };
}

function formatNhlSeason(value: unknown): string | null {
  const numeric = asNumber(value);
  if (numeric != null && numeric > 19000000) {
    const raw = String(Math.trunc(numeric));
    return `${raw.slice(0, 4)}-${raw.slice(6, 8)}`;
  }
  return asString(value);
}

export function parseNhlLanding(json: unknown, playerId: string): NhlLandingSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  const first = localizedName(record.firstName);
  const last = localizedName(record.lastName);
  const displayName =
    [first, last].filter(Boolean).join(" ").trim() || asString(record.displayName);
  if (!displayName) return null;

  const birthDate = asString(record.birthDate);
  const birthYear = birthDate ? Number(birthDate.slice(0, 4)) : null;
  const team =
    localizedName(record.fullTeamName) ??
    asString(record.currentTeamAbbrev) ??
    null;

  const featured = (record.featuredStats ?? {}) as Record<string, unknown>;
  const regular = (featured.regularSeason ?? {}) as Record<string, unknown>;
  const careerStats = (regular.career ?? {}) as Record<string, unknown>;
  const currentStats = (regular.subSeason ?? {}) as Record<string, unknown>;

  const seasons: PlayerSeasonLine[] = [];
  const totals = Array.isArray(record.seasonTotals) ? record.seasonTotals : [];
  for (const row of totals) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const gameType = asNumber(item.gameTypeId);
    if (gameType != null && gameType !== 2) continue;
    const season = formatNhlSeason(item.season);
    if (!season) continue;
    const line = hockeyLine(
      season,
      localizedName(item.teamName) ?? asString(item.teamAbbrev),
      item
    );
    if (line) seasons.push(line);
  }

  if (seasons.length === 0 && Object.keys(currentStats).length > 0) {
    const line = hockeyLine("Current", team, currentStats);
    if (line) seasons.push(line);
  }

  const career = hockeyLine("Career", team, careerStats, true);

  return {
    bio: {
      nhlPlayerId: playerId,
      displayName,
      team,
      birthDate,
      birthYear: Number.isFinite(birthYear) ? birthYear : null,
      position: asString(record.position) ?? asString(record.positionCode),
    },
    seasons,
    career,
  };
}

export async function searchNhlPlayer(
  playerName: string,
  fetcher: JsonFetcher = fetchJson
): Promise<NhlPlayerHit | null> {
  const cacheKey = normalizeCacheKey(["nhl-search", playerName]);
  const cached = searchCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const urls = [
    `https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=8&q=${encodeURIComponent(playerName)}`,
    `https://api-web.nhle.com/v1/search/player?culture=en-us&q=${encodeURIComponent(playerName)}`,
  ];

  for (const url of urls) {
    try {
      const json = await fetcher(url);
      const hit = pickNhlPlayer(parseNhlSearchHits(json), playerName);
      if (hit) return searchCache.set(cacheKey, hit);
    } catch {
      // try the next public endpoint
    }
  }

  return searchCache.set(cacheKey, null);
}

export async function fetchNhlLanding(
  playerId: string,
  fetcher: JsonFetcher = fetchJson
): Promise<NhlLandingSnapshot | null> {
  const cacheKey = normalizeCacheKey(["nhl-landing", playerId]);
  const cached = landingCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const url = `https://api-web.nhle.com/v1/player/${encodeURIComponent(playerId)}/landing`;
  try {
    const json = await fetcher(url);
    return landingCache.set(cacheKey, parseNhlLanding(json, playerId));
  } catch {
    return landingCache.set(cacheKey, null);
  }
}

export function clearNhlCaches(): void {
  searchCache.clear();
  landingCache.clear();
}

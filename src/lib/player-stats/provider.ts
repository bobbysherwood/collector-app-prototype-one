import { TtlCache, normalizeCacheKey } from "@/lib/player-stats/cache";
import {
  ageFromBirthDate,
  derivePlayerProfile,
  deriveQualitySignals,
  emptyPlayerBio,
} from "@/lib/player-stats/derive";
import { fetchJson } from "@/lib/player-stats/fetch";
import { resolvePlayerImageUrl } from "@/lib/player-stats/image";
import {
  fetchMlbCareerStats,
  fetchMlbPersonBio,
  mlbBioToPublic,
  searchMlbPerson,
} from "@/lib/player-stats/mlb-stats";
import {
  fetchNbaCareerPerGame,
  fetchNbaCommonPlayerInfo,
  lookupNbaPersonIdByName,
} from "@/lib/player-stats/nba-stats";
import {
  espnNflHeadshotUrl,
  fetchEspnNflAthlete,
  fetchEspnNflStats,
  searchEspnNflAthlete,
} from "@/lib/player-stats/nfl-espn";
import {
  fetchNhlLanding,
  searchNhlPlayer,
} from "@/lib/player-stats/nhl-stats";
import { isExactPlayerNameMatch } from "@/lib/player-stats/persist-profile";
import {
  isBasketballSport,
  isSupportedPlayerStatsSport,
  resolvePlayerStatsSport,
  type PlayerStatsSport,
} from "@/lib/player-stats/sport";
import {
  fetchWikidataPlayerBio,
  isHighConfidenceWikidataMatch,
  searchWikidataPlayer,
} from "@/lib/player-stats/wikidata";
import type {
  JsonFetcher,
  PlayerLiveStatsSnapshot,
  PlayerPublicBio,
  PlayerSeasonLine,
  PlayerStatsLookupInput,
} from "@/lib/player-stats/types";

export { isBasketballSport, isSupportedPlayerStatsSport };

const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
const snapshotCache = new TtlCache<PlayerLiveStatsSnapshot>(SNAPSHOT_TTL_MS);

export interface PlayerStatsProviderDeps {
  fetchJson?: JsonFetcher;
  fetchNbaJson?: JsonFetcher;
  fetchMlbJson?: JsonFetcher;
  fetchNhlJson?: JsonFetcher;
  fetchEspnJson?: JsonFetcher;
  probeImage?: (url: string) => Promise<boolean>;
  now?: () => Date;
  wikiOnly?: boolean;
}

function mergeBio(parts: {
  wikidata?: {
    wikidataId: string;
    birthDate: string | null;
    birthYear: number | null;
    team: string | null;
    college: string | null;
    draftYear: number | null;
    nbaPersonId: string | null;
  } | null;
  league?: Partial<PlayerPublicBio> | null;
  asOf: Date;
}): PlayerPublicBio {
  const wiki = parts.wikidata;
  const league = parts.league;
  const birthDate = league?.birthDate ?? wiki?.birthDate ?? null;
  const birthYear = league?.birthYear ?? wiki?.birthYear ?? null;

  return {
    team: league?.team ?? wiki?.team ?? null,
    birthDate,
    birthYear,
    age: ageFromBirthDate(birthDate, birthYear, parts.asOf),
    college: league?.college ?? wiki?.college ?? null,
    draftYear: league?.draftYear ?? wiki?.draftYear ?? null,
    draftRound: league?.draftRound ?? null,
    draftPick: league?.draftPick ?? null,
    undrafted: league?.undrafted ?? false,
    position: league?.position ?? null,
    nbaPersonId: league?.nbaPersonId ?? wiki?.nbaPersonId ?? null,
    wikidataId: wiki?.wikidataId ?? null,
    mlbPersonId: league?.mlbPersonId ?? null,
    nhlPlayerId: league?.nhlPlayerId ?? null,
    espnAthleteId: league?.espnAthleteId ?? null,
  };
}

async function loadBasketballLeague(
  input: PlayerStatsLookupInput,
  wikiNbaId: string | null,
  fetcher: JsonFetcher | undefined,
  sourceNotes: string[]
): Promise<{
  leagueBio: Partial<PlayerPublicBio> | null;
  seasons: PlayerSeasonLine[];
  career: PlayerSeasonLine | null;
  resolvedName: string | null;
}> {
  let nbaPersonId = wikiNbaId;
  if (!nbaPersonId) {
    nbaPersonId = await lookupNbaPersonIdByName(input.playerName, fetcher);
    if (nbaPersonId) {
      sourceNotes.push("NBA person id resolved from the NBA player index");
    }
  }

  const [nbaBio, career] = nbaPersonId
    ? await Promise.all([
        fetchNbaCommonPlayerInfo(nbaPersonId, fetcher),
        fetchNbaCareerPerGame(nbaPersonId, fetcher),
      ])
    : [null, { seasons: [] as PlayerSeasonLine[], career: null }];

  if (nbaBio) sourceNotes.push("Roster and draft details from NBA Stats");
  if (career.seasons.length > 0) {
    sourceNotes.push("Per-game lines from NBA Stats playercareerstats");
  } else if (nbaPersonId && !nbaBio) {
    sourceNotes.push("NBA Stats did not return player info or was blocked");
  }

  return {
    leagueBio: nbaBio,
    seasons: career.seasons,
    career: career.career,
    resolvedName: nbaBio?.displayName ?? null,
  };
}

async function loadBaseballLeague(
  input: PlayerStatsLookupInput,
  fetcher: JsonFetcher | undefined,
  sourceNotes: string[]
) {
  const hit = await searchMlbPerson(input.playerName, fetcher);
  if (!hit) {
    sourceNotes.push("MLB Stats API did not return an exact player match");
    return emptyLeague();
  }

  const [mlbBio, career] = await Promise.all([
    fetchMlbPersonBio(hit.id, fetcher),
    fetchMlbCareerStats(hit.id, fetcher),
  ]);
  if (mlbBio) sourceNotes.push("Roster details from MLB Stats API");
  if (career.seasons.length > 0) {
    sourceNotes.push("Season lines from MLB Stats API");
  } else if (!mlbBio) {
    sourceNotes.push("MLB Stats API did not return player info or was blocked");
  }

  return {
    leagueBio: mlbBio ? mlbBioToPublic(mlbBio) : { mlbPersonId: hit.id },
    seasons: career.seasons,
    career: career.career,
    resolvedName: mlbBio?.displayName ?? hit.fullName,
  };
}

async function loadHockeyLeague(
  input: PlayerStatsLookupInput,
  fetcher: JsonFetcher | undefined,
  sourceNotes: string[]
) {
  const hit = await searchNhlPlayer(input.playerName, fetcher);
  if (!hit) {
    sourceNotes.push("NHL public API did not return an exact player match");
    return emptyLeague();
  }

  const landing = await fetchNhlLanding(hit.id, fetcher);
  if (landing) {
    sourceNotes.push("Bio and career totals from NHL public API");
  } else {
    sourceNotes.push("NHL public API did not return player info or was blocked");
  }

  return {
    leagueBio: landing
      ? {
          team: landing.bio.team,
          birthDate: landing.bio.birthDate,
          birthYear: landing.bio.birthYear,
          position: landing.bio.position,
          nhlPlayerId: landing.bio.nhlPlayerId,
        }
      : { nhlPlayerId: hit.id },
    seasons: landing?.seasons ?? [],
    career: landing?.career ?? null,
    resolvedName: landing?.bio.displayName ?? hit.name,
  };
}

async function loadFootballLeague(
  input: PlayerStatsLookupInput,
  fetcher: JsonFetcher | undefined,
  sourceNotes: string[]
) {
  const hit = await searchEspnNflAthlete(input.playerName, fetcher);
  if (!hit) {
    sourceNotes.push("ESPN did not return an exact NFL player match");
    return emptyLeague();
  }

  const [bio, career] = await Promise.all([
    fetchEspnNflAthlete(hit.id, fetcher),
    fetchEspnNflStats(hit.id, fetcher),
  ]);
  if (bio) sourceNotes.push("Roster details from ESPN NFL athlete JSON");
  if (career.seasons.length > 0 || career.career) {
    sourceNotes.push("Season lines from ESPN NFL athlete stats");
  } else if (!bio) {
    sourceNotes.push("ESPN NFL did not return player info or was blocked");
  }

  return {
    leagueBio: bio
      ? {
          team: bio.team,
          birthDate: bio.birthDate,
          birthYear: bio.birthYear,
          college: bio.college,
          position: bio.position,
          draftYear: bio.draftYear,
          espnAthleteId: bio.espnAthleteId,
        }
      : { espnAthleteId: hit.id },
    seasons: career.seasons,
    career: career.career,
    resolvedName: bio?.displayName ?? hit.displayName,
  };
}

function emptyLeague() {
  return {
    leagueBio: null as Partial<PlayerPublicBio> | null,
    seasons: [] as PlayerSeasonLine[],
    career: null as PlayerSeasonLine | null,
    resolvedName: null as string | null,
  };
}

export async function loadPlayerLiveStats(
  input: PlayerStatsLookupInput,
  deps: PlayerStatsProviderDeps = {}
): Promise<PlayerLiveStatsSnapshot | null> {
  const sport = resolvePlayerStatsSport(input.sportLabel);
  if (!sport) return null;

  const cacheKey = normalizeCacheKey([
    "player-live",
    deps.wikiOnly ? "wiki" : "full",
    sport,
    input.playerName,
    input.sportLabel,
  ]);
  const cached = snapshotCache.get(cacheKey);
  if (cached) return cached;

  const asOf = input.asOf ? new Date(input.asOf) : deps.now?.() ?? new Date();
  const wikiFetcher = deps.fetchJson ?? fetchJson;
  const sourceNotes: string[] = [];

  const hit = await searchWikidataPlayer(input.playerName, sport, wikiFetcher);
  const wikiBio = hit ? await fetchWikidataPlayerBio(hit, wikiFetcher) : null;
  if (wikiBio) {
    sourceNotes.push("Bio fields from Wikidata");
  } else if (!hit) {
    sourceNotes.push(`Wikidata did not return a ${sport} player match`);
  } else {
    sourceNotes.push("Wikidata match found but bio query failed");
  }

  let league = emptyLeague();
  if (!deps.wikiOnly) {
    league = await loadLeagueStats(sport, input, wikiBio?.nbaPersonId ?? null, deps, sourceNotes);
  }

  const bio = mergeBio({ wikidata: wikiBio, league: league.leagueBio, asOf });
  const qualitySignals = deriveQualitySignals(league.seasons, league.career, {
    sport,
    bio,
    asOf,
  });
  const playerProfile = derivePlayerProfile(bio, league.seasons, asOf, sport);
  const espnId = bio.espnAthleteId;
  const image = await resolvePlayerImageUrl({
    nbaPersonId: bio.nbaPersonId,
    wikidataImage: wikiBio?.imageUrl,
    playerName: input.playerName,
    fallbackUrl: espnId ? espnNflHeadshotUrl(espnId) : null,
    fallbackSource: espnId ? "ESPN headshot" : null,
    probeImage: deps.probeImage,
    fetchJson: wikiFetcher,
  });
  if (image) {
    sourceNotes.push(`Player image from ${image.source}`);
  }

  const persistEligible =
    (hit != null && isHighConfidenceWikidataMatch(hit, input.playerName, sport)) ||
    isExactPlayerNameMatch(input.playerName, league.resolvedName);

  const snapshot: PlayerLiveStatsSnapshot = {
    sportSupported: true,
    playerName: input.playerName,
    sportLabel: input.sportLabel,
    bio,
    imageUrl: image?.url ?? null,
    seasons: league.seasons,
    career: league.career,
    playerProfile,
    qualitySignals,
    sourceNotes,
    persistEligible,
  };

  return snapshotCache.set(cacheKey, snapshot);
}

async function loadLeagueStats(
  sport: PlayerStatsSport,
  input: PlayerStatsLookupInput,
  wikiNbaId: string | null,
  deps: PlayerStatsProviderDeps,
  sourceNotes: string[]
) {
  switch (sport) {
    case "basketball":
      return loadBasketballLeague(
        input,
        wikiNbaId,
        deps.fetchNbaJson ?? deps.fetchJson,
        sourceNotes
      );
    case "baseball":
      return loadBaseballLeague(input, deps.fetchMlbJson ?? deps.fetchJson, sourceNotes);
    case "hockey":
      return loadHockeyLeague(input, deps.fetchNhlJson ?? deps.fetchJson, sourceNotes);
    case "football":
      return loadFootballLeague(input, deps.fetchEspnJson ?? deps.fetchJson, sourceNotes);
  }
}

export function clearPlayerLiveStatsCache(): void {
  snapshotCache.clear();
}

export function emptyLiveStatsSnapshot(
  playerName: string,
  sportLabel: string
): PlayerLiveStatsSnapshot {
  const bio = emptyPlayerBio();
  return {
    sportSupported: isSupportedPlayerStatsSport(sportLabel),
    playerName,
    sportLabel,
    bio,
    imageUrl: null,
    seasons: [],
    career: null,
    playerProfile: {
      birthYear: null,
      careerStatus: null,
      injuryStatus: null,
      injuryRisk: null,
      team: null,
    },
    qualitySignals: {
      careerStrength: null,
      legacyStrength: null,
      culturalRelevance: null,
      injuryRisk: null,
      availableFieldCount: 0,
      provenanceNotes: ["No live player-stats signals available"],
    },
    sourceNotes: [],
    persistEligible: false,
  };
}

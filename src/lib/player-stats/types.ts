import type {
  PlayerProfileSignals,
  PlayerQualitySignals,
} from "@/types/player-opportunity";

export interface PlayerSeasonLine {
  season: string;
  team: string | null;
  games: number | null;
  minutes: number | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fgPct: number | null;
  threePct: number | null;
  ftPct: number | null;
  /** 0-100 sport-aware production proxy. Used when NBA counting stats do not apply. */
  production?: number | null;
  isCareer?: boolean;
}

export interface PlayerPublicBio {
  team: string | null;
  birthDate: string | null;
  birthYear: number | null;
  age: number | null;
  college: string | null;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  undrafted: boolean;
  position: string | null;
  nbaPersonId: string | null;
  wikidataId: string | null;
  mlbPersonId?: string | null;
  nhlPlayerId?: string | null;
  espnAthleteId?: string | null;
}

export interface PlayerLiveStatsSnapshot {
  sportSupported: boolean;
  playerName: string;
  sportLabel: string;
  bio: PlayerPublicBio;
  imageUrl: string | null;
  seasons: PlayerSeasonLine[];
  career: PlayerSeasonLine | null;
  playerProfile: PlayerProfileSignals;
  qualitySignals: PlayerQualitySignals;
  sourceNotes: string[];
  persistEligible: boolean;
}

export interface PlayerStatsLookupInput {
  playerName: string;
  sportLabel: string;
  asOf?: string;
}

export type JsonFetcher = (
  url: string,
  init?: RequestInit & { timeoutMs?: number }
) => Promise<unknown>;

export interface NbaResultSet {
  name?: string;
  headers: string[];
  rowSet: unknown[][];
}

export interface NbaStatsResponse {
  resultSets?: NbaResultSet[];
}

export interface WikidataSearchHit {
  id: string;
  label: string;
  description?: string;
}

export interface WikidataBio {
  wikidataId: string;
  label: string;
  birthDate: string | null;
  birthYear: number | null;
  team: string | null;
  college: string | null;
  draftYear: number | null;
  nbaPersonId: string | null;
  imageUrl: string | null;
}

export interface NbaPlayerBio {
  nbaPersonId: string;
  displayName: string;
  team: string | null;
  birthDate: string | null;
  birthYear: number | null;
  college: string | null;
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
  undrafted: boolean;
  position: string | null;
  fromYear: number | null;
  toYear: number | null;
}

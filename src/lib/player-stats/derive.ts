import { seasonStartYear } from "@/lib/player-stats/nba-stats";
import {
  currentSeasonStartYear,
  type PlayerStatsSport,
} from "@/lib/player-stats/sport";
import type { PlayerPublicBio, PlayerSeasonLine } from "@/lib/player-stats/types";
import type {
  PlayerOpportunityLifecycle,
  PlayerProfileSignals,
  PlayerQualitySignals,
} from "@/types/player-opportunity";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scale(value: number, min: number, max: number, outMin: number, outMax: number): number {
  if (max <= min) return outMin;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return outMin + t * (outMax - outMin);
}

export function ageFromBirthDate(
  birthDate: string | null,
  birthYear: number | null,
  asOf = new Date()
): number | null {
  if (birthDate) {
    const born = new Date(`${birthDate}T00:00:00Z`);
    if (!Number.isNaN(born.getTime())) {
      let age = asOf.getUTCFullYear() - born.getUTCFullYear();
      const monthDelta = asOf.getUTCMonth() - born.getUTCMonth();
      if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < born.getUTCDate())) {
        age -= 1;
      }
      return age;
    }
  }
  return birthYear != null ? asOf.getUTCFullYear() - birthYear : null;
}

export function lifecycleFromPublicCareer(input: {
  birthYear?: number | null;
  lastSeasonStartYear?: number | null;
  seasonCount?: number;
  asOf?: Date;
  sport?: PlayerStatsSport | null;
}): PlayerOpportunityLifecycle {
  const asOf = input.asOf ?? new Date();
  const asOfYear = asOf.getUTCFullYear();
  const age = input.birthYear != null ? asOfYear - input.birthYear : null;
  const currentStart = currentSeasonStartYear(input.sport ?? "basketball", asOf);
  const last = input.lastSeasonStartYear;

  if (last != null && last < currentStart - 1) {
    return "retired";
  }
  if (age != null && age <= 21) return "prospect";
  if ((input.seasonCount ?? 99) <= 2 && (age == null || age <= 23)) {
    return "prospect";
  }
  return "active";
}

function countingScore(points: number | null, rebounds: number | null, assists: number | null): number | null {
  if (points == null && rebounds == null && assists == null) return null;
  const pts = points ?? 0;
  const reb = rebounds ?? 0;
  const ast = assists ?? 0;
  const scoring = scale(pts, 6, 28, 28, 92);
  const twoWay = scale(reb + ast, 2, 16, 0, 12);
  return clampScore(scoring + twoWay);
}

export function deriveQualitySignals(
  seasons: PlayerSeasonLine[],
  career: PlayerSeasonLine | null,
  options?: {
    sport?: PlayerStatsSport | null;
    bio?: PlayerPublicBio | null;
    asOf?: Date;
  }
): PlayerQualitySignals {
  const sport = options?.sport ?? "basketball";
  const regular = seasons.filter((line) => !line.isCareer && line.team !== "TOT");
  const notes: string[] = [];
  const careerLine =
    career ??
    (regular.length > 0
      ? {
          ...regular[regular.length - 1],
          isCareer: true,
        }
      : null);

  const careerStrength = lineProductionScore(careerLine, sport);
  if (careerStrength != null) {
    notes.push(
      sport === "basketball"
        ? "Career strength derived from NBA per-game counting stats"
        : `Career strength derived from ${sport} counting stats`
    );
  }

  const seasonCount = new Set(
    regular.map((line) => line.season).filter((season) => season !== "Career")
  ).size;
  const latest = [...regular].reverse()[0];
  const volume = (careerLine?.points ?? careerLine?.production ?? 0) * Math.max(seasonCount, 1);
  const legacyStrength =
    careerStrength == null
      ? null
      : clampScore(
          careerStrength * 0.7 +
            scale(seasonCount, 1, 15, 5, 25) +
            scale(volume, 20, 350, 0, 10)
        );
  if (legacyStrength != null) {
    notes.push("Legacy strength derived from career production and seasons played");
  }

  const recent = lineProductionScore(latest, sport);
  const culturalRelevance =
    recent == null && careerStrength == null
      ? null
      : clampScore(((recent ?? careerStrength ?? 50) + (careerStrength ?? 50)) / 2);
  if (culturalRelevance != null) {
    notes.push("Cultural relevance proxied from recent and career production");
  }

  const injuryRisk = inferInjuryRisk(regular, sport);

  let next = {
    careerStrength,
    legacyStrength,
    culturalRelevance,
    injuryRisk,
  };

  if (
    next.careerStrength == null &&
    next.legacyStrength == null &&
    next.culturalRelevance == null
  ) {
    next = {
      ...next,
      ...qualityFromPublicBio(options?.bio ?? null, sport, options?.asOf),
    };
    if (next.legacyStrength != null || next.culturalRelevance != null) {
      notes.push("Thinner quality signals derived from public bio (age and career length)");
    }
  }

  const values = [
    next.careerStrength,
    next.legacyStrength,
    next.culturalRelevance,
    next.injuryRisk,
  ];
  const availableFieldCount = values.filter((value) => value != null).length;

  return {
    ...next,
    availableFieldCount,
    provenanceNotes:
      notes.length > 0
        ? notes
        : ["No usable public counting stats or bio signals were available"],
  };
}

function lineProductionScore(
  line: PlayerSeasonLine | null | undefined,
  sport: PlayerStatsSport
): number | null {
  if (!line) return null;
  if (line.production != null) return clampScore(line.production);
  if (sport === "basketball") {
    return countingScore(line.points, line.rebounds, line.assists);
  }
  if (sport === "hockey") {
    return countingScore(
      (line.points ?? 0) * 20,
      line.rebounds,
      line.assists
    );
  }
  if (sport === "baseball") {
    const ops = line.points;
    if (ops == null) return null;
    return clampScore(scale(ops, 0.65, 1.05, 28, 92) + scale(line.rebounds ?? 0, 5, 45, 0, 8));
  }
  if (sport === "football") {
    if (line.points == null && line.assists == null) return null;
    return clampScore(
      scale(line.points ?? 0, 40, 300, 28, 88) + scale(line.assists ?? 0, 0.2, 3, 0, 12)
    );
  }
  return countingScore(line.points, line.rebounds, line.assists);
}

export function qualityFromPublicBio(
  bio: PlayerPublicBio | null | undefined,
  sport: PlayerStatsSport,
  asOf = new Date()
): Pick<PlayerQualitySignals, "legacyStrength" | "culturalRelevance"> {
  if (!bio) return { legacyStrength: null, culturalRelevance: null };
  const age = ageFromBirthDate(bio.birthDate, bio.birthYear, asOf);
  const draftAge =
    bio.draftYear != null && bio.birthYear != null
      ? Math.max(0, asOf.getUTCFullYear() - bio.draftYear)
      : null;

  if (age == null && !bio.team && bio.draftYear == null) {
    return { legacyStrength: null, culturalRelevance: null };
  }

  const culturalRelevance =
    age == null
      ? bio.team
        ? 48
        : null
      : clampScore(
          age <= 21
            ? 46
            : age <= 24
              ? 58
              : age <= 32
                ? 68
                : age <= 36
                  ? 56
                  : 44
        );

  const careerYears = draftAge ?? (age != null ? Math.max(0, age - 20) : null);
  const legacyStrength =
    age != null && (age >= 34 || (careerYears ?? 0) >= 10)
      ? clampScore(42 + scale(age, 34, 44, 8, 22) + scale(careerYears ?? 0, 8, 18, 0, 10))
      : sport !== "basketball" && age != null
        ? clampScore(38 + scale(age, 22, 34, 4, 16))
        : null;

  return { legacyStrength, culturalRelevance };
}

function inferInjuryRisk(
  seasons: PlayerSeasonLine[],
  sport: PlayerStatsSport
): number | null {
  const withGames = seasons.filter((line) => line.games != null);
  if (withGames.length === 0) return null;

  const latest = withGames[withGames.length - 1];
  const previous = withGames[withGames.length - 2];
  const latestGames = latest.games ?? 0;
  const thresholds = injuryGameThresholds(sport);

  if (
    previous?.games != null &&
    previous.games >= thresholds.healthyPrior &&
    latestGames <= thresholds.sharpDrop
  ) {
    return 72;
  }
  if (latestGames >= thresholds.durable) return 18;
  if (latestGames >= thresholds.regular) return 32;
  if (latestGames > 0 && latestGames < thresholds.limited) return 58;
  return null;
}

function injuryGameThresholds(sport: PlayerStatsSport) {
  switch (sport) {
    case "football":
      return { healthyPrior: 15, sharpDrop: 8, durable: 15, regular: 12, limited: 8 };
    case "baseball":
      return { healthyPrior: 130, sharpDrop: 80, durable: 140, regular: 110, limited: 80 };
    case "hockey":
      return { healthyPrior: 70, sharpDrop: 45, durable: 70, regular: 55, limited: 40 };
    case "basketball":
    default:
      return { healthyPrior: 60, sharpDrop: 40, durable: 70, regular: 55, limited: 40 };
  }
}

export function derivePlayerProfile(
  bio: PlayerPublicBio,
  seasons: PlayerSeasonLine[],
  asOf = new Date(),
  sport: PlayerStatsSport | null = "basketball"
): PlayerProfileSignals {
  const lastSeasonStartYear = [...seasons]
    .reverse()
    .map((line) => seasonStartYear(line.season))
    .find((year): year is number => year != null);
  const seasonCount = new Set(seasons.map((line) => line.season)).size;
  const hasCareerEvidence =
    lastSeasonStartYear != null ||
    seasonCount > 0 ||
    bio.birthYear != null ||
    Boolean(bio.team);

  return {
    birthYear: bio.birthYear,
    careerStatus: hasCareerEvidence
      ? lifecycleFromPublicCareer({
          birthYear: bio.birthYear,
          lastSeasonStartYear,
          seasonCount,
          asOf,
          sport,
        })
      : null,
    injuryStatus: null,
    injuryRisk: null,
    team: bio.team,
  };
}

export function emptyPlayerBio(): PlayerPublicBio {
  return {
    team: null,
    birthDate: null,
    birthYear: null,
    age: null,
    college: null,
    draftYear: null,
    draftRound: null,
    draftPick: null,
    undrafted: false,
    position: null,
    nbaPersonId: null,
    wikidataId: null,
    mlbPersonId: null,
    nhlPlayerId: null,
    espnAthleteId: null,
  };
}

export function liveStatsCanScore(input: {
  qualitySignals: PlayerQualitySignals;
  playerProfile: PlayerProfileSignals;
  seasons: PlayerSeasonLine[];
}): boolean {
  return (
    input.qualitySignals.availableFieldCount > 0 ||
    input.playerProfile.birthYear != null ||
    input.playerProfile.careerStatus != null ||
    input.seasons.length > 0 ||
    Boolean(input.playerProfile.team)
  );
}

export function formatDraftLine(bio: PlayerPublicBio): string | null {
  if (bio.undrafted) {
    return bio.draftYear != null ? `${bio.draftYear} · Undrafted` : "Undrafted";
  }
  if (bio.draftYear == null && bio.draftPick == null) return null;
  if (bio.draftPick != null && bio.draftYear != null) {
    return `${bio.draftYear} · No. ${bio.draftPick}`;
  }
  if (bio.draftYear != null) return String(bio.draftYear);
  return bio.draftPick != null ? `No. ${bio.draftPick}` : null;
}

export function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatStat(value: number | null, digits = 1): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

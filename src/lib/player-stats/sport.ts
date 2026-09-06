import { resolveResearchSport } from "@/lib/market-research/catalog";

export const PLAYER_STATS_SPORTS = [
  "basketball",
  "football",
  "baseball",
  "hockey",
] as const;

export type PlayerStatsSport = (typeof PLAYER_STATS_SPORTS)[number];

export function resolvePlayerStatsSport(
  sportLabel: string
): PlayerStatsSport | null {
  const research = resolveResearchSport(sportLabel);
  switch (research?.slug) {
    case "nba":
      return "basketball";
    case "nfl":
      return "football";
    case "mlb":
      return "baseball";
    case "nhl":
      return "hockey";
    default:
      return null;
  }
}

export function isBasketballSport(sportLabel: string): boolean {
  return resolvePlayerStatsSport(sportLabel) === "basketball";
}

export function isSupportedPlayerStatsSport(sportLabel: string): boolean {
  return resolvePlayerStatsSport(sportLabel) != null;
}

export function currentSeasonStartYear(
  sport: PlayerStatsSport | null | undefined,
  asOf = new Date()
): number {
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth();
  switch (sport) {
    case "baseball":
      return year;
    case "football":
      return month >= 8 ? year : year - 1;
    case "hockey":
    case "basketball":
    default:
      return month >= 9 ? year : year - 1;
  }
}

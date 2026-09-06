import type { CardEra } from "@/types/card-investment";

export function classifyCardEra(year: number, asOfYear?: number): CardEra {
  const currentYear = asOfYear ?? new Date().getFullYear();
  const age = currentYear - year;

  if (year <= 0 || age < 0) return "unknown";
  if (year < 1946) return "pre_war";
  if (year < 1980) return "vintage";
  if (year <= 1994) return "junk_wax";
  if (year <= 2005) return "early_modern";
  if (age <= 3) return "ultra_modern";
  return "modern";
}

export function isVintageLikeEra(era: CardEra): boolean {
  return era === "pre_war" || era === "vintage";
}

export function eraSeasonalSensitivity(era: CardEra): number {
  switch (era) {
    case "pre_war":
      return 0.25;
    case "vintage":
      return 0.4;
    case "junk_wax":
      return 0.7;
    case "early_modern":
      return 0.85;
    case "modern":
      return 1;
    case "ultra_modern":
      return 1.25;
    default:
      return 1;
  }
}

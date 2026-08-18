import type { CardEra } from "@/types/card-investment";

export function classifyCardEra(year: number, asOfYear?: number): CardEra {
  const currentYear = asOfYear ?? new Date().getFullYear();
  const age = currentYear - year;

  if (year <= 0 || age < 0) return "unknown";
  if (year < 1990) return "vintage";
  if (age <= 3) return "ultra_modern";
  if (year < 2010) return "modern";
  return "modern";
}

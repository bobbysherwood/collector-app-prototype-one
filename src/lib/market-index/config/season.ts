import type { SportMarketIndexConfig } from "@/types/market-index";
import type { SportSeasonPhase } from "@/types/market-index";

export function resolveSeasonPhase(
  config: SportMarketIndexConfig,
  asOf = new Date()
): SportSeasonPhase {
  const month = asOf.getMonth() + 1;
  const day = asOf.getDate();
  const md = month * 100 + day;

  const parseMd = (value?: string): number | null => {
    if (!value) return null;
    const [m, d] = value.split("-").map(Number);
    if (!m || !d) return null;
    return m * 100 + d;
  };

  const draft = parseMd(config.seasonConfig.draftDate);
  const playoffs = parseMd(config.seasonConfig.playoffsStart);
  const finals = parseMd(config.seasonConfig.finalsEnd);
  const seasonStart = parseMd(config.seasonConfig.seasonStart);
  const seasonEnd = parseMd(config.seasonConfig.seasonEnd);

  if (draft && md >= draft - 7 && md <= draft + 7) return "draft";
  if (playoffs && finals && md >= playoffs && md <= finals) return "playoffs";
  if (seasonEnd && seasonStart) {
    const inSeason =
      seasonStart > seasonEnd
        ? md >= seasonStart || md <= seasonEnd
        : md >= seasonStart && md <= seasonEnd;
    if (inSeason) return "regular";
  }

  return "offseason";
}

export function primarySentimentSearchTerm(config: SportMarketIndexConfig): string {
  return (
    config.searchTerms.sentiment?.[0] ??
    config.searchTerms.default?.[0] ??
    config.name
  );
}

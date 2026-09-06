import { resolveSportMarketIndexId } from "@/lib/market-index/resolve-sport-index-id";
import { buildPlayerId } from "@/lib/player-opportunity/classification/lifecycle";

export interface ResearchSportDefinition {
  slug: string;
  name: string;
  sportLabel: string;
  indexId: string | null;
}

export const RESEARCH_SPORTS: ResearchSportDefinition[] = [
  { slug: "nba", name: "NBA", sportLabel: "Basketball", indexId: "nba" },
  { slug: "nfl", name: "NFL", sportLabel: "Football", indexId: null },
  { slug: "mlb", name: "MLB", sportLabel: "Baseball", indexId: null },
  { slug: "nhl", name: "NHL", sportLabel: "Hockey", indexId: null },
  { slug: "soccer", name: "Soccer", sportLabel: "Soccer", indexId: null },
];

export function slugifyResearchValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleFromResearchSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveResearchSport(
  slugOrLabel: string
): ResearchSportDefinition | null {
  const normalized = slugOrLabel.trim().toLowerCase();
  const exact = RESEARCH_SPORTS.find(
    (sport) =>
      sport.slug === normalized ||
      sport.name.toLowerCase() === normalized ||
      sport.sportLabel.toLowerCase() === normalized
  );
  if (exact) return exact;

  const indexId = resolveSportMarketIndexId(slugOrLabel);
  if (indexId) {
    return RESEARCH_SPORTS.find((sport) => sport.indexId === indexId) ?? null;
  }

  if (!normalized) return null;

  return {
    slug: slugifyResearchValue(slugOrLabel),
    name: titleFromResearchSlug(slugifyResearchValue(slugOrLabel)),
    sportLabel: titleFromResearchSlug(slugifyResearchValue(slugOrLabel)),
    indexId: null,
  };
}

export function sportHref(sport: Pick<ResearchSportDefinition, "slug">): string {
  return `/market-research/markets/${sport.slug}`;
}

/** Public Wikimedia Commons photos of each sport's ball (or puck). */
const SPORT_BALL_IMAGE_URLS: Record<string, string> = {
  nba: "https://upload.wikimedia.org/wikipedia/commons/8/8e/Basketball_ball_without_shadow.png",
  basketball:
    "https://upload.wikimedia.org/wikipedia/commons/8/8e/Basketball_ball_without_shadow.png",
  nfl: "https://upload.wikimedia.org/wikipedia/commons/2/23/Wilson_American_football.jpg",
  football:
    "https://upload.wikimedia.org/wikipedia/commons/2/23/Wilson_American_football.jpg",
  mlb: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Baseball_%28crop%29.jpg",
  baseball:
    "https://upload.wikimedia.org/wikipedia/commons/1/1e/Baseball_%28crop%29.jpg",
  nhl: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Ice-hockey_puck_2.JPG",
  hockey: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Ice-hockey_puck_2.JPG",
  soccer:
    "https://upload.wikimedia.org/wikipedia/commons/1/1d/Football_Pallo_valmiina-cropped.jpg",
};

export function sportBallImageUrl(
  sport: Pick<ResearchSportDefinition, "slug" | "sportLabel">
): string | null {
  return (
    SPORT_BALL_IMAGE_URLS[sport.slug.toLowerCase()] ??
    SPORT_BALL_IMAGE_URLS[sport.sportLabel.toLowerCase()] ??
    null
  );
}

export function isResearchPlayerUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function playerHref(playerName: string, sportLabel: string): string {
  return `/market-research/players/${buildPlayerId(playerName, sportLabel)}`;
}

export function playerRecordHref(playerId: string): string {
  return `/market-research/players/${playerId}`;
}

export function cardHref(cardId: string): string {
  return `/market-research/cards/${cardId}`;
}

export function formatResearchCardName(card: {
  year: number;
  brandName: string;
  cardSetName: string;
  parallelName?: string | null;
}): string {
  const parallel = card.parallelName ? ` ${card.parallelName}` : "";
  return `${card.year} ${card.brandName} ${card.cardSetName}${parallel}`.replace(
    /\s+/g,
    " "
  ).trim();
}

const CATALOG_PLAYER_SEPARATORS = /\s*(?:\/|&|,| and )\s*/i;

/** Catalog `player` can be a combo subject, e.g. "David Robinson/Tim Duncan/Victor Wembanyama". */
export function splitCatalogPlayerNames(playerField: string): string[] {
  return playerField
    .split(CATALOG_PLAYER_SEPARATORS)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatCatalogCardLoadError(message: string): string {
  if (/timeout|canceling statement/i.test(message)) {
    return "The card catalog timed out loading this player's cards. Try again.";
  }
  return message;
}

export function catalogCardFeaturesPlayer(
  playerField: string,
  playerName: string
): boolean {
  const target = playerName.trim().toLowerCase();
  if (!target) return false;
  if (playerField.trim().toLowerCase() === target) return true;
  return splitCatalogPlayerNames(playerField).some(
    (name) => name.toLowerCase() === target
  );
}

export function parseResearchPlayerSlug(slug: string): {
  playerName: string;
  sportLabel?: string;
} {
  const idx = slug.lastIndexOf("--");
  if (idx > 0) {
    return {
      playerName: titleFromResearchSlug(slug.slice(0, idx)),
      sportLabel: titleFromResearchSlug(slug.slice(idx + 2)),
    };
  }
  return { playerName: titleFromResearchSlug(slug) };
}

import type { Asset } from "@/types/asset";
import type { PlayerLifecycleStage } from "@/types/card-investment";
import type { PlayerOpportunityLifecycle } from "@/types/player-opportunity";

const DECEASED_PLAYERS = new Set(
  ["Kobe Bryant", "Wilt Chamberlain", "Bill Russell", "Pete Maravich"].map((n) =>
    n.toLowerCase()
  )
);

const RETIRED_PLAYERS = new Set(
  [
    "Michael Jordan",
    "LeBron James",
    "Magic Johnson",
    "Larry Bird",
    "Shaquille O'Neal",
    "Tim Duncan",
    "Kevin Garnett",
    "Dirk Nowitzki",
    "Hakeem Olajuwon",
    "Kobe Bryant",
  ].map((n) => n.toLowerCase())
);

export function buildPlayerId(playerName: string, sport: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `${slug(playerName)}--${slug(sport)}`;
}

export function parsePlayerId(playerId: string): { playerName: string; sport: string } | null {
  const idx = playerId.lastIndexOf("--");
  if (idx <= 0) return null;
  const nameSlug = playerId.slice(0, idx);
  const sportSlug = playerId.slice(idx + 2);
  const playerName = nameSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const sport = sportSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { playerName, sport };
}

export function classifyPlayerOpportunityLifecycle(
  asset: Asset,
  cardLifecycle: PlayerLifecycleStage,
  asOfYear = new Date().getFullYear(),
  profile?: { careerStatus?: PlayerOpportunityLifecycle | null; birthYear?: number | null }
): PlayerOpportunityLifecycle {
  if (profile?.careerStatus) {
    return profile.careerStatus;
  }

  if (profile?.birthYear != null) {
    const age = asOfYear - profile.birthYear;
    if (age <= 21 && cardLifecycle !== "legacy") return "prospect";
  }

  const player = asset.player_name.toLowerCase();
  const cardType = asset.card_type.toLowerCase();

  if (DECEASED_PLAYERS.has(player)) {
    return "deceased";
  }

  if (RETIRED_PLAYERS.has(player) || cardLifecycle === "legacy") {
    return "retired";
  }

  if (
    cardType.includes("rookie") ||
    cardType.includes("rc") ||
    cardLifecycle === "rising"
  ) {
    const age = asOfYear - asset.year;
    if (age <= 2) return "prospect";
  }

  if (
    cardLifecycle === "rising" ||
    cardLifecycle === "peak" ||
    cardLifecycle === "declining"
  ) {
    return "active";
  }

  return "active";
}

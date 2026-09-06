import type { Asset } from "@/types/asset";
import type { PlayerLifecycleStage } from "@/types/card-investment";

const LEGACY_PLAYERS = new Set(
  [
    "Michael Jordan",
    "LeBron James",
    "Kobe Bryant",
    "Magic Johnson",
    "Larry Bird",
    "Shaquille O'Neal",
    "Tim Duncan",
    "Kevin Garnett",
    "Dirk Nowitzki",
    "Hakeem Olajuwon",
  ].map((name) => name.toLowerCase())
);

const RISING_KEYWORDS = ["wembanyama", "holmgren", "banchero", "cunningham"];

export function classifyPlayerLifecycle(
  asset: Asset,
  asOfYear = new Date().getFullYear()
): PlayerLifecycleStage {
  const player = asset.player_name.toLowerCase();
  const cardType = asset.card_type.toLowerCase();
  const age = asOfYear - asset.year;

  if (LEGACY_PLAYERS.has(player)) {
    return "legacy";
  }

  if (cardType.includes("rookie") || cardType.includes("rc")) {
    if (age <= 3) return "rising";
    if (age <= 8) return "peak";
    return "declining";
  }

  if (RISING_KEYWORDS.some((keyword) => player.includes(keyword))) {
    return "rising";
  }

  if (age >= 25) return "legacy";
  if (age >= 10) return "declining";
  if (age <= 5) return "rising";

  return "unknown";
}

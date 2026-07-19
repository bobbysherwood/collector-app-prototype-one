import type { Asset } from "@/types/asset";
import type { MarketSaleMatchConfidence } from "@/types/market-sales";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function scoreEbayListingMatchConfidence(
  asset: Asset,
  title: string
): MarketSaleMatchConfidence {
  const normalizedTitle = normalize(title);
  let score = 0;

  const player = normalize(asset.player_name);
  if (player && normalizedTitle.includes(player)) {
    score += 2;
  } else if (player) {
    const playerTokens = player.split(" ").filter((token) => token.length > 2);
    const matchedTokens = playerTokens.filter((token) =>
      normalizedTitle.includes(token)
    ).length;
    if (matchedTokens >= Math.max(1, playerTokens.length - 1)) {
      score += 1;
    }
  }

  if (normalizedTitle.includes(String(asset.year))) {
    score += 1;
  }

  const cardType = normalize(asset.card_type);
  if (cardType) {
    const cardTypeTokens = cardType.split(" ").filter((token) => token.length > 2);
    const matchedTypeTokens = cardTypeTokens.filter((token) =>
      normalizedTitle.includes(token)
    ).length;
    if (matchedTypeTokens >= Math.ceil(cardTypeTokens.length / 2)) {
      score += 1;
    }
  }

  if (asset.insert_parallel?.trim()) {
    const parallelTokens = normalize(asset.insert_parallel)
      .split(" ")
      .filter((token) => token.length > 2);
    if (
      parallelTokens.length > 0 &&
      parallelTokens.every((token) => normalizedTitle.includes(token))
    ) {
      score += 1;
    }
  }

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

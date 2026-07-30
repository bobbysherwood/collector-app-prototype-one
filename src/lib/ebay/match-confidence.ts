import type { Asset } from "@/types/asset";
import type { MarketSaleMatchConfidence } from "@/types/market-sales";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function significantTokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

function titleIncludesCardNumber(title: string, cardNumber: string): boolean {
  const normalizedTitle = normalize(title);
  const normalizedNumber = cardNumber.trim().replace(/^#+/, "");
  if (!normalizedNumber) return false;

  const compactNumber = normalize(normalizedNumber).replace(/\s+/g, "");
  if (!compactNumber) return false;

  return (
    normalizedTitle.includes(`#${compactNumber}`) ||
    normalizedTitle.includes(` ${compactNumber} `) ||
    normalizedTitle.endsWith(` ${compactNumber}`) ||
    normalizedTitle.startsWith(`${compactNumber} `) ||
    normalizedTitle.includes(`-${compactNumber}`) ||
    normalizedTitle.includes(`/${compactNumber}`)
  );
}

function scoreSetNameMatch(asset: Asset, normalizedTitle: string): number {
  const setName = asset.card_set_name?.trim();
  if (!setName) return 0;

  const tokens = significantTokens(setName);
  if (tokens.length === 0) return 0;

  const matched = tokens.filter((token) => normalizedTitle.includes(token)).length;
  if (matched === tokens.length) return 2;
  if (matched >= Math.ceil(tokens.length / 2)) return 1;
  return 0;
}

export function scoreEbayListingMatchConfidence(
  asset: Asset,
  title: string
): MarketSaleMatchConfidence {
  const normalizedTitle = normalize(title);
  let score = 0;
  let hasPlayerMatch = false;

  const player = normalize(asset.player_name);
  if (player && normalizedTitle.includes(player)) {
    score += 2;
    hasPlayerMatch = true;
  } else if (player) {
    const playerTokens = player.split(" ").filter((token) => token.length > 2);
    const matchedTokens = playerTokens.filter((token) =>
      normalizedTitle.includes(token)
    ).length;
    if (matchedTokens >= Math.max(1, playerTokens.length - 1)) {
      score += 1;
      hasPlayerMatch = true;
    }
  }

  const hasYearMatch = normalizedTitle.includes(String(asset.year));
  if (hasYearMatch) {
    score += 1;
  }

  const cardType = normalize(asset.card_type);
  let hasBrandMatch = false;
  if (cardType) {
    const cardTypeTokens = cardType.split(" ").filter((token) => token.length > 2);
    const matchedTypeTokens = cardTypeTokens.filter((token) =>
      normalizedTitle.includes(token)
    ).length;
    if (matchedTypeTokens >= Math.ceil(cardTypeTokens.length / 2)) {
      score += 1;
      hasBrandMatch = true;
    }
  }

  const setScore = scoreSetNameMatch(asset, normalizedTitle);
  score += setScore;

  let hasCardNumberMatch = false;
  if (asset.card_number?.trim()) {
    if (titleIncludesCardNumber(title, asset.card_number)) {
      score += 2;
      hasCardNumberMatch = true;
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

  const requiresSetMatch = Boolean(asset.card_set_name?.trim());
  const requiresNumberMatch = Boolean(asset.card_number?.trim());

  const meetsHighRequirements =
    hasPlayerMatch &&
    hasYearMatch &&
    hasBrandMatch &&
    (!requiresSetMatch || setScore >= 1) &&
    (!requiresNumberMatch || hasCardNumberMatch);

  if (score >= 5 && meetsHighRequirements) return "high";
  if (score >= 3 && hasPlayerMatch && hasYearMatch) return "medium";
  return "low";
}

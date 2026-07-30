import type { TextSentiment } from "@/lib/market-sentiment/internal-types";

const POSITIVE_WORDS = [
  "hot",
  "boom",
  "explod",
  "surge",
  "breakout",
  "mvp",
  "all-star",
  "invest",
  "buy",
  "bull",
  "rising",
  "climb",
  "win",
  "wins",
  "dominat",
  "stellar",
  "record",
  "return",
  "healthy",
  "extension",
  "star",
];

const NEGATIVE_WORDS = [
  "injury",
  "injured",
  "out",
  "suspended",
  "slump",
  "cold",
  "declin",
  "drop",
  "fall",
  "falling",
  "bear",
  "sell",
  "overpriced",
  "crash",
  "bust",
  "struggl",
  "loss",
  "lost",
  "trade rumors",
  "fading",
];

export function analyzeTextSentiment(text: string): TextSentiment {
  const lower = text.toLowerCase();
  let positive = 0;
  let negative = 0;

  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) positive += 1;
  }
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) negative += 1;
  }

  if (positive > negative) return "positive";
  if (negative > positive) return "negative";
  return "neutral";
}

export function playerMentioned(text: string, playerName: string): boolean {
  const haystack = text.toLowerCase();
  const parts = playerName
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length > 1);
  if (parts.length === 0) return false;
  return parts.every((part) => haystack.includes(part));
}

export function buildSearchTerms(input: {
  playerName: string;
  cardLabel?: string;
  brandName?: string;
  cardSetName?: string;
  parallelName?: string | null;
}): string[] {
  const terms = new Set<string>();
  terms.add(input.playerName.trim());
  if (input.cardLabel?.trim()) terms.add(input.cardLabel.trim());

  const cardParts = [
    input.playerName,
    input.brandName,
    input.cardSetName,
    input.parallelName,
  ]
    .filter(Boolean)
    .join(" ");
  if (cardParts.trim()) terms.add(cardParts.trim());

  return [...terms];
}

export function extractRssItems(xml: string): Array<{ title: string; pubDate: string | null; link: string | null }> {
  const items: Array<{ title: string; pubDate: string | null; link: string | null }> = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemMatches) {
    const title = block.match(/<title(?:[^>]*)>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    if (!title) continue;

    const pubDate =
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ??
      block.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1]?.trim() ??
      null;
    const link = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? null;

    items.push({ title, pubDate, link });
  }

  return items;
}

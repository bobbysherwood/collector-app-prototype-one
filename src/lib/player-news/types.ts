import type { TextSentiment } from "@/lib/market-sentiment/internal-types";

export interface PlayerNewsItem {
  id: string;
  title: string;
  url: string | null;
  source: string;
  publishedAt: string | null;
  sentiment: TextSentiment;
}

export interface PlayerNewsSnapshot {
  playerName: string;
  sportLabel: string;
  items: PlayerNewsItem[];
  sourceNotes: string[];
}

export interface PlayerNewsLookupInput {
  playerName: string;
  sportLabel: string;
  asOf?: string;
}

export type TextFetcher = (
  url: string,
  init?: RequestInit & { timeoutMs?: number }
) => Promise<string>;

import type { PlayerNewsItem, PlayerNewsSnapshot } from "@/lib/player-news/types";
import type {
  OpportunityCatalyst,
  PlayerDemandSignals,
  PlayerQualitySignals,
} from "@/types/player-opportunity";

const NEWS_WINDOW_DAYS = 14;
const RECENT_GROWTH_DAYS = 3;
const ATTENTION_FULL_COUNT = 8;
const MAX_CATALYSTS = 3;

interface CatalystRule {
  id: string;
  label: string;
  type: string;
  direction: OpportunityCatalyst["direction"];
  expectedImpact: OpportunityCatalyst["expectedImpact"];
  expectedMagnitude: number;
  windowDays: number;
  pattern: RegExp;
}

const CATALYST_RULES: CatalystRule[] = [
  {
    id: "news-injury",
    label: "Injury reported in recent headlines",
    type: "injury",
    direction: "negative",
    expectedImpact: "negative",
    expectedMagnitude: 8,
    windowDays: 30,
    pattern: /\b(acl|mcl|achilles|fracture|season-ending|sidelined|injured|injury)\b/i,
  },
  {
    id: "news-suspension",
    label: "Suspension reported in recent headlines",
    type: "discipline",
    direction: "negative",
    expectedImpact: "negative",
    expectedMagnitude: 6,
    windowDays: 21,
    pattern: /\b(suspended|suspension)\b/i,
  },
  {
    id: "news-trade",
    label: "Trade chatter in recent headlines",
    type: "roster",
    direction: "neutral",
    expectedImpact: "neutral",
    expectedMagnitude: 5,
    windowDays: 21,
    pattern: /\b(traded|trade)\b/i,
  },
  {
    id: "news-award",
    label: "Award or All-Star attention in recent headlines",
    type: "attention",
    direction: "positive",
    expectedImpact: "positive",
    expectedMagnitude: 6,
    windowDays: 21,
    pattern: /\b(mvp|all-star|all star|finals mvp)\b/i,
  },
  {
    id: "news-extension",
    label: "Contract extension in recent headlines",
    type: "contract",
    direction: "positive",
    expectedImpact: "positive",
    expectedMagnitude: 5,
    windowDays: 30,
    pattern: /\b(extension|extends|long-term deal)\b/i,
  },
  {
    id: "news-playoffs",
    label: "Playoff attention in recent headlines",
    type: "seasonality",
    direction: "positive",
    expectedImpact: "positive",
    expectedMagnitude: 4,
    windowDays: 21,
    pattern: /\b(playoffs?|play-in)\b/i,
  },
];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function publishedTime(item: PlayerNewsItem): number | null {
  if (!item.publishedAt) return null;
  const time = Date.parse(item.publishedAt);
  return Number.isFinite(time) ? time : null;
}

function itemsInWindow(
  items: PlayerNewsItem[],
  asOf: Date,
  days: number
): PlayerNewsItem[] {
  const start = asOf.getTime() - days * 24 * 60 * 60 * 1000;
  const end = asOf.getTime();
  return items.filter((item) => {
    const time = publishedTime(item);
    if (time == null) return days >= NEWS_WINDOW_DAYS;
    return time >= start && time <= end;
  });
}

function attentionScore(count: number): number {
  const capped = Math.min(count, ATTENTION_FULL_COUNT);
  return clampScore(35 + (capped / ATTENTION_FULL_COUNT) * 50);
}

function sentimentScore(items: PlayerNewsItem[]): number {
  if (items.length === 0) return 50;
  const positive = items.filter((item) => item.sentiment === "positive").length;
  const negative = items.filter((item) => item.sentiment === "negative").length;
  return clampScore(50 + ((positive - negative) / items.length) * 50);
}

function discussionGrowthScore(items: PlayerNewsItem[], asOf: Date): number | null {
  const recent = itemsInWindow(items, asOf, RECENT_GROWTH_DAYS).length;
  const priorWindow = itemsInWindow(items, asOf, NEWS_WINDOW_DAYS).length - recent;
  if (recent === 0 && priorWindow === 0) return null;
  if (priorWindow === 0) return 80;

  const recentRate = recent / RECENT_GROWTH_DAYS;
  const priorRate = priorWindow / (NEWS_WINDOW_DAYS - RECENT_GROWTH_DAYS);
  const change = (recentRate - priorRate) / Math.max(priorRate, 0.1);
  return clampScore(50 + change * 25);
}

export function emptyDemandFromNews(): PlayerDemandSignals {
  return {
    attentionScore: null,
    sentimentScore: null,
    searchInterestScore: null,
    discussionGrowthScore: null,
    sourceCount: 0,
    provenanceNotes: ["No recent player headlines available for demand scoring"],
  };
}

export function demandSignalsFromNews(
  news: PlayerNewsSnapshot | null | undefined,
  asOf = new Date()
): PlayerDemandSignals {
  const items = itemsInWindow(news?.items ?? [], asOf, NEWS_WINDOW_DAYS);
  if (items.length === 0) return emptyDemandFromNews();

  const sources = new Set(items.map((item) => item.source.trim()).filter(Boolean));
  return {
    attentionScore: attentionScore(items.length),
    sentimentScore: sentimentScore(items),
    searchInterestScore: null,
    discussionGrowthScore: discussionGrowthScore(items, asOf),
    sourceCount: sources.size,
    provenanceNotes: [
      `Demand derived from ${items.length} headline${items.length === 1 ? "" : "s"} across ${sources.size} source${sources.size === 1 ? "" : "s"} in the last ${NEWS_WINDOW_DAYS} days`,
    ],
  };
}

export function catalystsFromNews(
  news: PlayerNewsSnapshot | null | undefined,
  asOf = new Date()
): OpportunityCatalyst[] {
  const items = itemsInWindow(news?.items ?? [], asOf, NEWS_WINDOW_DAYS);
  const catalysts: OpportunityCatalyst[] = [];

  for (const rule of CATALYST_RULES) {
    const hit = items.find((item) => rule.pattern.test(item.title));
    if (!hit) continue;
    catalysts.push({
      id: rule.id,
      label: rule.label,
      type: rule.type,
      direction: rule.direction,
      expectedImpact: rule.expectedImpact,
      expectedMagnitude: rule.expectedMagnitude,
      expectedDurationDays: rule.windowDays,
      windowDays: rule.windowDays,
      confidence: items.length >= 2 ? "medium" : "low",
    });
    if (catalysts.length >= MAX_CATALYSTS) break;
  }

  return catalysts;
}

export function applyNewsInjuryToQuality(
  quality: PlayerQualitySignals | undefined,
  catalysts: OpportunityCatalyst[]
): PlayerQualitySignals | undefined {
  if (!quality || !catalysts.some((catalyst) => catalyst.id === "news-injury")) {
    return quality;
  }
  return {
    ...quality,
    injuryRisk: Math.max(quality.injuryRisk ?? 0, 65),
    provenanceNotes: [
      ...(quality.provenanceNotes ?? []),
      "Injury risk raised from recent headlines",
    ],
  };
}

export function newsCanScore(news: PlayerNewsSnapshot | null | undefined): boolean {
  return demandSignalsFromNews(news).sourceCount > 0;
}

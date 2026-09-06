"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlayerResearchPageData } from "@/lib/market-research/load-pages";
import { scoreLabel } from "@/lib/market-research/signals";
import type { ResearchChartRange } from "@/lib/market-research/series";
import { PlayerComparablesPanel } from "@/components/market-research/player-comparables-panel";
import { PlayerMarketTrendsPanel } from "@/components/market-research/player-market-trends-panel";
import {
  ResearchBreadcrumbs,
  ResearchCardList,
  ResearchEmptyState,
  ResearchHeaderActions,
  ResearchLineChart,
  ResearchPanel,
  ResearchRadar,
  ResearchRangeToggle,
  ResearchScoreGauge,
  ResearchScoreRow,
  ResearchThesis,
} from "@/components/market-research/research-shared";
import { playerHref, playerRecordHref } from "@/lib/market-research/catalog";
import {
  formatDraftLine,
  formatPct,
  formatStat,
} from "@/lib/player-stats/derive";
import type { PlayerSeasonLine } from "@/lib/player-stats/types";
import type { PlayerNewsItem } from "@/lib/player-news/types";

const PLAYER_TABS = [
  "overview",
  "statistics",
  "market-trends",
  "cards",
  "comparables",
  "news",
] as const;

export function PlayerResearchView({ data }: { data: PlayerResearchPageData }) {
  const [range, setRange] = useState<ResearchChartRange>("1Y");
  const score = data.playerOpportunity?.opportunityScore;

  const keyMetrics = data.playerOpportunity
    ? [
        { label: "On-Court Performance", score: data.playerOpportunity.qualityScore },
        { label: "Career Trajectory", score: data.playerOpportunity.futureOutlookScore },
        { label: "Market Demand", score: data.playerOpportunity.demandScore },
        { label: "Brand & Popularity", score: data.playerOpportunity.sportMarketScore },
        { label: "Injury Risk", score: Math.round(100 - data.playerOpportunity.riskScore) },
        { label: "Competition Level", score: data.playerOpportunity.momentumScore },
      ]
    : [];

  const radar = data.playerOpportunity
    ? [
        { label: "Performance", score: data.playerOpportunity.qualityScore },
        { label: "Market Demand", score: data.playerOpportunity.demandScore },
        { label: "Longevity", score: data.playerOpportunity.futureOutlookScore },
        { label: "Upside", score: data.playerOpportunity.momentumScore },
        { label: "Durability", score: Math.round(100 - data.playerOpportunity.riskScore) },
        { label: "Risk", score: data.playerOpportunity.riskScore },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <ResearchBreadcrumbs
            items={[
              { label: "Market Research", href: "/market-research" },
              { label: "Players", href: "/market-research" },
              { label: data.playerName },
            ]}
          />
          <div className="flex gap-4">
            <div className="relative size-24 overflow-hidden rounded-2xl bg-muted">
              {data.imageUrl ? (
                <Image
                  src={data.imageUrl}
                  alt={data.playerName}
                  fill
                  className="object-cover object-top"
                  sizes="96px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                  {data.playerName.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{data.playerName}</h1>
              <p className="text-sm text-muted-foreground">
                <Link
                  href={`/market-research/markets/${data.sportSlug}`}
                  className="hover:text-foreground"
                >
                  {data.sportLabel}
                </Link>
                {` · ${data.cardCount.toLocaleString()} catalog cards`}
              </p>
              <PlayerBioLine data={data} />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
          <ResearchHeaderActions
            kind="player"
            id={data.playerId ?? `${data.playerName}--${data.sportLabel}`}
            label={data.playerName}
            href={
              data.playerId
                ? playerRecordHref(data.playerId)
                : playerHref(data.playerName, data.sportLabel)
            }
          />
          <div className="min-w-[240px] rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Player Opportunity Score
            </div>
            <div className="mt-2 flex items-center gap-3">
              <ResearchScoreGauge score={score ?? 0} />
              <div>
                <div className="text-3xl font-semibold tabular-nums">
                  {score != null ? `${score} / 100` : "—"}
                </div>
                <div className={score != null ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                  {score != null ? `${scoreLabel(score)} Opportunity` : "Not scored"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {PLAYER_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab.replace("-", " ")}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <ResearchPanel
              title="Player Opportunity Trend"
              action={<ResearchRangeToggle value={range} onChange={setRange} />}
              className="xl:col-span-1"
            >
              {data.opportunitySeries.length > 0 && score != null ? (
                <ResearchLineChart
                  points={data.opportunitySeries}
                  range={range}
                  color="#059669"
                  currentValue={score}
                  yDomain={[0, 100]}
                />
              ) : (
                <ResearchEmptyState>
                  Opportunity trend will populate as player snapshots accumulate.
                </ResearchEmptyState>
              )}
            </ResearchPanel>
            <ResearchPanel title="Key Metrics">
              {keyMetrics.length > 0 ? (
                keyMetrics.map((metric) => (
                  <ResearchScoreRow
                    key={metric.label}
                    label={metric.label}
                    score={metric.score}
                  />
                ))
              ) : (
                <ResearchEmptyState>
                  Player Opportunity inputs are not available yet.
                </ResearchEmptyState>
              )}
            </ResearchPanel>
            <ResearchPanel title="AI Model Summary">
              <ResearchRadar dimensions={radar} />
            </ResearchPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <ResearchPanel title="Career Stats (Per Game)">
              <PlayerStatsTable
                seasons={overviewSeasons(data.liveStats?.seasons ?? [], data.liveStats?.career ?? null)}
                empty="Season statistics are unavailable. Basketball V1 uses NBA Stats when the player can be resolved."
              />
            </ResearchPanel>
            <ResearchPanel title="Investment Thesis">
              {data.thesis ? (
                <ResearchThesis
                  text={data.thesis}
                  href="#ai-analysis"
                  hrefLabel="View Full Analysis →"
                />
              ) : (
                <ResearchEmptyState>
                  Thesis is generated from the Player Opportunity model once live
                  stats or a catalog card can be scored.
                </ResearchEmptyState>
              )}
            </ResearchPanel>
            <ResearchPanel title="Top Card Opportunities">
              <ResearchCardList
                cards={data.topCards}
                empty={data.cardsError}
              />
            </ResearchPanel>
          </div>
        </TabsContent>

        <TabsContent value="statistics" className="mt-4">
          <ResearchPanel title="Statistics">
            <PlayerStatsTable
              seasons={fullSeasonTable(data.liveStats?.seasons ?? [], data.liveStats?.career ?? null)}
              empty="Player statistics by season are not connected for this sport yet. Basketball V1 uses NBA Stats per-game lines."
            />
            {data.liveStats?.sourceNotes.length ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {data.liveStats.sourceNotes.join(" · ")}
              </p>
            ) : null}
          </ResearchPanel>
        </TabsContent>
        <TabsContent value="market-trends" className="mt-4 space-y-4">
          <PlayerMarketTrendsPanel data={data} range={range} onRangeChange={setRange} />
        </TabsContent>
        <TabsContent value="cards" className="mt-4">
          <ResearchPanel
            title={`Cards${data.cardCount ? ` (${data.cardCount.toLocaleString()})` : ""}`}
          >
            <ResearchCardList
              cards={data.catalogCards}
              empty={
                data.cardsError ??
                "No catalog cards are linked to this player yet."
              }
            />
            {data.catalogCards.length > 0 && data.cardsError ? (
              <p className="mt-3 text-xs text-muted-foreground">{data.cardsError}</p>
            ) : null}
            {data.catalogCards.length > 0 &&
            data.catalogCards.length < data.cardCount ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing {data.catalogCards.length.toLocaleString()} of{" "}
                {data.cardCount.toLocaleString()} linked cards.
              </p>
            ) : null}
          </ResearchPanel>
        </TabsContent>
        <TabsContent value="comparables" className="mt-4">
          <PlayerComparablesPanel comparables={data.comparables ?? []} />
        </TabsContent>
        <TabsContent value="news" className="mt-4">
          <ResearchPanel title="News">
            <PlayerNewsList
              items={data.news.items}
              notes={data.news.sourceNotes}
            />
          </ResearchPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlayerBioLine({ data }: { data: PlayerResearchPageData }) {
  const bio = data.liveStats?.bio;
  const parts = [
    bio?.team,
    bio?.age != null ? `Age ${bio.age}` : null,
    bio ? formatDraftLine(bio) : null,
    bio?.college,
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return <p className="mt-2 text-xs text-muted-foreground">{parts.join(" · ")}</p>;
  }

  if (data.liveStats && data.sportLabel.toLowerCase() === "basketball") {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Team, age, draft, and college were not returned from Wikidata or NBA Stats.
      </p>
    );
  }

  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Team, age, draft, and college are connected for Basketball in V1.
    </p>
  );
}

function overviewSeasons(
  seasons: PlayerSeasonLine[],
  career: PlayerSeasonLine | null
): PlayerSeasonLine[] {
  const recent = seasons.slice(-5);
  return career ? [...recent, career] : recent;
}

function fullSeasonTable(
  seasons: PlayerSeasonLine[],
  career: PlayerSeasonLine | null
): PlayerSeasonLine[] {
  return career ? [...seasons, career] : seasons;
}

function PlayerStatsTable({
  seasons,
  empty,
}: {
  seasons: PlayerSeasonLine[];
  empty: string;
}) {
  if (seasons.length === 0) {
    return <ResearchEmptyState>{empty}</ResearchEmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="pb-2 font-medium">Season</th>
            <th className="pb-2 font-medium">Team</th>
            <th className="pb-2 font-medium">GP</th>
            <th className="pb-2 font-medium">MPG</th>
            <th className="pb-2 font-medium">PPG</th>
            <th className="pb-2 font-medium">RPG</th>
            <th className="pb-2 font-medium">APG</th>
            <th className="pb-2 font-medium">SPG</th>
            <th className="pb-2 font-medium">BPG</th>
            <th className="pb-2 font-medium">FG%</th>
            <th className="pb-2 font-medium">3P%</th>
            <th className="pb-2 font-medium">FT%</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((line, index) => (
            <tr
              key={`${line.season}-${line.team ?? "na"}-${index}`}
              className="border-t border-border/60"
            >
              <td className="py-2 font-medium">{line.season}</td>
              <td className="py-2 text-muted-foreground">{line.team ?? "—"}</td>
              <td className="py-2 tabular-nums">{formatStat(line.games, 0)}</td>
              <td className="py-2 tabular-nums">{formatStat(line.minutes)}</td>
              <td className="py-2 tabular-nums">{formatStat(line.points)}</td>
              <td className="py-2 tabular-nums">{formatStat(line.rebounds)}</td>
              <td className="py-2 tabular-nums">{formatStat(line.assists)}</td>
              <td className="py-2 tabular-nums">{formatStat(line.steals)}</td>
              <td className="py-2 tabular-nums">{formatStat(line.blocks)}</td>
              <td className="py-2 tabular-nums">{formatPct(line.fgPct)}</td>
              <td className="py-2 tabular-nums">{formatPct(line.threePct)}</td>
              <td className="py-2 tabular-nums">{formatPct(line.ftPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerNewsList({
  items,
  notes,
}: {
  items: PlayerNewsItem[];
  notes: string[];
}) {
  if (items.length === 0) {
    return (
      <>
        <ResearchEmptyState>
          No recent headlines matched this player.
        </ResearchEmptyState>
        {notes.length > 0 ? (
          <p className="text-xs text-muted-foreground">{notes.join(" · ")}</p>
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-1">
      <ol className="divide-y divide-border/60">
        {items.map((item) => (
          <li key={item.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {item.source}
                {" · "}
                {formatNewsAge(item.publishedAt)}
              </p>
              <NewsSentimentChip sentiment={item.sentiment} />
            </div>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-sm font-medium leading-snug hover:text-primary"
              >
                {item.title}
              </a>
            ) : (
              <p className="mt-1 text-sm font-medium leading-snug">{item.title}</p>
            )}
          </li>
        ))}
      </ol>
      <p className="pt-3 text-xs text-muted-foreground">
        {notes.join(" · ") ||
          "Headlines from Google News and league RSS. Not stored."}
      </p>
    </div>
  );
}

function NewsSentimentChip({
  sentiment,
}: {
  sentiment: PlayerNewsItem["sentiment"];
}) {
  const label =
    sentiment === "positive"
      ? "Positive"
      : sentiment === "negative"
        ? "Negative"
        : "Neutral";
  const className =
    sentiment === "positive"
      ? "bg-emerald-50 text-emerald-700"
      : sentiment === "negative"
        ? "bg-rose-50 text-rose-700"
        : "bg-muted text-muted-foreground";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}

function formatNewsAge(iso: string | null, now = new Date()): string {
  if (!iso) return "Date unknown";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "Date unknown";
  const minutes = Math.round((now.getTime() - then) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

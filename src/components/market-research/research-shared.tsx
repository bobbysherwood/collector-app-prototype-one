"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  Share2,
  Sparkles,
  Star,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  isOnResearchWatchlist,
  subscribeResearchWatchlist,
  toggleResearchWatchlist,
  type ResearchWatchlistKind,
} from "@/lib/market-research/watchlist";
import {
  RESEARCH_CHART_RANGES,
  filterSeriesByRange,
  type ResearchChartRange,
  type ResearchSeriesPoint,
} from "@/lib/market-research/series";
import {
  scoreLabel,
  scoreTone,
  toneBgClass,
  toneClass,
  type ResearchSignalTone,
} from "@/lib/market-research/signals";
import { cn } from "@/lib/utils";
import type { ResearchCardPreview, ResearchPlayerPreview } from "@/lib/market-research/load-pages";
import { formatCurrency } from "@/types/card";

function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function ResearchBreadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 ? <span>/</span> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function ResearchHeaderActions({
  kind,
  id,
  label,
  href,
}: {
  kind: ResearchWatchlistKind;
  id: string;
  label: string;
  href: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(isOnResearchWatchlist(kind, id));
    sync();
    return subscribeResearchWatchlist(sync);
  }, [kind, id]);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => toggleResearchWatchlist({ kind, id, label, href })}
      >
        <Star className={cn("h-4 w-4", saved && "fill-amber-400 text-amber-500")} />
        {saved ? "Watching" : "Add to Watchlist"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Copy link"
        onClick={async () => {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function ResearchPanel({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("bg-white", className)}>
      {title ? (
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          {action}
        </CardHeader>
      ) : null}
      <CardContent className={title ? undefined : "pt-0"}>{children}</CardContent>
    </Card>
  );
}

export function ResearchMetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: ResearchSignalTone;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClass(tone))}>
        {value}
      </div>
      {detail ? (
        <div className={cn("mt-0.5 text-xs", toneClass(tone))}>{detail}</div>
      ) : null}
    </div>
  );
}

export function ResearchScoreGauge({
  score,
  size = 84,
}: {
  score: number;
  size?: number;
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const tone = scoreTone(score);

  return (
    <svg width={size} height={size} viewBox="0 0 88 88" className="shrink-0">
      <circle
        cx="44"
        cy="44"
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-muted/40"
        strokeWidth="8"
      />
      <circle
        cx="44"
        cy="44"
        r={radius}
        fill="none"
        stroke="currentColor"
        className={toneClass(tone)}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        transform="rotate(-90 44 44)"
      />
    </svg>
  );
}

export function ResearchRecommendation({
  label,
  qualifier,
  tone,
}: {
  label: string;
  qualifier?: string;
  tone: ResearchSignalTone;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Recommendation
      </div>
      <div className={cn("mt-1 text-2xl font-semibold", toneClass(tone))}>{label}</div>
      {qualifier ? (
        <div className={cn("text-xs", toneClass(tone))}>{qualifier}</div>
      ) : null}
    </div>
  );
}

export function ResearchRangeToggle({
  value,
  onChange,
}: {
  value: ResearchChartRange;
  onChange: (range: ResearchChartRange) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {RESEARCH_CHART_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium",
            value === range
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

export function ResearchLineChart({
  points,
  range,
  color = "#2563eb",
  valueSuffix = "",
  currentValue,
  yDomain,
}: {
  points: ResearchSeriesPoint[];
  range: ResearchChartRange;
  color?: string;
  valueSuffix?: string;
  currentValue?: number;
  yDomain?: [number, number];
}) {
  const mounted = useHasMounted();
  const data = useMemo(() => filterSeriesByRange(points, range), [points, range]);
  const historyIndexes = data
    .map((point, index) => (point.kind === "history" ? index : -1))
    .filter((index) => index >= 0);
  const lastHistoryIndex = historyIndexes[historyIndexes.length - 1];
  const hasForecast = data.some((point) => point.kind === "forecast");
  const withForecast = data.map((point, index) => ({
    ...point,
    historyValue: point.kind === "history" ? point.value : null,
    forecastValue:
      point.kind === "forecast" ||
      (hasForecast && index === lastHistoryIndex)
        ? point.value
        : null,
  }));

  if (!mounted || data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {data.length === 0
          ? "No series available for this range yet."
          : "Loading chart…"}
      </p>
    );
  }

  return (
    <div className="relative h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={withForecast} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={40} domain={yDomain} />
          <Tooltip
            formatter={(value) =>
              typeof value === "number" ? `${value}${valueSuffix}` : value
            }
          />
          <Line
            type="monotone"
            dataKey="historyValue"
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="forecastValue"
            stroke={color}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      {currentValue != null && historyIndexes.length > 0 ? (
        <div className="pointer-events-none absolute right-4 top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
          {currentValue}
        </div>
      ) : null}
    </div>
  );
}

export function ResearchForecastChart({
  points,
}: {
  points: ResearchSeriesPoint[];
}) {
  const mounted = useHasMounted();
  if (!mounted || points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Forecast unavailable until a Sport Market Index snapshot exists.
      </p>
    );
  }

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={36} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#059669"
            fill="#05966922"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResearchDriverBar({
  label,
  score,
  signal,
  explanation,
}: {
  label: string;
  score: number;
  signal: string;
  explanation?: string;
}) {
  const tone = scoreTone(score);
  return (
    <div className="space-y-2" title={explanation}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums">{score}</div>
          <div className={cn("text-xs", toneClass(tone))}>{signal}</div>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", toneBgClass(tone))}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

export function ResearchThesis({
  text,
  href,
  hrefLabel = "View Full Analysis →",
}: {
  text: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
      {href ? (
        <Link href={href} className="text-sm font-medium text-primary hover:underline">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function ResearchEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-sm text-muted-foreground">{children}</p>
  );
}

export function ResearchPlayerList({
  players,
}: {
  players: ResearchPlayerPreview[];
}) {
  if (players.length === 0) {
    return (
      <ResearchEmptyState>
        No ranked players yet. Search results need catalog cards the models can score.
      </ResearchEmptyState>
    );
  }

  return (
    <ol className="space-y-3">
      {players.map((player, index) => (
        <li key={player.href}>
          <Link
            href={player.href}
            className="flex items-center gap-3 rounded-xl p-1 hover:bg-muted/50"
          >
            <span className="w-5 text-sm font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <span className="relative size-8 overflow-hidden rounded-full bg-muted">
              {player.imageUrl ? (
                <Image
                  src={player.imageUrl}
                  alt={player.playerName}
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-xs font-semibold">
                  {player.playerName.charAt(0)}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {player.playerName}
              </span>
              <span className="text-xs text-muted-foreground">
                Opportunity {player.opportunityScore}
              </span>
            </span>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                toneClass(player.change90d >= 0 ? "positive" : "negative")
              )}
            >
              {player.change90d > 0 ? "+" : ""}
              {player.change90d.toFixed(1)}%
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function ResearchCardList({
  cards,
  empty = "No scored card opportunities in this catalog slice yet.",
}: {
  cards: ResearchCardPreview[];
  empty?: string;
}) {
  if (cards.length === 0) {
    return <ResearchEmptyState>{empty}</ResearchEmptyState>;
  }

  return (
    <ol className="space-y-3">
      {cards.map((card, index) => (
        <li key={card.id}>
          <Link
            href={card.href}
            className="flex items-center gap-3 rounded-xl p-1 hover:bg-muted/50"
          >
            <span className="w-5 text-sm font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <span className="relative size-10 overflow-hidden rounded-md bg-muted">
              {card.imageUrl ? (
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  className="object-contain p-0.5"
                  sizes="40px"
                />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{card.name}</span>
              <span className="text-xs text-muted-foreground">{card.player}</span>
            </span>
            {card.estimatedValue != null ? (
              <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                {formatCurrency(card.estimatedValue)}
              </span>
            ) : null}
            {card.opportunityScore != null ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {card.opportunityScore}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function ResearchRadar({
  dimensions,
}: {
  dimensions: Array<{ label: string; score: number }>;
}) {
  const mounted = useHasMounted();
  if (!mounted || dimensions.length === 0) {
    return (
      <ResearchEmptyState>
        Model dimensions are not available for this player yet.
      </ResearchEmptyState>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={dimensions}>
          <PolarGrid />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
          <Radar
            dataKey="score"
            stroke="#059669"
            fill="#059669"
            fillOpacity={0.25}
          />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResearchScoreRow({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const tone = scoreTone(score);
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm">{label}</span>
      <span
        className={cn(
          "rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
          tone === "positive" && "bg-emerald-50 text-emerald-700",
          tone === "caution" && "bg-amber-50 text-amber-700",
          tone === "negative" && "bg-red-50 text-red-700",
          tone === "neutral" && "bg-muted text-muted-foreground"
        )}
      >
        {score}
      </span>
    </div>
  );
}

export function ResearchUnavailableNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export { scoreLabel };

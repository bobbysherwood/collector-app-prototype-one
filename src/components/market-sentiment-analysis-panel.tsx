"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import {
  analyzeMarketSentiment,
  getMarketSentimentAnalysis,
} from "@/app/actions/market-sentiment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MarketSentimentAnalysisResult } from "@/types/market-sentiment";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";
import { formatDm2CardResearchTitle } from "@/components/dm2-card-search-input";
import { cn } from "@/lib/utils";

function trendBadgeClass(trend: MarketSentimentAnalysisResult["trend"]): string {
  switch (trend) {
    case "strongly_increasing":
    case "increasing":
      return "text-primary";
    case "declining":
    case "strongly_declining":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function buildAnalysisInput(card: Dm2CardSearchResult) {
  return {
    playerName: card.player,
    cardLabel: formatDm2CardResearchTitle(card),
    sport: card.sportName,
    year: card.year,
    brandName: card.brandName,
    cardSetName: card.cardSetName,
    parallelName: card.parallelName,
  };
}

export function MarketSentimentAnalysisPanel({ card }: { card: Dm2CardSearchResult }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketSentimentAnalysisResult | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const analysisInput = buildAnalysisInput(card);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    getMarketSentimentAnalysis(card.id, analysisInput).then((response) => {
      if (cancelled) return;
      if (response.error) {
        setError(response.error);
        setResult(null);
      } else if (response.result) {
        setResult(response.result);
        setFromCache(response.fromCache ?? false);
        setCachedAt(response.cachedAt ?? response.result.asOf);
      } else {
        setResult(null);
        setFromCache(false);
        setCachedAt(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [card.id]);

  async function runAnalysis(refresh: boolean) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const response = await analyzeMarketSentiment(card.id, analysisInput, {
      refresh,
    });

    if (refresh) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }

    if (response.error) {
      setError(response.error);
      if (refresh) return;
      setResult(null);
      return;
    }

    setResult(response.result ?? null);
    setFromCache(response.fromCache ?? false);
    setCachedAt(response.cachedAt ?? response.result?.asOf ?? null);
  }

  const buttonLabel = result ? "Refresh sentiment analysis" : "Run sentiment analysis";
  const buttonBusy = loading || refreshing;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Market Sentiment Model (V1)
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Analyze collector demand and hype using public news, Reddit, YouTube,
            social, and search interest signals. Results are cached for 24 hours.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 shrink-0"
          disabled={buttonBusy}
          onClick={() => void runAnalysis(true)}
        >
          {buttonBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {buttonLabel}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sentiment analysis…
          </div>
        ) : null}

        {!loading && !result && !error ? (
          <p className="text-sm text-muted-foreground">
            Run analysis to generate a demand & sentiment score for this card.
          </p>
        ) : null}

        {result && !loading ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {fromCache ? (
                <Badge variant="secondary" className="text-xs">
                  Cached
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Refreshed
                </Badge>
              )}
              {cachedAt ? (
                <span className="text-xs text-muted-foreground">
                  As of {new Date(cachedAt).toLocaleString()} · valid for 24 hours
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label="Demand & Sentiment"
                value={`${result.demandSentimentScore}/100`}
              />
              <MetricTile
                label="Trend"
                value={result.trendLabel}
                valueClassName={trendBadgeClass(result.trend)}
              />
              <MetricTile
                label="Confidence"
                value={`${result.confidenceScore}/100`}
              />
            </div>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-border/80 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-medium">Analysis details</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                  <p className="text-sm">{result.summary}</p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <DriverList title="Top positive drivers" items={result.positiveDrivers} />
                  <DriverList
                    title="Top negative drivers"
                    items={result.negativeDrivers}
                    tone="negative"
                  />
                </div>
              </div>
            </details>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-background px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

function DriverList({
  title,
  items,
  tone = "positive",
}: {
  title: string;
  items: string[];
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border border-border/80 p-4">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None detected.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm">
              <Badge
                variant={tone === "negative" ? "outline" : "secondary"}
                className="mt-0.5 shrink-0 text-[10px]"
              >
                {tone === "negative" ? "Risk" : "Driver"}
              </Badge>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

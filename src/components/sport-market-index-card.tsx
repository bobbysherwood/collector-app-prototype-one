"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { getSportMarketIndex } from "@/app/actions/market-index";
import { Badge } from "@/components/ui/badge";
import type { SportMarketIndexResult, SportMarketIndexRiskRating } from "@/types/market-index";

function riskVariant(
  risk: SportMarketIndexRiskRating
): "default" | "secondary" | "destructive" {
  switch (risk) {
    case "low":
      return "default";
    case "medium":
      return "secondary";
    case "high":
      return "destructive";
  }
}

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value}%`;
}

function ScoreBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "muted";
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          accent === "primary" ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function SportMarketIndexCard({
  sportIndexId,
  sportLabel,
}: {
  sportIndexId: string;
  sportLabel: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SportMarketIndexResult | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getSportMarketIndex(sportIndexId).then((response) => {
      if (cancelled) return;
      setLoading(false);
      if (response.error) {
        setError(response.error);
        setResult(null);
        return;
      }
      setResult(response.result ?? null);
      setFromCache(Boolean(response.fromCache));
    });

    return () => {
      cancelled = true;
    };
  }, [sportIndexId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card px-4 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Sport Market Index…
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
        <div className="font-medium text-foreground">Sport Market Index</div>
        <p className="mt-2">
          {error ??
            "No index has been computed for this sport yet. An admin can refresh it from AI Indexes."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border/80 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Sport Market Index</h2>
              <Badge variant="outline" className="text-xs">
                {result.sportName || sportLabel}
              </Badge>
              {fromCache ? (
                <Badge variant="secondary" className="text-xs">
                  Cached
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Market health, momentum, and forward outlook for the {sportLabel}{" "}
              collectibles market
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={riskVariant(result.riskRating)}>
              {result.riskRating} risk
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              {result.confidenceScore}% confidence
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          As of {new Date(result.asOf).toLocaleString()} · {result.modelVersion}
        </p>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        <ScoreBlock label="Current Health" value={result.healthScore} />
        <ScoreBlock label="Momentum" value={result.momentumScore} accent="primary" />
        <ScoreBlock label="Forward Outlook" value={result.outlookScore} />
      </div>

      <div className="grid gap-3 border-t border-border/80 px-5 py-4 sm:grid-cols-3">
        <div className="rounded-xl bg-muted/30 px-4 py-3">
          <div className="text-xs text-muted-foreground">3-month forecast</div>
          <div className="mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums">
            {result.forecast3mPct >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            {formatPct(result.forecast3mPct)}
          </div>
        </div>
        <div className="rounded-xl bg-muted/30 px-4 py-3">
          <div className="text-xs text-muted-foreground">6-month forecast</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {formatPct(result.forecast6mPct)}
          </div>
        </div>
        <div className="rounded-xl bg-muted/30 px-4 py-3">
          <div className="text-xs text-muted-foreground">12-month forecast</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">
            {formatPct(result.forecast12mPct)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-border/80 px-5 py-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Top drivers</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {result.positiveDrivers.length > 0 ? (
              result.positiveDrivers.map((driver) => (
                <li key={driver.featureKey}>
                  {driver.label}
                  {driver.deltaPct != null
                    ? ` (${driver.deltaPct > 0 ? "+" : ""}${Math.round(driver.deltaPct)}%)`
                    : ""}
                </li>
              ))
            ) : (
              <li>No strong positive drivers identified.</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium">Headwinds</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {result.negativeDrivers.length > 0 ? (
              result.negativeDrivers.map((driver) => (
                <li key={driver.featureKey}>
                  {driver.label}
                  {driver.deltaPct != null
                    ? ` (${driver.deltaPct > 0 ? "+" : ""}${Math.round(driver.deltaPct)}%)`
                    : ""}
                </li>
              ))
            ) : (
              <li>No major headwinds identified.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-border/80 bg-muted/15 px-5 py-4">
        <h3 className="text-sm font-medium">Outlook summary</h3>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted-foreground">
          {result.explanation}
        </pre>
      </div>
    </div>
  );
}

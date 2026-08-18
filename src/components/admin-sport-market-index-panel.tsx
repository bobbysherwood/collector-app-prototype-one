"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, RefreshCw } from "lucide-react";
import { refreshSportMarketIndex } from "@/app/actions/market-index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SportMarketIndexAdminMeta } from "@/app/actions/market-index";
import type { SportMarketIndexRiskRating } from "@/types/market-index";

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

export function AdminSportMarketIndexPanel({
  meta,
}: {
  meta: SportMarketIndexAdminMeta;
}) {
  const router = useRouter();
  const [pendingSportId, setPendingSportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh(sportId: string) {
    setPendingSportId(sportId);
    setError(null);
    const result = await refreshSportMarketIndex(sportId);
    setPendingSportId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border/80 bg-background px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-sm font-medium">Sport Market Index</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Sport-level market health, momentum, and forward outlook. V1: NBA
              Basketball. Weights load from the database — no hardcoded scoring.
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-4 bg-background px-4 py-3">
          {meta.usingDefaults ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Database migration required.
              </span>{" "}
              Run{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                supabase/migrations/045_sport_market_index.sql
              </code>{" "}
              to persist configs, features, snapshots, and cache. Using
              built-in NBA defaults until then.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sport</TableHead>
                  <TableHead className="w-[88px]">Health</TableHead>
                  <TableHead className="w-[88px]">Momentum</TableHead>
                  <TableHead className="w-[88px]">Outlook</TableHead>
                  <TableHead className="w-[88px]">3M</TableHead>
                  <TableHead className="w-[88px]">Confidence</TableHead>
                  <TableHead className="w-[88px]">Risk</TableHead>
                  <TableHead className="min-w-[160px]">Providers</TableHead>
                  <TableHead className="w-[120px]">As of</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {meta.configs.map((config) => {
                  const latest = meta.latestBySportId[config.id];
                  const isPending = pendingSportId === config.id;

                  return (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div className="font-medium">{config.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {config.id}
                          {!config.active ? " · inactive" : ""}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {latest?.result.healthScore ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {latest?.result.momentumScore ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {latest?.result.outlookScore ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {latest
                          ? formatPct(latest.result.forecast3mPct)
                          : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {latest ? `${latest.result.confidenceScore}%` : "—"}
                      </TableCell>
                      <TableCell>
                        {latest ? (
                          <Badge variant={riskVariant(latest.result.riskRating)}>
                            {latest.result.riskRating}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(config.providerConfig?.enabledProviders ?? []).join(
                          ", "
                        ) || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {latest
                          ? new Date(latest.computedAt).toLocaleString()
                          : "Not computed"}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!config.active || isPending}
                          onClick={() => handleRefresh(config.id)}
                        >
                          <RefreshCw
                            className={`mr-1.5 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
                          />
                          Refresh
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {meta.configs.map((config) => {
            const latest = meta.latestBySportId[config.id];
            if (!latest) return null;

            return (
              <div
                key={`${config.id}-detail`}
                className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
              >
                <div className="mb-2 font-medium">{config.name} — latest explanation</div>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {latest.result.explanation}
                </pre>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}

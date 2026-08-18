"use client";

import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CardInvestmentAdminMeta } from "@/app/actions/ai-models-admin";
import {
  AI_PREDICTION_MODEL_LAYERS,
  modelsByLayer,
} from "@/types/ai-prediction-models";

function formatPctWeight(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function AdminCardInvestmentPanel({
  meta,
}: {
  meta: CardInvestmentAdminMeta;
}) {
  const models = [
    ...modelsByLayer("card-investment"),
    ...modelsByLayer("portfolio"),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border/80 bg-background px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-sm font-medium">Card Investment AI</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {AI_PREDICTION_MODEL_LAYERS["card-investment"].description} V1:
              deterministic weighted scoring with explainable outputs.
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-4 bg-background px-4 py-3">
          {meta.stats.usingDefaults ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Database migration required.
              </span>{" "}
              Run{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                supabase/migrations/047_card_investment_snapshots.sql
              </code>{" "}
              to persist profile snapshots and prediction history for backtesting.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Version {meta.modelVersion}</Badge>
            <Badge variant="outline">
              {meta.stats.snapshotCount} profile snapshot
              {meta.stats.snapshotCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              {meta.stats.predictionCount} prediction record
              {meta.stats.predictionCount === 1 ? "" : "s"}
            </Badge>
            {meta.stats.latestComputedAt ? (
              <span className="text-xs text-muted-foreground">
                Latest: {new Date(meta.stats.latestComputedAt).toLocaleString()}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No snapshots yet</span>
            )}
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">API:</span>{" "}
            <code>{meta.apiRoute}</code>
            <span className="mx-2">·</span>
            <span className="font-medium text-foreground">Orchestrator:</span>{" "}
            valuation → legacy → scarcity → demand → risk → seasonality → forecast
            → recommendation → explainability → portfolio
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">#</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="min-w-[200px]">Wired to</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {model.sortOrder}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {model.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {model.wiredTo ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium">Weight profiles (code config)</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Valuation blend</TableHead>
                    <TableHead>Forecast weights</TableHead>
                    <TableHead>Recommendation weights</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meta.weightProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="font-medium">{profile.label}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {profile.id}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        7d {formatPctWeight(profile.valuation.recency7d)} · 30d{" "}
                        {formatPctWeight(profile.valuation.recency30d)} · 90d{" "}
                        {formatPctWeight(profile.valuation.recency90d)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        trend {formatPctWeight(profile.forecast.valuationTrend)} · demand{" "}
                        {formatPctWeight(profile.forecast.demand)} · sport{" "}
                        {formatPctWeight(profile.forecast.sportForecast)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        val {formatPctWeight(profile.recommendation.valuation)} · legacy{" "}
                        {formatPctWeight(profile.recommendation.playerLegacy)} · forecast{" "}
                        {formatPctWeight(profile.recommendation.forecast)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

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
import { AdminMarketSentimentSourcesPanel } from "@/components/admin-market-sentiment-sources-panel";
import {
  AI_PREDICTION_MODELS,
  type AiPredictionModelStatus,
} from "@/types/ai-prediction-models";
import type { MarketSentimentSource } from "@/types/market-sentiment";

function modelStatusLabel(status: AiPredictionModelStatus): string {
  switch (status) {
    case "planned":
      return "Planned";
    case "in_progress":
      return "In progress";
    case "active":
      return "Active";
  }
}

function modelStatusVariant(
  status: AiPredictionModelStatus
): "secondary" | "outline" | "default" {
  switch (status) {
    case "planned":
      return "outline";
    case "in_progress":
      return "secondary";
    case "active":
      return "default";
  }
}

export function AdminAiIndexesPanel({
  sentimentSources,
  sentimentSourcesUsingDefaults = false,
}: {
  sentimentSources: MarketSentimentSource[];
  sentimentSourcesUsingDefaults?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI Indexes</h2>
        <p className="text-sm text-muted-foreground">
          Prediction models and public data sources that power card valuation,
          outlook, and investment guidance.
        </p>
      </div>

      {sentimentSourcesUsingDefaults ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Database migration required.</span>{" "}
          Run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            supabase/migrations/038_market_sentiment_sources.sql
          </code>{" "}
          in your Supabase SQL editor to enable source management. Showing built-in
          defaults until then.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border/80 bg-background px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div>
              <h3 className="text-sm font-medium">Prediction models</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Initial model roadmap for forecasting card future value.
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="overflow-x-auto bg-background px-4 py-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">#</TableHead>
                  <TableHead className="min-w-[220px]">Model</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {AI_PREDICTION_MODELS.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {model.sortOrder}
                    </TableCell>
                    <TableCell className="font-medium">{model.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {model.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant={modelStatusVariant(model.status)}>
                        {modelStatusLabel(model.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      </section>

      <AdminMarketSentimentSourcesPanel
        sources={sentimentSources}
        readOnly={sentimentSourcesUsingDefaults}
      />
    </div>
  );
}

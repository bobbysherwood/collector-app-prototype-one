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
import { AdminCardInvestmentPanel } from "@/components/admin-card-investment-panel";
import { AdminMarketSentimentSourcesPanel } from "@/components/admin-market-sentiment-sources-panel";
import { AdminPlayerOpportunityPanel } from "@/components/admin-player-opportunity-panel";
import { AdminSportMarketIndexPanel } from "@/components/admin-sport-market-index-panel";
import type {
  CardInvestmentAdminMeta,
  PlayerOpportunityAdminMeta,
} from "@/app/actions/ai-models-admin";
import type { SportMarketIndexAdminMeta } from "@/app/actions/market-index";
import {
  AI_PREDICTION_MODEL_LAYERS,
  AI_PREDICTION_MODELS,
  type AiPredictionModelLayer,
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

function layerLabel(layer: AiPredictionModelLayer): string {
  return AI_PREDICTION_MODEL_LAYERS[layer].label;
}

export function AdminAiIndexesPanel({
  sentimentSources,
  sentimentSourcesUsingDefaults = false,
  sportMarketIndexMeta,
  cardInvestmentMeta,
  playerOpportunityMeta,
}: {
  sentimentSources: MarketSentimentSource[];
  sentimentSourcesUsingDefaults?: boolean;
  sportMarketIndexMeta: SportMarketIndexAdminMeta;
  cardInvestmentMeta: CardInvestmentAdminMeta;
  playerOpportunityMeta: PlayerOpportunityAdminMeta;
}) {
  const activeCount = AI_PREDICTION_MODELS.filter(
    (model) => model.status === "active"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI Indexes</h2>
        <p className="text-sm text-muted-foreground">
          Prediction models and public data sources that power card valuation,
          player opportunity scoring, sport market context, and investment guidance.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">
            {activeCount} of {AI_PREDICTION_MODELS.length} models active
          </Badge>
          <Badge variant="outline">V1 deterministic scoring</Badge>
          <Badge variant="outline">NBA basketball focus</Badge>
        </div>
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
                Full model registry across card investment, market index, and player
                opportunity layers.
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="overflow-x-auto bg-background px-4 py-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">#</TableHead>
                  <TableHead className="min-w-[200px]">Model</TableHead>
                  <TableHead className="w-[140px]">Layer</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="w-[160px]">Version</TableHead>
                  <TableHead className="min-w-[180px]">Wired to</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {AI_PREDICTION_MODELS.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {model.sortOrder}
                    </TableCell>
                    <TableCell className="font-medium">{model.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {layerLabel(model.layer)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {model.description}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {model.modelVersion ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {model.wiredTo ?? "—"}
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

      <AdminSportMarketIndexPanel meta={sportMarketIndexMeta} />

      <AdminMarketSentimentSourcesPanel
        sources={sentimentSources}
        readOnly={sentimentSourcesUsingDefaults}
      />

      <AdminCardInvestmentPanel meta={cardInvestmentMeta} />

      <AdminPlayerOpportunityPanel meta={playerOpportunityMeta} />
    </div>
  );
}

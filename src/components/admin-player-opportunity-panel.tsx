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
import type { PlayerOpportunityAdminMeta } from "@/app/actions/ai-models-admin";
import {
  AI_PREDICTION_MODEL_LAYERS,
  modelsByLayer,
} from "@/types/ai-prediction-models";

function formatPctWeight(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function AdminPlayerOpportunityPanel({
  meta,
}: {
  meta: PlayerOpportunityAdminMeta;
}) {
  const models = modelsByLayer("player-opportunity");

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border/80 bg-background px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-sm font-medium">Player & Player/Card Opportunity</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {AI_PREDICTION_MODEL_LAYERS["player-opportunity"].description} A
              strong player score does not automatically produce a strong card score.
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
                supabase/migrations/048_player_opportunity_snapshots.sql
              </code>{" "}
              to persist opportunity snapshots and backtesting history.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Player {meta.playerModelVersion}</Badge>
            <Badge variant="secondary">Card {meta.cardModelVersion}</Badge>
            <Badge variant="outline">
              {meta.stats.playerSnapshotCount} player snapshot
              {meta.stats.playerSnapshotCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              {meta.stats.cardSnapshotCount} card snapshot
              {meta.stats.cardSnapshotCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              {meta.stats.predictionCount} prediction record
              {meta.stats.predictionCount === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Dependency chain:</span>{" "}
            Sport Market Index → Player Opportunity → Player/Card Opportunity ← Card
            Valuation, Scarcity, Demand, Risk, Seasonality
            <span className="mx-2">·</span>
            <span className="font-medium text-foreground">UI:</span> Holdings card
            detail — Investment Opportunity panel
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">#</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="min-w-[180px]">Version</TableHead>
                  <TableHead className="min-w-[200px]">Wired to</TableHead>
                  <TableHead className="w-[160px]">Latest snapshot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => {
                  const latestAt =
                    model.id === "player-opportunity"
                      ? meta.stats.latestPlayerComputedAt
                      : meta.stats.latestCardComputedAt;

                  return (
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
                      <TableCell className="font-mono text-xs">
                        {model.modelVersion}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {model.wiredTo ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {latestAt
                          ? new Date(latestAt).toLocaleString()
                          : "Not computed"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">API:</span>{" "}
            <code>{meta.apiRoutes.player}</code>
            <span className="mx-2">·</span>
            <code>{meta.apiRoutes.playerCard}</code>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium">
              Player Opportunity weights by lifecycle
            </h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Outlook</TableHead>
                    <TableHead>Demand</TableHead>
                    <TableHead>Sport</TableHead>
                    <TableHead>Momentum</TableHead>
                    <TableHead>Catalysts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meta.playerWeightProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.label}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.playerQuality)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.futureOutlook)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.demand)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.sportMarket)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.momentum)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.catalysts)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium">
              Player/Card Opportunity weights by card profile
            </h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Valuation</TableHead>
                    <TableHead>Scarcity</TableHead>
                    <TableHead>Demand</TableHead>
                    <TableHead>Return</TableHead>
                    <TableHead>Risk-adj.</TableHead>
                    <TableHead>Liquidity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meta.cardWeightProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.label}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.playerOpportunity)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.valuation)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.scarcity)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.demand)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.expectedReturn)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.riskAdjustedReturn)}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatPctWeight(profile.liquidity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium">Recommendation thresholds</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">
                Strong Buy ≥ {meta.thresholds.strongBuy}
              </Badge>
              <Badge variant="secondary">Buy ≥ {meta.thresholds.buy}</Badge>
              <Badge variant="outline">Hold ≥ {meta.thresholds.hold}</Badge>
              <Badge variant="outline">Sell ≥ {meta.thresholds.sell}</Badge>
              <Badge variant="destructive">
                Strong Sell &lt; {meta.thresholds.sell}
              </Badge>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

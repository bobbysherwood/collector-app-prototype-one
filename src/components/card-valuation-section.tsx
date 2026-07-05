"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addLotValuation } from "@/app/actions/valuations";
import type { Asset, Lot, CardValuation } from "@/types/card";
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  gradeLabel,
  percentChange,
} from "@/types/card";
import { groupValuationsByLot } from "@/lib/valuations";
import { cn } from "@/lib/utils";

interface CardValuationSectionProps {
  asset: Asset;
  lots: Lot[];
  valuations: CardValuation[];
}

export function CardValuationSection({
  asset,
  lots,
  valuations,
}: CardValuationSectionProps) {
  const valuationsByLot = groupValuationsByLot(valuations);
  const heldLots = lots.filter((l) => l.quantity_remaining > 0);

  if (heldLots.length === 0 && valuations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {heldLots.map((lot) => (
        <LotValuationPanel
          key={lot.id}
          asset={asset}
          lot={lot}
          valuations={valuationsByLot.get(lot.id) ?? []}
        />
      ))}
      {heldLots.length === 0 &&
        lots.map((lot) => {
          const lotValuations = valuationsByLot.get(lot.id) ?? [];
          if (lotValuations.length === 0) return null;
          return (
            <LotValuationPanel
              key={lot.id}
              asset={asset}
              lot={lot}
              valuations={lotValuations}
              readOnly
            />
          );
        })}
    </div>
  );
}

function LotValuationPanel({
  lot,
  valuations,
  readOnly = false,
}: {
  lot: Lot;
  valuations: CardValuation[];
  readOnly?: boolean;
  asset?: Asset;
}) {
  const router = useRouter();
  const held = lot.quantity_remaining > 0 && !readOnly;
  const latest = valuations[valuations.length - 1] ?? null;
  const [value, setValue] = useState(latest ? String(latest.value) : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const costBasis = lot.unit_cost;
  const marketValue = latest ? latest.value : null;
  const gainVsCost =
    marketValue != null ? percentChange(costBasis, marketValue) : null;
  const firstValuation = valuations[0] ?? null;
  const gainSinceFirst =
    firstValuation && latest && valuations.length > 1
      ? percentChange(firstValuation.value, latest.value)
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a valid value of 0 or more.");
      return;
    }

    setLoading(true);
    const result = await addLotValuation(lot.id, parsed);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {held ? "Current Value" : "Historical Value"} · {gradeLabel(lot)}
            {lot.cert_number ? ` · #${lot.cert_number}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <ValuationMetric
              label="Cost Basis"
              value={formatCurrency(costBasis)}
            />
            <ValuationMetric
              label="Current Value"
              value={
                marketValue != null ? formatCurrency(marketValue) : "Not set"
              }
              highlight
            />
            <ValuationMetric
              label="Unrealized Gain / Loss"
              value={
                gainVsCost != null && marketValue != null
                  ? `${formatCurrency(marketValue - costBasis)} (${formatPercent(gainVsCost)})`
                  : "—"
              }
              positive={gainVsCost != null ? gainVsCost >= 0 : undefined}
            />
          </div>

          {latest && (
            <p className="text-sm text-muted-foreground">
              Last updated {formatDateTime(latest.recorded_at)}
            </p>
          )}

          {held ? (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor={`current_value_${lot.id}`}>
                  {latest ? "Update current value" : "Set current value"}
                </Label>
                <Input
                  id={`current_value_${lot.id}`}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading || !value}>
                {loading
                  ? "Saving..."
                  : latest
                    ? "Record New Value"
                    : "Set Value"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Valuations are read-only for sold lots. Historical values are
              shown below.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {held && (
            <p className="text-xs text-muted-foreground">
              Each entry is saved with a timestamp for this lot ({gradeLabel(lot)}
              ).
            </p>
          )}
        </CardContent>
      </Card>

      {valuations.length > 1 && gainSinceFirst != null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Value Change Since First Entry · {gradeLabel(lot)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                gainSinceFirst >= 0 ? "text-primary" : "text-destructive"
              )}
            >
              {formatPercent(gainSinceFirst)}
            </p>
          </CardContent>
        </Card>
      )}

      {valuations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Value History · {gradeLabel(lot)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ValuationChart valuations={valuations} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recorded</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...valuations].reverse().map((entry, index, reversed) => {
                  const previous = reversed[index + 1];
                  const change = previous
                    ? percentChange(previous.value, entry.value)
                    : null;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDateTime(entry.recorded_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(entry.value)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          change != null && change >= 0
                            ? "text-primary"
                            : change != null
                              ? "text-destructive"
                              : "text-muted-foreground"
                        )}
                      >
                        {change != null ? formatPercent(change) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ValuationMetric({
  label,
  value,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          highlight && "text-primary",
          positive === true && "text-primary",
          positive === false && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ValuationChart({ valuations }: { valuations: CardValuation[] }) {
  if (valuations.length < 2) return null;

  const points = valuations.map((v) => v.value);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 100;
  const height = 48;

  const coords = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const trendingUp = points[points.length - 1] >= points[0];

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        {trendingUp ? (
          <TrendingUp className="h-4 w-4 text-primary" />
        ) : (
          <TrendingDown className="h-4 w-4 text-destructive" />
        )}
        Position value over time
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-16 w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
          points={coords}
        />
      </svg>
    </div>
  );
}

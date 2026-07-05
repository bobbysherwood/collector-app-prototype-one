"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AssetPosition } from "@/types/card";
import type { CardValuation } from "@/types/card";
import { formatCurrency, formatPercent } from "@/types/card";
import {
  TIME_RANGES,
  type TimeRangeKey,
  buildPortfolioHistory,
  buildSportAllocation,
  getPeriodSummary,
  sportColor,
} from "@/lib/portfolio-history";
import { buildLatestValuationMap } from "@/lib/valuations";
import { cn } from "@/lib/utils";

interface PortfolioChartsProps {
  positions: AssetPosition[];
  heldLotPositions: import("@/types/card").HeldLotPosition[];
  lots: import("@/types/card").Lot[];
  valuations: CardValuation[];
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="tabular-nums">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { sport: string; value: number; percentage: number } }[];
}) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{data.sport}</p>
      <p className="tabular-nums">{formatCurrency(data.value)}</p>
      <p className="text-muted-foreground">{data.percentage.toFixed(1)}%</p>
    </div>
  );
}

export function PortfolioCharts({
  positions,
  heldLotPositions,
  lots,
  valuations,
}: PortfolioChartsProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("3y");

  const history = useMemo(
    () => buildPortfolioHistory(positions, valuations, lots, timeRange),
    [positions, valuations, lots, timeRange]
  );

  const periodSummary = useMemo(
    () => getPeriodSummary(positions, valuations, lots, timeRange),
    [positions, valuations, lots, timeRange]
  );

  const latestValuationMap = useMemo(
    () => buildLatestValuationMap(valuations),
    [valuations]
  );

  const sportAllocation = useMemo(
    () => buildSportAllocation(heldLotPositions, latestValuationMap),
    [heldLotPositions, latestValuationMap]
  );

  const pieData = sportAllocation.map((slice, index) => ({
    ...slice,
    fill: sportColor(slice.sport, index),
  }));

  const allocationTotals = useMemo(() => {
    const totalCards = pieData.reduce((sum, row) => sum + row.count, 0);
    const totalCostBasis = pieData.reduce((sum, row) => sum + row.costBasis, 0);
    const totalCurrent = pieData.reduce(
      (sum, row) => sum + (row.currentValue ?? 0),
      0
    );
    const hasCurrent = pieData.some((row) => row.currentValue != null);
    return { totalCards, totalCostBasis, totalCurrent, hasCurrent };
  }, [pieData]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <Card className="min-w-0 h-full lg:col-span-8">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-medium">
            Portfolio Performance
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {TIME_RANGES.map((range) => (
              <Button
                key={range.key}
                size="sm"
                variant={timeRange === range.key ? "default" : "outline"}
                onClick={() => setTimeRange(range.key)}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {periodSummary && (
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryTile
                label={`Returns (${periodSummary.periodLabel})`}
                value={formatCurrency(periodSummary.returns)}
                positive={periodSummary.returns >= 0}
                subtitle="Asset gains on held lots during the selected period"
              />
              <SummaryTile
                label={`Rate of Return (${periodSummary.periodLabel})`}
                value={
                  periodSummary.rateOfReturn != null
                    ? formatPercent(periodSummary.rateOfReturn)
                    : "N/A"
                }
                positive={
                  periodSummary.rateOfReturn != null
                    ? periodSummary.rateOfReturn >= 0
                    : undefined
                }
                subtitle={
                  periodSummary.rateOfReturn != null
                    ? "Annualized return based on the selected period"
                    : "Requires at least 12 months of history (not available for YTD)"
                }
              />
            </div>
          )}

          {history.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Add cards to see portfolio history.
            </p>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={history}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                    }
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="returns"
                    name="Returns"
                    stroke="oklch(0.58 0.18 145)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 h-full lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Allocation by Sport
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No cards to display.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="sport"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.sport} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sport</TableHead>
                      <TableHead className="text-right">Assets</TableHead>
                      <TableHead className="text-right">Cost Basis</TableHead>
                      <TableHead className="text-right">Current Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pieData.map((slice) => (
                      <TableRow key={slice.sport}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: slice.fill }}
                            />
                            <span className="text-sm font-medium">
                              {slice.sport}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {slice.count}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(slice.costBasis)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {slice.currentValue != null
                            ? formatCurrency(slice.currentValue)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-medium">Total</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {allocationTotals.totalCards}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(allocationTotals.totalCostBasis)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {allocationTotals.hasCurrent
                          ? formatCurrency(allocationTotals.totalCurrent)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  subtitle,
  positive,
}: {
  label: string;
  value: string;
  subtitle?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          positive === true && "text-primary",
          positive === false && "text-destructive"
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

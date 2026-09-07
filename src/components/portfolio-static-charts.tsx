import Link from "next/link";
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
import { formatCurrency, formatPercent } from "@/types/card";
import {
  TIME_RANGES,
  type PeriodSummary,
  type PortfolioHistoryPoint,
  type SportAllocationSlice,
  type TimeRangeKey,
} from "@/lib/portfolio-history";
import { cn } from "@/lib/utils";

const CHART_GREEN = "#2f9e44";
const LINE_WIDTH = 640;
const LINE_HEIGHT = 360;
const PIE_SIZE = 200;

function linePoints(history: PortfolioHistoryPoint[]) {
  const pad = { top: 16, right: 12, bottom: 28, left: 48 };
  const values = history.map((point) => point.returns);
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const innerW = LINE_WIDTH - pad.left - pad.right;
  const innerH = LINE_HEIGHT - pad.top - pad.bottom;

  return history.map((point, index) => {
    const x =
      pad.left +
      (history.length === 1 ? innerW / 2 : (index / (history.length - 1)) * innerW);
    const y = pad.top + (1 - (point.returns - min) / span) * innerH;
    return { ...point, x, y };
  });
}

function donutSlices(pieData: Array<SportAllocationSlice & { fill: string }>) {
  const cx = PIE_SIZE / 2;
  const cy = PIE_SIZE / 2;
  const outer = 72;
  const inner = 44;
  const total = pieData.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let angle = -Math.PI / 2;

  return pieData.map((slice) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const large = sweep > Math.PI ? 1 : 0;
    const outerStart = `${cx + outer * Math.cos(start)} ${cy + outer * Math.sin(start)}`;
    const outerEnd = `${cx + outer * Math.cos(end)} ${cy + outer * Math.sin(end)}`;
    const innerStart = `${cx + inner * Math.cos(end)} ${cy + inner * Math.sin(end)}`;
    const innerEnd = `${cx + inner * Math.cos(start)} ${cy + inner * Math.sin(start)}`;
    return {
      ...slice,
      d: `M ${outerStart} A ${outer} ${outer} 0 ${large} 1 ${outerEnd} L ${innerStart} A ${inner} ${inner} 0 ${large} 0 ${innerEnd} Z`,
    };
  });
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
      {subtitle ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function PortfolioStaticCharts({
  history,
  periodSummary,
  pieData,
  heldCount,
  timeRange,
}: {
  history: PortfolioHistoryPoint[];
  periodSummary: PeriodSummary | null;
  pieData: Array<SportAllocationSlice & { fill: string }>;
  heldCount: number;
  timeRange: TimeRangeKey;
}) {
  const coords = history.length > 0 ? linePoints(history) : [];
  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const slices = pieData.length > 0 ? donutSlices(pieData) : [];
  const allocationTotals = {
    totalCards: pieData.reduce((sum, row) => sum + row.count, 0),
    totalCostBasis: pieData.reduce((sum, row) => sum + row.costBasis, 0),
    totalCurrent: pieData.reduce((sum, row) => sum + (row.currentValue ?? 0), 0),
    hasCurrent: pieData.some((row) => row.currentValue != null),
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <Card className="min-w-0 overflow-visible lg:col-span-8">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-medium">
            Portfolio Performance
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {TIME_RANGES.map((range) => (
              <Link
                key={range.key}
                href={`/dashboard?range=${range.key}`}
                scroll={false}
                className={cn(
                  "inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium",
                  timeRange === range.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent"
                )}
              >
                {range.label}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {periodSummary ? (
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
          ) : null}

          {history.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {heldCount > 0
                ? "Not enough valuation history to plot this range."
                : "Add cards to see portfolio history."}
            </p>
          ) : (
            <svg
              viewBox={`0 0 ${LINE_WIDTH} ${LINE_HEIGHT}`}
              className="h-[360px] w-full"
              role="img"
              aria-label="Portfolio returns over time"
            >
              <line
                x1="48"
                x2="48"
                y1="16"
                y2="332"
                stroke="#d4d4d8"
                strokeDasharray="3 3"
              />
              <line
                x1="48"
                x2="628"
                y1="332"
                y2="332"
                stroke="#d4d4d8"
                strokeDasharray="3 3"
              />
              <path
                d={path}
                fill="none"
                stroke={CHART_GREEN}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {coords.filter((_, index) => index === 0 || index === coords.length - 1).map((point) => (
                <text
                  key={point.date}
                  x={point.x}
                  y={348}
                  textAnchor="middle"
                  className="fill-zinc-500"
                  fontSize="12"
                >
                  {point.label}
                </text>
              ))}
            </svg>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-visible lg:col-span-4">
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
              <svg
                viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
                className="h-[200px] w-[200px]"
                role="img"
                aria-label="Allocation by sport"
              >
                {slices.map((slice) => (
                  <path key={slice.sport} d={slice.d} fill={slice.fill} />
                ))}
              </svg>
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

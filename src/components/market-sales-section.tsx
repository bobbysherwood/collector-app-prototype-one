"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Asset, Lot } from "@/types/asset";
import type {
  MarketSale,
  MarketSaleSource,
  MarketSalesResult,
} from "@/types/market-sales";
import {
  MARKET_SALE_SOURCE_LABELS,
  MARKET_SALE_TYPE_LABELS,
} from "@/types/market-sales";
import { formatCurrency, gradeLabel } from "@/types/card";
import { buildMarketSalesSummary } from "@/lib/market-sales/summary";
import {
  estimateMarketValue,
  MARKET_ESTIMATE_CONFIDENCE_LABELS,
} from "@/lib/market-sales/estimate";
import type { MarketEstimateConfidence } from "@/lib/market-sales/estimate";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | MarketSaleSource;
type PeriodFilter = "30d" | "90d" | "1y" | "all";

interface MarketSalesSectionProps {
  asset: Asset;
  lots: Lot[];
  data: MarketSalesResult;
  /** When false, hides the preview banner (use once live data is connected). */
  preview?: boolean;
}

export function MarketSalesSection({
  data,
  preview = true,
}: MarketSalesSectionProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("90d");

  const filteredSales = useMemo(
    () => filterMarketSales(data.sales, sourceFilter, periodFilter),
    [data.sales, sourceFilter, periodFilter]
  );

  const summary = useMemo(
    () => buildMarketSalesSummary(filteredSales),
    [filteredSales]
  );

  const lastSale = useMemo(() => {
    if (filteredSales.length === 0) return null;
    return [...filteredSales].sort((a, b) =>
      b.sale_date.localeCompare(a.sale_date)
    )[0];
  }, [filteredSales]);

  const estimatedValue = useMemo(
    () => estimateMarketValue(filteredSales),
    [filteredSales]
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Market Sales
          </CardTitle>
          <CardDescription>
            Recent comparable sales from eBay and Fanatics Collect
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={sourceFilter}
            onValueChange={(value) =>
              setSourceFilter((value as SourceFilter) ?? "all")
            }
          >
            <SelectTrigger size="sm" className="w-[160px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="ebay">eBay</SelectItem>
              <SelectItem value="fanatics_collect">Fanatics Collect</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={periodFilter}
            onValueChange={(value) =>
              setPeriodFilter((value as PeriodFilter) ?? "90d")
            }
          >
            <SelectTrigger size="sm" className="w-[120px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {preview && (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Preview UI with sample comps — marketplace integrations will replace
            this data in a later phase.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryStat
            label="Last sale"
            value={
              lastSale ? formatCurrency(lastSale.sale_price) : "—"
            }
            subtitle={lastSale?.sale_date}
          />
          <SummaryStat
            label="Price range"
            value={
              summary.low_price != null && summary.high_price != null
                ? `${formatCurrency(summary.low_price)} – ${formatCurrency(summary.high_price)}`
                : "—"
            }
          />
          <EstimatedValueStat estimate={estimatedValue} />
        </div>

        {filteredSales.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No comparable sales match the selected filters.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Match</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => (
                  <MarketSaleRow key={sale.id} sale={sale} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data.as_of && (
          <p className="text-xs text-muted-foreground">
            Data as of {formatAsOf(data.as_of)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MarketSaleRow({ sale }: { sale: MarketSale }) {
  return (
    <TableRow>
      <TableCell className="tabular-nums whitespace-nowrap">
        {sale.sale_date}
      </TableCell>
      <TableCell>
        <SourceBadge source={sale.source} />
      </TableCell>
      <TableCell className="text-sm">
        {sale.grader
          ? gradeLabel({
              grader: sale.grader,
              grade: sale.grade,
              cert_number: null,
            })
          : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {MARKET_SALE_TYPE_LABELS[sale.sale_type]}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        <div>{formatCurrency(sale.sale_price)}</div>
        {sale.hammer_price != null && sale.buyers_premium_pct != null && (
          <div className="text-xs text-muted-foreground font-normal">
            {formatCurrency(sale.hammer_price)} + {sale.buyers_premium_pct}%
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <MatchBadge confidence={sale.match_confidence} />
      </TableCell>
      <TableCell>
        <Link
          href={sale.listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-muted-foreground hover:text-primary transition-colors"
          aria-label={`View listing on ${MARKET_SALE_SOURCE_LABELS[sale.source]}`}
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </TableCell>
    </TableRow>
  );
}

function SourceBadge({ source }: { source: MarketSaleSource }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-normal",
        source === "ebay" && "border-primary/30 text-primary",
        source === "fanatics_collect" && "border-amber-500/40 text-amber-700 dark:text-amber-400"
      )}
    >
      {MARKET_SALE_SOURCE_LABELS[source]}
    </Badge>
  );
}

function MatchBadge({
  confidence,
}: {
  confidence: MarketSale["match_confidence"];
}) {
  const label =
    confidence === "high"
      ? "High"
      : confidence === "medium"
        ? "Medium"
        : "Low";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-normal",
        confidence === "high" && "bg-primary/10 text-primary",
        confidence === "low" && "text-muted-foreground"
      )}
    >
      {label}
    </Badge>
  );
}

function EstimatedValueStat({
  estimate,
}: {
  estimate: ReturnType<typeof estimateMarketValue>;
}) {
  const confidenceLabel =
    MARKET_ESTIMATE_CONFIDENCE_LABELS[estimate.confidence];

  const detail =
    estimate.comp_count > 0
      ? `${estimate.comp_count} comp${estimate.comp_count === 1 ? "" : "s"} · ${estimate.recent_comp_count} in last 30 days`
      : undefined;

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Estimated value
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {estimate.value != null ? formatCurrency(estimate.value) : "—"}
      </p>
      {estimate.confidence !== "none" && (
        <div className="mt-2 space-y-1.5">
          <ConfidenceMeter
            score={estimate.confidence_score}
            level={estimate.confidence}
          />
          <p className={cn("text-xs font-medium", confidenceTextClass(estimate.confidence))}>
            {confidenceLabel}
          </p>
        </div>
      )}
      {estimate.confidence === "none" && (
        <p className="text-xs text-muted-foreground mt-1">{confidenceLabel}</p>
      )}
      {detail && (
        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
      )}
    </div>
  );
}

function ConfidenceMeter({
  score,
  level,
}: {
  score: number;
  level: MarketEstimateConfidence;
}) {
  const barColor = confidenceBarClass(level);

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-1.5 flex-1 gap-0.5 overflow-hidden rounded-full bg-muted">
        {[0, 1, 2].map((segment) => {
          const filled =
            level === "high" ||
            (level === "medium" && segment <= 1) ||
            (level === "low" && segment === 0);
          return (
            <div
              key={segment}
              className={cn(
                "h-full flex-1 rounded-full transition-colors",
                filled ? barColor : "bg-transparent"
              )}
            />
          );
        })}
      </div>
      <span
        className={cn(
          "text-xs tabular-nums font-medium w-7 text-right",
          confidenceTextClass(level)
        )}
      >
        {score}
      </span>
    </div>
  );
}

function confidenceTextClass(level: MarketEstimateConfidence): string {
  switch (level) {
    case "high":
      return "text-green-600 dark:text-green-500";
    case "medium":
      return "text-amber-600 dark:text-amber-500";
    case "low":
      return "text-red-600 dark:text-red-500";
    default:
      return "text-muted-foreground";
  }
}

function confidenceBarClass(level: MarketEstimateConfidence): string {
  switch (level) {
    case "high":
      return "bg-green-500 dark:bg-green-500";
    case "medium":
      return "bg-amber-500 dark:bg-amber-500";
    case "low":
      return "bg-red-500 dark:bg-red-500";
    default:
      return "bg-muted-foreground/40";
  }
}

function SummaryStat({
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
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function filterMarketSales(
  sales: MarketSale[],
  source: SourceFilter,
  period: PeriodFilter
): MarketSale[] {
  const cutoff = periodCutoff(period);

  return sales.filter((sale) => {
    if (source !== "all" && sale.source !== source) return false;
    if (cutoff && sale.sale_date < cutoff) return false;
    return true;
  });
}

function periodCutoff(period: PeriodFilter): string | null {
  if (period === "all") return null;
  const date = new Date();
  if (period === "30d") date.setDate(date.getDate() - 30);
  else if (period === "90d") date.setDate(date.getDate() - 90);
  else date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split("T")[0];
}

function formatAsOf(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

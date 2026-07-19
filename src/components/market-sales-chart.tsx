"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/types/card";
import {
  MARKET_SALE_SOURCE_LABELS,
  MARKET_SALE_TYPE_LABELS,
  type MarketSaleSource,
} from "@/types/market-sales";
import {
  buildMarketSalesChartPointsWithTrend,
  type MarketSalesChartPoint,
} from "@/lib/market-sales/period-filter";

interface MarketSalesChartProps {
  sales: import("@/types/market-sales").MarketSale[];
}

function MarketSalesChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: MarketSalesChartPoint;
  }[];
}) {
  if (!active || !payload?.[0]) return null;

  const point = payload[0].payload;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium tabular-nums">{point.label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums">
        {formatCurrency(point.price)}
      </p>
      {point.trendPrice != null && (
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          Trend: {formatCurrency(point.trendPrice)}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {MARKET_SALE_SOURCE_LABELS[point.source]} ·{" "}
        {MARKET_SALE_TYPE_LABELS[point.saleType]}
      </p>
    </div>
  );
}

export function MarketSalesChart({ sales }: MarketSalesChartProps) {
  const chartData = useMemo(
    () => buildMarketSalesChartPointsWithTrend(sales),
    [sales]
  );
  const showTrend = chartData.length >= 2;

  if (chartData.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No sales in this period to chart.
      </p>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) =>
              value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`
            }
            className="text-muted-foreground"
            domain={["auto", "auto"]}
            width={56}
          />
          <Tooltip content={<MarketSalesChartTooltip />} />
          {showTrend && (
            <Legend
              verticalAlign="top"
              align="right"
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            />
          )}
          {showTrend && (
            <Line
              type="linear"
              dataKey="trendPrice"
              name="Trend"
              stroke="oklch(0.52 0.06 265)"
              strokeWidth={2.5}
              strokeDasharray="8 5"
              dot={false}
              activeDot={false}
              legendType="line"
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="price"
            name="Sale price"
            stroke="oklch(0.58 0.18 145)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 0, fill: "oklch(0.58 0.18 145)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

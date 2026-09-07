import { Suspense } from "react";
import { PortfolioStaticCharts } from "@/components/portfolio-static-charts";
import { PortfolioInsightsLoader } from "@/components/portfolio-insights-loader";
import { PortfolioInsightsLoading } from "@/components/portfolio-insights-loading";
import { PortfolioPerformanceLeaders } from "@/components/portfolio-performance-leaders";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";
import { getPortfolioChartData } from "@/lib/data";
import {
  buildPortfolioHistory,
  buildSportAllocation,
  getPeriodSummary,
  parseDashboardRange,
  sportColor,
} from "@/lib/portfolio-history";
import { buildLatestValuationMap } from "@/lib/valuations";

const EMPTY_CHART_DATA = {
  assets: [],
  lots: [],
  sales: [],
  valuations: [],
  positions: [],
  heldLotPositions: [],
  heldPositions: [],
  topPerformers: [],
  underperformers: [],
};

interface DashboardPageProps {
  searchParams: Promise<{ range?: string | string[] }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const timeRange = parseDashboardRange((await searchParams).range);
  const [aiFeatureSettings, chartResult] = await Promise.all([
    getAiFeatureSettings(),
    getPortfolioChartData()
      .then((chartData) => ({ chartData, error: null as string | null }))
      .catch((error) => {
        console.error("Failed to load dashboard chart data:", error);
        return {
          chartData: EMPTY_CHART_DATA,
          error:
            error instanceof Error
              ? error.message
              : "Portfolio charts could not be loaded.",
        };
      }),
  ]);
  const { chartData, error: chartError } = chartResult;
  const history = buildPortfolioHistory(
    chartData.positions,
    chartData.valuations,
    chartData.lots,
    timeRange
  );
  const periodSummary = getPeriodSummary(
    chartData.positions,
    chartData.valuations,
    chartData.lots,
    timeRange
  );
  const pieData = buildSportAllocation(
    chartData.heldLotPositions,
    buildLatestValuationMap(chartData.valuations)
  ).map((slice, index) => ({
    ...slice,
    fill: sportColor(slice.sport, index),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your sports card investments
        </p>
      </div>

      {chartError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Charts could not load: {chartError}
        </div>
      ) : null}

      <PortfolioStaticCharts
        history={history}
        periodSummary={periodSummary}
        pieData={pieData}
        heldCount={chartData.heldLotPositions.length}
        timeRange={timeRange}
      />

      {aiFeatureSettings.portfolioInsightsEnabled ? (
        <Suspense fallback={<PortfolioInsightsLoading />}>
          <PortfolioInsightsLoader />
        </Suspense>
      ) : null}

      <PortfolioPerformanceLeaders
        topPerformers={chartData.topPerformers}
        underperformers={chartData.underperformers}
      />
    </div>
  );
}

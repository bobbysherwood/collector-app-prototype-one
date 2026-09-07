import { Suspense } from "react";
import { PortfolioCharts } from "@/components/portfolio-charts";
import { PortfolioInsightsLoader } from "@/components/portfolio-insights-loader";
import { PortfolioInsightsLoading } from "@/components/portfolio-insights-loading";
import { PortfolioPerformanceLeaders } from "@/components/portfolio-performance-leaders";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";
import { getPortfolioChartData } from "@/lib/data";

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

export default async function DashboardPage() {
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

      <PortfolioCharts
        positions={chartData.positions}
        heldLotPositions={chartData.heldLotPositions}
        lots={chartData.lots}
        valuations={chartData.valuations}
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

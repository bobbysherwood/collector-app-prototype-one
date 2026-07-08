import { Suspense } from "react";
import { PortfolioCharts } from "@/components/portfolio-charts";
import { PortfolioInsightsLoader } from "@/components/portfolio-insights-loader";
import { PortfolioInsightsLoading } from "@/components/portfolio-insights-loading";
import { PortfolioPerformanceLeaders } from "@/components/portfolio-performance-leaders";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";
import { getPortfolioChartData } from "@/lib/data";

export default async function DashboardPage() {
  const [aiFeatureSettings, chartData] = await Promise.all([
    getAiFeatureSettings(),
    getPortfolioChartData(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your sports card investments
        </p>
      </div>

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

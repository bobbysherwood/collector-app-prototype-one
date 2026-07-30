import dynamic from "next/dynamic";
import { Suspense } from "react";
import { PortfolioInsightsLoader } from "@/components/portfolio-insights-loader";
import { PortfolioInsightsLoading } from "@/components/portfolio-insights-loading";
import { PortfolioPerformanceLeaders } from "@/components/portfolio-performance-leaders";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";
import { getPortfolioChartData } from "@/lib/data";

const PortfolioCharts = dynamic(
  () =>
    import("@/components/portfolio-charts").then((mod) => ({
      default: mod.PortfolioCharts,
    })),
  {
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    ),
  }
);

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

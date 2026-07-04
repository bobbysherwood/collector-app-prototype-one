import { PortfolioCharts } from "@/components/portfolio-charts";
import { PortfolioPerformanceLeaders } from "@/components/portfolio-performance-leaders";
import { getPortfolioChartData } from "@/lib/data";

export default async function DashboardPage() {
  const chartData = await getPortfolioChartData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your sports card investments
        </p>
      </div>

      <PortfolioCharts
        cards={chartData.cards}
        heldCards={chartData.heldCards}
        valuations={chartData.valuations}
      />

      <PortfolioPerformanceLeaders
        topPerformers={chartData.topPerformers}
        underperformers={chartData.underperformers}
      />
    </div>
  );
}

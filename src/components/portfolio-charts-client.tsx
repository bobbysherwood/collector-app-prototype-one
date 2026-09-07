"use client";

import dynamic from "next/dynamic";
import type { PortfolioChartsProps } from "@/components/portfolio-charts";

const PortfolioCharts = dynamic(
  () =>
    import("@/components/portfolio-charts").then((mod) => ({
      default: mod.PortfolioCharts,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    ),
  }
);

export function PortfolioChartsClient(props: PortfolioChartsProps) {
  return <PortfolioCharts {...props} />;
}

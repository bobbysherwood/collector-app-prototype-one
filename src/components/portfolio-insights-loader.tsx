import { getPortfolioInsights } from "@/lib/portfolio-insights";
import { PortfolioInsights } from "@/components/portfolio-insights";

export async function PortfolioInsightsLoader() {
  const result = await getPortfolioInsights();
  return <PortfolioInsights result={result} />;
}

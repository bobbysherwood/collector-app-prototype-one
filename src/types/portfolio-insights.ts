export type PortfolioInsightType =
  | "performance"
  | "risk"
  | "opportunity"
  | "action";

export interface PortfolioInsight {
  type: PortfolioInsightType;
  title: string;
  body: string;
}

export interface PortfolioInsightsResult {
  insights: PortfolioInsight[];
  summary: string | null;
  generatedAt: string;
  fromCache: boolean;
  error?: string;
}

export const PORTFOLIO_INSIGHTS_PROMPT_VERSION = "insights-v1";

export const STALE_VALUATION_THRESHOLD_DAYS = 90;

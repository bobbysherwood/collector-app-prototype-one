export type AiPredictionModelStatus = "planned" | "in_progress" | "active";

export interface AiPredictionModelDefinition {
  id: string;
  name: string;
  description: string;
  status: AiPredictionModelStatus;
  sortOrder: number;
}

export const AI_PREDICTION_MODELS: AiPredictionModelDefinition[] = [
  {
    id: "market-valuation",
    name: "Market Valuation Model",
    description:
      "Estimates fair market value from recent sales, listings, and comparable transactions.",
    status: "planned",
    sortOrder: 1,
  },
  {
    id: "player",
    name: "Player Model",
    description:
      "Scores player-level demand drivers such as performance, popularity, and career trajectory.",
    status: "planned",
    sortOrder: 2,
  },
  {
    id: "scarcity",
    name: "Scarcity Model",
    description:
      "Quantifies supply constraints from print run, grade population, and parallel rarity.",
    status: "planned",
    sortOrder: 3,
  },
  {
    id: "market-sentiment",
    name: "Market Sentiment Model",
    description:
      "Tracks collector and market mood from price momentum, bid activity, and social signals.",
    status: "in_progress",
    sortOrder: 4,
  },
  {
    id: "risk-liquidity",
    name: "Risk & Liquidity Model",
    description:
      "Assesses downside risk, sale velocity, and how quickly a card can be converted to cash.",
    status: "planned",
    sortOrder: 5,
  },
  {
    id: "seasonality-catalysts",
    name: "Seasonality & Catalysts Model",
    description:
      "Identifies calendar effects and event-driven price catalysts such as awards, playoffs, and product drops.",
    status: "planned",
    sortOrder: 6,
  },
  {
    id: "forecast",
    name: "Forecast Model",
    description:
      "Projects short- and medium-term price paths by combining valuation, sentiment, and catalyst inputs.",
    status: "planned",
    sortOrder: 7,
  },
  {
    id: "investment-rating",
    name: "Investment Rating Model",
    description:
      "Synthesizes model outputs into buy, hold, or avoid guidance with confidence scoring.",
    status: "planned",
    sortOrder: 8,
  },
  {
    id: "explainability",
    name: "Explainability Model",
    description:
      "Generates human-readable rationale for predictions, ratings, and forecast direction.",
    status: "planned",
    sortOrder: 9,
  },
  {
    id: "portfolio-analytics",
    name: "Portfolio Analytics Model",
    description:
      "Aggregates card-level predictions into portfolio exposure, concentration, and performance outlook.",
    status: "planned",
    sortOrder: 10,
  },
];

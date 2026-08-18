export type AiPredictionModelStatus = "planned" | "in_progress" | "active";

export type AiPredictionModelLayer =
  | "card-investment"
  | "market-index"
  | "player-opportunity"
  | "portfolio";

export interface AiPredictionModelDefinition {
  id: string;
  name: string;
  description: string;
  status: AiPredictionModelStatus;
  sortOrder: number;
  layer: AiPredictionModelLayer;
  modelVersion?: string;
  wiredTo?: string;
}

export const AI_PREDICTION_MODEL_LAYERS: Record<
  AiPredictionModelLayer,
  { label: string; description: string }
> = {
  "card-investment": {
    label: "Card Investment",
    description:
      "Modular card-level models composed into a full investment profile (valuation through portfolio).",
  },
  "market-index": {
    label: "Market Index",
    description: "Sport-level market health, momentum, and forward outlook.",
  },
  "player-opportunity": {
    label: "Player Opportunity",
    description:
      "Player collectible demand and card-specific investment opportunity at today's price.",
  },
  portfolio: {
    label: "Portfolio",
    description: "Portfolio-level aggregation and analytics.",
  },
};

export const AI_PREDICTION_MODELS: AiPredictionModelDefinition[] = [
  {
    id: "market-valuation",
    name: "Market Valuation Model",
    description:
      "Estimates fair market value from recent sales, listings, and comparable transactions.",
    status: "active",
    sortOrder: 1,
    layer: "card-investment",
    modelVersion: "card-investment-v1.0.0",
    wiredTo: "Card Investment profile orchestrator",
  },
  {
    id: "player",
    name: "Player Legacy Model",
    description:
      "Scores player-level demand drivers such as performance, popularity, and career trajectory.",
    status: "active",
    sortOrder: 2,
    layer: "card-investment",
    modelVersion: "card-investment-v1.0.0",
    wiredTo: "Card Investment profile · Player Opportunity quality",
  },
  {
    id: "scarcity",
    name: "Scarcity Model",
    description:
      "Quantifies supply constraints from print run, grade population, and parallel rarity.",
    status: "active",
    sortOrder: 3,
    layer: "card-investment",
    modelVersion: "card-investment-v1.0.0",
    wiredTo: "Card Investment profile · Player/Card Opportunity",
  },
  {
    id: "market-sentiment",
    name: "Market Sentiment Model",
    description:
      "Tracks collector and market mood from price momentum, bid activity, and social signals.",
    status: "active",
    sortOrder: 4,
    layer: "card-investment",
    modelVersion: "market-sentiment-v1",
    wiredTo: "Market Research card detail · Card demand inputs",
  },
  {
    id: "risk-liquidity",
    name: "Risk & Liquidity Model",
    description:
      "Assesses downside risk, sale velocity, and how quickly a card can be converted to cash.",
    status: "active",
    sortOrder: 5,
    layer: "card-investment",
    modelVersion: "card-investment-v1.0.0",
    wiredTo: "Card Investment profile · Player/Card Opportunity",
  },
  {
    id: "seasonality-catalysts",
    name: "Seasonality & Catalysts Model",
    description:
      "Identifies calendar effects and event-driven price catalysts such as awards, playoffs, and product drops.",
    status: "active",
    sortOrder: 6,
    layer: "card-investment",
    modelVersion: "card-investment-v1.0.0",
    wiredTo: "Card Investment profile · Player Opportunity catalysts",
  },
  {
    id: "forecast",
    name: "Forecast Model",
    description:
      "Projects short- and medium-term price paths by combining valuation, sentiment, and catalyst inputs.",
    status: "active",
    sortOrder: 7,
    layer: "card-investment",
    modelVersion: "card-investment-v1.0.0",
    wiredTo: "Card Investment profile · Player/Card Opportunity return",
  },
  {
    id: "investment-rating",
    name: "Investment Rating Model",
    description:
      "Synthesizes model outputs into buy, hold, or avoid guidance with confidence scoring.",
    status: "active",
    sortOrder: 8,
    layer: "card-investment",
    modelVersion: "card-investment-v1.0.0",
    wiredTo: "Card Investment profile API",
  },
  {
    id: "explainability",
    name: "Explainability Model",
    description:
      "Generates human-readable rationale for predictions, ratings, and forecast direction.",
    status: "active",
    sortOrder: 9,
    layer: "card-investment",
    modelVersion: "card-investment-v1.0.0",
    wiredTo: "Card Investment profile · Opportunity summaries",
  },
  {
    id: "portfolio-analytics",
    name: "Portfolio Analytics Model",
    description:
      "Aggregates card-level predictions into portfolio exposure, concentration, and performance outlook.",
    status: "active",
    sortOrder: 10,
    layer: "portfolio",
    modelVersion: "card-investment-v1.0.0",
    wiredTo: "Card Investment profile orchestrator",
  },
  {
    id: "market-index",
    name: "Sport Market Index",
    description:
      "Tracks broad market movement across segments and eras to benchmark individual card performance against the hobby.",
    status: "active",
    sortOrder: 11,
    layer: "market-index",
    modelVersion: "sport-index-v1.0.0",
    wiredTo: "Market Research · Sport Market Index card · Player Opportunity",
  },
  {
    id: "player-opportunity",
    name: "Player Opportunity Model",
    description:
      "Evaluates whether a player's collectible demand and long-term market value are likely to increase over the next 90 days.",
    status: "active",
    sortOrder: 12,
    layer: "player-opportunity",
    modelVersion: "player-opportunity-v1.0.0",
    wiredTo: "Holdings card detail · Player/Card Opportunity input",
  },
  {
    id: "player-card-opportunity",
    name: "Player/Card Opportunity Model",
    description:
      "Evaluates whether a specific card is an attractive investment at today's price given player outlook, scarcity, and valuation.",
    status: "active",
    sortOrder: 13,
    layer: "player-opportunity",
    modelVersion: "player-card-opportunity-v1.0.0",
    wiredTo: "Holdings card detail · Investment Opportunity panel",
  },
];

export function modelsByLayer(
  layer: AiPredictionModelLayer
): AiPredictionModelDefinition[] {
  return AI_PREDICTION_MODELS.filter((model) => model.layer === layer);
}

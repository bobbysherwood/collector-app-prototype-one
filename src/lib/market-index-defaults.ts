import type { SportMarketIndexConfig } from "@/types/market-index";

export function isMissingSportMarketIndexTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    message.includes("sport_market_index_configs") ||
    message.includes("sport_market_index_cache") ||
    message.includes("sport_market_index_snapshots") ||
    message.includes("sport_market_features")
  );
}

export function getDefaultNbaSportMarketIndexConfig(): SportMarketIndexConfig {
  const now = new Date().toISOString();
  return {
    id: "nba",
    name: "NBA Basketball",
    active: true,
    pickListSportId: null,
    seasonConfig: {
      seasonStart: "10-01",
      seasonEnd: "06-30",
      draftDate: "06-26",
      playoffsStart: "04-15",
      finalsEnd: "06-20",
    },
    searchTerms: {
      default: ["NBA basketball cards", "Panini Prizm NBA"],
      sentiment: ["NBA basketball cards", "basketball cards investment"],
      reddit: ["basketballcards", "sportscards"],
      trends: ["NBA cards", "basketball cards"],
    },
    providerConfig: {
      enabledProviders: [
        "market-sentiment-composite",
        "ebay-market",
        "product-calendar",
      ],
    },
    indexWeights: {
      health: {
        "market.ebay.transaction_count": 0.15,
        "market.ebay.dollar_volume": 0.12,
        "market.ebay.liquidity_index": 0.1,
        "sentiment.composite.score": 0.2,
        "demand.google.trends_index": 0.08,
        "supply.sealed.inventory_proxy": -0.1,
        "supply.product.release_pressure": -0.05,
      },
      momentum: {
        "market.ebay.transaction_count": 0.25,
        "sentiment.composite.score": 0.2,
        "demand.google.trends_index": 0.15,
        "sentiment.reddit.score": 0.1,
      },
      outlook_blend: {
        health: 0.35,
        momentum: 0.45,
        leading_bundle: 0.2,
      },
    },
    forecastConfig: {
      leadingIndicatorFeatures: [
        "sentiment.composite.score",
        "demand.google.trends_index",
        "market.ebay.transaction_count",
      ],
      ensembleWeights: { rules: 0.6, ridge: 0.3, gbm: 0.1 },
      rulesCoefficients: {
        outlook_to_3m: 0.25,
        momentum_adj: 0.08,
        horizon_6m_multiplier: 1.6,
        horizon_12m_multiplier: 2.4,
        decay_pull_strength: 0.35,
      },
      ridgeCoefficients: {},
    },
    seasonModifiers: {
      playoffs: { momentum: 0.03 },
      draft: { "demand.google.trends_index": 0.05 },
      offseason: { health: -0.02 },
    },
    riskThresholds: {
      lowConfidenceMin: 75,
      mediumConfidenceMin: 50,
      highSupplyHeadwindCount: 2,
    },
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function getDefaultSportMarketIndexConfigs(): SportMarketIndexConfig[] {
  return [getDefaultNbaSportMarketIndexConfig()];
}

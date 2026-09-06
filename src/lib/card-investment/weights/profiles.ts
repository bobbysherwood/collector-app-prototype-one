import type {
  CardArchetype,
  CardEra,
  PlayerLifecycleStage,
} from "@/types/card-investment";

export interface ModelWeightProfile {
  id: string;
  label: string;
  valuation: { recency7d: number; recency30d: number; recency90d: number };
  playerLegacy: Record<PlayerLifecycleStage, number>;
  scarcity: {
    parallel: number;
    rookie: number;
    auto: number;
    vintage: number;
    population: number;
    populationGrowth: number;
  };
  demand: { sportMomentum: number; sportOutlook: number; compVolume: number };
  risk: { volatility: number; liquidity: number; sportRisk: number };
  seasonality: { playoffs: number; draft: number; offseason: number };
  forecast: {
    valuationTrend: number;
    demand: number;
    sportForecast: number;
    seasonality: number;
  };
  recommendation: {
    valuation: number;
    playerLegacy: number;
    scarcity: number;
    demand: number;
    risk: number;
    seasonality: number;
    forecast: number;
  };
}

const DEFAULT_PROFILE: ModelWeightProfile = {
  id: "default",
  label: "Default",
  valuation: { recency7d: 0.45, recency30d: 0.35, recency90d: 0.2 },
  playerLegacy: {
    rising: 1.15,
    peak: 1.05,
    declining: 0.9,
    legacy: 1.1,
    unknown: 1.0,
  },
  scarcity: {
    parallel: 1.2,
    rookie: 1.15,
    auto: 1.25,
    vintage: 1.1,
    population: 1,
    populationGrowth: 1,
  },
  demand: { sportMomentum: 0.4, sportOutlook: 0.35, compVolume: 0.25 },
  risk: { volatility: 0.4, liquidity: 0.35, sportRisk: 0.25 },
  seasonality: { playoffs: 1.1, draft: 1.05, offseason: 0.95 },
  forecast: {
    valuationTrend: 0.35,
    demand: 0.25,
    sportForecast: 0.25,
    seasonality: 0.15,
  },
  recommendation: {
    valuation: 0.2,
    playerLegacy: 0.15,
    scarcity: 0.1,
    demand: 0.2,
    risk: 0.15,
    seasonality: 0.05,
    forecast: 0.15,
  },
};

const NBA_MODERN_ROOKIE: ModelWeightProfile = {
  ...DEFAULT_PROFILE,
  id: "nba-modern-rookie",
  label: "NBA Modern Rookie",
  playerLegacy: { ...DEFAULT_PROFILE.playerLegacy, rising: 1.25, peak: 1.1 },
  scarcity: { ...DEFAULT_PROFILE.scarcity, rookie: 1.3 },
  demand: { ...DEFAULT_PROFILE.demand, sportMomentum: 0.45, sportOutlook: 0.3 },
  seasonality: { playoffs: 1.14, draft: 1.08, offseason: 0.92 },
};

const NBA_ULTRA_MODERN: ModelWeightProfile = {
  ...DEFAULT_PROFILE,
  id: "nba-ultra-modern",
  label: "NBA Ultra-Modern",
  seasonality: { playoffs: 1.2, draft: 1.1, offseason: 0.88 },
};

const NBA_VINTAGE_LEGACY: ModelWeightProfile = {
  ...DEFAULT_PROFILE,
  id: "nba-vintage-legacy",
  label: "NBA Vintage / Legacy",
  playerLegacy: { ...DEFAULT_PROFILE.playerLegacy, legacy: 1.25 },
  scarcity: { ...DEFAULT_PROFILE.scarcity, vintage: 1.3 },
  risk: { ...DEFAULT_PROFILE.risk, volatility: 0.3, liquidity: 0.45 },
  seasonality: { playoffs: 1.03, draft: 1.02, offseason: 0.99 },
};

export function resolveWeightProfile(input: {
  sport: string;
  era: CardEra;
  lifecycle: PlayerLifecycleStage;
  archetype: CardArchetype;
}): ModelWeightProfile {
  const sport = input.sport.toLowerCase();

  if (sport.includes("basketball")) {
    if (input.era === "pre_war" || input.era === "vintage" || input.lifecycle === "legacy") {
      return {
        ...NBA_VINTAGE_LEGACY,
        id: input.era === "pre_war" ? "nba-pre-war" : NBA_VINTAGE_LEGACY.id,
        seasonality:
          input.era === "pre_war"
            ? { playoffs: 1.015, draft: 1.01, offseason: 0.995 }
            : NBA_VINTAGE_LEGACY.seasonality,
      };
    }
    if (input.era === "junk_wax") {
      return {
        ...DEFAULT_PROFILE,
        id: "nba-junk-wax",
        label: "NBA Junk Wax",
        seasonality: { playoffs: 1.07, draft: 1.03, offseason: 0.97 },
      };
    }
    if (input.era === "early_modern") {
      return {
        ...DEFAULT_PROFILE,
        id: "nba-early-modern",
        label: "NBA Early Modern",
        seasonality: { playoffs: 1.09, draft: 1.04, offseason: 0.96 },
      };
    }
    if (input.era === "ultra_modern") {
      if (input.archetype === "rookie") {
        return {
          ...NBA_ULTRA_MODERN,
          id: "nba-ultra-modern-rookie",
          label: "NBA Ultra-Modern Rookie",
          scarcity: { ...NBA_ULTRA_MODERN.scarcity, rookie: 1.3 },
        };
      }
      return NBA_ULTRA_MODERN;
    }
    if (input.archetype === "rookie") {
      return NBA_MODERN_ROOKIE;
    }
  }

  return DEFAULT_PROFILE;
}

export function listCardInvestmentWeightProfiles(): ModelWeightProfile[] {
  return [DEFAULT_PROFILE, NBA_MODERN_ROOKIE, NBA_ULTRA_MODERN, NBA_VINTAGE_LEGACY];
}

export { DEFAULT_PROFILE };

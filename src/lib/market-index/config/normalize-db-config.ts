import type {
  SportForecastConfig,
  SportMarketIndexConfig,
  SportProviderConfig,
  SportRiskThresholds,
  SportSeasonConfig,
  SportSearchTerms,
} from "@/types/market-index";

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asWeightMap(value: unknown): Record<string, number> {
  const record = asRecord(value);
  const weights: Record<string, number> = {};
  for (const [key, weight] of Object.entries(record)) {
    if (typeof weight === "number" && Number.isFinite(weight)) {
      weights[key] = weight;
    }
  }
  return weights;
}

export function normalizeSeasonConfig(raw: unknown): SportSeasonConfig {
  const record = asRecord(raw);
  return {
    seasonStart:
      (record.seasonStart as string | undefined) ??
      (record.season_start as string | undefined),
    seasonEnd:
      (record.seasonEnd as string | undefined) ??
      (record.season_end as string | undefined),
    draftDate:
      (record.draftDate as string | undefined) ??
      (record.draft_date as string | undefined),
    playoffsStart:
      (record.playoffsStart as string | undefined) ??
      (record.playoffs_start as string | undefined),
    finalsEnd:
      (record.finalsEnd as string | undefined) ??
      (record.finals_end as string | undefined),
  };
}

export function normalizeSearchTerms(raw: unknown): SportSearchTerms {
  const record = asRecord(raw);
  return {
    default: asStringArray(record.default),
    sentiment: asStringArray(record.sentiment),
    reddit: asStringArray(record.reddit),
    trends: asStringArray(record.trends),
    ebay: asStringArray(record.ebay),
  };
}

export function normalizeProviderConfig(raw: unknown): SportProviderConfig {
  const record = asRecord(raw);
  const fromCamel = asStringArray(record.enabledProviders);
  const fromSnake = asStringArray(record.enabled_providers);

  return {
    enabledProviders: fromCamel.length > 0 ? fromCamel : fromSnake,
  };
}

export function normalizeIndexWeights(
  raw: unknown
): SportMarketIndexConfig["indexWeights"] {
  const record = asRecord(raw);
  const outlook = asRecord(record.outlook_blend ?? record.outlookBlend);

  return {
    health: asWeightMap(record.health),
    momentum: asWeightMap(record.momentum),
    outlook_blend: {
      health: Number(outlook.health ?? 0.35),
      momentum: Number(outlook.momentum ?? 0.45),
      leading_bundle: Number(
        outlook.leading_bundle ?? outlook.leadingBundle ?? 0.2
      ),
    },
  };
}

export function normalizeForecastConfig(raw: unknown): SportForecastConfig {
  const record = asRecord(raw);
  const ensemble = asRecord(record.ensemble_weights ?? record.ensembleWeights);
  const rules = asRecord(record.rules_coefficients ?? record.rulesCoefficients);
  const ridge = asRecord(record.ridge_coefficients ?? record.ridgeCoefficients);

  return {
    leadingIndicatorFeatures: asStringArray(
      record.leading_indicator_features ?? record.leadingIndicatorFeatures
    ),
    ensembleWeights: {
      rules: typeof ensemble.rules === "number" ? ensemble.rules : undefined,
      ridge: typeof ensemble.ridge === "number" ? ensemble.ridge : undefined,
      gbm: typeof ensemble.gbm === "number" ? ensemble.gbm : undefined,
    },
    rulesCoefficients: {
      outlook_to_3m:
        typeof rules.outlook_to_3m === "number" ? rules.outlook_to_3m : undefined,
      momentum_adj:
        typeof rules.momentum_adj === "number" ? rules.momentum_adj : undefined,
      horizon_6m_multiplier:
        typeof rules.horizon_6m_multiplier === "number"
          ? rules.horizon_6m_multiplier
          : undefined,
      horizon_12m_multiplier:
        typeof rules.horizon_12m_multiplier === "number"
          ? rules.horizon_12m_multiplier
          : undefined,
      decay_pull_strength:
        typeof rules.decay_pull_strength === "number"
          ? rules.decay_pull_strength
          : undefined,
    },
    ridgeCoefficients: Object.fromEntries(
      Object.entries(ridge).filter((entry): entry is [string, number] =>
        typeof entry[1] === "number"
      )
    ),
  };
}

export function normalizeRiskThresholds(raw: unknown): SportRiskThresholds {
  const record = asRecord(raw);
  return {
    lowConfidenceMin:
      (record.lowConfidenceMin as number | undefined) ??
      (record.low_confidence_min as number | undefined),
    mediumConfidenceMin:
      (record.mediumConfidenceMin as number | undefined) ??
      (record.medium_confidence_min as number | undefined),
    highSupplyHeadwindCount:
      (record.highSupplyHeadwindCount as number | undefined) ??
      (record.high_supply_headwind_count as number | undefined),
  };
}

export function normalizeSportMarketIndexConfigRow(row: {
  id: string;
  name: string;
  active: boolean;
  pick_list_sport_id: string | null;
  season_config: unknown;
  search_terms: unknown;
  provider_config: unknown;
  index_weights: unknown;
  forecast_config: unknown;
  season_modifiers: unknown;
  risk_thresholds: unknown;
  sort_order: number;
  created_at: string;
  updated_at: string;
}): SportMarketIndexConfig {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    pickListSportId: row.pick_list_sport_id,
    seasonConfig: normalizeSeasonConfig(row.season_config),
    searchTerms: normalizeSearchTerms(row.search_terms),
    providerConfig: normalizeProviderConfig(row.provider_config),
    indexWeights: normalizeIndexWeights(row.index_weights),
    forecastConfig: normalizeForecastConfig(row.forecast_config),
    seasonModifiers: asRecord(row.season_modifiers) as SportMarketIndexConfig["seasonModifiers"],
    riskThresholds: normalizeRiskThresholds(row.risk_thresholds),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

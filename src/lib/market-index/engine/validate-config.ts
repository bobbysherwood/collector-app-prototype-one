import type {
  SportForecastConfig,
  SportIndexWeights,
  SportMarketIndexConfig,
  SportRiskThresholds,
} from "@/types/market-index";

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

function validateWeightMap(
  label: string,
  weights: Record<string, number> | undefined
): string[] {
  if (!weights || Object.keys(weights).length === 0) {
    return [`${label} weights are missing or empty.`];
  }

  const errors: string[] = [];
  for (const [key, weight] of Object.entries(weights)) {
    if (!Number.isFinite(weight)) {
      errors.push(`${label} weight for "${key}" is not a number.`);
    }
  }
  return errors;
}

export function validateIndexWeights(weights: SportIndexWeights): string[] {
  return [
    ...validateWeightMap("Health", weights.health),
    ...validateWeightMap("Momentum", weights.momentum),
    ...(weights.outlook_blend
      ? []
      : ["Outlook blend weights are missing."]),
  ];
}

export function validateSportMarketIndexConfig(
  config: SportMarketIndexConfig
): ConfigValidationResult {
  const errors: string[] = [];

  if (!config.id.trim()) errors.push("Sport id is required.");
  if (!config.name.trim()) errors.push("Sport name is required.");
  errors.push(...validateIndexWeights(config.indexWeights));

  const enabled = config.providerConfig?.enabledProviders ?? [];
  if (enabled.length === 0) {
    errors.push("At least one provider must be enabled.");
  }

  return { valid: errors.length === 0, errors };
}

export function getOutlookBlend(config: SportMarketIndexConfig) {
  return config.indexWeights.outlook_blend;
}

export function getForecastRules(config: SportMarketIndexConfig) {
  const forecast = config.forecastConfig as SportForecastConfig;
  return {
    leadingFeatures: forecast.leadingIndicatorFeatures ?? [],
    coefficients: forecast.rulesCoefficients ?? {},
    ensemble: forecast.ensembleWeights ?? { rules: 1, ridge: 0, gbm: 0 },
  };
}

export function getRiskThresholds(
  config: SportMarketIndexConfig
): Required<SportRiskThresholds> {
  return {
    lowConfidenceMin: config.riskThresholds.lowConfidenceMin ?? 75,
    mediumConfidenceMin: config.riskThresholds.mediumConfidenceMin ?? 50,
    highSupplyHeadwindCount: config.riskThresholds.highSupplyHeadwindCount ?? 2,
  };
}

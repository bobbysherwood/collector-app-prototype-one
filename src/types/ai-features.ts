export interface AiFeatureSettings {
  portfolioInsightsEnabled: boolean;
  marketResearchEnabled: boolean;
}

export type UserFeatureSettingsMap = Record<string, AiFeatureSettings>;

export const DEFAULT_AI_FEATURE_SETTINGS: AiFeatureSettings = {
  portfolioInsightsEnabled: true,
  marketResearchEnabled: true,
};

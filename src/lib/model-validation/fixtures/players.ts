import { buildPlayerOpportunityContextSync } from "@/lib/player-opportunity/build-player-context";
import { VALIDATION_AS_OF } from "@/lib/model-validation/config";
import {
  makeAsset,
  makeCatalyst,
  makeDemand,
  makeQuality,
} from "@/lib/model-validation/fixtures/builders";
import { markets } from "@/lib/model-validation/fixtures/markets";
import type { PlayerOpportunityContext } from "@/types/player-opportunity";

export function youngSuperstarContext(): PlayerOpportunityContext {
  return buildPlayerOpportunityContextSync(
    makeAsset({
      id: "young-superstar",
      player_name: "Anthony Edwards",
      year: 2024,
      card_type: "Panini Prizm Rookie",
    }),
    {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.bull,
      qualitySignals: makeQuality({
        careerStrength: 88,
        legacyStrength: 62,
        culturalRelevance: 80,
        injuryRisk: 12,
      }),
      demandSignals: makeDemand({
        attentionScore: 82,
        sentimentScore: 78,
        searchInterestScore: 84,
        discussionGrowthScore: 80,
      }),
    }
  );
}

export function establishedSuperstarContext(): PlayerOpportunityContext {
  return buildPlayerOpportunityContextSync(
    makeAsset({
      id: "established-superstar",
      player_name: "Jayson Tatum",
      year: 2017,
      card_type: "Panini Prizm Base",
    }),
    {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.neutral,
      qualitySignals: makeQuality({
        careerStrength: 90,
        legacyStrength: 78,
        culturalRelevance: 82,
        injuryRisk: 18,
      }),
      demandSignals: makeDemand({
        attentionScore: 68,
        sentimentScore: 66,
        searchInterestScore: 64,
        discussionGrowthScore: 52,
      }),
    }
  );
}

export function breakoutYoungContext(): PlayerOpportunityContext {
  return buildPlayerOpportunityContextSync(
    makeAsset({
      id: "breakout-young",
      player_name: "Paolo Banchero",
      year: 2024,
      card_type: "Panini Select Rookie",
    }),
    {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.bull,
      qualitySignals: makeQuality({
        careerStrength: 74,
        legacyStrength: 48,
        culturalRelevance: 70,
        injuryRisk: 20,
        availableFieldCount: 3,
      }),
      demandSignals: makeDemand({
        attentionScore: 76,
        sentimentScore: 72,
        searchInterestScore: 78,
        discussionGrowthScore: 82,
        sourceCount: 3,
      }),
    }
  );
}

export function hypedProspectContext(): PlayerOpportunityContext {
  return buildPlayerOpportunityContextSync(
    makeAsset({
      id: "hyped-prospect",
      player_name: "Cooper Flagg",
      year: 2025,
      card_type: "Panini Prizm Rookie",
    }),
    {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.neutral,
      qualitySignals: makeQuality({
        careerStrength: 42,
        legacyStrength: 20,
        culturalRelevance: 75,
        injuryRisk: 25,
        availableFieldCount: 2,
      }),
      demandSignals: makeDemand({
        attentionScore: 92,
        sentimentScore: 70,
        searchInterestScore: 90,
        discussionGrowthScore: 88,
        sourceCount: 2,
      }),
    }
  );
}

export function agingSuperstarContext(): PlayerOpportunityContext {
  return buildPlayerOpportunityContextSync(
    makeAsset({
      id: "aging-superstar",
      player_name: "Chris Paul",
      year: 2008,
      card_type: "Upper Deck Base",
    }),
    {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.neutral,
      qualitySignals: makeQuality({
        careerStrength: 86,
        legacyStrength: 88,
        culturalRelevance: 80,
        injuryRisk: 72,
      }),
      demandSignals: makeDemand({
        attentionScore: 28,
        sentimentScore: 30,
        searchInterestScore: 26,
        discussionGrowthScore: 18,
      }),
    }
  );
}

export function healthySuperstarContext(): PlayerOpportunityContext {
  return buildPlayerOpportunityContextSync(
    makeAsset({
      id: "injury-pair",
      player_name: "Luka Doncic",
      year: 2018,
      card_type: "Panini Prizm Base",
    }),
    {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.bull,
      qualitySignals: makeQuality({
        careerStrength: 92,
        legacyStrength: 76,
        culturalRelevance: 86,
        injuryRisk: 10,
      }),
      demandSignals: makeDemand({
        attentionScore: 80,
        sentimentScore: 76,
        searchInterestScore: 78,
        discussionGrowthScore: 70,
      }),
    }
  );
}

export function injuredSuperstarContext(): PlayerOpportunityContext {
  const healthy = healthySuperstarContext();
  return {
    ...healthy,
    qualitySignals: {
      ...healthy.qualitySignals!,
      injuryRisk: 85,
    },
  };
}

export function retiredGreatContext(): PlayerOpportunityContext {
  return buildPlayerOpportunityContextSync(
    makeAsset({
      id: "retired-great",
      player_name: "Michael Jordan",
      year: 1986,
      card_type: "Fleer Rookie",
    }),
    {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.neutral,
      qualitySignals: makeQuality({
        careerStrength: 98,
        legacyStrength: 99,
        culturalRelevance: 97,
        injuryRisk: 0,
      }),
      demandSignals: makeDemand({
        attentionScore: 74,
        sentimentScore: 80,
        searchInterestScore: 72,
        discussionGrowthScore: 50,
      }),
    }
  );
}

export function deceasedIconContext(): PlayerOpportunityContext {
  return buildPlayerOpportunityContextSync(
    makeAsset({
      id: "deceased-icon",
      player_name: "Kobe Bryant",
      year: 1996,
      card_type: "Topps Chrome Rookie",
    }),
    {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.neutral,
      qualitySignals: makeQuality({
        careerStrength: 96,
        legacyStrength: 98,
        culturalRelevance: 99,
        injuryRisk: 0,
      }),
      demandSignals: makeDemand({
        attentionScore: 78,
        sentimentScore: 84,
        searchInterestScore: 76,
        discussionGrowthScore: 48,
      }),
    }
  );
}

export function averageVeteranContext(): PlayerOpportunityContext {
  return buildPlayerOpportunityContextSync(
    makeAsset({
      id: "average-veteran",
      player_name: "Role Player Smith",
      year: 2016,
      card_type: "Panini Hoops Base",
    }),
    {
      asOf: VALIDATION_AS_OF,
      sportMarketOverride: markets.neutral,
      qualitySignals: makeQuality({
        careerStrength: 48,
        legacyStrength: 40,
        culturalRelevance: 42,
        injuryRisk: 22,
      }),
      demandSignals: makeDemand({
        attentionScore: 38,
        sentimentScore: 45,
        searchInterestScore: 36,
        discussionGrowthScore: 40,
      }),
    }
  );
}

export function negativeSentimentContext(): PlayerOpportunityContext {
  const base = averageVeteranContext();
  return {
    ...base,
    playerId: "negative-sentiment",
    demandSignals: {
      ...base.demandSignals!,
      sentimentScore: 15,
      attentionScore: 70,
      searchInterestScore: 28,
      discussionGrowthScore: 22,
    },
    catalysts: [
      makeCatalyst({
        id: "negative-press",
        label: "Negative public sentiment",
        type: "sentiment",
        direction: "negative",
        expectedImpact: "negative",
        expectedMagnitude: 8,
      }),
    ],
  };
}

export const playerFixtures = {
  youngSuperstar: youngSuperstarContext,
  establishedSuperstar: establishedSuperstarContext,
  breakoutYoung: breakoutYoungContext,
  hypedProspect: hypedProspectContext,
  agingSuperstar: agingSuperstarContext,
  healthySuperstar: healthySuperstarContext,
  injuredSuperstar: injuredSuperstarContext,
  retiredGreat: retiredGreatContext,
  deceasedIcon: deceasedIconContext,
  averageVeteran: averageVeteranContext,
  negativeSentiment: negativeSentimentContext,
};

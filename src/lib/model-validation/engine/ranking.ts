import { buildCardInvestmentContextSync } from "@/lib/card-investment/build-card-context";
import { VALIDATION_AS_OF } from "@/lib/model-validation/config";
import { makeAsset, makeQuality, makeDemand, makeSalesAround } from "@/lib/model-validation/fixtures/builders";
import { markets } from "@/lib/model-validation/fixtures/markets";
import { computePlayerCardOpportunity } from "@/lib/player-card-opportunity/player-card-opportunity-model";
import { buildPlayerOpportunityContextSync } from "@/lib/player-opportunity/build-player-context";
import type { PlayerCardOpportunity } from "@/types/player-opportunity";

export interface RankedCard {
  id: string;
  label: string;
  playerTier: "star" | "good" | "average" | "weak";
  valuation: "undervalued" | "fair" | "overpriced" | "extreme_overpriced";
  scarcity: "numbered" | "base";
  opportunity: PlayerCardOpportunity;
}

const PLAYERS: Array<{
  name: string;
  year: number;
  tier: RankedCard["playerTier"];
  quality: number;
  demand: number;
}> = [
  { name: "Jayson Tatum", year: 2017, tier: "star", quality: 88, demand: 72 },
  { name: "Anthony Edwards", year: 2024, tier: "star", quality: 82, demand: 80 },
  { name: "Paolo Banchero", year: 2024, tier: "good", quality: 70, demand: 74 },
  { name: "Role Player Smith", year: 2016, tier: "average", quality: 46, demand: 40 },
  { name: "Bench Guard Jones", year: 2015, tier: "weak", quality: 34, demand: 28 },
  { name: "Luka Doncic", year: 2018, tier: "star", quality: 90, demand: 76 },
  { name: "Role Forward Green", year: 2014, tier: "average", quality: 50, demand: 44 },
];

const VALUATIONS: Array<{ key: RankedCard["valuation"]; current: number; fair: number }> = [
  { key: "undervalued", current: 700, fair: 1000 },
  { key: "fair", current: 1010, fair: 1000 },
  { key: "overpriced", current: 1300, fair: 1000 },
  { key: "extreme_overpriced", current: 2000, fair: 1000 },
];

const SCARCITY: Array<{ key: RankedCard["scarcity"]; cardType: string; parallel: string | null }> = [
  { key: "numbered", cardType: "Panini Prizm Gold", parallel: "Gold /10" },
  { key: "base", cardType: "Panini Hoops Base", parallel: null },
];

export function buildRankingUniverse(asOf = VALIDATION_AS_OF): RankedCard[] {
  const cards: RankedCard[] = [];
  let index = 0;

  for (const player of PLAYERS) {
    for (const valuation of VALUATIONS) {
      for (const scarcity of SCARCITY) {
        index += 1;
        const id = `rank-${index}`;
        const asset = makeAsset({
          id,
          player_name: player.name,
          year: player.year,
          card_type: scarcity.cardType,
          insert_parallel: scarcity.parallel,
        });
        const playerContext = buildPlayerOpportunityContextSync(asset, {
          asOf,
          sportMarketOverride: markets.neutral,
          qualitySignals: makeQuality({
            careerStrength: player.quality,
            legacyStrength: player.quality - 6,
            culturalRelevance: player.quality - 4,
          }),
          demandSignals: makeDemand({
            attentionScore: player.demand,
            sentimentScore: player.demand,
            searchInterestScore: player.demand,
            discussionGrowthScore: player.demand - 8,
          }),
        });
        const cardContext = buildCardInvestmentContextSync(
          asset,
          makeSalesAround(valuation.current, valuation.fair, 6, asOf),
          { asOf, sportMarketOverride: markets.neutral }
        );
        cards.push({
          id,
          label: `${player.name} ${scarcity.key} ${valuation.key}`,
          playerTier: player.tier,
          valuation: valuation.key,
          scarcity: scarcity.key,
          opportunity: computePlayerCardOpportunity({ cardContext, playerContext }),
        });
      }
    }
  }

  return cards;
}

export function rankByOpportunity(cards: RankedCard[]): RankedCard[] {
  return [...cards].sort((a, b) => b.opportunity.opportunityScore - a.opportunity.opportunityScore);
}

export function spearmanCorrelation(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const rank = (values: number[]) => {
    const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
    const ranks = new Array<number>(values.length);
    sorted.forEach((entry, rankIndex) => {
      ranks[entry.index] = rankIndex + 1;
    });
    return ranks;
  };
  return pearson(rank(left), rank(right));
}

export function kendallTau(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < left.length; i += 1) {
    for (let j = i + 1; j < left.length; j += 1) {
      const signL = Math.sign(left[i] - left[j]);
      const signR = Math.sign(right[i] - right[j]);
      if (signL === 0 || signR === 0) continue;
      if (signL === signR) concordant += 1;
      else discordant += 1;
    }
  }
  const denom = concordant + discordant;
  return denom === 0 ? null : (concordant - discordant) / denom;
}

export function pearson(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const n = left.length;
  const meanL = left.reduce((sum, value) => sum + value, 0) / n;
  const meanR = right.reduce((sum, value) => sum + value, 0) / n;
  let num = 0;
  let denL = 0;
  let denR = 0;
  for (let i = 0; i < n; i += 1) {
    const dL = left[i] - meanL;
    const dR = right[i] - meanR;
    num += dL * dR;
    denL += dL * dL;
    denR += dR * dR;
  }
  const den = Math.sqrt(denL * denR);
  return den === 0 ? null : num / den;
}

export function topOverlap(a: string[], b: string[], n: number): number {
  const topA = new Set(a.slice(0, n));
  return b.slice(0, n).filter((id) => topA.has(id)).length / n;
}

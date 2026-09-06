import { getSportMarketIndex } from "@/app/actions/market-index";
import { getMarketResearchCardMarketData } from "@/app/actions/market-research";
import {
  getDm2CardById,
  getDm2PlayerById,
  listDm2CardsForPlayer,
  listDm2ComparableCandidates,
  searchDm2Cards,
  searchDm2Players,
} from "@/app/actions/data-model-v2";
import { sportMarketSnapshotFromResult } from "@/lib/card-investment/market/sport-market-client";
import {
  catalogCardFeaturesPlayer,
  formatCatalogCardLoadError,
  formatResearchCardName,
  isResearchPlayerUuid,
  playerHref,
  playerRecordHref,
} from "@/lib/market-research/catalog";
import { humanizeFeatureKey } from "@/types/market-index";
import { estimateMarketValue } from "@/lib/market-sales/estimate";
import { getDm2CardImageUrl, getDm2PlayerImageUrl } from "@/lib/images";
import {
  computeCatalogOpportunity,
  type ComputeCatalogOpportunityOptions,
} from "@/lib/market-research/compute-catalog-opportunity";
import {
  parseResearchPlayerSlug,
  resolveResearchSport,
  type ResearchSportDefinition,
} from "@/lib/market-research/catalog";
import { buildImpliedIndexSeries, buildPriceSeriesFromSales } from "@/lib/market-research/series";
import { scoreLabel } from "@/lib/market-research/signals";
import { buildPlayerOpportunityContextFromIdentity } from "@/lib/player-opportunity/build-player-context";
import { computePlayerOpportunity } from "@/lib/player-opportunity/player-opportunity-model";
import { loadPlayerNews } from "@/lib/player-news/provider";
import type { PlayerNewsSnapshot } from "@/lib/player-news/types";
import { buildPlayerMarketTrends } from "@/lib/market-research/player-market-trends";
import type { PlayerMarketTrends } from "@/lib/market-research/player-market-trends";
import {
  buildSubjectComparableProfile,
  COMPARABLE_CANDIDATE_LIMIT,
  COMPARABLE_RESULT_LIMIT,
  rankPlayerComparables,
  type PlayerComparablePreview,
} from "@/lib/market-research/player-comparables";
import {
  applyNewsInjuryToQuality,
  catalystsFromNews,
  demandSignalsFromNews,
  newsCanScore,
} from "@/lib/player-news/demand";
import { updateDm2PlayerEmptyProfileFields } from "@/lib/data-model-v2-data";
import { liveStatsCanScore } from "@/lib/player-stats/derive";
import {
  buildEmptyProfilePatch,
  profilePatchToDbRow,
} from "@/lib/player-stats/persist-profile";
import { loadPlayerLiveStats } from "@/lib/player-stats/provider";
import type { PlayerLiveStatsSnapshot } from "@/lib/player-stats/types";
import type { Dm2CardSearchResult, Dm2Player } from "@/types/data-model-v2";
import type { MarketListing, MarketSale } from "@/types/market-sales";
import type { SportMarketIndexResult } from "@/types/market-index";
import type { SportMarketSnapshot } from "@/types/card-investment";
import type {
  PlayerCardOpportunity,
  PlayerOpportunity,
} from "@/types/player-opportunity";

export interface ResearchCardPreview {
  id: string;
  name: string;
  player: string;
  sportLabel: string;
  imageUrl: string | null;
  opportunityScore: number | null;
  estimatedValue: number | null;
  href: string;
}

export interface ResearchPlayerPreview {
  playerName: string;
  sportLabel: string;
  imageUrl: string | null;
  opportunityScore: number;
  change90d: number;
  href: string;
}

export interface ResearchDriver {
  key: string;
  label: string;
  score: number;
  signal: string;
  explanation?: string;
}

export interface SportMarketPageData {
  sport: ResearchSportDefinition;
  index: SportMarketIndexResult | null;
  indexError?: string;
  fromCache: boolean;
  indexSeries: ReturnType<typeof buildImpliedIndexSeries>;
  forecastSeries: ReturnType<typeof buildImpliedIndexSeries>;
  drivers: ResearchDriver[];
  risingPlayers: ResearchPlayerPreview[];
  topCards: ResearchCardPreview[];
  salesActivity: {
    saleCount: number;
    volume: number;
    saleCountChangePct: number | null;
    volumeChangePct: number | null;
    sourceNote: string;
  } | null;
}

export interface PlayerResearchPageData {
  playerId: string | null;
  playerName: string;
  sportLabel: string;
  sportSlug: string;
  imageUrl: string | null;
  cardCount: number;
  playerOpportunity: PlayerOpportunity | null;
  opportunitySeries: ReturnType<typeof buildImpliedIndexSeries>;
  topCards: ResearchCardPreview[];
  catalogCards: ResearchCardPreview[];
  cardsError?: string;
  thesis: string | null;
  liveStats: PlayerLiveStatsSnapshot | null;
  news: PlayerNewsSnapshot;
  marketTrends: PlayerMarketTrends;
  comparables: PlayerComparablePreview[];
}

export interface CardResearchPageData {
  card: Dm2CardSearchResult;
  title: string;
  imageUrl: string | null;
  sportSlug: string;
  playerHref: string;
  marketHref: string;
  playerOpportunity: PlayerOpportunity | null;
  cardOpportunity: PlayerCardOpportunity | null;
  sales: MarketSale[];
  listings: MarketListing[];
  listingsAsOf: string | null;
  listingsError?: string;
  priceSeries: ReturnType<typeof buildPriceSeriesFromSales>;
  lastSale: MarketSale | null;
  estimatedValue: number | null;
  listingStats: {
    count: number;
    min: number | null;
    max: number | null;
    average: number | null;
  };
}

const PLAYER_CATALOG_PAGE_SIZE = 100;
const PLAYER_CATALOG_MAX_CARDS = 2000;
const PLAYER_CATALOG_SCORE_LIMIT = 80;

function previewFromCard(
  card: Dm2CardSearchResult,
  opportunityScore: number | null,
  estimatedValue: number | null
): ResearchCardPreview {
  return {
    id: card.id,
    name: formatResearchCardName(card),
    player: card.player,
    sportLabel: card.sportName,
    imageUrl: getDm2CardImageUrl(card.imagePath),
    opportunityScore,
    estimatedValue,
    href: `/market-research/cards/${card.id}`,
  };
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const next: T[] = [];
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(item);
  }
  return next;
}

function buildDrivers(index: SportMarketIndexResult | null): ResearchDriver[] {
  if (!index) return [];

  const fromDrivers = [...index.positiveDrivers, ...index.negativeDrivers]
    .map((driver) => {
      const score = Math.round(
        Math.min(100, Math.max(0, 50 + driver.impactPoints * 4))
      );
      return {
        key: driver.featureKey,
        label: driver.label || humanizeFeatureKey(driver.featureKey),
        score,
        signal: scoreLabel(score),
        explanation:
          driver.deltaPct != null
            ? `${driver.deltaPct > 0 ? "+" : ""}${driver.deltaPct.toFixed(1)}% recent change`
            : undefined,
      };
    })
    .filter((driver) => driver.score > 0 || driver.explanation);

  const features = index.featureSnapshot?.values ?? {};
  const extras: ResearchDriver[] = [];
  const pushFeature = (key: string, label: string) => {
    if (fromDrivers.some((item) => item.key === key)) return;
    const raw = features[key];
    if (raw == null || raw === 0) return;
    const score = Math.round(
      Math.min(100, Math.max(0, raw <= 1 ? raw * 100 : raw > 100 ? 50 : raw))
    );
    extras.push({
      key,
      label,
      score,
      signal: scoreLabel(score),
    });
  };

  pushFeature("sentiment.composite.score", "Media Exposure");
  pushFeature("market.ebay.liquidity_index", "Market Liquidity");
  pushFeature("supply.product.release_pressure", "Supply Growth");
  pushFeature("supply.sealed.inventory_proxy", "Sealed Supply");

  return uniqueBy([...fromDrivers, ...extras], (item) => item.key).slice(0, 6);
}

async function scoreCatalogCards(
  cards: Dm2CardSearchResult[],
  sportMarket = sportMarketSnapshotFromResult(null),
  playerSignals?: ComputeCatalogOpportunityOptions
) {
  const scored: Array<{
    card: Dm2CardSearchResult;
    playerOpportunity: PlayerOpportunity;
    cardOpportunity: PlayerCardOpportunity;
  }> = [];

  for (const card of cards) {
    try {
      const result = await computeCatalogOpportunity(
        card,
        sportMarket,
        playerSignals
      );
      scored.push({ card, ...result });
    } catch {
      // Skip cards the models cannot score.
    }
  }

  return scored;
}

async function listAllDm2CardsForPlayer(playerId: string): Promise<{
  cards: Dm2CardSearchResult[];
  totalCount: number;
  error?: string;
}> {
  const first = await listDm2CardsForPlayer(playerId, {
    page: 1,
    pageSize: PLAYER_CATALOG_PAGE_SIZE,
  });
  if (first.error) {
    return {
      cards: [],
      totalCount: 0,
      error: formatCatalogCardLoadError(first.error),
    };
  }

  const cards = [...(first.cards ?? [])];
  const totalCount = first.totalCount ?? cards.length;
  const pageCount = Math.min(
    Math.ceil(totalCount / PLAYER_CATALOG_PAGE_SIZE) || 1,
    Math.ceil(PLAYER_CATALOG_MAX_CARDS / PLAYER_CATALOG_PAGE_SIZE)
  );

  for (let page = 2; page <= pageCount && cards.length < PLAYER_CATALOG_MAX_CARDS; page++) {
    const next = await listDm2CardsForPlayer(playerId, {
      page,
      pageSize: PLAYER_CATALOG_PAGE_SIZE,
    });
    if (next.error) {
      return {
        cards: uniqueBy(cards, (card) => card.id).slice(0, PLAYER_CATALOG_MAX_CARDS),
        totalCount,
        error: formatCatalogCardLoadError(next.error),
      };
    }
    if (!next.cards?.length) break;
    cards.push(...next.cards);
  }

  return {
    cards: uniqueBy(cards, (card) => card.id).slice(0, PLAYER_CATALOG_MAX_CARDS),
    totalCount,
  };
}

function cardListsFromCatalog(
  usable: Dm2CardSearchResult[],
  scored: Array<{
    card: Dm2CardSearchResult;
    cardOpportunity: PlayerCardOpportunity;
  }>
): { topCards: ResearchCardPreview[]; catalogCards: ResearchCardPreview[] } {
  const scoredById = new Map(scored.map((item) => [item.card.id, item]));
  const catalogCards = usable.map((card) => {
    const hit = scoredById.get(card.id);
    return previewFromCard(
      card,
      hit?.cardOpportunity.opportunityScore ?? null,
      hit?.cardOpportunity.currentMarketValue ?? null
    );
  });
  const topCards = catalogCards
    .filter((card) => card.opportunityScore != null)
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
    .slice(0, 6);
  return { topCards, catalogCards };
}

export async function loadSportMarketPage(
  slug: string
): Promise<SportMarketPageData | null> {
  const sport = resolveResearchSport(slug);
  if (!sport) return null;

  let index: SportMarketIndexResult | null = null;
  let indexError: string | undefined;
  let fromCache = false;

  if (sport.indexId) {
    const response = await getSportMarketIndex(sport.indexId);
    index = response.result ?? null;
    indexError = response.error;
    fromCache = Boolean(response.fromCache);
  }

  const sportMarket = sportMarketSnapshotFromResult(index);
  const catalog = await searchDm2Cards(sport.sportLabel, { pageSize: 24 });
  const cards = catalog.cards ?? [];
  const scored = await scoreCatalogCards(cards, sportMarket);

  const risingPlayers = uniqueBy(
    scored.map((item) => ({
      playerName: item.card.player,
      sportLabel: item.card.sportName,
      imageUrl: getDm2CardImageUrl(item.card.imagePath),
      opportunityScore: item.playerOpportunity.opportunityScore,
      change90d: item.playerOpportunity.expectedDemandChange90d,
      href: `/market-research/players/${item.playerOpportunity.playerId}`,
    })),
    (item) => item.href
  )
    .sort((a, b) => b.change90d - a.change90d || b.opportunityScore - a.opportunityScore)
    .slice(0, 6);

  const topCards = scored
    .slice()
    .sort((a, b) => b.cardOpportunity.opportunityScore - a.cardOpportunity.opportunityScore)
    .slice(0, 6)
    .map((item) =>
      previewFromCard(
        item.card,
        item.cardOpportunity.opportunityScore,
        item.cardOpportunity.currentMarketValue
      )
    );

  const volume = scored.reduce(
    (sum, item) => sum + (item.cardOpportunity.currentMarketValue || 0),
    0
  );

  const momentumDelta = index?.featureSnapshot?.deltas30dPct["market.ebay.dollar_volume"];
  const countDelta = index?.featureSnapshot?.deltas30dPct["market.ebay.transaction_count"];
  const ebayVolume = index?.featureSnapshot?.values["market.ebay.dollar_volume"];
  const ebayCount = index?.featureSnapshot?.values["market.ebay.transaction_count"];

  const prior30d =
    index && index.featureSnapshot?.deltas30dPct
      ? Object.values(index.featureSnapshot.deltas30dPct).find(
          (value) => value != null && Number.isFinite(value)
        )
      : null;
  const impliedPrior =
    index && prior30d != null
      ? index.healthScore / (1 + prior30d / 100)
      : index
        ? index.healthScore - index.momentumScore * 0.08
        : null;

  return {
    sport,
    index,
    indexError,
    fromCache,
    indexSeries: index
      ? buildImpliedIndexSeries({
          asOf: index.asOf,
          current: index.healthScore,
          prior30d: impliedPrior,
          forecast90dPct: index.forecast3mPct,
        })
      : [],
    forecastSeries: index
      ? buildImpliedIndexSeries({
          asOf: index.asOf,
          current: index.healthScore,
          forecast90dPct: index.forecast3mPct,
        })
      : [],
    drivers: buildDrivers(index),
    risingPlayers,
    topCards,
    salesActivity:
      ebayCount != null || scored.length > 0
        ? {
            saleCount: Math.round(ebayCount ?? scored.length),
            volume: ebayVolume != null && ebayVolume > 1000 ? ebayVolume : volume,
            saleCountChangePct: countDelta ?? null,
            volumeChangePct: momentumDelta ?? index?.forecast3mPct ?? null,
            sourceNote:
              ebayVolume != null && ebayVolume > 1000
                ? "From Sport Market Index eBay market features"
                : scored.length > 0
                  ? "Aggregated from catalog card opportunity valuations"
                  : "Sport Market Index eBay features are present but not dollar-denominated",
          }
        : null,
  };
}

function playerSignalsFromPublicData(
  liveStats: PlayerLiveStatsSnapshot | null,
  news: PlayerNewsSnapshot | null
): ComputeCatalogOpportunityOptions | undefined {
  const catalysts = catalystsFromNews(news);
  const demand = demandSignalsFromNews(news);
  const hasLive = Boolean(liveStats && liveStatsCanScore(liveStats));
  const hasNews = demand.sourceCount > 0 || catalysts.length > 0;
  if (!hasLive && !hasNews) return undefined;

  return {
    qualitySignals: applyNewsInjuryToQuality(
      liveStats && liveStatsCanScore(liveStats)
        ? liveStats.qualitySignals
        : undefined,
      catalysts
    ),
    playerProfile: liveStats?.playerProfile,
    demandSignals: demand.sourceCount > 0 ? demand : undefined,
    catalysts: catalysts.length > 0 ? catalysts : undefined,
  };
}

async function loadSportIndex(sport: ResearchSportDefinition | null) {
  if (!sport?.indexId) {
    return { index: null as SportMarketIndexResult | null, sportMarket: null };
  }
  const response = await getSportMarketIndex(sport.indexId);
  const index = response.result ?? null;
  return { index, sportMarket: sportMarketSnapshotFromResult(index) };
}

async function loadPlayerComparables(input: {
  playerId: string | null;
  playerName: string;
  sportId?: string | null;
  sportLabel: string;
  liveStats: PlayerLiveStatsSnapshot | null;
  playerOpportunity: PlayerOpportunity | null;
  catalogProfile?: {
    birthYear?: number | null;
    careerStatus?: PlayerOpportunity["lifecycle"] | null;
    team?: string | null;
  } | null;
}): Promise<PlayerComparablePreview[]> {
  const result = await listDm2ComparableCandidates({
    sportId: input.sportId,
    sportLabel: input.sportLabel,
    excludePlayerId: input.playerId,
    limit: COMPARABLE_CANDIDATE_LIMIT,
  });
  const candidates = result.players ?? [];
  if (candidates.length === 0) return [];

  const subject = buildSubjectComparableProfile(input);
  const images = new Map(
    candidates.map((player) => [player.id, getDm2PlayerImageUrl(player.imagePath)])
  );
  return rankPlayerComparables(
    subject,
    candidates.map((player) => ({
      playerId: player.id,
      playerName: player.name,
      sport: player.sportName || input.sportLabel,
      birthYear: player.birthYear,
      careerStatus: player.careerStatus,
      team: player.team,
      opportunityScore: null,
      cardCount: player.cardCount,
    })),
    COMPARABLE_RESULT_LIMIT
  ).flatMap((item) => {
    if (!item.playerId) return [];
    return [
      {
        playerId: item.playerId,
        playerName: item.playerName,
        sportLabel: item.sport,
        imageUrl: images.get(item.playerId) ?? null,
        href: playerRecordHref(item.playerId),
        matchScore: item.matchScore,
        reasons: item.reasons,
        cardCount: item.cardCount ?? 0,
      },
    ];
  });
}

async function loadPlayerPublicData(playerName: string, sportLabel: string) {
  const [liveStats, news] = await Promise.all([
    loadPlayerLiveStats({ playerName, sportLabel }),
    loadPlayerNews({ playerName, sportLabel }),
  ]);
  return { liveStats, news };
}

async function persistCatalogPlayerProfile(
  player: Dm2Player,
  liveStats: PlayerLiveStatsSnapshot | null
): Promise<void> {
  if (!liveStats?.persistEligible) return;
  const patch = buildEmptyProfilePatch(player, liveStats.playerProfile);
  if (!patch) return;
  const result = await updateDm2PlayerEmptyProfileFields(
    player.id,
    profilePatchToDbRow(patch)
  );
  if (result.error) {
    console.warn("Skipped catalog player profile write-through:", result.error);
  }
}

async function scorePlayerWithoutCatalogCard(input: {
  playerName: string;
  sportLabel: string;
  sportMarket: SportMarketSnapshot | null;
  liveStats: PlayerLiveStatsSnapshot | null;
  news?: PlayerNewsSnapshot | null;
}): Promise<PlayerOpportunity | null> {
  const catalysts = catalystsFromNews(input.news);
  const demand = demandSignalsFromNews(input.news);
  const hasLive = Boolean(input.liveStats && liveStatsCanScore(input.liveStats));
  if (!hasLive && !newsCanScore(input.news)) return null;

  return computePlayerOpportunity(
    buildPlayerOpportunityContextFromIdentity({
      playerName: input.playerName,
      sport: input.sportLabel,
      playerProfile: input.liveStats?.playerProfile,
      qualitySignals: applyNewsInjuryToQuality(
        hasLive ? input.liveStats?.qualitySignals : undefined,
        catalysts
      ),
      demandSignals: demand.sourceCount > 0 ? demand : undefined,
      catalysts: catalysts.length > 0 ? catalysts : undefined,
      sportMarket: input.sportMarket,
    })
  );
}

export async function loadPlayerResearchPage(
  slug: string
): Promise<PlayerResearchPageData | null> {
  if (isResearchPlayerUuid(slug)) {
    const result = await getDm2PlayerById(slug);
    if (result.error || !result.player) return null;

    const player = result.player;
    const catalog = await listAllDm2CardsForPlayer(player.id);
    const usable = catalog.cards;
    const sport = resolveResearchSport(player.sportName);
    const { index: sportIndex, sportMarket } = await loadSportIndex(sport);
    const { liveStats, news } = await loadPlayerPublicData(
      player.name,
      player.sportName
    );
    await persistCatalogPlayerProfile(player, liveStats);
    const scored = await scoreCatalogCards(
      usable.slice(0, PLAYER_CATALOG_SCORE_LIMIT),
      sportMarket,
      playerSignalsFromPublicData(liveStats, news)
    );
    const playerOpportunity =
      scored[0]?.playerOpportunity ??
      (await scorePlayerWithoutCatalogCard({
        playerName: player.name,
        sportLabel: player.sportName,
        sportMarket,
        liveStats,
        news,
      }));
    const { topCards, catalogCards } = cardListsFromCatalog(usable, scored);
    const sportSlug = sport?.slug ?? "nba";
    const marketTrends = await buildPlayerMarketTrends({
      cards: usable,
      playerOpportunity,
      sportIndex,
      sportSlug,
    });
    const comparables = await loadPlayerComparables({
      playerId: player.id,
      playerName: player.name,
      sportId: player.sportId,
      sportLabel: player.sportName,
      liveStats,
      playerOpportunity,
      catalogProfile: {
        birthYear: player.birthYear,
        careerStatus: player.careerStatus,
        team: player.team,
      },
    });

    return {
      playerId: player.id,
      playerName: player.name,
      sportLabel: player.sportName,
      sportSlug,
      imageUrl:
        getDm2PlayerImageUrl(player.imagePath) ??
        liveStats?.imageUrl ??
        getDm2CardImageUrl(usable[0]?.imagePath ?? null),
      cardCount: catalog.totalCount,
      playerOpportunity,
      opportunitySeries: marketTrends.opportunitySeries,
      topCards,
      catalogCards,
      cardsError: catalog.error,
      thesis: playerOpportunity?.summary ?? null,
      liveStats,
      news,
      marketTrends,
      comparables,
    };
  }

  const parsed = parseResearchPlayerSlug(slug);
  if (!parsed.playerName) return null;

  const matchedPlayer = await findCatalogPlayer(
    parsed.playerName,
    parsed.sportLabel
  );
  if (matchedPlayer) {
    return loadPlayerResearchPage(matchedPlayer.id);
  }

  const query = parsed.playerName;
  const catalog = await searchDm2Cards(query, { pageSize: 24 });
  const cardsError = catalog.error
    ? formatCatalogCardLoadError(catalog.error)
    : undefined;
  const cards = (catalog.cards ?? []).filter((card) => {
    if (!catalogCardFeaturesPlayer(card.player, parsed.playerName)) return false;
    if (!parsed.sportLabel) return true;
    return card.sportName.toLowerCase() === parsed.sportLabel.toLowerCase();
  });

  const usable = cards.length > 0 ? cards : catalog.cards ?? [];
  const sportLabel = parsed.sportLabel ?? usable[0]?.sportName ?? "Basketball";
  const sport = resolveResearchSport(sportLabel);
  const { index: sportIndex, sportMarket } = await loadSportIndex(sport);

  const { liveStats, news } = await loadPlayerPublicData(
    parsed.playerName,
    sportLabel
  );
  const scored = await scoreCatalogCards(
    usable.slice(0, PLAYER_CATALOG_SCORE_LIMIT),
    sportMarket,
    playerSignalsFromPublicData(liveStats, news)
  );
  const primary =
    scored.find((item) =>
      item.card.player.toLowerCase() === parsed.playerName.toLowerCase()
    ) ?? scored[0];
  const playerOpportunity =
    primary?.playerOpportunity ??
    (await scorePlayerWithoutCatalogCard({
      playerName: parsed.playerName,
      sportLabel,
      sportMarket,
      liveStats,
      news,
    }));
  const portraitCard =
    usable.find((card) => card.player.toLowerCase() === parsed.playerName.toLowerCase()) ??
    usable[0];
  const { topCards, catalogCards } = cardListsFromCatalog(usable, scored);
  const sportSlug = sport?.slug ?? "nba";
  const marketTrends = await buildPlayerMarketTrends({
    cards: usable,
    playerOpportunity,
    sportIndex,
    sportSlug,
  });
  const comparables = await loadPlayerComparables({
    playerId: null,
    playerName: parsed.playerName,
    sportLabel,
    liveStats,
    playerOpportunity,
  });

  return {
    playerId: null,
    playerName: parsed.playerName,
    sportLabel,
    sportSlug,
    imageUrl:
      liveStats?.imageUrl ??
      getDm2CardImageUrl(portraitCard?.imagePath ?? null),
    cardCount: catalog.totalCount ?? usable.length,
    playerOpportunity,
    opportunitySeries: marketTrends.opportunitySeries,
    topCards,
    catalogCards,
    cardsError,
    thesis: playerOpportunity?.summary ?? null,
    liveStats,
    news,
    marketTrends,
    comparables,
  };
}

async function findCatalogPlayer(playerName: string, sportLabel?: string) {
  const result = await searchDm2Players(playerName);
  const matches = result.players ?? [];
  const exact = matches.filter(
    (player) => player.player.toLowerCase() === playerName.toLowerCase()
  );
  const pool = exact.length > 0 ? exact : matches;
  if (!sportLabel) return pool[0] ?? null;
  const sport = resolveResearchSport(sportLabel);
  return (
    pool.find((player) => {
      const playerSport = resolveResearchSport(player.sport);
      return (
        player.sport.toLowerCase() === sportLabel.toLowerCase() ||
        playerSport?.slug === sport?.slug
      );
    }) ?? null
  );
}

export async function loadCardResearchPage(
  cardId: string
): Promise<CardResearchPageData | null> {
  const result = await getDm2CardById(cardId);
  if (result.error || !result.card) return null;

  const card = result.card;
  const market = await getMarketResearchCardMarketData(card);
  const sport = resolveResearchSport(card.sportName);
  const sportMarket = sport?.indexId
    ? sportMarketSnapshotFromResult(
        (await getSportMarketIndex(sport.indexId)).result ?? null
      )
    : null;

  let playerOpportunity: PlayerOpportunity | null = null;
  let cardOpportunity: PlayerCardOpportunity | null = null;
  try {
    const scored = await computeCatalogOpportunity(card, sportMarket);
    playerOpportunity = scored.playerOpportunity;
    cardOpportunity = scored.cardOpportunity;
  } catch {
    playerOpportunity = null;
    cardOpportunity = null;
  }

  const forecastDate = new Date();
  forecastDate.setDate(forecastDate.getDate() + 90);

  return {
    card,
    title: formatResearchCardName(card),
    imageUrl: getDm2CardImageUrl(card.imagePath),
    sportSlug: sport?.slug ?? "nba",
    playerHref: playerHref(card.player, card.sportName),
    marketHref: `/market-research/markets/${sport?.slug ?? "nba"}`,
    playerOpportunity,
    cardOpportunity,
    sales: market.marketSales.sales,
    listings: market.ebayListings,
    listingsAsOf: market.listingsAsOf,
    listingsError: market.listingsError,
    priceSeries: buildPriceSeriesFromSales(
      market.marketSales.sales,
      cardOpportunity
        ? {
            date: forecastDate.toISOString(),
            value: cardOpportunity.expectedValue90d,
          }
        : undefined
    ),
    lastSale:
      [...market.marketSales.sales].sort((a, b) =>
        b.sale_date.localeCompare(a.sale_date)
      )[0] ?? null,
    estimatedValue:
      cardOpportunity?.currentMarketValue ??
      estimateMarketValue(market.marketSales.sales).value,
    listingStats: {
      count: market.ebayListings.length,
      min:
        market.ebayListings.length > 0
          ? Math.min(...market.ebayListings.map((item) => item.price))
          : null,
      max:
        market.ebayListings.length > 0
          ? Math.max(...market.ebayListings.map((item) => item.price))
          : null,
      average:
        market.ebayListings.length > 0
          ? market.ebayListings.reduce((sum, item) => sum + item.price, 0) /
            market.ebayListings.length
          : null,
    },
  };
}

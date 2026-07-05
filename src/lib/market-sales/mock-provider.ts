import type { Asset, Lot } from "@/types/asset";
import type {
  MarketSale,
  MarketSaleMatchConfidence,
  MarketSaleSource,
  MarketSaleType,
  MarketSalesResult,
} from "@/types/market-sales";
import { cardTitle, gradeLabel } from "@/types/card";
import { buildMarketSalesSummary } from "@/lib/market-sales/summary";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function pickGradeFromLots(lots: Lot[], index: number): {
  grader: Lot["grader"];
  grade: string | null;
  confidence: MarketSaleMatchConfidence;
} {
  const heldLots = lots.filter((lot) => lot.quantity_remaining > 0);
  const pool = heldLots.length > 0 ? heldLots : lots;
  if (pool.length === 0) {
    return { grader: "PSA", grade: "10", confidence: "medium" };
  }
  const lot = pool[index % pool.length];
  return {
    grader: lot.grader,
    grade: lot.grade,
    confidence: index % 3 === 0 ? "high" : index % 3 === 1 ? "medium" : "low",
  };
}

/**
 * Deterministic mock comps for UI development. Replace with real providers later.
 */
export function getMockMarketSales(
  asset: Asset,
  lots: Lot[] = []
): MarketSalesResult {
  const seed = hashString(asset.id);
  const basePrice = 80 + (seed % 400);
  const title = cardTitle(asset);
  const parallelSuffix = asset.insert_parallel ? ` ${asset.insert_parallel}` : "";

  const templates: {
    source: MarketSaleSource;
    sale_type: MarketSaleType;
    daysAgo: number;
    priceFactor: number;
    premium?: number;
  }[] = [
    { source: "ebay", sale_type: "auction", daysAgo: 4, priceFactor: 1.05 },
    { source: "ebay", sale_type: "buy_it_now", daysAgo: 11, priceFactor: 1.12 },
    { source: "fanatics_collect", sale_type: "auction", daysAgo: 18, priceFactor: 1.18, premium: 15 },
    { source: "ebay", sale_type: "best_offer", daysAgo: 26, priceFactor: 0.97 },
    { source: "fanatics_collect", sale_type: "buy_it_now", daysAgo: 33, priceFactor: 1.08, premium: 0 },
    { source: "ebay", sale_type: "auction", daysAgo: 41, priceFactor: 1.02 },
    { source: "fanatics_collect", sale_type: "auction", daysAgo: 52, priceFactor: 1.22, premium: 15 },
    { source: "ebay", sale_type: "buy_it_now", daysAgo: 64, priceFactor: 0.94 },
    { source: "ebay", sale_type: "auction", daysAgo: 78, priceFactor: 1.15 },
    { source: "fanatics_collect", sale_type: "auction", daysAgo: 89, priceFactor: 1.1, premium: 15 },
  ];

  const sales: MarketSale[] = templates.map((template, index) => {
    const gradeInfo = pickGradeFromLots(lots, index);
    const hammer = Math.round(basePrice * template.priceFactor * 100) / 100;
    const premium = template.premium ?? 0;
    const salePrice =
      premium > 0
        ? Math.round(hammer * (1 + premium / 100) * 100) / 100
        : hammer;

    const listingId = `${seed}-${index}`;
    const listingUrl =
      template.source === "ebay"
        ? `https://www.ebay.com/itm/${listingId}`
        : `https://www.fanaticscollect.com/lot/${listingId}`;

    return {
      id: `mock-${asset.id}-${index}`,
      source: template.source,
      title: `${title}${parallelSuffix} ${gradeLabel({
        grader: gradeInfo.grader,
        grade: gradeInfo.grade,
        cert_number: null,
      })}`,
      grader: gradeInfo.grader,
      grade: gradeInfo.grade,
      sale_price: salePrice,
      hammer_price: premium > 0 ? hammer : null,
      buyers_premium_pct: premium > 0 ? premium : null,
      currency: "USD",
      sale_date: daysAgo(template.daysAgo),
      sale_type: template.sale_type,
      listing_url: listingUrl,
      match_confidence: gradeInfo.confidence,
    };
  });

  return {
    sales: sales.sort((a, b) => b.sale_date.localeCompare(a.sale_date)),
    summary: buildMarketSalesSummary(sales),
    as_of: null,
  };
}

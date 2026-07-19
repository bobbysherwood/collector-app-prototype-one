import type { Asset } from "@/types/asset";

const SPORTS_TRADING_CARD_SINGLES = "261328";
const CCG_INDIVIDUAL_CARDS = "183454";

export interface EbayListingSearchQuery {
  q: string;
  categoryIds: string;
  filter: string;
  sort: string;
  limit: number;
}

export function buildEbayListingSearchQuery(asset: Asset): EbayListingSearchQuery {
  const terms = [
    String(asset.year),
    asset.card_type.trim(),
    asset.player_name.trim(),
  ];

  if (asset.insert_parallel?.trim()) {
    terms.push(asset.insert_parallel.trim());
  }

  if (asset.card_number?.trim()) {
    terms.push(`#${asset.card_number.trim()}`);
  }

  return {
    q: terms.filter(Boolean).join(" "),
    categoryIds:
      asset.sport === "Pokemon" ? CCG_INDIVIDUAL_CARDS : SPORTS_TRADING_CARD_SINGLES,
    filter: "buyingOptions:{AUCTION|FIXED_PRICE}",
    sort: "endingSoonest",
    limit: 50,
  };
}

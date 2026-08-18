import type { IDataProvider } from "@/lib/market-index/providers/types";
import {
  emptyValidation,
  validProviderResult,
} from "@/lib/market-index/providers/types";

/** Phase 1 stub — returns neutral market features until sold-comps integration. */
export const ebayMarketProvider: IDataProvider = {
  slug: "ebay-market",

  validate() {
    return emptyValidation();
  },

  normalize() {
    return [];
  },

  async fetch(ctx) {
    const neutral = 50;
    return validProviderResult({
      success: false,
      dataPointCount: 0,
      error: "eBay market provider not yet integrated (Phase 2). Using neutral placeholders.",
      observations: [
        {
          featureKey: "market.ebay.transaction_count",
          featureCategory: "market",
          value: neutral,
          providerSlug: this.slug,
          metadata: { stub: true, sportId: ctx.sportId },
        },
        {
          featureKey: "market.ebay.dollar_volume",
          featureCategory: "market",
          value: neutral,
          providerSlug: this.slug,
          metadata: { stub: true },
        },
        {
          featureKey: "market.ebay.liquidity_index",
          featureCategory: "market",
          value: neutral,
          providerSlug: this.slug,
          metadata: { stub: true },
        },
        {
          featureKey: "supply.sealed.inventory_proxy",
          featureCategory: "supply",
          value: neutral,
          providerSlug: this.slug,
          metadata: { stub: true },
        },
      ],
    });
  },
};

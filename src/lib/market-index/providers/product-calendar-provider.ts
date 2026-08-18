import type { IDataProvider } from "@/lib/market-index/providers/types";
import {
  emptyValidation,
  validProviderResult,
} from "@/lib/market-index/providers/types";

/** Static release calendar proxy for V1. */
export const productCalendarProvider: IDataProvider = {
  slug: "product-calendar",

  validate() {
    return emptyValidation();
  },

  normalize() {
    return [];
  },

  async fetch(ctx) {
    const month = ctx.asOf.getMonth() + 1;
    const releasePressure =
      month >= 9 || month <= 2 ? 62 : month >= 3 && month <= 5 ? 48 : 55;

    return validProviderResult({
      success: true,
      dataPointCount: 1,
      observations: [
        {
          featureKey: "supply.product.release_pressure",
          featureCategory: "supply",
          value: releasePressure,
          delta30dPct: null,
          providerSlug: this.slug,
          metadata: {
            note: "Static seasonal release pressure proxy for V1",
            month,
          },
        },
      ],
    });
  },
};

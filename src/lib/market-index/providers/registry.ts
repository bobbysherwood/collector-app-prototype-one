import { ebayMarketProvider } from "@/lib/market-index/providers/ebay-market-provider";
import { productCalendarProvider } from "@/lib/market-index/providers/product-calendar-provider";
import { sentimentCompositeProvider } from "@/lib/market-index/providers/sentiment-composite-provider";
import type { IDataProvider } from "@/lib/market-index/providers/types";

const PROVIDERS: IDataProvider[] = [
  sentimentCompositeProvider,
  ebayMarketProvider,
  productCalendarProvider,
];

export function getSportMarketIndexProvider(
  slug: string
): IDataProvider | undefined {
  return PROVIDERS.find((provider) => provider.slug === slug);
}

export function listSportMarketIndexProviders(): IDataProvider[] {
  return [...PROVIDERS];
}

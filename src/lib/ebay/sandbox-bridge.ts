import type { Asset } from "@/types/asset";
import type { EbayItemSummary } from "@/lib/ebay/browse-client";
import { getEbayItemById } from "@/lib/ebay/browse-client";
import { getEbayEnvironment } from "@/lib/ebay/config";
import {
  buildCollectorAppListingSku,
  getOffersBySku,
} from "@/lib/ebay/sell-api";
import { getEbayUserAccessToken } from "@/lib/ebay/seller-auth";

const DEFAULT_LISTINGS_PER_CARD = 3;

function listingsPerCardFromEnv(): number {
  const parsed = Number(process.env.LISTINGS_PER_CARD ?? DEFAULT_LISTINGS_PER_CARD);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_LISTINGS_PER_CARD;
}

function buildSkusForAsset(assetId: string): string[] {
  const count = listingsPerCardFromEnv();
  return Array.from({ length: count }, (_, index) =>
    buildCollectorAppListingSku(assetId, index + 1)
  );
}

/**
 * Sandbox Browse search does not index Sell-published inventory. When search
 * returns zero, look up our seeded offers by SKU (cp-{assetId12}-{1..N}) via
 * Sell Inventory getOffers, then hydrate each listing through Browse getItem.
 *
 * Requires EBAY_USER_REFRESH_TOKEN in .env.local (see scripts/ebay-seller-auth.ts).
 */
export async function fetchSandboxListingsViaSellBridge(
  asset: Asset
): Promise<EbayItemSummary[]> {
  if (getEbayEnvironment() !== "sandbox") return [];

  if (!process.env.EBAY_USER_REFRESH_TOKEN?.trim()) {
    return [];
  }

  try {
    const accessToken = await getEbayUserAccessToken("sandbox");
    const listingIds = new Set<string>();

    for (const sku of buildSkusForAsset(asset.id)) {
      const offers = await getOffersBySku(accessToken, sku, "sandbox");
      for (const offer of offers) {
        if (offer.status === "PUBLISHED" && offer.listingId) {
          listingIds.add(offer.listingId);
        }
      }
    }

    const summaries: EbayItemSummary[] = [];
    for (const listingId of listingIds) {
      try {
        const item = await getEbayItemById(listingId, { env: "sandbox" });
        if (item) summaries.push(item);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "getItem failed";
        console.warn(
          `Sandbox bridge: Browse getItem failed for listing ${listingId}: ${message}`
        );
      }
    }

    return summaries;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sell bridge failed";
    console.warn("Sandbox Sell→Browse bridge failed:", message);
    return [];
  }
}

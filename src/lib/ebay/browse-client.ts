import { getEbayApplicationAccessToken } from "@/lib/ebay/auth";
import { getEbayApiBaseUrl, getEbayEnvironment, type EbayEnvironment } from "@/lib/ebay/config";
import type { EbayListingSearchQuery } from "@/lib/ebay/query-builder";

export interface EbayPrice {
  value: string;
  currency: string;
}

export interface EbayItemSummary {
  itemId: string;
  title: string;
  price?: EbayPrice;
  currentBidPrice?: EbayPrice;
  buyingOptions?: string[];
  bidCount?: number;
  itemEndDate?: string;
  itemWebUrl?: string;
  itemAffiliateWebUrl?: string;
}

interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
  total?: number;
  limit?: number;
  offset?: number;
}

export async function searchEbayItemSummaries(
  query: EbayListingSearchQuery,
  options?: { env?: EbayEnvironment; offset?: number }
): Promise<EbayItemSummary[]> {
  const env = options?.env ?? getEbayEnvironment();
  const token = await getEbayApplicationAccessToken(env);
  const params = new URLSearchParams({
    q: query.q,
    category_ids: query.categoryIds,
    filter: query.filter,
    sort: query.sort,
    limit: String(query.limit),
    offset: String(options?.offset ?? 0),
  });

  const response = await fetch(
    `${getEbayApiBaseUrl(env)}/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`eBay Browse search failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as EbaySearchResponse;
  return data.itemSummaries ?? [];
}

export async function searchEbayListingsForQuery(
  query: EbayListingSearchQuery,
  options?: { env?: EbayEnvironment; maxResults?: number }
): Promise<EbayItemSummary[]> {
  const maxResults = options?.maxResults ?? query.limit;
  const pageSize = Math.min(query.limit, maxResults);
  const summaries: EbayItemSummary[] = [];
  let offset = 0;

  while (summaries.length < maxResults) {
    const page = await searchEbayItemSummaries(query, {
      env: options?.env,
      offset,
    });
    if (page.length === 0) break;

    summaries.push(...page);
    if (page.length < pageSize) break;

    offset += pageSize;
    if (offset >= maxResults) break;
  }

  return summaries.slice(0, maxResults);
}

function toEbayItemSummary(item: Record<string, unknown>): EbayItemSummary | null {
  const itemId = typeof item.itemId === "string" ? item.itemId : null;
  const title = typeof item.title === "string" ? item.title : null;
  if (!itemId || !title) return null;

  return {
    itemId,
    title,
    price: item.price as EbayPrice | undefined,
    currentBidPrice: item.currentBidPrice as EbayPrice | undefined,
    buyingOptions: item.buyingOptions as string[] | undefined,
    bidCount: typeof item.bidCount === "number" ? item.bidCount : undefined,
    itemEndDate:
      typeof item.itemEndDate === "string" ? item.itemEndDate : undefined,
    itemWebUrl:
      typeof item.itemWebUrl === "string" ? item.itemWebUrl : undefined,
    itemAffiliateWebUrl:
      typeof item.itemAffiliateWebUrl === "string"
        ? item.itemAffiliateWebUrl
        : undefined,
  };
}

/** Browse getItem — used by sandbox Sell→Browse bridge (listingId from Sell publish). */
export async function getEbayItemById(
  listingId: string,
  options?: { env?: EbayEnvironment }
): Promise<EbayItemSummary | null> {
  const env = options?.env ?? getEbayEnvironment();
  const token = await getEbayApplicationAccessToken(env);
  const itemId = listingId.includes("|") ? listingId : `v1|${listingId}|0`;

  const response = await fetch(
    `${getEbayApiBaseUrl(env)}/buy/browse/v1/item/${encodeURIComponent(itemId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`eBay Browse getItem failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return toEbayItemSummary(data);
}

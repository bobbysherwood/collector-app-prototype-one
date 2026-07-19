import { getEbayApiBaseUrl, type EbayEnvironment } from "@/lib/ebay/config";

const MARKETPLACE_ID = "EBAY_US";
const DEFAULT_MERCHANT_LOCATION_KEY = "collector-app-default";
const SPORTS_TRADING_CARD_SINGLES = "261328";
const PLACEHOLDER_IMAGE =
  "https://i.ebayimg.com/images/g/V4sAAOSw~Epc~J5L/s-l1600.jpg";

export interface SellPolicyIds {
  paymentPolicyId: string;
  fulfillmentPolicyId: string;
  returnPolicyId: string;
  merchantLocationKey: string;
}

async function sellFetch<T>(
  path: string,
  accessToken: string,
  options: {
    env?: EbayEnvironment;
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const env = options.env ?? "sandbox";
  const response = await fetch(`${getEbayApiBaseUrl(env)}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Accept-Language": "en-US",
      ...(options.body
        ? {
            "Content-Type": "application/json",
            "Content-Language": "en-US",
          }
        : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `eBay Sell API ${options.method ?? "GET"} ${path} failed (${response.status}): ${text.slice(0, 500)}`
    );
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function optInToBusinessPolicies(
  accessToken: string,
  env?: EbayEnvironment
): Promise<void> {
  try {
    await sellFetch("/sell/account/v1/program/opt_in", accessToken, {
      env,
      method: "POST",
      body: { programType: "SELLING_POLICY_MANAGEMENT" },
    });
  } catch {
    // Already opted in.
  }
}

async function getFirstPolicyId(
  accessToken: string,
  kind: "payment" | "fulfillment" | "return",
  env?: EbayEnvironment
): Promise<string | null> {
  const path =
    kind === "payment"
      ? `/sell/account/v1/payment_policy?marketplace_id=${MARKETPLACE_ID}`
      : kind === "fulfillment"
        ? `/sell/account/v1/fulfillment_policy?marketplace_id=${MARKETPLACE_ID}`
        : `/sell/account/v1/return_policy?marketplace_id=${MARKETPLACE_ID}`;

  try {
    const data = await sellFetch<Record<string, unknown>>(path, accessToken, {
      env,
    });

    const listKey =
      kind === "payment"
        ? "paymentPolicies"
        : kind === "fulfillment"
          ? "fulfillmentPolicies"
          : "returnPolicies";

    const policies = data[listKey];
    if (!Array.isArray(policies) || policies.length === 0) return null;

    const first = policies[0] as Record<string, string>;
    return (
      first.paymentPolicyId ??
      first.fulfillmentPolicyId ??
      first.returnPolicyId ??
      null
    );
  } catch {
    return null;
  }
}

async function createDefaultPolicies(
  accessToken: string,
  env?: EbayEnvironment
): Promise<{
  paymentPolicyId: string;
  fulfillmentPolicyId: string;
  returnPolicyId: string;
}> {
  await optInToBusinessPolicies(accessToken, env);

  const categoryTypes = [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" as const }];

  const payment = await sellFetch<{ paymentPolicyId: string }>(
    "/sell/account/v1/payment_policy",
    accessToken,
    {
      env,
      method: "POST",
      body: {
        name: "Collector App Sandbox Payment",
        description: "Sandbox payment policy for test listings",
        marketplaceId: MARKETPLACE_ID,
        categoryTypes,
        immediatePay: true,
      },
    }
  );

  const fulfillment = await sellFetch<{ fulfillmentPolicyId: string }>(
    "/sell/account/v1/fulfillment_policy",
    accessToken,
    {
      env,
      method: "POST",
      body: {
        name: "Collector App Sandbox Shipping",
        description: "Sandbox shipping policy for test listings",
        marketplaceId: MARKETPLACE_ID,
        categoryTypes,
        handlingTime: { unit: "DAY", value: 1 },
        shippingOptions: [
          {
            costType: "FLAT_RATE",
            optionType: "DOMESTIC",
            shippingServices: [
              {
                shippingCarrierCode: "USPS",
                shippingServiceCode: "USPSPriority",
                shippingCost: { currency: "USD", value: "5.99" },
                additionalShippingCost: { currency: "USD", value: "0.00" },
              },
            ],
          },
        ],
      },
    }
  );

  const returnPolicy = await sellFetch<{ returnPolicyId: string }>(
    "/sell/account/v1/return_policy",
    accessToken,
    {
      env,
      method: "POST",
      body: {
        name: "Collector App Sandbox Returns",
        description: "Sandbox return policy for test listings",
        marketplaceId: MARKETPLACE_ID,
        categoryTypes,
        returnsAccepted: true,
        returnPeriod: { unit: "DAY", value: 30 },
        refundMethod: "MONEY_BACK",
        returnShippingCostPayer: "BUYER",
      },
    }
  );

  return {
    paymentPolicyId: payment.paymentPolicyId,
    fulfillmentPolicyId: fulfillment.fulfillmentPolicyId,
    returnPolicyId: returnPolicy.returnPolicyId,
  };
}

async function ensureMerchantLocation(
  accessToken: string,
  merchantLocationKey: string,
  env?: EbayEnvironment
): Promise<void> {
  try {
    await sellFetch(
      `/sell/inventory/v1/location/${encodeURIComponent(merchantLocationKey)}`,
      accessToken,
      { env }
    );
    return;
  } catch {
    // Create below.
  }

  await sellFetch(
    `/sell/inventory/v1/location/${encodeURIComponent(merchantLocationKey)}`,
    accessToken,
    {
      env,
      method: "POST",
      body: {
        name: "Collector App Default Location",
        merchantLocationStatus: "ENABLED",
        locationTypes: ["WAREHOUSE"],
        location: {
          address: {
            addressLine1: "123 Test St",
            city: "San Jose",
            stateOrProvince: "CA",
            postalCode: "95125",
            country: "US",
          },
        },
      },
    }
  );
}

export async function ensureSellPolicies(
  accessToken: string,
  env?: EbayEnvironment
): Promise<SellPolicyIds> {
  const merchantLocationKey =
    process.env.EBAY_MERCHANT_LOCATION_KEY?.trim() ??
    DEFAULT_MERCHANT_LOCATION_KEY;

  await optInToBusinessPolicies(accessToken, env);

  let paymentPolicyId =
    process.env.EBAY_PAYMENT_POLICY_ID?.trim() ??
    (await getFirstPolicyId(accessToken, "payment", env));
  let fulfillmentPolicyId =
    process.env.EBAY_FULFILLMENT_POLICY_ID?.trim() ??
    (await getFirstPolicyId(accessToken, "fulfillment", env));
  let returnPolicyId =
    process.env.EBAY_RETURN_POLICY_ID?.trim() ??
    (await getFirstPolicyId(accessToken, "return", env));

  if (!paymentPolicyId || !fulfillmentPolicyId || !returnPolicyId) {
    const created = await createDefaultPolicies(accessToken, env);
    paymentPolicyId = paymentPolicyId ?? created.paymentPolicyId;
    fulfillmentPolicyId = fulfillmentPolicyId ?? created.fulfillmentPolicyId;
    returnPolicyId = returnPolicyId ?? created.returnPolicyId;
  }

  await ensureMerchantLocation(accessToken, merchantLocationKey, env);

  return {
    paymentPolicyId,
    fulfillmentPolicyId,
    returnPolicyId,
    merchantLocationKey,
  };
}

export interface CreateBinListingInput {
  sku: string;
  title: string;
  description: string;
  priceUsd: number;
  imageUrls?: string[];
  categoryId?: string;
}

export interface CreateBinListingResult {
  sku: string;
  offerId: string;
  listingId?: string;
  priceUsd: number;
}

/** SKU prefix used by scripts/create-ebay-sandbox-listings.ts — must stay in sync. */
export function buildCollectorAppListingSku(
  assetId: string,
  index: number
): string {
  return `cp-${assetId.replace(/-/g, "").slice(0, 12)}-${index}`;
}

export interface SellOfferSummary {
  offerId: string;
  sku: string;
  status: string;
  listingId?: string;
}

function extractListingIdFromOffer(
  offer: Record<string, unknown>
): string | undefined {
  const listing = offer.listing as Record<string, unknown> | undefined;
  if (typeof listing?.listingId === "string") return listing.listingId;
  if (typeof offer.listingId === "string") return offer.listingId;
  return undefined;
}

export async function getOffersBySku(
  accessToken: string,
  sku: string,
  env?: EbayEnvironment
): Promise<SellOfferSummary[]> {
  try {
    const data = await sellFetch<{ offers?: Record<string, unknown>[] }>(
      `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${MARKETPLACE_ID}`,
      accessToken,
      { env }
    );

    return (data.offers ?? [])
      .map((offer) => ({
        offerId: String(offer.offerId ?? ""),
        sku: String(offer.sku ?? sku),
        status: String(offer.status ?? ""),
        listingId: extractListingIdFromOffer(offer),
      }))
      .filter((offer) => offer.offerId.length > 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("(404)")) return [];
    throw error;
  }
}

export async function createAndPublishBinListing(
  accessToken: string,
  policies: SellPolicyIds,
  input: CreateBinListingInput,
  env?: EbayEnvironment
): Promise<CreateBinListingResult> {
  const imageUrls =
    input.imageUrls && input.imageUrls.length > 0
      ? input.imageUrls
      : [PLACEHOLDER_IMAGE];

  await sellFetch(
    `/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`,
    accessToken,
    {
      env,
      method: "PUT",
      body: {
        availability: {
          shipToLocationAvailability: { quantity: 1 },
        },
        condition: "USED_VERY_GOOD",
        product: {
          title: input.title.slice(0, 80),
          description: input.description.slice(0, 4000),
          imageUrls,
          aspects: {
            Sport: ["Sports Trading Cards"],
          },
        },
      },
    }
  );

  const offer = await sellFetch<{ offerId: string }>(
    "/sell/inventory/v1/offer",
    accessToken,
    {
      env,
      method: "POST",
      body: {
        sku: input.sku,
        marketplaceId: MARKETPLACE_ID,
        format: "FIXED_PRICE",
        availableQuantity: 1,
        categoryId: input.categoryId ?? SPORTS_TRADING_CARD_SINGLES,
        listingDescription: input.description.slice(0, 4000),
        listingDuration: "GTC",
        merchantLocationKey: policies.merchantLocationKey,
        pricingSummary: {
          price: {
            currency: "USD",
            value: input.priceUsd.toFixed(2),
          },
        },
        listingPolicies: {
          paymentPolicyId: policies.paymentPolicyId,
          fulfillmentPolicyId: policies.fulfillmentPolicyId,
          returnPolicyId: policies.returnPolicyId,
        },
      },
    }
  );

  const published = await sellFetch<{ listingId?: string }>(
    `/sell/inventory/v1/offer/${encodeURIComponent(offer.offerId)}/publish`,
    accessToken,
    { env, method: "POST" }
  );

  return {
    sku: input.sku,
    offerId: offer.offerId,
    listingId: published.listingId,
    priceUsd: input.priceUsd,
  };
}

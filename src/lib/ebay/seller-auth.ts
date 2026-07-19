import {
  getEbayApiBaseUrl,
  getEbayCredentials,
  type EbayEnvironment,
} from "@/lib/ebay/config";
import { getEbaySellScopeString } from "@/lib/ebay/seller-scopes";

function getOAuthBaseUrl(env: EbayEnvironment): string {
  return env === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";
}

function getAuthBaseUrl(env: EbayEnvironment): string {
  return env === "production"
    ? "https://auth.ebay.com"
    : "https://auth.sandbox.ebay.com";
}

export function getEbayEnvironmentFromEnv(): EbayEnvironment {
  const value = process.env.EBAY_ENV?.trim().toLowerCase();
  return value === "production" ? "production" : "sandbox";
}

export function buildEbaySellerAuthorizationUrl(options?: {
  env?: EbayEnvironment;
  state?: string;
}): string {
  const credentials = getEbayCredentials();
  if (!credentials) {
    throw new Error("Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET.");
  }

  const ruName = process.env.EBAY_RUNAME?.trim();
  if (!ruName) {
    throw new Error(
      "Missing EBAY_RUNAME (your eBay RuName / redirect URI name from developer.ebay.com → User Tokens)."
    );
  }

  const env = options?.env ?? getEbayEnvironmentFromEnv();
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    response_type: "code",
    redirect_uri: ruName,
    scope: getEbaySellScopeString(),
  });

  if (options?.state) {
    params.set("state", options.state);
  }

  return `${getAuthBaseUrl(env)}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeEbayAuthorizationCode(
  code: string,
  env?: EbayEnvironment
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const credentials = getEbayCredentials();
  if (!credentials) {
    throw new Error("Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET.");
  }

  const ruName = process.env.EBAY_RUNAME?.trim();
  if (!ruName) {
    throw new Error("Missing EBAY_RUNAME.");
  }

  const resolvedEnv = env ?? getEbayEnvironmentFromEnv();
  const auth = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `${getOAuthBaseUrl(resolvedEnv)}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: ruName,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`eBay authorization code exchange failed: ${body}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshEbayUserAccessToken(
  refreshToken: string,
  env?: EbayEnvironment
): Promise<{ accessToken: string; expiresIn: number }> {
  const credentials = getEbayCredentials();
  if (!credentials) {
    throw new Error("Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET.");
  }

  const resolvedEnv = env ?? getEbayEnvironmentFromEnv();
  const auth = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `${getOAuthBaseUrl(resolvedEnv)}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: getEbaySellScopeString(),
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`eBay user token refresh failed: ${body}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function getEbayUserAccessToken(
  env?: EbayEnvironment
): Promise<string> {
  const refreshToken = process.env.EBAY_USER_REFRESH_TOKEN?.trim();
  if (!refreshToken) {
    throw new Error(
      "Missing EBAY_USER_REFRESH_TOKEN. Run: npx tsx scripts/ebay-seller-auth.ts"
    );
  }

  const { accessToken } = await refreshEbayUserAccessToken(refreshToken, env);
  return accessToken;
}

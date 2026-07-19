import {
  getEbayApiBaseUrl,
  getEbayCredentials,
  getEbayOAuthScopes,
  type EbayEnvironment,
} from "@/lib/ebay/config";

interface CachedApplicationToken {
  token: string;
  expiresAtMs: number;
}

let cachedToken: CachedApplicationToken | null = null;

export async function getEbayApplicationAccessToken(
  env?: EbayEnvironment
): Promise<string> {
  const credentials = getEbayCredentials();
  if (!credentials) {
    throw new Error("eBay credentials are not configured.");
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) {
    return cachedToken.token;
  }

  const auth = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`
  ).toString("base64");

  for (const scope of getEbayOAuthScopes()) {
    const response = await fetch(
      `${getEbayApiBaseUrl(env)}/identity/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope,
        }),
        cache: "no-store",
      }
    );

    if (response.ok) {
      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      cachedToken = {
        token: data.access_token,
        expiresAtMs: now + data.expires_in * 1000,
      };

      return data.access_token;
    }

    const body = await response.text();
    if (!body.includes("invalid_scope")) {
      throw new Error(`eBay OAuth failed (${response.status}): ${body}`);
    }
  }

  throw new Error(
    "eBay OAuth scope was rejected. In developer.ebay.com, open your app → OAuth scopes and enable client-credentials access (or the Browse API buy.browse scope), then restart the dev server."
  );

}

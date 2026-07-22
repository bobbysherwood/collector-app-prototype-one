export type EbayEnvironment = "sandbox" | "production";

/** Default client-credentials scope granted on most eBay keysets. */
export const EBAY_APPLICATION_SCOPE =
  "https://api.ebay.com/oauth/api_scope";

/** Narrower scope when explicitly enabled on the keyset. */
export const EBAY_BROWSE_SCOPE =
  "https://api.ebay.com/oauth/api_scope/buy.browse";

export function getEbayEnvironment(): EbayEnvironment {
  const value = process.env.EBAY_ENV?.trim().toLowerCase();
  if (value === "production") return "production";
  if (value === "sandbox") return "sandbox";

  // Fallback: infer from App ID when EBAY_ENV is unset (common deploy mistake).
  const clientId = process.env.EBAY_CLIENT_ID?.trim() ?? "";
  if (/-PRD-/i.test(clientId)) return "production";
  if (/-SBX-/i.test(clientId)) return "sandbox";

  return "sandbox";
}

export function getEbayApiBaseUrl(env = getEbayEnvironment()): string {
  return env === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";
}

export function getEbayOAuthScopes(): string[] {
  const configured = process.env.EBAY_OAUTH_SCOPE?.trim();
  if (configured) return [configured];
  return [EBAY_BROWSE_SCOPE, EBAY_APPLICATION_SCOPE];
}

export function getMissingEbayConfigVars(): string[] {
  const missing: string[] = [];
  if (!process.env.EBAY_CLIENT_ID?.trim()) missing.push("EBAY_CLIENT_ID");
  if (!process.env.EBAY_CLIENT_SECRET?.trim()) missing.push("EBAY_CLIENT_SECRET");
  return missing;
}

export function getEbayCredentials():
  | { clientId: string; clientSecret: string }
  | null {
  const clientId = process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isEbayConfigured(): boolean {
  return getEbayCredentials() != null;
}

/**
 * Authorize a sandbox/production eBay seller for Sell APIs.
 *
 * 1. Set EBAY_RUNAME in .env.local (RuName from developer.ebay.com → User Tokens).
 * 2. Run: npx tsx scripts/ebay-seller-auth.ts
 * 3. Open the printed URL, sign in with your sandbox SELLER account, approve scopes.
 * 4. Paste the `code` query param from the redirect URL.
 * 5. Add the printed EBAY_USER_REFRESH_TOKEN to .env.local
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import {
  buildEbaySellerAuthorizationUrl,
  exchangeEbayAuthorizationCode,
  getEbayEnvironmentFromEnv,
} from "../src/lib/ebay/seller-auth";

function loadEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const contents = readFileSync(envPath, "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

async function main() {
  loadEnvLocal();
  const env = getEbayEnvironmentFromEnv();
  const url = buildEbaySellerAuthorizationUrl({ env, state: "collector-app" });

  console.log(`Environment: ${env}`);
  console.log("\nOpen this URL in a browser and sign in with your eBay SELLER account:\n");
  console.log(url);
  console.log("\nAfter approving, copy the `code` parameter from the redirect URL.\n");

  const rl = readline.createInterface({ input, output });
  const code = (await rl.question("Paste authorization code: ")).trim();
  rl.close();

  if (!code) {
    throw new Error("No authorization code provided.");
  }

  const tokens = await exchangeEbayAuthorizationCode(code, env);
  console.log("\nSuccess. Add this to .env.local:\n");
  console.log(`EBAY_USER_REFRESH_TOKEN="${tokens.refreshToken}"`);
  console.log("\n(Access token expires in", tokens.expiresIn, "seconds; refresh token is long-lived.)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

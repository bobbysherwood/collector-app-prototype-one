/**
 * One-shot: exchange an OAuth authorization code for tokens.
 * Usage: npx tsx scripts/exchange-ebay-code.ts "<code or full query string>"
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { exchangeEbayAuthorizationCode } from "../src/lib/ebay/seller-auth";

function loadEnvLocal() {
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
}

function parseCodeArg(raw: string): string {
  let value = raw.trim();
  if (value.includes("code=")) {
    const match = value.match(/code=([^&]+)/);
    if (match) value = match[1];
  }
  return decodeURIComponent(value);
}

async function main() {
  loadEnvLocal();
  const arg = process.argv[2];
  if (!arg) {
    throw new Error(
      'Usage: npx tsx scripts/exchange-ebay-code.ts "<code or code=...&expires_in=...>"'
    );
  }

  const code = parseCodeArg(arg);
  const tokens = await exchangeEbayAuthorizationCode(code, "sandbox");

  const envPath = resolve(process.cwd(), ".env.local");
  let contents = readFileSync(envPath, "utf8");
  const line = `EBAY_USER_REFRESH_TOKEN="${tokens.refreshToken}"`;

  if (/^EBAY_USER_REFRESH_TOKEN=/m.test(contents)) {
    contents = contents.replace(/^EBAY_USER_REFRESH_TOKEN=.*$/m, line);
  } else {
    contents = `${contents.trimEnd()}\n${line}\n`;
  }

  writeFileSync(envPath, contents, "utf8");
  console.log("Saved EBAY_USER_REFRESH_TOKEN to .env.local");
  console.log(`Refresh token length: ${tokens.refreshToken.length} chars`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

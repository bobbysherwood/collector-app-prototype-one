import { readFileSync } from "fs";
import { resolve } from "path";
import { getEbayUserAccessToken } from "../src/lib/ebay/seller-auth";

function loadEnvLocal() {
  const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
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

async function main() {
  loadEnvLocal();
  const token = await getEbayUserAccessToken("sandbox");
  console.log("Refresh OK. Access token length:", token.length);
}

main().catch((error) => {
  console.error("Refresh failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

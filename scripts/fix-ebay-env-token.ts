import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const lines = readFileSync(envPath, "utf8").split("\n");

let token = "";
for (const line of lines) {
  if (line.startsWith("EBAY_USER_REFRESH_TOKEN=")) {
    token = line.slice("EBAY_USER_REFRESH_TOKEN=".length).trim();
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      token = token.slice(1, -1);
    }
    break;
  }
}

if (!token) {
  throw new Error("EBAY_USER_REFRESH_TOKEN not found in .env.local");
}

const quotedLine = `EBAY_USER_REFRESH_TOKEN="${token}"`;
const updated = lines
  .map((line) =>
    line.startsWith("EBAY_USER_REFRESH_TOKEN=") ? quotedLine : line
  )
  .join("\n");

writeFileSync(
  envPath,
  updated.endsWith("\n") ? updated : `${updated}\n`,
  "utf8"
);

console.log(`Quoted refresh token in .env.local (${token.length} chars).`);

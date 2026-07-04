/**
 * Backfills valuation history for all cards in the demo account
 * without recreating cards. History spans purchase_date → today.
 *
 * Usage: npm run seed:valuations
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

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
    // ignore
  }
}

loadEnvLocal();

const DEMO_EMAIL = "demo@cardportfolio.app";
const DEMO_PASSWORD = "DemoPortfolio1!";

interface CardRow {
  id: string;
  purchase_date: string;
  purchase_price: number;
}

function generateValuationHistory(
  purchaseDate: string,
  purchasePrice: number
): { value: number; recorded_at: string }[] {
  const start = new Date(`${purchaseDate}T12:00:00`);
  const end = new Date();
  if (start > end) {
    return [{ value: purchasePrice, recorded_at: end.toISOString() }];
  }

  const trendMultiplier = 0.65 + Math.random() * 2.0;
  const targetValue = Math.max(1, purchasePrice * trendMultiplier);
  const valuations: { value: number; recorded_at: string }[] = [];

  valuations.push({
    value: purchasePrice,
    recorded_at: start.toISOString(),
  });

  const cursor = new Date(start);
  cursor.setMonth(cursor.getMonth() + 1);
  cursor.setDate(1);

  while (cursor <= end) {
    const elapsed = cursor.getTime() - start.getTime();
    const total = end.getTime() - start.getTime();
    const progress = total > 0 ? elapsed / total : 1;
    const trendValue = purchasePrice + (targetValue - purchasePrice) * progress;
    const noise = trendValue * (Math.random() * 0.14 - 0.07);
    const value = Math.max(1, Math.round((trendValue + noise) * 100) / 100);

    valuations.push({ value, recorded_at: new Date(cursor).toISOString() });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const lastRecorded = new Date(valuations[valuations.length - 1].recorded_at);
  if (end.getTime() - lastRecorded.getTime() > 7 * 24 * 60 * 60 * 1000) {
    const finalNoise = targetValue * (Math.random() * 0.08 - 0.04);
    valuations.push({
      value: Math.max(1, Math.round((targetValue + finalNoise) * 100) / 100),
      recorded_at: end.toISOString(),
    });
  }

  return valuations;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createClient(url, key);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (signInError) {
    throw new Error(`Sign in failed: ${signInError.message}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated.");

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, purchase_date, purchase_price");

  if (cardsError) {
    throw new Error(`Failed to fetch cards: ${cardsError.message}`);
  }

  if (!cards?.length) {
    throw new Error("No cards found. Run npm run seed first.");
  }

  console.log(`Found ${cards.length} cards. Clearing existing valuations...`);

  const { error: deleteError } = await supabase
    .from("card_valuations")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    throw new Error(
      `Failed to clear valuations (did you run migration 003?): ${deleteError.message}`
    );
  }

  const valuationRows: {
    card_id: string;
    user_id: string;
    value: number;
    recorded_at: string;
  }[] = [];

  for (const card of cards as CardRow[]) {
    const history = generateValuationHistory(
      card.purchase_date,
      card.purchase_price
    );
    for (const entry of history) {
      valuationRows.push({
        card_id: card.id,
        user_id: user.id,
        value: entry.value,
        recorded_at: entry.recorded_at,
      });
    }
  }

  console.log(`Inserting ${valuationRows.length} valuation entries...`);

  const batchSize = 200;
  for (let i = 0; i < valuationRows.length; i += batchSize) {
    const batch = valuationRows.slice(i, i + batchSize);
    const { error } = await supabase.from("card_valuations").insert(batch);
    if (error) {
      throw new Error(`Insert failed: ${error.message}`);
    }
  }

  console.log(
    `\nDone! ${valuationRows.length} valuations across ${cards.length} cards (~${Math.round(valuationRows.length / cards.length)} per card).`
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

/**
 * Marks 50 demo cards as sold with uneven sport distribution and a mix of
 * gains and losses. Resets any prior demo sale data first.
 *
 * Usage: npm run seed:sales
 *
 * Requires migrations 004_card_sales.sql and 005_card_sold_status.sql.
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

const SOLD_DISTRIBUTION: { sport: string; count: number }[] = [
  { sport: "Baseball", count: 16 },
  { sport: "Basketball", count: 13 },
  { sport: "Football", count: 9 },
  { sport: "Hockey", count: 7 },
  { sport: "Pokemon", count: 5 },
];

const TARGET_SOLD_COUNT = SOLD_DISTRIBUTION.reduce((sum, s) => sum + s.count, 0);

interface CardRow {
  id: string;
  sport: string;
  purchase_date: string;
  purchase_price: number;
  quantity: number;
  player_name: string;
  status: string;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function salePriceForOutcome(
  purchasePrice: number,
  gain: boolean
): number {
  if (gain) {
    const multiplier = 1.08 + Math.random() * 1.35;
    return Math.round(purchasePrice * multiplier * 100) / 100;
  }

  const multiplier = 0.42 + Math.random() * 0.5;
  return Math.round(purchasePrice * multiplier * 100) / 100;
}

function pickCardsToSell(cards: CardRow[]): CardRow[] {
  const held = cards.filter((c) => c.status !== "sold");
  const bySport = new Map<string, CardRow[]>();

  for (const card of held) {
    const list = bySport.get(card.sport) ?? [];
    list.push(card);
    bySport.set(card.sport, list);
  }

  const selected: CardRow[] = [];

  for (const { sport, count } of SOLD_DISTRIBUTION) {
    const pool = shuffle(bySport.get(sport) ?? []);
    if (pool.length < count) {
      throw new Error(
        `Not enough held ${sport} cards (need ${count}, found ${pool.length}). Run npm run seed first.`
      );
    }
    selected.push(...pool.slice(0, count));
  }

  return selected;
}

function buildOutcomeFlags(count: number): boolean[] {
  const gains = Math.floor(count / 2);
  const losses = count - gains;
  return shuffle([
    ...Array.from({ length: gains }, () => true),
    ...Array.from({ length: losses }, () => false),
  ]);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars.");

  const supabase = createClient(url, key);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (signInError) throw new Error(signInError.message);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(
      "id, sport, purchase_date, purchase_price, quantity, player_name, status"
    );

  if (cardsError) throw new Error(cardsError.message);
  if (!cards?.length) throw new Error("No cards found. Run npm run seed first.");

  console.log("Resetting prior sold status and sale records...");
  const { error: resetCardsError } = await supabase
    .from("cards")
    .update({ status: "held", sold_at: null, sold_price: null })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (resetCardsError) {
    throw new Error(
      `Failed to reset cards (run migration 005?): ${resetCardsError.message}`
    );
  }

  const { error: deleteSalesError } = await supabase
    .from("card_sales")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteSalesError) {
    throw new Error(
      `Failed to clear sales (run migration 004?): ${deleteSalesError.message}`
    );
  }

  const toSell = pickCardsToSell(cards as CardRow[]);
  if (toSell.length !== TARGET_SOLD_COUNT) {
    throw new Error(`Expected ${TARGET_SOLD_COUNT} cards to sell, got ${toSell.length}.`);
  }

  const outcomes = buildOutcomeFlags(toSell.length);
  const today = new Date().toISOString().split("T")[0];
  let gainCount = 0;
  let lossCount = 0;
  const sportCounts = new Map<string, number>();

  for (let i = 0; i < toSell.length; i++) {
    const card = toSell[i];
    const gain = outcomes[i];
    if (gain) gainCount++;
    else lossCount++;

    sportCounts.set(card.sport, (sportCounts.get(card.sport) ?? 0) + 1);

    let saleDate = addMonths(card.purchase_date, randomInt(2, 28));
    if (saleDate > today) {
      saleDate = today;
    }
    if (saleDate < card.purchase_date) {
      saleDate = card.purchase_date;
    }

    const salePrice = salePriceForOutcome(card.purchase_price, gain);

    const { error: updateError } = await supabase
      .from("cards")
      .update({
        status: "sold",
        sold_at: saleDate,
        sold_price: salePrice,
      })
      .eq("id", card.id);

    if (updateError) {
      throw new Error(`Failed to mark ${card.player_name} sold: ${updateError.message}`);
    }

    const { error: saleError } = await supabase.from("card_sales").insert({
      card_id: card.id,
      user_id: user.id,
      sale_date: saleDate,
      sale_price: salePrice,
      quantity: card.quantity,
      notes: `Demo sale of ${card.player_name}`,
    });

    if (saleError) {
      throw new Error(`Failed to log sale for ${card.player_name}: ${saleError.message}`);
    }
  }

  console.log(`Marked ${toSell.length} cards as sold for demo account.`);
  console.log(`  Gains: ${gainCount}`);
  console.log(`  Losses: ${lossCount}`);
  console.log("  By sport:");
  for (const { sport, count } of SOLD_DISTRIBUTION) {
    console.log(`    ${sport}: ${sportCounts.get(sport) ?? 0} (target ${count})`);
  }
  console.log(`  Active collection remaining: ${cards.length - toSell.length} cards`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

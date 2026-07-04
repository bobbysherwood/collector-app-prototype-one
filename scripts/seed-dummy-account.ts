/**
 * Seeds a demo account with 100 cards across Baseball, Basketball, Football, Hockey, and Pokemon.
 *
 * Usage: npm run seed
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
    // .env.local optional if vars already set
  }
}

loadEnvLocal();

const DEMO_EMAIL = "demo@cardportfolio.app";
const DEMO_PASSWORD = "DemoPortfolio1!";
const DEMO_DISPLAY_NAME = "DemoCollector";

const SPORT_DISTRIBUTION: { sport: string; count: number }[] = [
  { sport: "Baseball", count: 35 },
  { sport: "Basketball", count: 27 },
  { sport: "Football", count: 20 },
  { sport: "Hockey", count: 11 },
  { sport: "Pokemon", count: 7 },
];

const PLAYERS_BY_SPORT: Record<string, string[]> = {
  Baseball: [
    "Shohei Ohtani",
    "Mike Trout",
    "Ronald Acuña Jr.",
    "Juan Soto",
    "Aaron Judge",
    "Bryce Harper",
    "Julio Rodríguez",
    "Fernando Tatis Jr.",
    "Mookie Betts",
    "Ken Griffey Jr.",
    "Derek Jeter",
    "Nolan Ryan",
    "Mickey Mantle",
    "Pete Rose",
    "Cal Ripken Jr.",
  ],
  Basketball: [
    "Michael Jordan",
    "LeBron James",
    "Kobe Bryant",
    "Stephen Curry",
    "Luka Dončić",
    "Victor Wembanyama",
    "Giannis Antetokounmpo",
    "Shaquille O'Neal",
    "Kevin Durant",
    "Larry Bird",
    "Magic Johnson",
    "Tim Duncan",
    "Ja Morant",
    "Anthony Edwards",
  ],
  Football: [
    "Patrick Mahomes",
    "Tom Brady",
    "Joe Burrow",
    "Justin Jefferson",
    "Travis Kelce",
    "Jerry Rice",
    "Josh Allen",
    "Trevor Lawrence",
    "C.J. Stroud",
    "Lamar Jackson",
    "Joe Montana",
    "Barry Sanders",
  ],
  Hockey: [
    "Wayne Gretzky",
    "Connor McDavid",
    "Sidney Crosby",
    "Mario Lemieux",
    "Alexander Ovechkin",
    "Patrick Kane",
    "Nathan MacKinnon",
    "Bobby Orr",
  ],
  Pokemon: [
    "Charizard",
    "Pikachu",
    "Mewtwo",
    "Blastoise",
    "Umbreon",
    "Lugia",
    "Rayquaza",
  ],
};

const CARD_TYPES_BY_SPORT: Record<string, string[]> = {
  Baseball: ["Topps", "Topps Chrome", "Bowman", "Bowman Chrome", "Donruss", "Fleer"],
  Basketball: ["Prizm", "Select", "Mosaic", "Panini", "Donruss", "Topps Chrome"],
  Football: ["Prizm", "Select", "Mosaic", "Panini", "Donruss", "Topps Chrome"],
  Hockey: ["Upper Deck", "SP Authentic", "O-Pee-Chee", "Topps", "Panini"],
  Pokemon: [
    "Base Set",
    "Jungle",
    "Fossil",
    "Celebrations",
    "Evolving Skies",
    "151",
    "Scarlet & Violet",
  ],
};

const INSERTS = [
  "Base",
  "Refractor",
  "Silver Prizm",
  "Gold Prizm",
  "Holo",
  "First Edition",
  "Rookie Card",
  "Auto",
  "Patch Auto",
  "SSP",
  "Shimmer",
  "Mojo",
  "X-Fractor",
  "",
  "",
];

const GRADERS = ["PSA", "BGS", "SGC", "CGC", "Raw", "Ungraded"] as const;
const GRADED_BY = ["PSA", "BGS", "SGC", "CGC"] as const;
const GRADES = ["10", "9.5", "9", "8.5", "8", "7", "Authentic"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(startYear: number, endYear: number): string {
  const year = randomInt(startYear, endYear);
  const month = String(randomInt(1, 12)).padStart(2, "0");
  const day = String(randomInt(1, 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateCard(sport: string, index: number) {
  const players = PLAYERS_BY_SPORT[sport];
  const cardTypes = CARD_TYPES_BY_SPORT[sport];
  const player = pick(players);
  const cardType = pick(cardTypes);
  const year =
    sport === "Pokemon"
      ? randomInt(1999, 2024)
      : randomInt(1980, 2024);
  const grader = pick([...GRADERS]);
  const isGraded = GRADED_BY.includes(grader as (typeof GRADED_BY)[number]);
  const insert = pick(INSERTS);
  const quantity = Math.random() < 0.85 ? 1 : randomInt(2, 4);

  return {
    player_name: player,
    year,
    card_type: cardType,
    sport,
    card_number: String(randomInt(1, 400)),
    insert_parallel: insert || null,
    grader,
    grade: isGraded ? pick(GRADES) : null,
    cert_number: isGraded
      ? String(randomInt(10000000, 99999999))
      : null,
    purchase_date: randomDate(2018, 2025),
    purchase_price: randomPrice(
      sport === "Pokemon" ? 25 : 15,
      sport === "Baseball" ? 2500 : 800
    ),
    quantity,
    notes:
      Math.random() < 0.3
        ? `Acquired from ${pick(["eBay", "local card show", "COMC", "PWCC", "private sale"])}. Card #${index + 1} in demo collection.`
        : null,
    image_path: null,
  };
}

function buildCardList() {
  const cards = [];
  let index = 0;

  for (const { sport, count } of SPORT_DISTRIBUTION) {
    for (let i = 0; i < count; i++) {
      cards.push(generateCard(sport, index));
      index++;
    }
  }

  return cards;
}

interface InsertedCard {
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
    return [
      {
        value: purchasePrice,
        recorded_at: end.toISOString(),
      },
    ];
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

    valuations.push({
      value,
      recorded_at: new Date(cursor).toISOString(),
    });

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

function buildValuationRows(
  cards: InsertedCard[],
  userId: string
): {
  card_id: string;
  user_id: string;
  value: number;
  recorded_at: string;
}[] {
  const rows = [];

  for (const card of cards) {
    const history = generateValuationHistory(
      card.purchase_date,
      card.purchase_price
    );
    for (const entry of history) {
      rows.push({
        card_id: card.id,
        user_id: userId,
        value: entry.value,
        recorded_at: entry.recorded_at,
      });
    }
  }

  return rows;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment."
    );
  }

  const supabase = createClient(url, key);

  console.log("Creating or signing in to demo account...");

  let { error: signInError } =
    await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

  if (signInError) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      options: { data: { display_name: DEMO_DISPLAY_NAME } },
    });

    if (signUpError) {
      throw new Error(`Sign up failed: ${signUpError.message}`);
    }

    if (!signUpData.user) {
      throw new Error("Sign up succeeded but no user returned.");
    }

    if (!signUpData.session) {
      const { error: retrySignInError } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (retrySignInError) {
        throw new Error(
          `Account created but sign-in failed. Disable email confirmation in Supabase Auth settings, then re-run seed. Error: ${retrySignInError.message}`
        );
      }
    }

    console.log("Demo account created.");
  } else {
    console.log("Signed in to existing demo account.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Could not get authenticated user.");
  }

  console.log(`User ID: ${user.id}`);

  const { count: existingCount } = await supabase
    .from("cards")
    .select("*", { count: "exact", head: true });

  if (existingCount && existingCount > 0) {
    console.log(`Removing ${existingCount} existing cards...`);
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      throw new Error(`Failed to clear existing cards: ${deleteError.message}`);
    }
  }

  const cards = buildCardList();
  const rows = cards.map((card) => ({ ...card, user_id: user.id }));

  console.log(`Inserting ${rows.length} cards...`);

  const insertedCards: InsertedCard[] = [];
  const batchSize = 25;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error: insertError } = await supabase
      .from("cards")
      .insert(batch)
      .select("id, purchase_date, purchase_price");

    if (insertError) {
      throw new Error(
        `Insert failed at batch ${i / batchSize + 1}: ${insertError.message}`
      );
    }

    insertedCards.push(...(data as InsertedCard[]));
  }

  console.log("Generating valuation history from acquisition dates...");
  const valuationRows = buildValuationRows(insertedCards, user.id);
  console.log(`Inserting ${valuationRows.length} valuation entries...`);

  const valuationBatchSize = 200;
  for (let i = 0; i < valuationRows.length; i += valuationBatchSize) {
    const batch = valuationRows.slice(i, i + valuationBatchSize);
    const { error: valuationError } = await supabase
      .from("card_valuations")
      .insert(batch);

    if (valuationError) {
      throw new Error(
        `Valuation insert failed at batch ${i / valuationBatchSize + 1}: ${valuationError.message}`
      );
    }
  }

  const avgValuationsPerCard = Math.round(
    valuationRows.length / insertedCards.length
  );

  const sportSummary = SPORT_DISTRIBUTION.map(
    (s) => `  ${s.sport}: ${s.count}`
  ).join("\n");

  console.log("\nSeed complete!\n");
  console.log("Login credentials:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Display:  ${DEMO_DISPLAY_NAME}`);
  console.log("\nCard distribution:");
  console.log(sportSummary);
  console.log(`  Total:    ${rows.length}`);
  console.log(`\nValuations: ${valuationRows.length} entries (~${avgValuationsPerCard} per card)`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

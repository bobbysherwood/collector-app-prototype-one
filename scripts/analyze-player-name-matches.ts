/**
 * Analyze catalog player strings for auto-create vs 90–99% manual review.
 *
 *   100% match (same normalized name, same sport) → one UUID
 *   < 90% similar → separate UUIDs (auto-create)
 *   90% ≤ similarity < 100% → manual review
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
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // rely on existing environment
  }
}

loadEnvLocal();

const SIMILARITY_REVIEW = 0.9;
const PAGE_SIZE = 1000;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

function splitCatalogPlayers(player: string): string[] {
  return player
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

class UnionFind {
  private parent = new Map<string, string>();

  add(id: string) {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    this.add(id);
    const parent = this.parent.get(id)!;
    if (parent !== id) {
      const root = this.find(parent);
      this.parent.set(id, root);
      return root;
    }
    return id;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.PROBE_EMAIL;
  const password = process.env.PROBE_PASSWORD;
  if (!url || !anonKey || !email || !password) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, PROBE_EMAIL, or PROBE_PASSWORD.");
  }

  const supabase = createClient(url, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`Sign-in failed: ${authError.message}`);

  const setSport = new Map<string, { sportId: string; sportLabel: string }>();
  let setFrom = 0;
  while (true) {
    const { data, error } = await supabase
      .from("dm2_card_sets")
      .select("id, sport_id, pick_list_options(label)")
      .range(setFrom, setFrom + PAGE_SIZE - 1);
    if (error) throw new Error(`Card sets failed: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      const rel = row.pick_list_options as { label?: string } | { label?: string }[] | null;
      const label = Array.isArray(rel) ? rel[0]?.label ?? "" : rel?.label ?? "";
      setSport.set(row.id, { sportId: row.sport_id, sportLabel: label });
    }
    if (data.length < PAGE_SIZE) break;
    setFrom += PAGE_SIZE;
  }

  type NameRow = {
    sportId: string;
    sportLabel: string;
    name: string;
    nameKey: string;
    cardCount: number;
  };

  const names = new Map<string, NameRow>();
  let cardFrom = 0;
  let cardsRead = 0;
  while (true) {
    const { data, error } = await supabase
      .from("dm2_cards")
      .select("card_set_id, player")
      .range(cardFrom, cardFrom + PAGE_SIZE - 1);
    if (error) throw new Error(`Cards failed: ${error.message}`);
    if (!data?.length) break;
    cardsRead += data.length;
    for (const row of data) {
      const sport = setSport.get(row.card_set_id);
      if (!sport || !row.player) continue;
      for (const part of splitCatalogPlayers(row.player)) {
        const nameKey = normalizeName(part);
        if (!nameKey) continue;
        const id = `${sport.sportId}::${nameKey}`;
        const existing = names.get(id);
        if (existing) {
          existing.cardCount += 1;
        } else {
          names.set(id, {
            sportId: sport.sportId,
            sportLabel: sport.sportLabel,
            name: part.trim(),
            nameKey,
            cardCount: 1,
          });
        }
      }
    }
    if (cardsRead % 10000 === 0 || data.length < PAGE_SIZE) {
      process.stderr.write(`Read ${cardsRead} cards, ${names.size} distinct names\n`);
    }
    if (data.length < PAGE_SIZE) break;
    cardFrom += PAGE_SIZE;
  }

  const bySport = new Map<string, NameRow[]>();
  for (const row of names.values()) {
    const list = bySport.get(row.sportId) ?? [];
    list.push(row);
    bySport.set(row.sportId, list);
  }

  type Pair = {
    sportLabel: string;
    left: string;
    right: string;
    similarity: number;
  };

  const reviewPairs: Pair[] = [];
  const reviewKeys = new Set<string>();
  const clusters = new UnionFind();

  for (const rows of bySport.values()) {
    rows.sort((a, b) => a.nameKey.localeCompare(b.nameKey));
    for (let i = 0; i < rows.length; i++) {
      const left = rows[i]!;
      for (let j = i + 1; j < rows.length; j++) {
        const right = rows[j]!;
        const maxLen = Math.max(left.nameKey.length, right.nameKey.length);
        if (maxLen > 0 && Math.abs(left.nameKey.length - right.nameKey.length) / maxLen > 1 - SIMILARITY_REVIEW) {
          continue;
        }
        const score = similarity(left.nameKey, right.nameKey);
        if (score < SIMILARITY_REVIEW) continue;
        if (score >= 1) continue;
        reviewPairs.push({
          sportLabel: left.sportLabel,
          left: left.name,
          right: right.name,
          similarity: score,
        });
        const leftId = `${left.sportId}::${left.nameKey}`;
        const rightId = `${right.sportId}::${right.nameKey}`;
        reviewKeys.add(leftId);
        reviewKeys.add(rightId);
        clusters.union(leftId, rightId);
      }
    }
  }

  const clusterBuckets = new Map<string, string[]>();
  for (const key of reviewKeys) {
    const root = clusters.find(key);
    const bucket = clusterBuckets.get(root) ?? [];
    bucket.push(names.get(key)?.name ?? key);
    clusterBuckets.set(root, bucket);
  }

  const autoCreate = names.size - reviewKeys.size;
  reviewPairs.sort((a, b) => b.similarity - a.similarity || a.left.localeCompare(b.left));

  console.log(
    JSON.stringify(
      {
        cardsRead,
        distinctNames: names.size,
        sports: [...bySport.entries()].map(([sportId, rows]) => ({
          sportId,
          sportLabel: rows[0]?.sportLabel ?? "",
          distinctNames: rows.length,
        })),
        rule: {
          exactMatch: "same sport + same normalized name → one UUID (already collapsed)",
          autoCreate: "similarity < 90% vs every other name in that sport",
          manualReview: "90% ≤ similarity < 100%",
          metric: "normalized Levenshtein ratio on lowercased trimmed names",
        },
        autoCreateCount: autoCreate,
        manualReviewNameCount: reviewKeys.size,
        manualReviewPairCount: reviewPairs.length,
        manualReviewClusterCount: clusterBuckets.size,
        sampleReviewPairs: reviewPairs.slice(0, 40),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

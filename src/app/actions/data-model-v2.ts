"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DM2_CARD_NUMBER_MAX_LENGTH,
  DM2_PLAYER_NAME_MAX_LENGTH,
} from "@/lib/dm2-field-limits";
import { normalizeRpcRows } from "@/lib/supabase/rpc-rows";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";
import {
  cardSearchTokens,
  formatCatalogSearchError,
  pickUniqueSearchPlayer,
  pickUniqueSearchSport,
} from "@/lib/dm2-card-search";
import { DM2_CARD_SEARCH_PAGE_SIZE } from "@/types/data-model-v2";
import {
  DM2_SUPABASE_PAGE_SIZE,
  getDm2CardsBySetId,
  isMissingPlayerProfileColumn,
  listDm2ComparableCandidates as listDm2ComparableCandidatesFromData,
  listDm2PlayersMissingBirthYear,
  mapDm2PlayerRow,
  resolveDm2PlayerSelect,
  resolveDm2SportId,
  updateDm2PlayerEmptyProfileFields,
} from "@/lib/data-model-v2-data";
import { parsePsaHeadingId } from "@/lib/card-population-lookup/heading";
import {
  mergePsaCounts,
  planPsaPopulationIngest,
} from "@/lib/card-population-lookup/ingest";
import type { CatalogCardIdentity } from "@/lib/card-population-lookup/types";
import { TtlCache } from "@/lib/player-stats/cache";
import {
  buildEmptyProfilePatch,
  profilePatchToDbRow,
} from "@/lib/player-stats/persist-profile";
import { loadPlayerLiveStats } from "@/lib/player-stats/provider";
import {
  normalizeDm2PlayerProfile,
  playerProfileToDbRow,
  type Dm2PlayerProfileInput,
} from "@/lib/dm2-player-profile";
import {
  classifyCatalogPlayerNames,
  normalizePlayerNameKey,
  type CatalogPlayerPart,
} from "@/lib/dm2-player-match";
import {
  CARD_POPULATION_KEYS,
  isCardUuid,
  parsePopulationForm,
  rowToPopulationCounts,
} from "@/lib/dm2-card-population";
import { searchCardsForPopulation } from "@/lib/dm2-card-population-search";

const MAX_NAME_LENGTH = 100;

async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Unauthorized" as const };
  }
  return { error: null };
}

function normalizeName(name: string): string {
  return name.trim();
}

function validateName(name: string): string | null {
  if (!name) return "Name is required.";
  if (name.length > MAX_NAME_LENGTH) {
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  return null;
}

function revalidateDataModelV2Paths() {
  revalidatePath("/admin");
}

export async function createDm2CardSetCategory(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_set_categories").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set category with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2CardSetCategory(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_categories")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set category with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2CardSetCategoryActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_categories")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2CardSetCategory(
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_categories")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2CardSetName(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_set_names").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set name with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2CardSetName(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_names")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set name with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2CardSetNameActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_names")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2CardSetName(
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_set_names")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2Manufacturer(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_manufacturers").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A manufacturer with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Manufacturer(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_manufacturers")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A manufacturer with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2ManufacturerActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_manufacturers")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Manufacturer(
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_manufacturers")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2Brand(input: {
  name: string;
  manufacturerId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  if (!input.manufacturerId) {
    return { error: "Manufacturer is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_brands").insert({
    name,
    manufacturer_id: input.manufacturerId,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A brand with that name already exists for this manufacturer.",
      };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Brand(input: {
  id: string;
  name: string;
  manufacturerId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  if (!input.manufacturerId) {
    return { error: "Manufacturer is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_brands")
    .update({
      name,
      manufacturer_id: input.manufacturerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A brand with that name already exists for this manufacturer.",
      };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2BrandActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_brands")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Brand(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_brands").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2Parallel(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_parallels").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A parallel with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Parallel(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_parallels")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A parallel with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2ParallelActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_parallels")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Parallel(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_parallels").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2Player(input: {
  sportId: string;
  name: string;
} & Dm2PlayerProfileInput): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!input.sportId.trim()) {
    return { error: "Sport is required." };
  }

  const name = normalizeName(input.name);
  if (!name) return { error: "Player name is required." };
  if (name.length > DM2_PLAYER_NAME_MAX_LENGTH) {
    return { error: `Name must be ${DM2_PLAYER_NAME_MAX_LENGTH} characters or fewer.` };
  }

  const profileResult = normalizeDm2PlayerProfile(input);
  if (profileResult.error || !profileResult.profile) {
    return { error: profileResult.error ?? "Player profile is invalid." };
  }

  const supabase = await createClient();
  const row = {
    sport_id: input.sportId,
    name,
    active: true,
    ...playerProfileToDbRow(profileResult.profile),
  };
  const { error } = await supabase.from("dm2_players").insert(row);

  if (error && isMissingPlayerProfileColumn(error.message)) {
    const retry = await supabase.from("dm2_players").insert({
      sport_id: input.sportId,
      name,
      active: true,
    });
    if (retry.error) {
      if (retry.error.code === "23505") {
        return { error: "A player with that name already exists in this sport." };
      }
      return { error: retry.error.message };
    }
  } else if (error) {
    if (error.code === "23505") {
      return { error: "A player with that name already exists in this sport." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Player(input: {
  id: string;
  sportId: string;
  name: string;
} & Dm2PlayerProfileInput): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!input.sportId.trim()) {
    return { error: "Sport is required." };
  }

  const name = normalizeName(input.name);
  if (!name) return { error: "Player name is required." };
  if (name.length > DM2_PLAYER_NAME_MAX_LENGTH) {
    return { error: `Name must be ${DM2_PLAYER_NAME_MAX_LENGTH} characters or fewer.` };
  }

  const profileResult = normalizeDm2PlayerProfile(input);
  if (profileResult.error || !profileResult.profile) {
    return { error: profileResult.error ?? "Player profile is invalid." };
  }

  const supabase = await createClient();
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("dm2_players")
    .update({
      sport_id: input.sportId,
      name,
      updated_at: updatedAt,
      ...playerProfileToDbRow(profileResult.profile),
    })
    .eq("id", input.id);

  if (error && isMissingPlayerProfileColumn(error.message)) {
    const retry = await supabase
      .from("dm2_players")
      .update({
        sport_id: input.sportId,
        name,
        updated_at: updatedAt,
      })
      .eq("id", input.id);
    if (retry.error) {
      if (retry.error.code === "23505") {
        return { error: "A player with that name already exists in this sport." };
      }
      return { error: retry.error.message };
    }
  } else if (error) {
    if (error.code === "23505") {
      return { error: "A player with that name already exists in this sport." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

const PLAYER_PROFILE_FILL_TTL_MS = 15 * 60 * 1000;
const playerProfileFillCache = new TtlCache<{
  filled: number;
  skipped: number;
  examined: number;
}>(PLAYER_PROFILE_FILL_TTL_MS);

export async function fillMissingDm2PlayerProfiles(): Promise<{
  error?: string;
  filled?: number;
  skipped?: number;
  examined?: number;
  cached?: boolean;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const cached = playerProfileFillCache.get("last");
  if (cached) {
    return { ...cached, cached: true };
  }

  const listed = await listDm2PlayersMissingBirthYear(50);
  if (listed.error) {
    return { error: listed.error };
  }

  let filled = 0;
  let skipped = 0;
  for (const player of listed.players) {
    const snapshot = await loadPlayerLiveStats(
      { playerName: player.name, sportLabel: player.sportName },
      { wikiOnly: true }
    );
    const patch =
      snapshot?.persistEligible
        ? buildEmptyProfilePatch(player, snapshot.playerProfile)
        : null;
    if (!patch) {
      skipped += 1;
      continue;
    }
    const result = await updateDm2PlayerEmptyProfileFields(
      player.id,
      profilePatchToDbRow(patch)
    );
    if (result.wrote) filled += 1;
    else skipped += 1;
  }

  const summary = {
    filled,
    skipped,
    examined: listed.players.length,
  };
  playerProfileFillCache.set("last", summary);
  revalidateDataModelV2Paths();
  return summary;
}

export async function setDm2PlayerActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_players")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Player(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data: player } = await supabase
    .from("dm2_players")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("dm2_players").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  if (player?.image_path) {
    await supabase.storage.from(DM2_PLAYER_IMAGES_BUCKET).remove([player.image_path]);
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function startDm2PlayerBackfillRefresh(): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_dm2_player_backfill_refresh");
  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function refreshDm2PlayerBackfillBatch(input?: {
  afterCardId?: string | null;
}): Promise<{
  error?: string;
  processed?: number;
  done?: boolean;
  nextAfterCardId?: string | null;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("refresh_dm2_player_backfill_batch", {
    p_after_card_id: input?.afterCardId ?? null,
    p_limit: 500,
  });

  if (error) {
    return { error: error.message };
  }

  const payload = data as {
    processed?: number;
    done?: boolean;
    nextAfterCardId?: string | null;
  } | null;

  return {
    processed: Number(payload?.processed ?? 0),
    done: Boolean(payload?.done),
    nextAfterCardId: payload?.nextAfterCardId ?? null,
  };
}

async function fetchAllSupabaseRows<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data?: T[]; error?: string }> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + DM2_SUPABASE_PAGE_SIZE - 1);
    if (error) return { error: error.message };
    if (!data?.length) break;
    all.push(...data);
    if (data.length < DM2_SUPABASE_PAGE_SIZE) break;
    from += DM2_SUPABASE_PAGE_SIZE;
  }

  return { data: all };
}

async function loadCatalogPlayerParts(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ error?: string; parts?: CatalogPlayerPart[] }> {
  const result = await fetchAllSupabaseRows<{
    sport_id: string;
    sport_label: string;
    name: string;
    name_key: string;
  }>((from, to) =>
    supabase
      .from("dm2_player_backfill_candidates")
      .select("sport_id, sport_label, name, name_key")
      .order("sport_label", { ascending: true })
      .order("name", { ascending: true })
      .range(from, to)
  );

  if (result.error) {
    if (/schema cache|does not exist/i.test(result.error)) {
      return {
        error:
          "Run supabase/migrations/050_dm2_player_backfill_candidates.sql in the SQL editor, then refresh this page.",
      };
    }
    return { error: result.error };
  }

  return {
    parts: (result.data ?? []).map((row) => ({
      sportId: row.sport_id,
      sportLabel: row.sport_label,
      name: row.name,
      nameKey: row.name_key,
    })),
  };
}

async function loadResolvedPlayerKeys(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ error?: string; keys?: Map<string, string> }> {
  const keys = new Map<string, string>();
  const players = await fetchAllSupabaseRows<{
    id: string;
    sport_id: string;
    name_key: string;
  }>((from, to) =>
    supabase
      .from("dm2_players")
      .select("id, sport_id, name_key")
      .order("id", { ascending: true })
      .range(from, to)
  );
  if (players.error) return { error: players.error };
  for (const row of players.data ?? []) {
    keys.set(`${row.sport_id}::${row.name_key}`, row.id);
  }

  const aliases = await fetchAllSupabaseRows<{
    player_id: string;
    sport_id: string;
    name_key: string;
  }>((from, to) =>
    supabase
      .from("dm2_player_aliases")
      .select("player_id, sport_id, name_key")
      .order("id", { ascending: true })
      .range(from, to)
  );
  if (aliases.error) return { error: aliases.error };
  for (const row of aliases.data ?? []) {
    keys.set(`${row.sport_id}::${row.name_key}`, row.player_id);
  }

  return { keys };
}

export async function getDm2PlayerMatchPlan(): Promise<{
  error?: string;
  catalogNameCount?: number;
  autoCreateCount?: number;
  pendingAutoCreateCount?: number;
  reviewPairs?: import("@/types/data-model-v2").Dm2PlayerReviewPair[];
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const partsResult = await loadCatalogPlayerParts(supabase);
  if (partsResult.error || !partsResult.parts) {
    return { error: partsResult.error ?? "Failed to load catalog names." };
  }

  const resolved = await loadResolvedPlayerKeys(supabase);
  if (resolved.error || !resolved.keys) {
    return { error: resolved.error ?? "Failed to load players." };
  }

  const classified = classifyCatalogPlayerNames(partsResult.parts);
  const reviewNameKeys = new Set(
    classified.reviewPairs.flatMap((pair) => [
      `${pair.sportId}::${pair.leftKey}`,
      `${pair.sportId}::${pair.rightKey}`,
    ])
  );
  const pendingAutoCreate = classified.autoCreate.filter(
    (part) => !resolved.keys!.has(`${part.sportId}::${part.nameKey}`)
  );
  const reviewPairs = classified.reviewPairs.filter((pair) => {
    const leftId = resolved.keys!.get(`${pair.sportId}::${pair.leftKey}`);
    const rightId = resolved.keys!.get(`${pair.sportId}::${pair.rightKey}`);
    return !leftId || !rightId;
  });

  return {
    catalogNameCount: classified.autoCreate.length + reviewNameKeys.size,
    autoCreateCount: classified.autoCreate.length,
    pendingAutoCreateCount: pendingAutoCreate.length,
    reviewPairs,
  };
}

export async function autoCreateUnambiguousDm2Players(): Promise<{
  error?: string;
  created?: number;
  skipped?: number;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const partsResult = await loadCatalogPlayerParts(supabase);
  if (partsResult.error || !partsResult.parts) {
    return { error: partsResult.error ?? "Failed to load catalog names." };
  }
  if (partsResult.parts.length === 0) {
    return {
      error:
        "No catalog names yet. Run scripts/populate-player-backfill-candidates.sql in the SQL editor, then click Load catalog names.",
    };
  }

  const resolved = await loadResolvedPlayerKeys(supabase);
  if (resolved.error || !resolved.keys) {
    return { error: resolved.error ?? "Failed to load players." };
  }

  const { autoCreate } = classifyCatalogPlayerNames(partsResult.parts);
  const pending = autoCreate.filter(
    (part) => !resolved.keys!.has(`${part.sportId}::${part.nameKey}`)
  );

  let created = 0;
  for (let i = 0; i < pending.length; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const { error } = await supabase.from("dm2_players").insert(
      chunk.map((part) => ({
        sport_id: part.sportId,
        name: part.name,
        active: true,
      }))
    );
    if (error) {
      return { error: error.message, created, skipped: pending.length - created };
    }
    created += chunk.length;
  }

  revalidateDataModelV2Paths();
  return { created, skipped: autoCreate.length - pending.length };
}

export async function linkDm2CardPlayersBatch(input?: {
  afterCardId?: string | null;
}): Promise<{
  error?: string;
  processed?: number;
  linksCreated?: number;
  done?: boolean;
  nextAfterCardId?: string | null;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("link_dm2_card_players_batch", {
    p_after_card_id: input?.afterCardId ?? null,
    p_limit: 500,
  });

  if (error) {
    return { error: error.message };
  }

  const payload = data as {
    processed?: number;
    linksCreated?: number;
    done?: boolean;
    nextAfterCardId?: string | null;
  } | null;

  return {
    processed: Number(payload?.processed ?? 0),
    linksCreated: Number(payload?.linksCreated ?? 0),
    done: Boolean(payload?.done),
    nextAfterCardId: payload?.nextAfterCardId ?? null,
  };
}

export async function resolveDm2PlayerReviewPair(input: {
  sportId: string;
  leftName: string;
  rightName: string;
  action: "merge" | "keep_both";
  canonicalName?: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const leftName = input.leftName.trim();
  const rightName = input.rightName.trim();
  if (!input.sportId || !leftName || !rightName) {
    return { error: "Sport and both names are required." };
  }

  const supabase = await createClient();

  async function ensurePlayer(name: string): Promise<{ id?: string; error?: string }> {
    const nameKey = normalizePlayerNameKey(name);
    const resolved = await loadResolvedPlayerKeys(supabase);
    if (resolved.error || !resolved.keys) {
      return { error: resolved.error ?? "Failed to load players." };
    }
    const existingId = resolved.keys.get(`${input.sportId}::${nameKey}`);
    if (existingId) return { id: existingId };

    const { data, error } = await supabase
      .from("dm2_players")
      .insert({ sport_id: input.sportId, name, active: true })
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        const again = await loadResolvedPlayerKeys(supabase);
        return {
          id: again.keys?.get(`${input.sportId}::${nameKey}`),
          error: again.keys?.get(`${input.sportId}::${nameKey}`)
            ? undefined
            : error.message,
        };
      }
      return { error: error.message };
    }
    if (!data?.id) return { error: "Failed to create player." };
    return { id: data.id };
  }

  if (input.action === "keep_both") {
    const left = await ensurePlayer(leftName);
    if (left.error || !left.id) return { error: left.error ?? "Failed to create left player." };
    const right = await ensurePlayer(rightName);
    if (right.error || !right.id) return { error: right.error ?? "Failed to create right player." };
    revalidateDataModelV2Paths();
    return {};
  }

  const canonicalName = (input.canonicalName ?? leftName).trim();
  const aliasName = normalizePlayerNameKey(canonicalName) === normalizePlayerNameKey(leftName)
    ? rightName
    : leftName;

  const canonical = await ensurePlayer(canonicalName);
  if (canonical.error || !canonical.id) {
    return { error: canonical.error ?? "Failed to create canonical player." };
  }

  const aliasKey = normalizePlayerNameKey(aliasName);
  const resolved = await loadResolvedPlayerKeys(supabase);
  const existingAliasPlayer = resolved.keys?.get(`${input.sportId}::${aliasKey}`);
  if (existingAliasPlayer && existingAliasPlayer !== canonical.id) {
    return {
      error: "The other name already belongs to a different player. Delete that player first, or keep both.",
    };
  }
  if (!existingAliasPlayer) {
    const { error } = await supabase.from("dm2_player_aliases").insert({
      player_id: canonical.id,
      sport_id: input.sportId,
      name: aliasName,
    });
    if (error && error.code !== "23505") {
      return { error: error.message };
    }
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function listDm2PlayerBackfillCandidates(): Promise<{
  error?: string;
  candidates?: import("@/types/data-model-v2").Dm2PlayerBackfillCandidate[];
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_dm2_player_backfill_candidates");

  if (error) {
    return { error: error.message };
  }

  return {
    candidates: normalizeRpcRows(data).map(
      (row: {
        sport_id: string;
        sport_label: string;
        name: string;
        name_key: string;
        card_count: number;
      }) => ({
        sportId: row.sport_id,
        sportLabel: row.sport_label,
        name: row.name,
        nameKey: row.name_key,
        cardCount: Number(row.card_count),
      })
    ),
  };
}

export async function approveDm2PlayerBackfill(input: {
  sportId: string;
  names: string[];
}): Promise<{ error?: string; playersCreated?: number; linksCreated?: number }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const names = input.names.map((name) => name.trim()).filter(Boolean);
  if (!input.sportId.trim()) {
    return { error: "Sport is required." };
  }
  if (names.length === 0) {
    return { error: "Select at least one player name to approve." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_dm2_player_backfill", {
    p_sport_id: input.sportId,
    p_names: names,
  });

  if (error) {
    return { error: error.message };
  }

  const payload = data as { playersCreated?: number; linksCreated?: number } | null;
  revalidateDataModelV2Paths();
  return {
    playersCreated: Number(payload?.playersCreated ?? 0),
    linksCreated: Number(payload?.linksCreated ?? 0),
  };
}

const DM2_PLAYER_IMAGES_BUCKET = "dm2-player-images";

function dm2PlayerImageStoragePath(playerId: string, ext: string): string {
  return `players/${playerId}.${ext}`;
}

export async function uploadDm2PlayerImage(
  playerId: string,
  formData: FormData
): Promise<{ error?: string; imagePath?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const trimmedId = playerId.trim();
  if (!trimmedId) {
    return { error: "Player id is required." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Image file is required." };
  }

  if (!ALLOWED_DM2_IMAGE_TYPES.has(file.type)) {
    return { error: "Image must be JPG, PNG, or WebP." };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("dm2_players")
    .select("image_path")
    .eq("id", trimmedId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }
  if (!existing) {
    return { error: "Player not found." };
  }

  const ext = extensionForImageFile(file);
  const nextPath = dm2PlayerImageStoragePath(trimmedId, ext);

  const { error: uploadError } = await supabase.storage
    .from(DM2_PLAYER_IMAGES_BUCKET)
    .upload(nextPath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: updateError } = await supabase
    .from("dm2_players")
    .update({
      image_path: nextPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trimmedId);

  if (updateError) {
    return { error: updateError.message };
  }

  if (existing.image_path && existing.image_path !== nextPath) {
    await supabase.storage.from(DM2_PLAYER_IMAGES_BUCKET).remove([existing.image_path]);
  }

  revalidateDataModelV2Paths();
  return { imagePath: nextPath };
}

export async function createDm2Attribute(input: {
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_attributes").insert({
    name,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "An attribute with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2Attribute(input: {
  id: string;
  name: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const name = normalizeName(input.name);
  const validationError = validateName(name);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_attributes")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "An attribute with that name already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2AttributeActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_attributes")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Attribute(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_attributes").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function assignDm2CardAttribute(input: {
  cardId: string;
  attributeId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!input.cardId.trim() || !input.attributeId.trim()) {
    return { error: "Card and attribute are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_attributes").insert({
    card_id: input.cardId,
    attribute_id: input.attributeId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That attribute is already assigned to this card." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2CardAttribute(input: {
  id: string;
  attributeId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  if (!input.id.trim() || !input.attributeId.trim()) {
    return { error: "Assignment and attribute are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_attributes")
    .update({ attribute_id: input.attributeId })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "That attribute is already assigned to this card." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function removeDm2CardAttribute(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_attributes").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

const MIN_YEAR = 1800;
const MAX_YEAR = 2100;

function validateYear(year: number): string | null {
  if (!Number.isInteger(year)) {
    return "Year must be a whole number.";
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`;
  }
  return null;
}

function validateCardSetLinks(input: {
  sportId: string;
  brandId: string;
  cardSetCategoryId: string;
  cardSetNameId: string;
}): string | null {
  if (!input.sportId) return "Sport is required.";
  if (!input.brandId) return "Manufacturer / brand is required.";
  if (!input.cardSetCategoryId) return "Card set category is required.";
  if (!input.cardSetNameId) return "Card set name is required.";
  return null;
}

export async function createDm2CardSet(input: {
  sportId: string;
  year: number;
  brandId: string;
  cardSetCategoryId: string;
  cardSetNameId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const yearError = validateYear(input.year);
  if (yearError) return { error: yearError };

  const linkError = validateCardSetLinks(input);
  if (linkError) return { error: linkError };

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_sets").insert({
    sport_id: input.sportId,
    year: input.year,
    brand_id: input.brandId,
    card_set_category_id: input.cardSetCategoryId,
    card_set_name_id: input.cardSetNameId,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set with that combination already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function updateDm2CardSet(input: {
  id: string;
  sportId: string;
  year: number;
  brandId: string;
  cardSetCategoryId: string;
  cardSetNameId: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const yearError = validateYear(input.year);
  if (yearError) return { error: yearError };

  const linkError = validateCardSetLinks(input);
  if (linkError) return { error: linkError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_sets")
    .update({
      sport_id: input.sportId,
      year: input.year,
      brand_id: input.brandId,
      card_set_category_id: input.cardSetCategoryId,
      card_set_name_id: input.cardSetNameId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A card set with that combination already exists." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function setDm2CardSetActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_sets")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2CardSet(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.from("dm2_card_sets").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

function validateCardField(
  value: string,
  fieldLabel: string,
  maxLength = MAX_NAME_LENGTH
): { value: string; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: trimmed, error: `${fieldLabel} is required.` };
  }
  if (trimmed.length > maxLength) {
    return {
      value: trimmed,
      error: `${fieldLabel} must be ${maxLength} characters or fewer.`,
    };
  }
  return { value: trimmed, error: null };
}

function uniquePlayerIds(ids: string[] | undefined): string[] {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
}

async function upsertDm2CardRecord(input: {
  id?: string | null;
  cardSetId: string;
  cardNumber: string;
  playerIds: string[];
  parallelId?: string | null;
}): Promise<{ error?: string }> {
  if (!input.cardSetId) {
    return { error: "Card set is required." };
  }

  const cardNumber = validateCardField(
    input.cardNumber,
    "Card #",
    DM2_CARD_NUMBER_MAX_LENGTH
  );
  if (cardNumber.error) return { error: cardNumber.error };

  const playerIds = uniquePlayerIds(input.playerIds);
  if (playerIds.length === 0) {
    return { error: "At least one player is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_dm2_card", {
    p_id: input.id ?? null,
    p_card_set_id: input.cardSetId,
    p_card_number: cardNumber.value,
    p_parallel_id: input.parallelId?.trim() ? input.parallelId : null,
    p_player_ids: playerIds,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A card with that number and parallel already exists in this card set." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function createDm2Card(input: {
  cardSetId: string;
  cardNumber: string;
  playerIds: string[];
  parallelId?: string | null;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;
  return upsertDm2CardRecord(input);
}

export async function updateDm2Card(input: {
  id: string;
  cardSetId: string;
  cardNumber: string;
  playerIds: string[];
  parallelId?: string | null;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;
  if (!input.id) return { error: "Card id is required." };
  return upsertDm2CardRecord(input);
}

export async function setDm2CardActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_cards")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function deleteDm2Card(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data: card, error: fetchError } = await supabase
    .from("dm2_cards")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  const { error } = await supabase.from("dm2_cards").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  if (card?.image_path) {
    await supabase.storage
      .from(DM2_CARD_IMAGES_BUCKET)
      .remove([card.image_path]);
  }

  revalidateDataModelV2Paths();
  return {};
}

const DM2_CARD_IMAGES_BUCKET = "dm2-card-images";

const ALLOWED_DM2_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function extensionForImageFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "jpg" || fromName === "jpeg") return "jpg";
  if (fromName === "png") return "png";
  if (fromName === "webp") return "webp";

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function dm2CardImageStoragePath(cardId: string, ext: string): string {
  return `cards/${cardId}.${ext}`;
}

export async function uploadDm2CardImage(
  cardId: string,
  formData: FormData
): Promise<{ error?: string; imagePath?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const trimmedId = cardId.trim();
  if (!trimmedId) {
    return { error: "Card id is required." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Image file is required." };
  }

  if (!ALLOWED_DM2_IMAGE_TYPES.has(file.type)) {
    return { error: "Image must be JPG, PNG, or WebP." };
  }

  const supabase = await createClient();
  const { data: existingCard, error: fetchError } = await supabase
    .from("dm2_cards")
    .select("image_path")
    .eq("id", trimmedId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!existingCard) {
    return { error: "Card not found." };
  }

  const ext = extensionForImageFile(file);
  const nextPath = dm2CardImageStoragePath(trimmedId, ext);

  const { error: uploadError } = await supabase.storage
    .from(DM2_CARD_IMAGES_BUCKET)
    .upload(nextPath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: updateError } = await supabase
    .from("dm2_cards")
    .update({
      image_path: nextPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trimmedId);

  if (updateError) {
    return { error: updateError.message };
  }

  const previousPath = existingCard.image_path;
  if (previousPath && previousPath !== nextPath) {
    await supabase.storage.from(DM2_CARD_IMAGES_BUCKET).remove([previousPath]);
  }

  revalidateDataModelV2Paths();
  return { imagePath: nextPath };
}

export async function deleteDm2CardImage(
  cardId: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const trimmedId = cardId.trim();
  if (!trimmedId) {
    return { error: "Card id is required." };
  }

  const supabase = await createClient();
  const { data: card, error: fetchError } = await supabase
    .from("dm2_cards")
    .select("image_path")
    .eq("id", trimmedId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!card) {
    return { error: "Card not found." };
  }

  if (!card.image_path) {
    return {};
  }

  const { error: updateError } = await supabase
    .from("dm2_cards")
    .update({
      image_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trimmedId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: removeError } = await supabase.storage
    .from(DM2_CARD_IMAGES_BUCKET)
    .remove([card.image_path]);

  if (removeError) {
    return { error: removeError.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function fetchDm2CardsForCardSet(
  cardSetId: string
): Promise<{ error?: string; cards?: import("@/types/data-model-v2").Dm2Card[] }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const trimmed = cardSetId.trim();
  if (!trimmed) return { error: "Card set is required." };

  const { getDm2CardsBySetId } = await import("@/lib/data-model-v2-data");
  const cards = await getDm2CardsBySetId(trimmed);
  return { cards };
}

export async function fetchDm2CardCountsBySetId(): Promise<{
  error?: string;
  counts?: Record<string, number>;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const { getDm2CardCountsBySetId } = await import("@/lib/data-model-v2-data");
  const counts = await getDm2CardCountsBySetId();
  return { counts };
}

export async function searchDm2Cards(
  query: string,
  options?: { page?: number; pageSize?: number }
): Promise<{
  error?: string;
  cards?: import("@/types/data-model-v2").Dm2CardSearchResult[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
}> {
  const trimmed = query.trim();
  const pageSize = Math.min(
    Math.max(options?.pageSize ?? DM2_CARD_SEARCH_PAGE_SIZE, 1),
    100
  );
  const page = Math.max(options?.page ?? 1, 1);

  if (trimmed.length < 2) {
    return { cards: [], totalCount: 0, page: 1, pageSize };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to search the card catalog." };
  }

  const uniqueSport = await findUniqueCatalogSport(trimmed);
  if (uniqueSport) {
    const sportCards = await listDm2CardsForSport(uniqueSport.id, {
      page,
      pageSize,
    });
    if (!sportCards.error) {
      return {
        cards: sportCards.cards ?? [],
        totalCount: sportCards.totalCount ?? 0,
        page,
        pageSize,
      };
    }
  }

  const playerSearch = await searchDm2Players(trimmed);
  const uniquePlayer = pickUniqueSearchPlayer(
    trimmed,
    playerSearch.players ?? []
  );
  if (uniquePlayer) {
    const playerCards = await listDm2CardsForPlayer(uniquePlayer.id, {
      page,
      pageSize,
    });
    if (!playerCards.error) {
      return {
        cards: playerCards.cards ?? [],
        totalCount: playerCards.totalCount ?? 0,
        page,
        pageSize,
      };
    }
  }

  const offset = (page - 1) * pageSize;

  let { data, error } = await supabase.rpc("search_dm2_cards", {
    query: trimmed,
    lim: pageSize,
    row_offset: offset,
  });

  let usesLegacySearch = false;
  if (error && /Could not find the function public\.search_dm2_cards/i.test(error.message)) {
    if (page > 1 || offset > 0) {
      return {
        error:
          "Paginated card search is not available yet. Run migration 044 in the Supabase SQL editor, then open Settings → API and reload the schema cache.",
      };
    }

    ({ data, error } = await supabase.rpc("search_dm2_cards", {
      query: trimmed,
      lim: pageSize,
    }));
    usesLegacySearch = true;
  }

  if (error) {
    return { error: formatCatalogSearchError(error.message) };
  }

  const rows = normalizeRpcRows(data);
  const totalCount = usesLegacySearch
    ? rows.length
    : rows.length > 0
      ? Number((rows[0] as { total_count?: number }).total_count ?? 0)
      : 0;

  return {
    cards: rows.map((row) =>
      mapDm2CardSearchRow(row as Parameters<typeof mapDm2CardSearchRow>[0])
    ),
    totalCount,
    page,
    pageSize,
  };
}

function mapDm2CardSearchRow(row: {
  id: string;
  card_set_id: string;
  sport: string;
  year: number;
  manufacturer: string;
  brand: string;
  card_set_category: string;
  card_set_name: string;
  card_number: string;
  player: string;
  parallel: string | null;
  image_path?: string | null;
  attribute_names?: string[] | null;
}): import("@/types/data-model-v2").Dm2CardSearchResult {
  return {
    id: row.id,
    cardSetId: row.card_set_id,
    sportName: row.sport,
    year: row.year,
    manufacturerName: row.manufacturer,
    brandName: row.brand,
    cardSetCategoryName: row.card_set_category,
    cardSetName: row.card_set_name,
    cardNumber: row.card_number,
    player: row.player,
    parallelName: row.parallel,
    imagePath: row.image_path ?? null,
    attributeNames: row.attribute_names ?? [],
  };
}

export async function getDm2CardById(
  cardId: string
): Promise<{ error?: string; card?: import("@/types/data-model-v2").Dm2CardSearchResult }> {
  const trimmed = cardId.trim();
  if (!trimmed) {
    return { error: "Card id is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to view card details." };
  }

  const { data, error } = await supabase.rpc("get_dm2_card_by_id", {
    card_id: trimmed,
  });

  if (error) {
    return { error: error.message };
  }

  const rows = normalizeRpcRows(data);
  if (rows.length === 0) {
    return { error: "Card not found." };
  }

  return {
    card: mapDm2CardSearchRow(
      rows[0] as Parameters<typeof mapDm2CardSearchRow>[0]
    ),
  };
}

export async function getDm2PlayerById(
  playerId: string
): Promise<{ error?: string; player?: import("@/types/data-model-v2").Dm2Player }> {
  const trimmed = playerId.trim();
  if (!trimmed) {
    return { error: "Player id is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to view player details." };
  }

  const select = await resolveDm2PlayerSelect();
  const { data, error } = await supabase
    .from("dm2_players")
    .select(select)
    .eq("id", trimmed)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: "Player not found." };
  }

  return {
    player: mapDm2PlayerRow(data as unknown as Parameters<typeof mapDm2PlayerRow>[0]),
  };
}

export async function listDm2ComparableCandidates(input: {
  sportId?: string | null;
  sportLabel?: string | null;
  excludePlayerId?: string | null;
  limit?: number;
}): Promise<{
  error?: string;
  players?: import("@/types/data-model-v2").Dm2ComparableCandidate[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to view comparable players." };
  }

  return {
    players: await listDm2ComparableCandidatesFromData(input),
  };
}

async function findUniqueCatalogSport(query: string): Promise<{
  id: string;
  label: string;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pick_list_options")
    .select("id, label")
    .eq("category", "sport")
    .eq("active", true)
    .limit(100);
  if (error || !data) return null;
  return pickUniqueSearchSport(query, data);
}

export async function listDm2CardsForSport(
  sportId: string,
  options?: { page?: number; pageSize?: number }
): Promise<{
  error?: string;
  cards?: import("@/types/data-model-v2").Dm2CardSearchResult[];
  totalCount?: number;
}> {
  const trimmed = sportId.trim();
  if (!trimmed) {
    return { error: "Sport id is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to search the card catalog." };
  }

  const pageSize = Math.min(Math.max(options?.pageSize ?? DM2_CARD_SEARCH_PAGE_SIZE, 1), 100);
  const page = Math.max(options?.page ?? 1, 1);
  const { data, error } = await supabase.rpc("get_dm2_cards_for_sport", {
    p_sport_id: trimmed,
    lim: pageSize,
    row_offset: (page - 1) * pageSize,
  });

  if (error) {
    return { error: formatCatalogSearchError(error.message) };
  }

  const rows = normalizeRpcRows(data);
  return {
    cards: rows.map((row) =>
      mapDm2CardSearchRow(row as Parameters<typeof mapDm2CardSearchRow>[0])
    ),
    totalCount:
      rows.length > 0
        ? Number((rows[0] as { total_count?: number }).total_count ?? rows.length)
        : 0,
  };
}

export async function listDm2CardsForPlayer(
  playerId: string,
  options?: { page?: number; pageSize?: number }
): Promise<{
  error?: string;
  cards?: import("@/types/data-model-v2").Dm2CardSearchResult[];
  totalCount?: number;
}> {
  const trimmed = playerId.trim();
  if (!trimmed) {
    return { error: "Player id is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to search the card catalog." };
  }

  const pageSize = Math.min(Math.max(options?.pageSize ?? DM2_CARD_SEARCH_PAGE_SIZE, 1), 100);
  const page = Math.max(options?.page ?? 1, 1);
  const { data, error } = await supabase.rpc("get_dm2_cards_for_player", {
    p_player_id: trimmed,
    lim: pageSize,
    row_offset: (page - 1) * pageSize,
  });

  if (error) {
    return { error: error.message };
  }

  const rows = normalizeRpcRows(data);
  return {
    cards: rows.map((row) =>
      mapDm2CardSearchRow(row as Parameters<typeof mapDm2CardSearchRow>[0])
    ),
    totalCount:
      rows.length > 0
        ? Number((rows[0] as { total_count?: number }).total_count ?? rows.length)
        : 0,
  };
}

export async function resolveDm2PlayerForHoldings(input: {
  playerId?: string | null;
  playerName: string;
  sport: string;
}): Promise<{ error?: string; player?: { id: string; name: string } }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to link a holdings player." };
  }

  const sportLabel = input.sport.trim();
  if (!sportLabel) {
    return { error: "Sport is required." };
  }

  const select = await resolveDm2PlayerSelect();

  if (input.playerId?.trim()) {
    const { data, error } = await supabase
      .from("dm2_players")
      .select(select)
      .eq("id", input.playerId.trim())
      .eq("active", true)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Catalog player not found." };
    const player = mapDm2PlayerRow(data as unknown as Parameters<typeof mapDm2PlayerRow>[0]);
    if (normalizePlayerNameKey(player.sportName) !== normalizePlayerNameKey(sportLabel)) {
      return { error: "That catalog player is not in the selected sport." };
    }
    return { player: { id: player.id, name: player.name } };
  }

  const nameKey = normalizePlayerNameKey(input.playerName);
  if (!nameKey) {
    return { error: "Select a catalog player." };
  }

  const sportId = await resolveDm2SportId(sportLabel);
  if (!sportId) {
    return { error: "Select a catalog player. That sport has no Player table entries yet." };
  }

  const { data, error } = await supabase
    .from("dm2_players")
    .select(select)
    .eq("sport_id", sportId)
    .eq("name_key", nameKey)
    .eq("active", true)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) {
    return {
      error:
        "That player is not in the catalog. Add them on the Data Model v2 Players table first.",
    };
  }

  const player = mapDm2PlayerRow(data as unknown as Parameters<typeof mapDm2PlayerRow>[0]);
  return { player: { id: player.id, name: player.name } };
}

export async function searchDm2Players(
  query: string
): Promise<{ error?: string; players?: import("@/types/data-model-v2").Dm2PlayerSearchResult[] }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { players: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to search the card catalog." };
  }

  const { data, error } = await supabase.rpc("search_dm2_players", {
    query: trimmed,
    lim: 50,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    players: normalizeRpcRows(data).map(
      (row: {
        id: string;
        player: string;
        sport: string;
        sport_id: string;
        image_path: string | null;
        card_count: number;
      }) => ({
        id: row.id,
        player: row.player,
        sport: row.sport,
        sportId: row.sport_id,
        imagePath: row.image_path ?? null,
        cardCount: Number(row.card_count),
      })
    ),
  };
}

export async function searchDm2Sports(
  query: string
): Promise<{ error?: string; sports?: import("@/types/data-model-v2").Dm2SportSearchResult[] }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { sports: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to search the card catalog." };
  }

  const tokens = cardSearchTokens(trimmed);
  const { data, error } = await supabase
    .from("pick_list_options")
    .select("label")
    .eq("category", "sport")
    .eq("active", true)
    .limit(100);

  if (error) {
    return { error: formatCatalogSearchError(error.message) };
  }

  const sports = (data ?? [])
    .filter((row) =>
      tokens.every((token) => row.label.toLowerCase().includes(token))
    )
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 50)
    .map((row) => ({
      sport: row.label,
      cardSetCount: 0,
      cardCount: 0,
    }));

  return { sports };
}

export async function searchDm2CardsForPopulation(
  query: string,
  options?: { page?: number; pageSize?: number }
): Promise<{
  error?: string;
  cards?: import("@/types/data-model-v2").Dm2CardPopulationSearchResult[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const trimmed = query.trim();
  const pageSize = Math.min(
    Math.max(options?.pageSize ?? DM2_CARD_SEARCH_PAGE_SIZE, 1),
    100
  );
  const page = Math.max(options?.page ?? 1, 1);

  if (trimmed.length < 2) {
    return { cards: [], totalCount: 0, page, pageSize };
  }

  const supabase = await createClient();
  try {
    const result = await searchCardsForPopulation(supabase, trimmed, { page, pageSize });
    return {
      cards: result.cards,
      totalCount: result.totalCount,
      page,
      pageSize,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Card search failed.";
    if (/fetch failed/i.test(message)) {
      return {
        error: "Search request was too large. Try a more specific player or set name.",
        page,
        pageSize,
      };
    }
    if (/does not exist/i.test(message)) {
      return {
        error:
          "Card population search is missing an index or table. Run supabase/migrations/056_dm2_card_populations.sql and 057_dm2_card_population_search.sql in the Supabase SQL editor.",
      };
    }
    return { error: message, page, pageSize };
  }
}

export async function getDm2CardPopulation(cardId: string): Promise<{
  error?: string;
  card?: import("@/types/data-model-v2").Dm2CardSearchResult;
  population?: import("@/types/data-model-v2").Dm2CardPopulation | null;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const found = await getDm2CardById(cardId);
  if (found.error) return found;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dm2_card_populations")
    .select("*")
    .eq("card_id", cardId.trim())
    .maybeSingle();

  if (error) {
    if (/does not exist/i.test(error.message)) {
      return {
        error:
          "Card population table is missing. Run supabase/migrations/056_dm2_card_populations.sql in the Supabase SQL editor.",
      };
    }
    return { error: error.message };
  }

  return {
    card: found.card,
    population: data
      ? {
          cardId: data.card_id,
          counts: rowToPopulationCounts(data),
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      : null,
  };
}

export async function upsertDm2CardPopulation(input: {
  cardId: string;
  form: Record<string, string | number | null | undefined>;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const cardId = input.cardId.trim();
  if (!isCardUuid(cardId)) {
    return { error: "A valid card id is required." };
  }

  const parsed = parsePopulationForm(input.form);
  if (parsed.error) return { error: parsed.error };

  const found = await getDm2CardById(cardId);
  if (found.error) return found;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const row: Record<string, string | number | null> = {
    card_id: cardId,
    updated_at: now,
  };
  for (const key of CARD_POPULATION_KEYS) {
    row[key] = parsed.counts[key];
  }

  const { error } = await supabase.from("dm2_card_populations").upsert(row, {
    onConflict: "card_id",
  });

  if (error) {
    if (error.code === "23503") {
      return { error: "That card does not exist." };
    }
    if (error.code === "23514") {
      return { error: "Population counts cannot be negative." };
    }
    if (error.code === "22P02") {
      return { error: "Population counts must be whole numbers." };
    }
    if (/does not exist/i.test(error.message)) {
      return {
        error:
          "Card population table is missing. Run supabase/migrations/056_dm2_card_populations.sql in the Supabase SQL editor.",
      };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return {};
}

export async function saveDm2CardSetPsaHeading(input: {
  cardSetId: string;
  heading: string;
}): Promise<{ error?: string; psaHeadingId?: number | null }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const cardSetId = input.cardSetId.trim();
  if (!cardSetId) return { error: "Card set is required." };

  const raw = input.heading.trim();
  const headingId = raw ? parsePsaHeadingId(raw) : null;
  if (raw && headingId == null) {
    return { error: "Enter a PSA heading id or a /pop/.../154126 URL." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("dm2_card_sets")
    .update({
      psa_heading_id: headingId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardSetId);

  if (error) {
    if (/psa_heading_id|column .* does not exist/i.test(error.message)) {
      return {
        error:
          "Card set heading column is missing. Run supabase/migrations/060_dm2_card_set_psa_heading.sql in the Supabase SQL editor.",
      };
    }
    if (error.code === "23505") {
      return { error: "That PSA heading id is already linked to another card set." };
    }
    return { error: error.message };
  }

  revalidateDataModelV2Paths();
  return { psaHeadingId: headingId };
}

export async function ingestPsaPopulationJson(input: {
  cardSetId: string;
  jsonText: string;
  writeAuto?: boolean;
}): Promise<{
  error?: string;
  headingId?: number | null;
  candidates?: number;
  wrote?: number;
  auto?: number;
  review?: number;
  reject?: number;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const cardSetId = input.cardSetId.trim();
  if (!cardSetId) return { error: "Card set is required." };

  let json: unknown;
  try {
    json = JSON.parse(input.jsonText);
  } catch {
    return { error: "Population JSON is not valid JSON." };
  }

  const supabase = await createClient();
  const { data: setRow, error: setError } = await supabase
    .from("dm2_card_sets")
    .select(
      "id, year, psa_heading_id, dm2_brands(name, dm2_manufacturers(name)), dm2_card_set_names(name), pick_list_options(label)"
    )
    .eq("id", cardSetId)
    .maybeSingle();

  if (setError) return { error: setError.message };
  if (!setRow) return { error: "Card set not found." };

  const brand = Array.isArray(setRow.dm2_brands) ? setRow.dm2_brands[0] : setRow.dm2_brands;
  const manufacturerRel = (brand as { dm2_manufacturers?: unknown } | null)?.dm2_manufacturers;
  const manufacturer = Array.isArray(manufacturerRel) ? manufacturerRel[0] : manufacturerRel;
  const setNameRel = Array.isArray(setRow.dm2_card_set_names)
    ? setRow.dm2_card_set_names[0]
    : setRow.dm2_card_set_names;
  const sportRel = Array.isArray(setRow.pick_list_options)
    ? setRow.pick_list_options[0]
    : setRow.pick_list_options;

  const cards = await getDm2CardsBySetId(cardSetId);
  const identities: CatalogCardIdentity[] = cards.map((card) => ({
    id: card.id,
    sportName: (sportRel as { label?: string } | null)?.label ?? "Basketball",
    year: Number(setRow.year),
    manufacturerName: (manufacturer as { name?: string } | null)?.name ?? "",
    brandName: (brand as { name?: string } | null)?.name ?? "",
    cardSetName: (setNameRel as { name?: string } | null)?.name ?? card.cardSetLabel,
    cardNumber: card.cardNumber,
    player: card.player,
    parallelName: card.parallelName,
  }));

  const setName = `${setRow.year} ${(brand as { name?: string } | null)?.name ?? ""} ${(setNameRel as { name?: string } | null)?.name ?? ""}`.trim();
  const plan = planPsaPopulationIngest({
    json,
    setName,
    headingId: (setRow as { psa_heading_id?: number | null }).psa_heading_id ?? null,
    cards: identities,
  });

  if (!input.writeAuto) {
    return {
      headingId: plan.headingId,
      candidates: plan.candidates,
      wrote: 0,
      auto: plan.auto.length,
      review: plan.review.length,
      reject: plan.reject.length,
    };
  }

  let wrote = 0;
  for (const proposal of plan.auto) {
    if (!proposal.cardId) continue;
    const existing = await supabase
      .from("dm2_card_populations")
      .select("*")
      .eq("card_id", proposal.cardId)
      .maybeSingle();
    if (existing.error && /does not exist/i.test(existing.error.message)) {
      return {
        error:
          "Card population table is missing. Run supabase/migrations/056_dm2_card_populations.sql in the Supabase SQL editor.",
      };
    }
    const merged = mergePsaCounts(
      existing.data ? rowToPopulationCounts(existing.data) : null,
      proposal.psaCounts
    );
    const row: Record<string, string | number | null> = {
      card_id: proposal.cardId,
      updated_at: new Date().toISOString(),
    };
    for (const key of CARD_POPULATION_KEYS) {
      row[key] = merged[key];
    }
    const { error } = await supabase.from("dm2_card_populations").upsert(row, {
      onConflict: "card_id",
    });
    if (error) return { error: error.message };
    wrote += 1;
  }

  revalidateDataModelV2Paths();
  return {
    headingId: plan.headingId,
    candidates: plan.candidates,
    wrote,
    auto: plan.auto.length,
    review: plan.review.length,
    reject: plan.reject.length,
  };
}

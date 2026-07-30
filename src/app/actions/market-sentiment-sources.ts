"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";

import { isMissingSentimentSourcesTableError } from "@/lib/market-sentiment-defaults";
const MAX_NAME_LENGTH = 100;
const MAX_SLUG_LENGTH = 50;
const MIGRATION_HINT =
  "Apply supabase/migrations/038_market_sentiment_sources.sql in Supabase first.";
const MAX_DESCRIPTION_LENGTH = 500;

async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Unauthorized" as const };
  }
  return { error: null };
}

function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function revalidateSentimentPaths() {
  revalidatePath("/admin");
  revalidatePath("/market-research");
}

async function getAllSourcesForValidation() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_sentiment_sources")
    .select("id, active, weight_percent");

  if (error) return { error: error.message as string, sources: null };
  return { error: null, sources: data ?? [] };
}

async function computeActiveWeightTotal(options?: {
  overrideId?: string;
  overrideWeight?: number;
  overrideActive?: boolean;
  additionalActiveWeight?: number;
}): Promise<{ error: string | null; total: number }> {
  const result = await getAllSourcesForValidation();
  if (result.error || !result.sources) {
    return { error: result.error ?? "Validation failed.", total: 0 };
  }

  let total = result.sources.reduce((sum, source) => {
    if (options?.overrideId && source.id === options.overrideId) {
      const active = options.overrideActive ?? source.active;
      if (!active) return sum;
      return sum + (options.overrideWeight ?? source.weight_percent);
    }
    return source.active ? sum + source.weight_percent : sum;
  }, 0);

  if (!options?.overrideId && options?.additionalActiveWeight) {
    total += options.additionalActiveWeight;
  }

  return { error: null, total };
}

async function ensureActiveWeightsTotal100(options?: {
  overrideId?: string;
  overrideWeight?: number;
  overrideActive?: boolean;
  additionalActiveWeight?: number;
}): Promise<string | null> {
  const { error, total } = await computeActiveWeightTotal(options);
  if (error) return error;
  if (total !== 100) {
    return `Active source weights must sum to 100 (currently ${total}).`;
  }
  return null;
}

export async function createMarketSentimentSource(input: {
  slug: string;
  name: string;
  description?: string;
  weightPercent: number;
  active?: boolean;
  sortOrder?: number;
  config?: Record<string, unknown>;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const slug = normalizeSlug(input.slug);
  const name = input.name.trim();
  const description = (input.description ?? "").trim();

  if (!slug) return { error: "Slug is required." };
  if (!name) return { error: "Name is required." };
  if (slug.length > MAX_SLUG_LENGTH) {
    return { error: `Slug must be ${MAX_SLUG_LENGTH} characters or fewer.` };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
    };
  }
  if (input.weightPercent < 0 || input.weightPercent > 100) {
    return { error: "Weight must be between 0 and 100." };
  }

  if (input.active !== false) {
    const validationError = await ensureActiveWeightsTotal100({
      additionalActiveWeight: input.weightPercent,
    });
    if (validationError) return { error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("market_sentiment_sources").insert({
    slug,
    name,
    description,
    weight_percent: input.weightPercent,
    active: input.active ?? true,
    sort_order: input.sortOrder ?? 0,
    config: input.config ?? {},
  });

  if (error) {
    if (error.code === "23505") return { error: "A source with that slug already exists." };
    return { error: error.message };
  }

  revalidateSentimentPaths();
  return {};
}

export async function updateMarketSentimentSource(input: {
  id: string;
  slug?: string;
  name?: string;
  description?: string;
  weightPercent?: number;
  sortOrder?: number;
  config?: Record<string, unknown>;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("market_sentiment_sources")
    .select("active, weight_percent")
    .eq("id", input.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Source not found." };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.slug != null) {
    const slug = normalizeSlug(input.slug);
    if (!slug) return { error: "Slug is required." };
    update.slug = slug;
  }
  if (input.name != null) {
    const name = input.name.trim();
    if (!name) return { error: "Name is required." };
    update.name = name;
  }
  if (input.description != null) update.description = input.description.trim();
  if (input.sortOrder != null) update.sort_order = input.sortOrder;
  if (input.config != null) update.config = input.config;

  const nextWeight = input.weightPercent ?? existing.weight_percent;
  if (input.weightPercent != null) {
    if (input.weightPercent < 0 || input.weightPercent > 100) {
      return { error: "Weight must be between 0 and 100." };
    }
    update.weight_percent = input.weightPercent;
  }

  if (existing.active) {
    const validationError = await ensureActiveWeightsTotal100({
      overrideId: input.id,
      overrideWeight: nextWeight,
      overrideActive: true,
    });
    if (validationError) return { error: validationError };
  }

  const { error } = await supabase
    .from("market_sentiment_sources")
    .update(update)
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") return { error: "A source with that slug already exists." };
    return { error: error.message };
  }

  revalidateSentimentPaths();
  return {};
}

export async function setMarketSentimentSourceActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("market_sentiment_sources")
    .select("weight_percent")
    .eq("id", input.id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Source not found." };

  if (input.active) {
    const validationError = await ensureActiveWeightsTotal100({
      overrideId: input.id,
      overrideWeight: existing.weight_percent,
      overrideActive: true,
    });
    if (validationError) return { error: validationError };
  } else {
    const { total } = await computeActiveWeightTotal({
      overrideId: input.id,
      overrideActive: false,
    });
    if (total !== 0 && total !== 100) {
      return {
        error: `Active source weights must sum to 100 (currently ${total} after inactivating this source).`,
      };
    }
  }

  const { error } = await supabase
    .from("market_sentiment_sources")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { error: error.message };

  revalidateSentimentPaths();
  return {};
}

export async function deleteMarketSentimentSource(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("market_sentiment_sources")
    .select("active")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "Source not found." };

  const { error } = await supabase.from("market_sentiment_sources").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateSentimentPaths();
  return {};
}

export async function validateMarketSentimentSourceWeights(): Promise<{
  error?: string;
  total?: number;
  valid?: boolean;
}> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const result = await getAllSourcesForValidation();
  if (result.error || !result.sources) return { error: result.error ?? "Validation failed." };

  const { total, error: totalError } = await computeActiveWeightTotal();
  if (totalError) return { error: totalError };

  return {
    total,
    valid: total === 100,
    error: total === 100 ? undefined : `Active source weights must sum to 100 (currently ${total}).`,
  };
}

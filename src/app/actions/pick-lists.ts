"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";
import type { PickListCategory } from "@/types/pick-list";

async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Unauthorized" as const };
  }
  return { error: null };
}

function normalizeLabel(label: string): string {
  return label.trim();
}

function revalidatePickListPaths() {
  revalidatePath("/admin");
  revalidatePath("/cards/new");
  revalidatePath("/cards/[id]/edit", "page");
  revalidatePath("/cards/[id]", "page");
  for (const path of ["/collection", "/holdings", "/dashboard", "/admin"]) {
    revalidatePath(path, "layout");
  }
}

export async function createPickListOption(input: {
  category: PickListCategory;
  label: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const label = normalizeLabel(input.label);
  if (!label) {
    return { error: "Label is required." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("pick_list_options")
    .select("sort_order")
    .eq("category", input.category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (existing?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("pick_list_options").insert({
    category: input.category,
    label,
    sort_order: sortOrder,
    active: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That option already exists for this pick list." };
    }
    return { error: error.message };
  }

  revalidatePickListPaths();
  return {};
}

export async function updatePickListOption(input: {
  id: string;
  label: string;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const label = normalizeLabel(input.label);
  if (!label) {
    return { error: "Label is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pick_list_options")
    .update({
      label,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "That option already exists for this pick list." };
    }
    return { error: error.message };
  }

  revalidatePickListPaths();
  return {};
}

export async function setPickListOptionActive(input: {
  id: string;
  active: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("pick_list_options")
    .update({
      active: input.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePickListPaths();
  return {};
}

export async function deletePickListOption(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase
    .from("pick_list_options")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePickListPaths();
  return {};
}

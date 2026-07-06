"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";
import type { UserRole } from "@/types/user";

async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Unauthorized" as const };
  }
  return { error: null };
}

export async function updateAdminUser(input: {
  userId: string;
  displayName?: string;
  role?: UserRole;
  active?: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_user", {
    p_user_id: input.userId,
    p_display_name: input.displayName ?? null,
    p_role: input.role ?? null,
    p_active: input.active ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  return {};
}

export async function deleteAdminUser(userId: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return auth;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_user", {
    p_user_id: userId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  return {};
}

export async function inactivateAdminUser(userId: string): Promise<{ error?: string }> {
  return updateAdminUser({ userId, active: false });
}

export async function activateAdminUser(userId: string): Promise<{ error?: string }> {
  return updateAdminUser({ userId, active: true });
}

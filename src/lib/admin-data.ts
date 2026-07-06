import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";
import type { AdminUser } from "@/types/admin";
import type { UserRole } from "@/types/user";

export async function getAdminUsers(): Promise<AdminUser[]> {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");

  if (error) {
    console.error("Failed to load admin users:", error.message);
    return [];
  }

  return (data ?? []).map((row: {
    id: string;
    username: string;
    email: string;
    active: boolean;
    last_login_at: string | null;
    role: UserRole;
  }) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    active: row.active,
    lastLoginAt: row.last_login_at,
    role: row.role,
  }));
}

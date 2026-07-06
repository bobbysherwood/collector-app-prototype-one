import type { UserRole } from "@/types/user";

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  active: boolean;
  lastLoginAt: string | null;
  role: UserRole;
}

export function activeLabel(active: boolean): "Y" | "N" {
  return active ? "Y" : "N";
}

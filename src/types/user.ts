export type UserRole = "user" | "admin";

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

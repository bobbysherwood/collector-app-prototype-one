export type AdminSection =
  | "users"
  | "card-repository"
  | "user-configurations"
  | "holdings-pick-lists"
  | "data-model-v2"
  | "ai-indexes";

export const DEFAULT_ADMIN_SECTION: AdminSection = "users";

const ADMIN_SECTION_SET = new Set<string>([
  "users",
  "card-repository",
  "user-configurations",
  "holdings-pick-lists",
  "data-model-v2",
  "ai-indexes",
]);

export function parseAdminSection(value: string | undefined): AdminSection {
  if (value && ADMIN_SECTION_SET.has(value)) {
    return value as AdminSection;
  }
  return DEFAULT_ADMIN_SECTION;
}

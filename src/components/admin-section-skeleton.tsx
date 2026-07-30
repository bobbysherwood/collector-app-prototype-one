import type { AdminSection } from "@/lib/admin-sections";

const SECTION_LABELS: Record<AdminSection, string> = {
  users: "Users",
  "card-repository": "Card Repository",
  "user-configurations": "User Configurations",
  "holdings-pick-lists": "Holdings Pick Lists",
  "data-model-v2": "Data Model v2",
  "ai-indexes": "AI Indexes",
};

export function AdminSectionSkeleton({ section }: { section: AdminSection }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div
        className="animate-pulse rounded-xl bg-muted/60"
        aria-busy="true"
        aria-label={`Loading ${SECTION_LABELS[section]}`}
      >
        <div className="h-64" />
      </div>
    </div>
  );
}

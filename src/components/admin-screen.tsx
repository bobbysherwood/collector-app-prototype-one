"use client";

import { useState } from "react";
import { ClipboardList, Database, Library, SlidersHorizontal, Users } from "lucide-react";
import { AdminDataModelV2Panel } from "@/components/admin-data-model-v2-panel";
import { AdminHoldingsPickListsPanel } from "@/components/admin-holdings-pick-lists-panel";
import { AdminUserConfigurationsPanel } from "@/components/admin-user-configurations-panel";
import { AdminCardRepositoryPanel } from "@/components/admin-card-repository-panel";
import { AdminUsersTable } from "@/components/admin-users-table";
import type { AdminUser } from "@/types/admin";
import type { UserFeatureSettingsMap } from "@/types/ai-features";
import type {
  Dm2Brand,
  Dm2CardSet,
  Dm2CardSetCategory,
  Dm2CardSetName,
  Dm2Manufacturer,
  Dm2Parallel,
} from "@/types/data-model-v2";
import type { AdminPickLists } from "@/types/pick-list";
import type { CardRepositorySetSummary } from "@/types/card-repository";
import { cn } from "@/lib/utils";

type AdminSection =
  | "users"
  | "card-repository"
  | "user-configurations"
  | "holdings-pick-lists"
  | "data-model-v2";

const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
  { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
  {
    id: "card-repository",
    label: "Card Repository",
    icon: <Library className="h-4 w-4" />,
  },
  {
    id: "user-configurations",
    label: "User Configurations",
    icon: <SlidersHorizontal className="h-4 w-4" />,
  },
  {
    id: "holdings-pick-lists",
    label: "Holdings Pick Lists",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    id: "data-model-v2",
    label: "Data Model v2",
    icon: <Database className="h-4 w-4" />,
  },
];

export function AdminScreen({
  users,
  cardRepositorySets,
  userFeatureSettingsByUserId,
  pickLists,
  cardSetCategories,
  cardSetNames,
  manufacturers,
  brands,
  parallels,
  cardSets,
}: {
  users: AdminUser[];
  cardRepositorySets: CardRepositorySetSummary[];
  userFeatureSettingsByUserId: UserFeatureSettingsMap;
  pickLists: AdminPickLists;
  cardSetCategories: Dm2CardSetCategory[];
  cardSetNames: Dm2CardSetName[];
  manufacturers: Dm2Manufacturer[];
  brands: Dm2Brand[];
  parallels: Dm2Parallel[];
  cardSets: Dm2CardSet[];
}) {
  const [section, setSection] = useState<AdminSection>("users");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Screen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage application users and settings
        </p>
      </div>

      <div className="flex min-h-[560px] overflow-hidden rounded-xl border border-border bg-card">
        <aside className="w-56 shrink-0 border-r border-border bg-muted/20 p-4">
          <p className="mb-3 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Menu
          </p>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  section === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 p-6">
          {section === "users" ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Users</h2>
                <p className="text-sm text-muted-foreground">
                  View and manage registered users
                </p>
              </div>
              <AdminUsersTable users={users} />
            </div>
          ) : section === "card-repository" ? (
            <AdminCardRepositoryPanel sets={cardRepositorySets} />
          ) : section === "user-configurations" ? (
            <AdminUserConfigurationsPanel
              users={users}
              initialSettingsByUserId={userFeatureSettingsByUserId}
            />
          ) : section === "holdings-pick-lists" ? (
            <AdminHoldingsPickListsPanel initialPickLists={pickLists} />
          ) : section === "data-model-v2" ? (
            <AdminDataModelV2Panel
              sports={pickLists.sport}
              cardSetCategories={cardSetCategories}
              cardSetNames={cardSetNames}
              manufacturers={manufacturers}
              brands={brands}
              parallels={parallels}
              cardSets={cardSets}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}


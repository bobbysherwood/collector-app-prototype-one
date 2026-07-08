"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { updateUserFeatureSettings } from "@/app/actions/ai-features";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminUser } from "@/types/admin";
import {
  DEFAULT_AI_FEATURE_SETTINGS,
  type AiFeatureSettings,
  type UserFeatureSettingsMap,
} from "@/types/ai-features";
import { cn } from "@/lib/utils";

interface FeatureToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function FeatureToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: FeatureToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-background px-3 py-3">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function matchesUserSearch(user: AdminUser, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = [user.username, user.email, user.role]
    .join(" ")
    .toLowerCase();

  return trimmed.split(/\s+/).every((token) => haystack.includes(token));
}

export function AdminUserConfigurationsPanel({
  users,
  initialSettingsByUserId,
}: {
  users: AdminUser[];
  initialSettingsByUserId: UserFeatureSettingsMap;
}) {
  const [settingsByUserId, setSettingsByUserId] =
    useState<UserFeatureSettingsMap>(initialSettingsByUserId);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(
    () => users.filter((user) => matchesUserSearch(user, search)),
    [users, search]
  );

  function getSettingsForUser(userId: string): AiFeatureSettings {
    return settingsByUserId[userId] ?? DEFAULT_AI_FEATURE_SETTINGS;
  }

  async function handleToggle(
    userId: string,
    key: keyof AiFeatureSettings,
    checked: boolean
  ) {
    const previous = getSettingsForUser(userId);
    const next = { ...previous, [key]: checked };
    const savingId = `${userId}:${key}`;

    setSettingsByUserId((current) => ({
      ...current,
      [userId]: next,
    }));
    setSavingKey(savingId);
    setError(null);

    const result = await updateUserFeatureSettings(userId, next);

    setSavingKey(null);

    if (result.error) {
      setSettingsByUserId((current) => ({
        ...current,
        [userId]: previous,
      }));
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SlidersHorizontal className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">User Configurations</h2>
          <p className="text-sm text-muted-foreground">
            Configure which features are visible for each user
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search users by name or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium">No users found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Users will appear here once accounts are registered.
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium">No matching users</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredUsers.map((user) => {
            const settings = getSettingsForUser(user.id);

            return (
              <li
                key={user.id}
                className="overflow-hidden rounded-xl border border-border/80 bg-muted/20"
              >
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{user.username}</p>
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {user.role === "admin" ? "Admin" : "User"}
                        </Badge>
                        {!user.active ? (
                          <Badge variant="outline" className="text-[10px]">
                            Inactive
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>

                  <div className="space-y-2 border-t border-border/80 bg-background px-4 py-3">
                    <FeatureToggle
                      id={`${user.id}-portfolio-insights`}
                      label="Portfolio Insights"
                      description="Show the Portfolio Insights tile on this user's Dashboard."
                      checked={settings.portfolioInsightsEnabled}
                      disabled={
                        savingKey === `${user.id}:portfolioInsightsEnabled`
                      }
                      onCheckedChange={(checked) =>
                        handleToggle(
                          user.id,
                          "portfolioInsightsEnabled",
                          checked
                        )
                      }
                    />
                    <FeatureToggle
                      id={`${user.id}-market-research`}
                      label="Market Research"
                      description="Show the Market Research tab in this user's navigation."
                      checked={settings.marketResearchEnabled}
                      disabled={savingKey === `${user.id}:marketResearchEnabled`}
                      onCheckedChange={(checked) =>
                        handleToggle(user.id, "marketResearchEnabled", checked)
                      }
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

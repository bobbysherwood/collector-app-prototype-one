"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { UploadCardSetDialog } from "@/components/upload-card-set-dialog";
import { AdminCardRepositoryTable } from "@/components/admin-card-repository-table";
import { Input } from "@/components/ui/input";
import type { CardRepositorySetSummary } from "@/types/card-repository";

function matchesSetSearch(set: CardRepositorySetSummary, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = [
    set.category,
    String(set.year),
    set.manufacturer,
    set.brand,
    set.cardSet,
  ]
    .join(" ")
    .toLowerCase();

  return trimmed
    .split(/\s+/)
    .every((token) => haystack.includes(token));
}

export function AdminCardRepositoryPanel({
  sets,
}: {
  sets: CardRepositorySetSummary[];
}) {
  const [search, setSearch] = useState("");

  const filteredSets = useMemo(
    () => sets.filter((set) => matchesSetSearch(set, search)),
    [sets, search]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Card Repository</h2>
          <p className="text-sm text-muted-foreground">
            Manage the master checklist of card sets and individual cards
          </p>
        </div>
        <UploadCardSetDialog />
      </div>

      {sets.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search category, year, manufacturer, brand, or card set…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {sets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium">No card sets yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use Upload Card Set to create the first repository entry.
          </p>
        </div>
      ) : filteredSets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium">No matching card sets</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      ) : (
        <AdminCardRepositoryTable sets={filteredSets} />
      )}
    </div>
  );
}

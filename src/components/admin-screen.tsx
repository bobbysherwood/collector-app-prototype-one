"use client";

import Link from "next/link";
import {
  ClipboardList,
  Database,
  Library,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import type { AdminSection } from "@/lib/admin-sections";
import { cn } from "@/lib/utils";

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
  {
    id: "ai-indexes",
    label: "AI Indexes",
    icon: <Sparkles className="h-4 w-4" />,
  },
];

interface AdminScreenProps {
  activeSection: AdminSection;
  children: React.ReactNode;
}

export function AdminScreen({ activeSection, children }: AdminScreenProps) {
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
              <Link
                key={item.id}
                href={`/admin/${item.id}`}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 p-6">{children}</section>
      </div>
    </div>
  );
}

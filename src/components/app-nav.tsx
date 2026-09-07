"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Layers, LineChart, Plus, LogOut, Shield, User } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

interface AppNavProps {
  email: string;
  displayName: string;
  isAdmin?: boolean;
  showMarketResearch?: boolean;
}

export function AppNav({
  email,
  displayName,
  isAdmin = false,
  showMarketResearch = true,
}: AppNavProps) {
  const pathname = usePathname();
  const hideAddAsset =
    pathname === "/cards/new" || /^\/cards\/[^/]+\/edit$/.test(pathname);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-card/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              CP
            </div>
            <span className="hidden font-semibold tracking-tight sm:inline">
              CardPortfolio
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <Button
              render={<Link href="/dashboard" />}
              nativeButton={false}
              variant="ghost"
              className="gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <Button
              render={<Link href="/holdings" />}
              nativeButton={false}
              variant="ghost"
              className="gap-2"
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Holdings</span>
            </Button>
            {showMarketResearch ? (
              <Button
                render={<Link href="/market-research" />}
                nativeButton={false}
                variant="ghost"
                className="gap-2"
              >
                <LineChart className="h-4 w-4" />
                <span className="hidden sm:inline">Market Research</span>
              </Button>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {!hideAddAsset && (
            <Button render={<Link href="/cards/new" />} nativeButton={false} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Asset</span>
            </Button>
          )}
          <details className="relative">
            <summary
              className={cn(
                buttonVariants({ variant: "outline" }),
                "max-w-[200px] cursor-pointer list-none truncate [&::-webkit-details-marker]:hidden"
              )}
            >
              {displayName}
            </summary>
            <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
              <div className="my-1 h-px bg-border" />
              {isAdmin ? (
                <Link
                  href="/admin/users"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              ) : null}
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

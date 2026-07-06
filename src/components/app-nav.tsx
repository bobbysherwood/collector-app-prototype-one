"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Layers, LineChart, Plus, LogOut, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/actions/auth";

interface AppNavProps {
  email: string;
  displayName: string;
  isAdmin?: boolean;
}

export function AppNav({ email, displayName, isAdmin = false }: AppNavProps) {
  const router = useRouter();
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
            <Button
              render={<Link href="/market-research" />}
              nativeButton={false}
              variant="ghost"
              className="gap-2"
            >
              <LineChart className="h-4 w-4" />
              <span className="hidden sm:inline">Market Research</span>
            </Button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {!hideAddAsset && (
            <Button render={<Link href="/cards/new" />} nativeButton={false} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Asset</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="outline-none"
              render={
                <Button
                  variant="outline"
                  className="max-w-[200px] truncate"
                />
              }
            >
              {displayName}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{email}</p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {isAdmin ? (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => router.push("/admin")}
                  >
                    <Shield className="h-4 w-4" />
                    Admin Screen
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => router.push("/profile")}
                >
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    const form = document.getElementById(
                      "sign-out-form"
                    ) as HTMLFormElement;
                    form?.requestSubmit();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <form id="sign-out-form" action={signOut} className="hidden" />
        </div>
      </div>
    </header>
  );
}

import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { getCurrentUser, getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getUserProfile();

  return (
    <div className="flex min-h-full flex-col">
      <AppNav
        email={profile?.email ?? user.email ?? ""}
        displayName={
          profile?.displayName ??
          (user.user_metadata?.display_name as string | undefined) ??
          user.email?.split("@")[0] ??
          "Account"
        }
        isAdmin={isAdminRole(profile?.role)}
      />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
      </main>
    </div>
  );
}

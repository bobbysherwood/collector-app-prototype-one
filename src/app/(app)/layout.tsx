import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { PickListsProvider } from "@/components/pick-lists-provider";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";
import { getUserProfile } from "@/lib/data";
import { getActivePickLists } from "@/lib/pick-list-data";
import { isAdminRole } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  const [aiFeatureSettings, pickLists] = await Promise.all([
    getAiFeatureSettings(),
    getActivePickLists(),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <AppNav
        email={profile.email}
        displayName={profile.displayName}
        isAdmin={isAdminRole(profile.role)}
        showMarketResearch={aiFeatureSettings.marketResearchEnabled}
      />
      <main className="flex-1">
        <PickListsProvider pickLists={pickLists}>
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
        </PickListsProvider>
      </main>
    </div>
  );
}

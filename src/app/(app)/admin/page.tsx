import { redirect } from "next/navigation";
import { AdminScreen } from "@/components/admin-screen";
import { getAdminUsers } from "@/lib/admin-data";
import { getAdminUserFeatureSettingsMap } from "@/lib/ai-feature-settings";
import { getCardRepositorySets } from "@/lib/card-repository-data";
import { getAdminPickLists } from "@/lib/pick-list-data";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";

export default async function AdminPage() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    redirect("/dashboard");
  }

  const [users, cardRepositorySets, userFeatureSettingsByUserId, pickLists] =
    await Promise.all([
      getAdminUsers(),
      getCardRepositorySets(),
      getAdminUserFeatureSettingsMap(),
      getAdminPickLists(),
    ]);

  return (
    <AdminScreen
      users={users}
      cardRepositorySets={cardRepositorySets}
      userFeatureSettingsByUserId={userFeatureSettingsByUserId}
      pickLists={pickLists}
    />
  );
}

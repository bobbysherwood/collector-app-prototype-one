import { redirect } from "next/navigation";
import { AdminScreen } from "@/components/admin-screen";
import { getAdminUsers } from "@/lib/admin-data";
import { getAdminUserFeatureSettingsMap } from "@/lib/ai-feature-settings";
import { getCardRepositorySets } from "@/lib/card-repository-data";
import { getAdminPickLists } from "@/lib/pick-list-data";
import {
  getDm2Brands,
  getDm2CardCountsBySetId,
  getDm2CardSets,
  getDm2CardSetCategories,
  getDm2CardSetNames,
  getDm2Manufacturers,
  getDm2Parallels,
} from "@/lib/data-model-v2-data";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";

export default async function AdminPage() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    redirect("/dashboard");
  }

  const [
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
    cardCountsBySetId,
  ] = await Promise.all([
    getAdminUsers(),
    getCardRepositorySets(),
    getAdminUserFeatureSettingsMap(),
    getAdminPickLists(),
    getDm2CardSetCategories(),
    getDm2CardSetNames(),
    getDm2Manufacturers(),
    getDm2Brands(),
    getDm2Parallels(),
    getDm2CardSets(),
    getDm2CardCountsBySetId(),
  ]);

  return (
    <AdminScreen
      users={users}
      cardRepositorySets={cardRepositorySets}
      userFeatureSettingsByUserId={userFeatureSettingsByUserId}
      pickLists={pickLists}
      cardSetCategories={cardSetCategories}
      cardSetNames={cardSetNames}
      manufacturers={manufacturers}
      brands={brands}
      parallels={parallels}
      cardSets={cardSets}
      cardCountsBySetId={cardCountsBySetId}
    />
  );
}

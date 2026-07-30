import { AdminAiIndexesPanel } from "@/components/admin-ai-indexes-panel";
import { AdminCardRepositoryPanel } from "@/components/admin-card-repository-panel";
import { AdminDataModelV2Panel } from "@/components/admin-data-model-v2-panel";
import { AdminHoldingsPickListsPanel } from "@/components/admin-holdings-pick-lists-panel";
import { AdminUserConfigurationsPanel } from "@/components/admin-user-configurations-panel";
import { AdminUsersTable } from "@/components/admin-users-table";
import { getAdminUsers } from "@/lib/admin-data";
import { getAdminUserFeatureSettingsMap } from "@/lib/ai-feature-settings";
import type { AdminSection } from "@/lib/admin-sections";
import { getCardRepositorySets } from "@/lib/card-repository-data";
import {
  getDm2Attributes,
  getDm2Brands,
  getDm2CardSets,
  getDm2CardSetCategories,
  getDm2CardSetNames,
  getDm2Manufacturers,
  getDm2Parallels,
} from "@/lib/data-model-v2-data";
import { getMarketSentimentSourcesWithMeta } from "@/lib/market-sentiment-data";
import { getAdminPickLists } from "@/lib/pick-list-data";

interface AdminSectionContentProps {
  section: AdminSection;
}

export async function AdminSectionContent({ section }: AdminSectionContentProps) {
  switch (section) {
    case "users": {
      const users = await getAdminUsers();
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Users</h2>
            <p className="text-sm text-muted-foreground">
              View and manage registered users
            </p>
          </div>
          <AdminUsersTable users={users} />
        </div>
      );
    }

    case "card-repository": {
      const cardRepositorySets = await getCardRepositorySets();
      return <AdminCardRepositoryPanel sets={cardRepositorySets} />;
    }

    case "user-configurations": {
      const [users, userFeatureSettingsByUserId] = await Promise.all([
        getAdminUsers(),
        getAdminUserFeatureSettingsMap(),
      ]);
      return (
        <AdminUserConfigurationsPanel
          users={users}
          initialSettingsByUserId={userFeatureSettingsByUserId}
        />
      );
    }

    case "holdings-pick-lists": {
      const pickLists = await getAdminPickLists();
      return <AdminHoldingsPickListsPanel initialPickLists={pickLists} />;
    }

    case "data-model-v2": {
      const [
        pickLists,
        cardSetCategories,
        cardSetNames,
        manufacturers,
        brands,
        parallels,
        attributes,
        cardSets,
      ] = await Promise.all([
        getAdminPickLists(),
        getDm2CardSetCategories(),
        getDm2CardSetNames(),
        getDm2Manufacturers(),
        getDm2Brands(),
        getDm2Parallels(),
        getDm2Attributes(),
        getDm2CardSets(),
      ]);

      return (
        <AdminDataModelV2Panel
          sports={pickLists.sport}
          cardSetCategories={cardSetCategories}
          cardSetNames={cardSetNames}
          manufacturers={manufacturers}
          brands={brands}
          parallels={parallels}
          attributes={attributes}
          cardSets={cardSets}
        />
      );
    }

    case "ai-indexes": {
      const sentimentSourcesMeta = await getMarketSentimentSourcesWithMeta();
      return (
        <AdminAiIndexesPanel
          sentimentSources={sentimentSourcesMeta.sources}
          sentimentSourcesUsingDefaults={sentimentSourcesMeta.usingDefaults}
        />
      );
    }
  }
}

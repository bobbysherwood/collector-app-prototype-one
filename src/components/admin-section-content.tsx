import { AdminAiIndexesPanel } from "@/components/admin-ai-indexes-panel";
import { AdminCardRepositoryPanel } from "@/components/admin-card-repository-panel";
import { AdminHoldingsPickListsPanel } from "@/components/admin-holdings-pick-lists-panel";
import { AdminUserConfigurationsPanel } from "@/components/admin-user-configurations-panel";
import { AdminUsersTable } from "@/components/admin-users-table";
import { getAdminUsers } from "@/lib/admin-data";
import { getAdminUserFeatureSettingsMap } from "@/lib/ai-feature-settings";
import type { AdminSection } from "@/lib/admin-sections";
import { getCardRepositorySets } from "@/lib/card-repository-data";
import { getSportMarketIndexAdminMeta } from "@/app/actions/market-index";
import {
  getCardInvestmentAdminMeta,
  getPlayerOpportunityAdminMeta,
} from "@/app/actions/ai-models-admin";
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
      const { AdminDataModelV2Section } = await import(
        "@/components/admin-data-model-v2-section"
      );
      return <AdminDataModelV2Section />;
    }

    case "ai-indexes": {
      const [
        sentimentSourcesMeta,
        sportMarketIndexMeta,
        cardInvestmentMeta,
        playerOpportunityMeta,
      ] = await Promise.all([
        getMarketSentimentSourcesWithMeta(),
        getSportMarketIndexAdminMeta(),
        getCardInvestmentAdminMeta(),
        getPlayerOpportunityAdminMeta(),
      ]);
      return (
        <AdminAiIndexesPanel
          sentimentSources={sentimentSourcesMeta.sources}
          sentimentSourcesUsingDefaults={sentimentSourcesMeta.usingDefaults}
          sportMarketIndexMeta={sportMarketIndexMeta}
          cardInvestmentMeta={cardInvestmentMeta}
          playerOpportunityMeta={playerOpportunityMeta}
        />
      );
    }
  }
}

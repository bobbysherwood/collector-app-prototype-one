import { redirect } from "next/navigation";
import { searchDm2Players, searchDm2Sports } from "@/app/actions/data-model-v2";
import { MarketResearchMockup } from "@/components/market-research-mockup";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";

interface MarketResearchPageProps {
  searchParams: Promise<{ tab?: string | string[]; q?: string | string[] }>;
}

function parseSearchTab(
  value: string | string[] | undefined
): "card" | "player" | "sport" {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "player" || tab === "sport") return tab;
  return "card";
}

function parseQuery(value: string | string[] | undefined): string {
  const query = Array.isArray(value) ? value[0] : value;
  return query?.trim() ?? "";
}

export default async function MarketResearchPage({
  searchParams,
}: MarketResearchPageProps) {
  const aiFeatureSettings = await getAiFeatureSettings();

  if (!aiFeatureSettings.marketResearchEnabled) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const activeTab = parseSearchTab(params.tab);
  const initialQuery = parseQuery(params.q);

  let initialPlayers: Awaited<ReturnType<typeof searchDm2Players>>["players"] = [];
  let initialSports: Awaited<ReturnType<typeof searchDm2Sports>>["sports"] = [];
  let initialSearchError: string | null = null;

  if (initialQuery.length >= 2 && activeTab === "player") {
    const result = await searchDm2Players(initialQuery);
    initialPlayers = result.players ?? [];
    initialSearchError = result.error ?? null;
  } else if (initialQuery.length >= 2 && activeTab === "sport") {
    const result = await searchDm2Sports(initialQuery);
    initialSports = result.sports ?? [];
    initialSearchError = result.error ?? null;
  }

  return (
    <MarketResearchMockup
      activeTab={activeTab}
      initialQuery={initialQuery}
      initialPlayers={initialPlayers}
      initialSports={initialSports}
      initialSearchError={initialSearchError}
    />
  );
}

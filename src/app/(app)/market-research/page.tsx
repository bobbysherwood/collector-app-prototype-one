import { redirect } from "next/navigation";
import {
  searchDm2Cards,
  searchDm2Players,
  searchDm2Sports,
} from "@/app/actions/data-model-v2";
import { MarketResearchMockup } from "@/components/market-research-mockup";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";

export const maxDuration = 60;

interface MarketResearchPageProps {
  searchParams: Promise<{
    tab?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
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

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
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
  const initialPage = parsePage(params.page);

  let initialPlayers: Awaited<ReturnType<typeof searchDm2Players>>["players"] = [];
  let initialSports: Awaited<ReturnType<typeof searchDm2Sports>>["sports"] = [];
  let initialCards: Awaited<ReturnType<typeof searchDm2Cards>>["cards"] = [];
  let initialCardTotalCount = 0;
  let initialSearchError: string | null = null;

  if (initialQuery.length >= 2 && activeTab === "player") {
    const result = await searchDm2Players(initialQuery);
    initialPlayers = result.players ?? [];
    initialSearchError = result.error ?? null;
  } else if (initialQuery.length >= 2 && activeTab === "sport") {
    const result = await searchDm2Sports(initialQuery);
    initialSports = result.sports ?? [];
    initialSearchError = result.error ?? null;
  } else if (initialQuery.length >= 2 && activeTab === "card") {
    const result = await searchDm2Cards(initialQuery, { page: initialPage });
    initialCards = result.cards ?? [];
    initialCardTotalCount = result.totalCount ?? 0;
    initialSearchError = result.error ?? null;
  }

  return (
    <MarketResearchMockup
      activeTab={activeTab}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPlayers={initialPlayers}
      initialSports={initialSports}
      initialCards={initialCards}
      initialCardTotalCount={initialCardTotalCount}
      initialSearchError={initialSearchError}
    />
  );
}

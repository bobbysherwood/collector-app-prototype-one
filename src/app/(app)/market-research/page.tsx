import { redirect } from "next/navigation";
import { MarketResearchMockup } from "@/components/market-research-mockup";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";

interface MarketResearchPageProps {
  searchParams: Promise<{ tab?: string | string[] }>;
}

function parseSearchTab(
  value: string | string[] | undefined
): "card" | "player" | "sport" {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "player" || tab === "sport") return tab;
  return "card";
}

export default async function MarketResearchPage({
  searchParams,
}: MarketResearchPageProps) {
  const aiFeatureSettings = await getAiFeatureSettings();

  if (!aiFeatureSettings.marketResearchEnabled) {
    redirect("/dashboard");
  }

  const { tab } = await searchParams;

  return <MarketResearchMockup activeTab={parseSearchTab(tab)} />;
}

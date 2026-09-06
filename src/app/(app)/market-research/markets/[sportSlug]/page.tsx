import { notFound, redirect } from "next/navigation";
import { SportMarketView } from "@/components/market-research/sport-market-view";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";
import { loadSportMarketPage } from "@/lib/market-research/load-pages";

export default async function MarketResearchSportPage({
  params,
}: {
  params: Promise<{ sportSlug: string }>;
}) {
  const aiFeatureSettings = await getAiFeatureSettings();
  if (!aiFeatureSettings.marketResearchEnabled) {
    redirect("/dashboard");
  }

  const { sportSlug } = await params;
  const data = await loadSportMarketPage(sportSlug);
  if (!data) notFound();

  return <SportMarketView data={data} />;
}

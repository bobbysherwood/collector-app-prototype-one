import { notFound, redirect } from "next/navigation";
import { PlayerResearchView } from "@/components/market-research/player-research-view";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";
import { loadPlayerResearchPage } from "@/lib/market-research/load-pages";

export default async function MarketResearchPlayerPage({
  params,
}: {
  params: Promise<{ playerSlug: string }>;
}) {
  const aiFeatureSettings = await getAiFeatureSettings();
  if (!aiFeatureSettings.marketResearchEnabled) {
    redirect("/dashboard");
  }

  const { playerSlug } = await params;
  const data = await loadPlayerResearchPage(decodeURIComponent(playerSlug));
  if (!data) notFound();

  return <PlayerResearchView data={data} />;
}

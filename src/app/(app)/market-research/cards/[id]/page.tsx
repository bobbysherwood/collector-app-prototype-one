import { notFound, redirect } from "next/navigation";
import { CardResearchView } from "@/components/market-research/card-research-view";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";
import { loadCardResearchPage } from "@/lib/market-research/load-pages";

export default async function MarketResearchCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const aiFeatureSettings = await getAiFeatureSettings();
  if (!aiFeatureSettings.marketResearchEnabled) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const data = await loadCardResearchPage(id);
  if (!data) notFound();

  return <CardResearchView data={data} />;
}

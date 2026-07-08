import { redirect } from "next/navigation";
import { MarketResearchMockup } from "@/components/market-research-mockup";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";

export default async function MarketResearchPage() {
  const aiFeatureSettings = await getAiFeatureSettings();

  if (!aiFeatureSettings.marketResearchEnabled) {
    redirect("/dashboard");
  }

  return <MarketResearchMockup />;
}

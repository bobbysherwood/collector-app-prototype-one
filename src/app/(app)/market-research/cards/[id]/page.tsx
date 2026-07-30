import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDm2CardById } from "@/app/actions/data-model-v2";
import { MarketResearchCardDetail } from "@/components/market-research-card-detail";
import { Button } from "@/components/ui/button";
import { getAiFeatureSettings } from "@/lib/ai-feature-settings";

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
  const result = await getDm2CardById(id);

  if (result.error || !result.card) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Button
        render={<Link href="/market-research" />}
        nativeButton={false}
        variant="ghost"
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Market Research
      </Button>

      <MarketResearchCardDetail card={result.card} />
    </div>
  );
}

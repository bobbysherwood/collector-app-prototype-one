import { CollectionView } from "@/components/collection-view";
import { getPortfolioData } from "@/lib/data";
import { buildLatestValuationMap } from "@/lib/valuations";
import { isAssetHeld } from "@/types/card";

export default async function HoldingsPage() {
  const { heldLotPositions, positions, valuations, sales } =
    await getPortfolioData();
  const valuationMap = Object.fromEntries(buildLatestValuationMap(valuations));
  const soldPositions = positions.filter((p) => !isAssetHeld(p.lots));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and manage your holdings
        </p>
      </div>

      <CollectionView
        heldLotPositions={heldLotPositions}
        soldPositions={soldPositions}
        latestValuations={valuationMap}
        sales={sales}
      />
    </div>
  );
}

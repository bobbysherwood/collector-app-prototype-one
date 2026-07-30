import { Suspense } from "react";
import { CollectionView } from "@/components/collection-view";
import { HoldingsCollectionLoader } from "@/components/holdings-collection-loader";
import { getPortfolioData } from "@/lib/data";
import { buildLatestValuationMap } from "@/lib/valuations";
import { isAssetHeld } from "@/types/card";

export default async function HoldingsPage() {
  const { heldLotPositions, positions, valuations, sales } =
    await getPortfolioData();
  const valuationMap = Object.fromEntries(buildLatestValuationMap(valuations));
  const soldPositions = positions.filter((p) => !isAssetHeld(p.lots));
  const allAssets = [
    ...heldLotPositions.map((p) => p.asset),
    ...soldPositions.map((p) => p.asset),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and manage your holdings
        </p>
      </div>

      <Suspense
        fallback={
          <CollectionView
            heldLotPositions={heldLotPositions}
            soldPositions={soldPositions}
            latestValuations={valuationMap}
            sales={sales}
          />
        }
      >
        <HoldingsCollectionLoader
          heldLotPositions={heldLotPositions}
          soldPositions={soldPositions}
          latestValuations={valuationMap}
          sales={sales}
          assets={allAssets}
        />
      </Suspense>
    </div>
  );
}

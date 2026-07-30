import { CollectionView } from "@/components/collection-view";
import { getDm2AttributeNamesByAssets } from "@/lib/dm2-card-attributes";
import type {
  Asset,
  AssetPosition,
  CardSale,
  CardValuation,
  HeldLotPosition,
} from "@/types/card";

interface HoldingsCollectionLoaderProps {
  heldLotPositions: HeldLotPosition[];
  soldPositions: AssetPosition[];
  latestValuations: Record<string, CardValuation>;
  sales: CardSale[];
  assets: Asset[];
}

export async function HoldingsCollectionLoader({
  heldLotPositions,
  soldPositions,
  latestValuations,
  sales,
  assets,
}: HoldingsCollectionLoaderProps) {
  const attributeNamesByAssetId = await getDm2AttributeNamesByAssets(assets);

  return (
    <CollectionView
      heldLotPositions={heldLotPositions}
      soldPositions={soldPositions}
      latestValuations={latestValuations}
      sales={sales}
      attributeNamesByAssetId={attributeNamesByAssetId}
    />
  );
}

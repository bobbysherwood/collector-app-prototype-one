import { notFound } from "next/navigation";
import { CardDetail } from "@/components/card-detail";
import {
  getAsset,
  getValuationsForAsset,
  getLotsForAsset,
  getSalesForAsset,
} from "@/lib/data";
import { getDm2AttributeNamesForAsset } from "@/lib/dm2-card-attributes";
import { enrichAssetForMarketSearch } from "@/lib/market-sales/asset-context";
import { getEbayListingsForAsset } from "@/lib/market-sales/ebay-listings-provider";

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) notFound();

  const marketAsset = enrichAssetForMarketSearch(asset);

  const [lots, sales, valuations, ebayListings, attributeNames] =
    await Promise.all([
      getLotsForAsset(id),
      getSalesForAsset(id),
      getValuationsForAsset(id),
      getEbayListingsForAsset(marketAsset),
      getDm2AttributeNamesForAsset(asset),
    ]);

  return (
    <CardDetail
      asset={asset}
      lots={lots}
      sales={sales}
      valuations={valuations}
      ebayListings={ebayListings.listings}
      listingsAsOf={ebayListings.as_of}
      listingsError={ebayListings.error}
      ebaySandboxMode={ebayListings.sandbox_mode}
      attributeNames={attributeNames}
    />
  );
}

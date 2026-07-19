import { notFound } from "next/navigation";
import { CardDetail } from "@/components/card-detail";
import {
  getAsset,
  getValuationsForAsset,
  getLotsForAsset,
  getSalesForAsset,
} from "@/lib/data";
import { getEbayListingsForAsset } from "@/lib/market-sales/ebay-listings-provider";

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) notFound();

  const [lots, sales, valuations, ebayListings] = await Promise.all([
    getLotsForAsset(id),
    getSalesForAsset(id),
    getValuationsForAsset(id),
    getEbayListingsForAsset(asset),
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
    />
  );
}

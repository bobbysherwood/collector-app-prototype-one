import { notFound } from "next/navigation";
import { CardDetail } from "@/components/card-detail";
import {
  getAsset,
  getValuationsForAsset,
  getLotsForAsset,
  getSalesForAsset,
} from "@/lib/data";

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [asset, lots, sales, valuations] = await Promise.all([
    getAsset(id),
    getLotsForAsset(id),
    getSalesForAsset(id),
    getValuationsForAsset(id),
  ]);
  if (!asset) notFound();

  return (
    <CardDetail
      asset={asset}
      lots={lots}
      sales={sales}
      valuations={valuations}
    />
  );
}

import { notFound } from "next/navigation";
import { CardDetail } from "@/components/card-detail";
import { getCard, getCardValuations } from "@/lib/data";

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [card, valuations] = await Promise.all([
    getCard(id),
    getCardValuations(id),
  ]);
  if (!card) notFound();

  return <CardDetail card={card} valuations={valuations} />;
}

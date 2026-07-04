import { notFound, redirect } from "next/navigation";
import { CardForm } from "@/components/card-form";
import { getCard } from "@/lib/data";
import { isCardHeld } from "@/types/card";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) notFound();
  if (!isCardHeld(card)) {
    redirect(`/cards/${id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Card</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update card details in your portfolio
        </p>
      </div>

      <CardForm mode="edit" card={card} />
    </div>
  );
}

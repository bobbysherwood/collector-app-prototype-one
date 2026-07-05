import { notFound, redirect } from "next/navigation";
import { CardForm } from "@/components/card-form";
import { getAsset, getLotsForAsset } from "@/lib/data";
import { isAssetHeld } from "@/types/card";

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [asset, lots] = await Promise.all([
    getAsset(id),
    getLotsForAsset(id),
  ]);
  if (!asset) notFound();
  if (!isAssetHeld(lots)) {
    redirect(`/cards/${id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Card</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update card details in your portfolio
          {lots.length > 1 && (
            <> · grading and purchase fields are managed per lot on the detail page</>
          )}
        </p>
      </div>

      <CardForm mode="edit" card={asset} lots={lots} />
    </div>
  );
}

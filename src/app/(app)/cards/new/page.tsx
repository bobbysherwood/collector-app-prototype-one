import { CardForm } from "@/components/card-form";

export default function NewCardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Card</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record a new card in your portfolio
        </p>
      </div>

      <CardForm mode="create" />
    </div>
  );
}

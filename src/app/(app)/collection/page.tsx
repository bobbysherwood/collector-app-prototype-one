import { CollectionView } from "@/components/collection-view";
import { getCards, getLatestValuationMap } from "@/lib/data";

export default async function CollectionPage() {
  const [cards, latestValuations] = await Promise.all([
    getCards(),
    getLatestValuationMap(),
  ]);

  const valuationMap = Object.fromEntries(latestValuations);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Collection</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and manage your cards
        </p>
      </div>

      <CollectionView cards={cards} latestValuations={valuationMap} />
    </div>
  );
}

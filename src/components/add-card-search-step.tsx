"use client";

import {
  AddCardPsaCertLookup,
  type PsaCertContinuePayload,
} from "@/components/add-card-psa-cert-lookup";
import { Button } from "@/components/ui/button";
import { Dm2CardSearchInput } from "@/components/dm2-card-search-input";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

interface AddCardSearchStepProps {
  onSelectCard: (card: Dm2CardSearchResult) => void;
  onAddManually: () => void;
  onContinueFromPsa: (payload: PsaCertContinuePayload) => void;
}

export function AddCardSearchStep({
  onSelectCard,
  onAddManually,
  onContinueFromPsa,
}: AddCardSearchStepProps) {
  return (
    <div className="space-y-6">
      <Dm2CardSearchInput
        className="max-w-xl"
        onSelectCard={onSelectCard}
        noResultsFallback={
          <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm font-medium">No matching cards found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search or add the card manually.
            </p>
            <Button
              type="button"
              variant="link"
              className="mt-3 px-0"
              onClick={onAddManually}
            >
              Add manually instead
            </Button>
          </div>
        }
      />
      <AddCardPsaCertLookup onContinue={onContinueFromPsa} />
      <Button type="button" variant="outline" onClick={onAddManually}>
        Add manually
      </Button>
    </div>
  );
}

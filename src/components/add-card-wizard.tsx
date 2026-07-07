"use client";

import { useState } from "react";
import { AddCardSearchStep } from "@/components/add-card-search-step";
import { CardForm } from "@/components/card-form";
import { repositoryCardToFormPrefill } from "@/lib/card-repository-to-asset";
import type { CardFormData } from "@/types/card";
import type { CardRepositorySearchResult } from "@/types/card-repository";

type WizardStep = "search" | "form";

export function AddCardWizard() {
  const [step, setStep] = useState<WizardStep>("search");
  const [initialForm, setInitialForm] = useState<Partial<CardFormData> | undefined>(
    undefined
  );
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  function handleSelectCard(card: CardRepositorySearchResult) {
    setInitialForm(repositoryCardToFormPrefill(card));
    setSelectedLabel(
      [card.year, card.brand, card.cardSet, card.player].filter(Boolean).join(" ")
    );
    setStep("form");
  }

  function handleAddManually() {
    setInitialForm(undefined);
    setSelectedLabel(null);
    setStep("form");
  }

  function handleBackToSearch() {
    setStep("search");
  }

  if (step === "search") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add Card</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search the card repository or add manually
          </p>
        </div>

        <AddCardSearchStep
          onSelectCard={handleSelectCard}
          onAddManually={handleAddManually}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Card</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedLabel
            ? `Adding ${selectedLabel} — complete grading and acquisition details`
            : "Record a new card in your portfolio"}
        </p>
      </div>

      <CardForm
        mode="create"
        initialForm={initialForm}
        onBackToSearch={handleBackToSearch}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { AddCardSearchStep } from "@/components/add-card-search-step";
import { CardForm } from "@/components/card-form";
import { dm2CardToFormPrefill, formatDm2CardLabel } from "@/lib/dm2-card-to-asset";
import type { CardFormData } from "@/types/card";
import type { Dm2CardFormLookups, Dm2CardSearchResult } from "@/types/data-model-v2";

type WizardStep = "search" | "form";

export function AddCardWizard({ dm2Lookups }: { dm2Lookups: Dm2CardFormLookups }) {
  const [step, setStep] = useState<WizardStep>("search");
  const [initialForm, setInitialForm] = useState<Partial<CardFormData> | undefined>(
    undefined
  );
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  function handleSelectCard(card: Dm2CardSearchResult) {
    setInitialForm(dm2CardToFormPrefill(card));
    setSelectedLabel(formatDm2CardLabel(card));
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
            Search the card catalog or add manually
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
        dm2Lookups={dm2Lookups}
      />
    </div>
  );
}

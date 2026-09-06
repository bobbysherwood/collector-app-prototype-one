"use client";

import { useState } from "react";
import { lookupPsaCert } from "@/app/actions/psa-cert";
import type { LookupPsaCertSuccess } from "@/app/actions/psa-cert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dm2CardToFormPrefill, formatDm2CardLabel } from "@/lib/dm2-card-to-asset";
import { normalizePsaCertNumber } from "@/lib/psa/map-cert";
import type { CardFormData } from "@/types/card";
import type { Dm2CardSearchResult } from "@/types/data-model-v2";

export interface PsaCertContinuePayload {
  form: Partial<CardFormData>;
  label: string;
}

interface AddCardPsaCertLookupProps {
  onContinue: (payload: PsaCertContinuePayload) => void;
}

function psaContinueLabel(result: LookupPsaCertSuccess): string {
  const grade = result.cert.grade ? `PSA ${result.cert.grade}` : "PSA";
  const year = result.cert.year ? `${result.cert.year} ` : "";
  return `${grade} #${result.cert.certNumber} · ${year}${result.cert.subject}`;
}

function mergeCatalogPick(
  result: LookupPsaCertSuccess,
  card: Dm2CardSearchResult
): Partial<CardFormData> {
  return {
    ...dm2CardToFormPrefill(card),
    player_id: result.formPrefill.player_id ?? null,
    grader: "PSA",
    grade: result.cert.grade,
    cert_number: result.cert.certNumber,
  };
}

export function AddCardPsaCertLookup({ onContinue }: AddCardPsaCertLookupProps) {
  const [certNumber, setCertNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupPsaCertSuccess | null>(null);

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const normalized = normalizePsaCertNumber(certNumber);
    if (!normalized) {
      setError("Enter a valid PSA cert number.");
      return;
    }

    setLoading(true);
    try {
      const lookup = await lookupPsaCert(normalized);
      if ("error" in lookup) {
        setError(lookup.error);
        return;
      }
      setResult(lookup);
    } catch {
      setError("PSA lookup is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function handleContinue(form: Partial<CardFormData>, label: string) {
    onContinue({ form, label });
  }

  return (
    <div className="max-w-xl space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-medium">Look up a PSA cert</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Prefills the player, year, and grading from PSA. Purchase details stay
          on you.
        </p>
      </div>

      <form onSubmit={handleLookup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-2 flex-1">
          <Label htmlFor="psa_cert_number">PSA cert number</Label>
          <Input
            id="psa_cert_number"
            inputMode="numeric"
            autoComplete="off"
            value={certNumber}
            onChange={(event) => {
              setCertNumber(event.target.value);
              setError(null);
            }}
            placeholder="e.g. 12345678"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Looking up..." : "Look up"}
        </Button>
      </form>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 rounded-lg border border-border/80 bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">
              {result.cert.subject}
              {result.cert.year ? ` · ${result.cert.year}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              PSA {result.cert.grade || "graded"} #{result.cert.certNumber}
              {result.cert.cardNumber ? ` · #${result.cert.cardNumber}` : ""}
            </p>
            {(result.cert.brand || result.cert.variety) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {[result.cert.brand, result.cert.variety].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {result.catalogMatch.status === "auto" && result.catalogMatch.cards[0] && (
            <p className="text-sm text-muted-foreground">
              Matched catalog card: {formatDm2CardLabel(result.catalogMatch.cards[0])}
            </p>
          )}

          {result.catalogMatch.status === "review" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Possible catalog matches</p>
              <div className="space-y-2">
                {result.catalogMatch.cards.map((card) => (
                  <Button
                    key={card.id}
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left"
                    onClick={() =>
                      handleContinue(mergeCatalogPick(result, card), formatDm2CardLabel(card))
                    }
                  >
                    {formatDm2CardLabel(card)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => handleContinue(result.formPrefill, psaContinueLabel(result))}
            >
              Continue
            </Button>
            {result.catalogMatch.status === "review" && (
              <p className="self-center text-xs text-muted-foreground">
                Or continue and finish the card identity yourself.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

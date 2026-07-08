"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCard,
  updateCard,
  uploadCardImage,
} from "@/app/actions/cards";
import { isGradedGrader } from "@/lib/constants";
import { mergeGradeOption, mergePickListOption } from "@/lib/pick-list-utils";
import { usePickLists } from "@/components/pick-lists-provider";
import type { CardFormData, Grader, Sport } from "@/types/card";

interface CardFormProps {
  card?: import("@/types/asset").Asset;
  lots?: import("@/types/asset").Lot[];
  mode: "create" | "edit";
  initialForm?: Partial<CardFormData>;
  onBackToSearch?: () => void;
}

const emptyForm: CardFormData = {
  player_name: "",
  year: new Date().getFullYear(),
  card_type: "Topps",
  sport: "Baseball",
  card_number: "",
  insert_parallel: "",
  grader: "Raw",
  grade: "",
  cert_number: "",
  purchase_date: new Date().toISOString().split("T")[0],
  purchase_price: 0,
  notes: "",
  current_value: "",
};

export function CardForm({
  card,
  lots = [],
  mode,
  initialForm,
  onBackToSearch,
}: CardFormProps) {
  const router = useRouter();
  const pickLists = usePickLists();
  const primaryLot =
    lots.length === 1
      ? lots[0]
      : lots.find((l) => l.quantity_remaining > 0) ?? lots[0];
  const canEditLotFields = mode === "create" || lots.length === 1;

  const [form, setForm] = useState<CardFormData>(() => {
    if (card && primaryLot) {
      return {
        player_name: card.player_name,
        year: card.year,
        card_type: card.card_type,
        sport: card.sport,
        card_number: card.card_number ?? "",
        insert_parallel: card.insert_parallel ?? "",
        grader:
          primaryLot.grader === "Ungraded" ? "Raw" : primaryLot.grader,
        grade: primaryLot.grade ?? "",
        cert_number: primaryLot.cert_number ?? "",
        purchase_date: primaryLot.purchase_date,
        purchase_price: primaryLot.unit_cost,
        notes: card.notes ?? "",
        current_value: "",
      };
    }
    if (mode === "create" && initialForm) {
      return { ...emptyForm, ...initialForm };
    }
    return emptyForm;
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isGraded = isGradedGrader(form.grader);

  function updateField<K extends keyof CardFormData>(
    key: K,
    value: CardFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (canEditLotFields && isGraded) {
      if (!form.grade.trim()) {
        setError("Grade is required for graded cards.");
        return;
      }
      if (!form.cert_number.trim()) {
        setError("Cert number is required for graded cards.");
        return;
      }
    }

    setLoading(true);

    try {
      let imagePath: string | null | undefined = undefined;

      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const upload = await uploadCardImage(fd);
        if (upload.error) {
          setError(upload.error);
          setLoading(false);
          return;
        }
        imagePath = upload.path;
      } else if (removeImage) {
        imagePath = null;
      }

      if (mode === "create") {
        const initialValue = form.current_value.trim()
          ? parseFloat(form.current_value)
          : null;
        const result = await createCard(
          form,
          imagePath ?? null,
          initialValue
        );
        if (result?.error) {
          setError(result.error);
          setLoading(false);
        }
      } else if (card) {
        const result = await updateCard(card.id, form, imagePath);
        if (result?.error) {
          setError(result.error);
          setLoading(false);
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {mode === "create" && onBackToSearch && (
        <button
          type="button"
          onClick={onBackToSearch}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to search
        </button>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {mode === "edit" && lots.length > 1 && (
        <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This asset has multiple lots. Edit card identity here; use Add
          Acquisition on the card detail page to add lots with different grading.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <div>
          <Label className="mb-3 block">Card Image</Label>
          <ImageUpload
            currentImageUrl={
              !removeImage && card?.image_path
                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/card-images/${card.image_path}`
                : null
            }
            onFileSelect={(file) => {
              setImageFile(file);
              if (file === null && card?.image_path) setRemoveImage(true);
            }}
          />
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="player_name">Player Name *</Label>
              <Input
                id="player_name"
                required
                value={form.player_name}
                onChange={(e) => updateField("player_name", e.target.value)}
                placeholder="e.g. Shohei Ohtani"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                required
                min={1800}
                max={2100}
                value={form.year}
                onChange={(e) => updateField("year", parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Sport *</Label>
              <Select
                value={form.sport}
                onValueChange={(v) => v && updateField("sport", v as Sport)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sportOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Card Type *</Label>
              <Select
                value={form.card_type}
                onValueChange={(v) => v && updateField("card_type", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cardTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="card_number">Card Number</Label>
              <Input
                id="card_number"
                value={form.card_number}
                onChange={(e) => updateField("card_number", e.target.value)}
                placeholder="e.g. 201"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="insert_parallel">Insert / Parallel</Label>
              <Input
                id="insert_parallel"
                value={form.insert_parallel}
                onChange={(e) => updateField("insert_parallel", e.target.value)}
                placeholder="e.g. Silver Prizm, Refractor"
              />
            </div>
          </div>

          {canEditLotFields && (
            <>
              <div className="rounded-lg border border-border p-4 space-y-4">
                <h3 className="text-sm font-medium">Grading</h3>
                <div className="space-y-4">
                  <div className="space-y-2 sm:max-w-xs">
                    <Label>Grader *</Label>
                    <Select
                      value={form.grader}
                      onValueChange={(v) => {
                        if (!v) return;
                        updateField("grader", v as Grader);
                        if (!isGradedGrader(v as Grader)) {
                          updateField("grade", "");
                          updateField("cert_number", "");
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {graderOptions.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isGraded && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Grade *</Label>
                        <Select
                          value={form.grade}
                          onValueChange={(v) => v && updateField("grade", v)}
                          required
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                          <SelectContent>
                            {gradeOptions.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cert_number">Cert Number *</Label>
                        <Input
                          id="cert_number"
                          value={form.cert_number}
                          onChange={(e) =>
                            updateField("cert_number", e.target.value)
                          }
                          placeholder="e.g. 12345678"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-4">
                <h3 className="text-sm font-medium">Acquisition</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="purchase_date">Purchase Date *</Label>
                    <Input
                      id="purchase_date"
                      type="date"
                      required
                      value={form.purchase_date}
                      onChange={(e) => updateField("purchase_date", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchase_price">Purchase Price *</Label>
                    <Input
                      id="purchase_price"
                      type="number"
                      required
                      min={0}
                      step="0.01"
                      value={form.purchase_price || ""}
                      onChange={(e) =>
                        updateField("purchase_price", parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === "create" && (
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-4">
              <h3 className="text-sm font-medium">Current Value (optional)</h3>
              <div className="space-y-2">
                <Label htmlFor="current_value">Estimated value</Label>
                <Input
                  id="current_value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.current_value}
                  onChange={(e) => updateField("current_value", e.target.value)}
                  placeholder="Leave blank if unknown"
                />
                <p className="text-xs text-muted-foreground">
                  Saved with a timestamp. You can update it later and all
                  previous values will be kept.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Optional notes about this card..."
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? "Saving..." : mode === "create" ? "Add to Collection" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

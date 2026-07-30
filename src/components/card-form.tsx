"use client";

import { useMemo, useState } from "react";
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
import {
  assetToCardFormIdentity,
  filterBrandNamesForManufacturer,
  lookupNames,
  validateCardIdentity,
} from "@/lib/card-form-identity";
import { mergeGradeOption, mergePickListOption } from "@/lib/pick-list-utils";
import { usePickLists } from "@/components/pick-lists-provider";
import type { CardFormData, Grader, Sport } from "@/types/card";
import type { Dm2CardFormLookups } from "@/types/data-model-v2";

const PARALLEL_NONE = "__none__";

interface CardFormProps {
  card?: import("@/types/asset").Asset;
  lots?: import("@/types/asset").Lot[];
  mode: "create" | "edit";
  initialForm?: Partial<CardFormData>;
  onBackToSearch?: () => void;
  dm2Lookups: Dm2CardFormLookups;
}

const emptyForm: CardFormData = {
  player_name: "",
  year: new Date().getFullYear(),
  sport: "Baseball",
  manufacturer: "",
  brand: "",
  card_set_category: "",
  card_set_name: "",
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
  dm2Lookups,
}: CardFormProps) {
  const router = useRouter();
  const pickLists = usePickLists();
  const primaryLot =
    lots.length === 1
      ? lots[0]
      : lots.find((l) => l.quantity_remaining > 0) ?? lots[0];
  const canEditLotFields = mode === "create" || lots.length === 1;

  const sportOptions = mergePickListOption(
    pickLists.sports,
    card?.sport
  );
  const graderOptions = mergePickListOption(
    pickLists.graders,
    primaryLot?.grader === "Ungraded" ? "Raw" : primaryLot?.grader
  );
  const gradeOptions = mergeGradeOption(
    pickLists.grades,
    primaryLot?.grade
  );

  const [form, setForm] = useState<CardFormData>(() => {
    if (card && primaryLot) {
      return {
        ...assetToCardFormIdentity(card),
        grader:
          primaryLot.grader === "Ungraded" ? "Raw" : primaryLot.grader,
        grade: primaryLot.grade ?? "",
        cert_number: primaryLot.cert_number ?? "",
        purchase_date: primaryLot.purchase_date,
        purchase_price: primaryLot.unit_cost,
        current_value: "",
      };
    }

    if (mode === "create" && initialForm) {
      return {
        ...emptyForm,
        sport: (pickLists.sports[0] ?? emptyForm.sport) as Sport,
        grader: (pickLists.graders.includes("Raw")
          ? "Raw"
          : pickLists.graders[0] ?? "Raw") as Grader,
        ...initialForm,
      };
    }

    return {
      ...emptyForm,
      sport: (pickLists.sports[0] ?? emptyForm.sport) as Sport,
      grader: (pickLists.graders.includes("Raw")
        ? "Raw"
        : pickLists.graders[0] ?? "Raw") as Grader,
    };
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const manufacturerOptions = useMemo(
    () => lookupNames(dm2Lookups.manufacturers, form.manufacturer),
    [dm2Lookups.manufacturers, form.manufacturer]
  );
  const brandOptions = useMemo(
    () =>
      filterBrandNamesForManufacturer(
        dm2Lookups.brands,
        dm2Lookups.manufacturers,
        form.manufacturer,
        form.brand
      ),
    [dm2Lookups.brands, dm2Lookups.manufacturers, form.manufacturer, form.brand]
  );
  const categoryOptions = useMemo(
    () => lookupNames(dm2Lookups.cardSetCategories, form.card_set_category),
    [dm2Lookups.cardSetCategories, form.card_set_category]
  );
  const cardSetNameOptions = useMemo(
    () => lookupNames(dm2Lookups.cardSetNames, form.card_set_name),
    [dm2Lookups.cardSetNames, form.card_set_name]
  );
  const parallelOptions = useMemo(
    () => lookupNames(dm2Lookups.parallels, form.insert_parallel),
    [dm2Lookups.parallels, form.insert_parallel]
  );

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

    const identityError = validateCardIdentity(form);
    if (identityError) {
      setError(identityError);
      return;
    }

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
          <div className="rounded-lg border border-border p-4 space-y-4">
            <h3 className="text-sm font-medium">Card identity</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="player_name">Player *</Label>
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
                  onChange={(e) =>
                    updateField("year", parseInt(e.target.value, 10) || emptyForm.year)
                  }
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
                <Label>Manufacturer *</Label>
                <Select
                  value={form.manufacturer}
                  onValueChange={(value) => {
                    if (!value) return;
                    setForm((prev) => {
                      const nextBrandOptions = filterBrandNamesForManufacturer(
                        dm2Lookups.brands,
                        dm2Lookups.manufacturers,
                        value,
                        prev.brand
                      );
                      return {
                        ...prev,
                        manufacturer: value,
                        brand: nextBrandOptions.includes(prev.brand)
                          ? prev.brand
                          : "",
                      };
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select manufacturer" />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturerOptions.map((manufacturer) => (
                      <SelectItem key={manufacturer} value={manufacturer}>
                        {manufacturer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Brand *</Label>
                <Select
                  value={form.brand}
                  onValueChange={(value) => value && updateField("brand", value)}
                  disabled={!form.manufacturer}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        form.manufacturer
                          ? "Select brand"
                          : "Select manufacturer first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {brandOptions.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Card set category *</Label>
                <Select
                  value={form.card_set_category}
                  onValueChange={(v) =>
                    v && updateField("card_set_category", v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card_set_name">Card set name *</Label>
                <Select
                  value={form.card_set_name}
                  onValueChange={(value) =>
                    value && updateField("card_set_name", value)
                  }
                >
                  <SelectTrigger id="card_set_name" className="w-full">
                    <SelectValue placeholder="Select card set name" />
                  </SelectTrigger>
                  <SelectContent>
                    {cardSetNameOptions.map((cardSetName) => (
                      <SelectItem key={cardSetName} value={cardSetName}>
                        {cardSetName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card_number">Card number *</Label>
                <Input
                  id="card_number"
                  required
                  value={form.card_number}
                  onChange={(e) => updateField("card_number", e.target.value)}
                  placeholder="e.g. 201"
                />
              </div>

              <div className="space-y-2">
                <Label>Parallel</Label>
                <Select
                  value={form.insert_parallel || PARALLEL_NONE}
                  onValueChange={(value) => {
                    if (!value) return;
                    updateField(
                      "insert_parallel",
                      value === PARALLEL_NONE ? "" : value
                    );
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PARALLEL_NONE}>None</SelectItem>
                    {parallelOptions.map((parallel) => (
                      <SelectItem key={parallel} value={parallel}>
                        {parallel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            <p className="text-xs text-muted-foreground">
              Manufacturer, category, and set name are saved separately from your
              notes.
            </p>
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

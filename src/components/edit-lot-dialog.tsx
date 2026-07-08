"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateLot } from "@/app/actions/cards";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isGradedGrader } from "@/lib/constants";
import { mergeGradeOption, mergePickListOption } from "@/lib/pick-list-utils";
import { usePickLists } from "@/components/pick-lists-provider";
import type { Grader, Lot } from "@/types/card";
import { gradeLabel } from "@/types/card";

interface EditLotDialogProps {
  lot: Lot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLotDialog({ lot, open, onOpenChange }: EditLotDialogProps) {
  const router = useRouter();
  const pickLists = usePickLists();
  const currentGrader = lot.grader === "Ungraded" ? "Raw" : lot.grader;
  const graderOptions = mergePickListOption(pickLists.graders, currentGrader);
  const gradeOptions = mergeGradeOption(pickLists.grades, lot.grade);
  const [purchaseDate, setPurchaseDate] = useState(lot.purchase_date);
  const [unitCost, setUnitCost] = useState(String(lot.unit_cost));
  const [grader, setGrader] = useState<Grader>(
    lot.grader === "Ungraded" ? "Raw" : lot.grader
  );
  const [grade, setGrade] = useState(lot.grade ?? "");
  const [certNumber, setCertNumber] = useState(lot.cert_number ?? "");
  const [notes, setNotes] = useState(lot.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isGraded = isGradedGrader(grader);

  useEffect(() => {
    if (open) {
      setPurchaseDate(lot.purchase_date);
      setUnitCost(String(lot.unit_cost));
      setGrader(lot.grader === "Ungraded" ? "Raw" : lot.grader);
      setGrade(lot.grade ?? "");
      setCertNumber(lot.cert_number ?? "");
      setNotes(lot.notes ?? "");
      setError(null);
    }
  }, [open, lot]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedCost = parseFloat(unitCost);
    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      setError("Enter a valid purchase price.");
      return;
    }

    if (isGraded) {
      if (!grade.trim()) {
        setError("Grade is required for graded cards.");
        return;
      }
      if (!certNumber.trim()) {
        setError("Cert number is required for graded cards.");
        return;
      }
    }

    setLoading(true);
    const result = await updateLot(lot.id, {
      purchaseDate,
      unitCost: parsedCost,
      grader,
      grade,
      certNumber,
      notes,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onOpenChange(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit holding</DialogTitle>
            <DialogDescription>
              Update purchase details and grading for this lot ({gradeLabel(lot)}
              ).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`edit_purchase_date_${lot.id}`}>
                  Purchase Date *
                </Label>
                <Input
                  id={`edit_purchase_date_${lot.id}`}
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit_unit_cost_${lot.id}`}>
                  Purchase Price *
                </Label>
                <Input
                  id={`edit_unit_cost_${lot.id}`}
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-4">
              <h3 className="text-sm font-medium">Grading</h3>
              <div className="space-y-4">
                <div className="space-y-2 sm:max-w-xs">
                  <Label>Grader *</Label>
                  <Select
                    value={grader}
                    onValueChange={(v) => {
                      if (!v) return;
                      setGrader(v as Grader);
                      if (!isGradedGrader(v as Grader)) {
                        setGrade("");
                        setCertNumber("");
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
                        value={grade}
                        onValueChange={(v) => v && setGrade(v)}
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
                      <Label htmlFor={`edit_cert_${lot.id}`}>
                        Cert Number *
                      </Label>
                      <Input
                        id={`edit_cert_${lot.id}`}
                        value={certNumber}
                        onChange={(e) => setCertNumber(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`edit_notes_${lot.id}`}>Notes</Label>
              <Textarea
                id={`edit_notes_${lot.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes for this lot"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditLotTriggerProps {
  lot: Lot;
  compact?: boolean;
}

export function EditLotTrigger({ lot, compact = false }: EditLotTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "icon-sm" : "sm"}
        className={compact ? undefined : "gap-1.5"}
        onClick={() => setOpen(true)}
        aria-label="Edit holding"
      >
        <Pencil className="h-3.5 w-3.5" />
        {!compact && "Edit"}
      </Button>
      <EditLotDialog lot={lot} open={open} onOpenChange={setOpen} />
    </>
  );
}

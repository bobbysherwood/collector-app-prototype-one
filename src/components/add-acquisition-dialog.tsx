"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addLot } from "@/app/actions/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { GRADERS, GRADES, isGradedGrader } from "@/lib/constants";
import type { Asset, Grader } from "@/types/card";
import { cardTitle } from "@/types/card";

interface AddAcquisitionDialogProps {
  asset: Asset;
}

export function AddAcquisitionDialog({ asset }: AddAcquisitionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [unitCost, setUnitCost] = useState("");
  const [grader, setGrader] = useState<Grader>("Raw");
  const [grade, setGrade] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [initialValue, setInitialValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isGraded = isGradedGrader(grader);

  function resetForm() {
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setUnitCost("");
    setGrader("Raw");
    setGrade("");
    setCertNumber("");
    setInitialValue("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedCost = parseFloat(unitCost);
    const parsedValue = initialValue.trim()
      ? parseFloat(initialValue)
      : null;

    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      setError("Enter a valid purchase price.");
      return;
    }

    if (parsedValue != null && (Number.isNaN(parsedValue) || parsedValue < 0)) {
      setError("Enter a valid initial value or leave blank.");
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
    const result = await addLot(asset.id, {
      purchaseDate,
      unitCost: parsedCost,
      grader,
      grade,
      certNumber,
      initialValue: parsedValue,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setOpen(false);
    resetForm();
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2" />
        }
      >
        <Plus className="h-4 w-4" />
        Add Acquisition
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add acquisition</DialogTitle>
            <DialogDescription>
              Add another copy of {cardTitle(asset)} as its own lot with separate
              grading, purchase details, and value tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`add_purchase_date_${asset.id}`}>
                  Purchase Date *
                </Label>
                <Input
                  id={`add_purchase_date_${asset.id}`}
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`add_unit_cost_${asset.id}`}>
                  Purchase Price *
                </Label>
                <Input
                  id={`add_unit_cost_${asset.id}`}
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  placeholder="0.00"
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
                      {GRADERS.map((g) => (
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
                          {GRADES.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`add_cert_${asset.id}`}>
                        Cert Number *
                      </Label>
                      <Input
                        id={`add_cert_${asset.id}`}
                        value={certNumber}
                        onChange={(e) => setCertNumber(e.target.value)}
                        placeholder="e.g. 12345678"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`add_value_${asset.id}`}>
                Initial value (optional)
              </Label>
              <Input
                id={`add_value_${asset.id}`}
                type="number"
                min={0}
                step="0.01"
                placeholder="Leave blank if unknown"
                value={initialValue}
                onChange={(e) => setInitialValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !unitCost}>
              {loading ? "Saving..." : "Add Lot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

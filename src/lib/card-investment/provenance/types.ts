import type { DataProvenance } from "@/types/card-investment";

export function availableProvenance(
  source: string,
  observedAt: string | null,
  notes?: string
): DataProvenance {
  return { source, observedAt, available: true, notes };
}

export function unavailableProvenance(
  source: string,
  notes?: string
): DataProvenance {
  return { source, observedAt: null, available: false, notes };
}

export function mergeProvenanceNotes(
  provenance: DataProvenance,
  notes: string
): DataProvenance {
  return {
    ...provenance,
    notes: provenance.notes ? `${provenance.notes}; ${notes}` : notes,
  };
}

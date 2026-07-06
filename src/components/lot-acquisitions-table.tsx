"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addLotValuation } from "@/app/actions/valuations";
import { LotRowActions } from "@/components/lot-row-actions";
import type { Asset, CardValuation, Lot } from "@/types/card";
import {
  formatCurrency,
  formatPercent,
  gradeLabel,
  percentChange,
} from "@/types/card";
import { cn } from "@/lib/utils";

interface LotAcquisitionsTableProps {
  asset: Asset;
  lots: Lot[];
  valuationsByLot: Map<string, CardValuation[]>;
}

export function LotAcquisitionsTable({
  asset,
  lots,
  valuationsByLot,
}: LotAcquisitionsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Purchase Date</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Cert #</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Current Value</TableHead>
          <TableHead className="text-right">Change</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[1%]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {lots.map((lot) => (
          <LotAcquisitionRow
            key={lot.id}
            asset={asset}
            allLots={lots}
            lot={lot}
            valuations={valuationsByLot.get(lot.id) ?? []}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function LotAcquisitionRow({
  asset,
  allLots,
  lot,
  valuations,
}: {
  asset: Asset;
  allLots: Lot[];
  lot: Lot;
  valuations: CardValuation[];
}) {
  const held = Number(lot.quantity_remaining) > 0;
  const latest = valuations[valuations.length - 1] ?? null;
  const marketValue = latest?.value ?? null;
  const gainPercent =
    marketValue != null ? percentChange(lot.unit_cost, marketValue) : null;

  return (
    <TableRow>
      <TableCell>{lot.purchase_date}</TableCell>
      <TableCell>{gradeLabel(lot)}</TableCell>
      <TableCell className="text-muted-foreground">
        {lot.cert_number ?? "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCurrency(lot.unit_cost)}
      </TableCell>
      <TableCell className="text-right">
        {held ? (
          <LotValueEditor
            lotId={lot.id}
            latestValue={latest?.value ?? null}
          />
        ) : (
          <span className="tabular-nums">
            {marketValue != null ? (
              formatCurrency(marketValue)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
        )}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums font-medium",
          gainPercent == null && "text-muted-foreground",
          gainPercent != null &&
            (gainPercent >= 0 ? "text-primary" : "text-destructive")
        )}
      >
        {gainPercent != null ? formatPercent(gainPercent) : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={held ? "default" : "secondary"}>
          {held ? "Held" : "Sold"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <LotRowActions asset={asset} lot={lot} allLots={allLots} />
      </TableCell>
    </TableRow>
  );
}

function LotValueEditor({
  lotId,
  latestValue,
}: {
  lotId: string;
  latestValue: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(
    latestValue != null ? String(latestValue) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setValue(latestValue != null ? String(latestValue) : "");
  }, [latestValue]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Invalid value");
      return;
    }

    setLoading(true);
    const result = await addLotValuation(lotId, parsed);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSave}
      className="flex min-w-[140px] flex-col items-end gap-1"
    >
      {latestValue != null && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatCurrency(latestValue)}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-24 text-right tabular-nums"
          aria-label="Current value"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={loading || !value.trim()}
          className="h-8 shrink-0 px-2.5"
        >
          {loading ? "…" : latestValue != null ? "Update" : "Set"}
        </Button>
      </div>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </form>
  );
}

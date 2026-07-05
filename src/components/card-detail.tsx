"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddAcquisitionDialog } from "@/components/add-acquisition-dialog";
import { DeleteCardDialog } from "@/components/delete-card-dialog";
import { LotAcquisitionsTable } from "@/components/lot-acquisitions-table";
import { MarkCardSoldDialog } from "@/components/mark-card-sold-dialog";
import type { Asset, Lot, CardSale, CardValuation } from "@/types/card";
import {
  cardTitle,
  formatCurrency,
  gradeLabel,
  percentChange,
  formatPercent,
  costBasisHeld,
  quantityHeld,
  isAssetHeld,
  totalSaleProceeds,
  totalCostBasisAcquired,
  totalSoldQuantity,
} from "@/types/card";
import { groupValuationsByLot } from "@/lib/valuations";
import { getImageUrl } from "@/lib/images";

interface CardDetailProps {
  asset: Asset;
  lots: Lot[];
  sales: CardSale[];
  valuations: CardValuation[];
}

export function CardDetail({ asset, lots, sales, valuations }: CardDetailProps) {
  const valuationsByLot = groupValuationsByLot(valuations);
  const imageUrl = getImageUrl(asset.image_path);
  const held = isAssetHeld(lots);
  const qtyHeld = quantityHeld(lots);
  const costBasis = held ? costBasisHeld(lots) : totalCostBasisAcquired(lots);
  const saleProceeds = sales.length > 0 ? totalSaleProceeds(sales) : null;
  const realizedGain =
    saleProceeds != null ? percentChange(costBasis, saleProceeds) : null;
  const sortedLots = [...lots].sort((a, b) =>
    a.purchase_date.localeCompare(b.purchase_date)
  );
  const sortedSales = [...sales].sort((a, b) =>
    a.sale_date.localeCompare(b.sale_date)
  );
  const heldGrades = [
    ...new Set(
      lots
        .filter((l) => l.quantity_remaining > 0)
        .map((l) => gradeLabel(l))
    ),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          render={<Link href="/holdings" />}
          nativeButton={false}
          variant="ghost"
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Holdings
        </Button>
        <div className="ml-auto flex gap-2 flex-wrap">
          {held && <AddAcquisitionDialog asset={asset} />}
          {held && <MarkCardSoldDialog asset={asset} lots={lots} />}
          {held && (
            <Button
              render={<Link href={`/cards/${asset.id}/edit`} />}
              nativeButton={false}
              variant="outline"
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          <DeleteCardDialog card={asset} />
        </div>
      </div>

      {!held && (
        <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Sold</Badge>
            <p className="text-sm text-muted-foreground">
              This card is no longer in your active portfolio.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="relative aspect-[2.5/3.5] w-full max-w-[320px] overflow-hidden rounded-xl border border-border bg-muted mx-auto lg:mx-0">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={cardTitle(asset)}
              fill
              className={`object-contain p-3 ${held ? "" : "grayscale-[35%]"}`}
              priority
              sizes="320px"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-6xl font-bold text-muted-foreground/20">
                {asset.player_name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-start gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {cardTitle(asset)}
              </h1>
              {held && qtyHeld > 1 && (
                <Badge variant="secondary">{qtyHeld} copies held</Badge>
              )}
              {!held && (
                <Badge variant="secondary">
                  Sold · {totalSoldQuantity(sales)} card
                  {totalSoldQuantity(sales) === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {asset.sport}
              {asset.card_number ? ` · #${asset.card_number}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {heldGrades.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
            {asset.insert_parallel && (
              <Badge variant="outline">{asset.insert_parallel}</Badge>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label={held ? "Cost Basis (Held)" : "Total Cost Basis"}
              value={formatCurrency(costBasis)}
            />
            {held && (
              <DetailField
                label="Copies Held"
                value={String(qtyHeld)}
              />
            )}
            <DetailField label="Card Type" value={asset.card_type} />
            <DetailField label="Year" value={asset.year.toString()} />
            <DetailField label="Sport" value={asset.sport} />
            {asset.card_number && (
              <DetailField label="Card Number" value={asset.card_number} />
            )}
            {!held && saleProceeds != null && (
              <DetailField
                label="Total Sale Proceeds"
                value={formatCurrency(saleProceeds)}
              />
            )}
            {!held && realizedGain != null && saleProceeds != null && (
              <DetailField
                label="Realized Gain / Loss"
                value={`${formatCurrency(saleProceeds - costBasis)} (${formatPercent(realizedGain)})`}
              />
            )}
          </div>

          {asset.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{asset.notes}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {sortedLots.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base font-medium">
              Lots / Acquisitions
            </CardTitle>
            {held && <AddAcquisitionDialog asset={asset} />}
          </CardHeader>
          <CardContent>
            <LotAcquisitionsTable
              lots={sortedLots}
              valuationsByLot={valuationsByLot}
            />
          </CardContent>
        </Card>
      )}

      {sortedSales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Sales History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale Date</TableHead>
                  <TableHead className="text-right">Sale Value</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{sale.sale_date}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(sale.sale_price * sale.quantity)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sale.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm font-medium mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

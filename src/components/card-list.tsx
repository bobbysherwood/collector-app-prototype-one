"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardRowActions } from "@/components/card-row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Asset, CardValuation, CardSale, Lot } from "@/types/card";
import {
  cardTitle,
  formatCurrency,
  gradeLabel,
  formatPercent,
  percentChange,
  totalSaleProceeds,
  groupHeldLotsByIdentity,
  type AssetPosition,
  type HeldCardGroup,
  type HeldLotPosition,
} from "@/types/card";
import { getImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

interface CardListProps {
  heldLots?: HeldLotPosition[];
  soldPositions?: AssetPosition[];
  latestValuations?: Record<string, CardValuation>;
  salesByAsset?: Record<string, CardSale[]>;
  showSold?: boolean;
  /** @deprecated Use heldLots */
  positions?: AssetPosition[];
}

type SortColumn = "costBasis" | "currentValue" | "change";
type SortDirection = "asc" | "desc";

function sumGroupFinancials(
  items: HeldLotPosition[],
  latestValuations: Record<string, CardValuation>
) {
  let costBasis = 0;
  let marketValue = 0;
  let hasValue = false;

  for (const { lot } of items) {
    costBasis += lot.unit_cost;
    const latest = latestValuations[lot.id];
    if (latest) {
      marketValue += latest.value;
      hasValue = true;
    }
  }

  const gainPercent = hasValue
    ? percentChange(costBasis, marketValue)
    : null;

  return {
    costBasis,
    marketValue: hasValue ? marketValue : null,
    gainPercent,
  };
}

function compareSortValues(
  a: number | null,
  b: number | null,
  direction: SortDirection
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function sortHeldGroups(
  groups: HeldCardGroup[],
  latestValuations: Record<string, CardValuation>,
  column: SortColumn,
  direction: SortDirection
): HeldCardGroup[] {
  return [...groups].sort((groupA, groupB) => {
    const a = sumGroupFinancials(groupA.items, latestValuations);
    const b = sumGroupFinancials(groupB.items, latestValuations);

    let cmp = 0;
    if (column === "costBasis") {
      cmp = compareSortValues(a.costBasis, b.costBasis, direction);
    } else if (column === "currentValue") {
      cmp = compareSortValues(a.marketValue, b.marketValue, direction);
    } else {
      cmp = compareSortValues(a.gainPercent, b.gainPercent, direction);
    }

    if (cmp !== 0) return cmp;
    return cardTitle(groupA.items[0].asset).localeCompare(
      cardTitle(groupB.items[0].asset)
    );
  });
}

function SortableTableHead({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const active = activeColumn === column;

  return (
    <TableHead className="text-right">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex w-full items-center justify-end gap-1 font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {active ? (
          direction === "desc" ? (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

export function CardList({
  heldLots = [],
  soldPositions = [],
  latestValuations = {},
  salesByAsset = {},
  showSold = false,
}: CardListProps) {
  const heldGroups = useMemo(
    () => groupHeldLotsByIdentity(heldLots),
    [heldLots]
  );
  const [sort, setSort] = useState<{
    column: SortColumn;
    direction: SortDirection;
  }>({ column: "currentValue", direction: "desc" });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );

  const sortedHeldGroups = useMemo(
    () =>
      sortHeldGroups(
        heldGroups,
        latestValuations,
        sort.column,
        sort.direction
      ),
    [heldGroups, latestValuations, sort]
  );

  function handleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "desc" ? "asc" : "desc" }
        : { column, direction: "desc" }
    );
  }

  const isEmpty = showSold ? soldPositions.length === 0 : heldGroups.length === 0;

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card py-20 text-center shadow-sm">
        <p className="text-lg font-medium mb-1">
          {showSold ? "No sold cards match your filters" : "Your collection is empty"}
        </p>
        <p className="text-sm text-muted-foreground">
          {showSold
            ? "Try adjusting your search or filters."
            : "Use Add Card in the top bar to start tracking your portfolio."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            {showSold ? (
              <>
                <TableHead className="text-right">Cost Basis</TableHead>
                <TableHead className="text-right">Current Value</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </>
            ) : (
              <>
                <SortableTableHead
                  label="Cost Basis"
                  column="costBasis"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label="Current Value"
                  column="currentValue"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label="Change"
                  column="change"
                  activeColumn={sort.column}
                  direction={sort.direction}
                  onSort={handleSort}
                />
              </>
            )}
            <TableHead className="text-right w-[1%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {showSold
            ? soldPositions.map(({ asset, lots }) => (
                <SoldAssetListRow
                  key={asset.id}
                  asset={asset}
                  lots={lots}
                  sales={salesByAsset[asset.id] ?? []}
                />
              ))
            : sortedHeldGroups.map((group) => (
                <HeldCardGroupRows
                  key={group.key}
                  group={group}
                  expanded={expandedGroups.has(group.key)}
                  onToggle={() => toggleGroup(group.key)}
                  latestValuations={latestValuations}
                />
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

function HeldCardGroupRows({
  group,
  expanded,
  onToggle,
  latestValuations,
}: {
  group: HeldCardGroup;
  expanded: boolean;
  onToggle: () => void;
  latestValuations: Record<string, CardValuation>;
}) {
  const { costBasis, marketValue, gainPercent } = sumGroupFinancials(
    group.items,
    latestValuations
  );

  if (group.items.length === 1) {
    const { asset, lot } = group.items[0];
    return (
      <HeldLotListRow
        asset={asset}
        lot={lot}
        latestValuation={latestValuations[lot.id]}
        nested={false}
      />
    );
  }

  return (
    <>
      <HeldCardGroupSummaryRow
        group={group}
        expanded={expanded}
        onToggle={onToggle}
        costBasis={costBasis}
        marketValue={marketValue}
        gainPercent={gainPercent}
      />
      {expanded &&
        group.items.map(({ asset, lot }) => (
          <HeldLotListRow
            key={lot.id}
            asset={asset}
            lot={lot}
            latestValuation={latestValuations[lot.id]}
            nested
          />
        ))}
    </>
  );
}

function HeldCardGroupSummaryRow({
  group,
  expanded,
  onToggle,
  costBasis,
  marketValue,
  gainPercent,
}: {
  group: HeldCardGroup;
  expanded: boolean;
  onToggle: () => void;
  costBasis: number;
  marketValue: number | null;
  gainPercent: number | null;
}) {
  const { asset } = group;
  const imageUrl = getImageUrl(asset.image_path);
  const copyCount = group.items.length;
  const uniqueGrades = [
    ...new Set(group.items.map(({ lot }) => gradeLabel(lot))),
  ];

  return (
    <TableRow className="bg-muted/20">
      <TableCell>
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse lots" : "Expand lots"}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={cardTitle(asset)}
                fill
                className="object-contain p-0.5"
                sizes="40px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <span className="text-sm font-bold opacity-30">
                  {asset.player_name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{cardTitle(asset)}</p>
            <p className="text-xs text-muted-foreground truncate">
              {asset.sport}
              {asset.card_number ? ` · #${asset.card_number}` : ""}
              {asset.insert_parallel ? ` · ${asset.insert_parallel}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">
                {copyCount} copies
              </Badge>
              {uniqueGrades.length <= 2 ? (
                uniqueGrades.map((label) => (
                  <Badge key={label} variant="outline" className="text-xs font-normal">
                    {label}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="text-xs font-normal">
                  {uniqueGrades.length} grades
                </Badge>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {formatCurrency(costBasis)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {marketValue != null ? (
          formatCurrency(marketValue)
        ) : (
          <span className="text-muted-foreground">—</span>
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
      <TableCell />
    </TableRow>
  );
}

function HeldLotListRow({
  asset,
  lot,
  latestValuation,
  nested,
}: {
  asset: Asset;
  lot: Lot;
  latestValuation?: CardValuation;
  nested: boolean;
}) {
  const imageUrl = getImageUrl(asset.image_path);
  const costBasis = lot.unit_cost;
  const marketValue = latestValuation ? latestValuation.value : null;
  const gainPercent =
    marketValue != null ? percentChange(costBasis, marketValue) : null;

  return (
    <TableRow className={nested ? "bg-muted/10" : undefined}>
      <TableCell>
        <Link
          href={`/cards/${asset.id}`}
          className={cn(
            "flex min-w-0 items-center gap-3 hover:text-primary transition-colors",
            nested && "pl-10"
          )}
        >
          {!nested && (
            <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={cardTitle(asset)}
                  fill
                  className="object-contain p-0.5"
                  sizes="40px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <span className="text-sm font-bold opacity-30">
                    {asset.player_name.charAt(0)}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="min-w-0">
            {nested ? (
              <>
                <p className="text-sm font-medium truncate">
                  {gradeLabel(lot)}
                  {lot.cert_number ? ` · #${lot.cert_number}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Purchased {lot.purchase_date}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium truncate">{cardTitle(asset)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {asset.sport}
                  {asset.card_number ? ` · #${asset.card_number}` : ""}
                  {asset.insert_parallel ? ` · ${asset.insert_parallel}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-xs font-normal">
                    {gradeLabel(lot)}
                  </Badge>
                  {lot.cert_number && (
                    <Badge variant="secondary" className="text-xs">
                      #{lot.cert_number}
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {formatCurrency(costBasis)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {marketValue != null ? (
          formatCurrency(marketValue)
        ) : (
          <span className="text-muted-foreground">—</span>
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
      <TableCell className="text-right">
        <CardRowActions asset={asset} lots={[lot]} lot={lot} held />
      </TableCell>
    </TableRow>
  );
}

function SoldAssetListRow({
  asset,
  lots,
  sales,
}: {
  asset: Asset;
  lots: Lot[];
  sales: CardSale[];
}) {
  const imageUrl = getImageUrl(asset.image_path);
  const costBasis = lots.reduce((s, l) => s + l.unit_cost, 0);
  const saleProceeds = sales.length ? totalSaleProceeds(sales) : null;
  const saleGainPercent =
    saleProceeds != null ? percentChange(costBasis, saleProceeds) : null;
  const copyCount = lots.length;

  return (
    <TableRow className="opacity-80">
      <TableCell>
        <Link
          href={`/cards/${asset.id}`}
          className="flex min-w-0 items-center gap-3 hover:text-primary transition-colors"
        >
          <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={cardTitle(asset)}
                fill
                className="object-contain p-0.5 grayscale-[35%]"
                sizes="40px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <span className="text-sm font-bold opacity-30">
                  {asset.player_name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{cardTitle(asset)}</p>
            <p className="text-xs text-muted-foreground truncate">
              {asset.sport}
              {asset.card_number ? ` · #${asset.card_number}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">
                Sold
              </Badge>
              {copyCount > 1 && (
                <Badge variant="secondary" className="text-xs">
                  {copyCount} copies
                </Badge>
              )}
            </div>
          </div>
        </Link>
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {formatCurrency(costBasis)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {saleProceeds != null ? (
          formatCurrency(saleProceeds)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums font-medium",
          saleGainPercent == null && "text-muted-foreground",
          saleGainPercent != null &&
            (saleGainPercent >= 0 ? "text-primary" : "text-destructive")
        )}
      >
        {saleGainPercent != null ? formatPercent(saleGainPercent) : "—"}
      </TableCell>
      <TableCell className="text-right">
        <CardRowActions asset={asset} lots={lots} held={false} />
      </TableCell>
    </TableRow>
  );
}

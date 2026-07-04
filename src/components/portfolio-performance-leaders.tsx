import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CardPerformance } from "@/types/card";
import { cardTitle, formatCurrency, formatPercent } from "@/types/card";
import { cn } from "@/lib/utils";

interface PortfolioPerformanceLeadersProps {
  topPerformers: CardPerformance[];
  underperformers: CardPerformance[];
}

export function PortfolioPerformanceLeaders({
  topPerformers,
  underperformers,
}: PortfolioPerformanceLeadersProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-6">
        <PerformanceCard
          title="Top Performers"
          subtitle="Largest % gain vs cost basis"
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          entries={topPerformers}
          positive
          emptyMessage="No cards with gains yet. Set current values to see top performers."
        />
      </div>
      <div className="min-w-0 lg:col-span-6">
        <PerformanceCard
          title="Underperformers"
          subtitle="Largest % loss vs cost basis"
          icon={<TrendingDown className="h-4 w-4 text-destructive" />}
          entries={underperformers}
          positive={false}
          emptyMessage="No cards with losses yet. Set current values to see underperformers."
        />
      </div>
    </div>
  );
}

function PerformanceCard({
  title,
  subtitle,
  icon,
  entries,
  positive,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  entries: CardPerformance[];
  positive: boolean;
  emptyMessage: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <CardTitle className="text-base font-medium">{title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {emptyMessage}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => (
                <TableRow key={entry.card.id}>
                  <TableCell>
                    <Link
                      href={`/cards/${entry.card.id}`}
                      className="block min-w-0 hover:text-primary transition-colors"
                    >
                      <p className="font-medium truncate max-w-[180px] sm:max-w-none">
                        <span className="text-muted-foreground mr-1.5 tabular-nums">
                          {index + 1}.
                        </span>
                        {cardTitle(entry.card)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.card.sport}
                      </p>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(entry.costBasis)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(entry.currentValue)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums font-medium",
                      positive ? "text-primary" : "text-destructive"
                    )}
                  >
                    {formatPercent(entry.gainPercent)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

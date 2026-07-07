"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bookmark,
  Filter,
  LineChart as LineChartIcon,
  Newspaper,
  Search,
  SlidersHorizontal,
  Star,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatPercent } from "@/types/card";
import { cn } from "@/lib/utils";

// --- Mock data ---

const MARKET_INDICES = [
  { name: "Rookie Auto Index", value: 142.8, change: 8.4 },
  { name: "Vintage HOF Index", value: 218.3, change: 3.1 },
  { name: "Modern Chrome Index", value: 96.7, change: -2.6 },
  { name: "Basketball Cards Index", value: 167.2, change: 12.3 },
];

const SPORT_SECTORS = [
  { sport: "Basketball", change: 12.3, volume: 4820 },
  { sport: "Football", change: 5.8, volume: 3910 },
  { sport: "Baseball", change: 2.1, volume: 5240 },
  { sport: "Hockey", change: -1.4, volume: 980 },
  { sport: "Soccer", change: 7.6, volume: 640 },
];

const MOVERS = {
  gainers: [
    { name: "Victor Wembanyama", card: "2023 Prizm Silver RC PSA 10", price: 1240, change: 34.2, volume: 28 },
    { name: "CJ Stroud", card: "2023 Prizm Silver RC PSA 10", price: 385, change: 22.8, volume: 41 },
    { name: "Shohei Ohtani", card: "2018 Topps Update RC PSA 10", price: 890, change: 18.5, volume: 19 },
    { name: "Anthony Edwards", card: "2020 Prizm Silver RC PSA 10", price: 620, change: 15.1, volume: 22 },
    { name: "Brock Bowers", card: "2024 Prizm Silver RC PSA 10", price: 210, change: 14.7, volume: 55 },
  ],
  losers: [
    { name: "Ja Morant", card: "2019 Prizm Silver RC PSA 10", price: 340, change: -18.2, volume: 31 },
    { name: "Trevor Lawrence", card: "2021 Prizm Silver RC PSA 10", price: 95, change: -14.6, volume: 38 },
    { name: "Zion Williamson", card: "2019 Prizm Silver RC PSA 10", price: 280, change: -12.4, volume: 24 },
    { name: "Mac Jones", card: "2021 Prizm Silver RC PSA 10", price: 42, change: -11.8, volume: 17 },
    { name: "LaMelo Ball", card: "2020 Prizm Silver RC PSA 10", price: 175, change: -9.3, volume: 20 },
  ],
  active: [
    { name: "Brock Bowers", card: "2024 Prizm Silver RC", price: 210, change: 14.7, volume: 55 },
    { name: "CJ Stroud", card: "2023 Prizm Silver RC PSA 10", price: 385, change: 22.8, volume: 41 },
    { name: "Trevor Lawrence", card: "2021 Prizm Silver RC PSA 10", price: 95, change: -14.6, volume: 38 },
    { name: "Ja Morant", card: "2019 Prizm Silver RC PSA 10", price: 340, change: -18.2, volume: 31 },
    { name: "Victor Wembanyama", card: "2023 Prizm Silver RC PSA 10", price: 1240, change: 34.2, volume: 28 },
  ],
};

const FEATURED_CHART = [
  { month: "Jul", price: 820 },
  { month: "Aug", price: 845 },
  { month: "Sep", price: 790 },
  { month: "Oct", price: 880 },
  { month: "Nov", price: 920 },
  { month: "Dec", price: 965 },
  { month: "Jan", price: 1020 },
  { month: "Feb", price: 1080 },
  { month: "Mar", price: 1120 },
  { month: "Apr", price: 1180 },
  { month: "May", price: 1210 },
  { month: "Jun", price: 1240 },
];

const NEWS_ITEMS = [
  { title: "Wembanyama named All-NBA First Team", tag: "Catalyst", time: "2h ago", sentiment: "bullish" as const },
  { title: "PSA reports 12% increase in Q2 submissions", tag: "Industry", time: "5h ago", sentiment: "neutral" as const },
  { title: "2025 Prizm Basketball release date announced", tag: "Product", time: "1d ago", sentiment: "bullish" as const },
  { title: "Spurs advance to Western Conference Finals", tag: "Catalyst", time: "1d ago", sentiment: "bullish" as const },
  { title: "Silver Prizm pop count rises 4% this quarter", tag: "Supply", time: "2d ago", sentiment: "bearish" as const },
];

const OPPORTUNITIES = [
  { label: "Below 90-day avg", card: "2023 Prizm Wembanyama Silver PSA 9", signal: "Buy zone", confidence: "High" },
  { label: "Rising volume, flat price", card: "2024 Prizm Brock Bowers Silver", signal: "Breakout watch", confidence: "Medium" },
  { label: "Low pop / high demand", card: "2018 Topps Update Ohtani PSA 10", signal: "Supply squeeze", confidence: "High" },
  { label: "Post-playoff dip", card: "2019 Prizm Ja Morant Silver PSA 10", signal: "Contrarian", confidence: "Low" },
];

const SCREENER_RESULTS = [
  { player: "Anthony Edwards", card: "2020 Prizm Silver RC", grade: "PSA 10", price: 620, change90d: 15.1, pop: 2840, liquidity: "High", score: 82 },
  { player: "CJ Stroud", card: "2023 Prizm Silver RC", grade: "PSA 10", price: 385, change90d: 22.8, pop: 4120, liquidity: "High", score: 79 },
  { player: "Brock Bowers", card: "2024 Prizm Silver RC", grade: "PSA 10", price: 210, change90d: 14.7, pop: 890, liquidity: "Very High", score: 88 },
  { player: "Shohei Ohtani", card: "2018 Topps Update RC", grade: "PSA 10", price: 890, change90d: 18.5, pop: 1240, liquidity: "Medium", score: 76 },
  { player: "Victor Wembanyama", card: "2023 Prizm Silver RC", grade: "PSA 10", price: 1240, change90d: 34.2, pop: 3560, liquidity: "High", score: 91 },
  { player: "Paul Skenes", card: "2024 Bowman Chrome RC", grade: "PSA 10", price: 175, change90d: 9.4, pop: 620, liquidity: "High", score: 74 },
];

const WATCHLIST = [
  { player: "Victor Wembanyama", card: "2023 Prizm Silver RC PSA 10", price: 1240, change: 34.2, target: 1100, note: "Buy below $1,100" },
  { player: "Brock Bowers", card: "2024 Prizm Silver RC PSA 10", price: 210, change: 14.7, target: 180, note: "Rookie momentum play" },
  { player: "Shohei Ohtani", card: "2018 Topps Update RC PSA 10", price: 890, change: 18.5, target: 850, note: "Long-term hold candidate" },
  { player: "Paul Skenes", card: "2024 Bowman Chrome RC PSA 10", price: 175, change: 9.4, target: 150, note: "Watch pop growth" },
];

const CATALYST_CALENDAR = [
  { date: "Jul 12", event: "NBA Summer League finals", impact: "Medium" },
  { date: "Jul 18", event: "2025 Prizm Basketball pre-orders", impact: "High" },
  { date: "Aug 1", event: "MLB trade deadline", impact: "High" },
  { date: "Aug 15", event: "PSA quarterly pop report", impact: "Medium" },
];

// --- Helpers ---

function ChangeBadge({ value, className }: { value: number; className?: string }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
        positive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
        className
      )}
    >
      {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {formatPercent(Math.abs(value))}
    </span>
  );
}

function MoversTable({
  rows,
  showVolume = false,
}: {
  rows: (typeof MOVERS.gainers)[number][];
  showVolume?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead className="hidden md:table-cell">Card</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">{showVolume ? "Vol (90d)" : "90d"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.name}-${row.card}`} className="cursor-default">
            <TableCell>
              <div className="font-medium">{row.name}</div>
              <div className="text-xs text-muted-foreground md:hidden">{row.card}</div>
            </TableCell>
            <TableCell className="hidden max-w-[200px] truncate text-muted-foreground md:table-cell">
              {row.card}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(row.price)}</TableCell>
            <TableCell className="text-right">
              {showVolume ? (
                <span className="tabular-nums text-muted-foreground">{row.volume}</span>
              ) : (
                <ChangeBadge value={row.change} />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="mb-0.5 font-medium">{label}</p>
      <p className="tabular-nums text-primary">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// --- Main mockup ---

export function MarketResearchMockup() {
  const [moversTab, setMoversTab] = useState<"gainers" | "losers" | "active">("gainers");
  const [chartRange, setChartRange] = useState("1y");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Market Research</h1>
            <Badge variant="outline" className="text-xs">
              Prototype
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Research sports, players, and cards to identify investment opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <Bell className="h-4 w-4" />
            Alerts
          </Button>
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <Bookmark className="h-4 w-4" />
            Watchlists
          </Button>
        </div>
      </div>

      {/* Preview banner */}
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Design preview only.</span> All data
        shown is mock placeholder content. Search, screeners, and watchlists are not
        functional yet.
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Search players, sets, cards, or grades…"
                disabled
              />
            </div>
            <Button variant="outline" className="gap-2 sm:w-auto" disabled>
              <SlidersHorizontal className="h-4 w-4" />
              Advanced
            </Button>
            <Button className="gap-2 sm:w-auto" disabled>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Trending:</span>
            {["Wembanyama", "Brock Bowers", "Ohtani", "Prizm Silver", "PSA 10"].map((term) => (
              <Badge key={term} variant="secondary" className="cursor-default text-xs">
                {term}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="screener" className="gap-1.5">
            <Filter className="h-4 w-4" />
            Screener
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="gap-1.5">
            <Star className="h-4 w-4" />
            Watchlist
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-6 space-y-8">
          {/* Market indices */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Market Indices
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {MARKET_INDICES.map((index) => (
                <Card key={index.name}>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">{index.name}</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{index.value.toFixed(1)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChangeBadge value={index.change} />
                    <span className="ml-2 text-xs text-muted-foreground">90 days</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Sector performance */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Sector Performance
            </h2>
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {SPORT_SECTORS.map((sector) => (
                    <div
                      key={sector.sport}
                      className="rounded-xl border border-border/60 bg-muted/30 p-4"
                    >
                      <p className="text-sm font-medium">{sector.sport}</p>
                      <ChangeBadge value={sector.change} className="mt-1" />
                      <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                        {sector.volume.toLocaleString()} sales (90d)
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Featured card + news */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardDescription>Featured Research</CardDescription>
                    <CardTitle className="text-lg">
                      Victor Wembanyama — 2023 Prizm Silver RC PSA 10
                    </CardTitle>
                  </div>
                  <div className="flex gap-1">
                    {(["90d", "1y", "3y"] as const).map((range) => (
                      <Button
                        key={range}
                        variant={chartRange === range ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setChartRange(range)}
                      >
                        {range}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-3xl font-semibold tabular-nums">{formatCurrency(1240)}</p>
                    <ChangeBadge value={34.2} />
                    <span className="ml-2 text-xs text-muted-foreground">90 days</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground">Est. range</p>
                      <p className="font-medium tabular-nums">
                        {formatCurrency(1180)} – {formatCurrency(1320)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pop (PSA 10)</p>
                      <p className="font-medium tabular-nums">3,560</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Liquidity</p>
                      <p className="font-medium text-emerald-600 dark:text-emerald-400">High</p>
                    </div>
                  </div>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={FEATURED_CHART}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) => `$${v}`}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1.5" disabled>
                    <Star className="h-3.5 w-3.5" />
                    Add to Watchlist
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled>
                    <LineChartIcon className="h-3.5 w-3.5" />
                    Full Research
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled>
                    Compare
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6 lg:col-span-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Newspaper className="h-4 w-4" />
                    News & Catalysts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {NEWS_ITEMS.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-border/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{item.title}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px]",
                            item.sentiment === "bullish" && "border-emerald-500/40 text-emerald-600",
                            item.sentiment === "bearish" && "border-destructive/40 text-destructive"
                          )}
                        >
                          {item.sentiment}
                        </Badge>
                      </div>
                      <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                        <span>{item.tag}</span>
                        <span>·</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Catalyst Calendar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {CATALYST_CALENDAR.map((item) => (
                    <div
                      key={item.event}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium tabular-nums">{item.date}</span>
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span>{item.event}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {item.impact}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Market movers */}
          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Market Movers
              </h2>
              <div className="flex gap-1">
                <Button
                  variant={moversTab === "gainers" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setMoversTab("gainers")}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Gainers
                </Button>
                <Button
                  variant={moversTab === "losers" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setMoversTab("losers")}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  Losers
                </Button>
                <Button
                  variant={moversTab === "active" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setMoversTab("active")}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Most Active
                </Button>
              </div>
            </div>
            <Card>
              <CardContent className="pt-6">
                <MoversTable
                  rows={MOVERS[moversTab]}
                  showVolume={moversTab === "active"}
                />
              </CardContent>
            </Card>
          </section>

          {/* Opportunity signals */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Opportunity Signals
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {OPPORTUNITIES.map((opp) => (
                <Card key={opp.card}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                          <span className="text-sm font-medium">{opp.label}</span>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{opp.card}</p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {opp.signal}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Confidence</p>
                        <p className="text-sm font-medium">{opp.confidence}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </TabsContent>

        {/* SCREENER TAB */}
        <TabsContent value="screener" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Card Screener</CardTitle>
              <CardDescription>
                Filter the market universe by price, momentum, supply, and liquidity — like a
                stock screener
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Sport</label>
                  <Select disabled defaultValue="all">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sports</SelectItem>
                      <SelectItem value="basketball">Basketball</SelectItem>
                      <SelectItem value="football">Football</SelectItem>
                      <SelectItem value="baseball">Baseball</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Card type</label>
                  <Select disabled defaultValue="rookie">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rookie">Rookie cards</SelectItem>
                      <SelectItem value="auto">Autographs</SelectItem>
                      <SelectItem value="vintage">Vintage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Max price</label>
                  <Input disabled placeholder="$500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Min 90d change</label>
                  <Input disabled placeholder="10%" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Grade</label>
                  <Select disabled defaultValue="psa10">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="psa10">PSA 10</SelectItem>
                      <SelectItem value="psa9">PSA 9</SelectItem>
                      <SelectItem value="raw">Raw</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Max pop count</label>
                  <Input disabled placeholder="5,000" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Liquidity</label>
                  <Select disabled defaultValue="high">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="any">Any</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full gap-2" disabled>
                    <Filter className="h-4 w-4" />
                    Run Screener
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Results</CardTitle>
                <Badge variant="secondary">{SCREENER_RESULTS.length} matches</Badge>
              </div>
              <CardDescription>Sorted by opportunity score (mock)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="hidden lg:table-cell">Card</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">90d</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Pop</TableHead>
                    <TableHead className="hidden sm:table-cell">Liquidity</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SCREENER_RESULTS.map((row) => (
                    <TableRow key={`${row.player}-${row.card}`}>
                      <TableCell className="font-medium">{row.player}</TableCell>
                      <TableCell className="hidden max-w-[180px] truncate text-muted-foreground lg:table-cell">
                        {row.card}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.grade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChangeBadge value={row.change90d} />
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">
                        {row.pop.toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {row.liquidity}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold tabular-nums text-primary">{row.score}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WATCHLIST TAB */}
        <TabsContent value="watchlist" className="mt-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">My Watchlist</h2>
              <p className="text-sm text-muted-foreground">
                Track cards you&apos;re researching before adding to Holdings
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Star className="h-4 w-4" />
              New list
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player / Card</TableHead>
                    <TableHead className="text-right">Est. Price</TableHead>
                    <TableHead className="text-right">90d</TableHead>
                    <TableHead className="text-right">Buy Target</TableHead>
                    <TableHead className="hidden md:table-cell">Note</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {WATCHLIST.map((item) => {
                    const atTarget = item.price <= item.target;
                    return (
                      <TableRow key={item.card}>
                        <TableCell>
                          <div className="font-medium">{item.player}</div>
                          <div className="text-xs text-muted-foreground">{item.card}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(item.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ChangeBadge value={item.change} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(item.target)}
                        </TableCell>
                        <TableCell className="hidden max-w-[200px] truncate text-muted-foreground md:table-cell">
                          {item.note}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={atTarget ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {atTarget ? "At target" : "Watching"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

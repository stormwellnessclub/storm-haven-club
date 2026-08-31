import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format, startOfMonth, endOfMonth, eachMonthOfInterval, min as minDate, max as maxDate,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronRight, Download, DollarSign, Receipt } from "lucide-react";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

interface TaxItem {
  date: string;
  description: string;
  source: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  stripe_charge_id: string;
}

interface MonthResult {
  key: string;
  label: string;
  items: TaxItem[];
  truncated: boolean;
  error: string | null;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function SalesTaxByMonthReport({ dateRange }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const months = useMemo(() => {
    const start = startOfMonth(minDate([dateRange.start, dateRange.end]));
    const end = startOfMonth(maxDate([dateRange.start, dateRange.end]));
    return eachMonthOfInterval({ start, end });
  }, [dateRange.start, dateRange.end]);

  const startKey = format(dateRange.start, "yyyy-MM");
  const endKey = format(dateRange.end, "yyyy-MM");

  const { data, isLoading, error } = useQuery({
    queryKey: ["sales-tax-by-month", startKey, endKey],
    queryFn: async (): Promise<MonthResult[]> => {
      const results: MonthResult[] = [];
      // Sequential: the edge function caps each request at one month of Stripe charges.
      for (const m of months) {
        const from = format(startOfMonth(m), "yyyy-MM-dd'T'00:00:00");
        const to = format(endOfMonth(m), "yyyy-MM-dd'T'23:59:59");
        try {
          const callMonth = async () => {
            const { data: res, error: fnErr } = await supabase.functions.invoke("stripe-sales-tax", {
              body: { start_date: from, end_date: to },
            });
            if (fnErr) throw new Error(fnErr.message);
            return res;
          };

          let res = await callMonth();
          // Long report runs can outlive an access token. Refresh once and
          // retry instead of failing the whole report with "access denied".
          if (res?.ok === false && /sign in again|session expired|authorization/i.test(String(res.error || ""))) {
            await supabase.auth.refreshSession();
            res = await callMonth();
          }
          if (res?.ok === false) throw new Error(res.error || "Request failed");
          results.push({
            key: format(m, "yyyy-MM"),
            label: format(m, "MMMM yyyy"),
            items: ((res?.items || []) as TaxItem[]).filter((i) => i.tax_amount > 0),
            truncated: Boolean(res?.truncated),
            error: null,
          });
        } catch (e) {
          results.push({
            key: format(m, "yyyy-MM"),
            label: format(m, "MMMM yyyy"),
            items: [],
            truncated: false,
            error: (e as Error).message,
          });
        }
      }
      return results;
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const monthsData = data ?? [];
  const sources = useMemo(() => {
    const set = new Set<string>();
    monthsData.forEach((m) => m.items.forEach((i) => set.add(i.source)));
    return Array.from(set).sort();
  }, [monthsData]);

  const totals = useMemo(() => {
    const all = monthsData.flatMap((m) => m.items);
    return {
      subtotal: all.reduce((s, i) => s + i.subtotal, 0),
      tax: all.reduce((s, i) => s + i.tax_amount, 0),
      total: all.reduce((s, i) => s + i.total, 0),
      count: all.length,
    };
  }, [monthsData]);

  const exportCsv = () => {
    const rows: string[][] = [[
      "Month", "Date", "Description", "Source", "Subtotal", "Tax", "Total", "Stripe Charge ID",
    ]];
    monthsData.forEach((m) => {
      m.items.forEach((i) => {
        rows.push([
          m.label,
          format(new Date(i.date), "yyyy-MM-dd HH:mm"),
          (i.description || "").replace(/"/g, "'"),
          i.source,
          i.subtotal.toFixed(2),
          i.tax_amount.toFixed(2),
          i.total.toFixed(2),
          i.stripe_charge_id,
        ]);
      });
      rows.push([
        m.label, "", "MONTH TOTAL", "",
        m.items.reduce((s, i) => s + i.subtotal, 0).toFixed(2),
        m.items.reduce((s, i) => s + i.tax_amount, 0).toFixed(2),
        m.items.reduce((s, i) => s + i.total, 0).toFixed(2),
        "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-tax-by-month-${startKey}-to-${endKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <p className="text-sm text-muted-foreground">
          Pulling every Stripe charge for {months.length} month{months.length === 1 ? "" : "s"} — this can take a moment.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  const failed = monthsData.filter((m) => m.error);
  const truncatedMonths = monthsData.filter((m) => m.truncated);

  return (
    <div className="space-y-6">
      {failed.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Could not load: {failed.map((m) => `${m.label} (${m.error})`).join("; ")}
          </AlertDescription>
        </Alert>
      )}
      {truncatedMonths.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Partial data for {truncatedMonths.map((m) => m.label).join(", ")} — Stripe returned more charges than could be
            scanned in one pass. Re-run those months individually with the Sales Tax Collected report.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tax Collected</p>
                <p className="text-2xl font-bold">{money(totals.tax)}</p>
                <p className="text-xs text-muted-foreground">{totals.count} taxed sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary"><Receipt className="h-5 w-5 text-secondary-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Taxable Sales (pre-tax)</p>
                <p className="text-2xl font-bold">{money(totals.subtotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent"><DollarSign className="h-5 w-5 text-accent-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Collected</p>
                <p className="text-2xl font-bold">{money(totals.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={totals.count === 0}>
          <Download className="h-4 w-4 mr-2" /> Export full detail (CSV)
        </Button>
      </div>

      {/* Month summary with per-source tax split */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            {sources.map((s) => (
              <TableHead key={s} className="text-right">{s} tax</TableHead>
            ))}
            <TableHead className="text-right">Taxable sales</TableHead>
            <TableHead className="text-right">Tax collected</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Sales</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monthsData.map((m) => (
            <TableRow key={m.key}>
              <TableCell className="font-medium">{m.label}</TableCell>
              {sources.map((s) => (
                <TableCell key={s} className="text-right">
                  {money(m.items.filter((i) => i.source === s).reduce((sum, i) => sum + i.tax_amount, 0))}
                </TableCell>
              ))}
              <TableCell className="text-right">
                {money(m.items.reduce((s, i) => s + i.subtotal, 0))}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {money(m.items.reduce((s, i) => s + i.tax_amount, 0))}
              </TableCell>
              <TableCell className="text-right">
                {money(m.items.reduce((s, i) => s + i.total, 0))}
              </TableCell>
              <TableCell className="text-right">{m.items.length}</TableCell>
            </TableRow>
          ))}
          <TableRow className="font-bold border-t-2">
            <TableCell>Totals</TableCell>
            {sources.map((s) => (
              <TableCell key={s} className="text-right">
                {money(monthsData.flatMap((m) => m.items).filter((i) => i.source === s).reduce((sum, i) => sum + i.tax_amount, 0))}
              </TableCell>
            ))}
            <TableCell className="text-right">{money(totals.subtotal)}</TableCell>
            <TableCell className="text-right">{money(totals.tax)}</TableCell>
            <TableCell className="text-right">{money(totals.total)}</TableCell>
            <TableCell className="text-right">{totals.count}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {/* Per-month transaction detail */}
      <div className="space-y-3">
        {monthsData.map((m) => (
          <Card key={m.key}>
            <CardContent className="pt-4">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setExpanded((e) => ({ ...e, [m.key]: !e[m.key] }))}
                aria-expanded={!!expanded[m.key]}
              >
                <span className="flex items-center gap-2 font-medium">
                  {expanded[m.key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {m.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {m.items.length} taxed sales · {money(m.items.reduce((s, i) => s + i.tax_amount, 0))} tax
                </span>
              </button>

              {expanded[m.key] && (
                m.items.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No taxed sales recorded this month.</p>
                ) : (
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.items
                        .slice()
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((i) => (
                          <TableRow key={i.stripe_charge_id}>
                            <TableCell>{format(new Date(i.date), "MMM d, yyyy h:mm a")}</TableCell>
                            <TableCell className="max-w-[260px] truncate">{i.description}</TableCell>
                            <TableCell>{i.source}</TableCell>
                            <TableCell className="text-right">{money(i.subtotal)}</TableCell>
                            <TableCell className="text-right font-medium">{money(i.tax_amount)}</TableCell>
                            <TableCell className="text-right">{money(i.total)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

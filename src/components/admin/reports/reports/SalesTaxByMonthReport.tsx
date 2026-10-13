import { useMemo, useState } from "react";
import { eachMonthOfInterval, endOfMonth, format, max as maxDate, min as minDate, parseISO, startOfMonth } from "date-fns";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LedgerStatusBar } from "../LedgerStatusBar";
import {
  areaLabel, downloadCsv, fetchLedgerEntries, money, taxSummary, tenderLabel, toBusinessDate, useRevenueSummary,
} from "@/lib/revenueLedger";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function SalesTaxByMonthReport({ dateRange }: Props) {
  // Whole months only: a sales-tax return covers full calendar months.
  const range = useMemo(() => ({
    start: startOfMonth(minDate([dateRange.start, dateRange.end])),
    end: endOfMonth(maxDate([dateRange.start, dateRange.end])),
  }), [dateRange.start, dateRange.end]);
  const { data: rows, isLoading, error } = useRevenueSummary(range);
  const [exporting, setExporting] = useState(false);

  const months = useMemo(() => {
    const all = rows ?? [];
    return eachMonthOfInterval(range).map((m) => {
      const key = format(m, "yyyy-MM");
      const inMonth = all.filter((r) => r.business_date.startsWith(key));
      const cash = taxSummary(inMonth.filter((r) => r.tender !== "card"));
      return { key, label: format(m, "MMMM yyyy"), ...taxSummary(inMonth), offlineTax: cash.tax };
    });
  }, [rows, range]);

  const totals = useMemo(() => taxSummary(rows ?? []), [rows]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const out: Array<Array<string | number>> = [[
        "Month", "Total sales", "Exempt sales", "Taxable sales", "Tax collected", "Tax on cash/check/Clover sales",
      ]];
      for (const m of months) {
        out.push([m.label, m.totalSales.toFixed(2), m.exemptSales.toFixed(2), m.taxableSales.toFixed(2), m.tax.toFixed(2), m.offlineTax.toFixed(2)]);
      }
      out.push(["TOTAL", totals.totalSales.toFixed(2), totals.exemptSales.toFixed(2), totals.taxableSales.toFixed(2), totals.tax.toFixed(2), ""]);
      out.push([]);
      out.push(["Taxable sale detail"]);
      out.push(["Date", "Type", "Area", "Payment method", "Description", "Sale (excl. tax)", "Tax", "Card fee", "Collected", "Estimated", "Reference"]);
      const entries = await fetchLedgerEntries(range.start, range.end, { taxableOnly: true });
      for (const e of entries) {
        out.push([
          e.business_date, e.kind, areaLabel(e.area), tenderLabel(e.tender), e.label || e.description || "",
          (e.net_cents / 100).toFixed(2), (e.tax_cents / 100).toFixed(2), (e.fee_cents / 100).toFixed(2),
          (e.gross_cents / 100).toFixed(2), e.estimated ? "yes" : "", e.stripe_charge_id || e.source_ref,
        ]);
      }
      downloadCsv(`sales-tax-by-month-${format(range.start, "yyyy-MM")}-to-${format(range.end, "yyyy-MM")}.csv`, out);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <LedgerStatusBar estimatedEntries={totals.estimated} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Sales tax collected</p>
          <p className="text-2xl font-bold text-primary">{money(totals.tax)}</p>
          <p className="text-[11px] text-muted-foreground">{months.length} month{months.length === 1 ? "" : "s"}, net of refunds</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Taxable sales</p>
          <p className="text-xl font-semibold">{money(totals.taxableSales)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Total sales</p>
          <p className="text-xl font-semibold">{money(totals.totalSales)}</p>
          <p className="text-[11px] text-muted-foreground">Exempt: {money(totals.exemptSales)}</p>
        </CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Export months + detail (CSV)
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead className="text-right">Total sales</TableHead>
            <TableHead className="text-right">Exempt</TableHead>
            <TableHead className="text-right">Taxable</TableHead>
            <TableHead className="text-right">Tax collected</TableHead>
            <TableHead className="text-right">…of which cash / check / Clover</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {months.map((m) => (
            <TableRow key={m.key}>
              <TableCell className="font-medium">{m.label}</TableCell>
              <TableCell className="text-right">{money(m.totalSales)}</TableCell>
              <TableCell className="text-right">{money(m.exemptSales)}</TableCell>
              <TableCell className="text-right">{money(m.taxableSales)}</TableCell>
              <TableCell className="text-right font-semibold">{money(m.tax)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{money(m.offlineTax)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-bold">Total</TableCell>
            <TableCell className="text-right">{money(totals.totalSales)}</TableCell>
            <TableCell className="text-right">{money(totals.exemptSales)}</TableCell>
            <TableCell className="text-right">{money(totals.taxableSales)}</TableCell>
            <TableCell className="text-right font-bold">{money(totals.tax)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>

      <p className="text-xs text-muted-foreground">
        Months are Detroit calendar months ({format(parseISO(toBusinessDate(range.start)), "MMM d, yyyy")} –{" "}
        {format(parseISO(toBusinessDate(range.end)), "MMM d, yyyy")}). A refund lowers the tax of the month it was
        issued in, so months already filed never change. Card processing fees are listed separately in the CSV; ask
        your accountant whether they belong in gross sales on your return.
      </p>
    </div>
  );
}

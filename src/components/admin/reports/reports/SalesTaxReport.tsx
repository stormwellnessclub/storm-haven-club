import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LedgerStatusBar } from "../LedgerStatusBar";
import {
  AREA_ORDER, areaLabel, downloadCsv, fetchLedgerEntries, money, taxSummary, tenderLabel, toBusinessDate, useRevenueSummary,
  type RevenueSummaryRow,
} from "@/lib/revenueLedger";

interface SalesTaxReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function SalesTaxReport({ dateRange }: SalesTaxReportProps) {
  const { data: rows, isLoading, error } = useRevenueSummary(dateRange);
  const [exporting, setExporting] = useState(false);

  const view = useMemo(() => {
    const all = rows ?? [];
    const groupBy = (key: (r: RevenueSummaryRow) => string) => {
      const keys = [...new Set(all.map(key))];
      return keys.map((k) => ({ key: k, ...taxSummary(all.filter((r) => key(r) === k)) }));
    };
    const byArea = groupBy((r) => r.area).sort((a, b) => AREA_ORDER.indexOf(a.key as never) - AREA_ORDER.indexOf(b.key as never));
    const byTender = groupBy((r) => r.tender).sort((a, b) => b.tax - a.tax);
    return { total: taxSummary(all), byArea, byTender };
  }, [rows]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const entries = await fetchLedgerEntries(dateRange.start, dateRange.end);
      const out: Array<Array<string | number>> = [[
        "Date", "Type", "Area", "Payment method", "Description", "Taxable", "Sale (excl. tax)", "Tax", "Card fee", "Tip", "Collected", "Estimated", "Reference",
      ]];
      for (const e of entries) {
        out.push([
          e.business_date, e.kind, areaLabel(e.area), tenderLabel(e.tender), e.label || e.description || "",
          e.taxable ? "yes" : "no", (e.net_cents / 100).toFixed(2), (e.tax_cents / 100).toFixed(2),
          (e.fee_cents / 100).toFixed(2), (e.tip_cents / 100).toFixed(2), (e.gross_cents / 100).toFixed(2),
          e.estimated ? "yes" : "", e.stripe_charge_id || e.source_ref,
        ]);
      }
      downloadCsv(`sales-tax-${toBusinessDate(dateRange.start)}-to-${toBusinessDate(dateRange.end)}.csv`, out);
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

  const t = view.total;
  const effectiveRate = t.taxableSales > 0 ? (t.tax / t.taxableSales) * 100 : 0;

  return (
    <div className="space-y-6">
      <LedgerStatusBar estimatedEntries={t.estimated} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Sales tax collected</p>
          <p className="text-2xl font-bold text-primary">{money(t.tax)}</p>
          <p className="text-[11px] text-muted-foreground">Net of refunds · {effectiveRate.toFixed(2)}% of taxable sales</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Taxable sales</p>
          <p className="text-xl font-semibold">{money(t.taxableSales)}</p>
          <p className="text-[11px] text-muted-foreground">Excluding the tax itself</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Exempt sales</p>
          <p className="text-xl font-semibold">{money(t.exemptSales)}</p>
          <p className="text-[11px] text-muted-foreground">Memberships, services, passes</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Total sales</p>
          <p className="text-xl font-semibold">{money(t.totalSales)}</p>
          <p className="text-[11px] text-muted-foreground">Card fees charged: {money(t.cardFees)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">By Area</CardTitle>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting || t.entries === 0}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export every sale (CSV)
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Total sales</TableHead>
                <TableHead className="text-right">Exempt</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Tax</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.byArea.map((a) => (
                <TableRow key={a.key}>
                  <TableCell className="font-medium">{areaLabel(a.key)}</TableCell>
                  <TableCell className="text-right">{money(a.totalSales)}</TableCell>
                  <TableCell className="text-right">{money(a.exemptSales)}</TableCell>
                  <TableCell className="text-right">{money(a.taxableSales)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(a.tax)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right">{money(t.totalSales)}</TableCell>
                <TableCell className="text-right">{money(t.exemptSales)}</TableCell>
                <TableCell className="text-right">{money(t.taxableSales)}</TableCell>
                <TableCell className="text-right font-bold">{money(t.tax)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">By Payment Method</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment method</TableHead>
                <TableHead className="text-right">Taxable sales</TableHead>
                <TableHead className="text-right">Tax</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.byTender.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{tenderLabel(r.key)}</TableCell>
                  <TableCell className="text-right">{money(r.taxableSales)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(r.tax)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Includes cash, check and Clover sales recorded in the app, not just Stripe. Refunds reduce tax in the month
            they were issued. Period: {format(dateRange.start, "MMM d, yyyy")} – {format(dateRange.end, "MMM d, yyyy")} (Detroit time).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

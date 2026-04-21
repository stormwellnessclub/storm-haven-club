import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { subMonths } from "date-fns";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BackfillResult {
  ok: boolean;
  charges: { processed: number; inserted: number; skippedNoMember: number };
  invoices: { processed: number; arrearsUpserted: number };
  errorCount: number;
  errors?: string[];
}

export function BackfillPaymentHistoryDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<DateRange>({
    from: subMonths(new Date(), 12),
    to: new Date(),
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("backfill-payment-history", {
        body: {
          start: range.from?.toISOString(),
          end: range.to?.toISOString(),
        },
      });
      if (invokeErr) throw invokeErr;
      if (!data?.ok) throw new Error(data?.error || "Backfill failed");
      setResult(data as BackfillResult);
      queryClient.invalidateQueries({ queryKey: ["failed-payments-history"] });
      queryClient.invalidateQueries({ queryKey: ["unresolved-failed-count"] });
      toast.success(`Backfilled ${data.charges.inserted} charges from Stripe`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Backfill payment history from Stripe</DialogTitle>
          <DialogDescription>
            Imports every charge and invoice from the selected window. Safe to re-run — duplicates are skipped.
            Default is the last 12 months. Maximum range is 24 months.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-2 block">Date range</label>
            <DateRangePicker value={range} onChange={setRange} />
          </div>

          {running && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pulling from Stripe… this can take 30–90 seconds for a full year.
            </div>
          )}

          {result && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Backfill complete
              </div>
              <div>Charges processed: <strong>{result.charges.processed}</strong></div>
              <div>Charges inserted/updated: <strong>{result.charges.inserted}</strong></div>
              <div>Charges skipped (no matching member): <strong>{result.charges.skippedNoMember}</strong></div>
              <div>Invoices processed: <strong>{result.invoices.processed}</strong></div>
              <div>Arrears records upserted: <strong>{result.invoices.arrearsUpserted}</strong></div>
              {result.errorCount > 0 && (
                <div className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {result.errorCount} errors (first few logged in function logs)
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>
            Close
          </Button>
          <Button onClick={handleRun} disabled={running || !range.from || !range.to}>
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…
              </>
            ) : (
              "Run backfill"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

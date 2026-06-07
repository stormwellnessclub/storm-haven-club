import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { ArrearsRow } from "@/hooks/useBillingArrears";

type RowStatus = "pending" | "running" | "success" | "failed" | "skipped";

interface BulkChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: ArrearsRow[];
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BulkChargeDialog({ open, onOpenChange, targets }: BulkChargeDialogProps) {
  const qc = useQueryClient();
  const chargeable = targets.filter((t) => !!t.card_last4);
  const skipped = targets.filter((t) => !t.card_last4);
  const total = chargeable.reduce((s, r) => s + r.outstanding_cents, 0);

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<Record<string, { status: RowStatus; message?: string }>>({});

  useEffect(() => {
    if (open) {
      setResults(
        Object.fromEntries([
          ...chargeable.map((r) => [r.member_id, { status: "pending" as RowStatus }]),
          ...skipped.map((r) => [r.member_id, { status: "skipped" as RowStatus, message: "No card on file" }]),
        ]),
      );
      setFinished(false);
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateRow = (id: string, patch: Partial<{ status: RowStatus; message?: string }>) => {
    setResults((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const run = async () => {
    setRunning(true);
    const concurrency = 3;
    const queue = [...chargeable];
    let okCount = 0;
    let failCount = 0;

    async function worker() {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) return;
        updateRow(row.member_id, { status: "running" });
        try {
          const { data, error } = await supabase.functions.invoke("charge-member-arrears", {
            body: { memberId: row.member_id },
          });
          if (error) {
            failCount++;
            updateRow(row.member_id, { status: "failed", message: error.message });
          } else if (data?.success) {
            okCount++;
            updateRow(row.member_id, { status: "success" });
          } else {
            failCount++;
            updateRow(row.member_id, { status: "failed", message: data?.error || "Charge failed" });
          }
        } catch (e: any) {
          failCount++;
          updateRow(row.member_id, { status: "failed", message: e?.message || "Unexpected error" });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, chargeable.length) }, () => worker()));

    setRunning(false);
    setFinished(true);
    qc.invalidateQueries({ queryKey: ["billing-arrears-summary"] });
    qc.invalidateQueries({ queryKey: ["dunning-timeline"] });
    toast.success(`Charged ${okCount} · Declined ${failCount}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Charge saved cards</DialogTitle>
          <DialogDescription>
            {chargeable.length} member{chargeable.length === 1 ? "" : "s"} · {money(total)} total
            {skipped.length > 0 && (
              <> · {skipped.length} skipped (no card)</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left p-2">Member</th>
                <th className="text-left p-2">Card</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...chargeable, ...skipped].map((r) => {
                const res = results[r.member_id];
                return (
                  <tr key={r.member_id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{r.first_name} {r.last_name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="p-2 text-xs">
                      {r.card_last4 ? `${r.card_brand || ""} ****${r.card_last4}` : <span className="text-destructive">No card</span>}
                    </td>
                    <td className="p-2 text-right">{money(r.outstanding_cents)}</td>
                    <td className="p-2">
                      <StatusPill status={res?.status || "pending"} message={res?.message} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            {finished ? "Close" : "Cancel"}
          </Button>
          {!finished && (
            <Button onClick={run} disabled={running || chargeable.length === 0}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Charge {chargeable.length} card{chargeable.length === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusPill({ status, message }: { status: RowStatus; message?: string }) {
  if (status === "success") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Charged
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex flex-col">
        <Badge variant="destructive" className="gap-1 w-fit">
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
        {message && <span className="text-[11px] text-muted-foreground mt-0.5">{message}</span>}
      </span>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Charging…
      </Badge>
    );
  }
  if (status === "skipped") {
    return <Badge variant="outline" className="text-muted-foreground">Skipped</Badge>;
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  );
}

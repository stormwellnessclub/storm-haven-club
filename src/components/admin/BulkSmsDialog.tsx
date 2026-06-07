import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { ArrearsRow } from "@/hooks/useBillingArrears";

type RowStatus = "pending" | "running" | "success" | "failed" | "skipped";

interface BulkSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: ArrearsRow[];
}

const TEMPLATES = [
  {
    key: "payment-failed",
    label: "Past-due reminder (payment-failed)",
    needsCustom: false,
    preview: (r: ArrearsRow) =>
      `Storm: Payment failed for membership dues. Please update your card to keep your benefits active: stormwellnessclub.com/portal/billing`,
  },
  {
    key: "arrears-balance",
    label: "Outstanding balance reminder",
    needsCustom: false,
    preview: (r: ArrearsRow) =>
      `Storm: You have an outstanding balance of $${(r.outstanding_cents / 100).toFixed(2)}. Please resolve to restore full access: stormwellnessclub.com/portal/billing`,
  },
  {
    key: "admin-custom",
    label: "Custom message",
    needsCustom: true,
    preview: (_r: ArrearsRow) => "",
  },
];

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function renderCustom(body: string, r: ArrearsRow): string {
  return body
    .replace(/\{first_name\}/g, r.first_name || "")
    .replace(/\{last_name\}/g, r.last_name || "")
    .replace(/\{amount\}/g, money(r.outstanding_cents))
    .replace(/\{months\}/g, String(r.months_behind));
}

export function BulkSmsDialog({ open, onOpenChange, targets }: BulkSmsDialogProps) {
  const qc = useQueryClient();
  const reachable = targets.filter((t) => !!t.phone);
  const skipped = targets.filter((t) => !t.phone);

  const [templateKey, setTemplateKey] = useState("payment-failed");
  const [customBody, setCustomBody] = useState(
    "Hi {first_name}, this is Storm Wellness Club. We have an outstanding balance of {amount} on your account. Please reach out so we can help.",
  );
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<Record<string, { status: RowStatus; message?: string }>>({});

  const template = useMemo(() => TEMPLATES.find((t) => t.key === templateKey)!, [templateKey]);

  useEffect(() => {
    if (open) {
      setResults(
        Object.fromEntries([
          ...reachable.map((r) => [r.member_id, { status: "pending" as RowStatus }]),
          ...skipped.map((r) => [r.member_id, { status: "skipped" as RowStatus, message: "No phone" }]),
        ]),
      );
      setRunning(false);
      setFinished(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateRow = (id: string, patch: Partial<{ status: RowStatus; message?: string }>) => {
    setResults((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const send = async () => {
    setRunning(true);
    let okCount = 0;
    let failCount = 0;

    for (const row of reachable) {
      updateRow(row.member_id, { status: "running" });
      try {
        const body = template.key === "admin-custom"
          ? { customBody: renderCustom(customBody, row) }
          : { amount: money(row.outstanding_cents), description: "membership dues", first_name: row.first_name };

        const { data, error } = await supabase.functions.invoke("send-sms", {
          body: {
            to: { phone: row.phone },
            templateKey: template.key,
            variables: body,
            idempotencyKey: `bulk-arrears-${row.member_id}-${Date.now()}`,
            bypassConsent: true,
            metadata: { source: "billing-arrears-bulk", member_id: row.member_id },
          },
        });

        if (error) {
          failCount++;
          updateRow(row.member_id, { status: "failed", message: error.message });
          continue;
        }
        if (data?.success === false || data?.error) {
          failCount++;
          updateRow(row.member_id, { status: "failed", message: data?.error || "Send failed" });
          continue;
        }

        // Log outreach
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("billing_outreach_logs" as any).insert({
          member_id: row.member_id,
          channel: "sms",
          outcome: "left_message",
          note: `Bulk SMS — ${template.label}`,
          outstanding_at_contact_cents: row.outstanding_cents,
          months_behind_at_contact: row.months_behind,
          created_by: userData?.user?.id ?? null,
          created_by_email: userData?.user?.email ?? null,
        } as any);

        okCount++;
        updateRow(row.member_id, { status: "success" });
      } catch (e: any) {
        failCount++;
        updateRow(row.member_id, { status: "failed", message: e?.message || "Unexpected error" });
      }
    }

    setRunning(false);
    setFinished(true);
    qc.invalidateQueries({ queryKey: ["billing-arrears-summary"] });
    qc.invalidateQueries({ queryKey: ["dunning-timeline"] });
    qc.invalidateQueries({ queryKey: ["member-outreach"] });
    toast.success(`Sent ${okCount} · Failed ${failCount}`);
  };

  const previewRow = reachable[0];

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send bulk SMS</DialogTitle>
          <DialogDescription>
            {reachable.length} recipient{reachable.length === 1 ? "" : "s"}
            {skipped.length > 0 && <> · {skipped.length} skipped (no phone)</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Template</Label>
            <Select value={templateKey} onValueChange={setTemplateKey} disabled={running || finished}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {template.needsCustom ? (
            <div>
              <Label>Message body</Label>
              <Textarea
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                rows={4}
                disabled={running || finished}
                placeholder="Merge tags: {first_name}, {last_name}, {amount}, {months}"
              />
              {previewRow && (
                <div className="text-xs text-muted-foreground mt-1">
                  Preview for {previewRow.first_name}: <span className="italic">{renderCustom(customBody, previewRow)}</span>
                </div>
              )}
            </div>
          ) : previewRow ? (
            <div className="rounded border bg-muted/30 p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1">Preview for {previewRow.first_name}</div>
              <div className="italic">{template.preview(previewRow)}</div>
            </div>
          ) : null}
        </div>

        <div className="max-h-[35vh] overflow-y-auto border rounded mt-2">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left p-2">Member</th>
                <th className="text-left p-2">Phone</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...reachable, ...skipped].map((r) => {
                const res = results[r.member_id];
                return (
                  <tr key={r.member_id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{r.first_name} {r.last_name}</div>
                      <div className="text-xs text-muted-foreground">{money(r.outstanding_cents)} owed</div>
                    </td>
                    <td className="p-2 text-xs">{r.phone || <span className="text-destructive">—</span>}</td>
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
            <Button onClick={send} disabled={running || reachable.length === 0}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Send to {reachable.length}
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
        <CheckCircle2 className="h-3 w-3" /> Sent
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
        <Loader2 className="h-3 w-3 animate-spin" /> Sending…
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

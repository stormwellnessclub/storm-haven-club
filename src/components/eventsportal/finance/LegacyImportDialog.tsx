import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { money, formatDay } from "@/lib/eventFinancials";
import { useEnsurePrivateEventFinancials } from "@/hooks/useEventFinancials";

type Step = "preview" | "confirm" | "done";

export function LegacyImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}) {
  const ensure = useEnsurePrivateEventFinancials();
  const [step, setStep] = useState<Step>("preview");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [log, setLog] = useState<{ title: string; outcome: string; ok: boolean }[]>([]);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["legacy-financial-import-preview", open],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_private_event_financial_import");
      if (error) throw error;
      return data as any;
    },
  });

  const records: any[] = data?.records ?? [];
  const importable = records.filter((r) => !r.already_imported);
  const chosen = importable.filter((r) => selected[r.private_event_id] !== false);

  const totals = useMemo(() => {
    const before = data?.totals_before ?? { invoiced_cents: 0, paid_cents: 0 };
    const addInvoiced = chosen.reduce((s, r) => s + (r.invoice_total_cents ?? 0), 0);
    const addPaid = chosen.reduce((s, r) => s + (r.paid_total_cents ?? 0), 0);
    return {
      beforeInvoiced: before.invoiced_cents ?? 0,
      beforePaid: before.paid_cents ?? 0,
      afterInvoiced: (before.invoiced_cents ?? 0) + addInvoiced,
      afterPaid: (before.paid_cents ?? 0) + addPaid,
    };
  }, [data, chosen]);

  const runImport = async () => {
    setBusy(true);
    const entries: { title: string; outcome: string; ok: boolean }[] = [];
    for (const r of chosen) {
      try {
        await ensure.mutateAsync(r.private_event_id);
        entries.push({ title: r.title ?? "Untitled event", outcome: "Imported", ok: true });
      } catch (e: any) {
        entries.push({ title: r.title ?? "Untitled event", outcome: e?.message ?? "Failed", ok: false });
      }
    }
    setLog(entries);
    setBusy(false);
    setStep("done");
    onImported();
    refetch();
    toast.success(`${entries.filter((e) => e.ok).length} event(s) brought in`);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("preview");
      setLog([]);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Bring existing events into the financial portal</DialogTitle>
          <DialogDescription>
            Nothing is changed until you confirm. Existing event records, invoices and payment history are never
            deleted, and running this again will not create duplicates.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : step === "done" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Import log</p>
            <ScrollArea className="max-h-72">
              <ul className="space-y-1 text-sm">
                {log.map((l, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-md border p-2">
                    <span>{l.title}</span>
                    <Badge variant={l.ok ? "secondary" : "destructive"}>{l.outcome}</Badge>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              To undo an import, open that event's financial workspace and use Roll back import. It removes only the
              new financial workspace — the original event, its invoices and its payment history stay exactly as they
              were. Roll back is refused once a new payment has been taken through the portal.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Records detected" value={String(records.length)} />
              <Stat label="Already imported" value={String(records.length - importable.length)} />
              <Stat label="Selected to import" value={String(chosen.length)} />
              <Stat label="Need manual review" value={String(records.filter((r) => r.needs_manual_review).length)} />
            </div>

            <div className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-muted-foreground">Invoiced total</span>
                <span>{money(totals.beforeInvoiced)}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{money(totals.afterInvoiced)}</span>
                <span className="ml-6 text-muted-foreground">Paid total</span>
                <span>{money(totals.beforePaid)}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{money(totals.afterPaid)}</span>
              </div>
            </div>

            <ScrollArea className="max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Event</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.private_event_id}>
                      <TableCell>
                        <Checkbox
                          disabled={r.already_imported}
                          checked={!r.already_imported && selected[r.private_event_id] !== false}
                          onCheckedChange={(v) =>
                            setSelected((s) => ({ ...s, [r.private_event_id]: v === true }))
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.title ?? "Untitled"}</TableCell>
                      <TableCell>{formatDay(r.event_date)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.client_name ?? "—"}
                        <div className="text-xs">{r.client_email ?? ""}</div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {r.pricing_mode === "flat"
                          ? `Flat ${money(r.flat_total_cents)}`
                          : `${r.line_item_count} line item(s) · ${money(r.line_item_total_cents)}`}
                      </TableCell>
                      <TableCell className="text-right">{money(r.invoice_total_cents)}</TableCell>
                      <TableCell className="text-right">{money(r.paid_total_cents)}</TableCell>
                      <TableCell className="space-y-1">
                        {r.already_imported && <Badge variant="secondary">Already imported — will be skipped</Badge>}
                        {r.needs_manual_review && (
                          <Badge variant="destructive" className="flex w-fit items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Manual review
                          </Badge>
                        )}
                        {(r.missing ?? []).map((m: string) => (
                          <div key={m} className="text-xs text-muted-foreground">
                            Missing: {m}
                          </div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Field mapping</p>
              <ul className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                {(data?.field_mapping ?? []).map((m: any, i: number) => (
                  <li key={i}>
                    {m.from} <ArrowRight className="inline h-3 w-3" /> {m.to}
                  </li>
                ))}
              </ul>
            </div>

            {step === "confirm" && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                Confirm import of {chosen.length} event{chosen.length === 1 ? "" : "s"}. Existing records are left in
                place and no client is contacted.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {step === "done" ? "Close" : "Cancel"}
          </Button>
          {step === "preview" && (
            <Button disabled={chosen.length === 0} onClick={() => setStep("confirm")}>
              Review and continue
            </Button>
          )}
          {step === "confirm" && (
            <Button disabled={busy} onClick={runImport}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Import {chosen.length} event
              {chosen.length === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-serif text-xl text-primary">{value}</div>
    </div>
  );
}

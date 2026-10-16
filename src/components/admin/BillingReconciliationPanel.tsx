import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, CalendarRange, CheckCircle2, ChevronDown, ChevronUp, Link2, Loader2, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
const db = supabase as any;
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Billing reconciliation: what the nightly comparison with Stripe found and fixed.
 * Corrections that release a member are applied automatically; anything that
 * would restrict a member is listed here for staff to review.
 */

interface RunSummary {
  corrected?: number;
  needs_review?: number;
  invoices_checked?: number;
  complete?: boolean;
}

interface ReconRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: string;
  status: "running" | "succeeded" | "failed";
  summary: RunSummary;
  error: string | null;
}

interface ReconItem {
  id: string;
  created_at: string;
  member_id: string | null;
  stripe_invoice_id: string | null;
  kind: string;
  action: "corrected" | "needs_review" | "info";
  message: string;
  details: { charge_id?: string; invoice_id?: string } | null;
  members: { first_name: string | null; last_name: string | null } | null;
}

interface RepairRow {
  repair: string;
  member_id: string | null;
  member_name: string | null;
  stripe_invoice_id: string | null;
  detail: string;
}

const REPAIR_LABELS: Record<string, string> = {
  failed_attempt_has_later_payment: "Failure shown although the bill was paid",
  month_owed_but_paid: "Month shown as owed although paid",
  reminders_running_for_paid_bill: "Payment reminders running for a paid bill",
};

const KIND_LABELS: Record<string, string> = {
  marked_paid: "Marked paid",
  marked_void: "Invoice voided",
  recorded_missed_payment: "Missed payment recorded",
  cleared_past_due_flag: "Past-due flag cleared",
  updated_open_invoice: "Open invoice refreshed",
  written_off_in_stripe: "Written off in Stripe",
  unpaid_in_stripe_not_tracked: "Unpaid in Stripe, not tracked",
  owes_but_not_flagged: "Owes but not flagged",
  invoice_missing_in_stripe: "Invoice missing in Stripe",
  paid_invoice_no_member: "Payment with no member",
  failure_linked_to_payment: "Failure linked to later payment",
  linked_late_failure: "Failure linked to later payment",
  applied_standalone_payment: "Separate payment applied to bill",
  standalone_payment_not_applied: "Separate payment not applied to a bill",
  possible_double_payment: "Possible double payment",
};

const memberName = (i: ReconItem) =>
  i.members ? `${i.members.first_name ?? ""} ${i.members.last_name ?? ""}`.trim() || "Member" : "—";

export function BillingReconciliationPanel() {
  const qc = useQueryClient();
  const [showCorrections, setShowCorrections] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const lastRun = useQuery({
    queryKey: ["billing-reconciliation", "last-run"],
    queryFn: async () => {
      const { data, error } = await db
        .from("billing_reconciliation_runs")
        .select("id, started_at, finished_at, trigger, status, summary, error")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ReconRun | null;
    },
    refetchInterval: (q) => (q.state.data?.status === "running" ? 5000 : false),
  });

  const openReviews = useQuery({
    queryKey: ["billing-reconciliation", "open-reviews"],
    queryFn: async () => {
      const { data, error } = await db
        .from("billing_reconciliation_items")
        .select("id, created_at, member_id, stripe_invoice_id, kind, action, message, details, members!billing_reconciliation_items_member_id_fkey(first_name, last_name)")
        .eq("action", "needs_review")
        .is("reviewed_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ReconItem[];
    },
  });

  const corrections = useQuery({
    queryKey: ["billing-reconciliation", "corrections", lastRun.data?.id],
    enabled: showCorrections && !!lastRun.data?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("billing_reconciliation_items")
        .select("id, created_at, member_id, stripe_invoice_id, kind, action, message, details, members!billing_reconciliation_items_member_id_fkey(first_name, last_name)")
        .eq("action", "corrected")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ReconItem[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["billing-reconciliation"] });
    qc.invalidateQueries({ queryKey: ["billing-arrears-summary"] });
  };

  const runNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("reconcile-billing", { body: { trigger: "manual" } });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data.error || "Reconciliation failed");
      return data as RunSummary;
    },
    onSuccess: (d) =>
      toast.success(`Checked against Stripe: ${d.corrected ?? 0} fixed, ${d.needs_review ?? 0} to review`),
    onError: (e) => toast.error((e as Error).message),
    onSettled: invalidate,
  });

  const review = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("review_billing_reconciliation_item", { p_item_id: id, p_note: notes[id] || undefined });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Marked as reviewed"),
    onError: (e) => toast.error((e as Error).message),
    onSettled: invalidate,
  });

  // Existing records where a failure was recorded after the payment (preview only).
  const repairs = useQuery({
    queryKey: ["billing-reconciliation", "repair-preview"],
    queryFn: async () => {
      const { data, error } = await db.rpc("billing_link_repair_preview_for_staff");
      if (error) throw error;
      return (data ?? []) as RepairRow[];
    },
  });
  const [showRepairs, setShowRepairs] = useState(false);

  const applyRepairs = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc("apply_billing_link_repairs");
      if (error) throw error;
      return data as Record<string, number>;
    },
    onSuccess: (d) => toast.success(
      `Fixed: ${d.failed_attempts_linked ?? 0} failures linked, ${d.months_marked_paid ?? 0} months marked paid, ${d.reminder_sequences_closed ?? 0} reminder sequences closed, ${d.members_cleared ?? 0} members cleared`,
    ),
    onError: (e) => toast.error((e as Error).message),
    onSettled: invalidate,
  });

  const applyPayment = useMutation({
    mutationFn: async (item: ReconItem) => {
      const { data, error } = await supabase.functions.invoke("reconcile-billing", {
        body: { action: "apply_payment", charge_id: item.details?.charge_id, invoice_id: item.details?.invoice_id, item_id: item.id },
      });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data.error || "Could not apply the payment");
    },
    onSuccess: () => toast.success("Payment applied to the bill. Stripe will not charge the card for it."),
    onError: (e) => toast.error((e as Error).message),
    onSettled: invalidate,
  });

  const [datesPass, setDatesPass] = useState(0);
  const fixDates = useMutation({
    mutationFn: async () => {
      let afterId: string | null = null;
      let fixed = 0;
      for (let pass = 1; pass <= 40; pass++) {
        setDatesPass(pass);
        const { data, error } = await supabase.functions.invoke("reconcile-billing", {
          body: { action: "fix_bill_dates", ...(afterId ? { after_id: afterId } : {}) },
        });
        if (error) throw new Error(error.message);
        if (data?.success === false) throw new Error(data.error || "Could not fix bill dates");
        fixed += Number(data?.fixed ?? 0);
        if (!data?.more) break;
        afterId = data.next_after_id;
      }
      return fixed;
    },
    onSuccess: (fixed) => toast.success(fixed ? `Corrected the dates on ${fixed} bills` : "All bill dates were already correct"),
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => { setDatesPass(0); invalidate(); },
  });

  // Cleanup of rows the old nightly rebuild copied into payment history.
  interface CleanupResult {
    checked: number; link: number; remove: number; linked_failures: number;
    examples: Array<{ action: "link" | "remove"; amount: number; date: string | null; description: string | null }>;
  }
  const [cleanupPreview, setCleanupPreview] = useState<CleanupResult | null>(null);
  const [cleanupPass, setCleanupPass] = useState(0);
  const runCleanup = async (apply: boolean): Promise<CleanupResult> => {
    const total: CleanupResult = { checked: 0, link: 0, remove: 0, linked_failures: 0, examples: [] };
    let afterId: string | null = null;
    for (let pass = 1; pass <= 60; pass++) {
      setCleanupPass(pass);
      const { data, error } = await supabase.functions.invoke("reconcile-billing", {
        body: { action: "clean_payment_history", apply, ...(afterId ? { after_id: afterId } : {}) },
      });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data.error || "Cleanup failed");
      total.checked += Number(data.checked ?? 0);
      total.link += Number(data.link ?? 0);
      total.remove += Number(data.remove ?? 0);
      total.linked_failures += Number(data.linked_failures ?? 0);
      if (total.examples.length < 25) total.examples.push(...(data.examples ?? []).slice(0, 25 - total.examples.length));
      if (!data.more) break;
      afterId = data.next_after_id;
    }
    return total;
  };
  const previewCleanup = useMutation({
    mutationFn: () => runCleanup(false),
    onSuccess: (r) => {
      setCleanupPreview(r);
      if (r.checked === 0) toast.success("Payment history is clean: nothing to fix");
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => setCleanupPass(0),
  });
  const applyCleanup = useMutation({
    mutationFn: () => runCleanup(true),
    onSuccess: (r) => {
      setCleanupPreview(null);
      toast.success(`Payment history cleaned: ${r.link} payments linked to their bill (${r.linked_failures} failures resolved), ${r.remove} non-dues charges removed (backed up)`);
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => { setCleanupPass(0); invalidate(); },
  });

  const run = lastRun.data;
  const reviews = openReviews.data ?? [];
  const repairRows = repairs.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" /> Stripe reconciliation
          </CardTitle>
          <CardDescription>
            Every night the app checks its billing records against Stripe. Payments Stripe collected are marked paid
            automatically; anything that would restrict a member is listed below for review. It never charges anyone.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => fixDates.mutate()} disabled={fixDates.isPending}
            title="Bills used to be labelled with the month before the one they cover. This re-reads each bill from Stripe and stores its real dates.">
            {fixDates.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarRange className="h-4 w-4 mr-2" />}
            {fixDates.isPending ? `Fixing dates… ${datesPass > 1 ? `pass ${datesPass}` : ""}` : "Fix bill dates"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => runNow.mutate()} disabled={runNow.isPending || run?.status === "running"}>
            {runNow.isPending || run?.status === "running"
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <RefreshCw className="h-4 w-4 mr-2" />}
            Run now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {!run ? (
            <span className="text-muted-foreground">Not run yet.</span>
          ) : (
            <>
              <span className="text-muted-foreground">
                Last check {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                {" "}({run.trigger === "manual" ? "run by staff" : "nightly"})
              </span>
              {run.status === "succeeded" && (
                <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {run.summary.corrected ?? 0} fixed</Badge>
              )}
              {run.status === "running" && <Badge variant="secondary">Running…</Badge>}
              {run.status === "failed" && <Badge variant="destructive">Failed: {run.error}</Badge>}
              {run.status === "succeeded" && run.summary.complete === false && (
                <Badge variant="secondary">Partial check, continues next run</Badge>
              )}
            </>
          )}
        </div>

        {repairRows.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Wrench className="h-4 w-4" /> {repairRows.length} old record{repairRows.length === 1 ? "" : "s"} show a failure although the bill was paid
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  A "payment failed" notice was recorded after the payment for the same bill. Applying links each failure
                  to its payment, marks those months paid, stops their reminders and clears members who owe nothing.
                  Every change is logged below.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowRepairs((v) => !v)}>
                  {showRepairs ? "Hide list" : "Review list"}
                </Button>
                <Button
                  size="sm"
                  disabled={applyRepairs.isPending}
                  onClick={() => {
                    if (window.confirm(`Apply these ${repairRows.length} fixes? Each change is logged.`)) applyRepairs.mutate();
                  }}
                >
                  {applyRepairs.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Apply fixes
                </Button>
              </div>
            </div>
            {showRepairs && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repairRows.map((r, idx) => (
                    <TableRow key={`${r.repair}-${r.stripe_invoice_id}-${idx}`}>
                      <TableCell className="align-top">
                        {r.member_id ? <Link className="underline" to={`/admin/members/${r.member_id}`}>{r.member_name || "Member"}</Link> : "—"}
                      </TableCell>
                      <TableCell className="align-top">{REPAIR_LABELS[r.repair] ?? r.repair}</TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">{r.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium"><Wrench className="h-4 w-4" /> Payment history cleanup</p>
              <p className="text-xs text-muted-foreground mt-1">
                The old nightly rebuild copied café, shop and spa charges into dues payment history and saved dues
                payments without their bill, so failures never linked to the payment that followed. This links each
                dues payment to its bill and removes the other charges (a backup of every removed row is kept).
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={previewCleanup.isPending || applyCleanup.isPending} onClick={() => previewCleanup.mutate()}>
                {previewCleanup.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {previewCleanup.isPending ? `Checking… ${cleanupPass > 1 ? `pass ${cleanupPass}` : ""}` : "Check payment history"}
              </Button>
              {cleanupPreview && cleanupPreview.checked > 0 && (
                <Button
                  size="sm"
                  disabled={applyCleanup.isPending}
                  onClick={() => {
                    if (window.confirm(`Link ${cleanupPreview.link} payments to their bill and remove ${cleanupPreview.remove} non-dues charges from payment history (backed up)?`)) applyCleanup.mutate();
                  }}
                >
                  {applyCleanup.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {applyCleanup.isPending ? `Applying… ${cleanupPass > 1 ? `pass ${cleanupPass}` : ""}` : "Apply cleanup"}
                </Button>
              )}
            </div>
          </div>
          {cleanupPreview && cleanupPreview.checked > 0 && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>{cleanupPreview.link}</strong> dues payments will be linked to their bill ·{" "}
                <strong>{cleanupPreview.remove}</strong> non-dues charges will be removed from payment history
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Change</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Charge</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cleanupPreview.examples.map((ex, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{ex.action === "link" ? "Link to bill" : "Remove (backed up)"}</TableCell>
                      <TableCell className="whitespace-nowrap">{ex.date ? format(new Date(ex.date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="max-w-[320px] truncate">{ex.description || "—"}</TableCell>
                      <TableCell className="text-right">${Number(ex.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {cleanupPreview.checked > cleanupPreview.examples.length && (
                <p className="text-xs text-muted-foreground">Showing the first {cleanupPreview.examples.length} of {cleanupPreview.checked}.</p>
              )}
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing needs review.</p>
        ) : (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-destructive" /> {reviews.length} item{reviews.length === 1 ? "" : "s"} need{reviews.length === 1 ? "s" : ""} review
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Found</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-[260px]">Note &amp; action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap align-top">{format(new Date(i.created_at), "MMM d")}</TableCell>
                    <TableCell className="align-top">
                      {i.member_id ? <Link className="underline" to={`/admin/members/${i.member_id}`}>{memberName(i)}</Link> : "—"}
                      {i.stripe_invoice_id && <div className="text-xs text-muted-foreground">{i.stripe_invoice_id}</div>}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className="mb-1">{KIND_LABELS[i.kind] ?? i.kind}</Badge>
                      <p className="text-sm">{i.message}</p>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex gap-2">
                        <Input
                          placeholder="What was done (optional)"
                          value={notes[i.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [i.id]: e.target.value }))}
                          className="h-8"
                        />
                        <Button size="sm" variant="secondary" onClick={() => review.mutate(i.id)} disabled={review.isPending}>
                          Done
                        </Button>
                      </div>
                      {i.kind === "standalone_payment_not_applied" && i.details?.charge_id && i.details?.invoice_id && (
                        <Button
                          size="sm"
                          className="mt-2 w-full"
                          disabled={applyPayment.isPending}
                          onClick={() => {
                            if (window.confirm("Apply this separate payment to the open bill? The bill will be marked paid outside Stripe and Stripe will stop retrying the card for it.")) {
                              applyPayment.mutate(i);
                            }
                          }}
                        >
                          <Link2 className="h-4 w-4 mr-2" /> Apply to bill
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Button variant="ghost" size="sm" className="px-0" onClick={() => setShowCorrections((v) => !v)}>
          {showCorrections ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          Recent automatic fixes
        </Button>
        {showCorrections && (
          corrections.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (corrections.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No automatic fixes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>What was fixed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(corrections.data ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-nowrap align-top">{format(new Date(i.created_at), "MMM d, h:mm a")}</TableCell>
                    <TableCell className="align-top">
                      {i.member_id ? <Link className="underline" to={`/admin/members/${i.member_id}`}>{memberName(i)}</Link> : "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className="mb-1">{KIND_LABELS[i.kind] ?? i.kind}</Badge>
                      <p className="text-sm">{i.message}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </CardContent>
    </Card>
  );
}

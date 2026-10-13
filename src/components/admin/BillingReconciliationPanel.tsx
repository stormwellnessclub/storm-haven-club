import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  members: { first_name: string | null; last_name: string | null } | null;
}

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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from("billing_reconciliation_items")
        .select("id, created_at, member_id, stripe_invoice_id, kind, action, message, members!billing_reconciliation_items_member_id_fkey(first_name, last_name)")
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
      const { data, error } = await supabase
        .from("billing_reconciliation_items")
        .select("id, created_at, member_id, stripe_invoice_id, kind, action, message, members!billing_reconciliation_items_member_id_fkey(first_name, last_name)")
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
      const { error } = await supabase.rpc("review_billing_reconciliation_item", { p_item_id: id, p_note: notes[id] || undefined });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Marked as reviewed"),
    onError: (e) => toast.error((e as Error).message),
    onSettled: invalidate,
  });

  const run = lastRun.data;
  const reviews = openReviews.data ?? [];

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
        <Button size="sm" variant="outline" onClick={() => runNow.mutate()} disabled={runNow.isPending || run?.status === "running"}>
          {runNow.isPending || run?.status === "running"
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <RefreshCw className="h-4 w-4 mr-2" />}
          Run now
        </Button>
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

import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import {
  XCircle, Download, ExternalLink, Loader2, RefreshCw, CheckCircle2, History, DollarSign, Users, TrendingUp, Wand2, Mail,
} from "lucide-react";
import { format, subDays, subMonths, startOfYear, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  useFailedPaymentsHistory,
  type FailedHistoryFilters,
  type HistoryStatusFilter,
  type HistoryBillingType,
  type FailedHistoryRow,
} from "@/hooks/useFailedPaymentsHistory";
import { BackfillPaymentHistoryDialog } from "@/components/admin/BackfillPaymentHistoryDialog";
import { MembersNotBilledCard } from "@/components/admin/MembersNotBilledCard";
import { ArrearsClassificationBadge } from "@/components/admin/ArrearsClassificationBadge";
import { useArrearsReconciliation, type ArrearsClassification } from "@/hooks/useArrearsReconciliation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Preset = "7d" | "30d" | "90d" | "ytd" | "12m" | "all" | "month" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "12m", label: "Last 12 months" },
  { value: "month", label: "By month" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

const MONTH_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  offset: i,
  label: format(subMonths(new Date(), i), "MMMM yyyy"),
}));

function rangeForPreset(preset: Preset, monthOffset = 0): DateRange {
  const now = new Date();
  switch (preset) {
    case "7d": return { from: subDays(now, 7), to: now };
    case "30d": return { from: subDays(now, 30), to: now };
    case "90d": return { from: subDays(now, 90), to: now };
    case "ytd": return { from: startOfYear(now), to: now };
    case "12m": return { from: subMonths(now, 12), to: now };
    case "all": return { from: new Date("2024-01-01"), to: now };
    case "month": {
      const m = subMonths(now, monthOffset);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    }
    case "custom": return { from: subDays(now, 30), to: now };
  }
}

const BILLING_TYPES: { value: HistoryBillingType; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "membership_dues", label: "Membership Dues" },
  { value: "annual_fee", label: "Annual Fee" },
  { value: "initiation_fee", label: "Initiation Fee" },
  { value: "manual_charge", label: "Manual Charge" },
  { value: "cafe", label: "Café" },
  { value: "shop", label: "Shop" },
  { value: "guest_pass", label: "Guest Pass" },
];

const STATUSES: { value: HistoryStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "unresolved", label: "Unresolved" },
  { value: "failed", label: "Failed" },
  { value: "requires_action", label: "Requires action" },
  { value: "succeeded", label: "Succeeded" },
  { value: "refunded", label: "Refunded" },
];

function statusBadge(status: string, recovered: boolean) {
  if (recovered) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Recovered</Badge>;
  switch (status) {
    case "failed": return <Badge variant="destructive">Failed</Badge>;
    case "requires_action": return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Action Req</Badge>;
    case "succeeded": return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Succeeded</Badge>;
    case "refunded": return <Badge variant="secondary">Refunded</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

function exportCsv(rows: FailedHistoryRow[]) {
  const headers = [
    "Date","Member","Email","Tier","Type","Amount","Status","Decline Code","Reason",
    "Attempt","Next Retry","Recovered","Stripe Charge","Stripe Invoice",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((r) => [
      r.created_at,
      `"${r.member_name.replace(/"/g, '""')}"`,
      r.member_email,
      r.membership_type ?? "",
      r.billing_type,
      r.amount.toFixed(2),
      r.status,
      r.decline_code ?? "",
      `"${(r.decline_reason || r.failure_message || "").replace(/"/g, '""')}"`,
      r.attempt_number ?? "",
      r.next_retry_at ?? "",
      r.recovered ? "Yes" : "No",
      r.stripe_charge_id ?? "",
      r.stripe_invoice_id ?? "",
    ].join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `failed-payments-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FailedPaymentsHistory() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>("12m");
  const [monthOffset, setMonthOffset] = useState<number>(0);
  const [range, setRange] = useState<DateRange>(rangeForPreset("12m"));
  const [search, setSearch] = useState("");
  const [billingType, setBillingType] = useState<HistoryBillingType>("all");
  const [status, setStatus] = useState<HistoryStatusFilter>("unresolved");
  const [declineCode, setDeclineCode] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [backfillOpen, setBackfillOpen] = useState(false);

  // Resolution dialog state
  const [resolveTarget, setResolveTarget] = useState<FailedHistoryRow | null>(null);
  const [resolveReason, setResolveReason] = useState<string>("manual_resolution");
  const [resolveNote, setResolveNote] = useState<string>("");

  const filters: FailedHistoryFilters = useMemo(() => ({
    from: range.from,
    to: range.to,
    search: search || undefined,
    billingType: billingType === "all" ? undefined : billingType,
    status: status === "all" ? undefined : status,
    declineCode: declineCode === "all" ? undefined : declineCode,
    minAmount: minAmount ? Number(minAmount) : undefined,
    maxAmount: maxAmount ? Number(maxAmount) : undefined,
  }), [range, search, billingType, status, declineCode, minAmount, maxAmount]);

  const { data: rows, isLoading, refetch, isFetching } = useFailedPaymentsHistory(filters);

  const reconcileTargetIds = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => !r.resolved_at && (r.status === "failed" || r.status === "requires_action"))
        .map((r) => r.id),
    [rows],
  );
  const { results: reconcileResults, reconcile, isLoading: reconcileLoading } =
    useArrearsReconciliation(reconcileTargetIds, { autoRun: true, batchSize: 8 });

  const summary = useMemo(() => {
    const list = rows ?? [];
    const failed = list.filter((r) => r.status === "failed" || r.status === "requires_action");
    const totalFailedAmount = failed.reduce((s, r) => s + r.amount, 0);
    const uniqueMembers = new Set(failed.map((r) => r.member_id).filter(Boolean)).size;
    const recovered = failed.filter((r) => r.recovered).length;
    const recoveryRate = failed.length > 0 ? (recovered / failed.length) * 100 : 0;
    const declineCounts: Record<string, number> = {};
    for (const r of failed) {
      if (r.decline_code) declineCounts[r.decline_code] = (declineCounts[r.decline_code] || 0) + 1;
    }
    const topDecline = Object.entries(declineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return {
      totalAmount: totalFailedAmount,
      count: failed.length,
      uniqueMembers,
      recoveryRate,
      topDecline,
    };
  }, [rows]);

  const declineCodes = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => r.decline_code && set.add(r.decline_code));
    return Array.from(set).sort();
  }, [rows]);

  const openResolveDialog = (row: FailedHistoryRow) => {
    const r = reconcileResults.get(row.id);
    setResolveReason(r?.suggested_resolution_reason ?? "manual_resolution");
    setResolveNote("");
    setResolveTarget(row);
  };

  const submitResolve = async () => {
    if (!resolveTarget) return;
    const newMetadata = {
      resolution: {
        reason: resolveReason,
        note: resolveNote || null,
        resolved_at: new Date().toISOString(),
      },
    };
    const isManualCharge = resolveTarget.id.startsWith("mc_");
    const targetTable = isManualCharge ? "manual_charges" : "payment_attempts";
    const targetId = isManualCharge ? resolveTarget.id.slice(3) : resolveTarget.id;
    const { error } = await supabase
      .from(targetTable as any)
      .update({ resolved_at: new Date().toISOString(), metadata: newMetadata as any })
      .eq("id", targetId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Marked resolved (${resolveReason.replace(/_/g, " ")})`);
      setResolveTarget(null);
      refetch();
    }
  };

  // Bulk auto-resolve rows whose reconciliation suggests application_cancelled or superseded_by_later_payment
  const autoResolvableRows = useMemo(() => {
    const out: { row: FailedHistoryRow; reason: string }[] = [];
    for (const row of rows ?? []) {
      if (row.resolved_at) continue;
      if (row.status !== "failed" && row.status !== "requires_action") continue;
      const recon = reconcileResults.get(row.id);
      if (!recon) continue;
      const reason = recon.suggested_resolution_reason;
      if (reason === "application_cancelled" || reason === "superseded_by_later_payment") {
        out.push({ row, reason });
      }
    }
    return out;
  }, [rows, reconcileResults]);

  const [bulkRunning, setBulkRunning] = useState(false);
  const runBulkAutoResolve = async () => {
    if (autoResolvableRows.length === 0) {
      toast.info("Nothing to auto-resolve");
      return;
    }
    setBulkRunning(true);
    let success = 0;
    let failed = 0;
    for (const { row, reason } of autoResolvableRows) {
      const newMetadata = {
        resolution: {
          reason,
          note: "Auto-resolved by bulk reconciliation",
          resolved_at: new Date().toISOString(),
          bulk: true,
        },
      };
      const { error } = await supabase
        .from("payment_attempts")
        .update({ resolved_at: new Date().toISOString(), metadata: newMetadata as any })
        .eq("id", row.id);
      if (error) failed++;
      else success++;
    }
    setBulkRunning(false);
    if (failed === 0) {
      toast.success(`Auto-resolved ${success} arrears`);
    } else {
      toast.warning(`Resolved ${success}, failed ${failed}`);
    }
    refetch();
  };

  return (
    <AdminLayout title="Failed Payments History">
      <div className="space-y-4">
        {/* Header actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <History className="h-5 w-5" />
            <span className="text-sm">Audit-grade view of every payment attempt across Stripe and the database.</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(rows ?? [])} disabled={!rows?.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={runBulkAutoResolve}
              disabled={bulkRunning || autoResolvableRows.length === 0 || reconcileLoading}
              title="Auto-resolves rows classified as Application Cancelled or Superseded"
            >
              {bulkRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              Auto-resolve ({autoResolvableRows.length})
            </Button>
            <Button size="sm" onClick={() => setBackfillOpen(true)}>
              Backfill from Stripe
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Failed $</p>
                <DollarSign className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-2xl font-bold text-destructive">${summary.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Failed count</p>
              <p className="text-2xl font-bold">{summary.count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Members affected</p>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{summary.uniqueMembers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Recovery rate</p>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold">{summary.recoveryRate.toFixed(0)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Top decline</p>
              <p className="text-lg font-semibold truncate">{summary.topDecline}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <Select value={preset} onValueChange={(v: Preset) => {
                setPreset(v);
                if (v === "month") setRange(rangeForPreset("month", monthOffset));
                else if (v !== "custom") setRange(rangeForPreset(v));
              }}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {preset === "month" && (
                <Select
                  value={String(monthOffset)}
                  onValueChange={(v) => {
                    const o = Number(v);
                    setMonthOffset(o);
                    setRange(rangeForPreset("month", o));
                  }}
                >
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((m) => (
                      <SelectItem key={m.offset} value={String(m.offset)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {preset === "custom" && (
                <DateRangePicker value={range} onChange={setRange} className="w-[280px]" />
              )}
              <Input
                placeholder="Search member name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[260px]"
              />
              <Select value={billingType} onValueChange={(v: HistoryBillingType) => setBillingType(v)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BILLING_TYPES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v: HistoryStatusFilter) => setStatus(v)}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={declineCode} onValueChange={setDeclineCode}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Decline code" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All decline codes</SelectItem>
                  {declineCodes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Min $" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-[100px]" />
              <Input type="number" placeholder="Max $" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="w-[100px]" />
            </div>
          </CardContent>
        </Card>

        {/* Members not billed */}
        <MembersNotBilledCard />

        {/* History table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Payment History
              {rows && <Badge variant="secondary" className="ml-2">{rows.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !rows || rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No payment attempts match the current filters.
                <div className="mt-2 text-sm">If this looks empty, click <strong>Backfill from Stripe</strong> above to import history.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Decline</TableHead>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Next retry</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const recon = reconcileResults.get(r.id);
                      const isUnresolved = !r.resolved_at && (r.status === "failed" || r.status === "requires_action");
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm whitespace-nowrap">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <p className="font-medium">{r.member_name}</p>
                            <p className="text-xs text-muted-foreground">{r.member_email}</p>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{r.billing_type.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell className="font-medium">${r.amount.toFixed(2)}</TableCell>
                          <TableCell>{statusBadge(r.status, r.recovered)}</TableCell>
                          <TableCell>
                            {isUnresolved ? (
                              <ArrearsClassificationBadge result={recon} loading={!recon && reconcileLoading} />
                            ) : r.resolved_at ? (
                              <ArrearsClassificationBadge classification="resolved" />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.decline_code ? (
                              <div>
                                <div>{r.decline_code}</div>
                                {r.decline_reason && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{r.decline_reason}</div>}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{r.attempt_number ?? "—"}</TableCell>
                          <TableCell className="text-sm">
                            {r.next_retry_at ? format(new Date(r.next_retry_at), "MMM d") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {r.member_id && (
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/members/${r.member_id}`)}>View</Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                title="View emails sent to this member"
                                onClick={() => navigate(`/admin/billing-emails?recipient=${encodeURIComponent(r.member_email)}`)}
                              >
                                <Mail className="h-3 w-3 mr-1" /> Emails
                              </Button>
                              {r.stripe_charge_id && (
                                <Button variant="ghost" size="icon" asChild>
                                  <a href={`https://dashboard.stripe.com/payments/${r.stripe_charge_id}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              {isUnresolved && (
                                <Button variant="outline" size="sm" onClick={() => openResolveDialog(r)}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <BackfillPaymentHistoryDialog open={backfillOpen} onOpenChange={setBackfillOpen} />

        {/* Resolve Dialog */}
        <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark payment attempt resolved</DialogTitle>
              <DialogDescription>
                Choose a structured reason for the audit trail. Suggested reason is pre-filled from reconciliation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Resolution reason</Label>
                <Select value={resolveReason} onValueChange={setResolveReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="application_cancelled">Application cancelled (pending activation)</SelectItem>
                    <SelectItem value="superseded_by_later_payment">Superseded by later payment</SelectItem>
                    <SelectItem value="stripe_retry_in_progress">Stripe retry in progress</SelectItem>
                    <SelectItem value="disputed_charge">Disputed charge — see Stripe</SelectItem>
                    <SelectItem value="written_off_uncollectible">Written off — uncollectible</SelectItem>
                    <SelectItem value="manual_resolution">Manual resolution / paid offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setResolveTarget(null)}>Cancel</Button>
              <Button onClick={submitResolve}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

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
  XCircle, Download, ExternalLink, Loader2, RefreshCw, CheckCircle2, History, DollarSign, Users, TrendingUp,
} from "lucide-react";
import { format, subDays, subMonths, startOfYear } from "date-fns";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Preset = "7d" | "30d" | "90d" | "ytd" | "12m" | "all" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "12m", label: "Last 12 months" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

function rangeForPreset(preset: Preset): DateRange {
  const now = new Date();
  switch (preset) {
    case "7d": return { from: subDays(now, 7), to: now };
    case "30d": return { from: subDays(now, 30), to: now };
    case "90d": return { from: subDays(now, 90), to: now };
    case "ytd": return { from: startOfYear(now), to: now };
    case "12m": return { from: subMonths(now, 12), to: now };
    case "all": return { from: new Date("2024-01-01"), to: now };
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
  const [range, setRange] = useState<DateRange>(rangeForPreset("12m"));
  const [search, setSearch] = useState("");
  const [billingType, setBillingType] = useState<HistoryBillingType>("all");
  const [status, setStatus] = useState<HistoryStatusFilter>("unresolved");
  const [declineCode, setDeclineCode] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [backfillOpen, setBackfillOpen] = useState(false);

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

  const handleResolve = async (row: FailedHistoryRow) => {
    const { error } = await supabase
      .from("payment_attempts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Marked resolved");
      refetch();
    }
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
              <Select value={preset} onValueChange={(v: Preset) => { setPreset(v); if (v !== "custom") setRange(rangeForPreset(v)); }}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
                      <TableHead>Decline</TableHead>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Next retry</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm whitespace-nowrap">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <p className="font-medium">{r.member_name}</p>
                          <p className="text-xs text-muted-foreground">{r.member_email}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{r.billing_type.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="font-medium">${r.amount.toFixed(2)}</TableCell>
                        <TableCell>{statusBadge(r.status, r.recovered)}</TableCell>
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
                            {r.stripe_charge_id && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={`https://dashboard.stripe.com/payments/${r.stripe_charge_id}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {!r.resolved_at && (r.status === "failed" || r.status === "requires_action") && (
                              <Button variant="outline" size="sm" onClick={() => handleResolve(r)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <BackfillPaymentHistoryDialog open={backfillOpen} onOpenChange={setBackfillOpen} />
      </div>
    </AdminLayout>
  );
}

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import {
  Mail, Download, Loader2, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  useBillingEmailLog,
  BILLING_EMAIL_TYPES,
  type BillingEmailType,
  type BillingEmailStatus,
  type BillingEmailLogRow,
} from "@/hooks/useBillingEmailLog";

type Preset = "24h" | "7d" | "30d" | "90d" | "month" | "custom";

function rangeForPreset(preset: Preset, monthOffset = 0): DateRange {
  const now = new Date();
  switch (preset) {
    case "24h": return { from: subDays(now, 1), to: now };
    case "7d": return { from: subDays(now, 7), to: now };
    case "30d": return { from: subDays(now, 30), to: now };
    case "90d": return { from: subDays(now, 90), to: now };
    case "month": {
      const m = subMonths(now, monthOffset);
      return { from: startOfMonth(m), to: endOfMonth(m) };
    }
    case "custom": return { from: subDays(now, 7), to: now };
  }
}

const TYPE_LABELS: Record<string, string> = {
  dunning_day_0: "Dunning Day 0",
  dunning_day_1: "Dunning Day 1",
  dunning_day_3: "Dunning Day 3",
  dunning_day_5: "Dunning Day 5",
  dunning_day_7: "Dunning Day 7",
  application_card_declined: "App Card Declined",
  card_expiring: "Card Expiring",
  admin_payment_failed_alert: "Admin Alert",
};

const TYPE_COLORS: Record<string, string> = {
  dunning_day_0: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  dunning_day_1: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  dunning_day_3: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  dunning_day_5: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  dunning_day_7: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-100",
  application_card_declined: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  card_expiring: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  admin_payment_failed_alert: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

function statusBadge(status: string) {
  switch (status) {
    case "sent":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Sent</Badge>;
    case "failed":
    case "dlq":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    case "suppressed":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><AlertCircle className="h-3 w-3 mr-1" />Suppressed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function exportCsv(rows: BillingEmailLogRow[]) {
  const headers = ["Sent At", "Template", "Recipient", "Name", "Status", "Error", "Subject"];
  const csv = [
    headers.join(","),
    ...rows.map((r) => [
      r.sent_at,
      r.email_type,
      r.recipient_email,
      `"${(r.recipient_name ?? "").replace(/"/g, '""')}"`,
      r.status,
      `"${(r.error_message ?? "").replace(/"/g, '""')}"`,
      `"${(r.subject ?? "").replace(/"/g, '""')}"`,
    ].join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `billing-emails-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const MONTH_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  offset: i,
  label: format(subMonths(new Date(), i), "MMMM yyyy"),
}));

const PAGE_SIZE = 50;

export default function BillingEmailLog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialRecipient = searchParams.get("recipient") ?? "";
  const initialMonth = searchParams.get("month");

  const [preset, setPreset] = useState<Preset>(initialMonth ? "month" : "30d");
  const [monthOffset, setMonthOffset] = useState<number>(
    initialMonth ? Math.max(0, MONTH_OPTIONS.findIndex(m => m.label === initialMonth)) : 0,
  );
  const [range, setRange] = useState<DateRange>(
    initialMonth ? rangeForPreset("month", monthOffset) : rangeForPreset("30d"),
  );
  const [selectedTypes, setSelectedTypes] = useState<BillingEmailType[]>([...BILLING_EMAIL_TYPES]);
  const [status, setStatus] = useState<BillingEmailStatus>("all");
  const [recipient, setRecipient] = useState(initialRecipient);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Clear search params after consuming them
    if (searchParams.size > 0) {
      const cleared = new URLSearchParams();
      setSearchParams(cleared, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = useMemo(() => ({
    from: range.from,
    to: range.to,
    types: selectedTypes,
    status,
    recipient: recipient || undefined,
  }), [range, selectedTypes, status, recipient]);

  const { data: rows, isLoading, refetch, isFetching } = useBillingEmailLog(filters);

  const summary = useMemo(() => {
    const list = rows ?? [];
    const sent = list.filter(r => r.status === "sent").length;
    const failed = list.filter(r => r.status === "failed" || r.status === "dlq").length;
    const suppressed = list.filter(r => r.status === "suppressed").length;
    const counts: Record<string, number> = {};
    list.forEach(r => { counts[r.email_type] = (counts[r.email_type] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      total: list.length,
      sent,
      failed,
      suppressed,
      topTemplate: top ? (TYPE_LABELS[top] ?? top) : "—",
    };
  }, [rows]);

  const paged = useMemo(() => {
    const list = rows ?? [];
    return list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [rows, page]);

  const totalPages = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE));

  const toggleType = (t: BillingEmailType) => {
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t],
    );
    setPage(0);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <AdminLayout title="Billing Email Activity">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-5 w-5" />
            <span className="text-sm">
              Dunning, card expiry, and payment failure emails sent across the platform.
            </span>
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
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Total emails</p>
              <p className="text-2xl font-bold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Sent</p>
              <p className="text-2xl font-bold text-green-600">{summary.sent}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-destructive">{summary.failed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Most-used template</p>
              <p className="text-lg font-semibold truncate">{summary.topTemplate}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <Select
                value={preset}
                onValueChange={(v: Preset) => {
                  setPreset(v);
                  if (v === "month") setRange(rangeForPreset("month", monthOffset));
                  else if (v !== "custom") setRange(rangeForPreset(v));
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="month">By month</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {preset === "month" && (
                <Select
                  value={String(monthOffset)}
                  onValueChange={(v) => {
                    const o = Number(v);
                    setMonthOffset(o);
                    setRange(rangeForPreset("month", o));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map(m => (
                      <SelectItem key={m.offset} value={String(m.offset)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {preset === "custom" && (
                <DateRangePicker value={range} onChange={(r) => { setRange(r); setPage(0); }} className="w-[280px]" />
              )}

              <Input
                placeholder="Search recipient (email or name)"
                value={recipient}
                onChange={(e) => { setRecipient(e.target.value); setPage(0); }}
                className="w-[260px]"
              />

              <Select value={status} onValueChange={(v: BillingEmailStatus) => { setStatus(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="suppressed">Suppressed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type pills */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center">Templates:</span>
              {BILLING_EMAIL_TYPES.map(t => {
                const active = selectedTypes.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`text-xs px-2 py-1 rounded-md border transition ${
                      active
                        ? (TYPE_COLORS[t] ?? "bg-primary text-primary-foreground")
                        : "bg-muted text-muted-foreground border-transparent"
                    }`}
                  >
                    {TYPE_LABELS[t] ?? t}
                  </button>
                );
              })}
              <button
                onClick={() => setSelectedTypes([...BILLING_EMAIL_TYPES])}
                className="text-xs px-2 py-1 rounded-md border text-muted-foreground hover:bg-accent"
              >
                All
              </button>
              <button
                onClick={() => setSelectedTypes([])}
                className="text-xs px-2 py-1 rounded-md border text-muted-foreground hover:bg-accent"
              >
                None
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Log
              {rows && <Badge variant="secondary" className="ml-2">{rows.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !rows || rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No billing emails match the current filters.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Sent at</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map(r => {
                        const isOpen = expanded.has(r.id);
                        return (
                          <>
                            <TableRow key={r.id}>
                              <TableCell>
                                <button onClick={() => toggleExpand(r.id)} className="text-muted-foreground">
                                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {format(new Date(r.sent_at), "MMM d, yyyy h:mm a")}
                              </TableCell>
                              <TableCell>
                                <Badge className={TYPE_COLORS[r.email_type] ?? ""} variant="secondary">
                                  {TYPE_LABELS[r.email_type] ?? r.email_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="font-medium text-sm">{r.recipient_name ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">{r.recipient_email}</p>
                              </TableCell>
                              <TableCell>{statusBadge(r.status)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                                {r.error_message ?? "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {r.member_id && (
                                  <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/members/${r.member_id}`)}>
                                    Member
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow>
                                <TableCell colSpan={7} className="bg-muted/30">
                                  <div className="p-3 space-y-2 text-xs">
                                    {r.subject && <div><span className="font-semibold">Subject:</span> {r.subject}</div>}
                                    {r.error_message && (
                                      <div className="text-destructive"><span className="font-semibold">Error:</span> {r.error_message}</div>
                                    )}
                                    <div>
                                      <span className="font-semibold">Template data:</span>
                                      <pre className="mt-1 p-2 bg-background rounded border overflow-x-auto">
                                        {JSON.stringify(r.template_data, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <p className="text-xs text-muted-foreground">
                      Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

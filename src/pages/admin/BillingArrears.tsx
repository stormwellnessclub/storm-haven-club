import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle, Download, ExternalLink, MessageSquarePlus, Phone, Search, DollarSign, Users, CalendarClock, Mail, RefreshCw, Loader2, CreditCard, MessageSquare, X } from "lucide-react";
import {
  useBillingArrears,
  useCreateOutreach,
  type ArrearsRow,
} from "@/hooks/useBillingArrears";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { DunningTimeline } from "@/components/admin/DunningTimeline";
import { BulkChargeDialog } from "@/components/admin/BulkChargeDialog";
import { BulkSmsDialog } from "@/components/admin/BulkSmsDialog";
import { BulkOutreachDialog } from "@/components/admin/BulkOutreachDialog";

function DunningBadge({ row }: { row: ArrearsRow }) {
  if (!row.dunning_status) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      <Badge variant={row.dunning_status === "active" ? "destructive" : "secondary"} className="text-xs">
        {row.dunning_status}
      </Badge>
      <div className="text-xs text-muted-foreground">
        {row.dunning_emails_sent_count} email{row.dunning_emails_sent_count === 1 ? "" : "s"} · retry {row.dunning_retry_count ?? 0}
      </div>
      {row.dunning_next_email_due_at && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Mail className="h-3 w-3" /> Day {row.dunning_next_email_day ?? "?"} — {format(new Date(row.dunning_next_email_due_at), "MMM d")}
        </div>
      )}
    </div>
  );
}

function ChargeCardButton({ row }: { row: ArrearsRow }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (!row.card_last4) {
      toast.error("No card on file");
      return;
    }
    if (!confirm(`Charge ${row.card_brand || "card"} ****${row.card_last4} for ${`$${(row.outstanding_cents / 100).toFixed(2)}`}?`)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("charge-member-arrears", {
        body: { memberId: row.member_id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Payment succeeded");
      } else {
        toast.error(data?.error || "Charge failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Charge failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={handle} disabled={busy || !row.card_last4}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
    </Button>
  );
}

function CreateDuesSubButton({ row, onDone }: { row: ArrearsRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  // Default first-charge date = 1st of next month (YYYY-MM-DD)
  const defaultDate = useMemo(() => {
    const d = new Date();
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);
  const handle = async () => {
    if (!row.stripe_customer_id || !row.card_last4) {
      toast.error("Member needs a saved card before creating a subscription");
      return;
    }
    if (row.stripe_subscription_id) {
      toast.error("Member already has an active dues subscription");
      return;
    }
    const tier = (row.membership_type || "").trim();
    if (!tier) { toast.error("Member has no tier set"); return; }
    const genderRaw = (row.gender || "").toLowerCase();
    const gender = (genderRaw === "male" || genderRaw === "men" || genderRaw === "man" || genderRaw === "m") ? "men" : "women";
    const firstCharge = window.prompt(
      `Create monthly dues subscription for ${row.first_name} ${row.last_name}\n` +
      `Tier: ${tier}  Gender: ${gender}  Card: ****${row.card_last4}\n\n` +
      `First charge date (YYYY-MM-DD):`,
      defaultDate,
    );
    if (!firstCharge) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstCharge)) { toast.error("Invalid date format"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_create_member_subscription",
          memberId: row.member_id,
          tier,
          gender,
          billingType: "monthly",
          isFoundingMember: !!row.is_founding_member,
          startDate: firstCharge,
          firstChargeDate: firstCharge,
        },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Failed");
      toast.success(`Dues subscription created · first charge ${firstCharge}`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create subscription");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="default" onClick={handle} disabled={busy} title="Create monthly dues subscription">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CalendarClock className="h-3.5 w-3.5 mr-1" /> Create sub</>}
    </Button>
  );
}


function SendNoticeButton({ row, onDone }: { row: ArrearsRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (!row.email) { toast.error("Member has no email on file"); return; }
    const amount = (row.outstanding_cents / 100).toFixed(2);
    if (!confirm(
      `Send FORMAL past-due notice to ${row.first_name} ${row.last_name}?\n\n` +
      `Email: ${row.email}\n` +
      `Amount: $${amount}\n` +
      `Months behind: ${row.months_behind}\n\n` +
      `This sends a formal demand for payment citing late fees, membership revocation, and collections consequences.`
    )) return;

    setBusy(true);
    try {
      // Fetch itemized arrears for this member
      const { data: items } = await supabase
        .from("billing_arrears")
        .select("period_start, period_end, amount_due_cents, amount_paid_cents, updated_at")
        .in("id", row.arrears_ids)
        .order("period_start", { ascending: true });

      const today = new Date();
      const unpaid_invoices = (items || []).map((it: any) => {
        const due = (it.amount_due_cents - (it.amount_paid_cents || 0)) / 100;
        const periodLabel = it.period_start
          ? format(new Date(it.period_start), "MMM yyyy")
          : "Unknown period";
        const daysOverdue = it.period_end
          ? Math.max(0, Math.floor((today.getTime() - new Date(it.period_end).getTime()) / (1000 * 60 * 60 * 24)))
          : null;
        return { period: periodLabel, amount: due, days_overdue: daysOverdue ?? "—" };
      });

      const oldestDue = items && items.length && items[0].period_start
        ? format(new Date(items[0].period_start), "MMMM d, yyyy")
        : "—";

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "past_due_formal_notice",
          to: row.email,
          data: {
            first_name: row.first_name,
            last_name: row.last_name,
            member_email: row.email,
            tier: row.membership_type || "Membership",
            total_owed: amount,
            months_late: row.months_behind,
            oldest_due_date: oldestDue,
            card_brand: row.card_brand || null,
            card_last4: row.card_last4 || null,
            last_attempt_date: row.next_retry_at
              ? format(new Date(row.next_retry_at), "MMM d, yyyy")
              : (row.latest_failure_message ? "recently" : "—"),
            unpaid_invoices,
          },
        },
      });
      if (error) throw error;

      // Log to billing_outreach_logs
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("billing_outreach_logs" as any).insert({
        member_id: row.member_id,
        channel: "email",
        outcome: "no_response",
        note: `Sent formal past-due notice ($${amount}, ${row.months_behind} months behind)`,
        outstanding_at_contact_cents: row.outstanding_cents,
        months_behind_at_contact: row.months_behind,
        created_by: userData?.user?.id ?? null,
        created_by_email: userData?.user?.email ?? null,
      } as any);

      toast.success(`Formal notice sent to ${row.email}`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send notice");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      size="sm"
      variant="destructive"
      onClick={handle}
      disabled={busy || !row.email || row.outstanding_cents <= 0}
      title="Send formal past-due collection notice"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><AlertCircle className="h-3.5 w-3.5 mr-1" /> Send Notice</>}
    </Button>
  );
}





const CHANNELS = [
  { value: "call", label: "Call" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
];

const OUTCOMES = [
  { value: "left_message", label: "Left message" },
  { value: "reached_member", label: "Reached member" },
  { value: "payment_promised", label: "Payment promised" },
  { value: "card_update_requested", label: "Card update requested" },
  { value: "resolved", label: "Resolved" },
  { value: "no_response", label: "No response" },
  { value: "other", label: "Other" },
];

const outcomeLabel = (v: string | null | undefined) =>
  OUTCOMES.find(o => o.value === v)?.label ?? v ?? "—";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "past_due") return <Badge variant="destructive">Past Due</Badge>;
  if (s === "active") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
  if (s === "suspended") return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Suspended</Badge>;
  if (s === "frozen") return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Frozen</Badge>;
  if (s === "pending_activation") return <Badge variant="outline">Pending Activation</Badge>;
  if (s === "cancelled" || s === "canceled") return <Badge variant="secondary">Cancelled</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function exportCsv(rows: ArrearsRow[]) {
  const headers = [
    "Name","Email","Phone","Tier","Member Status","Subscription Status","Card",
    "Months Behind","Oldest Due","Outstanding","Last Successful Payment",
    "Next Retry","Last Outreach","Last Outcome","Follow-up","Latest Failure",
    "Dunning Status","Dunning Retry Count","Dunning Emails Sent","Dunning Next Email Day","Dunning Next Email Due","First Failed At",
  ];
  const csv = [
    headers.join(","),
    ...rows.map(r => [
      `"${`${r.first_name} ${r.last_name}`.replace(/"/g,'""')}"`,
      r.email || "",
      r.phone || "",
      r.membership_type || "",
      r.member_status || "",
      r.subscription_status || "",
      r.card_last4 ? `${r.card_brand || ""} ****${r.card_last4}` : "",
      r.months_behind,
      r.oldest_due_period || "",
      (r.outstanding_cents / 100).toFixed(2),
      r.last_successful_payment || "",
      r.next_retry_at || "",
      r.last_outreach_at || "",
      outcomeLabel(r.last_outreach_outcome),
      r.open_follow_up_at || "",
      `"${(r.latest_failure_message || "").replace(/"/g,'""')}"`,
      r.dunning_status || "",
      r.dunning_retry_count ?? "",
      r.dunning_emails_sent_count ?? 0,
      r.dunning_next_email_day ?? "",
      r.dunning_next_email_due_at || "",
      r.dunning_first_failed_at || "",
    ].join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `billing-arrears-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BillingArrears() {
  const [search, setSearch] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [minMonths, setMinMonths] = useState<string>("1");
  const [typeFilter, setTypeFilter] = useState<"dues" | "kids_care" | "other" | "all">("dues");
  const [selected, setSelected] = useState<ArrearsRow | null>(null);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachTarget, setOutreachTarget] = useState<ArrearsRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkChargeOpen, setBulkChargeOpen] = useState(false);
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false);
  const [bulkOutreachOpen, setBulkOutreachOpen] = useState(false);
  const [cancelNoticeOpen, setCancelNoticeOpen] = useState(false);


  const filters = useMemo(() => ({
    search: search || undefined,
    includeCancelled,
    minMonthsBehind: Number(minMonths) || 1,
    typeFilter,
  }), [search, includeCancelled, minMonths, typeFilter]);

  const { data: rows = [], isLoading, refetch, isFetching } = useBillingArrears(filters);

  const selectedRows = useMemo(
    () => rows.filter(r => selectedIds.has(r.member_id)),
    [rows, selectedIds],
  );

  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(prev => {
      if (prev.size === rows.length) return new Set();
      return new Set(rows.map(r => r.member_id));
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkTotal = selectedRows.reduce((s, r) => s + r.outstanding_cents, 0);
  const bulkChargeable = selectedRows.filter(r => !!r.card_last4).length;
  const bulkReachable = selectedRows.filter(r => !!r.phone).length;

  const summary = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.outstanding_cents, 0);
    const oneMonth = rows.filter(r => r.months_behind === 1).length;
    const twoPlus = rows.filter(r => r.months_behind >= 2).length;
    return { total, members: rows.length, oneMonth, twoPlus };
  }, [rows]);

  return (
    <AdminLayout title="Billing Arrears">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Dues Collection</h2>
            <p className="text-sm text-muted-foreground">
              Members with open unpaid membership dues. Source of truth: billing ledger.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              Refresh
            </Button>
            <Button variant="outline" onClick={() => exportCsv(rows)} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <StatCard icon={<DollarSign className="h-4 w-4" />} label="Outstanding" value={money(summary.total)} tone="destructive" />
          <StatCard icon={<Users className="h-4 w-4" />} label="Members in arrears" value={String(summary.members)} />
          <StatCard icon={<AlertCircle className="h-4 w-4" />} label="1 month behind" value={String(summary.oneMonth)} />
          <StatCard icon={<CalendarClock className="h-4 w-4" />} label="2+ months behind" value={String(summary.twoPlus)} tone="destructive" />
        </div>

        <Card>
          <CardContent className="pt-6 flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email, phone" className="pl-8" />
              </div>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs">Months behind</Label>
              <Select value={minMonths} onValueChange={setMinMonths}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1+ month</SelectItem>
                  <SelectItem value="2">2+ months</SelectItem>
                  <SelectItem value="3">3+ months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={includeCancelled} onCheckedChange={setIncludeCancelled} id="cancelled" />
              <Label htmlFor="cancelled" className="text-sm">Include cancelled/removed members</Label>
            </div>
            <div className="w-full">
              <Label className="text-xs">Charge type</Label>
              <div className="inline-flex rounded-md border bg-muted/30 p-0.5 mt-1">
                {([
                  { v: "dues", l: "Dues" },
                  { v: "kids_care", l: "Kids Care" },
                  { v: "other", l: "Other" },
                  { v: "all", l: "All" },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setTypeFilter(opt.v)}
                    className={`px-3 py-1 text-xs rounded ${typeFilter === opt.v ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>


        {selectedIds.size > 0 && (
          <Card className="sticky top-2 z-20 border-primary/40 bg-card shadow-sm">
            <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-semibold">{selectedIds.size} selected</span>
                <span className="text-muted-foreground"> · {money(bulkTotal)} outstanding · {bulkChargeable} chargeable · {bulkReachable} reachable by SMS</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setBulkChargeOpen(true)} disabled={bulkChargeable === 0}>
                  <CreditCard className="h-4 w-4 mr-1" /> Charge saved cards
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkSmsOpen(true)} disabled={bulkReachable === 0}>
                  <MessageSquare className="h-4 w-4 mr-1" /> Send SMS
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkOutreachOpen(true)}>
                  <MessageSquarePlus className="h-4 w-4 mr-1" /> Log outreach
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCancelNoticeOpen(true)}>
                  <Mail className="h-4 w-4 mr-1" /> Cancellation notice
                </Button>

                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Members owing dues ({rows.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No open dues balances match your filters. 🎉
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={rows.length > 0 && selectedIds.size === rows.length}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Months Behind</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Oldest Due</TableHead>
                      <TableHead>Card</TableHead>
                      <TableHead>Last Outreach</TableHead>
                      <TableHead>Dunning</TableHead>
                      <TableHead>Follow-up</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.member_id} className={`hover:bg-muted/40 ${selectedIds.has(r.member_id) ? "bg-muted/30" : ""}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(r.member_id)}
                            onCheckedChange={() => toggleRow(r.member_id)}
                            aria-label={`Select ${r.first_name} ${r.last_name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.first_name} {r.last_name}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                          {r.phone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {r.phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{r.membership_type || "—"}</TableCell>
                        <TableCell>{statusBadge(r.member_status)}</TableCell>
                        <TableCell className="text-right">
                          {r.months_behind >= 2 ? (
                            <Badge variant="destructive">{r.months_behind}</Badge>
                          ) : (
                            <Badge variant="outline">{r.months_behind}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{money(r.outstanding_cents)}</TableCell>
                        <TableCell className="text-xs">
                          {r.oldest_due_period ? format(new Date(r.oldest_due_period), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.card_last4 ? (
                            <div className="flex flex-col gap-0.5">
                              <span>{`${r.card_brand || ""} ****${r.card_last4}`}</span>
                              {(() => {
                                if (!r.card_exp_month || !r.card_exp_year) return null;
                                const expiry = new Date(r.card_exp_year, r.card_exp_month, 0);
                                const days = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
                                if (days > 60) return null;
                                const label = `Exp ${String(r.card_exp_month).padStart(2, "0")}/${String(r.card_exp_year).slice(-2)}`;
                                return (
                                  <Badge variant={days <= 30 ? "destructive" : "outline"} className="text-[10px] w-fit">
                                    {days < 0 ? "Card expired" : days <= 30 ? `${label} • ${days}d` : label}
                                  </Badge>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="text-destructive">No card</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.last_outreach_at ? (
                            <>
                              <div>{format(new Date(r.last_outreach_at), "MMM d")}</div>
                              <div className="text-muted-foreground">{outcomeLabel(r.last_outreach_outcome)}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell><DunningBadge row={r} /></TableCell>
                        <TableCell className="text-xs">
                          {r.open_follow_up_at ? format(new Date(r.open_follow_up_at), "MMM d") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!r.stripe_subscription_id && r.card_last4 && r.stripe_customer_id && r.member_status !== "cancelled" && (
                              <CreateDuesSubButton row={r} onDone={() => refetch()} />
                            )}
                            <ChargeCardButton row={r} />
                            <SendNoticeButton row={r} onDone={() => refetch()} />

                            <Button size="sm" variant="outline" onClick={() => { setOutreachTarget(r); setOutreachOpen(true); }}>
                              <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Log
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                              History
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={`/admin/members/${r.member_id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
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
      </div>

      {/* Member detail / outreach history */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {selected && <MemberArrearsDetail row={selected} onLogOutreach={() => { setOutreachTarget(selected); setOutreachOpen(true); }} />}
        </SheetContent>
      </Sheet>

      {/* Log outreach dialog */}
      <OutreachDialog
        open={outreachOpen}
        onOpenChange={setOutreachOpen}
        target={outreachTarget}
      />

      <BulkChargeDialog
        open={bulkChargeOpen}
        onOpenChange={setBulkChargeOpen}
        targets={selectedRows}
      />
      <BulkSmsDialog
        open={bulkSmsOpen}
        onOpenChange={setBulkSmsOpen}
        targets={selectedRows}
      />
      <BulkOutreachDialog
        open={bulkOutreachOpen}
        onOpenChange={setBulkOutreachOpen}
        targets={selectedRows}
      />
    </AdminLayout>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "destructive" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon} {label}
        </div>
        <div className={`text-2xl font-semibold mt-1 ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function MemberArrearsDetail({ row, onLogOutreach }: { row: ArrearsRow; onLogOutreach: () => void }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>{row.first_name} {row.last_name}</SheetTitle>
        <SheetDescription>{row.email} · {row.phone || "no phone"}</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Outstanding" value={money(row.outstanding_cents)} accent />
          <Stat label="Months behind" value={String(row.months_behind)} accent={row.months_behind >= 2} />
          <Stat label="Tier" value={row.membership_type || "—"} />
          <Stat label="Status" value={row.member_status} />
          <Stat label="Subscription" value={row.subscription_status || "—"} />
          <Stat label="Card" value={row.card_last4 ? `${row.card_brand || ""} ****${row.card_last4}` : "No card"} />
          <Stat label="Last paid" value={row.last_successful_payment ? format(new Date(row.last_successful_payment), "MMM d, yyyy") : "Never"} />
          <Stat label="Next retry" value={row.next_retry_at ? format(new Date(row.next_retry_at), "MMM d, yyyy") : "—"} />
        </div>

        {row.latest_failure_message && (
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Latest failure</div>
              <div className="text-sm font-medium">{row.latest_decline_code || "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">{row.latest_failure_message}</div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button onClick={onLogOutreach}>
            <MessageSquarePlus className="h-4 w-4 mr-2" /> Log outreach
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/admin/members/${row.member_id}`}>Open member</Link>
          </Button>
        </div>

        <DunningTimeline memberId={row.member_id} />
      </div>
    </>
  );
}


function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border rounded p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${accent ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function OutreachDialog({
  open, onOpenChange, target,
}: { open: boolean; onOpenChange: (b: boolean) => void; target: ArrearsRow | null }) {
  const [channel, setChannel] = useState("call");
  const [outcome, setOutcome] = useState("left_message");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const create = useCreateOutreach();

  const submit = async () => {
    if (!target) return;
    await create.mutateAsync({
      member_id: target.member_id,
      channel,
      outcome,
      note: note || undefined,
      follow_up_at: followUp ? new Date(followUp).toISOString() : null,
      outstanding_at_contact_cents: target.outstanding_cents,
      months_behind_at_contact: target.months_behind,
    });
    setNote("");
    setFollowUp("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log outreach</DialogTitle>
          <DialogDescription>
            {target ? `${target.first_name} ${target.last_name} · ${money(target.outstanding_cents)} owed · ${target.months_behind} month(s) behind` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Note</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What was discussed?" rows={4} />
          </div>
          <div>
            <Label>Follow-up date (optional)</Label>
            <Input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save outreach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

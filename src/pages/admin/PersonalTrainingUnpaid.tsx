import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, DollarSign, CreditCard, Link2, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { format as fmtDate, parseISO } from "date-fns";
import { PT_FORMAT_LABEL, PtFormat, formatCents } from "@/lib/ptFormat";
import { calculateProcessingFee } from "@/lib/processingFee";
import { Link } from "react-router-dom";

interface Row {
  id: string;
  user_id: string;
  format: PtFormat;
  starts_at: string;
  duration_minutes: number;
  status: string;
  payment_status: string;
  amount_due_cents: number;
  payment_method: string | null;
  paid_at: string | null;
  payment_note: string | null;
  instructor_id: string | null;
}

interface Person { name: string; email: string; isMember: boolean }

type Tab = "unpaid" | "settled";

export default function PersonalTrainingUnpaid() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("unpaid");
  const [search, setSearch] = useState("");
  const [payRow, setPayRow] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pt-payment-tracking", tab],
    queryFn: async () => {
      let q = (supabase as any)
        .from("pt_appointments")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(300);
      q = tab === "unpaid" ? q.eq("payment_status", "unpaid") : q.in("payment_status", ["paid", "comp"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set(rows.map((r) => r.user_id))), [rows]);
  const { data: people = {} } = useQuery({
    queryKey: ["pt-unpaid-people", userIds],
    enabled: userIds.length > 0,
    queryFn: async (): Promise<Record<string, Person>> => {
      const [{ data: profiles }, { data: members }, { data: nonMembers }] = await Promise.all([
        supabase.from("profiles").select("user_id, email, full_name").in("user_id", userIds),
        supabase.from("members").select("user_id, email, first_name, last_name").in("user_id", userIds),
        supabase.from("non_member_profiles").select("user_id, email, first_name, last_name").in("user_id", userIds),
      ]);
      const map: Record<string, Person> = {};
      (profiles ?? []).forEach((p: any) => { map[p.user_id] = { name: p.full_name ?? p.email, email: p.email, isMember: false }; });
      (nonMembers ?? []).forEach((n: any) => {
        map[n.user_id] = { name: `${n.first_name ?? ""} ${n.last_name ?? ""}`.trim() || n.email, email: n.email, isMember: false };
      });
      (members ?? []).forEach((m: any) => {
        map[m.user_id] = { name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email, email: m.email, isMember: true };
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const p = people[r.user_id];
      return (p?.name ?? "").toLowerCase().includes(s) || (p?.email ?? "").toLowerCase().includes(s);
    });
  }, [rows, people, search]);

  const totalOwed = useMemo(
    () => (tab === "unpaid" ? filtered.reduce((sum, r) => sum + (r.amount_due_cents || 0), 0) : 0),
    [filtered, tab]
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> PT Session Payments
            </h1>
            <p className="text-sm text-muted-foreground">
              Track sessions delivered without a pre-paid pack — charge a card on file, send a payment link, or record cash.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/admin/personal-training/schedule">PT Schedule</Link></Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Select value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unpaid">Unpaid sessions</SelectItem>
              <SelectItem value="settled">Paid / comped</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          {tab === "unpaid" && (
            <Badge variant="destructive" className="ml-auto text-sm">
              {filtered.length} unpaid · {formatCents(totalOwed)} outstanding
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg">
            {tab === "unpaid" ? "No unpaid PT sessions. Nice." : "No settled sessions yet."}
          </div>
        ) : (
          <div className="border rounded-lg bg-card divide-y">
            {filtered.map((r) => {
              const p = people[r.user_id];
              return (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate flex items-center gap-2">
                      {p?.name ?? r.user_id.slice(0, 8)}
                      {p && !p.isMember && <Badge variant="outline" className="text-[10px]">Non-member</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {PT_FORMAT_LABEL[r.format]} · {fmtDate(parseISO(r.starts_at), "EEE, MMM d yyyy · h:mm a")} · {r.duration_minutes} min
                      {" · "}<span className="capitalize">{r.status.replace(/_/g, " ")}</span>
                    </div>
                    {r.payment_note && <div className="text-xs text-muted-foreground italic truncate">{r.payment_note}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.payment_status === "unpaid" ? (
                      <>
                        <Badge variant="destructive">{formatCents(r.amount_due_cents)} owed</Badge>
                        <Button size="sm" onClick={() => setPayRow(r)}>Collect</Button>
                      </>
                    ) : (
                      <>
                        <Badge variant={r.payment_status === "comp" ? "secondary" : "default"}>
                          {r.payment_status === "comp" ? "Comped" : `Paid ${formatCents(r.amount_due_cents)}`}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {r.payment_method ?? ""}{r.paid_at ? ` · ${fmtDate(parseISO(r.paid_at), "MMM d")}` : ""}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CollectPaymentDialog
        row={payRow}
        person={payRow ? people[payRow.user_id] : undefined}
        onClose={() => setPayRow(null)}
        onDone={() => {
          setPayRow(null);
          qc.invalidateQueries({ queryKey: ["pt-payment-tracking"] });
          qc.invalidateQueries({ queryKey: ["pt-appointments"] });
        }}
      />
    </AdminLayout>
  );
}

function CollectPaymentDialog({
  row, person, onClose, onDone,
}: {
  row: Row | null;
  person?: Person;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"card_on_file" | "payment_link" | "cash" | "clover" | "comp">("card_on_file");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const amountCents = Math.round(parseFloat(amount || "0") * 100) || row?.amount_due_cents || 0;
  const fee = method === "card_on_file" || method === "payment_link" ? calculateProcessingFee(amountCents) : 0;

  async function run() {
    if (!row) return;
    if (method !== "comp" && amountCents < 50) return toast.error("Enter an amount of at least $0.50");
    setBusy(true);
    try {
      if (method === "card_on_file") {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "admin_charge_user_saved_card",
            userId: row.user_id,
            amount: amountCents,
            description: `Personal Training session — ${PT_FORMAT_LABEL[row.format]} ${fmtDate(parseISO(row.starts_at), "MMM d, yyyy")}`,
            grossUpFee: true,
            metadata: { pt_appointment_id: row.id, type: "pt_session_payment" },
          },
        });
        if (error) throw error;
        if (data?.success === false) throw new Error(data.error || "Card declined");
        await supabase.rpc("admin_set_pt_session_payment" as any, {
          p_appointment_id: row.id,
          p_payment_status: "paid",
          p_amount_cents: amountCents,
          p_payment_method: "card_on_file",
          p_note: note || null,
          p_stripe_payment_intent_id: data?.paymentIntentId ?? null,
        });
        toast.success("Charged card on file");
        onDone();
        return;
      }

      if (method === "payment_link") {
        // Persist the rate first so the link can be generated.
        const { error: setErr } = await supabase.rpc("admin_set_pt_session_payment" as any, {
          p_appointment_id: row.id,
          p_payment_status: "unpaid",
          p_amount_cents: amountCents,
          p_payment_method: null,
          p_note: note || null,
          p_stripe_payment_intent_id: null,
        });
        if (setErr) throw setErr;
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: { action: "create_pt_session_payment_link", appointmentId: row.id },
        });
        if (error) throw error;
        if (!data?.url) throw new Error(data?.error || "Could not create payment link");
        setLinkUrl(data.url);
        toast.success("Payment link created — copy and send it");
        return;
      }

      // cash / clover / comp — record only
      await supabase.rpc("admin_set_pt_session_payment" as any, {
        p_appointment_id: row.id,
        p_payment_status: method === "comp" ? "comp" : "paid",
        p_amount_cents: method === "comp" ? 0 : amountCents,
        p_payment_method: method === "comp" ? "comp" : method,
        p_note: note || null,
        p_stripe_payment_intent_id: null,
      });
      toast.success(method === "comp" ? "Session comped" : "Payment recorded");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(v) => { if (!v) { setLinkUrl(null); setAmount(""); setNote(""); onClose(); } }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Collect PT session payment</DialogTitle>
          <DialogDescription>
            {person?.name ?? "Customer"} · {row ? PT_FORMAT_LABEL[row.format] : ""}{" "}
            {row ? fmtDate(parseISO(row.starts_at), "MMM d, yyyy") : ""}
          </DialogDescription>
        </DialogHeader>

        {linkUrl ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Send this link to {person?.email}. The session is marked paid automatically once they pay.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={linkUrl} className="text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => { navigator.clipboard.writeText(linkUrl); toast.success("Copied"); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={onDone}><Check className="h-4 w-4 mr-2" /> Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={row ? (row.amount_due_cents / 100).toFixed(2) : "0.00"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={method === "comp"}
                />
                {fee > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Customer is charged {formatCents(amountCents + fee)} (includes {formatCents(fee)} processing fee).
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>How are they paying?</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card_on_file">Charge card on file</SelectItem>
                    <SelectItem value="payment_link">Send payment link</SelectItem>
                    <SelectItem value="cash">Cash (record only)</SelectItem>
                    <SelectItem value="clover">Clover / terminal (record only)</SelectItem>
                    <SelectItem value="comp">Comp this session</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={run} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {method === "card_on_file" && <CreditCard className="h-4 w-4 mr-2" />}
                {method === "payment_link" && <Link2 className="h-4 w-4 mr-2" />}
                {method === "comp" ? "Comp session" : method === "payment_link" ? "Create link" : "Record payment"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

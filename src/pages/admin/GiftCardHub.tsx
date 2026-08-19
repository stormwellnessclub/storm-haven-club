import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Gift, Loader2, RefreshCw, Search, Copy, Send, Ban } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";

const TZ = "America/Detroit";
const money = (c: number) => `$${((c ?? 0) / 100).toFixed(2)}`;

type Row = {
  id: string;
  code: string;
  amount_cents: number;
  balance_cents: number;
  redeemed_cents: number;
  status: string;
  derived_status: string;
  purchase_source: string | null;
  payment_method: string | null;
  service_label: string | null;
  hide_amount?: boolean | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
  recipient_name: string;
  recipient_email: string;
  custom_message: string | null;
  notes: string | null;
  scheduled_send_at: string | null;
  email_sent_at: string | null;
  delivered_at: string | null;
  first_redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
  redemption_count: number;
  total_count: number;
};

const STATUS_STYLES: Record<string, string> = {
  redeemed: "bg-emerald-600 hover:bg-emerald-700",
  partial: "bg-amber-600 hover:bg-amber-700",
  scheduled: "bg-primary/80",
  active: "bg-blue-600 hover:bg-blue-700",
};

export default function GiftCardHub() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [selected, setSelected] = useState<Row | null>(null);

  const { data: rows = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-gift-cards", search, status, source],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_gift_card_search", {
        p_search: search || null,
        p_status: status === "all" ? null : status,
        p_source: source === "all" ? null : source,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const stats = useMemo(() => {
    const issued = rows.reduce((s, r) => s + (r.status === "void" ? 0 : r.amount_cents), 0);
    const redeemed = rows.reduce((s, r) => s + r.redeemed_cents, 0);
    const outstanding = rows.reduce((s, r) => s + (r.status === "void" ? 0 : r.balance_cents), 0);
    const scheduled = rows.filter((r) => r.derived_status === "scheduled").length;
    return { issued, redeemed, outstanding, scheduled, count: rows.length };
  }, [rows]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; notes?: string; expires_at?: string | null; void?: boolean }) => {
      const { data, error } = await supabase.rpc("admin_update_gift_card", {
        p_gift_card_id: payload.id,
        p_notes: payload.notes ?? null,
        p_expires_at: payload.expires_at ?? null,
        p_clear_expiry: payload.expires_at === null && payload.expires_at !== undefined ? false : false,
        p_void: payload.void ?? null,
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Update failed");
    },
    onSuccess: () => {
      toast.success("Gift card updated");
      qc.invalidateQueries({ queryKey: ["admin-gift-cards"] });
      setSelected(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendMutation = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "gift_card_delivery",
          to: row.recipient_email,
          data: {
            name: row.recipient_name,
            recipientName: row.recipient_name,
            senderName: row.purchaser_name || "A Storm Wellness Club member",
            customMessage: row.custom_message || "",
            code: row.code,
            amount: (row.amount_cents / 100).toFixed(2),
            serviceLabel: row.service_label || "",
            hideAmount: (row as any).hide_amount === true,
            expiresAt: row.expires_at,
          },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Gift card email resent"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Gift className="h-6 w-6 text-primary" /> Gift Cards
            </h1>
            <p className="text-sm text-muted-foreground">
              Search, track redemptions, and manage outstanding gift card liability.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Issued" value={money(stats.issued)} />
          <Stat label="Redeemed" value={money(stats.redeemed)} />
          <Stat label="Outstanding liability" value={money(stats.outstanding)} accent />
          <Stat label="Scheduled" value={String(stats.scheduled)} />
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[220px] flex-1">
              <Label className="text-xs text-muted-foreground">Search code, recipient or purchaser</Label>
              <div className="flex gap-2">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
                  placeholder="STORM-XXXX, name or email"
                />
                <Button variant="secondary" onClick={() => setSearch(searchInput.trim())}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="partial">Partially redeemed</SelectItem>
                  <SelectItem value="redeemed">Fully redeemed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="void">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="admin">Admin / Front desk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No gift cards match these filters.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => setSelected(r)}>
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold tracking-wider">{r.code}</span>
                      <Badge className={STATUS_STYLES[r.derived_status] ?? ""} variant={STATUS_STYLES[r.derived_status] ? "default" : "outline"}>
                        {r.derived_status}
                      </Badge>
                      {r.service_label && <Badge variant="secondary">{r.service_label}</Badge>}
                      {r.purchase_source && <Badge variant="outline">{r.purchase_source}</Badge>}
                    </div>
                    <div className="truncate text-sm">
                      {r.recipient_name} <span className="text-muted-foreground">· {r.recipient_email}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      From {r.purchaser_name || "—"} · Created {formatInTimeZone(new Date(r.created_at), TZ, "PPP")}
                      {r.scheduled_send_at && ` · Sends ${formatInTimeZone(new Date(r.scheduled_send_at), TZ, "PPP p")}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</div>
                      <div className="font-semibold">{money(r.amount_cents)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</div>
                      <div className={`font-semibold ${r.balance_cents === 0 ? "text-muted-foreground" : "text-primary"}`}>
                        {money(r.balance_cents)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <GiftCardDetailSheet
        row={selected}
        onClose={() => setSelected(null)}
        onSave={(notes, voidCard) => selected && updateMutation.mutate({ id: selected.id, notes, void: voidCard })}
        onResend={() => selected && resendMutation.mutate(selected)}
        saving={updateMutation.isPending}
        resending={resendMutation.isPending}
      />
    </AdminLayout>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40" : ""}>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function GiftCardDetailSheet({
  row, onClose, onSave, onResend, saving, resending,
}: {
  row: Row | null;
  onClose: () => void;
  onSave: (notes: string, voidCard?: boolean) => void;
  onResend: () => void;
  saving: boolean;
  resending: boolean;
}) {
  const [notes, setNotes] = useState("");

  return (
    <Sheet open={!!row} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" /> {row.code}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Amount" value={money(row.amount_cents)} />
                <Field label="Remaining" value={money(row.balance_cents)} />
                <Field label="Redeemed" value={`${money(row.redeemed_cents)} · ${row.redemption_count}x`} />
                <Field label="Status" value={row.derived_status} />
                <Field label="Recipient" value={`${row.recipient_name} (${row.recipient_email})`} />
                <Field label="Purchaser" value={row.purchaser_name || row.purchaser_email || "—"} />
                <Field label="Payment" value={row.payment_method || "—"} />
                <Field label="Source" value={row.purchase_source || "—"} />
                <Field
                  label="Delivered"
                  value={row.delivered_at ? formatInTimeZone(new Date(row.delivered_at), TZ, "PPP p") : row.scheduled_send_at ? `Scheduled ${formatInTimeZone(new Date(row.scheduled_send_at), TZ, "PPP p")}` : "Not sent"}
                />
                <Field label="Expires" value={row.expires_at ? formatInTimeZone(new Date(row.expires_at), TZ, "PPP") : "No expiry"} />
              </div>

              {row.custom_message && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm italic">"{row.custom_message}"</div>
              )}

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Add an internal note</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal note…" />
                {row.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">Existing: {row.notes}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(row.code); toast.success("Code copied"); }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy code
                </Button>
                <Button variant="outline" size="sm" onClick={onResend} disabled={resending}>
                  {resending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                  Resend email
                </Button>
                <Button size="sm" onClick={() => onSave(notes)} disabled={saving || !notes.trim()}>
                  {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Save note
                </Button>
                {row.status !== "void" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => onSave(notes, true)}
                    disabled={saving}
                  >
                    <Ban className="mr-1 h-3.5 w-3.5" /> Void card
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="break-words">{value}</div>
    </div>
  );
}

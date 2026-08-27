import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format as fmtDate } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Banknote, Package, Gift } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PTModal, PTAlert, PTBadge, ptButtonClass } from "@/components/admin/pt/PTPrimitives";
import { formatCents } from "@/lib/ptFormat";
import {
  PTUnpaidSession, usePTFinancialMutations, usePTSavedCards, PT_PAYMENT_METHOD_LABEL,
} from "@/hooks/pt/usePTFinancials";

type Method = "card" | "manual" | "package" | "waive";

const MANUAL_METHODS = ["cash", "check", "terminal", "bank_transfer", "other"];

/** Settles one or more completed unpaid PT sessions with exactly one settlement method. */
export function PTSessionCheckoutDialog({
  sessions, clientName, onClose,
}: {
  sessions: PTUnpaidSession[];
  clientName: string;
  onClose: () => void;
}) {
  const open = sessions.length > 0;
  const userId = sessions[0]?.user_id;
  const totalCents = sessions.reduce((s, a) => s + (a.amount_due_cents || 0), 0);
  const ids = useMemo(() => sessions.map((s) => s.id), [sessions]);

  const [method, setMethod] = useState<Method>("card");
  const [cardId, setCardId] = useState("");
  const [manualMethod, setManualMethod] = useState("cash");
  const [manualDate, setManualDate] = useState(fmtDate(new Date(), "yyyy-MM-dd"));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [passId, setPassId] = useState("");
  const [waiveReason, setWaiveReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState<string>("");

  const { data: cards = [], isLoading: cardsLoading } = usePTSavedCards(userId, open);
  const {
    chargeSavedCard, recordManualPayment, settleWithPackage, waiveSessions,
  } = usePTFinancialMutations();

  const { data: passes = [] } = useQuery({
    queryKey: ["pt-checkout-passes", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error: e } = await (supabase as any)
        .from("pt_passes")
        .select("id, pack_name, sessions_remaining, expires_at, status, format")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("sessions_remaining", 0)
        .order("expires_at", { ascending: true });
      if (e) throw e;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIdemKey(crypto.randomUUID());
  }, [open, ids.join(",")]);

  useEffect(() => {
    if (cards.length && !cards.find((c) => c.id === cardId)) {
      setCardId((cards.find((c) => c.isDefault) ?? cards[0]).id);
    }
  }, [cards.map((c) => c.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (passes.length && !passes.find((p: any) => p.id === passId)) setPassId(passes[0].id);
  }, [passes.map((p: any) => p.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPass = passes.find((p: any) => p.id === passId);
  const pending =
    chargeSavedCard.isPending || recordManualPayment.isPending ||
    settleWithPackage.isPending || waiveSessions.isPending;

  const canSubmit =
    method === "card" ? !!cardId && totalCents > 0
      : method === "manual" ? totalCents >= 0
      : method === "package" ? !!passId && (selectedPass?.sessions_remaining ?? 0) >= sessions.length
      : waiveReason.trim().length > 0;

  async function submit() {
    setError(null);
    try {
      if (method === "card") {
        await chargeSavedCard.mutateAsync({
          userId: userId!,
          appointmentIds: ids,
          amountCents: totalCents,
          paymentMethodId: cardId,
          description: `Personal Training — ${sessions.length} session${sessions.length === 1 ? "" : "s"} (${clientName})`,
          idempotencyKey: idemKey,
        });
      } else if (method === "manual") {
        await recordManualPayment.mutateAsync({
          appointmentIds: ids,
          method: manualMethod,
          amountCents: totalCents,
          paidAt: new Date(`${manualDate}T12:00:00`).toISOString(),
          reference: reference || null,
          note: note || null,
        });
      } else if (method === "package") {
        await settleWithPackage.mutateAsync({ appointmentIds: ids, passId });
      } else {
        await waiveSessions.mutateAsync({ appointmentIds: ids, reason: waiveReason.trim() });
      }
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Checkout failed");
    }
  }

  return (
    <PTModal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Check out PT session"
      description={`${clientName} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={onClose}>Cancel</button>
          <button className={ptButtonClass("primary")} disabled={!canSubmit || pending} onClick={submit}>
            {method === "card" ? `Charge ${formatCents(totalCents)}`
              : method === "manual" ? `Record ${formatCents(totalCents)}`
              : method === "package" ? `Apply ${sessions.length} package session${sessions.length === 1 ? "" : "s"}`
              : "Waive charge"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Sessions being settled */}
        <div className="rounded-xl border border-pt-line divide-y divide-pt-line/60">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 text-[13px]">
              <span>{fmtDate(new Date(s.starts_at), "EEE MMM d, yyyy · h:mm a")}</span>
              <span className="tabular-nums">{formatCents(s.amount_due_cents || 0)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-pt-beige/40 px-3 py-2 text-[13px] font-medium">
            <span>Total due</span>
            <span className="tabular-nums">{formatCents(totalCents)}</span>
          </div>
        </div>

        {/* Settlement method */}
        <div className="grid gap-2 sm:grid-cols-2">
          <MethodTile active={method === "card"} onClick={() => setMethod("card")} icon={CreditCard}
            title="Charge saved card" subtitle="Storm Stripe customer on file" />
          <MethodTile active={method === "manual"} onClick={() => setMethod("manual")} icon={Banknote}
            title="Record manual / offline payment" subtitle="Cash, check, terminal, transfer" />
          <MethodTile active={method === "package"} onClick={() => setMethod("package")} icon={Package}
            title="Apply existing PT package" subtitle="Consumes package sessions — no charge" />
          <MethodTile active={method === "waive"} onClick={() => setMethod("waive")} icon={Gift}
            title="Complimentary / waive" subtitle="$0 collected — manager or admin only" />
        </div>

        {method === "card" && (
          <div className="space-y-2">
            {cardsLoading ? (
              <div className="text-sm text-pt-muted">Loading cards on file…</div>
            ) : cards.length === 0 ? (
              <PTAlert tone="warning" title="No card on file">
                This client has no saved payment method. Record an offline payment or apply a package instead.
              </PTAlert>
            ) : (
              <>
                <label className="text-xs text-pt-muted">Card on file</label>
                <Select value={cardId} onValueChange={setCardId}>
                  <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {(c.brand ?? "Card").toUpperCase()} •••• {c.last4} · exp {String(c.expMonth).padStart(2, "0")}/{String((c.expYear ?? 0) % 100).padStart(2, "0")}
                        {c.isDefault ? " · default" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-pt-muted">No package session is consumed when a card is charged.</p>
              </>
            )}
          </div>
        )}

        {method === "manual" && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-pt-muted">Method</label>
                <Select value={manualMethod} onValueChange={setManualMethod}>
                  <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MANUAL_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{PT_PAYMENT_METHOD_LABEL[m] ?? m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-pt-muted">Date collected</label>
                <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="border-pt-line bg-white" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-pt-muted">Reference (optional)</label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check number, terminal receipt…" className="border-pt-line bg-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-pt-muted">Note</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="border-pt-line bg-white" />
            </div>
            <PTAlert tone="info" title="Recorded as a manual payment">
              No Stripe record is created. The payment is clearly marked as collected offline.
            </PTAlert>
          </div>
        )}

        {method === "package" && (
          <div className="space-y-2">
            {passes.length === 0 ? (
              <PTAlert tone="warning" title="No eligible package">
                This client has no active package with sessions remaining.
              </PTAlert>
            ) : (
              <>
                <label className="text-xs text-pt-muted">Package to use</label>
                <Select value={passId} onValueChange={setPassId}>
                  <SelectTrigger className="border-pt-line bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {passes.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.pack_name} · {p.sessions_remaining} left · expires {fmtDate(new Date(`${p.expires_at}T12:00:00`), "MMM d, yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-lg border border-pt-line bg-pt-cream/40 px-3 py-2 text-sm">
                  Current: <strong>{selectedPass?.sessions_remaining ?? 0}</strong> remaining ·
                  Apply: <strong>{sessions.length}</strong> ·
                  After: <strong>{Math.max(0, (selectedPass?.sessions_remaining ?? 0) - sessions.length)}</strong> remaining
                </div>
                <p className="text-xs text-pt-muted">No Stripe charge is created and the session is not labelled card paid.</p>
              </>
            )}
          </div>
        )}

        {method === "waive" && (
          <div className="space-y-2">
            <label className="text-xs text-pt-muted">Reason (required, retained for audit)</label>
            <Textarea value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} className="border-pt-line bg-white" />
            <PTBadge tone="neutral">Amount collected: $0 · Settlement: Complimentary / waived</PTBadge>
          </div>
        )}

        {error && <PTAlert tone="danger" title="Checkout failed">{error}</PTAlert>}
      </div>
    </PTModal>
  );
}

function MethodTile({
  active, onClick, icon: Icon, title, subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
        active ? "border-pt-gold bg-pt-gold/10" : "border-pt-line hover:bg-pt-beige/40"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-pt-gold" />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-pt-ink">{title}</span>
        <span className="block text-xs text-pt-muted">{subtitle}</span>
      </span>
    </button>
  );
}

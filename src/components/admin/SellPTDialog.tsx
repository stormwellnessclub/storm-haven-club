import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { addDays, format as fmtDate } from "date-fns";
import { PT_FORMAT_LABEL, PtFormat, PtPack, formatCents, perSessionPrice } from "@/lib/ptFormat";
import { calculateProcessingFee } from "@/lib/processingFee";

type PtPackExt = PtPack & {
  allow_payment_plan?: boolean;
  payment_plan_months?: number | null;
  payment_plan_stripe_price_id?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetUserId?: string;
  presetUserName?: string;
}

interface UserOption {
  id: string;
  email: string;
  name: string;
  isMember: boolean;
  isNonMember?: boolean;
}

interface SavedCard {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

type PaymentChoice = "card_on_file" | "offline" | "external";

export function SellPTDialog({ open, onOpenChange, presetUserId, presetUserName }: Props) {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(presetUserId);
  const [selectedUserLabel, setSelectedUserLabel] = useState<string | undefined>(presetUserName);
  const [searchQuery, setSearchQuery] = useState("");

  const [format, setFormat] = useState<PtFormat>("one_on_one");
  const [packId, setPackId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [activatedAt, setActivatedAt] = useState<string>(fmtDate(new Date(), "yyyy-MM-dd"));
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("card_on_file");
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [usePaymentPlan, setUsePaymentPlan] = useState(false);
  /** Stable reference for the current sale attempt — reused on retry. */
  const saleKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (presetUserId) {
      setSelectedUserId(presetUserId);
      setSelectedUserLabel(presetUserName);
    }
  }, [presetUserId, presetUserName, open]);

  // ----- Pack data -----
  const { data: packs = [] } = useQuery({
    queryKey: ["pt-packs-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_packs")
        .select("*")
        .eq("is_active", true)
        .order("format")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as PtPackExt[];
    },
  });

  const formatPacks = useMemo(
    () => packs.filter((p) => p.format === format && p.price_cents > 0),
    [packs, format]
  );
  const selectedPack = formatPacks.find((p) => p.id === packId);

  useEffect(() => {
    if (formatPacks.length > 0 && !formatPacks.find((p) => p.id === packId)) {
      setPackId(formatPacks[0].id);
    }
  }, [formatPacks, packId]);

  useEffect(() => {
    if (!selectedPack) return;
    try {
      const base = new Date(activatedAt + "T12:00:00");
      const exp = addDays(base, selectedPack.expiration_days);
      setExpiresAt(fmtDate(exp, "yyyy-MM-dd"));
    } catch {
      /* noop */
    }
  }, [selectedPack?.id, activatedAt]);

  // ----- Customer search -----
  const { data: users = [] } = useQuery({
    queryKey: ["pt-user-search", searchQuery],
    queryFn: async (): Promise<UserOption[]> => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const [{ data: profiles }, { data: members }, { data: nonMembers }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, email, first_name, last_name")
          .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
          .limit(10),
        supabase
          .from("members")
          .select("user_id, email, first_name, last_name")
          .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
          .limit(10),
        supabase
          .from("non_member_profiles")
          .select("user_id, email, first_name, last_name")
          .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
          .limit(10),
      ]);
      const list: UserOption[] = [
        ...(profiles ?? []).map((p: any) => ({
          id: p.user_id,
          email: p.email,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email,
          isMember: false,
        })),
        ...(nonMembers ?? []).map((n: any) => ({
          id: n.user_id,
          email: n.email,
          name: `${n.first_name ?? ""} ${n.last_name ?? ""}`.trim() || n.email,
          isMember: false,
          isNonMember: true,
        })),
        ...(members ?? []).map((m: any) => ({
          id: m.user_id,
          email: m.email,
          name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email,
          isMember: true,
        })),
      ].filter((u) => u.id);
      return Array.from(new Map(list.map((u) => [u.id, u])).values());
    },
    enabled: !selectedUserId && searchQuery.length >= 2,
  });

  // ----- Cards on file -----
  const { data: cardsData, isLoading: cardsLoading } = useQuery({
    queryKey: ["pt-user-payment-methods", selectedUserId],
    enabled: !!selectedUserId && open,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "admin_list_user_payment_methods", userId: selectedUserId },
      });
      if (error) throw error;
      return data as {
        paymentMethods: SavedCard[];
        hasPaymentMethod: boolean;
        memberEmail?: string;
      };
    },
  });

  const cards = cardsData?.paymentMethods ?? [];

  // Auto-select default card whenever cards list refreshes
  useEffect(() => {
    if (cards.length === 0) {
      if (paymentChoice === "card_on_file") setPaymentChoice("offline");
      setSelectedCardId("");
      return;
    }
    const def = cards.find((c) => c.isDefault) ?? cards[0];
    setSelectedCardId((prev) => (prev && cards.find((c) => c.id === prev) ? prev : def.id));
    setPaymentChoice("card_on_file");
  }, [cards.map((c) => c.id).join(",")]);

  // ----- Totals -----
  const subtotalCents = selectedPack ? selectedPack.price_cents * quantity : 0;
  const willCharge = paymentChoice === "card_on_file";
  const planEligible = !!selectedPack?.allow_payment_plan && !!selectedPack?.payment_plan_months && (selectedPack?.payment_plan_months ?? 0) >= 2;
  const planActive = willCharge && usePaymentPlan && planEligible;
  const planMonths = selectedPack?.payment_plan_months ?? 0;
  const perInstallmentCents = planActive && planMonths > 0
    ? Math.ceil(subtotalCents / planMonths)
    : 0;
  const processingFeeCents = willCharge && !planActive ? calculateProcessingFee(subtotalCents) : 0;
  const totalCents = subtotalCents + processingFeeCents;

  function reset() {
    setSelectedUserId(presetUserId);
    setSelectedUserLabel(presetUserName);
    setSearchQuery("");
    setFormat("one_on_one");
    setPackId("");
    setQuantity(1);
    setActivatedAt(fmtDate(new Date(), "yyyy-MM-dd"));
    setExpiresAt("");
    setPaymentChoice("card_on_file");
    setSelectedCardId("");
    setAdminNotes("");
    setChargeError(null);
    setUsePaymentPlan(false);
    saleKeyRef.current = null;
  }

  /**
   * Phase 2A: sales are finalized server-side against a recoverable sale record.
   * The same sale reference is reused on retry so Stripe never charges twice and
   * the database never creates duplicate packages.
   */
  async function openSaleIntent(paymentMethod: string) {
    if (!selectedUserId || !selectedPack) throw new Error("Missing customer or pack");
    const key = saleKeyRef.current ?? crypto.randomUUID();
    saleKeyRef.current = key;
    // Phase 2B: the server re-reads pt_packs and derives name/format/sessions/price
    // from the catalog. Only the pack id, quantity and dates are submitted here.
    const { data, error } = await (supabase as any).rpc("pt_open_sale_intent_v2", {
      p_idempotency_key: key,
      p_user_id: selectedUserId,
      p_pack_id: selectedPack.id,
      p_quantity: quantity,
      p_payment_method: paymentMethod,
      p_activated_at: activatedAt,
      p_expires_at: expiresAt || null,
      p_notes: adminNotes || null,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { key, sale: row as { status: string; stripe_payment_intent_id: string | null } };
  }

  async function finalizeSale(key: string) {
    const { error } = await (supabase as any).rpc("pt_finalize_package_sale", {
      p_idempotency_key: key,
    });
    if (error) {
      await (supabase as any)
        .rpc("pt_fail_sale_intent", { p_idempotency_key: key, p_error: error.message })
        .catch(() => {});
      throw error;
    }
  }

  async function submit() {
    setChargeError(null);
    if (!selectedUserId) return toast.error("Select a customer");
    if (!selectedPack) return toast.error("Select a pack");
    if (!expiresAt) return toast.error("Expiration date required");
    if (paymentChoice === "card_on_file" && !selectedCardId) {
      return toast.error("Choose a card on file");
    }

    setSubmitting(true);
    try {
      if (paymentChoice === "card_on_file" && planActive) {
        const { data, error } = await supabase.functions.invoke("admin-create-pt-payment-plan", {
          body: {
            userId: selectedUserId,
            packId: selectedPack.id,
            quantity,
            paymentMethodId: selectedCardId,
            activatedAt,
            expiresAt,
            adminNotes: adminNotes || null,
          },
        });
        if (error) throw error;
        if (!(data as any)?.success) {
          setChargeError((data as any)?.error || "Payment plan setup failed");
          setSubmitting(false);
          return;
        }
        toast.success(`Payment plan started — ${planMonths} × ${formatCents(perInstallmentCents)}`);
      } else if (paymentChoice === "card_on_file") {
        const { key, sale } = await openSaleIntent("card_on_file");
        const alreadyPaid = sale?.status === "paid" || sale?.status === "finalized";

        if (!alreadyPaid) {
          const description = `Personal Training: ${quantity} × ${selectedPack.name}`;
          const { data, error } = await supabase.functions.invoke("stripe-payment", {
            body: {
              action: "admin_charge_user_saved_card",
              userId: selectedUserId,
              paymentMethodId: selectedCardId,
              amount: subtotalCents,
              description,
              grossUpFee: true,
              idempotencyKey: `pt_sale:${key}`,
              metadata: {
                pt_pack_id: selectedPack.id,
                pt_format: selectedPack.format,
                pt_sale_ref: key,
                quantity: String(quantity),
                sessions_per_pack: String(selectedPack.sessions),
              },
            },
          });
          if (error) throw error;
          if (!data?.success) {
            setChargeError(data?.error || `Charge failed (status: ${data?.status ?? "unknown"})`);
            setSubmitting(false);
            return;
          }
          await (supabase as any).rpc("pt_record_sale_payment", {
            p_idempotency_key: key,
            p_stripe_payment_intent_id: data.paymentIntentId,
            p_amount_cents: data.totalAmount ?? subtotalCents,
          });
          toast.success(`Charged ${(data.totalAmount / 100).toFixed(2)} · ${quantity} × ${selectedPack.name}`);
        }

        try {
          await finalizeSale(key);
        } catch (passErr: any) {
          setChargeError(
            `PAYMENT IS RECORDED for this sale (reference ${key}) but the package was not created: ` +
              `${passErr?.message ?? "unknown error"}. Press "Sell" again to retry — the customer will NOT be charged a second time. ` +
              `The sale also appears under "Incomplete PT sales" on the PT Passes page.`,
          );
          toast.error("Payment recorded — package creation failed. Retry is safe.", { duration: 20000 });
          setSubmitting(false);
          return;
        }
      } else {
        const { key } = await openSaleIntent(paymentChoice);
        await finalizeSale(key);
        toast.success(`Sold ${quantity} × ${selectedPack.name}`);
      }


      qc.invalidateQueries({ queryKey: ["pt-passes"] });
      qc.invalidateQueries({ queryKey: ["my-pt-passes"] });
      qc.invalidateQueries({ queryKey: ["pt-sale-intents"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      setChargeError(e?.message ?? "Failed to record sale");
      toast.error(e?.message ?? "Failed to record sale");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell Personal Training</DialogTitle>
          <DialogDescription>
            Record a PT pack sale and (optionally) charge the customer's card on file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer */}
          {!selectedUserId ? (
            <div className="space-y-2">
              <Label>Customer</Label>
              <Input
                placeholder="Search by name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {users.length > 0 && (
                <div className="border rounded-md max-h-44 overflow-y-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setSelectedUserLabel(`${u.name} (${u.email})`);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                    >
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.email} {u.isMember ? "· Member" : u.isNonMember ? "· Non-member" : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Customer</Label>
              <div className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <span>{selectedUserLabel ?? "Selected customer"}</span>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(undefined); setSelectedUserLabel(undefined); }}>
                  Change
                </Button>
              </div>
            </div>
          )}

          {/* Format + Pack */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as PtFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PT_FORMAT_LABEL) as PtFormat[]).map((f) => (
                    <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pack</Label>
              <Select value={packId} onValueChange={setPackId}>
                <SelectTrigger><SelectValue placeholder="Select a pack" /></SelectTrigger>
                <SelectContent>
                  {formatPacks.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No active packs</div>
                  ) : formatPacks.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCents(p.price_cents)}
                      {!p.is_public && " (admin-only)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantity / dates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))}
              />
            </div>
            <div className="space-y-2">
              <Label>Activation</Label>
              <Input
                type="date"
                value={activatedAt}
                onChange={(e) => setActivatedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiration</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          {selectedPack && (
            <div className="text-xs text-muted-foreground">
              {selectedPack.sessions} session{selectedPack.sessions !== 1 ? "s" : ""} per pack
              {perSessionPrice(selectedPack) && ` · ${perSessionPrice(selectedPack)}`}
              {" · "}default expiration {selectedPack.expiration_days} days
            </div>
          )}

          {/* Payment */}
          {selectedUserId && (
            <div className="space-y-2">
              <Label>Payment</Label>
              <RadioGroup
                value={paymentChoice}
                onValueChange={(v) => setPaymentChoice(v as PaymentChoice)}
                className="space-y-2"
              >
                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ${paymentChoice === "card_on_file" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="card_on_file" disabled={cards.length === 0} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CreditCard className="h-4 w-4" />
                      Charge card on file
                      {cardsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                    {cards.length === 0 && !cardsLoading && (
                      <div className="text-xs text-muted-foreground mt-1">
                        No card on file for this customer.
                      </div>
                    )}
                    {cards.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {cards.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => { setSelectedCardId(c.id); setPaymentChoice("card_on_file"); }}
                            className={`w-full text-left text-xs flex items-center gap-2 px-2 py-1.5 rounded border ${selectedCardId === c.id ? "border-primary bg-background" : "border-transparent hover:bg-muted"}`}
                          >
                            <span className="capitalize font-medium">{c.brand}</span>
                            <span>•••• {c.last4}</span>
                            <span className="text-muted-foreground">
                              {String(c.expMonth ?? "").padStart(2, "0")}/{String(c.expYear ?? "").slice(-2)}
                            </span>
                            {c.isDefault && <Badge variant="secondary" className="text-[10px] py-0 h-4">Default</Badge>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>

                {planEligible && paymentChoice === "card_on_file" && (
                  <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ml-6 ${planActive ? "border-emerald-600 bg-emerald-500/5" : ""}`}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={usePaymentPlan}
                      onChange={(e) => setUsePaymentPlan(e.target.checked)}
                      disabled={cards.length === 0}
                    />
                    <div className="text-sm">
                      <div className="font-medium">Split into {planMonths} monthly payments</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Auto-charges the card on file each month; ends automatically after the final installment.
                      </div>
                    </div>
                  </label>
                )}

                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ${paymentChoice === "offline" ? "border-primary bg-primary/5" : ""}`}>

                  <RadioGroupItem value="offline" className="mt-1" />
                  <div className="text-sm">Paid offline / in person</div>
                </label>

                <label className={`flex items-start gap-2 border rounded-md p-3 cursor-pointer ${paymentChoice === "external" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="external" className="mt-1" />
                  <div className="text-sm">Charged externally (Stripe link, etc.)</div>
                </label>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label>Internal notes (optional)</Label>
            <Textarea rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
          </div>

          {/* Totals */}
          {selectedPack && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>{quantity} × {selectedPack.name}</span>
                <span>{formatCents(subtotalCents)}</span>
              </div>
              {willCharge && !planActive && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Processing fee (2.9% + $0.30)</span>
                  <span>{formatCents(processingFeeCents)}</span>
                </div>
              )}
              {planActive ? (
                <>
                  <div className="flex justify-between font-semibold text-base pt-1 border-t">
                    <span>Monthly (× {planMonths})</span>
                    <span>{formatCents(perInstallmentCents)}/mo</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    First installment charges today. Auto-cancels after {planMonths} payments.
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-semibold text-base pt-1 border-t">
                  <span>{willCharge ? "Total to charge" : "Total"}</span>
                  <span>{formatCents(totalCents)}</span>
                </div>
              )}

            </div>
          )}

          {chargeError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>{chargeError}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !selectedUserId || !selectedPack}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {planActive
              ? `Start plan · ${formatCents(perInstallmentCents)}/mo × ${planMonths}`
              : willCharge ? `Charge ${formatCents(totalCents)}` : "Record sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

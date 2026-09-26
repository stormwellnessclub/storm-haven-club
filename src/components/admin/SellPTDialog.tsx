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
import { Loader2, CreditCard, AlertCircle, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { addDays, addMonths, format as fmtDate } from "date-fns";
import { PT_FORMAT_LABEL, PtFormat, PtPack, formatCents, perSessionPrice } from "@/lib/ptFormat";
import { usePTPackPaymentPlans, FREQUENCY_LABEL } from "@/hooks/pt/usePTPackPaymentPlans";
import { calculateProcessingFee } from "@/lib/processingFee";
import { StripeProvider } from "@/components/StripeProvider";
import { AdminAddCardForm } from "@/components/admin/AdminAddCardForm";

/** Renders a YYYY-MM-DD business date without timezone drift. */
function businessDate(iso: string) {
  const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
  return fmtDate(new Date(y, m - 1, d), "MMM d, yyyy");
}

interface ScheduleRow {
  installment_number: number;
  due_date: string;
  amount_cents: number;
  status: string;
}

interface PlanSchedule {
  plan_name: string;
  sale_date: string;
  first_autopay_date: string;
  final_payment_date: string;
  amount_due_at_sale_cents: number;
  future_installment_count: number;
  total_cents: number;
  installments: ScheduleRow[];
}

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
  /** "" = pay in full; otherwise the id of a named payment plan on the pack. */
  const [selectedPlanId, setSelectedPlanId] = useState("");
  /** Client-specific first future autopay date — never stored on the package. */
  const [firstAutopayDate, setFirstAutopayDate] = useState<string>(
    fmtDate(addMonths(new Date(), 1), "yyyy-MM-dd"),
  );
  const [addCardSecret, setAddCardSecret] = useState<string | null>(null);
  const [addCardCustomerId, setAddCardCustomerId] = useState<string | null>(null);
  const [creatingSetupIntent, setCreatingSetupIntent] = useState(false);
  const [confirmation, setConfirmation] = useState<
    | null
    | {
        packName: string;
        planName: string;
        chargedTodayCents: number;
        schedule: PlanSchedule;
        cardLabel: string;
      }
  >(null);
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
          .select("user_id, email, first_name, last_name, status")
          .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
          .limit(10),
        supabase
          .from("non_member_profiles")
          .select("user_id, email, first_name, last_name")
          .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
          .limit(10),
      ]);
      // Resolve current membership for every matched account (one person = one user_id).
      const ids = Array.from(new Set([
        ...(profiles ?? []).map((p: any) => p.user_id),
        ...(nonMembers ?? []).map((n: any) => n.user_id),
        ...(members ?? []).map((m: any) => m.user_id),
      ].filter(Boolean)));
      const { data: memRows } = ids.length
        ? await supabase.from("members").select("user_id, status").in("user_id", ids)
        : { data: [] as any[] };
      const rel = relationshipMap((memRows ?? []) as any[]);
      const base = [
        ...(profiles ?? []), ...(nonMembers ?? []), ...(members ?? []).filter((m: any) => m.status !== "cancelled"),
      ] as any[];
      const list: UserOption[] = base.map((p) => {
        const r = rel[p.user_id] ?? "Non-member";
        return {
          id: p.user_id,
          email: p.email,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email,
          isMember: r === "Member",
          isNonMember: r === "Non-member",
          isFormer: r === "Former member",
        };
      }).filter((u) => u.id);
      // Prefer a named row per user.
      const map = new Map<string, UserOption>();
      list.forEach((u) => { const prev = map.get(u.id); if (!prev || (prev.name === prev.email && u.name !== u.email)) map.set(u.id, u); });
      return Array.from(map.values());
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

  // ----- Payment plans on the selected package -----
  const { data: allPlans = [] } = usePTPackPaymentPlans();
  const allowPlans = (selectedPack as any)?.allow_payment_plans ?? true;
  const allowPayInFull = (selectedPack as any)?.allow_pay_in_full ?? true;
  const packPlans = useMemo(
    () =>
      allowPlans
        ? allPlans.filter((p) => p.is_active && p.pack_id === selectedPack?.id && p.stripe_price_id)
        : [],
    [allPlans, selectedPack?.id, allowPlans],
  );
  useEffect(() => {
    if (selectedPlanId && !packPlans.find((p) => p.id === selectedPlanId)) {
      setSelectedPlanId("");
      return;
    }
    // Package sold on plans only — never default to a full charge.
    if (!allowPayInFull && !selectedPlanId && packPlans.length > 0) setSelectedPlanId(packPlans[0].id);
  }, [packPlans, selectedPlanId, allowPayInFull]);
  const selectedPlan = packPlans.find((p) => p.id === selectedPlanId) ?? null;

  // ----- Totals -----
  const subtotalCents = selectedPack ? selectedPack.price_cents * quantity : 0;
  const willCharge = paymentChoice === "card_on_file";
  const planActive = willCharge && !!selectedPlan;
  const futureCount = selectedPlan?.future_installment_count ?? 0;
  const perInstallmentCents = selectedPlan ? selectedPlan.installment_cents * quantity : 0;
  const dueTodayCents = selectedPlan ? selectedPlan.amount_due_at_sale_cents * quantity : 0;
  const processingFeeCents = willCharge && !planActive ? calculateProcessingFee(subtotalCents) : 0;
  const totalCents = subtotalCents + processingFeeCents;
  const selectedCard = cards.find((c) => c.id === selectedCardId);
  const cardLabel = selectedCard
    ? `${(selectedCard.brand ?? "Card").replace(/^./, (s) => s.toUpperCase())} •••• ${selectedCard.last4}`
    : "Card on file";

  // ----- Storm's dated schedule, calculated server-side before anything is charged -----
  const {
    data: schedulePreview,
    error: scheduleError,
    isFetching: scheduleLoading,
  } = useQuery({
    queryKey: ["pt-plan-schedule", selectedPack?.id, selectedPlanId, quantity, firstAutopayDate],
    enabled: planActive && !!selectedPack && !!selectedPlanId && !!firstAutopayDate,
    retry: false,
    queryFn: async (): Promise<PlanSchedule> => {
      const { data, error } = await (supabase as any).rpc("pt_plan_schedule_preview", {
        p_pack_id: selectedPack!.id,
        p_plan_id: selectedPlanId,
        p_quantity: quantity,
        p_first_autopay: firstAutopayDate,
      });
      if (error) throw new Error(error.message.replace(/^.*PT_AUTOPAY_DATE_INVALID: /, ""));
      return data as PlanSchedule;
    },
  });

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
    setSelectedPlanId("");
    setFirstAutopayDate(fmtDate(addMonths(new Date(), 1), "yyyy-MM-dd"));
    setAddCardSecret(null);
    setAddCardCustomerId(null);
    setConfirmation(null);
    saleKeyRef.current = null;
  }

  /** Add a card without leaving checkout — Stripe SetupIntent, no raw card data here. */
  async function startAddCard() {
    if (!selectedUserId) return;
    setCreatingSetupIntent(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_admin_setup_intent",
          applicantEmail: cardsData?.memberEmail,
          applicantName: selectedUserLabel,
        },
      });
      if (error) throw error;
      if (!data?.clientSecret) throw new Error("Could not open the card form");
      setAddCardSecret(data.clientSecret);
      setAddCardCustomerId(data.customerId ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open the card form");
    } finally {
      setCreatingSetupIntent(false);
    }
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
    if (submitting) return;
    if (!selectedUserId) return toast.error("Select a customer");
    if (!selectedPack) return toast.error("Select a pack");
    if (!expiresAt) return toast.error("Expiration date required");
    if (paymentChoice === "card_on_file" && !selectedCardId) {
      return toast.error("Choose a card on file");
    }
    if (planActive && !schedulePreview) {
      return toast.error(scheduleError ? (scheduleError as Error).message : "Choose a valid first autopay date");
    }
    if (paymentChoice === "card_on_file" && !planActive && !allowPayInFull) {
      return toast.error("This package can only be sold on a payment plan");
    }
    if (planActive && !allowPlans) {
      return toast.error("This package cannot be sold on a payment plan");
    }

    setSubmitting(true);
    try {
      if (paymentChoice === "card_on_file" && planActive) {
        // One stable sale reference — a second click reuses it and never re-charges.
        const key = saleKeyRef.current ?? crypto.randomUUID();
        saleKeyRef.current = key;
        const { data, error } = await supabase.functions.invoke("admin-create-pt-payment-plan", {
          body: {
            userId: selectedUserId,
            packId: selectedPack.id,
            planId: selectedPlan?.id ?? null,
            quantity,
            paymentMethodId: selectedCardId,
            activatedAt,
            expiresAt,
            firstAutopayDate,
            saleRef: key,
            adminNotes: adminNotes || null,
          },
        });
        if (error) throw error;
        if (!(data as any)?.success) {
          setChargeError((data as any)?.error || "Payment plan setup failed");
          setSubmitting(false);
          return;
        }
        qc.invalidateQueries({ queryKey: ["pt-passes"] });
        qc.invalidateQueries({ queryKey: ["pt-sale-intents"] });
        setConfirmation({
          packName: `${quantity} × ${selectedPack.name}`,
          planName: selectedPlan!.name,
          chargedTodayCents: (data as any).charged_today_cents ?? dueTodayCents,
          schedule: (data as any).schedule as PlanSchedule,
          cardLabel,
        });
        setSubmitting(false);
        return;
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

  if (confirmation) {
    const nextRow = confirmation.schedule.installments.find((r) => r.installment_number === 1);
    const remaining = confirmation.schedule.total_cents - confirmation.schedule.amount_due_at_sale_cents;
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Package sold
            </DialogTitle>
            <DialogDescription>{confirmation.packName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Payment plan</span><span>{confirmation.planName}</span></div>
            <div className="flex justify-between font-semibold"><span>Paid today</span><span>{formatCents(confirmation.chargedTodayCents)}</span></div>
            {nextRow && (
              <div className="flex justify-between">
                <span>Next autopay</span>
                <span>{businessDate(nextRow.due_date)} · {formatCents(nextRow.amount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between"><span>Remaining scheduled</span><span>{formatCents(remaining)}</span></div>
            <div className="flex justify-between"><span>Final payment</span><span>{businessDate(confirmation.schedule.final_payment_date)}</span></div>
            <div className="flex justify-between"><span>Card</span><span>{confirmation.cardLabel}</span></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => window.open(`/admin/pt/clients/${selectedUserId}`, "_blank")}>
              View client
            </Button>
            <Button variant="outline" onClick={() => window.open("/admin/pt/billing", "_blank")}>
              View billing
            </Button>
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
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
                    <div className="mt-2">
                      {addCardSecret ? (
                        <div className="border rounded-md p-3 bg-background">
                          <div className="text-xs font-medium mb-2">Add a card for this client</div>
                          <StripeProvider clientSecret={addCardSecret}>
                            <AdminAddCardForm
                              stripeCustomerId={addCardCustomerId || undefined}
                              onCancel={() => setAddCardSecret(null)}
                              onSuccess={() => {
                                setAddCardSecret(null);
                                qc.invalidateQueries({ queryKey: ["pt-user-payment-methods", selectedUserId] });
                                toast.success("Card saved — it is now selectable for this sale");
                              }}
                            />
                          </StripeProvider>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={startAddCard} disabled={creatingSetupIntent}>
                          {creatingSetupIntent
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <Plus className="h-4 w-4 mr-2" />}
                          Add new card
                        </Button>
                      )}
                    </div>
                  </div>
                </label>

                {packPlans.length > 0 && paymentChoice === "card_on_file" && (
                  <div className="ml-6 space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Payment option</div>
                    {allowPayInFull && (
                      <button
                        type="button"
                        onClick={() => setSelectedPlanId("")}
                        className={`w-full text-left border rounded-md p-3 text-sm ${!selectedPlanId ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="font-medium">Pay in full</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatCents(subtotalCents)} charged at checkout
                        </div>
                      </button>
                    )}
                    {packPlans.map((pl) => (
                      <button
                        type="button"
                        key={pl.id}
                        onClick={() => setSelectedPlanId(pl.id)}
                        disabled={cards.length === 0}
                        className={`w-full text-left border rounded-md p-3 text-sm ${selectedPlanId === pl.id ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="font-medium">{pl.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatCents(pl.amount_due_at_sale_cents * quantity)} due at sale, then{" "}
                          {pl.future_installment_count} × {formatCents(pl.installment_cents * quantity)}
                          {pl.final_installment_cents !== pl.installment_cents &&
                            ` (final ${formatCents(pl.final_installment_cents * quantity)})`}{" "}
                          · {FREQUENCY_LABEL[pl.frequency].toLowerCase()}
                        </div>
                      </button>
                    ))}

                    {planActive && (
                      <div className="space-y-2 border rounded-md p-3">
                        <Label className="text-xs">First future autopay date</Label>
                        <Input
                          type="date"
                          value={firstAutopayDate}
                          min={fmtDate(addDays(new Date(), 1), "yyyy-MM-dd")}
                          onChange={(e) => setFirstAutopayDate(e.target.value)}
                        />
                        <div className="text-[11px] text-muted-foreground">
                          Future payments repeat on this day each period. Short months bill on the
                          last day and return to the chosen day afterwards.
                        </div>
                        {scheduleError && (
                          <div className="text-xs text-destructive">{(scheduleError as Error).message}</div>
                        )}
                      </div>
                    )}
                  </div>
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
              {planActive && selectedPlan ? (
                <>
                  <div className="flex justify-between font-semibold text-base pt-1 border-t">
                    <span>Due at sale</span>
                    <span>{formatCents(dueTodayCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Future payments</span>
                    <span>{futureCount} × {formatCents(perInstallmentCents)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedPlan.name} · {FREQUENCY_LABEL[selectedPlan.frequency].toLowerCase()} ·
                    {" "}charges the card on file automatically and ends after the final payment.
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

          {/* Exact dated schedule, shown before anything is charged */}
          {planActive && schedulePreview && (
            <div className="rounded-md border px-4 py-3 space-y-2 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Payment schedule {scheduleLoading && "· updating…"}
              </div>
              <div className="space-y-1">
                {schedulePreview.installments.map((row) => (
                  <div key={row.installment_number} className="flex items-center justify-between gap-2">
                    <span className="w-28 shrink-0">
                      {row.installment_number === 0 ? "Today" : businessDate(row.due_date)}
                    </span>
                    <span className="w-20 text-right">{formatCents(row.amount_cents)}</span>
                    <span className="flex-1 text-xs text-muted-foreground truncate">
                      {row.installment_number === 0 ? cardLabel : "AutoPay"}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {row.installment_number === 0 ? "Due now" : "Scheduled"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t space-y-1 text-sm">
                <div className="flex justify-between"><span>Total package price</span><span>{formatCents(schedulePreview.total_cents)}</span></div>
                <div className="flex justify-between"><span>Charged today</span><span>{formatCents(schedulePreview.amount_due_at_sale_cents)}</span></div>
                <div className="flex justify-between">
                  <span>Future scheduled</span>
                  <span>{formatCents(schedulePreview.total_cents - schedulePreview.amount_due_at_sale_cents)}</span>
                </div>
                <div className="flex justify-between"><span>Final payment date</span><span>{businessDate(schedulePreview.final_payment_date)}</span></div>
              </div>
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
          <Button
            onClick={submit}
            disabled={submitting || !selectedUserId || !selectedPack || (planActive && !schedulePreview)}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {planActive
              ? `Start plan · ${formatCents(dueTodayCents)} today`
              : willCharge ? `Charge ${formatCents(totalCents)}` : "Record sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

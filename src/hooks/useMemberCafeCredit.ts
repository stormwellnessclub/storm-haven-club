import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PrepaidItem {
  menu_item_id: string;
  quantity_remaining: number;
  item_name: string;
  price: number;
}

export interface CafeCreditBalance {
  balance_cents: number;
  prepaid_items: PrepaidItem[];
}

export interface CafeCreditLedgerEntry {
  id: string;
  member_id: string;
  kind: string;
  amount_cents: number;
  item_quantity: number;
  menu_item_id: string | null;
  menu_item_name: string | null;
  cafe_order_id: string | null;
  stripe_payment_intent_id: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export function useMemberCafeCredit(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ["cafe-credit-balance", memberId],
    queryFn: async (): Promise<CafeCreditBalance> => {
      if (!memberId) return { balance_cents: 0, prepaid_items: [] };
      const { data, error } = await supabase.rpc("get_member_cafe_credit_balance" as any, {
        _member_id: memberId,
      });
      if (error) throw error;
      return (data as any) || { balance_cents: 0, prepaid_items: [] };
    },
    enabled: !!memberId,
    staleTime: 10_000,
  });
}

export function useCafeCreditLedger(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ["cafe-credit-ledger", memberId],
    queryFn: async (): Promise<CafeCreditLedgerEntry[]> => {
      if (!memberId) return [];
      const { data, error } = await (supabase.from as any)("cafe_credit_ledger")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as CafeCreditLedgerEntry[];
    },
    enabled: !!memberId,
  });
}

function invalidateCredit(qc: ReturnType<typeof useQueryClient>, memberId: string) {
  qc.invalidateQueries({ queryKey: ["cafe-credit-balance", memberId] });
  qc.invalidateQueries({ queryKey: ["cafe-credit-ledger", memberId] });
  qc.invalidateQueries({ queryKey: ["cafe-credit-all-members"] });
}

export function useGrantCashCredit(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ amountDollars, reason }: { amountDollars: number; reason: string }) => {
      const { data, error } = await supabase.rpc("grant_cafe_cash_credit" as any, {
        _member_id: memberId,
        _amount_cents: Math.round(amountDollars * 100),
        _reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateCredit(qc, memberId);
      toast.success("Cash credit added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGrantPrepaidItems(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      menuItemId,
      quantity,
      reason,
    }: {
      menuItemId: string;
      quantity: number;
      reason: string;
    }) => {
      const { data, error } = await supabase.rpc("grant_cafe_prepaid_items" as any, {
        _member_id: memberId,
        _menu_item_id: menuItemId,
        _quantity: quantity,
        _reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateCredit(qc, memberId);
      toast.success("Prepaid items granted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAdjustCafeCredit(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ amountDollars, reason }: { amountDollars: number; reason: string }) => {
      const { data, error } = await supabase.rpc("adjust_cafe_credit" as any, {
        _member_id: memberId,
        _amount_cents: Math.round(amountDollars * 100),
        _reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateCredit(qc, memberId);
      toast.success("Adjustment posted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChargeCardForCredit(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stripeCustomerId,
      amountDollars,
      reason,
    }: {
      stripeCustomerId: string;
      amountDollars: number;
      reason: string;
    }) => {
      const amountCents = Math.round(amountDollars * 100);
      const { data: chargeResult, error: chargeError } = await supabase.functions.invoke(
        "stripe-payment",
        {
          body: {
            action: "charge_saved_card",
            stripeCustomerId,
            amount: amountCents,
            description: `Cafe credit top-up`,
            chargeType: "pos",
            processingFee: 0,
            subtotal: amountCents,
            taxAmount: 0,
          },
        }
      );
      if (chargeError) throw new Error(chargeError.message || "Charge failed");
      if (chargeResult && !chargeResult.success) {
        throw new Error(chargeResult.error || "Card declined");
      }
      const paymentIntentId = chargeResult?.payment_intent_id || chargeResult?.paymentIntentId || null;

      const { error: recordError } = await supabase.rpc("record_cafe_cash_purchase" as any, {
        _member_id: memberId,
        _amount_cents: amountCents,
        _payment_intent_id: paymentIntentId,
        _reason: reason || "Card-funded credit top-up",
      });
      if (recordError) throw recordError;
      return chargeResult;
    },
    onSuccess: () => {
      invalidateCredit(qc, memberId);
      toast.success("Card charged and credit added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface RedeemCartItem {
  menu_item_id: string | null;
  quantity: number;
  unit_price_cents: number;
  name: string;
}

export interface RedeemResult {
  item_discount_cents: number;
  cash_applied_cents: number;
  remaining_balance_cents: number;
  ledger_ids: string[];
}

export async function redeemCafeCredit(params: {
  memberId: string;
  cafeOrderId: string;
  cartItems: RedeemCartItem[];
  cashToApplyCents: number;
}): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc("redeem_cafe_credit" as any, {
    _member_id: params.memberId,
    _cafe_order_id: params.cafeOrderId,
    _cart_items: params.cartItems as any,
    _cash_to_apply_cents: params.cashToApplyCents,
  });
  if (error) throw error;
  return data as RedeemResult;
}

export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const LEDGER_KIND_LABEL: Record<string, string> = {
  cash_grant: "Cash credit added",
  cash_purchase: "Card-funded top-up",
  item_grant: "Prepaid items granted",
  redemption_cash: "Cash credit applied",
  redemption_item: "Prepaid item redeemed",
  adjustment: "Adjustment",
};

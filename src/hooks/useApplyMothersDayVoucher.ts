import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppliedVoucher {
  id: string;
  code: string;
  status: "active";
  massage_choice: string | null;
  massage_duration: number;
  recipient_name: string | null;
  buyer_name: string | null;
  expires_at: string;
}

interface ApplyResult {
  ok: boolean;
  voucher?: AppliedVoucher;
  error?: string;
  reconciled?: boolean;
}

/**
 * Validates a Mother's Day voucher code. If pending, triggers a one-shot
 * Stripe reconcile for that voucher and re-checks. Only an `active` voucher
 * resolves successfully — unpaid pending codes are hard-blocked.
 */
export function useApplyMothersDayVoucher() {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<AppliedVoucher | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async (rawCode: string): Promise<ApplyResult> => {
    setApplying(true);
    setError(null);
    try {
      const code = (rawCode || "").trim().toUpperCase();
      if (!code) {
        const e = "Enter a voucher code";
        setError(e);
        return { ok: false, error: e };
      }

      const lookup = async () => {
        const { data, error } = await supabase.rpc("lookup_mothers_day_voucher", { p_code: code });
        if (error) throw error;
        return data as any;
      };

      let v = await lookup();
      let reconciled = false;

      if (!v?.found) {
        const e = "Voucher code not found";
        setError(e);
        return { ok: false, error: e };
      }

      if (v.expired) {
        const e = "This voucher has expired";
        setError(e);
        return { ok: false, error: e };
      }

      if (v.status === "pending") {
        // One-shot reconcile against Stripe for just this voucher
        try {
          await supabase.functions.invoke("mothers-day-reconcile", {
            body: { voucher_id: v.id },
          });
          reconciled = true;
        } catch { /* ignore — re-check below */ }
        v = await lookup();
      }

      if (v.status !== "active") {
        const map: Record<string, string> = {
          pending: "This voucher hasn't been paid for yet. Booking is blocked until payment completes.",
          redeemed: "This voucher has already been redeemed.",
          expired: "This voucher has expired.",
          refunded: "This voucher was refunded and can no longer be used.",
        };
        const e = map[v.status] || `Voucher is ${v.status}`;
        setError(e);
        return { ok: false, error: e, reconciled };
      }

      const voucher: AppliedVoucher = {
        id: v.id,
        code: v.code || code,
        status: "active",
        massage_choice: v.massage_choice,
        massage_duration: v.massage_duration,
        recipient_name: v.recipient_name,
        buyer_name: v.buyer_name,
        expires_at: v.expires_at,
      };
      setApplied(voucher);
      return { ok: true, voucher, reconciled };
    } catch (e: any) {
      const msg = e?.message || "Could not validate voucher";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setApplying(false);
    }
  }, []);

  const clear = useCallback(() => {
    setApplied(null);
    setError(null);
  }, []);

  return { apply, clear, applying, applied, error };
}

/** Marks the voucher redeemed and links the appointment. Safe to call after appointment insert. */
export async function redeemMothersDayVoucher(code: string, appointmentId: string | null) {
  const { data, error } = await supabase.rpc("redeem_mothers_day_voucher", {
    p_code: code,
    p_appointment_id: appointmentId,
  });
  if (error) throw error;
  const result = data as any;
  if (!result?.success) throw new Error(result?.error || "Failed to redeem voucher");
  return result;
}

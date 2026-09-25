import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PTPassBalance {
  pass_id: string;
  user_id: string;
  sessions_purchased: number;
  sessions_consumed: number;
  sessions_reserved: number;
  available_to_book: number;
  entitlement_remaining: number;
}

/** Available / Reserved / Consumed balances per package (reserved = future booked sessions, not used). */
export function usePTPassBalances() {
  return useQuery({
    queryKey: ["pt-pass-balances"],
    queryFn: async (): Promise<Record<string, PTPassBalance>> => {
      const { data, error } = await (supabase as any).from("pt_pass_balances").select("*").limit(5000);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r: PTPassBalance) => [r.pass_id, r]));
    },
  });
}

export function passBalanceText(b?: PTPassBalance, fallback?: { remaining: number; total: number }) {
  if (!b) return fallback ? `${fallback.remaining}/${fallback.total}` : "—";
  return `${b.available_to_book} available · ${b.sessions_reserved} reserved · ${b.sessions_consumed} consumed of ${b.sessions_purchased}`;
}

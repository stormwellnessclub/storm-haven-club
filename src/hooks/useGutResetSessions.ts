import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GutResetSession {
  id: string;
  start_date: string;
  length_days: number;
  capacity: number | null;
  spots_taken: number;
  status: "scheduled" | "cancelled" | "completed";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GutResetPurchase {
  id: string;
  session_id: string;
  option: "3day" | "5day";
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  user_id: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_cents: number;
  status: "pending" | "paid" | "refunded" | "cancelled";
  created_at: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function useUpcomingGutResetSessions() {
  return useQuery<GutResetSession[]>({
    queryKey: ["gut-reset-sessions", "upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gut_reset_sessions")
        .select("*")
        .eq("status", "scheduled")
        .gte("start_date", todayISO())
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GutResetSession[];
    },
  });
}

export function useAllGutResetSessions() {
  return useQuery<GutResetSession[]>({
    queryKey: ["gut-reset-sessions", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gut_reset_sessions")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GutResetSession[];
    },
  });
}

export function useGutResetPurchases(sessionId?: string) {
  return useQuery<GutResetPurchase[]>({
    queryKey: ["gut-reset-purchases", sessionId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("gut_reset_purchases")
        .select("*")
        .order("created_at", { ascending: false });
      if (sessionId) q = q.eq("session_id", sessionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GutResetPurchase[];
    },
  });
}

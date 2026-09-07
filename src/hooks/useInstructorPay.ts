import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PayPeriod {
  id: string;
  instructor_id: string;
  start_date: string;
  end_date: string;
  status: "open" | "due" | "paid";
  rate_per_class: number;
  total_amount: number;
  paid_at: string | null;
  payment_note: string | null;
  auto_roll: boolean;
}

export interface PayItem {
  id: string;
  period_id: string;
  session_id: string | null;
  item_date: string;
  start_time: string | null;
  description: string;
  attendance_count: number;
  rate: number;
  amount: number;
  is_manual: boolean;
  is_paid_class: boolean;
  notes: string | null;
}

export const INSTRUCTOR_PAY_KEY = "instructor-pay";

export function useInstructorPay(instructorId?: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [INSTRUCTOR_PAY_KEY, instructorId],
    enabled: !!instructorId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: periods, error } = await supabase
        .from("instructor_pay_periods")
        .select(
          "id, instructor_id, start_date, end_date, status, rate_per_class, total_amount, paid_at, payment_note, auto_roll",
        )
        .eq("instructor_id", instructorId!)
        .order("start_date", { ascending: false });
      if (error) throw error;

      const ids = (periods ?? []).map((p) => p.id);
      let items: PayItem[] = [];
      if (ids.length) {
        const { data: rows, error: itemsError } = await supabase
          .from("instructor_pay_items")
          .select(
            "id, period_id, session_id, item_date, start_time, description, attendance_count, rate, amount, is_manual, is_paid_class, notes",
          )
          .in("period_id", ids)
          .order("item_date", { ascending: true });
        if (itemsError) throw itemsError;
        items = (rows ?? []) as PayItem[];
      }

      return {
        periods: (periods ?? []) as PayPeriod[],
        itemsByPeriod: items.reduce<Record<string, PayItem[]>>((acc, item) => {
          (acc[item.period_id] ||= []).push(item);
          return acc;
        }, {}),
      };
    },
  });

  return {
    ...query,
    refreshPeriod: async (periodId: string) => {
      await supabase.rpc("refresh_instructor_pay_period", { _period_id: periodId });
      await qc.invalidateQueries({ queryKey: [INSTRUCTOR_PAY_KEY] });
    },
    invalidate: () => qc.invalidateQueries({ queryKey: [INSTRUCTOR_PAY_KEY] }),
  };
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function periodLabel(p: Pick<PayPeriod, "start_date" | "end_date">) {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return `${m}/${day}/${String(y).slice(2)}`;
  };
  return `${fmt(p.start_date)} – ${fmt(p.end_date)}`;
}

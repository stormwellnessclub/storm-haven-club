import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PlanFrequency = "monthly" | "weekly" | "biweekly";

export interface PTPackPaymentPlan {
  id: string;
  pack_id: string;
  name: string;
  /** Canonical model (2C.5B1) */
  plan_total_cents: number;
  amount_due_at_sale_cents: number;
  future_installment_count: number;
  installment_cents: number;
  final_installment_cents: number;
  frequency: PlanFrequency;
  frequency_unit: string;
  frequency_interval: number;
  allow_staff_first_autopay_date_selection: boolean;
  is_active: boolean;
  display_order: number;
  stripe_price_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Legacy mirrors, maintained by the database trigger. */
  installment_count: number;
  down_payment_cents: number;
}

export const FREQUENCY_LABEL: Record<PlanFrequency, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
};

const SELECT =
  "id, pack_id, name, plan_total_cents, amount_due_at_sale_cents, future_installment_count, installment_cents, final_installment_cents, frequency, frequency_unit, frequency_interval, allow_staff_first_autopay_date_selection, is_active, display_order, stripe_price_id, created_by, created_at, updated_at, installment_count, down_payment_cents";

/** Plans for one package, or for every package when packId is omitted. */
export function usePTPackPaymentPlans(packId?: string) {
  return useQuery({
    queryKey: ["pt-pack-payment-plans", packId ?? "all"],
    queryFn: async (): Promise<PTPackPaymentPlan[]> => {
      let q = (supabase as any)
        .from("pt_pack_payment_plans")
        .select(SELECT)
        .order("display_order", { ascending: true })
        .order("future_installment_count", { ascending: true });
      if (packId) q = q.eq("pack_id", packId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PTPackPaymentPlan[];
    },
  });
}

export interface PlanDraft {
  id?: string;
  pack_id: string;
  name: string;
  plan_total_cents: number;
  amount_due_at_sale_cents: number;
  future_installment_count: number;
  installment_cents: number;
  final_installment_cents: number;
  frequency: PlanFrequency;
  is_active: boolean;
  display_order: number;
}

export function usePTPackPaymentPlanMutations(packId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pt-pack-payment-plans"] });
    qc.invalidateQueries({ queryKey: ["pt-packages-catalog-v2"] });
  };

  async function syncPrice(planId: string) {
    const { data, error } = await supabase.functions.invoke("sync-pt-pack-plan-price", {
      body: { plan_id: planId },
    });
    if (error) console.error(error);
    else if ((data as any)?.error) console.error((data as any).error);
  }

  const save = useMutation({
    mutationFn: async (draft: PlanDraft) => {
      const payload = {
        pack_id: draft.pack_id,
        name: draft.name.trim(),
        plan_total_cents: draft.plan_total_cents,
        amount_due_at_sale_cents: draft.amount_due_at_sale_cents,
        future_installment_count: draft.future_installment_count,
        installment_cents: draft.installment_cents,
        final_installment_cents: draft.final_installment_cents,
        frequency: draft.frequency,
        is_active: draft.is_active,
        display_order: draft.display_order,
      };
      let planId = draft.id;
      if (draft.id) {
        const { error } = await (supabase as any)
          .from("pt_pack_payment_plans").update(payload).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("pt_pack_payment_plans").insert(payload).select("id").single();
        if (error) throw error;
        planId = data.id;
      }
      if (planId) await syncPrice(planId);
      return planId as string;
    },
    onSuccess: () => { invalidate(); toast.success("Payment plan saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save the payment plan"),
  });

  const duplicate = useMutation({
    mutationFn: async (plan: PTPackPaymentPlan) => {
      const { data, error } = await (supabase as any)
        .from("pt_pack_payment_plans")
        .insert({
          pack_id: plan.pack_id,
          name: `${plan.name} (copy)`,
          plan_total_cents: plan.plan_total_cents,
          amount_due_at_sale_cents: plan.amount_due_at_sale_cents,
          future_installment_count: plan.future_installment_count,
          installment_cents: plan.installment_cents,
          final_installment_cents: plan.final_installment_cents,
          frequency: plan.frequency,
          is_active: false,
          display_order: plan.display_order + 1,
        })
        .select("id")
        .single();
      if (error) throw error;
      await syncPrice(data.id);
    },
    onSuccess: () => { invalidate(); toast.success("Plan duplicated — it starts inactive"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not duplicate the plan"),
  });

  const setActive = useMutation({
    mutationFn: async (input: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("pt_pack_payment_plans")
        .update({ is_active: input.is_active })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { invalidate(); toast.success(v.is_active ? "Plan reactivated" : "Plan archived"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the plan"),
  });

  return { save, duplicate, setActive, packId };
}

/**
 * Split a plan total into an amount due at sale plus N future installments.
 * Rounding never loses or invents money: the final installment absorbs the remainder.
 */
export function splitPlan(totalCents: number, dueAtSaleCents: number, futureCount: number) {
  const n = Math.max(1, futureCount);
  const remaining = Math.max(0, totalCents - dueAtSaleCents);
  const each = Math.floor(remaining / n);
  const final = remaining - each * (n - 1);
  return { installment_cents: each, final_installment_cents: final };
}

/** Default even split across (futureCount + 1) payments. */
export function evenSplit(totalCents: number, totalPayments: number) {
  const n = Math.max(2, totalPayments);
  const due = Math.ceil(totalCents / n);
  return {
    amount_due_at_sale_cents: due,
    future_installment_count: n - 1,
    ...splitPlan(totalCents, due, n - 1),
  };
}

export function planScheduledTotal(plan: {
  amount_due_at_sale_cents: number;
  future_installment_count: number;
  installment_cents: number;
  final_installment_cents: number;
}) {
  return (
    plan.amount_due_at_sale_cents +
    (plan.future_installment_count - 1) * plan.installment_cents +
    plan.final_installment_cents
  );
}

export function planTotalCents(plan: { plan_total_cents?: number } & Record<string, any>) {
  return plan.plan_total_cents ?? planScheduledTotal(plan as any);
}

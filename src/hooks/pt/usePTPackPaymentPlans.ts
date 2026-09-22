import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PlanFrequency = "monthly" | "weekly" | "biweekly";

export interface PTPackPaymentPlan {
  id: string;
  pack_id: string;
  name: string;
  installment_count: number;
  down_payment_cents: number;
  installment_cents: number;
  frequency: PlanFrequency;
  is_active: boolean;
  display_order: number;
  stripe_price_id: string | null;
  created_at: string;
  updated_at: string;
}

export const FREQUENCY_LABEL: Record<PlanFrequency, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
};

const SELECT =
  "id, pack_id, name, installment_count, down_payment_cents, installment_cents, frequency, is_active, display_order, stripe_price_id, created_at, updated_at";

/** Plans for one package, or for every package when packId is omitted. */
export function usePTPackPaymentPlans(packId?: string) {
  return useQuery({
    queryKey: ["pt-pack-payment-plans", packId ?? "all"],
    queryFn: async (): Promise<PTPackPaymentPlan[]> => {
      let q = (supabase as any)
        .from("pt_pack_payment_plans")
        .select(SELECT)
        .order("display_order", { ascending: true })
        .order("installment_count", { ascending: true });
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
  installment_count: number;
  down_payment_cents: number;
  installment_cents: number;
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
        installment_count: draft.installment_count,
        down_payment_cents: draft.down_payment_cents,
        installment_cents: draft.installment_cents,
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
          installment_count: plan.installment_count,
          down_payment_cents: plan.down_payment_cents,
          installment_cents: plan.installment_cents,
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

/** Even split helper: returns the default down payment and installment for a plan shape. */
export function evenSplit(priceCents: number, installmentCount: number) {
  const n = Math.max(2, installmentCount);
  const installment = Math.ceil(priceCents / n);
  const down = priceCents - installment * (n - 1);
  return { down_payment_cents: Math.max(0, down), installment_cents: installment };
}

export function planTotalCents(plan: { down_payment_cents: number; installment_count: number; installment_cents: number }) {
  return plan.down_payment_cents + (plan.installment_count - 1) * plan.installment_cents;
}

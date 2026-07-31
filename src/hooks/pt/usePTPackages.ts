import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PTPassRow {
  id: string;
  user_id: string;
  pack_id: string | null;
  pack_name: string;
  format: string;
  sessions_total: number;
  sessions_remaining: number;
  price_cents_charged: number | null;
  activated_at: string;
  expires_at: string;
  status: string;
  payment_method: string | null;
  purchased_at: string | null;
  renewal_reminder_sent_at: string | null;
  renewal_reminder_count: number;
  notes: string | null;
}

export interface PTAdjustmentRow {
  id: string;
  pass_id: string;
  user_id: string;
  delta_sessions: number;
  sessions_before: number;
  sessions_after: number;
  adjustment_type: string;
  reason: string | null;
  expires_at_before: string | null;
  expires_at_after: string | null;
  transfer_pass_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PTUsageRow {
  id: string;
  pass_id: string;
  used_at: string;
  notes: string | null;
  used_by_admin_id: string | null;
}

export function daysUntil(dateStr?: string | null): number {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const d = new Date(`${dateStr}T23:59:59`);
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function usePTPasses() {
  return useQuery({
    queryKey: ["pt-packages-passes-v2"],
    queryFn: async (): Promise<PTPassRow[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_passes")
        .select(
          "id, user_id, pack_id, pack_name, format, sessions_total, sessions_remaining, price_cents_charged, activated_at, expires_at, status, payment_method, purchased_at, renewal_reminder_sent_at, renewal_reminder_count, notes"
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTPacks() {
  return useQuery({
    queryKey: ["pt-packages-catalog-v2"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_packs")
        .select("id, name, format, sessions, price_cents, expiration_days, is_active, is_public, display_order, allow_payment_plan, payment_plan_months")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTPassAdjustments(passId?: string) {
  return useQuery({
    queryKey: ["pt-pass-adjustments", passId ?? "all"],
    queryFn: async (): Promise<PTAdjustmentRow[]> => {
      let q = (supabase as any)
        .from("pt_pass_adjustments")
        .select("id, pass_id, user_id, delta_sessions, sessions_before, sessions_after, adjustment_type, reason, expires_at_before, expires_at_after, transfer_pass_id, created_by, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (passId) q = q.eq("pass_id", passId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTPassUsage(passIds?: string[]) {
  const ids = useMemo(() => Array.from(new Set((passIds ?? []).filter(Boolean))).sort(), [passIds]);
  return useQuery({
    queryKey: ["pt-pass-usage", ids.length ? ids : "all"],
    queryFn: async (): Promise<PTUsageRow[]> => {
      let q = (supabase as any)
        .from("pt_session_usage")
        .select("id, pass_id, used_at, notes, used_by_admin_id")
        .order("used_at", { ascending: false })
        .limit(500);
      if (ids.length) q = q.in("pass_id", ids);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTPackageMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pt-packages-passes-v2"] });
    qc.invalidateQueries({ queryKey: ["pt-pass-adjustments"] });
  };

  const adjust = useMutation({
    mutationFn: async (input: {
      passId: string;
      delta: number;
      reason: string;
      adjustmentType?: string;
      newExpiresAt?: string | null;
    }) => {
      const { error } = await (supabase as any).rpc("pt_adjust_pass_balance", {
        p_pass_id: input.passId,
        p_delta: input.delta,
        p_reason: input.reason,
        p_adjustment_type: input.adjustmentType ?? "manual",
        p_new_expires_at: input.newExpiresAt || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Package adjusted"); },
    onError: (e: any) => toast.error(e?.message ?? "Adjustment failed"),
  });

  const transfer = useMutation({
    mutationFn: async (input: { fromPassId: string; toPassId: string; sessions: number; reason: string }) => {
      const { error } = await (supabase as any).rpc("pt_transfer_pass_sessions", {
        p_from_pass_id: input.fromPassId,
        p_to_pass_id: input.toPassId,
        p_sessions: input.sessions,
        p_reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Sessions transferred"); },
    onError: (e: any) => toast.error(e?.message ?? "Transfer failed"),
  });

  const logReminder = useMutation({
    mutationFn: async (input: { passId: string; note?: string }) => {
      const { error } = await (supabase as any).rpc("pt_log_renewal_reminder", {
        p_pass_id: input.passId,
        p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["pt-tasks"] });
      toast.success("Renewal reminder logged and follow-up task created");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not log reminder"),
  });

  return { adjust, transfer, logReminder };
}

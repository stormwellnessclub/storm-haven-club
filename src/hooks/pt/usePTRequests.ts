import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  under_review: "Under Review",
  alternate_offered: "Alternate Offered",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export function usePTRequests() {
  return useQuery({
    queryKey: ["pt-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_requests")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function usePTSessionTypes() {
  return useQuery({
    queryKey: ["pt-session-types-active"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_session_types").select("id,name,format,duration_minutes").eq("is_active", true).order("display_order");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; format: string; duration_minutes: number }[];
    },
  });
}

export function usePTRequestContext(userId: string | null) {
  return useQuery({
    queryKey: ["pt-request-context", userId],
    enabled: !!userId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: passes }, { data: dunning }] = await Promise.all([
        (supabase as any).from("pt_passes").select("id,format,sessions_remaining,expires_at,financial_status,amount_outstanding_cents")
          .eq("user_id", userId).eq("status", "active").gte("expires_at", today),
        (supabase as any).from("pt_payment_plan_installments").select("id,status,amount_cents")
          .eq("user_id", userId).in("status", ["failed", "past_due"]),
      ]);
      return { passes: passes ?? [], failed: dunning ?? [] };
    },
  });
}

function errMsg(e: any) {
  const m = String(e?.message ?? e ?? "Something went wrong");
  return m.replace(/^(TRAINER_CONFLICT|CLIENT_CONFLICT|CONFLICT|NO_SESSIONS|ALREADY_BOOKED):\s*/, "");
}

export function usePTRequestActions() {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: ["pt-requests"] });
    qc.invalidateQueries({ queryKey: ["pt-appointments"] });
  };
  const update = useMutation({
    mutationFn: async (args: { id: string; action: string; reason?: string; trainerId?: string | null; date?: string | null; time?: string | null; clientUserId?: string | null; sessionTypeId?: string | null }) => {
      const { error } = await (supabase as any).rpc("pt_request_update", {
        p_request_id: args.id, p_action: args.action, p_reason: args.reason ?? null,
        p_trainer_id: args.trainerId ?? null, p_alt_date: args.date ?? null, p_alt_time: args.time ?? null,
        p_client_user_id: args.clientUserId ?? null, p_session_type_id: args.sessionTypeId ?? null,
      });
      if (error) throw new Error(errMsg(error));
    },
    onSuccess: done,
  });
  const confirm = useMutation({
    mutationFn: async (args: { id: string; useAlternate: boolean }) => {
      const { data, error } = await (supabase as any).rpc("pt_request_confirm", { p_request_id: args.id, p_use_alternate: args.useAlternate });
      if (error) throw new Error(errMsg(error));
      return data as { appointment_id: string; already_confirmed: boolean; package_used?: boolean };
    },
    onSuccess: done,
  });
  return { update, confirm };
}

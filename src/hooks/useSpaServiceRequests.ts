import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SpaRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  preferred_time: string | null;
  requested_date: string | null;
  requested_time: string | null;
  alt_date: string | null;
  alt_time: string | null;
  status: string;
  handled_at: string | null;
  appointment_id: string | null;
  notified_at: string | null;
  service_name: string;
  service_category: string | null;
  message: string | null;
  created_at: string;
}

const KEY = ["spa-service-requests"];

/** All spa requests (newest first) with a live listener so new ones appear right away. */
export function useSpaServiceRequests() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("spa-service-requests-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "spa_service_requests" }, () => {
        qc.invalidateQueries({ queryKey: KEY });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("spa_service_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as SpaRequest[];
    },
    staleTime: 0,
    refetchInterval: 30000,
  });
}

export function useNewSpaRequestCount() {
  const { data } = useSpaServiceRequests();
  return (data ?? []).filter((r) => r.status === "new").length;
}

export async function setSpaRequestStatus(id: string, status: string, appointmentId?: string | null, notified?: boolean) {
  const { data: u } = await supabase.auth.getUser();
  const patch: any = {
    status,
    handled_by: status === "new" ? null : u.user?.id ?? null,
    handled_at: status === "new" ? null : new Date().toISOString(),
  };
  if (appointmentId !== undefined) patch.appointment_id = appointmentId;
  if (notified) patch.notified_at = new Date().toISOString();
  const { error } = await (supabase.from as any)("spa_service_requests").update(patch).eq("id", id);
  if (error) throw error;
}

/** Setup progress for booked requests: account linked, waiver signed, intake done. */
export function useBookedRequestSetup(appointmentIds: string[]) {
  return useQuery({
    queryKey: ["spa-request-setup", [...appointmentIds].sort().join(",")],
    enabled: appointmentIds.length > 0,
    queryFn: async () => {
      const { data: appts } = await (supabase.from as any)("spa_appointments")
        .select("id, user_id").in("id", appointmentIds);
      const userIds = (appts || []).map((a: any) => a.user_id).filter(Boolean);
      const waiver: Record<string, boolean> = {};
      const card: Record<string, boolean> = {};
      if (userIds.length) {
        const [{ data: w }, { data: mc }, { data: nc }] = await Promise.all([
          (supabase.rpc as any)("effective_waiver_status", { _user_ids: userIds }),
          supabase.from("members").select("user_id, card_last4").in("user_id", userIds),
          supabase.from("non_member_profiles").select("user_id, card_last4").in("user_id", userIds),
        ]);
        for (const r of w || []) waiver[r.user_id] = r.status === "signed";
        for (const r of [...(mc || []), ...(nc || [])] as any[]) if (r.card_last4) card[r.user_id] = true;
      }
      const out: Record<string, { account: boolean; waiver: boolean; card: boolean }> = {};
      for (const a of appts || []) out[a.id] = { account: !!a.user_id, waiver: !!(a.user_id && waiver[a.user_id]), card: !!(a.user_id && card[a.user_id]) };
      return out;
    },
  });
}

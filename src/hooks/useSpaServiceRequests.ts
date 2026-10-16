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

export async function setSpaRequestStatus(id: string, status: string, appointmentId?: string | null) {
  const { data: u } = await supabase.auth.getUser();
  const patch: any = {
    status,
    handled_by: status === "new" ? null : u.user?.id ?? null,
    handled_at: status === "new" ? null : new Date().toISOString(),
  };
  if (appointmentId !== undefined) patch.appointment_id = appointmentId;
  const { error } = await (supabase.from as any)("spa_service_requests").update(patch).eq("id", id);
  if (error) throw error;
}

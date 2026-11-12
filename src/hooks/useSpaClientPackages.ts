import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { detroitToday, summarizeSeries, type SeriesAppointment, type SpaClientPackage } from "@/lib/spaClientPackages";

export const MY_SPA_PACKAGES_KEY = ["my-spa-client-packages"];

/** The signed-in client's purchased treatments/series for a service, with sessions used and left. */
export function useMySpaPackages(serviceKey: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...MY_SPA_PACKAGES_KEY, user?.id, serviceKey],
    enabled: !!user,
    queryFn: async () => {
      const { data: pkgs, error } = await supabase
        .from("spa_client_packages")
        .select("id,user_id,service_key,package_name,sessions_total,price_paid_cents,purchased_at,expires_on,status")
        .eq("user_id", user!.id)
        .eq("service_key", serviceKey)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      const ids = (pkgs ?? []).map((p) => p.id);
      let appts: SeriesAppointment[] = [];
      if (ids.length) {
        const { data, error: aErr } = await supabase
          .from("spa_appointments")
          .select("id,client_package_id,appointment_date,appointment_time,status,treatment_zone_name")
          .in("client_package_id", ids);
        if (aErr) throw aErr;
        appts = (data ?? []) as SeriesAppointment[];
      }
      const today = detroitToday();
      return (pkgs ?? []).map((p) => summarizeSeries(p as SpaClientPackage, appts, today));
    },
  });
}

export interface StaffClientPackage {
  id: string; user_id: string; client_name: string | null; client_email: string | null; package_name: string; service_key: string;
  sessions_total: number; sessions_used: number; price_paid_cents: number; purchased_at: string; expires_on: string | null;
  status: string; next_appointment: string | null;
}

/** Staff list of every purchased series for a service. */
export function useStaffSpaClientPackages(serviceKey: string) {
  return useQuery({
    queryKey: ["staff-spa-client-packages", serviceKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_spa_client_packages", { p_service_key: serviceKey });
      if (error) throw error;
      return (data ?? []) as StaffClientPackage[];
    },
  });
}

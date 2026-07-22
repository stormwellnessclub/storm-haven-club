import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CafeNotifications {
  pendingCount: number;
  preparingCount: number;
  totalActiveCount: number;
}

const ACTIVE_STATUSES = ["pending", "preparing"] as const;

export function useAdminCafeNotifications() {
  return useQuery({
    queryKey: ["admin-cafe-notifications"],
    queryFn: async (): Promise<CafeNotifications> => {
      try {
        // Front desk / kiosk (no auth session) can't satisfy RLS on cafe_orders;
        // fall through to the SECURITY DEFINER kiosk RPC in that case.
        const { data: sessionData } = await supabase.auth.getSession();
        const hasAuth = !!sessionData?.session?.user;

        if (!hasAuth) {
          const { data, error } = await (supabase.rpc as any)(
            "kiosk_cafe_notification_counts",
          );
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          return {
            pendingCount: row?.pending_count ?? 0,
            preparingCount: row?.preparing_count ?? 0,
            totalActiveCount: row?.total_active_count ?? 0,
          };
        }

        const { data, error } = await (supabase.from as any)("cafe_orders")
          .select("status")
          .in("status", ACTIVE_STATUSES as unknown as string[]);

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            return { pendingCount: 0, preparingCount: 0, totalActiveCount: 0 };
          }
          throw error;
        }

        const rows = (data || []) as Array<{ status: string }>;
        const pendingCount = rows.filter((r) => r.status === "pending").length;
        const preparingCount = rows.filter((r) => r.status === "preparing").length;

        return {
          pendingCount,
          preparingCount,
          totalActiveCount: pendingCount + preparingCount,
        };
      } catch (err) {
        console.error("Failed to load cafe notifications:", err);
        return { pendingCount: 0, preparingCount: 0, totalActiveCount: 0 };
      }
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

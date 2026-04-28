import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CafeNotifications {
  pendingCount: number;
  preparingCount: number;
  totalActiveCount: number;
}

// Statuses that need staff attention in the cafe queue
const ACTIVE_STATUSES = ["pending", "preparing"] as const;

export function useAdminCafeNotifications() {
  return useQuery({
    queryKey: ["admin-cafe-notifications"],
    queryFn: async (): Promise<CafeNotifications> => {
      try {
        const { data, error } = await (supabase.from as any)("cafe_orders")
          .select("status")
          .in("status", ACTIVE_STATUSES as unknown as string[]);

        if (error) {
          // Table may not exist yet in some envs
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

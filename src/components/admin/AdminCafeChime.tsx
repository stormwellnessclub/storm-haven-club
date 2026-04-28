import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCafeNotifications } from "@/hooks/useAdminCafeNotifications";
import { getIsMuted, playNotificationChime } from "./AdminSupportChime";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Plays the same admin chime any time a new cafe order comes in
 * (and every 5 minutes while pending/preparing orders remain unhandled).
 * Mounted globally inside AdminLayout so staff hear the alert regardless
 * of which admin page they're on.
 */
export function AdminCafeChime() {
  const queryClient = useQueryClient();
  const { data: notifications } = useAdminCafeNotifications();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chimeSafe = useCallback(() => {
    if (!getIsMuted()) playNotificationChime();
  }, []);

  // Realtime: chime instantly when a new cafe order is inserted
  useEffect(() => {
    try {
      const channel = supabase
        .channel("global-cafe-chime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "cafe_orders" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["admin-cafe-notifications"] });
            queryClient.invalidateQueries({ queryKey: ["admin-cafe-orders"] });
            queryClient.invalidateQueries({ queryKey: ["cafe-orders"] });
            chimeSafe();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "cafe_orders" },
          () => {
            // Status changes (e.g., completed) should refresh counts but not chime
            queryClient.invalidateQueries({ queryKey: ["admin-cafe-notifications"] });
            queryClient.invalidateQueries({ queryKey: ["admin-cafe-orders"] });
            queryClient.invalidateQueries({ queryKey: ["cafe-orders"] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.error("Failed to subscribe admin cafe chime:", err);
      return undefined;
    }
  }, [queryClient, chimeSafe]);

  // Recurring 5-minute reminder while orders are still pending/preparing
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const active = notifications?.totalActiveCount ?? 0;
      if (active > 0 && !getIsMuted()) {
        playNotificationChime();
      }
    }, FIVE_MINUTES);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [notifications]);

  return null;
}

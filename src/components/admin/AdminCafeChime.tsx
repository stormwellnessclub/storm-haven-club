import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminCafeNotifications } from "@/hooks/useAdminCafeNotifications";
import { useReliableRealtime, type RealtimeStatus } from "@/hooks/useReliableRealtime";
import { getIsMuted, playNotificationChime } from "./AdminSupportChime";

const FIVE_MINUTES = 5 * 60 * 1000;

interface Props {
  onStatusChange?: (s: RealtimeStatus) => void;
}

/**
 * Chimes on every new cafe order. Belt-and-suspenders reliability:
 *  1) Realtime via useReliableRealtime (auto-reconnect, stale watchdog)
 *  2) Polling fallback — if active count increases without a realtime event, chime anyway
 *  3) 5-minute reminder while pending/preparing orders remain
 */
export function AdminCafeChime({ onStatusChange }: Props = {}) {
  const queryClient = useQueryClient();
  const { data: notifications } = useAdminCafeNotifications();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenCountRef = useRef<number | null>(null);
  const justChimedViaRealtimeRef = useRef(false);

  const chimeSafe = useCallback(() => {
    if (!getIsMuted()) playNotificationChime();
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-cafe-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["admin-cafe-orders"] });
    queryClient.invalidateQueries({ queryKey: ["cafe-orders"] });
  }, [queryClient]);

  const { status } = useReliableRealtime({
    channelName: "global-cafe-chime",
    listeners: [
      {
        event: "INSERT",
        table: "cafe_orders",
        callback: () => {
          invalidate();
          justChimedViaRealtimeRef.current = true;
          chimeSafe();
          // Reset flag after a window long enough for the polling refresh
          setTimeout(() => {
            justChimedViaRealtimeRef.current = false;
          }, 35_000);
        },
      },
      {
        event: "UPDATE",
        table: "cafe_orders",
        callback: () => invalidate(),
      },
    ],
  });

  // Bubble status up to the layout
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Polling fallback: if active count grew but realtime didn't fire, chime anyway
  useEffect(() => {
    const current = notifications?.totalActiveCount ?? 0;
    const prev = lastSeenCountRef.current;
    if (prev !== null && current > prev && !justChimedViaRealtimeRef.current) {
      console.log("[cafe chime] polling fallback triggered (count", prev, "→", current, ")");
      chimeSafe();
    }
    lastSeenCountRef.current = current;
  }, [notifications?.totalActiveCount, chimeSafe]);

  // 5-minute reminder while orders remain. Created ONCE (counts read from a
  // ref) — the query refetches often and would otherwise reset the timer.
  const notifRef = useRef(notifications);
  notifRef.current = notifications;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const active = notifRef.current?.totalActiveCount ?? 0;
      if (active > 0 && !getIsMuted()) playNotificationChime();
    }, FIVE_MINUTES);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return null;
}

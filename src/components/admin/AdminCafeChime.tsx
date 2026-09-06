import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminCafeNotifications } from "@/hooks/useAdminCafeNotifications";
import { useReliableRealtime, type RealtimeStatus } from "@/hooks/useReliableRealtime";
import { getIsMuted, playNotificationChime } from "./AdminSupportChime";

const FIVE_MINUTES = 5 * 60 * 1000;
const CAFE_CURSOR_KEY = "station-cafe-order-cursor";

function readCafeCursor(): string | null | undefined {
  try {
    const value = window.sessionStorage.getItem(CAFE_CURSOR_KEY);
    return value === null ? undefined : value;
  } catch {
    return undefined;
  }
}

function writeCafeCursor(value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(CAFE_CURSOR_KEY, value);
  } catch {
    /* storage unavailable */
  }
}

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
  const lastSeenOrderAtRef = useRef<string | null | undefined>(readCafeCursor());

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
        callback: (payload) => {
          invalidate();
          const createdAt = String(payload?.new?.created_at ?? "");
          if (createdAt && createdAt === lastSeenOrderAtRef.current) return;
          if (createdAt) {
            lastSeenOrderAtRef.current = createdAt;
            writeCafeCursor(createdAt);
          }
          chimeSafe();
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

  // Polling fallback compares event identity, never mutable order counts.
  useEffect(() => {
    if (!notifications) return;
    const latest = notifications.latestOrderAt ?? null;
    const prevLatest = lastSeenOrderAtRef.current;
    const newerOrder =
      prevLatest !== undefined && !!latest && (!prevLatest || latest > prevLatest);

    if (newerOrder) {
      console.log("[cafe chime] polling fallback triggered");
      chimeSafe();
    }
    lastSeenOrderAtRef.current = latest;
    writeCafeCursor(latest);
  }, [notifications, chimeSafe]);

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

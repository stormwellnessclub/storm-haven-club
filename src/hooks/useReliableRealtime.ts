import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "error" | "closed";

export interface RealtimeListener {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  table: string;
  filter?: string;
  callback: (payload: any) => void;
}

interface Options {
  /** Unique channel name (per browser tab). */
  channelName: string;
  listeners: RealtimeListener[];
  /** Verbose console logs for debugging. */
  debug?: boolean;
}

/**
 * Wraps a Supabase realtime channel with:
 *  - automatic reconnect on CHANNEL_ERROR / TIMED_OUT / CLOSED
 *  - exponential backoff (1s → 30s)
 *  - reconnect on network/page lifecycle recovery
 *  - exposes connection status so the UI can show a health indicator
 */
export function useReliableRealtime({
  channelName,
  listeners,
  debug = false,
}: Options) {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const listenersRef = useRef(listeners);
  listenersRef.current = listeners;

  const log = useCallback(
    (...args: any[]) => {
      if (debug) console.log(`[realtime:${channelName}]`, ...args);
    },
    [debug, channelName]
  );

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (e) {
        log("removeChannel error", e);
      }
      channelRef.current = null;
    }
  }, [log]);

  const connectRef = useRef<() => void>(() => undefined);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || reconnectTimerRef.current) return;
    const attempt = reconnectAttemptsRef.current++;
    const delay = Math.min(30_000, 1000 * Math.pow(2, attempt));
    log(`reconnect in ${delay}ms (attempt ${attempt + 1})`);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connectRef.current();
    }, delay);
  }, [log]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    cleanup();
    setStatus("connecting");
    log("connecting…");

    // Suffix with a random id so a quick reconnect doesn't collide with the old channel name
    const ch = supabase.channel(`${channelName}:${Math.random().toString(36).slice(2, 8)}`);

    listenersRef.current.forEach((l) => {
      ch.on(
        // @ts-expect-error - supabase-js types don't expose this overload cleanly
        "postgres_changes",
        {
          event: l.event,
          schema: l.schema || "public",
          table: l.table,
          ...(l.filter ? { filter: l.filter } : {}),
        },
        (payload: any) => {
          try {
            l.callback(payload);
          } catch (e) {
            console.error(`[realtime:${channelName}] listener threw`, e);
          }
        }
      );
    });

    ch.subscribe((subStatus) => {
      log("status:", subStatus);
      if (subStatus === "SUBSCRIBED") {
        setStatus("connected");
        reconnectAttemptsRef.current = 0;
      } else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT") {
        setStatus("error");
        scheduleReconnect();
      } else if (subStatus === "CLOSED") {
        setStatus("closed");
        scheduleReconnect();
      }
    });

    channelRef.current = ch;
  }, [cleanup, channelName, log, scheduleReconnect]);

  connectRef.current = connect;

  // Initial connect + cleanup
  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  // A quiet channel is healthy. Reconnect only after a real lifecycle/network
  // transition or an explicit channel error, then let polling reconcile gaps.
  useEffect(() => {
    const recover = () => {
      log("station resumed — reconnecting");
      connect();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") recover();
    };
    window.addEventListener("online", recover);
    window.addEventListener("pageshow", recover);
    document.addEventListener("resume", recover);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", recover);
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("resume", recover);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connect, log]);

  return { status };
}

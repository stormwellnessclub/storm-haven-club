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
  /** How long without a server event before forcing a reconnect. Default 90s. */
  staleAfterMs?: number;
  /** Verbose console logs for debugging. */
  debug?: boolean;
}

/**
 * Wraps a Supabase realtime channel with:
 *  - automatic reconnect on CHANNEL_ERROR / TIMED_OUT / CLOSED
 *  - exponential backoff (1s → 30s)
 *  - "stale" detection: if no events for `staleAfterMs`, force reconnect
 *  - exposes connection status so the UI can show a health indicator
 */
export function useReliableRealtime({
  channelName,
  listeners,
  staleAfterMs = 90_000,
  debug = false,
}: Options) {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const connect = useCallback(() => {
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
          lastActivityRef.current = Date.now();
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
      lastActivityRef.current = Date.now();
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
  }, [cleanup, channelName, log]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    const attempt = reconnectAttemptsRef.current++;
    const delay = Math.min(30_000, 1000 * Math.pow(2, attempt));
    log(`reconnect in ${delay}ms (attempt ${attempt + 1})`);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, delay);
  }, [connect, log]);

  // Initial connect + cleanup
  useEffect(() => {
    connect();
    return () => {
      cleanup();
      if (staleTimerRef.current) clearInterval(staleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  // Stale-detection watchdog
  useEffect(() => {
    if (staleTimerRef.current) clearInterval(staleTimerRef.current);
    staleTimerRef.current = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (status === "connected" && idleFor > staleAfterMs) {
        log(`stale for ${idleFor}ms — forcing reconnect`);
        lastActivityRef.current = Date.now();
        connect();
      }
    }, 30_000);
    return () => {
      if (staleTimerRef.current) clearInterval(staleTimerRef.current);
    };
  }, [status, staleAfterMs, connect, log]);

  // Reconnect on tab focus (covers laptop sleep, network blips)
  useEffect(() => {
    const onFocus = () => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (status !== "connected" || idleFor > 60_000) {
        log("tab focus — reconnecting");
        connect();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [status, connect, log]);

  return { status };
}

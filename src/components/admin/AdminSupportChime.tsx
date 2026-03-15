import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminSupportNotifications } from "@/hooks/useAdminSupportNotifications";

// ── AudioContext singleton ──────────────────────────────────────────
let sharedAudioCtx: AudioContext | null = null;
let audioCtxWarmedUp = false;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function warmUpAudio() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (ctx.state === "running") audioCtxWarmedUp = true;
}

// Warm-up on first user interaction
if (typeof window !== "undefined") {
  const handler = () => {
    warmUpAudio();
    if (audioCtxWarmedUp) {
      document.removeEventListener("click", handler);
      document.removeEventListener("keydown", handler);
    }
  };
  document.addEventListener("click", handler);
  document.addEventListener("keydown", handler);
}

// ── Chime player ────────────────────────────────────────────────────
export async function playNotificationChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();

    const playSequence = (startTime: number, volume: number) => {
      const tones = [
        { freq: 660, delay: 0, duration: 0.3 },
        { freq: 880, delay: 0.32, duration: 0.3 },
        { freq: 1047, delay: 0.64, duration: 0.4 },
      ];
      for (const tone of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = tone.freq;
        osc.type = "triangle";
        const t = startTime + tone.delay;
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + tone.duration);
        osc.start(t);
        osc.stop(t + tone.duration);
      }
    };

    const now = ctx.currentTime;
    playSequence(now, 0.4);
    playSequence(now + 1.1, 0.25);
  } catch {
    // AudioContext may not be available
  }
}

// ── Mute helpers ────────────────────────────────────────────────────
const MUTE_KEY = "admin-chime-muted";
export function getIsMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === "true";
}
export function setIsMuted(val: boolean) {
  localStorage.setItem(MUTE_KEY, val ? "true" : "false");
}

// ── Component ───────────────────────────────────────────────────────
const FIVE_MINUTES = 5 * 60 * 1000;

export function AdminSupportChime() {
  const queryClient = useQueryClient();
  const { data: notifications } = useAdminSupportNotifications();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chimeSafe = useCallback(() => {
    if (!getIsMuted()) playNotificationChime();
  }, []);

  // Realtime: instant chime on new conversations / member messages
  useEffect(() => {
    const channel = supabase
      .channel("global-support-chime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "email_conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-support-notifications"] });
        queryClient.invalidateQueries({ queryKey: ["checkin-support-conversations"] });
        chimeSafe();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "email_messages", filter: "sender_type=eq.member" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-support-notifications"] });
        queryClient.invalidateQueries({ queryKey: ["checkin-support-conversations"] });
        chimeSafe();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, chimeSafe]);

  // 5-minute recurring reminder while unread messages exist
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const unread = notifications?.unreadCount ?? 0;
      const open = notifications?.openCount ?? 0;
      if ((unread > 0 || open > 0) && !getIsMuted()) {
        playNotificationChime();
      }
    }, FIVE_MINUTES);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [notifications]);

  // Warm up audio on click
  useEffect(() => {
    const handler = () => warmUpAudio();
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return null; // Invisible — audio only
}

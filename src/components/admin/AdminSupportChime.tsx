import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminSupportNotifications } from "@/hooks/useAdminSupportNotifications";
import { useReliableRealtime, type RealtimeStatus } from "@/hooks/useReliableRealtime";

// ── Chime player (HTML Audio + embedded WAV) ────────────────────────
const CHIME_DATA_URI = "data:audio/wav;base64," + "UklGRuqnAQBXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YcanAQAA";

// We'll generate the real data URI at module load from a tiny inline WAV
let chimeDataUri: string | null = null;

function generateChimeWav(): string {
  const sampleRate = 44100;
  const tones: Array<{ freq: number; duration: number; volume: number }> = [
    { freq: 660, duration: 0.18, volume: 0.98 },
    { freq: 880, duration: 0.18, volume: 0.95 },
    { freq: 1047, duration: 0.3, volume: 0.9 },
    // gap
    { freq: 660, duration: 0.18, volume: 0.9 },
    { freq: 880, duration: 0.18, volume: 0.88 },
    { freq: 1047, duration: 0.3, volume: 0.85 },
  ];

  const gapSamples = Math.floor(sampleRate * 0.02);
  const bigGapSamples = Math.floor(sampleRate * 0.05);
  const segments: number[][] = [];

  tones.forEach((tone, i) => {
    const n = Math.floor(sampleRate * tone.duration);
    const samples: number[] = [];
    for (let j = 0; j < n; j++) {
      const t = j / sampleRate;
      const env = tone.volume * (1 - j / n);
      samples.push(env * Math.sin(2 * Math.PI * tone.freq * t));
    }
    segments.push(samples);
    if (i === 2) {
      segments.push(new Array(bigGapSamples).fill(0));
    } else if (i < 5) {
      segments.push(new Array(gapSamples).fill(0));
    }
  });

  const allSamples = segments.flat();
  const numSamples = allSamples.length;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, allSamples[i]));
    view.setInt16(44 + i * 2, val * 32767, true);
  }

  // Convert to base64 data URI
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

// Generate once at module load
try {
  chimeDataUri = generateChimeWav();
} catch (e) {
  console.warn("Failed to generate chime WAV:", e);
}

export async function playNotificationChime() {
  if (!chimeDataUri) {
    console.warn("Chime data URI not available");
    return;
  }
  try {
    const audio = new Audio(chimeDataUri);
    audio.volume = 0.7;
    await audio.play();
  } catch (err) {
    console.warn("Failed to play notification chime:", err);
  }
}

// ── Mute helpers ────────────────────────────────────────────────────
const MUTE_KEY = "admin-chime-muted";
let inMemoryMutePreference = false;

export function getIsMuted(): boolean {
  if (typeof window === "undefined") return inMemoryMutePreference;

  try {
    return window.localStorage.getItem(MUTE_KEY) === "true";
  } catch (error) {
    console.warn("Failed to read admin chime preference from storage:", error);
    return inMemoryMutePreference;
  }
}

export function setIsMuted(val: boolean) {
  inMemoryMutePreference = val;

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(MUTE_KEY, val ? "true" : "false");
  } catch (error) {
    console.warn("Failed to persist admin chime preference:", error);
  }
}

// ── Component ───────────────────────────────────────────────────────
const FIVE_MINUTES = 5 * 60 * 1000;

interface Props {
  onStatusChange?: (s: RealtimeStatus) => void;
}

export function AdminSupportChime({ onStatusChange }: Props = {}) {
  const queryClient = useQueryClient();
  const { data: notifications } = useAdminSupportNotifications();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenUnreadRef = useRef<number | null>(null);
  const lastSeenOpenRef = useRef<number | null>(null);
  const justChimedViaRealtimeRef = useRef(false);

  const chimeSafe = useCallback(() => {
    if (!getIsMuted()) playNotificationChime();
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-support-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["checkin-support-conversations"] });
  }, [queryClient]);

  const { status } = useReliableRealtime({
    channelName: "global-support-chime",
    listeners: [
      {
        event: "INSERT",
        table: "email_conversations",
        callback: () => {
          invalidate();
          justChimedViaRealtimeRef.current = true;
          chimeSafe();
          setTimeout(() => { justChimedViaRealtimeRef.current = false; }, 35_000);
        },
      },
      {
        event: "INSERT",
        table: "email_messages",
        filter: "sender_type=eq.member",
        callback: () => {
          invalidate();
          justChimedViaRealtimeRef.current = true;
          chimeSafe();
          setTimeout(() => { justChimedViaRealtimeRef.current = false; }, 35_000);
        },
      },
    ],
  });

  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

  // Polling fallback: chime if unread/open grew without a realtime event
  useEffect(() => {
    const unread = notifications?.unreadCount ?? 0;
    const open = notifications?.openCount ?? 0;
    const prevUnread = lastSeenUnreadRef.current;
    const prevOpen = lastSeenOpenRef.current;
    if (
      prevUnread !== null && prevOpen !== null &&
      (unread > prevUnread || open > prevOpen) &&
      !justChimedViaRealtimeRef.current
    ) {
      console.log("[support chime] polling fallback triggered");
      chimeSafe();
    }
    lastSeenUnreadRef.current = unread;
    lastSeenOpenRef.current = open;
  }, [notifications?.unreadCount, notifications?.openCount, chimeSafe]);

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

  return null; // Invisible — audio only
}

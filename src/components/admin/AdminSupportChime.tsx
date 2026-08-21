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
  // Three-note ascending bell: firm attack, long tail, near full amplitude so
  // it carries across a busy reception area.
  const tones: Array<{ freq: number; duration: number; volume: number }> = [
    { freq: 784, duration: 0.32, volume: 0.9 },
    { freq: 1047, duration: 0.32, volume: 0.9 },
    { freq: 1319, duration: 0.95, volume: 0.95 },
  ];

  const gapSamples = Math.floor(sampleRate * 0.03);
  const segments: number[][] = [];

  tones.forEach((tone, i) => {
    const n = Math.floor(sampleRate * tone.duration);
    const attack = Math.floor(sampleRate * 0.004);
    const isLast = i === tones.length - 1;
    const samples: number[] = [];
    for (let j = 0; j < n; j++) {
      const t = j / sampleRate;
      const ramp = j < attack ? j / attack : 1;
      // exponential decay — longer tail on the final note
      const decay = Math.exp((isLast ? -2.6 : -3.6) * (j / n));
      const env = tone.volume * ramp * decay;
      // fundamental + a touch of the octave so it cuts through room noise
      const wave =
        0.82 * Math.sin(2 * Math.PI * tone.freq * t) +
        0.18 * Math.sin(4 * Math.PI * tone.freq * t);
      samples.push(env * wave);
    }

    segments.push(samples);
    if (!isLast) segments.push(new Array(gapSamples).fill(0));
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

// Shared WebAudio context so we can amplify beyond the 1.0 ceiling of <audio>
let sharedCtx: AudioContext | null = null;
let decodedChime: AudioBuffer | null = null;

// ── Volume preference (per device) ──────────────────────────────────
export type ChimeVolume = "quiet" | "normal" | "loud";
const VOLUME_KEY = "admin-chime-volume";
const VOLUME_GAIN: Record<ChimeVolume, number> = { quiet: 1.0, normal: 2.5, loud: 4.5 };
let inMemoryVolume: ChimeVolume | null = null;

export function getChimeVolume(): ChimeVolume {
  if (inMemoryVolume) return inMemoryVolume;
  if (typeof window === "undefined") return "normal";
  try {
    const stored = window.localStorage.getItem(VOLUME_KEY) as ChimeVolume | null;
    if (stored === "quiet" || stored === "normal" || stored === "loud") return stored;
    // Front desk / kiosk stations default to loud; admin desks to normal.
    const path = window.location.pathname;
    return path.startsWith("/frontdesk") || path.startsWith("/kiosk") ? "loud" : "normal";
  } catch {
    return "normal";
  }
}

export function setChimeVolume(v: ChimeVolume) {
  inMemoryVolume = v;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOLUME_KEY, v);
  } catch (error) {
    console.warn("Failed to persist chime volume:", error);
  }
}


function getCtx(): AudioContext | null {
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx) sharedCtx = new Ctx();
  return sharedCtx;
}

/**
 * Wake the SHARED audio engine used by the chime. Must be called from a real
 * user gesture (pointerdown/keydown) — browsers keep new AudioContexts
 * suspended until then.
 */
export async function unlockChimeAudio(): Promise<void> {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch (err) {
    console.warn("unlockChimeAudio failed:", err);
  }
}

/** True when the shared audio engine is missing or still blocked by the browser. */
export function isAudioBlocked(): boolean {
  if (typeof window === "undefined") return false;
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return false; // no WebAudio — HTMLAudio fallback handles it
  return !sharedCtx || sharedCtx.state !== "running";
}

async function playViaWebAudio(): Promise<boolean> {
  try {
    const ctx = getCtx();
    if (!ctx || !chimeDataUri) return false;
    if (ctx.state === "suspended") await ctx.resume();
    // A suspended context accepts start() silently — treat it as a failure so
    // the caller falls back to the HTMLAudio path instead of playing nothing.
    if (ctx.state !== "running") return false;

    if (!decodedChime) {
      const res = await fetch(chimeDataUri);
      const arr = await res.arrayBuffer();
      decodedChime = await ctx.decodeAudioData(arr);
    }

    const src = ctx.createBufferSource();
    src.buffer = decodedChime;

    const gain = ctx.createGain();
    gain.gain.value = VOLUME_GAIN[getChimeVolume()];

    // Limiter so the boost stays loud without clipping/distorting.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    src.connect(gain);
    gain.connect(comp);
    comp.connect(ctx.destination);
    src.start(0);
    return true;
  } catch (err) {
    console.warn("WebAudio chime failed, falling back:", err);
    return false;
  }
}

export type ChimePlayResult = "played" | "blocked" | "failed";

export async function playNotificationChime(): Promise<ChimePlayResult> {
  if (!chimeDataUri) {
    console.warn("Chime data URI not available");
    return "failed";
  }
  if (await playViaWebAudio()) return "played";
  try {
    const audio = new Audio(chimeDataUri);
    audio.volume = 1;
    await audio.play();
    // WebAudio was blocked/suspended; the element played, but the browser may
    // still be throttling. Report blocked so the UI can prompt for a tap.
    return isAudioBlocked() ? "blocked" : "played";
  } catch (err) {
    console.warn("Failed to play notification chime:", err);
    return "blocked";
  }
}

/** Plays the bell twice with a short pause — used for recurring reminders. */
export async function playChimeTwice(): Promise<ChimePlayResult> {
  const first = await playNotificationChime();
  setTimeout(() => { void playNotificationChime(); }, 1800);
  return first;
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
const REMINDER_INTERVAL = 60 * 1000;

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

  // Recurring reminder while requests are still unacknowledged ("received" silences it)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const unacked = notifications?.unacknowledgedCount ?? 0;
      if (unacked > 0 && !getIsMuted()) {
        void playChimeTwice();

      }
    }, REMINDER_INTERVAL);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [notifications]);

  return null; // Invisible — audio only
}

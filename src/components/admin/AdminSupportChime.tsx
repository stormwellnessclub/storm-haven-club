import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminSupportNotifications } from "@/hooks/useAdminSupportNotifications";
import { useReliableRealtime, type RealtimeStatus } from "@/hooks/useReliableRealtime";

// ── Chime library ───────────────────────────────────────────────────
export type ChimeSound =
  | "bell"
  | "marimba"
  | "softChime"
  | "doorbell"
  | "waterDrop"
  | "harp";

export const CHIME_SOUNDS: Array<{ value: ChimeSound; label: string; hint: string }> = [
  { value: "softChime", label: "Soft Chime", hint: "Warm two-note, easy on the ears" },
  { value: "marimba", label: "Marimba", hint: "Wooden, rounded taps" },
  { value: "harp", label: "Harp Sweep", hint: "Gentle rising arpeggio" },
  { value: "doorbell", label: "Doorbell", hint: "Classic ding-dong" },
  { value: "waterDrop", label: "Water Drop", hint: "Very subtle blip" },
  { value: "bell", label: "Alert Bell", hint: "Bright and cutting (original)" },
];

type Tone = {
  freq: number;
  duration: number;
  volume: number;
  start: number; // seconds offset
  decay: number; // exponential decay factor
  harmonic?: number; // octave mix amount
  attack?: number;
};

const SOUND_RECIPES: Record<ChimeSound, Tone[]> = {
  bell: [
    { freq: 784, duration: 0.32, volume: 0.9, start: 0, decay: 3.6, harmonic: 0.18 },
    { freq: 1047, duration: 0.32, volume: 0.9, start: 0.35, decay: 3.6, harmonic: 0.18 },
    { freq: 1319, duration: 0.95, volume: 0.95, start: 0.7, decay: 2.6, harmonic: 0.18 },
  ],
  softChime: [
    { freq: 660, duration: 1.1, volume: 0.75, start: 0, decay: 3.2, harmonic: 0.05, attack: 0.02 },
    { freq: 880, duration: 1.4, volume: 0.7, start: 0.22, decay: 2.8, harmonic: 0.05, attack: 0.02 },
  ],
  marimba: [
    { freq: 523, duration: 0.5, volume: 0.85, start: 0, decay: 7, harmonic: 0.3, attack: 0.002 },
    { freq: 659, duration: 0.5, volume: 0.8, start: 0.14, decay: 7, harmonic: 0.3, attack: 0.002 },
    { freq: 784, duration: 0.7, volume: 0.8, start: 0.28, decay: 6, harmonic: 0.3, attack: 0.002 },
  ],
  harp: [
    { freq: 523, duration: 0.9, volume: 0.55, start: 0, decay: 4, harmonic: 0.12, attack: 0.006 },
    { freq: 659, duration: 0.9, volume: 0.55, start: 0.08, decay: 4, harmonic: 0.12, attack: 0.006 },
    { freq: 784, duration: 0.9, volume: 0.55, start: 0.16, decay: 4, harmonic: 0.12, attack: 0.006 },
    { freq: 1047, duration: 1.2, volume: 0.6, start: 0.24, decay: 3.2, harmonic: 0.12, attack: 0.006 },
  ],
  doorbell: [
    { freq: 659, duration: 0.6, volume: 0.85, start: 0, decay: 4.5, harmonic: 0.2, attack: 0.005 },
    { freq: 523, duration: 1.1, volume: 0.85, start: 0.45, decay: 3.2, harmonic: 0.2, attack: 0.005 },
  ],
  waterDrop: [
    { freq: 1200, duration: 0.18, volume: 0.6, start: 0, decay: 9, harmonic: 0, attack: 0.002 },
    { freq: 900, duration: 0.35, volume: 0.5, start: 0.1, decay: 7, harmonic: 0, attack: 0.002 },
  ],
};

function renderWav(tones: Tone[]): string {
  const sampleRate = 44100;
  const totalSeconds = Math.max(...tones.map((t) => t.start + t.duration)) + 0.05;
  const numSamples = Math.floor(sampleRate * totalSeconds);
  const mix = new Float32Array(numSamples);

  for (const tone of tones) {
    const offset = Math.floor(tone.start * sampleRate);
    const n = Math.floor(tone.duration * sampleRate);
    const attack = Math.max(1, Math.floor((tone.attack ?? 0.006) * sampleRate));
    const harmonic = tone.harmonic ?? 0;
    for (let j = 0; j < n; j++) {
      const idx = offset + j;
      if (idx >= numSamples) break;
      const t = j / sampleRate;
      const ramp = j < attack ? j / attack : 1;
      const env = tone.volume * ramp * Math.exp(-tone.decay * (j / n));
      const wave =
        (1 - harmonic) * Math.sin(2 * Math.PI * tone.freq * t) +
        harmonic * Math.sin(4 * Math.PI * tone.freq * t);
      mix[idx] += env * wave;
    }
  }

  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
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
    const val = Math.max(-1, Math.min(1, mix[i]));
    view.setInt16(44 + i * 2, val * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

const uriCache = new Map<ChimeSound, string>();

function getChimeUri(sound: ChimeSound): string | null {
  try {
    if (!uriCache.has(sound)) uriCache.set(sound, renderWav(SOUND_RECIPES[sound]));
    return uriCache.get(sound) ?? null;
  } catch (e) {
    console.warn("Failed to generate chime WAV:", e);
    return null;
  }
}

// ── Sound preference (per device) ───────────────────────────────────
const SOUND_KEY = "admin-chime-sound";
let inMemorySound: ChimeSound | null = null;

export function getChimeSound(): ChimeSound {
  if (inMemorySound) return inMemorySound;
  if (typeof window === "undefined") return "softChime";
  try {
    const stored = window.localStorage.getItem(SOUND_KEY) as ChimeSound | null;
    if (stored && stored in SOUND_RECIPES) return stored;
  } catch {
    /* ignore */
  }
  return "softChime";
}

export function setChimeSound(s: ChimeSound) {
  inMemorySound = s;
  decodedCache.delete(s);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_KEY, s);
  } catch (error) {
    console.warn("Failed to persist chime sound:", error);
  }
}

// Shared WebAudio context so we can amplify beyond the 1.0 ceiling of <audio>
let sharedCtx: AudioContext | null = null;
const decodedCache = new Map<ChimeSound, AudioBuffer>();


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
  // A context can end up "closed" (or wedged after the laptop sleeps / the
  // audio device changes). Rebuild it instead of playing into a dead engine.
  if (sharedCtx && sharedCtx.state === "closed") {
    sharedCtx = null;
    decodedCache.clear();
  }
  if (!sharedCtx) sharedCtx = new Ctx();
  return sharedCtx;
}

// A single reusable <audio> element, primed during a user gesture. Reusing a
// primed element survives long idle periods far better than `new Audio()`.
let primedEl: HTMLAudioElement | null = null;
let primedSound: ChimeSound | null = null;
let audioReady = false;

function getPrimedElement(sound: ChimeSound): HTMLAudioElement | null {
  const uri = getChimeUri(sound);
  if (!uri) return null;
  if (!primedEl) {
    primedEl = new Audio();
    primedEl.preload = "auto";
  }
  if (primedSound !== sound) {
    primedEl.src = uri;
    primedSound = sound;
  }
  return primedEl;
}

/**
 * Wake the SHARED audio engine used by the chime. Must be called from a real
 * user gesture (pointerdown/keydown) — browsers keep new AudioContexts
 * suspended until then.
 */
export async function unlockChimeAudio(): Promise<void> {
  try {
    const ctx = getCtx();
    if (ctx) {
      if (ctx.state !== "running") await ctx.resume();
        if (ctx.state === "running") audioReady = true;
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    }
    // Prime the fallback element too, silently.
    const el = getPrimedElement(getChimeSound());
    if (el) {
      const prevVol = el.volume;
      el.volume = 0;
      try {
        await el.play();
        audioReady = true;
        el.pause();
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      el.volume = prevVol || 1;
    }
  } catch (err) {
    console.warn("unlockChimeAudio failed:", err);
  }
}


/** True when the shared audio engine is missing or still blocked by the browser. */
export function isAudioBlocked(): boolean {
  if (typeof window === "undefined") return false;
  return !audioReady;
}

/** Browser sleep/page freeze can invalidate a previously unlocked output path. */
export function markChimeAudioNeedsUnlock() {
  audioReady = false;
}

async function playViaWebAudio(sound: ChimeSound, retry = true): Promise<boolean> {
  try {
    let ctx = getCtx();
    const uri = getChimeUri(sound);
    if (!ctx || !uri) return false;
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    // The context can get stuck "suspended"/"interrupted" after the machine
    // sleeps or the audio device changes. Tear it down once and rebuild so the
    // next attempt runs on a fresh engine instead of silently playing nothing.
    if (ctx.state !== "running") {
      if (!retry) return false;
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
      sharedCtx = null;
      decodedCache.clear();
      ctx = getCtx();
      if (!ctx) return false;
      if (ctx.state !== "running") {
        try {
          await ctx.resume();
        } catch {
          /* ignore */
        }
      }
      if (ctx.state !== "running") return false;
    }



    let decoded = decodedCache.get(sound);
    if (!decoded) {
      const res = await fetch(uri);
      const arr = await res.arrayBuffer();
      decoded = await ctx.decodeAudioData(arr);
      decodedCache.set(sound, decoded);
    }

    const src = ctx.createBufferSource();
    src.buffer = decoded;

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

export async function playNotificationChime(soundOverride?: ChimeSound): Promise<ChimePlayResult> {
  const sound = soundOverride ?? getChimeSound();
  const uri = getChimeUri(sound);
  if (!uri) {
    console.warn("Chime data URI not available");
    return "failed";
  }
    if (await playViaWebAudio(sound)) {
      audioReady = true;
      return "played";
    }
  try {
    // Reuse the element primed during a user gesture; fall back to a new one.
    const audio = getPrimedElement(sound) ?? new Audio(uri);
    audio.volume = 1;
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
    await audio.play();
    audioReady = true;
    return "played";
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
const SUPPORT_CURSOR_KEY = "station-support-message-cursor";

function readSessionCursor(key: string): string | null | undefined {
  try {
    const value = window.sessionStorage.getItem(key);
    return value === null ? undefined : value;
  } catch {
    return undefined;
  }
}

function writeSessionCursor(key: string, value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

interface Props {
  onStatusChange?: (s: RealtimeStatus) => void;
}

export function AdminSupportChime({ onStatusChange }: Props = {}) {
  const queryClient = useQueryClient();
  const { data: notifications } = useAdminSupportNotifications();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenMessageAtRef = useRef<string | null | undefined>(readSessionCursor(SUPPORT_CURSOR_KEY));

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
        table: "email_messages",
        filter: "sender_type=eq.member",
        callback: (payload) => {
          invalidate();
          const createdAt = String(payload?.new?.created_at ?? "");
          if (createdAt && createdAt === lastSeenMessageAtRef.current) return;
          if (createdAt) {
            lastSeenMessageAtRef.current = createdAt;
            writeSessionCursor(SUPPORT_CURSOR_KEY, createdAt);
          }
          chimeSafe();
        },
      },
    ],
  });

  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

  // Polling fallback compares event identity, never mutable badge counts.
  useEffect(() => {
    if (!notifications) return;
    const latest = notifications.latestMemberMessageAt ?? null;
    const prevLatest = lastSeenMessageAtRef.current;
    const newerMessage =
      prevLatest !== undefined && !!latest && (!prevLatest || latest > prevLatest);

    if (newerMessage) {
      console.log("[support chime] polling fallback triggered");
      chimeSafe();
    }
    lastSeenMessageAtRef.current = latest;
    writeSessionCursor(SUPPORT_CURSOR_KEY, latest);
  }, [notifications, chimeSafe]);

  // Recurring reminder while requests are still unacknowledged ("received" silences it).
  // The interval is created ONCE — reading counts from a ref — because the
  // notifications query refetches every 30s and would otherwise reset the
  // 60s timer before it ever fired.
  const notifRef = useRef(notifications);
  notifRef.current = notifications;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const unacked = notifRef.current?.unacknowledgedCount ?? 0;
      if (unacked > 0 && !getIsMuted()) {
        void playChimeTwice();
      }
    }, REMINDER_INTERVAL);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return null; // Invisible — audio only
}

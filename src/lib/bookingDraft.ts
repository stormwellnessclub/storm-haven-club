/**
 * Booking draft persistence — keeps mid-flow booking state alive so users
 * can resume after dismissing a sheet, locking their phone, or backgrounding
 * the tab. Each draft is namespaced per kind and TTL'd.
 *
 * Storage shape: { value: T, savedAt: number }
 * Storage backend: sessionStorage (per-tab; auto-clears on tab close)
 */

const TTL_MS = 60 * 60 * 1000; // 60 minutes

export type ClassBookingDraft = {
  sessionId: string;
  sessionDate: string; // YYYY-MM-DD — used to detect stale drafts
  paymentMethod?: "credits" | "pass";
  selectedPassId?: string | null;
  selectedPassType?: string | null;
  showWaiverInline?: boolean;
  waiverAcknowledged?: boolean;
};

export type KidsCareBookingDraft = {
  step?: number;
  childId?: string | null;
  date?: string | null; // YYYY-MM-DD
  startTime?: string | null;
  hours?: number;
  notes?: string;
};

const KEYS = {
  class: "swc:booking-draft:class",
  kidsCare: "swc:booking-draft:kids-care",
} as const;

type Wrapped<T> = { value: T; savedAt: number };

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Wrapped<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    const wrapped: Wrapped<T> = { value, savedAt: Date.now() };
    window.sessionStorage.setItem(key, JSON.stringify(wrapped));
  } catch {
    /* quota / private mode — ignore */
  }
}

function remove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// Class booking
export const readClassDraft = () => read<ClassBookingDraft>(KEYS.class);
export const writeClassDraft = (d: ClassBookingDraft) => write(KEYS.class, d);
export const clearClassDraft = () => remove(KEYS.class);

// Kids care booking
export const readKidsCareDraft = () => read<KidsCareBookingDraft>(KEYS.kidsCare);
export const writeKidsCareDraft = (d: KidsCareBookingDraft) => write(KEYS.kidsCare, d);
export const clearKidsCareDraft = () => remove(KEYS.kidsCare);

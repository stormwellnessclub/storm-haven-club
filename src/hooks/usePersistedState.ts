import { useCallback, useEffect, useRef, useState } from "react";

/**
 * usePersistedState — like useState but mirrored to sessionStorage so that
 * accidental modal dismissals, screen locks, and tab backgrounding don't
 * wipe in-progress form data.
 *
 * Usage:
 *   const [state, setState, clearState] = usePersistedState("my.key", { foo: 1 });
 *   // call clearState() after a successful submission
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  storage: "session" | "local" = "session"
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const store = typeof window !== "undefined"
    ? (storage === "local" ? window.localStorage : window.sessionStorage)
    : null;

  const [state, setState] = useState<T>(() => {
    if (!store) return initial;
    try {
      const raw = store.getItem(key);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  // Keep the latest key on a ref so storage writes survive re-renders cleanly.
  const keyRef = useRef(key);
  useEffect(() => { keyRef.current = key; }, [key]);

  useEffect(() => {
    if (!store) return;
    try {
      store.setItem(keyRef.current, JSON.stringify(state));
    } catch {
      // quota / private mode — ignore silently
    }
  }, [state, store]);

  const clear = useCallback(() => {
    if (store) {
      try { store.removeItem(keyRef.current); } catch { /* ignore */ }
    }
    setState(initial);
    // We deliberately don't include `initial` in deps — caller should treat
    // `initial` as a stable default; if it changes between renders, behavior
    // is best-effort.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  return [state, setState, clear];
}

/**
 * Read a persisted key without subscribing — useful for deciding whether
 * to show a "Resume your in-progress booking" banner.
 */
export function readPersisted<T>(key: string, storage: "session" | "local" = "session"): T | null {
  if (typeof window === "undefined") return null;
  const store = storage === "local" ? window.localStorage : window.sessionStorage;
  try {
    const raw = store.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function clearPersisted(key: string, storage: "session" | "local" = "session") {
  if (typeof window === "undefined") return;
  const store = storage === "local" ? window.localStorage : window.sessionStorage;
  try { store.removeItem(key); } catch { /* ignore */ }
}

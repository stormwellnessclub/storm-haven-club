/**
 * Tab-scoped auth sessions for Front Desk / Kiosk windows.
 *
 * Problem: the Supabase client persists its session in localStorage, which is
 * shared by every window of the browser profile. That makes it impossible to be
 * signed into Admin in one window and Front Desk in another on the same machine.
 *
 * Fix: when a window is opened on a front-desk/kiosk route (or /auth?scope=frontdesk),
 * we mark that tab and transparently redirect ONLY the Supabase auth keys ("sb-*")
 * to sessionStorage, which is per-tab. Every other localStorage key, and every
 * unmarked tab (Admin, member portal, public site), behaves exactly as before.
 *
 * This module must be imported before the Supabase client module is evaluated.
 */

const SCOPE_FLAG = "tab-auth-scope";
const PREFIX = "fdscope::";

function detectFrontDeskTab(): boolean {
  try {
    if (sessionStorage.getItem(SCOPE_FLAG) === "frontdesk") return true;

    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const isFrontDeskPath =
      path === "/frontdesk" ||
      path.startsWith("/frontdesk/") ||
      path === "/front-desk" ||
      path === "/kiosk" ||
      path.startsWith("/kiosk/");
    const isScopedAuth = params.get("scope") === "frontdesk";

    if (isFrontDeskPath || isScopedAuth) {
      sessionStorage.setItem(SCOPE_FLAG, "frontdesk");
      return true;
    }
  } catch {
    /* storage unavailable — fall through */
  }
  return false;
}

export function isFrontDeskScopedTab(): boolean {
  try {
    return sessionStorage.getItem(SCOPE_FLAG) === "frontdesk";
  } catch {
    return false;
  }
}

/** Auth keys written by the Supabase client. */
function isAuthKey(key: string): boolean {
  return key.startsWith("sb-");
}

function installTabScopedAuthStorage() {
  const real = window.localStorage;
  const tab = window.sessionStorage;

  const shim: Storage = {
    get length() {
      let count = 0;
      for (let i = 0; i < real.length; i++) {
        const k = real.key(i);
        if (k && !isAuthKey(k)) count++;
      }
      for (let i = 0; i < tab.length; i++) {
        const k = tab.key(i);
        if (k && k.startsWith(PREFIX)) count++;
      }
      return count;
    },
    key(index: number): string | null {
      const keys: string[] = [];
      for (let i = 0; i < real.length; i++) {
        const k = real.key(i);
        if (k && !isAuthKey(k)) keys.push(k);
      }
      for (let i = 0; i < tab.length; i++) {
        const k = tab.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
      }
      return keys[index] ?? null;
    },
    getItem(key: string): string | null {
      return isAuthKey(key) ? tab.getItem(PREFIX + key) : real.getItem(key);
    },
    setItem(key: string, value: string): void {
      if (isAuthKey(key)) tab.setItem(PREFIX + key, value);
      else real.setItem(key, value);
    },
    removeItem(key: string): void {
      if (isAuthKey(key)) tab.removeItem(PREFIX + key);
      else real.removeItem(key);
    },
    clear(): void {
      // Clear this tab's auth keys, plus non-auth localStorage keys.
      const tabKeys: string[] = [];
      for (let i = 0; i < tab.length; i++) {
        const k = tab.key(i);
        if (k && k.startsWith(PREFIX)) tabKeys.push(k);
      }
      tabKeys.forEach((k) => tab.removeItem(k));

      const realKeys: string[] = [];
      for (let i = 0; i < real.length; i++) {
        const k = real.key(i);
        if (k && !isAuthKey(k)) realKeys.push(k);
      }
      realKeys.forEach((k) => real.removeItem(k));
    },
  };

  try {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => shim,
    });
  } catch (e) {
    console.warn("[tabAuthScope] Could not install tab-scoped auth storage", e);
  }
}

if (detectFrontDeskTab()) {
  installTabScopedAuthStorage();
}

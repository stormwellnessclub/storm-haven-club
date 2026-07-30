/**
 * Kiosk / Front Desk mode helpers.
 *
 * Front desk + kiosk tabs are PIN-gated and intentionally have NO Supabase auth
 * session. Any write that normally relies on `auth.uid()` must therefore route
 * through a kiosk SECURITY DEFINER RPC, or pass the kiosk PIN to an edge
 * function via the `x-kiosk-pin` header.
 */

export function isKioskMode(): boolean {
  try {
    return sessionStorage.getItem("kioskUnlocked") === "true";
  } catch {
    return false;
  }
}

export function getKioskPin(): string | null {
  try {
    return sessionStorage.getItem("kioskPin");
  } catch {
    return null;
  }
}

export function setKioskPin(pin: string) {
  try {
    sessionStorage.setItem("kioskPin", pin);
  } catch {
    /* ignore */
  }
}

/**
 * Exchanges the kiosk PIN for a real, role-limited (front_desk) Supabase
 * session so RLS-protected reads/writes work on the PIN-gated device.
 */
export async function startKioskSession(pin: string): Promise<boolean> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("kiosk-session", {
      body: { pin },
    });
    if (error || !data?.access_token) {
      console.error("kiosk-session failed", error || data);
      return false;
    }
    const { error: sessErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sessErr) {
      console.error("kiosk setSession failed", sessErr);
      return false;
    }
    return true;
  } catch (e) {
    console.error("kiosk-session error", e);
    return false;
  }
}

/** Headers to attach to `supabase.functions.invoke` while in kiosk mode. */
export function kioskHeaders(): Record<string, string> {
  const pin = getKioskPin();
  return isKioskMode() && pin ? { "x-kiosk-pin": pin } : {};
}

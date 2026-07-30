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

/** Headers to attach to `supabase.functions.invoke` while in kiosk mode. */
export function kioskHeaders(): Record<string, string> {
  const pin = getKioskPin();
  return isKioskMode() && pin ? { "x-kiosk-pin": pin } : {};
}

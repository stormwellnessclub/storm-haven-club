import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { RealtimeStatus } from "@/hooks/useReliableRealtime";
import { AdminSupportChime } from "./AdminSupportChime";
import { AdminCafeChime } from "./AdminCafeChime";
import { AudioUnlocker } from "./AudioUnlocker";
import { useAuth } from "@/contexts/AuthContext";

interface StationNotificationState {
  active: boolean;
  supportStatus: RealtimeStatus;
  cafeStatus: RealtimeStatus;
  alertsPaused: boolean;
}

const StationNotificationContext = createContext<StationNotificationState>({
  active: false,
  supportStatus: "idle",
  cafeStatus: "idle",
  alertsPaused: false,
});

function isStationPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/frontdesk") || pathname.startsWith("/kiosk");
}

function kioskIsUnlocked() {
  try {
    return sessionStorage.getItem("kioskUnlocked") === "true";
  } catch {
    return false;
  }
}

/**
 * Owns one notification pipeline for the lifetime of the browser app. It sits
 * above Routes, so normal Admin, Front Desk, and Kiosk navigation cannot tear
 * down listeners, event cursors, or reminder clocks.
 */
export function StationNotificationProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user, authReady } = useAuth();
  const [kioskUnlocked, setKioskUnlocked] = useState(kioskIsUnlocked);
  const [supportStatus, setSupportStatus] = useState<RealtimeStatus>("idle");
  const [cafeStatus, setCafeStatus] = useState<RealtimeStatus>("idle");

  useEffect(() => {
    const syncKioskState = () => setKioskUnlocked(kioskIsUnlocked());
    window.addEventListener("station:kiosk-auth-changed", syncKioskState);
    window.addEventListener("storage", syncKioskState);
    return () => {
      window.removeEventListener("station:kiosk-auth-changed", syncKioskState);
      window.removeEventListener("storage", syncKioskState);
    };
  }, []);

  const isKiosk = pathname.startsWith("/kiosk");
  const isAuthenticatedStation = pathname.startsWith("/admin") || pathname.startsWith("/frontdesk");
  const alertsPaused = isAuthenticatedStation && authReady && !user;
  const active = isStationPath(pathname) && (isKiosk ? kioskUnlocked && !!user : !!user);
  const value = useMemo(
    () => ({ active, supportStatus, cafeStatus, alertsPaused }),
    [active, supportStatus, cafeStatus, alertsPaused],
  );

  return (
    <StationNotificationContext.Provider value={value}>
      {active && (
        <>
          <AudioUnlocker />
          <AdminSupportChime onStatusChange={setSupportStatus} />
          <AdminCafeChime onStatusChange={setCafeStatus} />
        </>
      )}
      {children}
    </StationNotificationContext.Provider>
  );
}

export function useStationNotifications() {
  return useContext(StationNotificationContext);
}
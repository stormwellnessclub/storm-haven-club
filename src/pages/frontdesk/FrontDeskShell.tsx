import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KioskPinGate } from "@/components/kiosk/KioskPinGate";
import { AdminSupportChime } from "@/components/admin/AdminSupportChime";
import { AdminCafeChime } from "@/components/admin/AdminCafeChime";
import { AudioUnlocker } from "@/components/admin/AudioUnlocker";
import { NoIndex } from "@/components/seo/NoIndex";
import stormLogo from "@/assets/storm-logo-gold.png";
import {
  UserCheck, ShoppingBag, GraduationCap, ClipboardList, LogOut, Lock,
  Users, UserSearch, Ticket, Sparkles, UtensilsCrossed, Menu, MessageCircle,
} from "lucide-react";
import { useAdminSupportNotifications } from "@/hooks/useAdminSupportNotifications";
import { format, formatDistanceStrict } from "date-fns";
import { FRONTDESK_BYPASS_SHIFT_ID } from "./ClockInGate";
import { ClockOutPrompt } from "./ClockOutPrompt";
import { CafeOrderBanner } from "@/components/frontdesk/CafeOrderBanner";
import { SupportAlertBanner } from "@/components/frontdesk/SupportAlertBanner";
import { cn } from "@/lib/utils";

const SHIFT_KEY = "frontdeskActiveShift";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface ShiftState {
  shiftId: string;
  staffUserId: string;
  staffName: string;
  clockInAt: string;
}

const TABS = [
  { key: "reception",   label: "Reception",    to: "/frontdesk",              icon: UserCheck },
  { key: "members",     label: "Member Lookup", to: "/frontdesk/members",     icon: Users },
  { key: "non-members", label: "Non-Members",  to: "/frontdesk/non-members",  icon: UserSearch },
  { key: "guest",       label: "Guest Passes", to: "/frontdesk/guest-passes", icon: Ticket },
  { key: "spa",         label: "Spa",          to: "/frontdesk/spa",          icon: Sparkles },
  { key: "schedule",    label: "Schedule",     to: "/frontdesk/schedule",     icon: GraduationCap },
  { key: "events",      label: "Events",       to: "/frontdesk/events",       icon: Ticket },
  { key: "pos",         label: "POS",          to: "/frontdesk/pos",          icon: ShoppingBag },
  { key: "cafe",        label: "Cafe Orders",  to: "/frontdesk/cafe",         icon: UtensilsCrossed },
  { key: "messages",    label: "Messages",     to: "/frontdesk/messages",     icon: MessageCircle },
  { key: "shift",       label: "My Shift",     to: "/frontdesk/shift",        icon: ClipboardList },
] as const;

/**
 * /frontdesk shell — dedicated experience for front-desk staff.
 *
 * Gate:
 *  1. Shared kiosk PIN (device gate) — reuses tab-local `kioskUnlocked` sessionStorage.
 *
 * Front desk mode is intentionally NOT tied to the browser auth session. That
 * lets an admin open /admin in another tab without inheriting front-desk auth,
 * and lets admin logout leave this front desk tab open.
 *
 * NEVER links into /admin. That's the whole point of this shell.
 */
export function FrontDeskShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: supportNotif } = useAdminSupportNotifications();
  const messagesBadge = (supportNotif?.openCount || 0) + (supportNotif?.unreadCount || 0);
  const [deviceUnlocked, setDeviceUnlocked] = useState(false);
  const [shift, setShift] = useState<ShiftState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [clockOutOpen, setClockOutOpen] = useState(false);

  // ── Device gate (shared with /kiosk/*)
  useEffect(() => {
    if (sessionStorage.getItem("kioskUnlocked") === "true") setDeviceUnlocked(true);
  }, []);

  // ── Shift restore
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SHIFT_KEY);
      if (raw) setShift(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // ── Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Idle detector — after 30 min no user input, prompt clock-out
  const lastActivity = useRef<number>(Date.now());
  useEffect(() => {
    const bump = () => (lastActivity.current = Date.now());
    const events = ["mousemove", "keydown", "touchstart", "pointerdown"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = setInterval(() => {
      if (!shift) return;
      if (shift.shiftId === FRONTDESK_BYPASS_SHIFT_ID) return;
      if (Date.now() - lastActivity.current > IDLE_TIMEOUT_MS) {
        setClockOutOpen(true);
      }
    }, 60_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(id);
    };
  }, [shift]);

  const handleClockedIn = useCallback((payload: ShiftState) => {
    sessionStorage.setItem(SHIFT_KEY, JSON.stringify(payload));
    setShift(payload);
  }, []);

  const handleClockedOut = useCallback(() => {
    sessionStorage.removeItem(SHIFT_KEY);
    setShift(null);
  }, []);

  const handleLockDevice = () => {
    sessionStorage.removeItem("kioskUnlocked");
    setDeviceUnlocked(false);
  };

  // Personal staff clock-in is disabled until staff PINs are ready. Auto-create
  // a tab-local bypass shift after the device PIN so the old clock-in box never
  // blocks front desk mode.
  useEffect(() => {
    if (deviceUnlocked && !shift) {
      handleClockedIn({
        shiftId: FRONTDESK_BYPASS_SHIFT_ID,
        staffUserId: "unassigned",
        staffName: "Unassigned (bypass)",
        clockInAt: new Date().toISOString(),
      });
    }
  }, [deviceUnlocked, shift, handleClockedIn]);

  const shiftDuration = useMemo(() => {
    if (!shift) return "";
    try {
      return formatDistanceStrict(new Date(shift.clockInAt), now, { addSuffix: false });
    } catch {
      return "";
    }
  }, [shift, now]);

  // ── Gate 1: device PIN
  if (!deviceUnlocked) {
    return (
      <>
        <NoIndex />
        <KioskPinGate onUnlock={() => setDeviceUnlocked(true)} />
      </>
    );
  }

  if (!shift) {
    return <NoIndex />;
  }

  return (
    <>
      <NoIndex />
      <AudioUnlocker />
      <AdminSupportChime />
      <AdminCafeChime />

      <div className="min-h-screen flex flex-col bg-background">
        {/* Persistent cafe order banner — visible cue for the front desk */}
        <CafeOrderBanner />
        <SupportAlertBanner />

        {/* Top header — clock + shift badge + End Shift / Lock */}
        <header className="border-b bg-card sticky top-0 z-30">
          <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
            <img src={stormLogo} alt="Storm" className="h-8 w-8 object-contain shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Storm • Front Desk</span>
              <span className="text-xs text-muted-foreground">
                {format(now, "EEE, MMM d • h:mm a")}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {shift.shiftId === FRONTDESK_BYPASS_SHIFT_ID ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-amber-500 bg-amber-50 text-amber-900"
                  title="No Staff PIN was used — shift hours aren't being recorded."
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-medium">Tracking off</span>
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-medium">{shift.staffName}</span>
                  <span className="text-muted-foreground">· {shiftDuration}</span>
                </Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-1.5 h-8 px-2.5"
                onClick={() => {
                  if (shift.shiftId === FRONTDESK_BYPASS_SHIFT_ID) {
                    sessionStorage.removeItem(SHIFT_KEY);
                    setShift(null);
                  } else {
                    setClockOutOpen(true);
                  }
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="text-xs">End Shift</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 px-2.5"
                onClick={handleLockDevice}
                title="Lock the device (returns to shared PIN)"
              >
                <Lock className="h-3.5 w-3.5" />
                <span className="text-xs hidden sm:inline">Lock</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Two-pane: left sidebar + main content */}
        <div className="flex-1 min-h-0 flex">
          <aside className="w-48 shrink-0 border-r bg-card hidden md:flex md:flex-col overflow-y-auto">
            <nav className="p-2 flex flex-col gap-1">
              {TABS.map(({ key, label, to, icon: Icon }) => {
                const active =
                  to === "/frontdesk"
                    ? location.pathname === "/frontdesk"
                    : location.pathname.startsWith(to);
                return (
                  <Link key={key} to={to}>
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-2 h-9 px-3",
                        active && "shadow-sm",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium truncate">{label}</span>
                      {key === "messages" && messagesBadge > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                          {messagesBadge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Mobile horizontal tab strip (below md) */}
          <div className="md:hidden fixed top-[48px] left-0 right-0 z-20 bg-card border-b overflow-x-auto">
            <nav className="flex gap-1 px-2 py-1.5 min-w-max">
              {TABS.map(({ key, label, to, icon: Icon }) => {
                const active =
                  to === "/frontdesk"
                    ? location.pathname === "/frontdesk"
                    : location.pathname.startsWith(to);
                return (
                  <Link key={key} to={to}>
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? "default" : "ghost"}
                      className="gap-1.5 h-8 px-2.5 shrink-0"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{label}</span>
                      {key === "messages" && messagesBadge > 0 && (
                        <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[9px]">
                          {messagesBadge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>

          <main className="flex-1 min-w-0 min-h-0 md:pt-0 pt-11">
            {children}
          </main>
        </div>
      </div>

      <ClockOutPrompt
        open={clockOutOpen}
        onOpenChange={setClockOutOpen}
        staffName={shift.staffName}
        onClockedOut={handleClockedOut}
      />
    </>
  );
}

/**
 * Read the currently active shift (or null). Used by components that need
 * to tag their actions with `clocked_in_staff_id`.
 */
export function useActiveFrontDeskShift(): ShiftState | null {
  const [shift, setShift] = useState<ShiftState | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SHIFT_KEY);
      if (raw) setShift(JSON.parse(raw));
    } catch { /* ignore */ }
    const handler = (e: StorageEvent) => {
      if (e.key === SHIFT_KEY) {
        try { setShift(e.newValue ? JSON.parse(e.newValue) : null); } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  return shift;
}

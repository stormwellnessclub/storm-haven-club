import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminSupportChime } from "@/components/admin/AdminSupportChime";
import { ChimeSoundControls } from "@/components/admin/ChimeSoundControls";

import { AdminCafeChime } from "@/components/admin/AdminCafeChime";
import { AudioUnlocker } from "@/components/admin/AudioUnlocker";
import { NoIndex } from "@/components/seo/NoIndex";
import stormLogo from "@/assets/storm-logo-gold.png";
import {
  UserCheck, ShoppingBag, GraduationCap, ClipboardList, LogOut,
  Users, UserSearch, Ticket, Sparkles, UtensilsCrossed, Menu, MessageCircle,
} from "lucide-react";
import { useAdminSupportNotifications } from "@/hooks/useAdminSupportNotifications";
import { format, formatDistanceStrict } from "date-fns";
import { CafeOrderBanner } from "@/components/frontdesk/CafeOrderBanner";
import { SupportAlertBanner } from "@/components/frontdesk/SupportAlertBanner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";


const SHIFT_KEY = "frontdeskActiveShift";

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
 * Access is tied to the authenticated staff session and enforced by the
 * ProtectedFrontDeskRoute wrapper.
 *
 * NEVER links into /admin. That's the whole point of this shell.
 */
export function FrontDeskShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: supportNotif } = useAdminSupportNotifications();
  const messagesBadge = (supportNotif?.openCount || 0) + (supportNotif?.unreadCount || 0);
  const [shift, setShift] = useState<ShiftState | null>(null);
  const [now, setNow] = useState(() => new Date());


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

  // Use the authenticated staff identity for operational attribution.
  useEffect(() => {
    if (user && !shift) {
      const staffName = [user.user_metadata?.first_name, user.user_metadata?.last_name]
        .filter(Boolean)
        .join(" ") || user.email || "Front Desk";
      const authenticatedShift = {
        shiftId: `auth:${user.id}`,
        staffUserId: user.id,
        staffName,
        clockInAt: new Date().toISOString(),
      };
      sessionStorage.setItem(SHIFT_KEY, JSON.stringify(authenticatedShift));
      setShift(authenticatedShift);
    }
  }, [user, shift]);

  const shiftDuration = useMemo(() => {
    if (!shift) return "";
    try {
      return formatDistanceStrict(new Date(shift.clockInAt), now, { addSuffix: false });
    } catch {
      return "";
    }
  }, [shift, now]);

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
              <ChimeSoundControls compact />
              <Badge variant="secondary" className="gap-1.5">

                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium">{shift.staffName}</span>
                <span className="text-muted-foreground">· {shiftDuration}</span>
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 px-2.5"
                onClick={async () => {
                  sessionStorage.removeItem(SHIFT_KEY);
                  await signOut();
                  navigate("/auth?scope=frontdesk", { replace: true });
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="text-xs">Sign out</span>
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
